//go:build linux

package daemon

import (
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/daemon/integrations"
	"github.com/open-habitat/open-habitat/internal/nativegitea/giteafake"
	"github.com/open-habitat/open-habitat/internal/transport"
)

// The common catalog keeps every source apart: two accounts of one Gitea
// are two grants, the same owner/name on another Gitea is another
// repository, a token that now authenticates someone else lists nothing
// under the entry's name, and one source failing leaves the others. A clone
// is recognised by its origin, per server, never by its directory name and
// never as an account.
func TestGiteaCommonCatalogKeepsSourcesApart(t *testing.T) {
	w := newGiteaWalk(t)
	// A second Gitea with an account of the same name and a repository of
	// the same owner/name and even the same id.
	other, err := giteafake.Start(t.TempDir(), []giteafake.Account{{ID: 70, Login: "ada", Token: "tok-ada-0b"}, {ID: 71, Login: "eve", Token: "tok-eve-0b"}}, []giteafake.Repo{{ID: 101, Owner: "ada", Name: "notes", Private: true}})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(other.Close)
	pemBytes, _ := os.ReadFile(other.CAFile)
	block, _ := pem.Decode(pemBytes)
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		t.Fatal(err)
	}
	w.srv.Roots.AddCert(cert)
	gc, _ := os.OpenFile(filepath.Join(w.home, ".gitconfig"), os.O_APPEND|os.O_WRONLY, 0o600)
	_, _ = gc.WriteString("[http \"" + other.URL + "\"]\n\tsslCAInfo = " + other.CAFile + "\n")
	gc.Close()
	// bob collaborates on one of ada's repositories, and ada on one of an
	// owner that is no account (an organisation).
	if err := w.srv.AddRepo(giteafake.Repo{ID: 104, Owner: "ada", Name: "shared", Private: true, Readers: []int64{8}}); err != nil {
		t.Fatal(err)
	}
	if err := w.srv.AddRepo(giteafake.Repo{ID: 105, Owner: "team", Name: "handbook", Readers: []int64{7}}); err != nil {
		t.Fatal(err)
	}

	adaA := w.connect(w.srv.URL, "tok-ada-0001")
	bobA := w.connect(w.srv.URL, "tok-bob-0002")
	adaB := w.connect(other.URL, "tok-ada-0b")
	sources := func() map[string]map[string]any {
		t.Helper()
		status, out, raw := w.request("GET", integrations.GiteaReposPath, "")
		if status != 200 || strings.Contains(raw, "tok-") {
			t.Fatalf("repos: %d %s", status, raw)
		}
		bySource := map[string]map[string]any{}
		for _, s := range out["sources"].([]any) {
			source := s.(map[string]any)
			bySource[source["connection_id"].(string)] = source
		}
		return bySource
	}
	repos := func(source map[string]any) map[string]map[string]any {
		out := map[string]map[string]any{}
		for _, r := range source["repositories"].([]any) {
			repo := r.(map[string]any)
			out[repo["full_name"].(string)] = repo
		}
		return out
	}
	all := sources()
	if len(all) != 3 || all[adaA]["base_url"] == all[adaB]["base_url"] || all[adaA]["base_url"] != all[bobA]["base_url"] {
		t.Fatalf("sources: %v", all)
	}
	a, b, bob := repos(all[adaA]), repos(all[adaB]), repos(all[bobA])
	if a["ada/notes"]["id"] != 101.0 || b["ada/notes"]["id"] != 101.0 || len(b) != 1 {
		t.Fatalf("the same owner/name and id on two servers: %v / %v", a, b)
	}
	// Owned is Gitea's owner id against the token's account, per source.
	if a["ada/shared"]["owned"] != true || bob["ada/shared"]["owned"] != false || a["team/handbook"]["owned"] != false || bob["bob/notes"]["owned"] != true || b["ada/notes"]["owned"] != true {
		t.Fatalf("ownership: %v / %v / %v", a, bob, b)
	}
	for id, s := range all {
		if s["state"] != "ok" || s["complete"] != true || s["incomplete"] != nil {
			t.Fatalf("%s: %v", id, s)
		}
	}

	// ada clones the shared repository from server A.
	status, started := w.clone(adaA, 104)
	job, _ := started["job"].(map[string]any)
	if status != 200 {
		t.Fatalf("start: %d %v", status, started)
	}
	if done := w.waitJob(job["job_id"].(string)); done["state"] != "confirmed" {
		t.Fatalf("clone: %v", done)
	}
	checkout := filepath.Join(w.home, "src", "shared")
	remote := w.git(checkout, "remote", "get-url", "origin")
	// A directory of another name with the same origin is the same
	// repository; one named like B's ada/notes but cloned from A is not B's.
	w.git(w.home, "clone", "-q", "--no-checkout", checkout, filepath.Join(w.home, "src", "elsewhere"))
	w.git(filepath.Join(w.home, "src", "elsewhere"), "remote", "set-url", "origin", remote)
	if err := os.Mkdir(filepath.Join(w.home, "src", "notes"), 0o700); err != nil {
		t.Fatal(err)
	}
	w.git(filepath.Join(w.home, "src", "notes"), "init", "-q")
	w.git(filepath.Join(w.home, "src", "notes"), "remote", "add", "origin", w.srv.URL+"/ada/notes.git")
	// An SSH origin of a connected server is never assumed to be its
	// HTTPS repository, nor is an address with credentials in it.
	for name, origin := range map[string]string{"ssh": "git@" + strings.TrimPrefix(w.srv.URL, "https://") + ":ada/shared.git", "userinfo": strings.Replace(remote, "https://", "https://ada:tok-ada-0001@", 1)} {
		dir := filepath.Join(w.home, "src", name)
		if err := os.Mkdir(dir, 0o700); err != nil {
			t.Fatal(err)
		}
		w.git(dir, "init", "-q")
		w.git(dir, "remote", "add", "origin", origin)
	}

	cfg := transport.Config{UID: os.Geteuid(), Home: w.home}
	trusted := func(*http.Request) bool { return true }
	h := snapshotHandlerWithForges(cfg, trusted, func(transport.Config) Discovery { return DiscoverFixtureRoot(w.home, os.Geteuid()) }, nativeSessions, w.home, unknownGitHub, nil, nil, Forges{Gitea: w.adapter})
	snapshot := func() (map[string]any, string) {
		t.Helper()
		r := httptest.NewRequest("GET", "http://unix/api/v1/snapshot", nil)
		r.RequestURI = SnapshotPath
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, r)
		if rec.Code != 200 {
			t.Fatalf("snapshot %d: %s", rec.Code, rec.Body.String())
		}
		var doc map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &doc); err != nil {
			t.Fatal(err)
		}
		origins := map[string]any{}
		for _, ws := range doc["workspaces"].([]any) {
			workspace := ws.(map[string]any)
			origins[workspace["name"].(string)] = workspace["gitea_origin"]
		}
		return origins, rec.Body.String()
	}
	origins, raw := snapshot()
	want := map[string]any{"base_url": w.srv.URL, "full_name": "ada/shared"}
	for name, expected := range map[string]any{"shared": want, "elsewhere": want, "notes": map[string]any{"base_url": w.srv.URL, "full_name": "ada/notes"}, "ssh": nil, "userinfo": nil} {
		if got, _ := json.Marshal(origins[name]); string(got) != mustJSON(expected) {
			t.Fatalf("%s: %s, want %s", name, got, mustJSON(expected))
		}
	}
	if strings.Contains(raw, "tok-") || strings.Contains(raw, ".git\"") || strings.Contains(raw, "git@") {
		t.Fatalf("snapshot carries an address or a token: %s", raw)
	}
	// Reading the snapshot (what opening the existing clone from bob's row
	// shows) never changes which account the clone uses.
	if got := w.git(checkout, "config", "--get", "credential."+remote+".username"); got != "ada" {
		t.Fatalf("clone's account %q", got)
	}

	// A token replaced by hand with another account's lists nothing under
	// ada's entry on B, and a token revoked at A fails only bob's source.
	tea := filepath.Join(w.home, ".config", "tea", "config.yml")
	data, _ := os.ReadFile(tea)
	if err := os.WriteFile(tea, []byte(strings.Replace(string(data), "tok-ada-0b", "tok-eve-0b", 1)), 0o600); err != nil {
		t.Fatal(err)
	}
	w.srv.SetToken(8, "tok-bob-rotated")
	all = sources()
	if all[adaB]["state"] != "failed" || all[adaB]["failure"] != "account_mismatch" || len(all[adaB]["repositories"].([]any)) != 0 {
		t.Fatalf("another account's token: %v", all[adaB])
	}
	if all[bobA]["state"] != "failed" || all[bobA]["failure"] != "token_rejected" {
		t.Fatalf("revoked token: %v", all[bobA])
	}
	if all[adaA]["state"] != "ok" || len(all[adaA]["repositories"].([]any)) != 4 {
		t.Fatalf("healthy source: %v", all[adaA])
	}
	// Origins match the server, not a working account: the clone is still
	// ada/shared on A.
	if origins, _ := snapshot(); mustJSON(origins["shared"]) != mustJSON(want) {
		t.Fatalf("origin after rotation: %v", origins["shared"])
	}
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
