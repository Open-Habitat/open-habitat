//go:build linux

package daemon

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/nativeforge"
	"github.com/Open-Habitat/open-habitat/internal/nativegitea"
	"github.com/Open-Habitat/open-habitat/internal/nativegitlab"
)

// A transfer the daemon runs against a connected Gitea or GitLab (a clone
// job, or the workspace fetch of such a clone) is pinned to the exact remote and refused
// when the person's Git configuration would send it elsewhere. The person's
// own shell may still change all of this; it is not a sandbox. What it stops
// is a browser action silently carrying a connection's PAT, or its use, to an
// endpoint the daemon did not validate.

// giteaTransferPins are the Git options of a managed transfer of remote.
// Command-line values are read last, and the exact remote is the most
// specific HTTP scope, so no personal setting loosens them: HTTPS only,
// verified TLS, no redirects, no saved cookies (a forge session cookie is a
// second credential), Git's own DNS answer rather than a personal resolve
// override, and no submodule recursion. With helperScope set, the helper
// chain for that scope is reset to the registered helper alone, so no other
// helper is asked for the token or stores a copy of it.
func giteaTransferPins(remote, helperScope, helper string) []string {
	pins := []string{
		"-c", "protocol.allow=never", "-c", "protocol.https.allow=always",
		"-c", "http.followRedirects=false", "-c", "http." + remote + ".followRedirects=false",
		"-c", "http." + remote + ".sslVerify=true", "-c", "http." + remote + ".saveCookies=false",
		"-c", "http.curloptResolve=", "-c", "http." + remote + ".curloptResolve=", "-c", "submodule.recurse=false",
	}
	if helperScope != "" {
		pins = append(pins, "-c", "credential."+helperScope+".helper=", "-c", "credential."+helperScope+".helper="+helper, "-c", "credential."+helperScope+".useHttpPath=true")
	}
	return pins
}

// errRewriteUnknown: the rewrite rules could not be read, so a managed
// transfer is refused rather than assumed direct.
var errRewriteUnknown = errors.New("rewrite rules unreadable")

// remoteRewritten reports whether any url.<base>.insteadOf or pushInsteadOf
// rule Git would see applies to remote. Git rewrites a URL that starts with
// a rule's value, so any such rule counts, even one that would rewrite the
// address to itself. read runs git config in the context of the repository
// the transfer belongs to: includes, conditional ones too, are followed.
func remoteRewritten(read func(args ...string) ([]byte, error), remote string) (bool, error) {
	out, err := read("config", "--includes", "--null", "--get-regexp", `^url\..*\.(insteadof|pushinsteadof)$`)
	var exit *nativeCommandExit
	if errors.As(err, &exit) && exit.Code == 1 {
		return false, nil
	}
	if err != nil {
		return false, errRewriteUnknown
	}
	for _, rec := range strings.Split(strings.TrimSuffix(string(out), "\x00"), "\x00") {
		_, value, ok := strings.Cut(rec, "\n")
		// A rule without a value is a configuration error Git would stop
		// on; it is not evidence that nothing is rewritten.
		if !ok || strings.HasPrefix(remote, value) {
			return true, nil
		}
	}
	return false, nil
}

// cloneRewritten checks the rules a clone of remote into ~/src/<name> will
// see. Git applies conditional includes of the new repository during the
// clone itself, so they are read with the future git directory and origin in
// place: gitdir: and hasconfig:remote.*.url: conditions then match as they
// will once git clone has written them. git config does not evaluate gitdir:
// for a directory that is not a repository yet, while ls-remote --get-url
// does, so the effective fetch address is compared as well as the rules. A
// pushInsteadOf, or a rewrite to the same address, that only a gitdir: or
// onbranch: include holds is first visible in the finished repository;
// clonedRewritten reads it there before the clone is confirmed.
func (c *CloneJobs) cloneRewritten(ctx context.Context, git, name, remote string) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	gitDir := c.home + "/src/" + name + "/.git"
	read := func(args ...string) ([]byte, error) {
		return c.run(ctx, git, c.home, "", append([]string{"--git-dir=" + gitDir, "-c", "remote.origin.url=" + remote}, args...)...)
	}
	effective, err := read("ls-remote", "--get-url", remote)
	if err != nil {
		return false, errRewriteUnknown
	}
	if string(effective) != remote+"\n" {
		return true, nil
	}
	return remoteRewritten(read, remote)
}

// clonedRewritten reads the rewrite rules in the cloned repository itself,
// where every conditional include is evaluated as the later fetch will see
// it. A rule found there fails the clone's verification; the download stays.
func clonedRewritten(ctx context.Context, run cloneRunner, git, home string, child int, remote string) bool {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	rewritten, err := remoteRewritten(func(args ...string) ([]byte, error) {
		return run(ctx, git, home, strconv.Itoa(child), append([]string{"-c", "core.fsmonitor=false"}, args...)...)
	}, remote)
	return err != nil || rewritten
}

// managedServer is a connected forge server and the helper that answers for
// it.
type managedServer struct {
	server nativeforge.Base
	helper string
}

// managedServers are the servers of the person's connected Gitea and GitLab
// logins, each with its provider's registered helper. A file that cannot be
// read makes none of its servers managed; its helper reads the same file and
// then gives Git nothing.
func managedServers(forges Forges) []managedServer {
	var out []managedServer
	if g := forges.Gitea; g != nil {
		if helper, err := nativegitea.HelperCommand(g.Executable); err == nil {
			if logins, err := g.Store.Logins(); err == nil {
				for _, l := range logins {
					if l.URL != "" {
						out = append(out, managedServer{l.Base, helper})
					}
				}
			}
		}
	}
	if g := forges.GitLab; g != nil {
		if helper, err := nativegitlab.HelperCommand(g.Executable); err == nil {
			if logins, err := g.Store.Logins(); err == nil {
				for _, l := range logins {
					if l.URL != "" {
						out = append(out, managedServer{l.Base, helper})
					}
				}
			}
		}
	}
	return out
}

// forgeFetchPolicy decides how the workspace fetch of remote runs. A remote
// whose configured or effective address is on the server of a connected Gitea
// or GitLab login is a managed transfer: it must have one address, no
// rewrite rule may apply to it, and it runs with giteaTransferPins, the
// helper chain for that server always reset to its provider's registered
// helper alone: a personal helper added beside ours, in its scope or anywhere
// else, would otherwise be handed the token to store. A server both a Gitea
// and a GitLab login claim is refused rather than guessed. Every other remote
// is the person's ordinary remote and is fetched as before.
func forgeFetchPolicy(ctx context.Context, forges Forges, read func(args ...string) ([]byte, error), remote string) ([]string, string) {
	servers := managedServers(forges)
	if len(servers) == 0 {
		return nil, ""
	}
	var exit *nativeCommandExit
	configured, err := read("config", "--get-all", "remote."+remote+".url")
	if err != nil && !(errors.As(err, &exit) && exit.Code == 1) {
		return nil, "fetch_failed"
	}
	effective, err := read("ls-remote", "--get-url", remote)
	if err != nil {
		return nil, "fetch_failed"
	}
	urls := strings.Split(strings.TrimSuffix(string(configured), "\n"), "\n")
	if len(configured) == 0 {
		urls = nil
	}
	target := strings.TrimSuffix(string(effective), "\n")
	var server nativeforge.Base
	helper := ""
	for _, u := range append(urls, target) {
		b, ok := nativeforge.RemoteAuthority(u)
		if !ok {
			continue
		}
		for _, m := range servers {
			if !m.server.SameServer(b) {
				continue
			}
			if helper != "" && (helper != m.helper || !server.SameServer(b)) {
				return nil, "fetch_failed"
			}
			server, helper = b, m.helper
		}
	}
	if helper == "" {
		return nil, ""
	}
	if len(urls) != 1 || urls[0] != target {
		return nil, "remote_rewritten"
	}
	if rewritten, err := remoteRewritten(read, target); err != nil {
		return nil, "fetch_failed"
	} else if rewritten {
		return nil, "remote_rewritten"
	}
	return giteaTransferPins(target, "https://"+server.Authority(), helper), ""
}
