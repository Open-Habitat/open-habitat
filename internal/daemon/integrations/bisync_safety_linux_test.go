//go:build linux

package integrations

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// realBisyncPair is a Dropbox account whose remote is an alias for a local
// directory, driven by the operator-pinned rclone, after the chosen first
// pass over files placed in the "cloud". No provider or token is involved.
func realBisyncPair(t *testing.T, files map[string]string) (env Env, address, local, remote string) {
	t.Helper()
	tool := os.Getenv("OH_TEST_RCLONE")
	if tool == "" {
		t.Skip("set OH_TEST_RCLONE to the disposable rclone v1.71.2 executable")
	}
	env = dropboxEnv(t)
	env.Config.Tools["rclone"] = tool
	address = "p@example.test"
	local = filepath.Join(env.Home, "cloud/dropbox", address)
	remote = filepath.Join(env.Home, "synthetic-provider")
	for _, p := range []string{local, remote, filepath.Join(env.Home, dropboxDir)} {
		if err := os.MkdirAll(p, 0700); err != nil {
			t.Fatal(err)
		}
	}
	writeFile(t, filepath.Join(env.Home, dropboxDir, address+".conf"), "[dropbox]\ntype = alias\nremote = "+remote+"\n")
	for name, content := range files {
		writeFile(t, filepath.Join(remote, name), content)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := (&dropbox{}).ChooseFolders(ctx, env, address, []string{"all"}); err != nil {
		t.Fatal(err)
	}
	return env, address, local, remote
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
}

// tree reads every file below dir by relative name.
func tree(t *testing.T, dir string) map[string]string {
	t.Helper()
	out := map[string]string{}
	err := filepath.WalkDir(dir, func(path string, e os.DirEntry, err error) error {
		if err != nil || e.IsDir() {
			return err
		}
		b, err := os.ReadFile(path)
		rel, _ := filepath.Rel(dir, path)
		out[rel] = string(b)
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	return out
}

// conflictName is the name bisyncCommand gives the local loser of a conflict
// on day.
func conflictName(stem, ext string, day time.Time) string {
	return stem + ".habitat-" + day.Format("2006-01-02") + "-1" + ext
}

// assertBisyncSafety checks a provider's steady loop for the shared bisync
// flags: the cloud copy keeps its name on a conflict, the safeguards stay on
// and --force is never unconditional.
func assertBisyncSafety(t *testing.T, cmd Command) {
	t.Helper()
	script := strings.Join(cmd.Args, " ")
	for _, want := range []string{
		"'bisync' ",
		"'--max-delete' '50'",
		"'--conflict-resolve' 'path2' '--conflict-loser' 'num' '--conflict-suffix' 'habitat-{DateOnly}-' '--suffix-keep-extension'",
		`case " $OPEN_HABITAT_FORCE " in *" 0 "*)`,
	} {
		if !strings.Contains(script, want) {
			t.Fatalf("steady loop lacks %s: %s", want, script)
		}
	}
	if strings.Contains(script, "'none'") || strings.Contains(script, "'--force'") || strings.Contains(script, "--resync") {
		t.Fatalf("steady loop: %s", script)
	}
}

// A file both an agent and a colleague changed keeps the colleague's (cloud)
// version under its own name on both sides, and the agent's version arrives
// beside it with the extension intact, in the same pass.
func TestBisyncConflictKeepsTheCloudName(t *testing.T) {
	env, address, local, remote := realBisyncPair(t, map[string]string{"Budget.docx": "original", "notes.txt": "unchanged"})
	writeFile(t, filepath.Join(local, "Budget.docx"), "agent's version")
	writeFile(t, filepath.Join(remote, "Budget.docx"), "colleague's version")
	cmd, ok := dropboxBisync(env, address)
	if !ok {
		t.Fatal("no native command")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	day := time.Now()
	if _, err := env.run(ctx, cmd, nil); err != nil {
		t.Fatal(err)
	}
	if now := time.Now(); now.Format("2006-01-02") != day.Format("2006-01-02") {
		t.Skip("the pass crossed midnight")
	}
	want := map[string]string{
		"Budget.docx":                        "colleague's version",
		conflictName("Budget", ".docx", day): "agent's version",
		"notes.txt":                          "unchanged",
	}
	for side, dir := range map[string]string{"local": local, "cloud": remote} {
		if got := tree(t, dir); !mapsEqual(got, want) {
			t.Fatalf("%s side after the conflict: %v", side, got)
		}
	}
}

func mapsEqual(a, b map[string]string) bool {
	if len(a) != len(b) {
		return false
	}
	for k, v := range a {
		if w, ok := b[k]; !ok || w != v {
			return false
		}
	}
	return true
}

// runLoop runs a steady loop until it exits after a failed round.
func runLoop(t *testing.T, env Env, loop Command, force string) string {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	cmd := env.command(ctx, loop)
	if force != "" {
		cmd.Env = append(cmd.Env, forceEnv+"="+force)
	}
	var stderr lockedBuffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err == nil || ctx.Err() != nil {
		t.Fatalf("loop did not stop on a failed round: %v\n%s", err, stderr.String())
	}
	return stderr.String()
}

// An agent that edits every file of a small flat folder trips bisync's
// all-files-changed abort, which repeats on every pass because the listings
// stay as they were. The daemon names it and resumes that pass once with
// --force, but only while a fresh check finds no mass deletion; edits on
// both sides survive.
func TestBisyncAllFilesChangedResumesSafely(t *testing.T) {
	interval := syncInterval
	syncInterval = 50 * time.Millisecond
	t.Cleanup(func() { syncInterval = interval })
	original := map[string]string{"a.md": "a", "b.md": "b", "c.md": "c"}
	env, address, local, remote := realBisyncPair(t, original)
	for name := range original {
		writeFile(t, filepath.Join(local, name), "reformatted "+name)
	}
	cmd, ok := dropboxBisync(env, address)
	if !ok {
		t.Fatal("no native command")
	}
	loop := syncLoop([]syncPass{{Work: dropboxWork(address), Cmd: cmd}})

	// bisync's own guard, as every pass met it before the fix.
	if out := runLoop(t, env, loop, ""); !strings.Contains(out, "all files were changed") {
		t.Fatalf("expected the all-files-changed abort:\n%s", out)
	}
	if got := tree(t, remote); !mapsEqual(got, original) {
		t.Fatalf("aborted pass changed the cloud: %v", got)
	}

	// A mass deletion since the abort is not forced through.
	for _, name := range []string{"a.md", "b.md"} {
		os.Remove(filepath.Join(local, name))
	}
	if out := runLoop(t, env, loop, "0"); !strings.Contains(out, "too many deletes") || strings.Contains(out, "all files were changed") {
		t.Fatalf("expected the deletion safeguard:\n%s", out)
	}
	if got := tree(t, remote); !mapsEqual(got, original) {
		t.Fatalf("mass deletion reached the cloud: %v", got)
	}

	// The edits are back and a colleague changed one file meanwhile.
	for _, name := range []string{"a.md", "b.md"} {
		writeFile(t, filepath.Join(local, name), "reformatted "+name)
	}
	writeFile(t, filepath.Join(remote, "b.md"), "colleague's b")

	var journal lockedBuffer
	c := New(env, []Entry{&dropbox{}}, slog.New(slog.NewJSONHandler(&journal, nil)), WithQuota(func() Room { return Room{Free: 2 << 30, OK: true} }), WithSyncBackoff(20*time.Millisecond, 80*time.Millisecond))
	t.Cleanup(c.sync.stopAll)
	day := time.Now()
	c.write.Lock()
	c.reconcile()
	c.write.Unlock()
	want := map[string]string{
		"a.md":                        "reformatted a.md",
		"b.md":                        "colleague's b",
		conflictName("b", ".md", day): "reformatted b.md",
		"c.md":                        "reformatted c.md",
	}
	deadline := time.Now().Add(20 * time.Second)
	for !mapsEqual(tree(t, remote), want) || !mapsEqual(tree(t, local), want) {
		if time.Now().After(deadline) {
			t.Fatalf("not resumed: cloud %v, local %v, card %v", tree(t, remote), tree(t, local), dropboxService(t, c))
		}
		time.Sleep(50 * time.Millisecond)
	}
	waitFor(t, "healthy card", func() bool {
		s := dropboxService(t, c)
		return s["state"] == string(StateOK) && s["failure"] == nil
	})
	if !strings.Contains(journal.String(), `"outcome":"resuming","reason":"all_changed"`) {
		t.Fatalf("journal does not name the reason: %s", journal.String())
	}
}
