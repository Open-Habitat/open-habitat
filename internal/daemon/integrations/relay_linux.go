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
	address          string
	relogin          bool
	state            string
	prompt           Prompt
	folders          []Folder
	unavailableSites []string
	room             Room
	// directory is where the chosen folders will sync, home-relative.
	directory string
	// syncing distinguishes the first native pass from a redirect exchange.
	// A renewal already has an address before the exchange finishes.
	syncing  bool
	progress *SyncProgress
	failure  error
	login    Login
	cancel   context.CancelFunc
	until    time.Time
	// redirected marks that the pasted address went to the tool; a second
	// paste is refused rather than repeated.
	redirected bool
	// choose receives the person's folder choice.
	choose chan []string
	// existing are the accounts the tool held when the attempt started; an
	// abandoned or mismatched login removes only an account not among them.
	existing map[string]bool
	// discard is set when the person removed the account this attempt was
	// signing in: whatever the tool still writes is removed, not kept.
	discard bool
	// done is closed when the attempt's worker has finished, cleanup
	// included; a successor starts only after it.
	done chan struct{}
}

// LoginView is the browser's view of the attempt; see
// contracts/v1/integration-login.schema.json.
type LoginView struct {
	LoginPhase       string        `json:"login_phase,omitempty"`
	UnavailableSites []string      `json:"unavailable_sites,omitempty"`
	SchemaVersion    int           `json:"schema_version"`
	State            string        `json:"state"`
	AttemptID        string        `json:"attempt_id,omitempty"`
	Provider         Provider      `json:"provider,omitempty"`
	Address          string        `json:"address,omitempty"`
	Relogin          *bool         `json:"relogin,omitempty"`
	ExpiresAt        string        `json:"expires_at,omitempty"`
	VerificationURI  string        `json:"verification_uri,omitempty"`
	UserCode         string        `json:"user_code,omitempty"`
	AuthorizationURL string        `json:"authorization_url,omitempty"`
	RedirectPrefix   string        `json:"redirect_prefix,omitempty"`
	Folders          *[]folder     `json:"folders,omitempty"`
	Directory        string        `json:"directory,omitempty"`
	FreeBytes        *uint64       `json:"free_bytes,omitempty"`
	QuotaBytes       uint64        `json:"quota_bytes,omitempty"`
	Failure          string        `json:"failure,omitempty"`
	Progress         *SyncProgress `json:"progress,omitempty"`
	ConsentURL       string        `json:"consent_url,omitempty"`
}

type folder struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Bytes     *uint64 `json:"bytes,omitempty"`
	Suggested bool    `json:"suggested"`
}

// loginLifetime bounds interactive consent and folder choice: device codes
// live 15 minutes, gog's manual flow five, and the choice gets the rest.
// An explicitly chosen initial sync may run longer, until cancelled.
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
	if a.address != "" && ValidAddress(a.address) && (a.state != "completing" || a.syncing) {
		v.Address = a.address
	}
	if a.state == "device_code" || (a.state == "completing" && !a.syncing) {
		v.LoginPhase = a.prompt.Flow
	}
	v.UnavailableSites = a.unavailableSites
	if a.syncing {
		v.Progress = a.progress
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
		if a.room.OK {
			v.FreeBytes, v.QuotaBytes = &free, a.room.Limit
		}
		v.Directory = "~/" + a.directory
		folders := []folder{}
		for _, f := range a.folders {
			var bytes *uint64
			if !f.UnknownSize {
				n := f.Bytes
				bytes = &n
			}
			folders = append(folders, folder{f.ID, f.Name, bytes, f.Suggested})
		}
		v.Folders = &folders
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
	if errors.Is(err, errQuota) {
		return "quota_insufficient"
	}
	if errors.Is(err, errQuotaUnavailable) {
		return "quota_unavailable"
	}
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
	if a := r.a; a != nil && a.syncing && !finished(a.state) {
		r.mu.Unlock()
		return errAttemptActive
	}
	if a := r.a; a != nil && a.owner != owner && !finished(a.state) && c.now().Before(a.until) {
		r.mu.Unlock()
		return errAttemptActive
	}
	old := r.a
	r.mu.Unlock()
	// The previous attempt's worker may still be cleaning up an account it
	// created; it must finish before a successor reads or writes the tool.
	if old != nil {
		old.stop()
		select {
		case <-old.done:
		case <-time.After(15 * time.Second):
			return errAttemptActive
		}
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.a != old {
		return errAttemptActive
	}
	ctx, cancel := context.WithCancel(context.Background())
	a := &attempt{owner: owner, id: c.now().UTC().Format("20060102T150405.000000000"), provider: e.Provider(), address: address, relogin: address != "", state: "starting", cancel: cancel, until: c.now().Add(loginLifetime), choose: make(chan []string, 1), existing: map[string]bool{}, done: make(chan struct{})}
	if list, err := e.Accounts(c.env); err == nil {
		for _, x := range list {
			a.existing[x] = true
		}
	}
	r.a = a
	go c.driveLogin(ctx, e, a)
	return nil
}

// abandonFor ends a live attempt that is signing in provider's address, when
// the person removes that account. The caller holds c.write, which the
// attempt's final step also takes, so the attempt cannot complete after the
// removal and bring the account back.
func (c *Catalog) abandonFor(p Provider, address string) {
	c.relay.mu.Lock()
	a := c.relay.a
	// Before identity is known, any same-provider removal could be the grant
	// the attempt is about to publish. Fence it rather than resurrect a login.
	if a == nil || a.provider != p || (a.address != "" && a.address != address) || finished(a.state) {
		c.relay.mu.Unlock()
		return
	}
	a.state, a.failure, a.discard = "failed", Cancelled, true
	c.relay.mu.Unlock()
	a.stop()
}

// live reports whether the attempt still owns its outcome.
func (c *Catalog) live(a *attempt) bool {
	c.relay.mu.Lock()
	defer c.relay.mu.Unlock()
	return c.relay.a == a && !finished(a.state)
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

// loginPhaseError carries only a product-defined phase; native text stays private.
type loginPhaseError struct {
	phase string
	err   error
}

func (e loginPhaseError) Error() string { return string(ToolFailed) }
func (e loginPhaseError) Unwrap() error { return e.err }

func (c *Catalog) failAttempt(a *attempt, err error) {
	if c.setAttempt(a, func() { a.state, a.failure = "failed", err }) {
		phase := "login"
		var detail loginPhaseError
		if errors.As(err, &detail) {
			phase = detail.phase
		}
		attrs := []any{"provider", string(a.provider), "outcome", "failed", "phase", phase, "reason", loginFailure(err)}
		var discovery microsoftDiscoveryError
		if errors.As(err, &discovery) {
			attrs = append(attrs, discovery.diagnostic()...)
		}
		c.log.Warn("integration_login", attrs...)
	}
}

// driveLogin runs the attempt to its end in the background, so the outcome
// does not depend on the browser polling or staying connected.
func (c *Catalog) driveLogin(ctx context.Context, e LoginEntry, a *attempt) {
	defer close(a.done)
	defer a.stop()
	// Consent and the folder decision expire; the explicit initial sync may
	// legitimately take hours. It remains cancellable by the person or by
	// daemon shutdown, but is not killed by the login's 20-minute deadline.
	phaseCtx, phaseCancel := context.WithDeadline(ctx, a.until)
	defer phaseCancel()
	login, err := e.StartLogin(phaseCtx, c.env, a.address)
	if err != nil {
		c.failAttempt(a, err)
		return
	}
	defer login.Cancel()
	if ms, ok := login.(*microsoftLogin); ok {
		ms.log = c.log
		ms.transition("files", "code_issued", 0, 0)
		ms.accepted = func(flow string) error {
			if !c.setAttempt(a, func() { a.state, a.prompt = "completing", Prompt{Flow: flow} }) {
				return Cancelled
			}
			return nil
		}
	}
	if !c.setAttempt(a, func() { a.login = login }) {
		return
	}
	prompt, err := login.Prompt(phaseCtx)
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
	waitCtx, waitCancel := context.WithDeadline(phaseCtx, prompt.ExpiresAt.Add(30*time.Second))
	var address string
	if multi, ok := login.(interface {
		WaitWithPrompt(context.Context, func(Prompt) error) (string, error)
	}); ok {
		address, err = multi.WaitWithPrompt(phaseCtx, func(p Prompt) error {
			if !validPrompt(e.Login(), p) {
				return ToolFailed
			}
			if deadline, ok := phaseCtx.Deadline(); ok && p.ExpiresAt.After(deadline) {
				p.ExpiresAt = deadline
			}
			if !c.setAttempt(a, func() { a.state, a.prompt = "device_code", p }) {
				return Cancelled
			}
			return nil
		})
	} else {
		address, err = login.Wait(waitCtx)
	}
	waitCancel()
	if ms, ok := login.(*microsoftLogin); ok {
		for _, skipped := range ms.skippedSites {
			attrs := append([]any{"provider", Microsoft, "outcome", "skipped", "reason", "site_unavailable"}, skipped.diagnostic()...)
			c.log.Warn("integration_discovery", attrs...)
		}
		c.setAttempt(a, func() { a.unavailableSites = append([]string(nil), ms.unavailableSites...) })
	}
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
	// A daemon-completed OAuth exchange commits only after identity and
	// cancellation checks, and with the native refresher stopped. Otherwise
	// rclone could write an old token over the newly accepted login.
	if store, ok := login.(interface {
		Commit(context.Context, string) error
	}); ok {
		c.write.Lock()
		if !c.live(a) || ctx.Err() != nil {
			c.write.Unlock()
			c.failAttempt(a, Cancelled)
			return
		}
		c.sync.stop(key{e.Provider(), address})
		if a.existing[address] {
			// Every exit after a native replacement (cancel, expiry, folder
			// failure included) must rederive retained sync from native state.
			defer func() { c.write.Lock(); c.reconcile(); c.write.Unlock() }()
		}
		err := store.Commit(ctx, address)
		if err != nil {
			c.reconcile()
		}
		c.write.Unlock()
		if err != nil {
			c.failAttempt(a, loginPhaseError{phase: "native_commit", err: ToolFailed})
			return
		}
	}
	fe, choose := e.(FolderEntry)
	ready := false
	if choose {
		_, ready = fe.SyncCommand(c.env, address)
	}
	// A daemon may have stopped after the tool saved a token but before
	// the first sync. Re-login must offer the missing initial choice too.
	needChoice := choose && (!a.existing[address] || !ready)
	if dynamic, ok := e.(interface {
		FolderChoiceAfterLogin(Env, string) (bool, error)
	}); ok && choose {
		needChoice, err = dynamic.FolderChoiceAfterLogin(c.env, address)
		if err != nil {
			c.discardUnfinished(e, a, address)
			c.failAttempt(a, ToolFailed)
			return
		}
	}
	if needChoice {
		listingCtx, listingCancel := context.WithTimeout(phaseCtx, c.signInWait)
		folders, err := fe.Folders(listingCtx, c.env, address)
		if errors.Is(listingCtx.Err(), context.DeadlineExceeded) {
			err = Expired
		}
		listingCancel()
		room := c.quota()
		if err != nil {
			c.discardUnfinished(e, a, address)
			c.failAttempt(a, err)
			return
		}
		dirs := fe.Directories(c.env, address)
		if len(dirs) == 0 {
			c.discardUnfinished(e, a, address)
			c.failAttempt(a, ToolFailed)
			return
		}
		if !c.setAttempt(a, func() {
			a.state, a.address, a.folders, a.room, a.directory = "choose_folders", address, folders, room, dirs[0].Path
		}) {
			c.discardUnfinished(e, a, address)
			return
		}
		select {
		case ids := <-a.choose:
			// The choice is applied under the write lock and only while the
			// attempt still owns its outcome: a removal or a cancellation
			// that won the race leaves nothing behind.
			c.write.Lock()
			if !c.live(a) {
				c.dropStale(e, a, address)
				c.write.Unlock()
				return
			}
			syncCtx := context.WithValue(ctx, syncProgressKey{}, func(p SyncProgress) {
				c.setAttempt(a, func() { a.progress = &p })
			})
			// Recursive inventory belongs to the explicitly approved background
			// pass. No copy is allowed until a fresh quota observation admits it.
			var syncErr error
			var bytes uint64
			if measured, ok := fe.(interface {
				MeasureFolders(context.Context, Env, string, []string) (uint64, error)
			}); ok {
				bytes, syncErr = measured.MeasureFolders(syncCtx, c.env, address, ids)
			} else {
				// Entries with already-known sizes still need fresh admission.
				// Unknown sizes without a native measurer must fail closed.
				for _, id := range ids {
					for _, f := range a.folders {
						if f.ID == id {
							if f.UnknownSize {
								syncErr = ToolFailed
							}
							bytes += f.Bytes // chooseFolders already checked the sum's bound
						}
					}
				}
			}
			if syncErr == nil {
				room := c.quota()
				if !room.OK {
					syncErr = errQuotaUnavailable
				} else if bytes > room.Free {
					syncErr = errQuota
				}
			}
			if syncErr == nil {
				syncErr = fe.ChooseFolders(syncCtx, c.env, address, ids)
			}
			if syncErr != nil {
				// Keep the native login and partial files visible after failure.
				// No automatic resync: another initial choice must be explicit.
				c.reconcile()
				c.write.Unlock()
				c.failAttempt(a, syncErr)
				return
			}
			if !c.live(a) || ctx.Err() != nil {
				c.dropStale(e, a, address)
				c.write.Unlock()
				return
			}
			// Publish completion before reconciliation can start an independent
			// refresher. Cancellation either wins this transition and cleans up,
			// or observes completion; it cannot report failure while keeping tokens.
			if !c.setAttempt(a, func() { a.state, a.address = "completed", address }) {
				c.dropStale(e, a, address)
				c.write.Unlock()
				return
			}
			c.reconcile()
			c.write.Unlock()
			return
		case <-phaseCtx.Done():
			c.discardUnfinished(e, a, address)
			c.failAttempt(a, phaseCtx.Err())
			return
		}
	}
	c.write.Lock()
	if !c.live(a) {
		c.dropStale(e, a, address)
		c.write.Unlock()
		return
	}
	if !c.setAttempt(a, func() { a.state, a.address = "completed", address }) {
		c.dropStale(e, a, address)
		c.write.Unlock()
		return
	}
	c.reconcile()
	c.write.Unlock()
}

// dropStale removes an abandoned new login or an explicitly removed account.
// Folder approval changes cancellation to a recoverable stop: keep the native
// login and partial files instead of erasing them. The caller holds c.write.
func (c *Catalog) dropStale(e Entry, a *attempt, address string) {
	if a.discard || (!a.existing[address] && !a.syncing) {
		_ = e.Remove(context.Background(), c.env, address)
		c.reconcile()
	}
}

// discardUnfinished preserves an existing account when an interrupted first
// sync is retried and then cancelled. Explicit removal still wins via dropStale.
func (c *Catalog) discardUnfinished(e Entry, a *attempt, address string) {
	if !a.existing[address] {
		c.discardNew(e, address)
	}
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
	// Bound the exchange AND the recursive listing that follows the paste.
	// The timer cannot interrupt a folder choice or an explicitly started sync.
	time.AfterFunc(c.signInWait, func() {
		r.mu.Lock()
		defer r.mu.Unlock()
		if r.a == a && a.state == "completing" && !a.syncing {
			a.state, a.failure = "failed", Expired
			a.stop()
			c.log.Warn("integration_login", "provider", string(a.provider), "outcome", "failed", "phase", "post_redirect", "reason", string(Expired))
		}
	})
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
var errQuotaUnavailable = errors.New("quota_unavailable")
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
	if len(ids) == 0 || len(ids) > len(a.folders) {
		return errFolders
	}
	seen := map[string]bool{}
	var total uint64
	unknown := false
	for _, want := range ids {
		if seen[want] {
			return errFolders
		}
		seen[want] = true
		found := false
		for _, f := range a.folders {
			if f.ID == want {
				unknown = unknown || f.UnknownSize
				if f.Bytes > maxSyncBytes-total {
					return errQuota
				}
				total += f.Bytes
				found = true
			}
		}
		if !found {
			return errFolders
		}
	}
	if !unknown {
		if room := c.quota(); !room.OK || total > room.Free {
			return errQuota
		}
	}
	a.state, a.syncing = "completing", true
	a.choose <- ids
	return nil
}

// cancelLogin is an explicit stop, never a dialog dismissal during sync.
// Before folder approval nothing new is kept; afterwards native partial files
// and the login remain visible for an explicit retry or removal.
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
