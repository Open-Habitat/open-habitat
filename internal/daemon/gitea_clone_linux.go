//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/nativegitea"
)

// A Gitea clone is an ordinary clone job (github_jobs_linux.go) whose
// repository the daemon resolves from a connection in tea's file: the
// browser names the connection ID the daemon derived and Gitea's repository
// id, never a URL, host, path or user. The clone remote is the credential-free
// HTTPS address under the connected base, and the new repository's own
// credential.<remote>.username selects that connection's account, so the
// native helper answers it again on every later fetch without a mapping of
// ours. An interrupted Gitea clone is recognised from that same configuration
// (github_interrupted_linux.go); restart resolves the repository again by
// its id, and remove needs only the name the directory itself records.

var giteaConnection = regexp.MustCompile(`^gitea_[0-9a-f]{24}$`)

type giteaCloneSource struct {
	ConnectionID string
	RepositoryID int64
}

// giteaCloneRequest is a github-clone.schema.json request with a gitea source.
type giteaCloneRequest struct {
	Action, ConnectionID, FullName, Mode string
	RepositoryID                         int64
}

// validGiteaRequest admits exactly github-clone.schema.json's Gitea start,
// restart and remove.
func validGiteaRequest(body []byte, in giteaCloneRequest) bool {
	var keys map[string]json.RawMessage
	if json.Unmarshal(body, &keys) != nil {
		return false
	}
	switch in.Action {
	case "start", "restart":
		return len(keys) == 5 && giteaConnection.MatchString(in.ConnectionID) && in.RepositoryID > 0 && in.RepositoryID <= 1<<53-1 && in.Mode == "full" && in.FullName == ""
	case "remove":
		return len(keys) == 3 && validGiteaFullName(in.FullName) && in.ConnectionID == "" && in.RepositoryID == 0 && in.Mode == ""
	}
	return false
}

// validGiteaFullName is a Gitea owner/name whose name is a clone destination.
func validGiteaFullName(s string) bool {
	owner, name, ok := strings.Cut(s, "/")
	return ok && giteaOwnerName.MatchString(owner) && owner != "." && owner != ".." && validGiteaCloneName(name)
}

var giteaOwnerName = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,40}$`)

func (c *CloneJobs) startGitea(w http.ResponseWriter, r *http.Request, connection string, id int64, restart bool) {
	if !cloneWriter.TryLock("workspace_clone_running") {
		c.busy(w)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()
	t, status, code := c.resolveGitea(ctx, connection, id, restart)
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
	return cloneTarget{
		fullName: repo.FullName(), requested: repo.FullName(), cloneURL: url, mode: "full", restart: restart, git: c.giteaGit,
		// The helper chain for the base is pinned at the command line, which
		// Git reads last: a conditional include that applies only inside
		// ~/src cannot add a second helper that stores the token. The clone's
		// own configuration keeps the HTTP policy for later fetches and names
		// the account.
		pre:     giteaTransferPins(url, login.Base.String(), helper),
		config:  []string{"http." + url + ".followRedirects=false", "http." + url + ".sslVerify=true", "credential." + url + ".username=" + login.User},
		source:  &giteaCloneSource{ConnectionID: connection, RepositoryID: repo.ID},
		release: release,
		// A rewrite rule would send the clone, and the token the helper
		// gives for it, somewhere the daemon did not just validate. Git
		// evaluates the new repository's conditional includes only once its
		// directory exists, so this runs after the reservation.
		check: func(ctx context.Context) (int, string) {
			if rewritten, err := c.cloneRewritten(ctx, c.giteaGit, repo.Name, url); err != nil {
				return 503, "native_source_unavailable"
			} else if rewritten {
				return 409, "remote_rewritten"
			}
			return 0, ""
		},
	}, 0, ""
}

// A Gitea repository name becomes ~/src/<name>; it must also be a name the
// clone list and discovery accept.
func validGiteaCloneName(name string) bool {
	return repoName.MatchString(name) && name != "." && name != ".."
}

// giteaInterruptedSource is the source of an interrupted Gitea clone in the
// list. It names a connection only when exactly one usable login in tea's
// file has the base and account the directory records; without one the
// directory can still be removed, but not restarted. logins is read from
// tea's file once per list.
func (c *CloneJobs) giteaInterruptedSource(o cloneOrigin, name string, logins **[]nativegitea.Login) map[string]any {
	source := map[string]any{"provider": "gitea"}
	if c.gitea == nil {
		return source
	}
	if *logins == nil {
		read, err := c.gitea.Store.Logins()
		if err != nil {
			read = nil
		}
		*logins = &read
	}
	var matched []nativegitea.Login
	for _, l := range **logins {
		if l.URL != "" && l.Usable() && o.URL == l.URL+"/"+o.Owner+"/"+name+".git" && strings.EqualFold(l.User, o.User) {
			matched = append(matched, l)
		}
	}
	if len(matched) == 1 {
		source["connection_id"] = matched[0].ConnectionID()
	}
	return source
}
