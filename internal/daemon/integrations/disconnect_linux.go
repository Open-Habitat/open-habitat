//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"time"

	"github.com/open-habitat/open-habitat/internal/nativegitea"
	"github.com/open-habitat/open-habitat/internal/nativegitlab"
)

// Disconnecting everything before a person's removal (ADR 0037, section 4).
// The daemon does it as the person, with the person's own credentials only:
// a grant is revoked where the provider ends it with the token itself, and
// every local entry is then deleted the way each tool's own logout does.
// Nothing here names an account outside the daemon; the outcome is counts.

// Disconnect outcomes, per account.
const (
	DisconnectRevoked   = "revoked"
	DisconnectLocalOnly = "local_only"
	DisconnectFailed    = "failed"
)

// DisconnectCount is one provider's outcome counts.
type DisconnectCount struct {
	Provider  string `json:"provider"`
	Revoked   int    `json:"revoked"`
	LocalOnly int    `json:"local_only"`
	Failed    int    `json:"failed"`
}

// grantRevoker is an entry whose provider ends a grant with the person's own
// token (Google's revoke endpoint, Dropbox token/revoke).
type grantRevoker interface {
	RevokeGrant(ctx context.Context, env Env, address string) error
}

// gitlabRevoker is the GitLab API's revocation of a token by itself.
type gitlabRevoker interface {
	RevokeSelf(ctx context.Context, b nativegitlab.Base, token string) error
}

type tally map[string]*DisconnectCount

func (t tally) add(provider, outcome string) {
	c := t[provider]
	if c == nil {
		c = &DisconnectCount{Provider: provider}
		t[provider] = c
	}
	switch outcome {
	case DisconnectRevoked:
		c.Revoked++
	case DisconnectLocalOnly:
		c.LocalOnly++
	default:
		c.Failed++
	}
}

// DisconnectAll revokes and removes every catalog account and forge
// connection and stops their sync. It waits for a running write rather than
// refusing, since nothing else may follow; an account it could not reach is
// failed, and its credential goes with the home. Synced folders stay; the
// home's deletion takes them.
func (c *Catalog) DisconnectAll(ctx context.Context) []DisconnectCount {
	t := tally{}
	locked := make(chan struct{})
	go func() { c.write.Lock(); close(locked) }()
	select {
	case <-locked:
		defer c.write.Unlock()
	case <-ctx.Done():
		// The lock is released when the waiting goroutine finally gets it.
		go func() { <-locked; c.write.Unlock() }()
		for _, p := range providerOrder {
			if e := c.entry(p); e != nil {
				if addresses, err := e.Accounts(c.env); err == nil {
					for range addresses {
						t.add(string(p), DisconnectFailed)
					}
				}
			}
		}
		return t.sorted()
	}
	accounts, unread := c.accounts()
	for p := range unread {
		t.add(string(p), DisconnectFailed)
	}
	for _, a := range accounts {
		p := a.entry.Provider()
		if ctx.Err() != nil || !c.abandonFor(p, a.address) {
			t.add(string(p), DisconnectFailed)
			continue
		}
		c.sync.stop(key{p, a.address})
		outcome := DisconnectLocalOnly
		if r, ok := a.entry.(grantRevoker); ok {
			bounded, cancel := context.WithTimeout(ctx, 20*time.Second)
			err := r.RevokeGrant(bounded, c.env, a.address)
			cancel()
			outcome = DisconnectRevoked
			if err != nil {
				outcome = DisconnectFailed
			}
		}
		if err := a.entry.Remove(ctx, c.env, a.address); err != nil {
			outcome = DisconnectFailed
		} else {
			c.forgetRefusal(key{p, a.address})
		}
		t.add(string(p), outcome)
	}
	c.reconcile()
	c.disconnectGitea(ctx, t)
	c.disconnectGitLab(ctx, t)
	return t.sorted()
}

func (t tally) sorted() []DisconnectCount {
	order := append([]Provider{}, providerOrder...)
	order = append(order, Gitea, GitLab)
	out := []DisconnectCount{}
	for _, p := range order {
		if c := t[string(p)]; c != nil {
			out = append(out, *c)
			delete(t, string(p))
		}
	}
	for _, c := range t {
		out = append(out, *c)
	}
	return out
}

// disconnectGitea removes tea's logins locally: Gitea has no revocation of a
// token by itself, so each is local_only.
func (c *Catalog) disconnectGitea(ctx context.Context, t tally) {
	g := c.gitea
	if g == nil || g.Store == nil {
		return
	}
	c.giteaWrite.Lock()
	defer c.giteaWrite.Unlock()
	logins, err := g.Store.Logins()
	if err != nil {
		t.add(string(Gitea), DisconnectFailed)
		return
	}
	bases := map[nativegitea.Base]bool{}
	for _, l := range logins {
		if l.Kind != nativegitea.KindPAT {
			continue
		}
		if _, err := g.Store.Remove(l.Target()); err != nil {
			t.add(string(Gitea), DisconnectFailed)
			continue
		}
		if l.URL != "" {
			bases[l.Base] = true
		}
		t.add(string(Gitea), DisconnectLocalOnly)
	}
	for b := range bases {
		_ = g.Git.Unregister(ctx, b, g.Executable)
	}
}

// disconnectGitLab revokes each glab token with itself, then logs it out as
// `glab auth logout` does.
func (c *Catalog) disconnectGitLab(ctx context.Context, t tally) {
	g := c.gitlab
	if g == nil || g.Store == nil {
		return
	}
	c.gitlabWrite.Lock()
	defer c.gitlabWrite.Unlock()
	logins, err := g.Store.Logins()
	if err != nil {
		t.add(string(GitLab), DisconnectFailed)
		return
	}
	for _, l := range logins {
		if l.Kind != nativegitlab.KindPAT {
			continue
		}
		outcome := DisconnectFailed
		if r, ok := g.API.(gitlabRevoker); ok && l.Usable() {
			if token, err := g.Store.Token(l.Target()); err == nil {
				bounded, cancel := context.WithTimeout(ctx, 20*time.Second)
				if r.RevokeSelf(bounded, l.Base, token) == nil {
					outcome = DisconnectRevoked
				}
				cancel()
			}
		}
		if _, err := g.Store.Remove(l.Target()); err != nil {
			outcome = DisconnectFailed
		} else if l.URL != "" {
			_ = g.Git.Unregister(ctx, l.Base, g.Executable)
		}
		t.add(string(GitLab), outcome)
	}
}

// RevokeGrant ends the account's Google grant with its own refresh token.
func (g *google) RevokeGrant(ctx context.Context, env Env, address string) error {
	g.native.Lock()
	refresh := ""
	if native, err := googleReadNative(env, address); err == nil {
		refresh = native.refresh
	}
	var err error
	if refresh == "" {
		refresh, err = googleExportRefresh(ctx, env, address)
	}
	g.native.Unlock()
	if err != nil {
		return err
	}
	return g.revoke(ctx, refresh)
}

// RevokeGrant ends the account's Dropbox grant with its own refresh token
// and the application it was issued to.
func (d *dropbox) RevokeGrant(ctx context.Context, env Env, address string) error {
	d.native.Lock()
	n, err := dropboxReadNative(env, address)
	d.native.Unlock()
	if err != nil {
		return err
	}
	refresh, ok := dropboxRefresh(n.token)
	if !ok {
		return ToolFailed
	}
	return d.revoke(ctx, DropboxApp{ClientID: n.clientID, ClientSecret: n.clientSecret}, refresh)
}

var _ grantRevoker = (*google)(nil)
var _ grantRevoker = (*dropbox)(nil)
var _ gitlabRevoker = (*nativegitlab.Client)(nil)

// dropboxRefresh is the refresh token in rclone's token value.
func dropboxRefresh(token string) (string, bool) {
	var t struct {
		Refresh string `json:"refresh_token"`
	}
	if json.Unmarshal([]byte(token), &t) != nil || t.Refresh == "" {
		return "", false
	}
	return t.Refresh, true
}
