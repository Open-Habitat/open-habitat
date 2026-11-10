package main

import (
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"sync/atomic"

	"github.com/open-habitat/open-habitat/internal/daemon/integrations"
	"github.com/open-habitat/open-habitat/internal/nativegitea"
	"github.com/open-habitat/open-habitat/internal/nativegitea/giteafake"
)

// The synthetic host's Gitea is a real HTTPS server on loopback with real Git
// smart HTTP (internal/nativegitea/giteafake), so the browser path runs the
// product's daemon routes, tea file, Git helper, clone job and fetch against
// it unchanged. Only its TLS trust is the fixture's: the Go client is given
// the server's certificate and each synthetic home's Git configuration trusts
// it for this one address. Gitea is offered only after /fixture/gitea
// enables it, so other cases see the integrations page as before.

const giteaFixtureToken = "gitea-pat-synthetic-0001"

// giteaFixtureScopes are the token's scopes as the connect form asks for
// them; the read-only action takes write:repository away.
var giteaFixtureScopes = []string{"read:user", "write:repository"}

var giteaEnabled atomic.Bool

// giteaHold is the fixture's hold on Git transfers. One lock covers placing
// a new gate and releasing the old one, so overlapping holds and releases
// never leave transfers unheld after a hold has answered.
var giteaHold struct {
	sync.Mutex
	release func()
}

func startGiteaFixture(tmp string) *giteafake.Server {
	dir := filepath.Join(tmp, "gitea")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil
	}
	srv, err := giteafake.Start(dir, []giteafake.Account{{ID: 9001, Login: "fixture", Token: giteaFixtureToken, Scopes: giteaFixtureScopes}}, []giteafake.Repo{
		{ID: 2001, Owner: "fixture", Name: "notes", Private: true, Description: "Synthetic Gitea notes"},
		{ID: 2002, Owner: "fixture", Name: "first", Private: true, Description: "Same name as the GitHub repository"},
		{ID: 2003, Owner: "fixture", Name: "blank", Private: true, Empty: true},
	})
	if err != nil {
		return nil
	}
	return srv
}

// giteaFixtureHome trusts the synthetic server's certificate for its own
// address in one synthetic home; the operator's CA is an OS prerequisite
// in production.
func giteaFixtureHome(home string, srv *giteafake.Server) error {
	f, err := os.OpenFile(filepath.Join(home, ".gitconfig"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = f.WriteString("[http \"" + srv.URL + "\"]\n\tsslCAInfo = " + srv.CAFile + "\n")
	return err
}

func giteaFixtureAdapter(env integrations.Env, srv *giteafake.Server, self string) *integrations.GiteaAdapter {
	if srv == nil {
		return nil
	}
	g, err := integrations.NewGitea(env, nativegitea.NewClientWithRoots(srv.Roots), "/usr/bin/git", self)
	if err != nil {
		return nil
	}
	return g
}

// giteaFixtureControl serves /fixture/gitea: enable or disable the provider,
// push one more upstream commit to fixture/notes, hold or release every Git
// transfer (a slow clone), or make the API answer 500 to the fixture's token
// and recover (an unwell server, so its source fails alone), or make the
// token read-only and writable again; enable restores a writable token.
// Each answer names
// the address and the synthetic token a test types into the form.
func giteaFixtureControl(srv *giteafake.Server, w http.ResponseWriter, r *http.Request) {
	if srv == nil {
		http.Error(w, "gitea fixture unavailable", 503)
		return
	}
	switch r.URL.Query().Get("action") {
	case "enable":
		giteaEnabled.Store(true)
		srv.SetScopes(9001, giteaFixtureScopes)
	case "read-only":
		srv.SetScopes(9001, []string{"read:user", "read:repository"})
	case "writable":
		srv.SetScopes(9001, giteaFixtureScopes)
	case "disable":
		giteaEnabled.Store(false)
	case "hold":
		giteaHold.Lock()
		release := srv.Block()
		if giteaHold.release != nil {
			giteaHold.release()
		}
		giteaHold.release = release
		giteaHold.Unlock()
	case "release":
		giteaHold.Lock()
		if giteaHold.release != nil {
			giteaHold.release()
			giteaHold.release = nil
		}
		giteaHold.Unlock()
	case "fail":
		srv.FailAPI(giteaFixtureToken, true)
	case "recover":
		srv.FailAPI(giteaFixtureToken, false)
	case "commit":
		if err := srv.AddCommit("fixture", "notes", "UPSTREAM.md", "upstream change\n"); err != nil {
			http.Error(w, "commit failed", 500)
			return
		}
	default:
		http.Error(w, "unknown gitea fixture action", 400)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"url": srv.URL, "token": giteaFixtureToken})
}

// giteaInterruptedFixture leaves in ~/src/<name> what a Gitea clone job of
// fixture/<name> leaves when the daemon stops mid-transfer: the new
// repository's origin and account, and nothing else.
func giteaInterruptedFixture(srv *giteafake.Server, home, name string, w http.ResponseWriter) {
	if srv == nil || (name != "notes" && name != "first") {
		http.Error(w, "invalid fixture", 400)
		return
	}
	destination := filepath.Join(home, "src", name)
	if err := os.RemoveAll(destination); err != nil {
		http.Error(w, "fixture failed", 500)
		return
	}
	origin := srv.URL + "/fixture/" + name + ".git"
	for _, args := range [][]string{{"init", "-q", destination}, {"-C", destination, "config", "credential." + origin + ".username", "fixture"}, {"-C", destination, "remote", "add", "origin", origin}} {
		if out, err := exec.Command("/usr/bin/git", args...).CombinedOutput(); err != nil {
			http.Error(w, "fixture failed: "+string(out), 500)
			return
		}
	}
	w.WriteHeader(204)
}
