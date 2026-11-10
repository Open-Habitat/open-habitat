//go:build linux

package daemon

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/daemon/integrations"
)

// A PAT that lacks read:user or read:repository is no working connection:
// connect and replace refuse it with insufficient_scope before tea's file or
// Git's helper changes, and check reports it for a PAT tea already holds.
func TestGiteaConnectReplaceCheckNeedBothScopes(t *testing.T) {
	w := newGiteaWalk(t)
	tea := filepath.Join(w.home, ".config", "tea", "config.yml")
	gitconfig := filepath.Join(w.home, ".gitconfig")
	gitBefore, _ := os.ReadFile(gitconfig)
	for _, scopes := range [][]string{{"read:user"}, {"read:repository"}} {
		w.srv.SetScopes(7, scopes)
		if status, out, raw := w.gitea("POST", `{"action":"connect","base_url":"`+w.srv.URL+`","token":"tok-ada-0001"}`); status != 422 || code(out) != "insufficient_scope" || strings.Contains(raw, "tok-") {
			t.Fatalf("connect %v: %d %s", scopes, status, raw)
		}
		if _, err := os.Stat(tea); !os.IsNotExist(err) {
			t.Fatalf("connect %v wrote tea's file: %v", scopes, err)
		}
		if b, _ := os.ReadFile(gitconfig); string(b) != string(gitBefore) {
			t.Fatalf("connect %v registered the helper: %s", scopes, b)
		}
	}

	w.srv.SetScopes(7, nil)
	ada := w.connect(w.srv.URL, "tok-ada-0001")
	bob := w.connect(w.srv.URL, "tok-bob-0002")

	// The scope went missing after connect (the PAT tea holds was made with
	// tea itself, or by hand): check names it, the list does too, and the
	// other account is unaffected.
	w.srv.SetScopes(7, []string{"read:user"})
	if status, out, _ := w.gitea("POST", `{"action":"check","connection_id":"`+ada+`"}`); status != 200 || out["outcome"] != "checked" || out["api"] != "insufficient_scope" {
		t.Fatalf("check without read:repository: %d %v", status, out)
	}
	if _, out, _ := w.gitea("POST", `{"action":"check","connection_id":"`+bob+`"}`); out["api"] != "ok" {
		t.Fatalf("check of the other account: %v", out)
	}
	_, repos, _ := w.request("GET", integrations.GiteaReposPath, "")
	for _, s := range repos["sources"].([]any) {
		source := s.(map[string]any)
		want := map[string]string{ada: "failed", bob: "ok"}[source["connection_id"].(string)]
		if source["state"] != want || (want == "failed" && source["failure"] != "insufficient_scope") {
			t.Fatalf("source: %v", source)
		}
	}
	w.srv.SetScopes(7, []string{"read:repository"})
	if _, out, _ := w.gitea("POST", `{"action":"check","connection_id":"`+ada+`"}`); out["api"] != "insufficient_scope" {
		t.Fatalf("check without read:user: %v", out)
	}

	// A replacement lacking either scope leaves tea's file as it was.
	w.srv.SetToken(7, "tok-ada-0003")
	teaBefore, _ := os.ReadFile(tea)
	for _, scopes := range [][]string{{"read:user"}, {"read:repository"}} {
		w.srv.SetScopes(7, scopes)
		if status, out, _ := w.gitea("POST", `{"action":"replace","connection_id":"`+ada+`","token":"tok-ada-0003"}`); status != 422 || code(out) != "insufficient_scope" {
			t.Fatalf("replace %v: %d %v", scopes, status, out)
		}
		if b, _ := os.ReadFile(tea); string(b) != string(teaBefore) {
			t.Fatalf("replace %v changed tea's file", scopes)
		}
	}
	w.srv.SetScopes(7, nil)
	if status, out, _ := w.gitea("POST", `{"action":"replace","connection_id":"`+ada+`","token":"tok-ada-0003"}`); status != 200 || out["outcome"] != "written" || out["api"] != "ok" {
		t.Fatalf("replace: %d %v", status, out)
	}
	if _, out, _ := w.gitea("POST", `{"action":"check","connection_id":"`+ada+`"}`); out["api"] != "ok" {
		t.Fatalf("check after replacement: %v", out)
	}
}
