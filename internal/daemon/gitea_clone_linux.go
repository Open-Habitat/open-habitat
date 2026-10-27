//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/nativeforge"
	"github.com/Open-Habitat/open-habitat/internal/nativegitea"
	"github.com/Open-Habitat/open-habitat/internal/nativegitlab"
)

// A Gitea or GitLab clone is an ordinary clone job (github_jobs_linux.go)
// whose repository the daemon resolves from a connection in tea's or glab's
// file: the browser names the connection ID the daemon derived and the
// provider's repository id, never a URL, host, path or user. The clone remote is the credential-free
// HTTPS address under the connected base, and the new repository's own
// credential.<remote>.username selects that connection's account, so the
// native helper answers it again on every later fetch without a mapping of
// ours. An interrupted forge clone is recognised from that same configuration
// (github_interrupted_linux.go); restart resolves the repository again by
// its id, and remove needs only the name the directory itself records.

var (
	giteaConnection  = regexp.MustCompile(`^gitea_[0-9a-f]{24}$`)
	gitlabConnection = regexp.MustCompile(`^gitlab_[0-9a-f]{24}$`)
)

// forgeCloneSource names the connection a Gitea or GitLab clone used and the
// provider's own repository id.
type forgeCloneSource struct {
	Provider     string
	ConnectionID string
	RepositoryID int64
}

// forgeCloneRequest is a github-clone.schema.json request with a gitea or
// gitlab source.
type forgeCloneRequest struct {
	Provider, Action, ConnectionID, FullName, Mode string
	RepositoryID                                   int64
}

// validForgeRequest admits exactly github-clone.schema.json's Gitea and
// GitLab start, restart and remove.
func validForgeRequest(body []byte, in forgeCloneRequest) bool {
	var keys map[string]json.RawMessage
	if json.Unmarshal(body, &keys) != nil {
		return false
	}
	connection, fullName := giteaConnection, validGiteaFullName
	switch in.Provider {
	case "gitea":
	case "gitlab":
		connection, fullName = gitlabConnection, validGitLabFullName
	default:
		return false
	}
	switch in.Action {
	case "start", "restart":
		return len(keys) == 5 && connection.MatchString(in.ConnectionID) && in.RepositoryID > 0 && in.RepositoryID <= 1<<53-1 && in.Mode == "full" && in.FullName == ""
	case "remove":
		return len(keys) == 3 && fullName(in.FullName) && in.ConnectionID == "" && in.RepositoryID == 0 && in.Mode == ""
	}
	return false
}

// validGiteaFullName is a Gitea owner/name whose name is a clone destination.
func validGiteaFullName(s string) bool {
	owner, name, ok := strings.Cut(s, "/")
	return ok && giteaOwnerName.MatchString(owner) && owner != "." && owner != ".." && validGiteaCloneName(name)
}

// validGitLabFullName is a GitLab project path whose own name is a clone
// destination.
func validGitLabFullName(s string) bool {
	return nativegitlab.ValidFullName(s) && validGiteaCloneName(nativegitlab.Name(s))
}

var giteaOwnerName = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,40}$`)

// cloneDirName is the directory a clone of fullName makes in ~/src: the last
// segment, a GitHub or Gitea name or a GitLab project's own path.
func cloneDirName(fullName string) string { return fullName[strings.LastIndexByte(fullName, '/')+1:] }

// startForge admits a Gitea or GitLab clone resolved by resolve.
func (c *CloneJobs) startForge(w http.ResponseWriter, r *http.Request, resolve func(context.Context) (cloneTarget, int, string)) {
	if !cloneWriter.TryLock("workspace_clone_running") {
		c.busy(w)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()
	t, status, code := resolve(ctx)
	if status != 0 {
		cloneWriter.Unlock()
		snapshotError(w, status, code)
		return
	}
	job, status, code := c.reserve(ctx, t)
	if job == nil {
		snapshotError(w, status, code)
		return
	}
	now, _ := job.snapshot()
	historyJSON(w, map[string]any{"schema_version": 1, "job": job.view(now)})
}

// resolveGitea rereads the connection and the repository at Gitea with the
// connection's own token, and holds the login so that a disconnect waits
// for the job. A refusal releases the hold.
func (c *CloneJobs) resolveGitea(ctx context.Context, connection string, id int64, restart bool) (cloneTarget, int, string) {
	g := c.gitea
	if !g.Available() {
		return cloneTarget{}, 409, "provider_unavailable"
	}
	login, err := g.Login(connection)
	if err != nil || !login.Usable() || login.URL == "" {
		return cloneTarget{}, 409, "gitea_connection_unavailable"
	}
	release, err := g.Store.Hold(login.Name)
	if err != nil {
		return cloneTarget{}, 409, "gitea_connection_unavailable"
	}
	held := true
	defer func() {
		if held {
			release()
		}
	}()
	// Git's own helper must answer for this base before anything is
	// reserved; otherwise the clone could only fail at its first request.
	if st, err := g.Git.State(ctx, login.Base, g.Executable); err != nil || st != nativegitea.HelperRegistered {
		return cloneTarget{}, 409, "gitea_git_unavailable"
	}
	token, err := g.Store.Token(login.Target())
	if err != nil {
		return cloneTarget{}, 409, "gitea_connection_unavailable"
	}
	repo, err := g.API.Repository(ctx, login.Base, token, id)
	switch {
	case err == nativegitea.ErrRejected || err == nativegitea.ErrScope:
		return cloneTarget{}, 409, "gitea_auth_unavailable"
	case err != nil:
		return cloneTarget{}, 503, "native_source_unavailable"
	case repo.Empty:
		// Git would succeed with nothing to verify; an empty repository is
		// refused before anything is reserved.
		return cloneTarget{}, 409, "repository_empty"
	case !validGiteaCloneName(repo.Name):
		return cloneTarget{}, 409, "checkout_unavailable"
	}
	url := repo.CloneURL(login.Base)
	helper, err := nativegitea.HelperCommand(g.Executable)
	if err != nil {
		return cloneTarget{}, 409, "gitea_git_unavailable"
	}
	held = false
	return c.forgeTarget(repo.FullName(), repo.Name, url, login.Base.String(), helper, login.User, restart, &forgeCloneSource{Provider: "gitea", ConnectionID: connection, RepositoryID: repo.ID}, release), 0, ""
}

// forgeTarget is the clone of one Gitea or GitLab repository at url, its
// credential answered by helper for base and its account user.
func (c *CloneJobs) forgeTarget(fullName, name, url, base, helper, user string, restart bool, source *forgeCloneSource, release func()) cloneTarget {
	return cloneTarget{
		fullName: fullName, requested: fullName, cloneURL: url, mode: "full", restart: restart, git: c.forgeGit,
		// The helper chain for the base is pinned at the command line, which
		// Git reads last: a conditional include that applies only inside
		// ~/src cannot add a second helper that stores the token. The clone's
		// own configuration keeps the HTTP policy for later fetches and names
		// the account.
		pre:     giteaTransferPins(url, base, helper),
		config:  []string{"http." + url + ".followRedirects=false", "http." + url + ".sslVerify=true", "credential." + url + ".username=" + user},
		source:  source,
		release: release,
		// A rewrite rule would send the clone, and the token the helper
		// gives for it, somewhere the daemon did not just validate. Git
		// evaluates the new repository's conditional includes only once its
		// directory exists, so this runs after the reservation.
		check: func(ctx context.Context) (int, string) {
			if rewritten, err := c.cloneRewritten(ctx, c.forgeGit, name, url); err != nil {
				return 503, "native_source_unavailable"
			} else if rewritten {
				return 409, "remote_rewritten"
			}
			return 0, ""
		},
	}
}

// A Gitea repository name becomes ~/src/<name>; it must also be a name the
// clone list and discovery accept.
func validGiteaCloneName(name string) bool {
	return repoName.MatchString(name) && name != "." && name != ".."
}

// forgeSources are the connections an interrupted forge clone may belong
// to, read from tea's and glab's files once per list.
type forgeSources struct {
	read   bool
	gitea  []nativegitea.Login
	gitlab []nativegitlab.Login
}

// forgeInterruptedSource is the full name and source of an interrupted Gitea
// or GitLab clone in the list. A server glab holds a login for makes it a
// GitLab clone whose name is the project path below that login's base;
// otherwise it is a Gitea one, owner/name, as a directory whose connection is
// gone also is. The source names a connection only when exactly one usable
// login has the base and account the directory records; without one the
// directory can still be removed, but not restarted.
func (c *CloneJobs) forgeInterruptedSource(o cloneOrigin, name string, s *forgeSources) (string, map[string]any) {
	if !s.read {
		s.read = true
		if c.gitea != nil {
			s.gitea, _ = c.gitea.Store.Logins()
		}
		if c.gitlab != nil {
			s.gitlab, _ = c.gitlab.Store.Logins()
		}
	}
	server, _ := nativeforge.RemoteAuthority(o.URL)
	for _, l := range s.gitlab {
		if l.URL == "" || !l.Base.SameServer(server) {
			continue
		}
		full, ok := strings.CutPrefix(strings.TrimSuffix(o.URL, ".git"), l.URL+"/")
		if !ok || !validGitLabFullName(full) || nativegitlab.Name(full) != name {
			continue
		}
		source := map[string]any{"provider": "gitlab"}
		if l.Usable() && strings.EqualFold(l.User, o.User) {
			source["connection_id"] = l.ConnectionID()
		}
		return full, source
	}
	source := map[string]any{"provider": "gitea"}
	var matched []nativegitea.Login
	for _, l := range s.gitea {
		if l.URL != "" && l.Usable() && o.URL == l.URL+"/"+o.Owner+"/"+name+".git" && strings.EqualFold(l.User, o.User) {
			matched = append(matched, l)
		}
	}
	if len(matched) == 1 {
		source["connection_id"] = matched[0].ConnectionID()
	}
	return o.Owner + "/" + name, source
}
