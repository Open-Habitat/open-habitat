//go:build linux

package daemon

import (
	"context"
	"strings"

	"github.com/Open-Habitat/open-habitat/internal/nativeforge"
	"github.com/Open-Habitat/open-habitat/internal/nativegitlab"
)

// resolveGitLab rereads the connection and the project at GitLab by its id
// with the connection's own token, and holds the login so that a disconnect
// waits for the job. A refusal releases the hold. The clone is a Gitea
// clone's in every other way: the credential-free address under the base,
// the account in the new repository's own configuration, and the helper
// chain pinned for the transfer.
func (c *CloneJobs) resolveGitLab(ctx context.Context, connection string, id int64, restart bool) (cloneTarget, int, string) {
	g := c.gitlab
	if !g.Available() {
		return cloneTarget{}, 409, "provider_unavailable"
	}
	login, err := g.Login(connection)
	if err != nil || !login.Usable() {
		return cloneTarget{}, 409, "gitlab_connection_unavailable"
	}
	release, err := g.Store.Hold(login.Key)
	if err != nil {
		return cloneTarget{}, 409, "gitlab_connection_unavailable"
	}
	held := true
	defer func() {
		if held {
			release()
		}
	}()
	if st, err := g.Git.State(ctx, login.Base, g.Executable); err != nil || st != nativeforge.HelperRegistered {
		return cloneTarget{}, 409, "gitlab_git_unavailable"
	}
	token, err := g.Store.Token(login.Target())
	if err != nil {
		return cloneTarget{}, 409, "gitlab_connection_unavailable"
	}
	account, err := g.API.User(ctx, login.Base, token)
	if err == nil && !strings.EqualFold(account.Username, login.User) {
		err = nativegitlab.ErrAccountMismatch
	}
	var p nativegitlab.Project
	if err == nil {
		p, err = g.API.Project(ctx, login.Base, token, account, id)
	}
	switch {
	case err == nativegitlab.ErrRejected || err == nativegitlab.ErrExpired || err == nativegitlab.ErrScope || err == nativegitlab.ErrAccountMismatch:
		return cloneTarget{}, 409, "gitlab_auth_unavailable"
	case err != nil:
		return cloneTarget{}, 503, "native_source_unavailable"
	case !validGitLabFullName(p.FullName):
		return cloneTarget{}, 409, "checkout_unavailable"
	}
	helper, err := nativegitlab.HelperCommand(g.Executable)
	if err != nil {
		return cloneTarget{}, 409, "gitlab_git_unavailable"
	}
	held = false
	return c.forgeTarget(p.FullName, nativegitlab.Name(p.FullName), p.CloneURL(login.Base), login.Base.String(), helper, login.User, restart, &forgeCloneSource{Provider: "gitlab", ConnectionID: connection, RepositoryID: p.ID}, release), 0, ""
}
