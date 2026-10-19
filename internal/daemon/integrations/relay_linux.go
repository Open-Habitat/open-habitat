//go:build linux

package integrations

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"sync"
	"time"
)

// relay carries one tool login at a time between the person's browser and
// the tool the daemon started. It keeps only the lease: who started it, what
// the tool printed and how far it got. Tokens never pass through it; a pasted
// redirect address is handed to the waiting tool and not kept.
type relay struct {
	mu sync.Mutex
	a  *attempt
}

type attempt struct {
	owner, id string
	provider  Provider
	// address is the account being signed in again, or the one the tool
	// signed in once it finished.
	address string
	relogin bool
	state   string
	prompt  Prompt
	folders []Folder
	room    Room
	// directory is where the chosen folders will sync, home-relative.
	directory string
	failure   error
	login     Login
	cancel    context.CancelFunc
	until     time.Time
	// redirected marks that the pasted address went to the tool; a second
	// paste is refused rather than repeated.
	redirected bool
	// choose receives the person's folder choice.
	choose chan []string
	// existing are the accounts the tool held when the attempt started; an
	// abandoned or mismatched login removes only an account not among them.
	existing map[string]bool
}

// LoginView is the browser's view of the attempt; see
// contracts/v1/integration-login.schema.json.
type LoginView struct {
	SchemaVersion    int      `json:"schema_version"`
	State            string   `json:"state"`
	AttemptID        string   `json:"attempt_id,omitempty"`
	Provider         Provider `json:"provider,omitempty"`
	Address          string   `json:"address,omitempty"`
	Relogin          *bool    `json:"relogin,omitempty"`
	ExpiresAt        string   `json:"expires_at,omitempty"`
	VerificationURI  string   `json:"verification_uri,omitempty"`
	UserCode         string   `json:"user_code,omitempty"`
	AuthorizationURL string   `json:"authorization_url,omitempty"`
	RedirectPrefix   string   `json:"redirect_prefix,omitempty"`
	Folders          []folder `json:"folders,omitempty"`
	Directory        string   `json:"directory,omitempty"`
	FreeBytes        *uint64  `json:"free_bytes,omitempty"`
	QuotaBytes       uint64   `json:"quota_bytes,omitempty"`
	Failure          string   `json:"failure,omitempty"`
	ConsentURL       string   `json:"consent_url,omitempty"`
}

type folder struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Bytes     uint64 `json:"bytes"`
	Suggested bool   `json:"suggested"`
}

// loginLifetime bounds an attempt whatever the tool says: device codes live
// 15 minutes, gog's manual flow five, and the folder choice gets the rest.
const loginLifetime = 20 * time.Minute

func (r *relay) cancelAll() {
	r.mu.Lock()
	a := r.a
	r.mu.Unlock()
	if a != nil {
		a.stop()
	}
}

func (a *attempt) stop() {
	if a.cancel != nil {
		a.cancel()
	}
}

func (r *relay) view(owner string, now time.Time) LoginView {
	r.mu.Lock()
	defer r.mu.Unlock()
	a := r.a
	if a == nil || a.owner != owner {
		return LoginView{SchemaVersion: 1, State: "none"}
	}
	relogin := a.relogin
	v := LoginView{SchemaVersion: 1, State: a.state, AttemptID: a.id, Provider: a.provider, Relogin: &relogin}
	if a.address != "" && ValidAddress(a.address) {
		v.Address = a.address
	}
	switch a.state {
	case "device_code":
		v.VerificationURI, v.UserCode = a.prompt.VerificationURI, a.prompt.UserCode
		v.ExpiresAt = a.prompt.ExpiresAt.UTC().Format(time.RFC3339)
	case "open_url":
		v.AuthorizationURL, v.RedirectPrefix = a.prompt.AuthorizationURL, a.prompt.RedirectPrefix
		v.ExpiresAt = a.prompt.ExpiresAt.UTC().Format(time.RFC3339)
	case "choose_folders":
		free := a.room.Free
		v.FreeBytes, v.QuotaBytes = &free, a.room.Limit
		v.Directory = "~/" + a.directory
		v.Folders = []folder{}
		for _, f := range a.folders {
			v.Folders = append(v.Folders, folder{f.ID, f.Name, f.Bytes, f.Suggested})
		}
	case "failed":
		var consent ConsentRequired
		switch {
		case errors.As(a.failure, &consent):
			v.Failure, v.ConsentURL = "consent_required", consent.URL
		default:
			v.Failure = loginFailure(a.failure)
		}
	}
	return v
}

// loginFailure maps an entry's error to the fixed codes of the contract.
func loginFailure(err error) string {
	var f Failure
	if errors.As(err, &f) {
		switch f {
		case Expired, RedirectRejected, DeviceCodeBlocked, AccountMismatch, Cancelled:
			return string(f)
		}
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return string(Expired)
	}
	if errors.Is(err, context.Canceled) {
		return string(Cancelled)
	}
	return string(ToolFailed)
}

// validPrompt refuses what the tool printed unless it is the kind of address
// the browser may open: https for the provider's pages, and a bare loopback
// prefix for the redirect the person pastes back.
func validPrompt(kind LoginKind, p Prompt) bool {
	https := func(raw string, max int) bool {
		u, err := url.Parse(raw)
		return err == nil && len(raw) <= max && u.Scheme == "https" && u.Host != "" && u.User == nil && u.Fragment == "" && !strings.ContainsAny(raw, " \t\r\n")
	}
	if p.ExpiresAt.IsZero() {
		return false
	}
	switch kind {
	case DeviceCode:
		return https(p.VerificationURI, 2048) && p.UserCode != "" && len(p.UserCode) <= 16 && strings.Trim(p.UserCode, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-") == ""
	case PastedRedirect:
		u, err := url.Parse(p.RedirectPrefix)
		return https(p.AuthorizationURL, 4096) && err == nil && u.Scheme == "http" && (u.Hostname() == "127.0.0.1" || u.Hostname() == "localhost") && (u.Path == "" || u.Path == "/") && u.RawQuery == "" && u.User == nil
	}
	return false
}

// validRedirect admits only a loopback address that starts with the prefix
// the tool printed: the place the provider sent the person's browser after
// consent. Anything else, such as the provider's own page, is refused before
// the tool sees it.
func validRedirect(prefix, raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || len(raw) > 4096 || strings.ContainsAny(raw, " \t\r\n") || u.Scheme != "http" || u.User != nil || u.RawQuery == "" {
		return false
	}
	if u.Hostname() != "127.0.0.1" && u.Hostname() != "localhost" {
		return false
	}
	return strings.HasPrefix(raw, strings.TrimSuffix(prefix, "/"))
}

var errAttemptActive = errors.New("attempt_active")
var errAttemptMissing = errors.New("attempt_not_found")

// start begins a login for owner. Another session's live attempt is not
// replaced: the tool may be waiting on that person's provider tab.
func (c *Catalog) startLogin(owner string, e LoginEntry, address string) error {
	r := &c.relay
	r.mu.Lock()
	if a := r.a; a != nil && a.owner != owner && !finished(a.state) && c.now().Before(a.until) {
		r.mu.Unlock()
		return errAttemptActive
	}
	old := r.a
	ctx, cancel := context.WithTimeout(context.Background(), loginLifetime)
	a := &attempt{owner: owner, id: c.now().UTC().Format("20060102T150405.000000000"), provider: e.Provider(), address: address, relogin: address != "", state: "starting", cancel: cancel, until: c.now().Add(loginLifetime), choose: make(chan []string, 1), existing: map[string]bool{}}
	if list, err := e.Accounts(c.env); err == nil {
		for _, x := range list {
			a.existing[x] = true
		}
	}
	r.a = a
	r.mu.Unlock()
	if old != nil {
		old.stop()
	}
	go c.driveLogin(ctx, e, a)
	return nil
}

func finished(state string) bool { return state == "completed" || state == "failed" }

func (c *Catalog) setAttempt(a *attempt, f func()) bool {
	c.relay.mu.Lock()
	defer c.relay.mu.Unlock()
	if c.relay.a != a || finished(a.state) {
		return false
	}
	f()
	return true
}

func (c *Catalog) failAttempt(a *attempt, err error) {
	c.setAttempt(a, func() { a.state, a.failure = "failed", err })
}

// driveLogin runs the attempt to its end in the background, so the outcome
// does not depend on the browser polling or staying connected.
func (c *Catalog) driveLogin(ctx context.Context, e LoginEntry, a *attempt) {
	defer a.stop()
	login, err := e.StartLogin(ctx, c.env, a.address)
	if err != nil {
		c.failAttempt(a, err)
		return
	}
	defer login.Cancel()
	if !c.setAttempt(a, func() { a.login = login }) {
		return
	}
	prompt, err := login.Prompt(ctx)
	if err == nil && !validPrompt(e.Login(), prompt) {
		err = ToolFailed
	}
	if err != nil {
		c.failAttempt(a, err)
		return
	}
	state := "device_code"
	if e.Login() == PastedRedirect {
		state = "open_url"
	}
	c.setAttempt(a, func() { a.state, a.prompt = state, prompt })
	// The tool's code or consent page expires; give the exchange that
	// follows a paste a moment beyond that.
	waitCtx, waitCancel := context.WithDeadline(ctx, prompt.ExpiresAt.Add(30*time.Second))
	address, err := login.Wait(waitCtx)
	waitCancel()
	if err == nil && !ValidAddress(address) {
		err = ToolFailed
	}
	if err == nil && ctx.Err() != nil {
		// Cancelled as the tool finished: keep nothing new.
		err = ctx.Err()
	}
	if err == nil && a.relogin && address != a.address {
		// The person signed in to another account than the one being
		// renewed; the person did not ask to connect that one.
		err = AccountMismatch
	}
	if err != nil {
		if address != "" && ValidAddress(address) && !a.existing[address] {
			c.discardNew(e, address)
		}
		c.failAttempt(a, err)
		return
	}
	fe, choose := e.(FolderEntry)
	if choose && !a.existing[address] {
		folders, err := fe.Folders(ctx, c.env, address)
		room := c.quota()
		if err != nil || !room.OK {
			c.discardNew(e, address)
			c.failAttempt(a, ToolFailed)
			return
		}
		dirs := fe.Directories(c.env, address)
		if len(dirs) == 0 {
			c.discardNew(e, address)
			c.failAttempt(a, ToolFailed)
			return
		}
		if !c.setAttempt(a, func() {
			a.state, a.address, a.folders, a.room, a.directory = "choose_folders", address, folders, room, dirs[0].Path
		}) {
			c.discardNew(e, address)
			return
		}
		select {
		case ids := <-a.choose:
			if err := fe.ChooseFolders(ctx, c.env, address, ids); err != nil {
				c.discardNew(e, address)
				c.failAttempt(a, ToolFailed)
				return
			}
		case <-ctx.Done():
			c.discardNew(e, address)
			c.failAttempt(a, ctx.Err())
			return
		}
	}
	c.write.Lock()
	c.reconcile()
	c.write.Unlock()
	c.setAttempt(a, func() { a.state, a.address = "completed", address })
}

// discardNew removes an account whose connection the person abandoned at the
// folder step, so a half-made connection does not linger unsynced.
func (c *Catalog) discardNew(e Entry, address string) {
	c.write.Lock()
	defer c.write.Unlock()
	_ = e.Remove(context.Background(), c.env, address)
	c.reconcile()
}

// redirect hands the pasted address to the waiting tool, once.
func (c *Catalog) redirect(owner, id, raw string) error {
	r := &c.relay
	r.mu.Lock()
	a := r.a
	if a == nil || a.owner != owner || a.id != id {
		r.mu.Unlock()
		return errAttemptMissing
	}
	if a.state != "open_url" || a.redirected || a.login == nil {
		r.mu.Unlock()
		return errAttemptActive
	}
	if !validRedirect(a.prompt.RedirectPrefix, raw) {
		r.mu.Unlock()
		return errRedirectInvalid
	}
	a.redirected = true
	a.state = "completing"
	login := a.login
	r.mu.Unlock()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := login.Redirect(ctx, raw); err != nil {
		c.failAttempt(a, RedirectRejected)
	}
	return nil
}

var errRedirectInvalid = errors.New("redirect_invalid")
var errQuota = errors.New("quota_insufficient")
var errFolders = errors.New("invalid_request")

// chooseFolders accepts the person's folder choice when it fits the room the
// home has now; the view refuses a choice that does not fit rather than
// letting sync run into a full quota.
func (c *Catalog) chooseFolders(owner, id string, ids []string) error {
	r := &c.relay
	r.mu.Lock()
	defer r.mu.Unlock()
	a := r.a
	if a == nil || a.owner != owner || a.id != id {
		return errAttemptMissing
	}
	if a.state != "choose_folders" {
		return errAttemptActive
	}
	var total uint64
	for _, want := range ids {
		found := false
		for _, f := range a.folders {
			if f.ID == want {
				total += f.Bytes
				found = true
			}
		}
		if !found {
			return errFolders
		}
	}
	if room := c.quota(); !room.OK || total > room.Free {
		return errQuota
	}
	a.state = "completing"
	a.choose <- ids
	return nil
}

// cancelLogin stops the owner's attempt. The tool is killed; nothing it had
// not finished is kept.
func (c *Catalog) cancelLogin(owner, id string) error {
	r := &c.relay
	r.mu.Lock()
	a := r.a
	if a == nil || a.owner != owner || a.id != id {
		r.mu.Unlock()
		return errAttemptMissing
	}
	if !finished(a.state) {
		a.state, a.failure = "failed", Cancelled
	}
	r.mu.Unlock()
	a.stop()
	return nil
}
