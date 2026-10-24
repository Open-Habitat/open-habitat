package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sync/atomic"

	"github.com/Open-Habitat/open-habitat/internal/daemon/integrations"
	"github.com/Open-Habitat/open-habitat/internal/nativegitea"
	"github.com/Open-Habitat/open-habitat/internal/nativegitea/giteafake"
)

// The synthetic host's Gitea is a real HTTPS server on loopback with real Git
// smart HTTP (internal/nativegitea/giteafake), so the browser path runs the
// product's daemon routes, tea file, Git helper, clone job and fetch against
// it unchanged. Only its TLS trust is the fixture's: the Go client is given
// the server's certificate and each synthetic home's Git configuration trusts
// it for this one address. Gitea is offered only after /fixture/gitea
// enables it, so other cases see the integrations page as before.

const giteaFixtureToken = "gitea-pat-synthetic-0001"

var giteaEnabled atomic.Bool

func startGiteaFixture(tmp string) *giteafake.Server {
	dir := filepath.Join(tmp, "gitea")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil
	}
	srv, err := giteafake.Start(dir, []giteafake.Account{{ID: 9001, Login: "fixture", Token: giteaFixtureToken}}, []giteafake.Repo{
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
// or push one more upstream commit to fixture/notes. Each answer names the
// address and the synthetic token a test types into the form.
func giteaFixtureControl(srv *giteafake.Server, w http.ResponseWriter, r *http.Request) {
	if srv == nil {
		http.Error(w, "gitea fixture unavailable", 503)
		return
	}
	switch r.URL.Query().Get("action") {
	case "enable":
		giteaEnabled.Store(true)
	case "disable":
		giteaEnabled.Store(false)
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
