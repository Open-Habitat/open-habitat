//go:build linux

package daemon

import (
	"github.com/Open-Habitat/open-habitat/internal/daemon/integrations"
	"github.com/Open-Habitat/open-habitat/internal/nativegitlab"
)

// Forges are the native code-host adapters the daemon's routes share: the
// integrations routes, the clone jobs, the workspace fetch and the snapshot's
// origin matches all use the same ones, because a store's holds are how a
// running clone refuses a disconnect. Either may be nil.
type Forges struct {
	Gitea  *integrations.GiteaAdapter
	GitLab *integrations.GitLabAdapter
}

// gitlabOriginMatch is the safe fact a workspace's origin gives about
// GitLab: the connected base and project path it names, or nil. The address
// itself never leaves the daemon, and only a server glab holds a login for
// is matched.
func gitlabOriginMatch(origin string, bases []nativegitlab.Base) map[string]string {
	if origin == "" || len(bases) == 0 {
		return nil
	}
	b, name, ok := nativegitlab.MatchOrigin(origin, bases)
	if !ok {
		return nil
	}
	return map[string]string{"base_url": b.String(), "full_name": name}
}

// gitlabBases are the bases of glab's logins as the file says now, nil when
// there is no adapter or its file cannot be read.
func gitlabBases(g *integrations.GitLabAdapter) []nativegitlab.Base {
	if g == nil || g.Store == nil {
		return nil
	}
	logins, err := g.Store.Logins()
	if err != nil {
		return nil
	}
	var bases []nativegitlab.Base
	for _, l := range logins {
		if l.URL != "" {
			bases = append(bases, l.Base)
		}
	}
	return bases
}
