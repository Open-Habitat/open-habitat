//go:build linux

package daemon

import (
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// Push goes through the same native helper as fetch, with the person's own
// grant: a read-only token is named read_only by connect and check before a
// push meets Gitea's 403, and a write:repository replacement lets the
// existing clone push with no other change. The answer is read without
// pushing.
func TestGiteaPushFollowsTheTokensScope(t *testing.T) {
	w := newGiteaWalk(t)
	status, out, raw := w.gitea("POST", `{"action":"connect","base_url":"`+w.srv.URL+`","token":"tok-ada-0001"}`)
	if status != 200 || out["api"] != "ok" || out["push"] != "read_only" {
		t.Fatalf("connect with a read-only token: %d %s", status, raw)
	}
	ada := out["connection"].(map[string]any)["id"].(string)
	for _, r := range w.srv.GitRequests() {
		if strings.HasSuffix(r.Path, "/git-receive-pack") {
			t.Fatalf("the push answer pushed: %v", w.srv.GitRequests())
		}
	}

	_, started := w.clone(ada, 101)
	if done := w.waitJob(started["job"].(map[string]any)["job_id"].(string)); done["state"] != "confirmed" {
		t.Fatalf("clone: %v", done)
	}
	checkout := filepath.Join(w.home, "src", "notes")
	w.git(checkout, "-c", "user.name=Ada", "-c", "user.email=ada@example.invalid", "commit", "--allow-empty", "-m", "push test")
	head := w.git(checkout, "rev-parse", "HEAD")
	push := func() (string, error) {
		cmd := exec.Command("/usr/bin/git", "push", "origin", "HEAD:refs/heads/push-test")
		cmd.Dir = checkout
		cmd.Env = []string{"HOME=" + w.home, "PATH=/usr/bin:/bin", "GIT_CONFIG_NOSYSTEM=1", "GIT_TERMINAL_PROMPT=0"}
		b, err := cmd.CombinedOutput()
		return string(b), err
	}
	if text, err := push(); err == nil || !strings.Contains(text, "403") {
		t.Fatalf("read-only push: %v %s", err, text)
	}
	if _, out, _ := w.gitea("POST", `{"action":"check","connection_id":"`+ada+`"}`); out["api"] != "ok" || out["push"] != "read_only" {
		t.Fatalf("check of a read-only token: %v", out)
	}

	w.srv.SetToken(7, "tok-ada-write")
	w.srv.SetScopes(7, []string{"read:user", "write:repository"})
	if status, out, raw := w.gitea("POST", `{"action":"replace","connection_id":"`+ada+`","token":"tok-ada-write"}`); status != 200 || out["outcome"] != "written" || out["push"] != "allowed" || strings.Contains(raw, "tok-") {
		t.Fatalf("replace with a write token: %d %s", status, raw)
	}
	if text, err := push(); err != nil {
		t.Fatalf("push with the write token: %v %s", err, text)
	}
	if remote := w.git(checkout, "ls-remote", "origin", "refs/heads/push-test"); !strings.HasPrefix(remote, head) {
		t.Fatalf("server branch: %q, want %s", remote, head)
	}
	if _, out, _ := w.gitea("POST", `{"action":"check","connection_id":"`+ada+`"}`); out["push"] != "allowed" {
		t.Fatalf("check of a write token: %v", out)
	}
	if strings.Contains(w.git(checkout, "config", "--list"), "tok-") {
		t.Fatal("a token reached the clone's configuration")
	}

	// A check that fails reports no push answer at all.
	w.srv.SetToken(7, "tok-ada-revoked")
	if _, out, _ := w.gitea("POST", `{"action":"check","connection_id":"`+ada+`"}`); out["api"] != "token_rejected" || out["push"] != nil {
		t.Fatalf("check of a revoked token: %v", out)
	}
}
