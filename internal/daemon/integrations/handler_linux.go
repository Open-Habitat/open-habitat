//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"sync"
	"time"
)

const (
	ListPath     = "/api/v1/integrations"
	AccountsPath = "/api/v1/integrations/accounts"
	LoginPath    = "/api/v1/integrations/login"
)

// sessionOwner is the gateway's hash of the browser session; it owns a login
// attempt the way it owns a Claude or Pi login lease.
var sessionOwner = regexp.MustCompile(`^[A-Za-z0-9_-]{43}$`)

// Handler serves the three integration routes. authorized must accept only
// the verified gateway peer on the daemon's own socket.
func (c *Catalog) Handler(authorized func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.RawQuery != "" || r.RequestURI != r.URL.Path || !authorized(r) {
			fail(w, 403, "cross_user_denied")
			return
		}
		switch r.URL.Path {
		case ListPath:
			if r.Method != http.MethodGet || r.ContentLength > 0 || len(r.TransferEncoding) > 0 {
				fail(w, 405, "method_not_allowed")
				return
			}
			c.list(w, r)
		case AccountsPath:
			c.accountsRequest(w, r)
		case LoginPath:
			c.loginRequest(w, r)
		default:
			fail(w, 404, "not_found")
		}
	})
}

// AgentHandler shares native account operations, not browser login leases.
// Callers supply kernel own-UID authorization; no session header is accepted as authority.
func (c *Catalog) AgentHandler(authorized func(*http.Request) bool, listPath, accountsPath string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !authorized(r) {
			fail(w, 403, "cross_user_denied")
			return
		}
		if r.URL.RawQuery != "" || r.URL.RawPath != "" || r.RequestURI != r.URL.Path {
			fail(w, 400, "invalid_request")
			return
		}
		switch r.URL.Path {
		case listPath:
			if r.Method != http.MethodGet || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
				fail(w, 400, "invalid_request")
				return
			}
			c.list(w, r)
		case accountsPath:
			c.accountsRequest(w, r)
		default:
			fail(w, 404, "not_found")
		}
	})
}

type providerView struct {
	ID        Provider  `json:"id"`
	Available bool      `json:"available"`
	Login     LoginKind `json:"login"`
	Services  []string  `json:"services"`
}

type listView struct {
	SchemaVersion int            `json:"schema_version"`
	Providers     []providerView `json:"providers"`
	Accounts      []Account      `json:"accounts"`
	Skill         SkillState     `json:"skill"`
}

// list reads the catalog and asks every tool for its accounts' state now. A
// read writes nothing in the home, not even a stale skill.
func (c *Catalog) list(w http.ResponseWriter, r *http.Request) {
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(30 * time.Second))
	view := listView{SchemaVersion: 1, Providers: []providerView{}, Accounts: []Account{}}
	for _, p := range providerOrder {
		if e := c.entry(p); e != nil {
			view.Providers = append(view.Providers, providerView{p, e.Available(c.env), e.Login(), e.Services()})
		}
	}
	accounts, unread := c.accounts()
	if len(unread) > 0 {
		fail(w, 503, "native_unavailable")
		return
	}
	if len(accounts) > 64 {
		accounts = accounts[:64]
	}
	view.Accounts = make([]Account, len(accounts))
	var wg sync.WaitGroup
	slots := make(chan struct{}, 4)
	for i, a := range accounts {
		wg.Add(1)
		go func() {
			defer wg.Done()
			slots <- struct{}{}
			defer func() { <-slots }()
			view.Accounts[i] = c.check(r.Context(), a.entry, a.address)
		}()
	}
	wg.Wait()
	view.Skill = skillState(c.env.Home, skillAccounts(c.env, accounts))
	reply(w, view)
}

type accountRequest struct {
	Action            string   `json:"action"`
	Provider          Provider `json:"provider"`
	Address           string   `json:"address"`
	Server            string   `json:"server"`
	Port              int      `json:"port"`
	Security          string   `json:"security"`
	Username          string   `json:"username"`
	Password          string   `json:"password"`
	SMTPServer        string   `json:"smtp_server"`
	SMTPPort          int      `json:"smtp_port"`
	SMTPSecurity      string   `json:"smtp_security"`
	URL               string   `json:"url"`
	DeleteDirectories *bool    `json:"delete_directories"`
}

type changeView struct {
	SchemaVersion      int        `json:"schema_version"`
	Account            *Account   `json:"account,omitempty"`
	Removed            *removed   `json:"removed,omitempty"`
	KeptDirectories    []string   `json:"kept_directories,omitempty"`
	TrashedDirectories []string   `json:"trashed_directories,omitempty"`
	Skill              SkillState `json:"skill"`
}

type removed struct {
	Provider Provider `json:"provider"`
	Address  string   `json:"address"`
}

func (c *Catalog) accountsRequest(w http.ResponseWriter, r *http.Request) {
	var in accountRequest
	if (r.Method != http.MethodPost && r.Method != http.MethodDelete) || decode(r, &in, 8192) != nil || !ValidAddress(in.Address) {
		fail(w, 400, "invalid_request")
		return
	}
	e := c.entry(in.Provider)
	if e == nil {
		fail(w, 400, "invalid_request")
		return
	}
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(45 * time.Second))
	switch {
	case r.Method == http.MethodPost && in.Action == "connect" && in.DeleteDirectories == nil:
		pe, ok := e.(PasswordEntry)
		account := PasswordAccount{Address: in.Address, Server: in.Server, Port: in.Port, Security: in.Security, Username: in.Username, Password: in.Password, SMTPServer: in.SMTPServer, SMTPPort: in.SMTPPort, SMTPSecurity: in.SMTPSecurity, URL: in.URL}
		if !ok || !pe.ValidAccount(account) {
			fail(w, 400, "invalid_request")
			return
		}
		if !e.Available(c.env) {
			fail(w, 409, "provider_unavailable")
			return
		}
		// A first cloud import can take hours. Never queue a browser write
		// behind it and execute that write after the caller has timed out.
		if !c.write.TryLock() {
			fail(w, 503, "native_unavailable")
			return
		}
		err := pe.Connect(r.Context(), c.env, account)
		c.finishPassword(w, r, e, in.Address, err)
	case r.Method == http.MethodPost && in.Action == "password" && in.DeleteDirectories == nil && in.Server == "" && in.Port == 0 && in.Security == "" && in.Username == "" && in.SMTPServer == "" && in.SMTPPort == 0 && in.SMTPSecurity == "" && in.URL == "":
		pe, ok := e.(PasswordEntry)
		if !ok || !printableCredential(in.Password, 1024) {
			fail(w, 400, "invalid_request")
			return
		}
		if !e.Available(c.env) {
			fail(w, 409, "provider_unavailable")
			return
		}
		// A first cloud import can take hours. Never queue a browser write
		// behind it and execute that write after the caller has timed out.
		if !c.write.TryLock() {
			fail(w, 503, "native_unavailable")
			return
		}
		err := pe.ChangePassword(r.Context(), c.env, in.Address, in.Password)
		c.finishPassword(w, r, e, in.Address, err)
	case r.Method == http.MethodDelete && in.Action == "remove" && in.DeleteDirectories != nil && in.Server == "" && in.Port == 0 && in.Security == "" && in.Username == "" && in.SMTPServer == "" && in.SMTPPort == 0 && in.SMTPSecurity == "" && in.URL == "" && in.Password == "":
		c.remove(w, r, e, in.Address, *in.DeleteDirectories)
	default:
		fail(w, 400, "invalid_request")
	}
}

// finishPassword answers a connect or password change; the caller holds
// c.write. A refused sign-in wrote nothing, which the fixed code says.
func (c *Catalog) finishPassword(w http.ResponseWriter, r *http.Request, e Entry, address string, err error) {
	if err != nil {
		c.write.Unlock()
		var f Failure
		switch {
		case errors.As(err, &f) && (f == CredentialsRejected || f == ServerUnreachable || f == EndpointRejected):
			fail(w, 422, string(f))
		case errors.As(err, &f) && (f == AccountExists || f == AccountMissing):
			fail(w, 409, string(f))
		default:
			c.log.Warn("integration_connect", "provider", string(e.Provider()), "outcome", "failed", "reason", "native_failure")
			fail(w, 503, "native_unavailable")
		}
		return
	}
	skill := c.reconcile()
	c.write.Unlock()
	c.log.Info("integration_connect", "provider", string(e.Provider()), "outcome", "connected")
	account := c.check(r.Context(), e, address)
	reply(w, changeView{SchemaVersion: 1, Account: &account, Skill: skill})
}

// remove deletes the tool's login and configuration, stops sync and moves
// the synced directories to the Trash only when the person asked. The grant
// at the provider is not revoked; the page says so.
func (c *Catalog) remove(w http.ResponseWriter, r *http.Request, e Entry, address string, deleteDirectories bool) {
	// A first cloud import can take hours. Never queue a browser write
	// behind it and execute that write after the caller has timed out.
	if !c.write.TryLock() {
		fail(w, 503, "native_unavailable")
		return
	}
	defer c.write.Unlock()
	switch exists, err := c.has(e, address); {
	case err != nil:
		fail(w, 503, "native_unavailable")
		return
	case !exists:
		fail(w, 409, string(AccountMissing))
		return
	}
	c.abandonFor(e.Provider(), address)
	var dirs []SyncDirectory
	if s, ok := e.(SyncEntry); ok {
		dirs = s.Directories(c.env, address)
	}
	c.sync.stop(key{e.Provider(), address})
	if err := e.Remove(r.Context(), c.env, address); err != nil {
		c.reconcile()
		c.log.Warn("integration_remove", "provider", string(e.Provider()), "outcome", "failed", "reason", "native_failure")
		fail(w, 503, "native_unavailable")
		return
	}
	// Sync stops before its directory moves, so the client never sees its
	// tree vanish and propagates that as a mass deletion.
	skill := c.reconcile()
	view := changeView{SchemaVersion: 1, Removed: &removed{e.Provider(), address}, Skill: skill}
	for _, d := range dirs {
		// Only whether the folder is there decides what the reply says; the
		// move itself never follows a link or crosses a filesystem.
		if st, err := os.Lstat(filepath.Join(c.env.Home, d.Path)); err != nil || !st.IsDir() {
			continue
		}
		if deleteDirectories && c.trash(d.Path) == nil {
			view.TrashedDirectories = append(view.TrashedDirectories, "~/"+d.Path)
		} else {
			view.KeptDirectories = append(view.KeptDirectories, "~/"+d.Path)
		}
	}
	c.log.Info("integration_remove", "provider", string(e.Provider()), "outcome", "removed")
	reply(w, view)
}

type loginRequest struct {
	Action      string   `json:"action"`
	Provider    Provider `json:"provider"`
	Address     string   `json:"address"`
	AttemptID   string   `json:"attempt_id"`
	RedirectURL string   `json:"redirect_url"`
	Folders     []string `json:"folders"`
}

var attemptID = regexp.MustCompile(`^[0-9]{8}T[0-9]{6}\.[0-9]{9}$`)
var folderID = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

func (c *Catalog) loginRequest(w http.ResponseWriter, r *http.Request) {
	owners := r.Header.Values("X-Agent-Host-Session")
	if len(owners) != 1 || !sessionOwner.MatchString(owners[0]) {
		fail(w, 403, "cross_user_denied")
		return
	}
	owner := owners[0]
	if r.Method == http.MethodGet {
		if r.ContentLength > 0 || len(r.TransferEncoding) > 0 {
			fail(w, 400, "invalid_request")
			return
		}
		reply(w, c.relay.view(owner, c.now()))
		return
	}
	var in loginRequest
	if decode(r, &in, 8192) != nil {
		fail(w, 400, "invalid_request")
		return
	}
	var err error
	switch {
	case r.Method == http.MethodPost && in.Action == "start" && in.AttemptID == "" && in.RedirectURL == "" && in.Folders == nil:
		e, ok := c.entry(in.Provider).(LoginEntry)
		if !ok || (in.Address != "" && !ValidAddress(in.Address)) {
			fail(w, 400, "invalid_request")
			return
		}
		if !e.Available(c.env) {
			fail(w, 409, "provider_unavailable")
			return
		}
		if in.Address != "" {
			switch exists, err := c.has(e, in.Address); {
			case err != nil:
				fail(w, 503, "native_unavailable")
				return
			case !exists:
				fail(w, 409, string(AccountMissing))
				return
			}
		}
		err = c.startLogin(owner, e, in.Address)
	case r.Method == http.MethodPut && in.Action == "redirect" && attemptID.MatchString(in.AttemptID) && in.Provider == "" && in.Address == "" && in.Folders == nil:
		_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(45 * time.Second))
		err = c.redirect(owner, in.AttemptID, in.RedirectURL)
	case r.Method == http.MethodPut && in.Action == "folders" && attemptID.MatchString(in.AttemptID) && in.Provider == "" && in.Address == "" && in.RedirectURL == "" && validFolders(in.Folders):
		err = c.chooseFolders(owner, in.AttemptID, in.Folders)
	case r.Method == http.MethodDelete && in.Action == "cancel" && attemptID.MatchString(in.AttemptID) && in.Provider == "" && in.Address == "" && in.RedirectURL == "" && in.Folders == nil:
		err = c.cancelLogin(owner, in.AttemptID)
	default:
		fail(w, 400, "invalid_request")
		return
	}
	switch {
	case errors.Is(err, errAttemptActive):
		fail(w, 409, "attempt_active")
	case errors.Is(err, errAttemptMissing):
		fail(w, 404, "attempt_not_found")
	case errors.Is(err, errRedirectInvalid):
		fail(w, 422, "redirect_invalid")
	case errors.Is(err, errQuota):
		fail(w, 422, "quota_insufficient")
	case err != nil:
		fail(w, 400, "invalid_request")
	default:
		// The tool may print its prompt a moment after starting; a short
		// wait spares the browser one poll without holding the request.
		if r.Method == http.MethodPost || r.Method == http.MethodPut {
			c.settle(r.Context(), owner, 1500*time.Millisecond)
		}
		reply(w, c.relay.view(owner, c.now()))
	}
}

func validFolders(ids []string) bool {
	if len(ids) == 0 || len(ids) > 64 {
		return false
	}
	seen := map[string]bool{}
	for _, id := range ids {
		if !folderID.MatchString(id) || seen[id] {
			return false
		}
		seen[id] = true
	}
	return true
}

// settle waits briefly for the attempt to leave its transitional states.
func (c *Catalog) settle(ctx context.Context, owner string, limit time.Duration) {
	deadline := time.Now().Add(limit)
	for time.Now().Before(deadline) && ctx.Err() == nil {
		if s := c.relay.view(owner, c.now()).State; s != "starting" && s != "completing" {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
}

func decode(r *http.Request, target any, limit int64) error {
	if r.Header.Get("Content-Type") != "application/json" || len(r.TransferEncoding) != 0 || r.ContentLength <= 0 || r.ContentLength > limit {
		return errors.New("invalid body")
	}
	dec := json.NewDecoder(io.LimitReader(r.Body, limit+1))
	dec.DisallowUnknownFields()
	if dec.Decode(target) != nil || dec.Decode(new(any)) != io.EOF {
		return errors.New("invalid json")
	}
	return nil
}

func reply(w http.ResponseWriter, body any) {
	b, err := json.Marshal(body)
	if err != nil {
		fail(w, 503, "native_unavailable")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Length", strconv.Itoa(len(b)))
	w.WriteHeader(200)
	_, _ = w.Write(b)
}

// fail answers with the daemon's fixed error shape; native text never
// reaches it.
func fail(w http.ResponseWriter, status int, code string) {
	b, _ := json.Marshal(map[string]any{"schema_version": 1, "error": map[string]any{"code": code, "message": "Request could not be completed", "retryable": false, "correlation_id": "req_00000000"}})
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Length", strconv.Itoa(len(b)))
	w.WriteHeader(status)
	_, _ = w.Write(b)
}
