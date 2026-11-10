//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/open-habitat/open-habitat/internal/nativeforge"
	"github.com/open-habitat/open-habitat/internal/nativegitlab"
)

// GitLab connections are glab's native host logins (research
// gitlab-integration, recommendation A), the Gitea model with glab's file: a
// connection is a server and the GitLab user its token authenticates, the
// token lives only in glab's config.yml, and projects are cloned through the
// daemon's ordinary clone jobs. The catalog lists connections from the file
// alone; connect, replace, check, the token descriptions and the project
// list reach the network, each with nativegitlab's fixed reads.
const (
	GitLabPath       = "/api/v1/integrations/gitlab"
	GitLabReposPath  = "/api/v1/integrations/gitlab/repos"
	GitLabTokensPath = "/api/v1/integrations/gitlab/tokens"
	// GitLab is the provider tile of the connection form.
	GitLab Provider = "gitlab"
)

// GitLabAPI is the fixed set of GitLab reads; nativegitlab.Client is the
// production one.
type GitLabAPI interface {
	nativegitlab.Verifier
	User(ctx context.Context, b nativegitlab.Base, token string) (nativegitlab.Account, error)
	Token(ctx context.Context, b nativegitlab.Base, token string) (nativegitlab.TokenInfo, error)
	Projects(ctx context.Context, b nativegitlab.Base, token string, account nativegitlab.Account) (nativegitlab.ProjectList, error)
	Project(ctx context.Context, b nativegitlab.Base, token string, account nativegitlab.Account, id int64) (nativegitlab.Project, error)
}

// GitLabAdapter is the one native adapter the integrations routes and the
// clone jobs share; its Store's holds are how a running clone refuses a
// disconnect.
type GitLabAdapter struct {
	Store *nativegitlab.Store
	API   GitLabAPI
	Git   nativegitlab.GitConfig
	// Executable is the absolute binary Git runs as the credential helper.
	Executable string
	env        Env
}

// NewGitLab adapts glab's logins in env.Home with the daemon's own XDG
// layout (home/.config), the one Git and a person's glab see too.
func NewGitLab(env Env, api GitLabAPI, git, executable string) (*GitLabAdapter, error) {
	config := filepath.Join(env.Home, ".config")
	store, err := nativegitlab.NewStore(env.Home, config)
	if err != nil {
		return nil, err
	}
	return &GitLabAdapter{Store: store, API: api, Git: nativegitlab.NewGitConfig(env.Home, config, git), Executable: executable, env: env}, nil
}

// Available: the installation provides the qualified glab CLI. Until the
// integrations profile ships it, the connector is not offered at all.
func (g *GitLabAdapter) Available() bool {
	if g == nil {
		return false
	}
	_, ok := g.env.Tool("glab")
	return ok
}

var gitlabConnectionID = regexp.MustCompile(`^gitlab_[0-9a-f]{24}$`)

// Login finds the login whose derived connection ID is id, from glab's file
// as it is now. The browser can name only an ID the daemon derived itself.
func (g *GitLabAdapter) Login(id string) (nativegitlab.Login, error) {
	if !gitlabConnectionID.MatchString(id) {
		return nativegitlab.Login{}, nativegitlab.ErrNotFound
	}
	logins, err := g.Store.Logins()
	if err != nil {
		return nativegitlab.Login{}, err
	}
	for _, l := range logins {
		if l.ConnectionID() == id {
			return l, nil
		}
	}
	return nativegitlab.Login{}, nativegitlab.ErrNotFound
}

// WithGitLab adds the GitLab connections to the catalog.
func WithGitLab(g *GitLabAdapter) Option {
	return func(c *Catalog) { c.gitlab = g }
}

var gitlabUser = regexp.MustCompile(`^[A-Za-z0-9_][A-Za-z0-9_.-]{0,254}$`)

type gitlabConnection struct {
	ID        string `json:"id"`
	BaseURL   string `json:"base_url,omitempty"`
	User      string `json:"user,omitempty"`
	Kind      string `json:"kind"`
	Ambiguous bool   `json:"ambiguous"`
	Git       string `json:"git"`
}

type gitlabList struct {
	State       string             `json:"state"`
	Connections []gitlabConnection `json:"connections"`
}

// gitlabToken is what GitLab said about a token just now, never stored.
// Scopes, expires_at (null for a token without expiry) and fine are present
// only when GitLab described the token.
type gitlabToken struct {
	Push      string          `json:"push"`
	Scopes    *[]string       `json:"scopes,omitempty"`
	ExpiresAt json.RawMessage `json:"expires_at,omitempty"`
	Fine      *bool           `json:"fine,omitempty"`
}

func tokenView(info nativegitlab.TokenInfo) *gitlabToken {
	t := &gitlabToken{Push: string(info.Push)}
	if t.Push == "" {
		t.Push = string(nativegitlab.PushUnknown)
	}
	if info.Known {
		scopes := append([]string{}, info.Scopes...)
		t.Scopes = &scopes
		fine := info.Fine
		t.Fine = &fine
		t.ExpiresAt = json.RawMessage("null")
		if info.ExpiresAt != "" {
			t.ExpiresAt, _ = json.Marshal(info.ExpiresAt)
		}
	}
	return t
}

func (g *GitLabAdapter) gitState(ctx context.Context, b nativegitlab.Base) string {
	st, err := g.Git.State(ctx, b, g.Executable)
	if err != nil {
		return "unknown"
	}
	return string(st)
}

func (g *GitLabAdapter) view(ctx context.Context, l nativegitlab.Login) gitlabConnection {
	v := gitlabConnection{ID: l.ConnectionID(), Kind: string(l.Kind), Ambiguous: l.Ambiguous, Git: "absent"}
	if l.URL != "" {
		v.BaseURL, v.Git = l.URL, g.gitState(ctx, l.Base)
	}
	if gitlabUser.MatchString(l.User) {
		v.User = l.User
	}
	return v
}

// list reads glab's file only; an unreadable file is unavailable, never an
// empty list.
func (g *GitLabAdapter) list(ctx context.Context) gitlabList {
	logins, err := g.Store.Logins()
	if err != nil {
		return gitlabList{State: "unavailable", Connections: []gitlabConnection{}}
	}
	out := gitlabList{State: "ok", Connections: []gitlabConnection{}}
	for _, l := range logins {
		if len(out.Connections) == 32 {
			break
		}
		out.Connections = append(out.Connections, g.view(ctx, l))
	}
	return out
}

type gitlabRequest struct {
	Action       string `json:"action"`
	BaseURL      string `json:"base_url"`
	Token        string `json:"token"`
	ConnectionID string `json:"connection_id"`
}

type gitlabChange struct {
	SchemaVersion int               `json:"schema_version"`
	Outcome       string            `json:"outcome"`
	Connection    *gitlabConnection `json:"connection,omitempty"`
	API           string            `json:"api,omitempty"`
	Token         *gitlabToken      `json:"token,omitempty"`
	Removed       *giteaRemoved     `json:"removed,omitempty"`
}

// gitlabAPIState names a fixed read's failure as the contract's api value;
// "" when the failure is not the server's answer but the native state's.
func gitlabAPIState(err error) string {
	switch err {
	case nil:
		return "ok"
	case nativegitlab.ErrRejected:
		return "token_rejected"
	case nativegitlab.ErrExpired:
		return "token_expired"
	case nativegitlab.ErrScope:
		return "insufficient_scope"
	case nativegitlab.ErrAccountMismatch:
		return "account_mismatch"
	case nativegitlab.ErrUnreachable:
		return "unreachable"
	case nativegitlab.ErrUntrustedTLS:
		return "tls_untrusted"
	case nativegitlab.ErrRedirect:
		return "redirect_refused"
	case nativegitlab.ErrForbiddenDestination:
		return "forbidden_destination"
	case nativegitlab.ErrProtocol:
		return "not_gitlab"
	}
	return ""
}

// gitlabRefuse answers a write that wrote nothing, or whose outcome is
// uncertain, with a fixed code. Native text never reaches it.
func (c *Catalog) gitlabRefuse(w http.ResponseWriter, action string, err error) {
	status, code := 503, "native_unavailable"
	switch err {
	case nativegitlab.ErrInvalidAddress:
		status, code = 422, "invalid_address"
	case nativegitlab.ErrInvalidToken:
		status, code = 422, "invalid_token"
	case nativegitlab.ErrExists:
		status, code = 409, "connection_exists"
	case nativegitlab.ErrAmbiguous:
		status, code = 409, "native_conflict"
	case nativegitlab.ErrNotFound, nativegitlab.ErrChanged:
		status, code = 409, "connection_changed"
	case nativegitlab.ErrUnsupported:
		status, code = 409, "unsupported_entry"
	case nativegitlab.ErrInUse:
		status, code = 409, "clone_running"
	case nativegitlab.ErrBusy:
		status, code = 409, "native_busy"
	case nativegitlab.ErrWriteFailed:
		status, code = 409, "write_failed"
	case nativegitlab.ErrHelperConflict:
		status, code = 409, "helper_conflict"
	case nativegitlab.ErrUncertain:
		status, code = 503, "write_uncertain"
	default:
		if s := gitlabAPIState(err); s != "" && s != "ok" {
			status, code = 422, s
		}
	}
	if status == 503 {
		c.log.Warn("integration_gitlab", "action", action, "outcome", "failed", "reason", code)
	}
	fail(w, status, code)
}

func (c *Catalog) gitlabRequest(w http.ResponseWriter, r *http.Request) {
	g := c.gitlab
	var in gitlabRequest
	if g == nil || (r.Method != http.MethodPost && r.Method != http.MethodDelete) || decode(r, &in, 4096) != nil {
		fail(w, 400, "invalid_request")
		return
	}
	shape := false
	switch in.Action {
	case "connect":
		shape = r.Method == http.MethodPost && in.BaseURL != "" && len(in.BaseURL) <= 2048 && in.Token != "" && in.ConnectionID == ""
	case "replace":
		shape = r.Method == http.MethodPost && gitlabConnectionID.MatchString(in.ConnectionID) && in.Token != "" && in.BaseURL == ""
	case "check", "repair":
		shape = r.Method == http.MethodPost && gitlabConnectionID.MatchString(in.ConnectionID) && in.Token == "" && in.BaseURL == ""
	case "disconnect":
		shape = r.Method == http.MethodDelete && gitlabConnectionID.MatchString(in.ConnectionID) && in.Token == "" && in.BaseURL == ""
	}
	if !shape {
		fail(w, 400, "invalid_request")
		return
	}
	// A disconnect stays possible after the operator withdraws the tool:
	// it only logs the person's own local entry out.
	if in.Action != "disconnect" && !g.Available() {
		fail(w, 409, "provider_unavailable")
		return
	}
	// Never queue a browser write behind another one and run it after the
	// caller has given up.
	if !c.gitlabWrite.TryLock() {
		fail(w, 409, "native_busy")
		return
	}
	defer c.gitlabWrite.Unlock()
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(45 * time.Second))
	ctx, cancel := context.WithTimeout(r.Context(), 40*time.Second)
	defer cancel()
	if in.Action == "connect" {
		base, err := nativegitlab.ParseBase(in.BaseURL)
		if err != nil {
			c.gitlabRefuse(w, in.Action, nativegitlab.ErrInvalidAddress)
			return
		}
		login, info, outcome, err := g.Store.Connect(ctx, g.API, base, in.Token)
		if err != nil {
			c.gitlabRefuse(w, in.Action, err)
			return
		}
		// glab's entry and Git's helper settings are not one transaction.
		// A failed registration leaves a connection whose git state says so,
		// and the page offers repair; it is never reported as ready.
		if err := g.Git.Register(ctx, login.Base, g.Executable); err != nil {
			c.log.Warn("integration_gitlab", "action", "connect", "outcome", "helper_not_registered", "reason", "git_config")
		}
		v := g.view(ctx, login)
		c.log.Info("integration_gitlab", "action", "connect", "outcome", string(outcome))
		reply(w, gitlabChange{SchemaVersion: 1, Outcome: string(outcome), Connection: &v, API: "ok", Token: tokenView(info)})
		return
	}
	login, err := g.Login(in.ConnectionID)
	if err != nil {
		c.gitlabRefuse(w, in.Action, err)
		return
	}
	switch in.Action {
	case "replace":
		updated, info, outcome, err := g.Store.Replace(ctx, g.API, login.Target(), in.Token)
		if err != nil {
			c.gitlabRefuse(w, in.Action, err)
			return
		}
		v := g.view(ctx, updated)
		c.log.Info("integration_gitlab", "action", "replace", "outcome", string(outcome))
		reply(w, gitlabChange{SchemaVersion: 1, Outcome: string(outcome), Connection: &v, API: "ok", Token: tokenView(info)})
	case "check":
		token, err := g.Store.Token(login.Target())
		if err != nil {
			c.gitlabRefuse(w, in.Action, err)
			return
		}
		account, info, err := g.API.Verify(ctx, login.Base, token)
		if err == nil && !strings.EqualFold(account.Username, login.User) {
			err = nativegitlab.ErrAccountMismatch
		}
		state := gitlabAPIState(err)
		if state == "" {
			c.gitlabRefuse(w, in.Action, err)
			return
		}
		v := g.view(ctx, login)
		change := gitlabChange{SchemaVersion: 1, Outcome: "checked", Connection: &v, API: state}
		if err == nil {
			change.Token = tokenView(info)
		}
		reply(w, change)
	case "repair":
		if !login.Usable() {
			c.gitlabRefuse(w, in.Action, nativegitlab.ErrUnsupported)
			return
		}
		outcome := "unchanged"
		if g.gitState(ctx, login.Base) != string(nativeforge.HelperRegistered) {
			if err := g.Git.Register(ctx, login.Base, g.Executable); err != nil {
				c.gitlabRefuse(w, in.Action, err)
				return
			}
			outcome = "written"
		}
		v := g.view(ctx, login)
		reply(w, gitlabChange{SchemaVersion: 1, Outcome: outcome, Connection: &v})
	case "disconnect":
		if login.Kind != nativegitlab.KindPAT || login.URL == "" {
			c.gitlabRefuse(w, in.Action, nativegitlab.ErrUnsupported)
			return
		}
		outcome, err := g.Store.Remove(login.Target())
		if err != nil {
			c.gitlabRefuse(w, in.Action, err)
			return
		}
		// glab holds one account per server, so the helper scope served
		// only this login; another entry for the server would be ambiguous
		// and was refused above.
		if err := g.Git.Unregister(ctx, login.Base, g.Executable); err != nil {
			c.log.Warn("integration_gitlab", "action", "disconnect", "outcome", "helper_kept", "reason", "git_config")
		}
		c.log.Info("integration_gitlab", "action", "disconnect", "outcome", string(outcome))
		reply(w, gitlabChange{SchemaVersion: 1, Outcome: string(outcome), Removed: &giteaRemoved{ID: in.ConnectionID}})
	}
}

// usableLogins are the connections whose token a read may use.
func (g *GitLabAdapter) usableLogins() ([]nativegitlab.Login, error) {
	logins, err := g.Store.Logins()
	if err != nil {
		return nil, err
	}
	var usable []nativegitlab.Login
	for _, l := range logins {
		if l.Usable() && gitlabUser.MatchString(l.User) && len(usable) < 16 {
			usable = append(usable, l)
		}
	}
	return usable, nil
}

// each runs read for every usable connection, four at a time; one failing
// never empties another.
func each[T any](logins []nativegitlab.Login, read func(nativegitlab.Login) T) []T {
	out := make([]T, len(logins))
	var wg sync.WaitGroup
	slots := make(chan struct{}, 4)
	for i, l := range logins {
		wg.Add(1)
		go func() {
			defer wg.Done()
			slots <- struct{}{}
			defer func() { <-slots }()
			out[i] = read(l)
		}()
	}
	wg.Wait()
	return out
}

func (c *Catalog) gitlabGet(w http.ResponseWriter, r *http.Request) ([]nativegitlab.Login, bool) {
	g := c.gitlab
	if r.Method != http.MethodGet || r.ContentLength > 0 || len(r.TransferEncoding) > 0 {
		fail(w, 400, "invalid_request")
		return nil, false
	}
	if !g.Available() {
		fail(w, 409, "provider_unavailable")
		return nil, false
	}
	usable, err := g.usableLogins()
	if err != nil {
		fail(w, 503, "native_unavailable")
		return nil, false
	}
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(45 * time.Second))
	return usable, true
}

// authenticated reads the connection's token and the user it authenticates
// now. The connection's facts are its own only while that user is the one
// glab's entry names: a token replaced by hand with another user's would
// otherwise speak for this one.
func (g *GitLabAdapter) authenticated(ctx context.Context, l nativegitlab.Login) (string, nativegitlab.Account, string) {
	token, err := g.Store.Token(l.Target())
	if err != nil {
		return "", nativegitlab.Account{}, "native_unavailable"
	}
	account, err := g.API.User(ctx, l.Base, token)
	if err == nil && !strings.EqualFold(account.Username, l.User) {
		err = nativegitlab.ErrAccountMismatch
	}
	if err != nil {
		failure := gitlabAPIState(err)
		if failure == "" {
			failure = "native_unavailable"
		}
		return "", nativegitlab.Account{}, failure
	}
	return token, account, ""
}

type gitlabTokenState struct {
	ConnectionID string       `json:"connection_id"`
	API          string       `json:"api"`
	Token        *gitlabToken `json:"token,omitempty"`
}

// gitlabTokens describes every usable connection's token as GitLab does now:
// what Koodipalvelut shows (scopes, expiry, push) without a stored copy.
func (c *Catalog) gitlabTokens(w http.ResponseWriter, r *http.Request) {
	usable, ok := c.gitlabGet(w, r)
	if !ok {
		return
	}
	g := c.gitlab
	states := each(usable, func(l nativegitlab.Login) gitlabTokenState {
		s := gitlabTokenState{ConnectionID: l.ConnectionID()}
		token, _, failure := g.authenticated(r.Context(), l)
		if failure != "" {
			s.API = failure
			return s
		}
		info, err := g.API.Token(r.Context(), l.Base, token)
		if s.API = gitlabAPIState(err); s.API == "" {
			s.API = "native_unavailable"
		}
		if err == nil {
			s.Token = tokenView(info)
		}
		return s
	})
	reply(w, map[string]any{"schema_version": 1, "connections": states})
}

type gitlabRepository struct {
	ID            int64   `json:"id"`
	FullName      string  `json:"full_name"`
	Visibility    string  `json:"visibility"`
	Description   string  `json:"description"`
	HTMLURL       string  `json:"html_url"`
	ActivityAt    *string `json:"activity_at"`
	SizeKiB       *int64  `json:"size_kib"`
	DefaultBranch *string `json:"default_branch"`
	Empty         bool    `json:"empty"`
	Archived      bool    `json:"archived"`
	Personal      bool    `json:"personal"`
	Own           bool    `json:"own"`
}

type gitlabElsewhere struct {
	Count  int    `json:"count"`
	Origin string `json:"origin,omitempty"`
}

type gitlabSource struct {
	ConnectionID string             `json:"connection_id"`
	BaseURL      string             `json:"base_url"`
	User         string             `json:"user"`
	State        string             `json:"state"`
	Failure      string             `json:"failure,omitempty"`
	Complete     bool               `json:"complete"`
	Incomplete   string             `json:"incomplete,omitempty"`
	Elsewhere    *gitlabElsewhere   `json:"elsewhere,omitempty"`
	Repositories []gitlabRepository `json:"repositories"`
}

// gitlabReposLimit bounds the whole reply across sources.
const gitlabReposLimit = 2000

// gitlabRepos lists every usable connection's member projects, each source
// with its own state: one failing never empties another.
func (c *Catalog) gitlabRepos(w http.ResponseWriter, r *http.Request) {
	usable, ok := c.gitlabGet(w, r)
	if !ok {
		return
	}
	sources := each(usable, func(l nativegitlab.Login) gitlabSource { return c.gitlab.source(r.Context(), l) })
	total := 0
	for i := range sources {
		if room := gitlabReposLimit - total; len(sources[i].Repositories) > room {
			sources[i].Repositories, sources[i].Complete, sources[i].Incomplete = sources[i].Repositories[:room], false, string(nativeforge.IncompleteLimit)
		}
		total += len(sources[i].Repositories)
	}
	reply(w, map[string]any{"schema_version": 1, "sources": sources})
}

func (g *GitLabAdapter) source(ctx context.Context, l nativegitlab.Login) gitlabSource {
	s := gitlabSource{ConnectionID: l.ConnectionID(), BaseURL: l.URL, User: l.User, State: "failed", Repositories: []gitlabRepository{}}
	token, account, failure := g.authenticated(ctx, l)
	if failure != "" {
		s.Failure = failure
		return s
	}
	list, err := g.API.Projects(ctx, l.Base, token, account)
	if err != nil {
		s.Failure = gitlabAPIState(err)
		if s.Failure == "" || s.Failure == "account_mismatch" {
			s.Failure = "native_unavailable"
		}
		return s
	}
	s.State, s.Complete = "ok", list.Complete
	if !list.Complete {
		s.Incomplete = string(list.Incomplete)
		if s.Incomplete == "" {
			s.Incomplete = string(nativeforge.IncompleteInterrupted)
		}
	}
	if list.Elsewhere > 0 {
		s.Elsewhere = &gitlabElsewhere{Count: list.Elsewhere, Origin: list.ElsewhereOrigin}
	}
	for _, p := range list.Projects {
		v := gitlabRepository{ID: p.ID, FullName: p.FullName, Visibility: p.Visibility, Description: p.Description, HTMLURL: p.HTMLURL(l.Base), Empty: p.Empty, Archived: p.Archived, Personal: p.Personal, Own: p.Own}
		if p.ActivityAt != "" {
			at := p.ActivityAt
			v.ActivityAt = &at
		}
		if p.SizeKiB >= 0 {
			size := p.SizeKiB
			v.SizeKiB = &size
		}
		if p.DefaultBranch != "" {
			branch := p.DefaultBranch
			v.DefaultBranch = &branch
		}
		s.Repositories = append(s.Repositories, v)
	}
	return s
}
