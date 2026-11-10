//go:build linux

package daemon

import (
	"context"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/open-habitat/open-habitat/internal/daemon/integrations"
	"github.com/open-habitat/open-habitat/internal/nativegitea"
	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// workspaceRemote reports a classification, never a native URL (which can
// contain credentials). A missing origin is not proof that there are no remotes.
// Continuation is a hint for the presentation, not authority to push: the
// publish handler rechecks the remote, GitHub owner, visibility and challenge.
// origin is the address Git fetches origin from; it stays in the daemon,
// where only giteaOriginMatch derives a fact from it.
func workspaceRemote(ctx context.Context, home string, entry Workspace) (remote string, continuation bool, origin string) {
	cfg := transport.Config{Home: home, UID: os.Geteuid()}
	src, _, err := workspaceSource(cfg)
	if err != nil {
		return "unknown", false, ""
	}
	defer unix.Close(src)
	fd, opened, err := openWorkspace(src, entry.Name)
	if err != nil {
		return "unknown", false, ""
	}
	defer unix.Close(fd)
	if uint64(opened.Dev) != entry.dev || opened.Ino != entry.ino {
		return "unknown", false, ""
	}
	read := func(args ...string) ([]byte, error) {
		return cloneCommandWithTimeout(ctx, 2*time.Second, "/usr/bin/git", home, strconv.Itoa(fd), args...)
	}
	url, err := read("-c", "core.fsmonitor=false", "remote", "get-url", "origin")
	if err == nil {
		origin = strings.TrimSuffix(string(url), "\n")
		if strings.HasPrefix(origin, "https://github.com/") || strings.HasPrefix(origin, "git@github.com:") {
			// A main checkout with a local commit but no origin tracking refs
			// may be between publication's origin and push stages. A normal
			// nonempty clone has refs, and an empty clone has no local HEAD.
			head, headErr := read("-c", "core.fsmonitor=false", "rev-parse", "--verify", "HEAD^{commit}")
			refs, refsErr := read("-c", "core.fsmonitor=false", "for-each-ref", "--format=%(refname)", "refs/remotes/origin")
			return "github", headErr == nil && validCloneCommit(head) && refsErr == nil && len(strings.TrimSpace(string(refs))) == 0, origin
		}
		return "other", false, origin
	}
	remotes, err := read("-c", "core.fsmonitor=false", "remote")
	if err != nil {
		return "unknown", false, ""
	}
	if len(strings.TrimSpace(string(remotes))) != 0 {
		return "other", false, ""
	}
	return "none", false, ""
}

// giteaOriginMatch is the safe fact a workspace's origin gives about Gitea: the
// connected base and owner/name it names, or nil. The address itself never
// leaves the daemon. Only a base tea has a login for is matched, so the
// reply names no server the person has not connected; which account a
// clone uses stays in its own Git configuration and is never changed here.
func giteaOriginMatch(origin string, bases []nativegitea.Base) map[string]string {
	if origin == "" || len(bases) == 0 {
		return nil
	}
	b, name, ok := nativegitea.MatchOrigin(origin, bases)
	if !ok {
		return nil
	}
	return map[string]string{"base_url": b.String(), "full_name": name}
}

// giteaBases are the bases of tea's logins as the file says now, nil when
// there is no adapter or its file cannot be read: an unreadable file makes
// every origin unmatched, never matched by a guess.
func giteaBases(g *integrations.GiteaAdapter) []nativegitea.Base {
	if g == nil || g.Store == nil {
		return nil
	}
	logins, err := g.Store.Logins()
	if err != nil {
		return nil
	}
	var bases []nativegitea.Base
	for _, l := range logins {
		if l.URL != "" {
			bases = append(bases, l.Base)
		}
	}
	return bases
}
