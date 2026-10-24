//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"net/http"
	"regexp"
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
// ours. Restart and remove of an interrupted Gitea clone are not offered yet:
// its leftover directory stays an ordinary directory.

var giteaConnection = regexp.MustCompile(`^gitea_[0-9a-f]{24}$`)

type giteaCloneSource struct {
	ConnectionID string
	RepositoryID int64
}

// validGiteaStart admits exactly github-clone.schema.json's Gitea start.
func validGiteaStart(body []byte, action, source, connection string, id int64, mode string) bool {
	var keys map[string]json.RawMessage
	if json.Unmarshal(body, &keys) != nil {
		return false
	}
	return len(keys) == 5 && action == "start" && source == "gitea" && giteaConnection.MatchString(connection) && id > 0 && id <= 1<<53-1 && mode == "full"
}

func (c *CloneJobs) startGitea(w http.ResponseWriter, r *http.Request, connection string, id int64) {
	if !cloneWriter.TryLock("workspace_clone_running") {
		c.busy(w)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()
	t, status, code := c.resolveGitea(ctx, connection, id)
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
func (c *CloneJobs) resolveGitea(ctx context.Context, connection string, id int64) (cloneTarget, int, string) {
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
		fullName: repo.FullName(), requested: repo.FullName(), cloneURL: url, mode: "full", git: c.giteaGit,
		// Only HTTPS, verified TLS, no redirects, no submodule recursion.
		// The exact remote URL is the most specific HTTP scope, so a broader
		// personal setting cannot loosen it; the clone's own configuration
		// keeps the same for later fetches and names the account.
		// The helper chain for the base is pinned at the command line, which
		// Git reads last: a conditional include that applies only inside
		// ~/src cannot add a second helper that stores the token.
		pre:     []string{"-c", "credential." + login.Base.String() + ".helper=", "-c", "credential." + login.Base.String() + ".helper=" + helper, "-c", "protocol.allow=never", "-c", "protocol.https.allow=always", "-c", "http.followRedirects=false", "-c", "http." + url + ".followRedirects=false", "-c", "http." + url + ".sslVerify=true", "-c", "submodule.recurse=false"},
		config:  []string{"http." + url + ".followRedirects=false", "http." + url + ".sslVerify=true", "credential." + url + ".username=" + login.User},
		source:  &giteaCloneSource{ConnectionID: connection, RepositoryID: repo.ID},
		release: release,
	}, 0, ""
}

// A Gitea repository name becomes ~/src/<name>; it must also be a name the
// clone list and discovery accept.
func validGiteaCloneName(name string) bool {
	return repoName.MatchString(name) && name != "." && name != ".."
}
