//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/testpython"
	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

func fill(t *testing.T, path string, n int) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, bytes.Repeat([]byte("x"), n), 0600); err != nil {
		t.Fatal(err)
	}
}

func tagCache(t *testing.T, dir string) {
	t.Helper()
	write(t, filepath.Join(dir, "CACHEDIR.TAG"), cacheDirTag+"\n# made by a test\n")
}

// A synthetic home: tool caches, a worktree a running Taskfleet run holds,
// one whose run is done, a hand-made one, and the main checkout's own builds.
func TestStorageBreakdownMeasuresKnownPlaces(t *testing.T) {
	f := newWorktreeFixture(t)
	home := f.cfg.Home
	f.add("live", true)
	f.add("done", true)
	f.add("handmade", true)
	for _, name := range []string{"live", "done", "handmade"} {
		tagCache(t, filepath.Join(f.wt(name), "target"))
		fill(t, filepath.Join(f.wt(name), "target", "debug", "big"), 64<<10)
	}
	// A target without Cargo's tag is not a build directory.
	fill(t, filepath.Join(f.src("app"), "target", "notes"), 4096)
	write(t, filepath.Join(f.src("app"), "web", "package.json"), "{}\n")
	fill(t, filepath.Join(f.src("app"), "web", "node_modules", "dep", "index.js"), 32<<10)
	// node_modules without a package.json beside it is not one either.
	fill(t, filepath.Join(home, "src", "toinen", "node_modules", "x"), 4096)

	fill(t, filepath.Join(home, ".cache", "go-build", "00", "a"), 128<<10)
	fill(t, filepath.Join(home, ".npm", "_cacache", "index"), 16<<10)
	fill(t, filepath.Join(home, ".cache", "ms-playwright", "chromium", "bin"), 16<<10)
	tagCache(t, filepath.Join(home, ".cache", "some-tool"))
	fill(t, filepath.Join(home, ".cache", "some-tool", "blob"), 8<<10)
	fill(t, filepath.Join(home, ".cache", "untagged", "blob"), 8<<10)
	// GOMODCACHE moved with `go env -w`.
	write(t, filepath.Join(home, ".config", "go", "env"), "GOMODCACHE="+filepath.Join(home, "gomod")+"\n")
	fill(t, filepath.Join(home, "gomod", "cache", "download", "m"), 8<<10)
	// A symbolic link out of a cache is never followed, and a file linked
	// twice counts once.
	outside := t.TempDir()
	fill(t, filepath.Join(outside, "huge"), 512<<10)
	if err := os.Symlink(outside, filepath.Join(home, ".cache", "uv")); err != nil {
		t.Fatal(err)
	}
	fill(t, filepath.Join(home, ".cache", "pip", "one"), 64<<10)
	if err := os.Link(filepath.Join(home, ".cache", "pip", "one"), filepath.Join(home, ".cache", "pip", "two")); err != nil {
		t.Fatal(err)
	}
	// A linked worktree no registry here names is not the person's own
	// project, and a FIFO named like a tag cannot hold the measurement.
	write(t, filepath.Join(home, "src", "loose", ".git"), "gitdir: /elsewhere/.git/worktrees/loose\n")
	tagCache(t, filepath.Join(home, "src", "loose", "target"))
	if err := os.MkdirAll(filepath.Join(home, ".cache", "piped"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := unix.Mkfifo(filepath.Join(home, ".cache", "piped", "CACHEDIR.TAG"), 0600); err != nil {
		t.Fatal(err)
	}
	fill(t, filepath.Join(home, ".local", "share", "Trash", "files", "old"), 8<<10)
	fill(t, filepath.Join(home, ".pi", "agent", "sessions", "s.jsonl"), 8<<10)

	runs := []string{
		`{"run_id":"01m53433zdhmcc9q1spepb30g1","status":"running","title":"Live work","supervisor":{"state":"alive"},"worktree_path":"` + f.wt("live") + `"}`,
		`{"run_id":"01m53433zdhmcc9q1spepb30g2","status":"done","title":"Done work","created_at":"2030-01-02T00:00:00Z","worktree_path":"` + f.wt("done") + `"}`,
	}
	script := filepath.Join(home, ".local", "bin", "taskfleet")
	write(t, script, "#!/bin/sh\ncat <<'EOF'\n{\"schema_version\":1,\"data\":{\"runs\":["+strings.Join(runs, ",")+"]}}\nEOF\n")
	if err := os.Chmod(script, 0700); err != nil {
		t.Fatal(err)
	}

	res := measureStorage(context.Background(), f.cfg)
	// The loose worktree is a workspace discovery cannot read, so the
	// listing, and the result, say they are incomplete; each place
	// measured is still measured in full (expect checks).
	by := map[string]breakdownItem{}
	for _, it := range res.items {
		if _, dup := by[it.Path]; dup {
			t.Fatalf("measured twice: %s", it.Path)
		}
		by[it.Path] = it
	}
	expect := func(path, group, kind string, min int64) breakdownItem {
		t.Helper()
		it, ok := by[path]
		if !ok {
			t.Fatalf("%s not measured: %+v", path, res.items)
		}
		if it.Group != group || it.Kind != kind || it.Bytes < min || !it.Complete {
			t.Fatalf("%s: %+v", path, it)
		}
		return it
	}
	expect("~/.cache/go-build", "caches", "go-build", 128<<10)
	expect("~/.npm/_cacache", "caches", "npm", 16<<10)
	expect("~/.cache/ms-playwright", "caches", "playwright", 16<<10)
	expect("~/.cache/some-tool", "caches", "cache-tag", 8<<10)
	expect("~/gomod", "caches", "go-mod", 8<<10)
	if pip := expect("~/.cache/pip", "caches", "pip", 64<<10); pip.Bytes >= 128<<10 {
		t.Fatalf("hard link counted twice: %+v", pip)
	}
	for _, p := range []string{"~/.cache/untagged", "~/.cache/uv", "~/go/pkg/mod", "~/src/app/target", "~/src/toinen/node_modules", "~/src/loose/target", "~/.cache/piped"} {
		if it, ok := by[p]; ok {
			t.Fatalf("%s should not be listed: %+v", p, it)
		}
	}
	rel := func(p string) string { r, _ := filepath.Rel(home, p); return "~/" + r }
	if it := expect(rel(filepath.Join(f.wt("live"), "target")), "live", "target", 64<<10); it.RunID != "01m53433zdhmcc9q1spepb30g1" || it.Title != "Live work" || it.Workspace != "app__worktrees" {
		t.Fatalf("live: %+v", it)
	}
	if it := expect(rel(filepath.Join(f.wt("done"), "target")), "finished", "target", 64<<10); it.RunID != "01m53433zdhmcc9q1spepb30g2" {
		t.Fatalf("finished: %+v", it)
	}
	expect(rel(filepath.Join(f.wt("handmade"), "target")), "own", "target", 64<<10)
	expect("~/src/app/web/node_modules", "own", "node_modules", 32<<10)
	expect("~/.local/share/Trash", "trash", "trash", 8<<10)
	expect("~/.pi/agent/sessions", "history", "history", 8<<10)
	// A workspace's size leaves out the build directories listed apart.
	expect("~/src/app", "workspaces", "workspace", 1)
	wts := expect("~/src/app__worktrees", "workspaces", "workspace", 1)
	if wts.Bytes >= 3*(64<<10) {
		t.Fatalf("worktrees folder counts its targets: %+v", wts)
	}

	// Without Taskfleet's run state no worktree can be shown finished.
	if err := os.WriteFile(script, []byte("#!/bin/sh\nexit 1\n"), 0700); err != nil {
		t.Fatal(err)
	}
	for _, it := range measureStorage(context.Background(), f.cfg).items {
		if it.Group == "finished" || (strings.Contains(it.Path, "__worktrees/") && it.Group != "live") {
			t.Fatalf("unknown run state shown as %s: %+v", it.Group, it)
		}
	}
}

// The reply never waits for a measurement, and a measurement is not
// started again while one runs or moments after one began.
func TestStorageBreakdownHandlerNeverWaits(t *testing.T) {
	cfg, _ := cloneFixture(t)
	cfg.Home = t.TempDir()
	release := make(chan struct{})
	calls := 0
	b := newStorageBreakdown(cfg)
	b.measure = func(context.Context, transport.Config) breakdownResult {
		calls++
		<-release
		return breakdownResult{complete: true, items: []breakdownItem{{Group: "caches", Kind: "npm", Path: "~/.npm/_cacache", Bytes: 4096, Complete: true}}}
	}
	clock := time.Date(2030, 1, 1, 9, 0, 0, 0, time.UTC)
	b.now = func() time.Time { return clock }
	h := b.handler(func(*http.Request) bool { return true })
	var replies []map[string]any
	do := func(method, body string) (int, map[string]any) {
		t.Helper()
		r := httptest.NewRequest(method, "http://unix"+StorageBreakdownPath, strings.NewReader(body))
		r.RequestURI = StorageBreakdownPath
		if body != "" {
			r.Header.Set("Content-Type", "application/json")
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		var out map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &out)
		if w.Code == 200 {
			replies = append(replies, out)
		}
		return w.Code, out
	}
	code, first := do("GET", "")
	if code != 200 || first["measuring"] != true || len(first["items"].([]any)) != 0 || first["measured_at"] != nil {
		t.Fatalf("first read: %d %v", code, first)
	}
	if _, again := do("POST", `{"measure":true}`); again["measuring"] != true {
		t.Fatalf("second ask: %v", again)
	}
	b.mu.Lock()
	done := b.done
	b.mu.Unlock()
	close(release)
	<-done
	code, read := do("GET", "")
	if code != 200 || read["measuring"] != false || read["measured_at"] != "2030-01-01T09:00:00Z" || len(read["items"].([]any)) != 1 || read["complete"] != true {
		t.Fatalf("result: %v", read)
	}
	// Fresh: a read does not measure; a request moments later does not either.
	clock = clock.Add(10 * time.Second)
	do("GET", "")
	do("POST", `{"measure":true}`)
	if b.measuring || calls != 1 {
		t.Fatalf("measured again: %d", calls)
	}
	// Stale after 15 minutes: the read starts a new one and keeps the old result.
	clock = clock.Add(16 * time.Minute)
	release = make(chan struct{})
	if _, stale := do("GET", ""); stale["measuring"] != true || len(stale["items"].([]any)) != 1 {
		t.Fatalf("stale read: %v", stale)
	}
	b.mu.Lock()
	done = b.done
	b.mu.Unlock()
	close(release)
	<-done
	if calls != 2 {
		t.Fatalf("calls: %d", calls)
	}
	for _, tc := range []struct{ method, path, body string }{
		{"POST", StorageBreakdownPath, `{"measure":false}`},
		{"POST", StorageBreakdownPath, `{"measure":true,"path":"/"}`},
		{"POST", StorageBreakdownPath, `{"measure":true,"measure":true}`},
		{"PUT", StorageBreakdownPath, `{"measure":true}`},
		{"GET", StorageBreakdownPath + "?home=/root", ""},
	} {
		r := httptest.NewRequest(tc.method, "http://unix"+tc.path, strings.NewReader(tc.body))
		r.RequestURI = tc.path
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != 400 {
			t.Fatalf("%+v: %d", tc, w.Code)
		}
	}
	denied := b.handler(func(*http.Request) bool { return false })
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "http://unix"+StorageBreakdownPath, nil)
	r.RequestURI = StorageBreakdownPath
	denied.ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatalf("untrusted peer: %d", w.Code)
	}
	all, _ := json.Marshal(replies)
	cmd := exec.Command(testpython.Validator(t), "-c", `import sys,runpy,json; m=runpy.run_path('../../scripts/validate-contracts.py'); v=m['Draft202012Validator'](m['schemas']['account-storage-breakdown.schema.json'],registry=m['registry'],format_checker=m['format_checker']); [v.validate(r) for r in json.load(sys.stdin)]`)
	cmd.Stdin = bytes.NewReader(all)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("contract: %s: %v", out, err)
	}
}
