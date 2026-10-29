package nativegitea

import (
	"context"
	"encoding/base64"
	"mime"
	"net/http"
	"strings"
)

// Push is whether Git may push with a PAT, as far as one read can tell.
type Push string

const (
	// PushAllowed: Gitea offered receive-pack to this PAT for a repository
	// the account may push to. Branch protection and the account's rights
	// on other repositories remain Gitea's to enforce on each push.
	PushAllowed Push = "allowed"
	// PushReadOnly: Gitea refused receive-pack to this PAT for a repository
	// the account itself may push to with its bare scope refusal, so the
	// token lacks write:repository.
	PushReadOnly Push = "read_only"
	// PushUnknown: no repository the account may push to was found among
	// the first page, or Gitea's answer said neither (another refusal, such
	// as HTTP Git turned off, is not the token's scope).
	PushUnknown Push = "unknown"
)

type pushCandidate struct {
	Name     string `json:"name"`
	FullName string `json:"full_name"`
	Owner    struct {
		Login string `json:"login"`
	} `json:"owner"`
	Archived    bool `json:"archived"`
	Mirror      bool `json:"mirror"`
	Permissions *struct {
		Push bool `json:"push"`
	} `json:"permissions"`
}

// Push asks Gitea whether the PAT may push, without pushing. Gitea does not
// show a token its own scopes, and the API's repository permissions are the
// account's, not the token's: a read:repository token sees push: true. So
// the answer is the first step of git push itself, the receive-pack ref
// advertisement (GET <repo>.git/info/refs?service=git-receive-pack), with
// the same Basic credential Git's helper gives. Gitea checks the token's
// repository scope at write level there before it lists anything, and the
// advertisement changes nothing. The repository is one on the first page of
// /user/repos that the account may push to and that is neither archived nor
// a mirror, since Gitea refuses those to every token.
func (c *Client) Push(ctx context.Context, b Base, user, token string) Push {
	if !giteaLogin.MatchString(user) {
		return PushUnknown
	}
	var page []pushCandidate
	if _, err := c.getLimited(ctx, b, "/user/repos?page=1&limit=50", token, repoPageBytes, &page); err != nil {
		return PushUnknown
	}
	for _, r := range page {
		if r.Permissions == nil || !r.Permissions.Push || r.Archived || r.Mirror {
			continue
		}
		if !giteaOwner.MatchString(r.Owner.Login) || !giteaRepo.MatchString(r.Name) || r.Name == "." || r.Name == ".." || r.Owner.Login == "." || r.Owner.Login == ".." || r.FullName != r.Owner.Login+"/"+r.Name {
			continue
		}
		return c.receivePack(ctx, b, r.FullName, user, token)
	}
	return PushUnknown
}

func (c *Client) receivePack(ctx context.Context, b Base, fullName, user, token string) Push {
	basic := base64.StdEncoding.EncodeToString([]byte(user + ":" + token))
	resp, err := c.http().Probe(ctx, b, "/"+fullName+".git/info/refs?service=git-receive-pack", http.Header{"Authorization": {"Basic " + basic}})
	if err != nil {
		return PushUnknown
	}
	switch resp.Status {
	case http.StatusOK:
		if media, _, err := mime.ParseMediaType(resp.Header.Get("Content-Type")); err == nil && media == "application/x-git-receive-pack-advertisement" {
			return PushAllowed
		}
	case http.StatusForbidden:
		// Gitea answers a missing token scope with the bare status text
		// alone; its other refusals there (HTTP Git disabled, an inactive
		// owner, a disabled account) say what they are.
		if strings.TrimSpace(string(resp.Body)) == http.StatusText(http.StatusForbidden) {
			return PushReadOnly
		}
	}
	return PushUnknown
}
