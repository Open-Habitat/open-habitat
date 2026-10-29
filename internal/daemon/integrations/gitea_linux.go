//go:build linux

package integrations

import (
	"context"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/nativegitea"
)

// Gitea connections (ADR 0031) are tea's native PAT logins. Unlike the other
// entries they are not mail-shaped accounts: a connection is a base and a
// Gitea user, its token lives only in tea's file, and its repositories are
// cloned through the daemon's ordinary clone jobs. The catalog lists them
// from the file alone; only connect, replace, check and the repository list
// reach the network, each with the fixed reads of nativegitea's client.
const (
	GiteaPath      = "/api/v1/integrations/gitea"
	GiteaReposPath = "/api/v1/integrations/gitea/repos"
	// Gitea is the provider tile of the connection form.
	Gitea Provider = "gitea"
	// PersonalToken is the Gitea form: an address and a personal access token.
	PersonalToken LoginKind = "personal_token"
)

// GiteaAPI is the fixed set of Gitea reads; nativegitea.Client is the
// production one.
type GiteaAPI interface {
	nativegitea.Verifier
	User(ctx context.Context, b nativegitea.Base, token string) (nativegitea.Account, error)
	Repos(ctx context.Context, b nativegitea.Base, token string) (nativegitea.RepoList, error)
	Repository(ctx context.Context, b nativegitea.Base, token string, id int64) (nativegitea.Repository, error)
	Push(ctx context.Context, b nativegitea.Base, user, token string) nativegitea.Push
}

// GiteaAdapter is the one native adapter the integrations routes and the
// clone jobs share. Its Store is shared too, because the Store's holds are
// how a running clone refuses a disconnect.
type GiteaAdapter struct {
	Store *nativegitea.Store
	API   GiteaAPI
	Git   nativegitea.GitConfig
	// Executable is the absolute binary Git runs as the credential helper.
	Executable string
	env        Env
}

// NewGitea adapts tea's logins in env.Home with the daemon's own XDG layout
// (home/.config), the one nativeCommandInput gives Git too.
func NewGitea(env Env, api GiteaAPI, git, executable string) (*GiteaAdapter, error) {
	config := filepath.Join(env.Home, ".config")
	store, err := nativegitea.NewStore(env.Home, config)
	if err != nil {
		return nil, err
	}
	return &GiteaAdapter{Store: store, API: api, Git: nativegitea.NewGitConfig(env.Home, config, git), Executable: executable, env: env}, nil
}

// Available: the installation provides the qualified tea CLI. Until the
// integrations profile ships it, the connector is not offered at all, so
// no half-qualified runtime is ever published (ADR 0031, runtime proof).
func (g *GiteaAdapter) Available() bool {
	if g == nil {
		return false
	}
	_, ok := g.env.Tool("tea")
	return ok
}

// Login finds the login whose derived connection ID is id, from tea's file
// as it is now. The browser can name only an ID the daemon derived itself.
func (g *GiteaAdapter) Login(id string) (nativegitea.Login, error) {
	if !giteaConnectionID.MatchString(id) {
		return nativegitea.Login{}, nativegitea.ErrNotFound
	}
	logins, err := g.Store.Logins()
	if err != nil {
		return nativegitea.Login{}, err
	}
	for _, l := range logins {
		if l.ConnectionID() == id {
			return l, nil
		}
	}
	return nativegitea.Login{}, nativegitea.ErrNotFound
}

// WithGitea adds the Gitea connections to the catalog.
func WithGitea(g *GiteaAdapter) Option {
	return func(c *Catalog) { c.gitea = g }
}

var giteaConnectionID = regexp.MustCompile(`^gitea_[0-9a-f]{24}$`)

type giteaConnection struct {
	ID        string `json:"id"`
	BaseURL   string `json:"base_url,omitempty"`
	User      string `json:"user,omitempty"`
	Kind      string `json:"kind"`
	Owned     bool   `json:"owned"`
	Ambiguous bool   `json:"ambiguous"`
	Git       string `json:"git"`
}

type giteaList struct {
	State       string            `json:"state"`
	Connections []giteaConnection `json:"connections"`
}

var giteaUser = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,40}$`)

// gitState observes the helper registration for b without the network.
func (g *GiteaAdapter) gitState(ctx context.Context, b nativegitea.Base) string {
	st, err := g.Git.State(ctx, b, g.Executable)
	if err != nil {
		return "unknown"
	}
	return string(st)
}

func (g *GiteaAdapter) view(ctx context.Context, l nativegitea.Login, states map[nativegitea.Base]string) giteaConnection {
	v := giteaConnection{ID: l.ConnectionID(), Kind: string(l.Kind), Owned: l.Owned, Ambiguous: l.Ambiguous, Git: "absent"}
	if l.URL != "" {
		v.BaseURL = l.URL
		st, ok := states[l.Base]
		if !ok {
			st = g.gitState(ctx, l.Base)
			if states != nil {
				states[l.Base] = st
			}
		}
		v.Git = st
	}
	if giteaUser.MatchString(l.User) {
		v.User = l.User
	}
	return v
}

// list reads tea's file only; an unreadable file is unavailable, never an
// empty list.
func (g *GiteaAdapter) list(ctx context.Context) giteaList {
	logins, err := g.Store.Logins()
	if err != nil {
		return giteaList{State: "unavailable", Connections: []giteaConnection{}}
	}
	out := giteaList{State: "ok", Connections: []giteaConnection{}}
	states := map[nativegitea.Base]string{}
	for _, l := range logins {
		if len(out.Connections) == 32 {
			break
		}
		out.Connections = append(out.Connections, g.view(ctx, l, states))
	}
	return out
}

type giteaRequest struct {
	Action       string `json:"action"`
	BaseURL      string `json:"base_url"`
	Token        string `json:"token"`
	ConnectionID string `json:"connection_id"`
}

type giteaChange struct {
	SchemaVersion int              `json:"schema_version"`
	Outcome       string           `json:"outcome"`
	Connection    *giteaConnection `json:"connection,omitempty"`
	API           string           `json:"api,omitempty"`
	// Push is whether Git may push with the token, beside a working api.
	Push    string        `json:"push,omitempty"`
	Removed *giteaRemoved `json:"removed,omitempty"`
}

type giteaRemoved struct {
	ID string `json:"id"`
}

// apiState names a fixed read's failure as the contract's api value; ""
// when the failure is not the server's answer but the native state's.
func apiState(err error) string {
	switch err {
	case nil:
		return "ok"
	case nativegitea.ErrRejected:
		return "token_rejected"
	case nativegitea.ErrScope:
		return "insufficient_scope"
	case nativegitea.ErrAccountMismatch:
		return "account_mismatch"
	case nativegitea.ErrUnreachable:
		return "unreachable"
	case nativegitea.ErrUntrustedTLS:
		return "tls_untrusted"
	case nativegitea.ErrRedirect:
		return "redirect_refused"
	case nativegitea.ErrForbiddenDestination:
		return "forbidden_destination"
	case nativegitea.ErrProtocol:
		return "not_gitea"
	}
	return ""
}

// giteaRefuse answers a write that wrote nothing, or whose outcome is
// uncertain, with a fixed code. Native text never reaches it.
func (c *Catalog) giteaRefuse(w http.ResponseWriter, action string, err error) {
	status, code := 503, "native_unavailable"
	switch err {
	case nativegitea.ErrInvalidAddress:
		status, code = 422, "invalid_address"
	case nativegitea.ErrInvalidToken:
		status, code = 422, "invalid_token"
	case nativegitea.ErrExists:
		status, code = 409, "connection_exists"
	case nativegitea.ErrNameTaken, nativegitea.ErrAmbiguous:
		status, code = 409, "native_conflict"
	case nativegitea.ErrNotFound, nativegitea.ErrChanged:
		status, code = 409, "connection_changed"
	case nativegitea.ErrUnsupported:
		status, code = 409, "unsupported_entry"
	case nativegitea.ErrInUse:
		status, code = 409, "clone_running"
	case nativegitea.ErrBusy:
		status, code = 409, "native_busy"
	case nativegitea.ErrWriteFailed:
		status, code = 409, "write_failed"
	case nativegitea.ErrHelperConflict:
		status, code = 409, "helper_conflict"
	case nativegitea.ErrUncertain:
		// It may be durable: the page reads the list again, never replays.
		status, code = 503, "write_uncertain"
	default:
		if s := apiState(err); s != "" && s != "ok" {
			status, code = 422, s
		}
	}
	if status == 503 {
		c.log.Warn("integration_gitea", "action", action, "outcome", "failed", "reason", code)
	}
	fail(w, status, code)
}

func (c *Catalog) giteaRequest(w http.ResponseWriter, r *http.Request) {
	g := c.gitea
	var in giteaRequest
	if g == nil || (r.Method != http.MethodPost && r.Method != http.MethodDelete) || decode(r, &in, 4096) != nil {
		fail(w, 400, "invalid_request")
		return
	}
	shape := false
	switch in.Action {
	case "connect":
		shape = r.Method == http.MethodPost && in.BaseURL != "" && len(in.BaseURL) <= 2048 && in.Token != "" && in.ConnectionID == ""
	case "replace":
		shape = r.Method == http.MethodPost && giteaConnectionID.MatchString(in.ConnectionID) && in.Token != "" && in.BaseURL == ""
	case "check", "repair":
		shape = r.Method == http.MethodPost && giteaConnectionID.MatchString(in.ConnectionID) && in.Token == "" && in.BaseURL == ""
	case "disconnect":
		shape = r.Method == http.MethodDelete && giteaConnectionID.MatchString(in.ConnectionID) && in.Token == "" && in.BaseURL == ""
	}
	if !shape {
		fail(w, 400, "invalid_request")
		return
	}
	// A disconnect stays possible after the operator withdraws the tool:
	// it only removes the person's own local entry.
	if in.Action != "disconnect" && !g.Available() {
		fail(w, 409, "provider_unavailable")
		return
	}
	// Never queue a browser write behind another one and run it after the
	// caller has given up.
	if !c.giteaWrite.TryLock() {
		fail(w, 409, "native_busy")
		return
	}
	defer c.giteaWrite.Unlock()
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(45 * time.Second))
	ctx, cancel := context.WithTimeout(r.Context(), 40*time.Second)
	defer cancel()
	if in.Action == "connect" {
		base, err := nativegitea.ParseBase(in.BaseURL)
		if err != nil {
			c.giteaRefuse(w, in.Action, nativegitea.ErrInvalidAddress)
			return
		}
		login, outcome, err := g.Store.Connect(ctx, g.API, base, in.Token)
		if err != nil {
			c.giteaRefuse(w, in.Action, err)
			return
		}
		// tea's entry and Git's helper settings are not one transaction.
		// A failed registration leaves a connection whose git state says so,
		// and the page offers repair; it is never reported as ready.
		if err := g.Git.Register(ctx, base, g.Executable); err != nil {
			c.log.Warn("integration_gitea", "action", "connect", "outcome", "helper_not_registered", "reason", "git_config")
		}
		v := g.view(ctx, login, nil)
		push := g.API.Push(ctx, base, login.User, in.Token)
		c.log.Info("integration_gitea", "action", "connect", "outcome", string(outcome), "push", string(push))
		reply(w, giteaChange{SchemaVersion: 1, Outcome: string(outcome), Connection: &v, API: "ok", Push: string(push)})
		return
	}
	login, err := g.Login(in.ConnectionID)
	if err != nil {
		c.giteaRefuse(w, in.Action, err)
		return
	}
	switch in.Action {
	case "replace":
		updated, outcome, err := g.Store.Replace(ctx, g.API, login.Target(), in.Token)
		if err != nil {
			c.giteaRefuse(w, in.Action, err)
			return
		}
		v := g.view(ctx, updated, nil)
		push := g.API.Push(ctx, updated.Base, updated.User, in.Token)
		c.log.Info("integration_gitea", "action", "replace", "outcome", string(outcome), "push", string(push))
		reply(w, giteaChange{SchemaVersion: 1, Outcome: string(outcome), Connection: &v, API: "ok", Push: string(push)})
	case "check":
		token, err := g.Store.Token(login.Target())
		if err != nil {
			c.giteaRefuse(w, in.Action, err)
			return
		}
		// The same two reads as connect: a PAT tea holds without the
		// repository scope (added with tea itself, say) is no working grant.
		account, err := g.API.Verify(ctx, login.Base, token)
		if err == nil && (!strings.EqualFold(account.Login, login.User) || (login.Owned && account.ID != login.OwnedID)) {
			err = nativegitea.ErrAccountMismatch
		}
		state := apiState(err)
		if state == "" {
			c.giteaRefuse(w, in.Action, err)
			return
		}
		push := ""
		if state == "ok" {
			push = string(g.API.Push(ctx, login.Base, login.User, token))
		}
		v := g.view(ctx, login, nil)
		reply(w, giteaChange{SchemaVersion: 1, Outcome: "checked", Connection: &v, API: state, Push: push})
	case "repair":
		if !login.Usable() {
			c.giteaRefuse(w, in.Action, nativegitea.ErrUnsupported)
			return
		}
		outcome := "unchanged"
		if g.gitState(ctx, login.Base) != string(nativegitea.HelperRegistered) {
			if err := g.Git.Register(ctx, login.Base, g.Executable); err != nil {
				c.giteaRefuse(w, in.Action, err)
				return
			}
			outcome = "written"
		}
		v := g.view(ctx, login, nil)
		reply(w, giteaChange{SchemaVersion: 1, Outcome: outcome, Connection: &v})
	case "disconnect":
		if login.Kind != nativegitea.KindPAT || login.URL == "" {
			c.giteaRefuse(w, in.Action, nativegitea.ErrUnsupported)
			return
		}
		outcome, err := g.Store.Remove(login.Target())
		if err != nil {
			c.giteaRefuse(w, in.Action, err)
			return
		}
		// The helper scope is the base's: another account of the same
		// Gitea still needs it.
		if remaining, err := g.Store.Logins(); err == nil {
			shared := false
			for _, l := range remaining {
				shared = shared || (l.URL != "" && l.Base == login.Base)
			}
			if !shared {
				if err := g.Git.Unregister(ctx, login.Base, g.Executable); err != nil {
					c.log.Warn("integration_gitea", "action", "disconnect", "outcome", "helper_kept", "reason", "git_config")
				}
			}
		}
		c.log.Info("integration_gitea", "action", "disconnect", "outcome", string(outcome))
		reply(w, giteaChange{SchemaVersion: 1, Outcome: string(outcome), Removed: &giteaRemoved{ID: in.ConnectionID}})
	}
}

type giteaRepository struct {
	ID            int64   `json:"id"`
	FullName      string  `json:"full_name"`
	Private       bool    `json:"private"`
	Description   string  `json:"description"`
	HTMLURL       string  `json:"html_url"`
	UpdatedAt     *string `json:"updated_at"`
	SizeKiB       int64   `json:"size_kib"`
	DefaultBranch *string `json:"default_branch"`
	Empty         bool    `json:"empty"`
	Archived      bool    `json:"archived"`
	Owned         bool    `json:"owned"`
}

type giteaSource struct {
	ConnectionID string            `json:"connection_id"`
	BaseURL      string            `json:"base_url"`
	User         string            `json:"user"`
	State        string            `json:"state"`
	Failure      string            `json:"failure,omitempty"`
	Complete     bool              `json:"complete"`
	Incomplete   string            `json:"incomplete,omitempty"`
	Repositories []giteaRepository `json:"repositories"`
}

// giteaReposLimit bounds the whole reply across sources.
const giteaReposLimit = 2000

// giteaRepos lists every usable connection's repositories, each source
// with its own state: one failing never empties another.
func (c *Catalog) giteaRepos(w http.ResponseWriter, r *http.Request) {
	g := c.gitea
	if r.Method != http.MethodGet || r.ContentLength > 0 || len(r.TransferEncoding) > 0 {
		fail(w, 400, "invalid_request")
		return
	}
	if !g.Available() {
		fail(w, 409, "provider_unavailable")
		return
	}
	logins, err := g.Store.Logins()
	if err != nil {
		fail(w, 503, "native_unavailable")
		return
	}
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(45 * time.Second))
	var usable []nativegitea.Login
	for _, l := range logins {
		if l.Usable() && l.URL != "" && giteaUser.MatchString(l.User) && len(usable) < 16 {
			usable = append(usable, l)
		}
	}
	sources := make([]giteaSource, len(usable))
	var wg sync.WaitGroup
	slots := make(chan struct{}, 4)
	for i, l := range usable {
		wg.Add(1)
		go func() {
			defer wg.Done()
			slots <- struct{}{}
			defer func() { <-slots }()
			sources[i] = g.source(r.Context(), l)
		}()
	}
	wg.Wait()
	total := 0
	for i := range sources {
		if room := giteaReposLimit - total; len(sources[i].Repositories) > room {
			sources[i].Repositories, sources[i].Complete, sources[i].Incomplete = sources[i].Repositories[:room], false, string(nativegitea.IncompleteLimit)
		}
		total += len(sources[i].Repositories)
	}
	reply(w, map[string]any{"schema_version": 1, "sources": sources})
}

func (g *GiteaAdapter) source(ctx context.Context, l nativegitea.Login) giteaSource {
	s := giteaSource{ConnectionID: l.ConnectionID(), BaseURL: l.URL, User: l.User, State: "failed", Repositories: []giteaRepository{}}
	token, err := g.Store.Token(l.Target())
	if err != nil {
		s.Failure = "native_unavailable"
		return s
	}
	// The list is this connection's only while its token still
	// authenticates the account tea's entry names: a PAT replaced by hand
	// with another account's would otherwise list that account's
	// repositories under this one.
	account, err := g.API.User(ctx, l.Base, token)
	if err == nil && (!strings.EqualFold(account.Login, l.User) || (l.Owned && account.ID != l.OwnedID)) {
		err = nativegitea.ErrAccountMismatch
	}
	if err != nil {
		s.Failure = apiState(err)
		if s.Failure == "" {
			s.Failure = "native_unavailable"
		}
		return s
	}
	list, err := g.API.Repos(ctx, l.Base, token)
	if err != nil {
		s.Failure = apiState(err)
		if s.Failure == "" || s.Failure == "account_mismatch" {
			s.Failure = "native_unavailable"
		}
		return s
	}
	s.State, s.Complete = "ok", list.Complete
	if !list.Complete {
		s.Incomplete = string(list.Incomplete)
		if s.Incomplete == "" {
			s.Incomplete = string(nativegitea.IncompleteInterrupted)
		}
	}
	for _, repo := range list.Repositories {
		v := giteaRepository{ID: repo.ID, FullName: repo.FullName(), Private: repo.Private, Description: repo.Description, HTMLURL: repo.HTMLURL(l.Base), SizeKiB: repo.SizeKiB, Empty: repo.Empty, Archived: repo.Archived, Owned: repo.OwnerID != 0 && repo.OwnerID == account.ID}
		if repo.UpdatedAt != "" {
			v.UpdatedAt = &repo.UpdatedAt
		}
		if repo.DefaultBranch != "" {
			v.DefaultBranch = &repo.DefaultBranch
		}
		s.Repositories = append(s.Repositories, v)
	}
	return s
}
