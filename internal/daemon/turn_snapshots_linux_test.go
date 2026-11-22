//go:build linux

package daemon

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/transport"
)

// The turn-changes read trusts nothing in the session but a well-formed
// record: a store that is a link, a store name that climbs, or a tree id that
// is not one gives "no snapshot", and a run steered before it settled is
// compared up to the next run's start.
func TestTurnChangesReadTrustsOnlyTheOwnStore(t *testing.T) {
	if _, err := os.Stat("/usr/bin/git"); err != nil {
		t.Skip("git not installed")
	}
	home := t.TempDir()
	cwd := filepath.Join(home, "w")
	store := filepath.Join(home, ".pi", "agent", "file-history", "own", "tree.git")
	for _, d := range []string{cwd, store} {
		if err := os.MkdirAll(d, 0700); err != nil {
			t.Fatal(err)
		}
	}
	git := func(input string, args ...string) string {
		t.Helper()
		cmd := exec.Command("/usr/bin/git", append([]string{"--git-dir=" + store}, args...)...)
		cmd.Env = []string{"HOME=" + home, "PATH=/usr/bin:/bin", "GIT_CONFIG_NOSYSTEM=1"}
		cmd.Stdin = strings.NewReader(input)
		out, err := cmd.Output()
		if err != nil {
			t.Fatalf("git %v: %v", args, err)
		}
		return strings.TrimSpace(string(out))
	}
	git("", "init", "--quiet", "--bare")
	blob := func(text string) string { return git(text, "hash-object", "-w", "--stdin") }
	tree := func(entries string) string { return git(entries, "mktree") }
	t0 := tree("100644 blob " + blob("a\n") + "\ta.txt\n")
	t1 := tree("100644 blob " + blob("a\nb\n") + "\ta.txt\n")
	t2 := tree("100644 blob " + blob("a\nb\n") + "\ta.txt\n100644 blob " + blob("new\n") + "\tb.txt\n")
	// Another person's store, reached through a link in this one's home.
	elsewhere := filepath.Join(t.TempDir(), "tree.git")
	if err := os.Rename(store, elsewhere); err != nil {
		t.Fatal(err)
	}
	linked := filepath.Join(home, ".pi", "agent", "file-history", "linked")
	if err := os.MkdirAll(linked, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(elsewhere, filepath.Join(linked, "tree.git")); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(store, 0700); err != nil {
		t.Fatal(err)
	}
	copyCmd := exec.Command("cp", "-a", elsewhere+"/.", store)
	if out, err := copyCmd.CombinedOutput(); err != nil {
		t.Fatalf("copy store: %s", out)
	}
	record := func(id, parent, user, phase, storeID, treeID string) string {
		data := map[string]any{"version": 1, "userEntryId": user, "phase": phase, "tree": treeID, "reason": nil, "store": storeID, "root": cwd, "cwd": cwd, "timestamp": "2026-11-22T10:00:00Z", "skipped": map[string]any{"count": 0, "paths": []any{}, "truncated": false}}
		if phase == "end" {
			data["outcome"] = "completed"
		}
		b, _ := json.Marshal(map[string]any{"type": "custom", "customType": "turn-snapshot", "id": id, "parentId": parent, "data": data})
		return string(b)
	}
	lines := []string{
		`{"type":"session","version":3,"id":"22222222-2222-4222-8222-222222222222","timestamp":"2026-11-22T10:00:00Z","cwd":"` + cwd + `"}`,
		`{"type":"message","id":"u1","parentId":null,"message":{"role":"user","content":"one"}}`,
		record("s1", "u1", "u1", "start", "own", t0),
		// u2 steered u1's run: u1's window ends at u2's start.
		`{"type":"message","id":"u2","parentId":"s1","message":{"role":"user","content":"two"}}`,
		record("s2", "u2", "u2", "start", "own", t1),
		record("e2", "s2", "u2", "end", "own", t2),
		`{"type":"message","id":"u3","parentId":"e2","message":{"role":"user","content":"three"}}`,
		record("s3", "u3", "u3", "start", "linked", t0),
		record("e3", "s3", "u3", "end", "linked", t1),
		`{"type":"message","id":"u4","parentId":"e3","message":{"role":"user","content":"four"}}`,
		record("s4", "u4", "u4", "start", "../own", t0),
		record("e4", "s4", "u4", "end", "../own", t1),
		`{"type":"message","id":"u5","parentId":"e4","message":{"role":"user","content":"five"}}`,
		record("s5", "u5", "u5", "start", "own", "HEAD"),
		record("e5", "s5", "u5", "end", "own", t1),
	}
	path := filepath.Join(home, "s.jsonl")
	if err := os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	c := &ConversationController{home: home, cfg: transport.Config{Home: home, UID: os.Geteuid()}}
	read := func(entry, file string) (int, turnChangesReply) {
		w := httptest.NewRecorder()
		c.turnChanges(w, path, "22222222-2222-4222-8222-222222222222", entry, file)
		var reply turnChangesReply
		_ = json.Unmarshal(w.Body.Bytes(), &reply)
		return w.Code, reply
	}
	if code, r := read("u1", ""); code != 200 || !r.Snapshot || r.Settled || len(r.Files) != 1 || r.Files[0].Path != "a.txt" {
		t.Fatalf("steered run: %d %+v", code, r)
	}
	if _, r := read("u2", ""); !r.Snapshot || !r.Settled || len(r.Files) != 1 || r.Files[0].Path != "b.txt" || r.Files[0].Change != "added" {
		t.Fatalf("settled run: %+v", r)
	}
	for _, entry := range []string{"u3", "u4", "u5", "missing"} {
		if code, r := read(entry, ""); code != 200 || r.Snapshot || len(r.Files) != 0 {
			t.Fatalf("%s: %d %+v, want no snapshot", entry, code, r)
		}
		if code, _ := read(entry, "a.txt"); code != 404 {
			t.Fatalf("%s diff: %d, want 404", entry, code)
		}
	}
}

func TestRewindQueryGrammar(t *testing.T) {
	for q, want := range map[string]bool{
		"entry=a1":                 true,
		"turn=a1":                  true,
		"turn=a1&path=src%2Fa.py":  true,
		"turn=a1&path=":            false,
		"entry=a1&path=x":          false,
		"turn=a1&turn=b2":          false,
		"turn=..%2Fx":              false,
		"turn=a1&path=a%00b":       false,
		"turn=a1&path=x&branch=a1": false,
		"branch=a1&path=x":         false,
	} {
		r := httptest.NewRequest(http.MethodGet, "http://unix/x?"+q, nil)
		if got := rewindQuery(r.URL.Query()); got != want {
			t.Errorf("%s: %v, want %v", q, got, want)
		}
	}
}

func TestTurnSnapshotRecorderFollowsTheRewindSwitch(t *testing.T) {
	home := t.TempDir()
	if err := os.MkdirAll(filepath.Join(home, ".config", "open-habitat"), 0700); err != nil {
		t.Fatal(err)
	}
	if args := turnSnapshotArgs(home, "/x"); args != nil {
		t.Fatalf("recorder without preferences: %v", args)
	}
	write := func(on bool) {
		b, _ := json.Marshal(map[string]any{"engine": "codemirror6", "experimental": map[string]bool{RewindFeature: on}})
		if err := os.WriteFile(filepath.Join(home, ".config", "open-habitat", "preferences.json"), b, 0600); err != nil {
			t.Fatal(err)
		}
	}
	write(false)
	if args := turnSnapshotArgs(home, "/x"); args != nil {
		t.Fatalf("recorder with the switch off: %v", args)
	}
	write(true)
	if args := turnSnapshotArgs(home, "/x"); len(args) != 2 || args[1] != "/x/turn-snapshots/extensions/snapshots.ts" {
		t.Fatalf("recorder with the switch on: %v", args)
	}
}
