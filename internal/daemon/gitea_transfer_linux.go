//go:build linux

package daemon

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/daemon/integrations"
	"github.com/Open-Habitat/open-habitat/internal/nativegitea"
)

// A transfer the daemon runs against a connected Gitea (a clone job, or the
// workspace fetch of such a clone) is pinned to the exact remote and refused
// when the person's Git configuration would send it elsewhere. The person's
// own shell may still change all of this; it is not a sandbox. What it stops
// is a browser action silently carrying a connection's PAT, or its use, to an
// endpoint the daemon did not validate.

// giteaTransferPins are the Git options of a managed transfer of remote.
// Command-line values are read last, and the exact remote is the most
// specific HTTP scope, so no personal setting loosens them: HTTPS only,
// verified TLS, no redirects, no saved cookies (a Gitea session cookie is a
// second credential), Git's own DNS answer rather than a personal resolve
// override, and no submodule recursion. With helperScope set, the helper
// chain for that scope is reset to the registered helper alone, so no other
// helper is asked for the token or stores a copy of it.
func giteaTransferPins(remote, helperScope, helper string) []string {
	pins := []string{
		"-c", "protocol.allow=never", "-c", "protocol.https.allow=always",
		"-c", "http.followRedirects=false", "-c", "http." + remote + ".followRedirects=false",
		"-c", "http." + remote + ".sslVerify=true", "-c", "http." + remote + ".saveCookies=false",
		"-c", "http.curloptResolve=", "-c", "submodule.recurse=false",
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
// does, so the effective fetch address is compared as well as the rules.
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

// giteaFetchPolicy decides how the workspace fetch of remote runs. A remote
// whose configured or effective address is on the server of a connected
// Gitea login is a managed transfer: it must have one address, no rewrite
// rule may apply to it, and it runs with giteaTransferPins, the helper chain
// pinned too while the registration for that server is ours. Every other
// remote is the person's ordinary remote and is fetched as before. A tea file
// that cannot be read makes no remote managed; the helper reads the same file
// and then gives Git nothing.
func giteaFetchPolicy(ctx context.Context, g *integrations.GiteaAdapter, read func(args ...string) ([]byte, error), remote string) ([]string, string) {
	if g == nil {
		return nil, ""
	}
	logins, err := g.Store.Logins()
	if err != nil || len(logins) == 0 {
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
	var server nativegitea.Base
	managed := false
	for _, u := range append(urls, target) {
		b, ok := nativegitea.RemoteAuthority(u)
		if !ok {
			continue
		}
		for _, l := range logins {
			if l.URL != "" && l.Base.SameServer(b) {
				server, managed = b, true
			}
		}
	}
	if !managed {
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
	scope, helper := "", ""
	if command, err := nativegitea.HelperCommand(g.Executable); err == nil {
		for _, l := range logins {
			if l.URL == "" || !l.Base.SameServer(server) {
				continue
			}
			if st, err := g.Git.State(ctx, l.Base, g.Executable); err == nil && (st == nativegitea.HelperRegistered || st == nativegitea.HelperShadowed) {
				scope, helper = "https://"+server.Authority(), command
				break
			}
		}
	}
	return giteaTransferPins(target, scope, helper), ""
}
