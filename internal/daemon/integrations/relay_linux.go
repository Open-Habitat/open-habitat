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

// relay carries tool logins between the person's browser and the tools the
// daemon started. It keeps only the leases: who started each, what the tool
// printed and how far it got. Tokens never pass through it; a pasted redirect
// address is handed to the waiting tool and not kept.
//
// Each provider has at most one attempt, and of the providers whose sign-in
// may copy files (copiesFiles) only one at a time: a first pass reserves the
// home's room and writes the provider's native configuration, so two of them
// would race for both. A sign-in that copies no files (Atlassian, Trello) runs beside
// them, though Pi's MCP sign-ins run one at a time: Pi keeps all their
// credentials in one file. A finished attempt stays until its provider's next start, so its
// outcome can still be read.
type relay struct {
	mu       sync.Mutex
	attempts map[Provider]*attempt
	// resume marks accounts whose interrupted first pass the daemon queued
	// or failed to resume since it started.
	resume map[key]resumeNote
	// closed is set by cancelAll at shutdown: no attempt starts after it, so
	// every login driver Stop waits for is one that cancelAll cancelled.
	closed bool
}

type attempt struct {
	owner, id string
	provider  Provider
	// address is the account being signed in again, or the one the tool
	// signed in once it finished.
	address string
	relogin bool
	// native is a new connection's name when the entry knows it before
	// consent (a Pi MCP server), so removing another connection spares it.
	native string
	// level is the account level the person chose, "" for the entry's own
	// choice (LevelEntry.StartLevelLogin).
	level Level
	// resume is the daemon's own restart of an interrupted first pass. It
	// has no owner, so no browser session sees, drives or cancels it.
	resume  bool
	state   string
	prompt  Prompt
	folders []Folder
	// measuring are the folders whose size FolderSizer is still counting.
	measuring map[string]bool
	room      Room
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
	// committing marks the native commit, which may run a level change's
	// last two-way pass: the exchange's timeout no longer applies to it.
	committing bool
	// skipped marks a folder step the person answered by leaving the files
	// out; like an initial sync, no exchange timeout applies after it.
	skipped bool
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
	// pass is set, under c.write, when a chosen first pass starts running
	// without c.write, and closed when its native work has ended.
	pass chan struct{}
}

// LoginView is the browser's view of the attempt; see
// contracts/v1/integration-login.schema.json.
type LoginView struct {
	LoginPhase       string        `json:"login_phase,omitempty"`
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
	Estimated bool    `json:"estimated,omitempty"`
	Measuring bool    `json:"measuring,omitempty"`
	Whole     bool    `json:"whole,omitempty"`
	Suggested bool    `json:"suggested"`
}

// loginLifetime bounds interactive consent and folder choice: device codes
// live 15 minutes, gog's manual flow five, and the choice gets the rest.
// An explicitly chosen initial sync may run longer, until cancelled.
const loginLifetime = 20 * time.Minute

func (r *relay) cancelAll() {
	r.mu.Lock()
	r.closed = true
	var all []*attempt
	for _, a := range r.attempts {
		all = append(all, a)
	}
	r.mu.Unlock()
	for _, a := range all {
		a.stop()
	}
}

// holds reports whether a is still its provider's attempt. The caller holds
// r.mu.
func (r *relay) holds(a *attempt) bool { return r.attempts[a.provider] == a }

// put makes a its provider's attempt. The caller holds r.mu.
func (r *relay) put(a *attempt) {
	if r.attempts == nil {
		r.attempts = map[Provider]*attempt{}
	}
	r.attempts[a.provider] = a
}

// owned finds owner's attempt by its id. The caller holds r.mu.
func (r *relay) owned(owner, id string) *attempt {
	for _, a := range r.attempts {
		if a.owner == owner && a.id == id {
			return a
		}
	}
	return nil
}

func (a *attempt) stop() {
	if a.cancel != nil {
		a.cancel()
	}
}

// view is owner's attempt for provider, or with no provider owner's latest
// attempt. Another session's attempt reads as none.
func (r *relay) view(owner string, provider Provider) LoginView {
	r.mu.Lock()
	defer r.mu.Unlock()
	var a *attempt
	if provider != "" {
		a = r.attempts[provider]
	} else {
		for _, x := range r.attempts {
			// Ids are start times in a fixed-width form, so they sort.
			if x.owner == owner && (a == nil || x.id > a.id) {
				a = x
			}
		}
	}
	if a == nil || a.owner != owner {
		return LoginView{SchemaVersion: 1, State: "none"}
	}
	relogin := a.relogin
	v := LoginView{SchemaVersion: 1, State: a.state, AttemptID: a.id, Provider: a.provider, Relogin: &relogin}
	if a.address != "" && validCatalogAddress(a.provider, a.address) && (a.state != "completing" || a.syncing) {
		v.Address = a.address
	}
	if a.state == "device_code" || (a.state == "completing" && !a.syncing) {
		v.LoginPhase = a.prompt.Flow
	}
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
			folders = append(folders, folder{f.ID, f.Name, bytes, f.Estimated && bytes != nil, a.measuring[f.ID], f.Whole, f.Suggested})
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
		case Expired, PermissionRefused, RedirectRejected, DeviceCodeBlocked, AccountMismatch, Cancelled, NothingGranted, FinalSyncFailed, RevokeFailed, AlreadyConnected:
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
	if p.Completed {
		return kind == PastedRedirect
	}
	switch kind {
	case DeviceCode:
		return https(p.VerificationURI, 2048) && p.UserCode != "" && len(p.UserCode) <= 16 && strings.Trim(p.UserCode, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-") == ""
	case PastedRedirect:
		u, err := url.Parse(p.RedirectPrefix)
		return https(p.AuthorizationURL, 4096) && err == nil && u.Scheme == "http" && (u.Hostname() == "127.0.0.1" || u.Hostname() == "localhost") && (u.Path == "" || u.Path == "/" || validPiOAuthPrompt(p)) && u.RawQuery == "" && u.User == nil
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

// copiesFiles reports whether p's sign-in may end in a first pass that copies
// files into the home: a folder choice's, or Microsoft's after a level change
// (or a resumed one, which reserves the same slot).
func (c *Catalog) copiesFiles(p Provider) bool {
	switch c.entry(p).(type) {
	case FolderEntry, resumableEntry:
		return true
	}
	return false
}

// conflicting are the attempts a start for p must replace or wait for: p's
// own, and every file-copying provider's when p copies files too. The caller
// holds relay.mu.
func (c *Catalog) conflicting(p Provider) []*attempt {
	var out []*attempt
	files := c.copiesFiles(p)
	for q, a := range c.relay.attempts {
		// Pi's MCP sign-ins share Pi's one mcp-auth.json, which Pi rewrites
		// on completion; two at once could lose the other's token.
		if q == p || (files && c.copiesFiles(q)) || (piMCPOf(p) != nil && piMCPOf(q) != nil) {
			out = append(out, a)
		}
	}
	return out
}

// busy is the attempt that refuses a start for p, if any. The caller holds
// relay.mu.
func (c *Catalog) busy(owner string, p Provider) *attempt {
	for _, a := range c.conflicting(p) {
		if a.syncing && !finished(a.state) {
			return a
		}
		if a.owner != owner && !finished(a.state) && c.now().Before(a.until) {
			return a
		}
	}
	return nil
}

// start begins a login for owner. A first pass is never replaced, nor is
// another session's live attempt: the tool may be waiting on that person's
// provider tab. Owner's own earlier attempt that conflicts is replaced.
func (c *Catalog) startLogin(owner string, e LoginEntry, address string, level Level) error {
	r := &c.relay
	p := e.Provider()
	r.mu.Lock()
	if r.closed || c.busy(owner, p) != nil {
		r.mu.Unlock()
		return errAttemptActive
	}
	old := c.conflicting(p)
	r.mu.Unlock()
	// A previous attempt's worker may still be cleaning up an account it
	// created; it must finish before a successor reads or writes the tool.
	wait := time.After(15 * time.Second)
	for _, a := range old {
		a.stop()
		select {
		case <-a.done:
		case <-wait:
			return errAttemptActive
		}
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.closed {
		return errAttemptActive
	}
	// Another start or a resume may have taken the place meanwhile. A
	// finished resume clears its place itself rather than leaving its attempt.
	replaced := map[*attempt]bool{}
	for _, a := range old {
		replaced[a] = true
	}
	for _, a := range c.conflicting(p) {
		if !replaced[a] {
			return errAttemptActive
		}
	}
	for _, a := range old {
		if r.holds(a) {
			delete(r.attempts, a.provider)
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	a := &attempt{owner: owner, id: c.attemptID(), provider: p, address: address, relogin: address != "", level: level, state: "starting", cancel: cancel, until: c.now().Add(loginLifetime), choose: make(chan []string, 1), existing: map[string]bool{}, done: make(chan struct{})}
	if list, err := e.Accounts(c.env); err == nil {
		for _, x := range list {
			a.existing[x] = true
		}
	}
	r.put(a)
	c.background.Add(1)
	go func() {
		defer c.background.Done()
		c.driveLogin(ctx, e, a)
	}()
	return nil
}

// attemptID is a new attempt's id: its start time, made unique among the
// attempts the relay holds. The caller holds relay.mu.
func (c *Catalog) attemptID() string {
	t := c.now().UTC()
	for {
		id := t.Format("20060102T150405.000000000")
		taken := false
		for _, a := range c.relay.attempts {
			taken = taken || a.id == id
		}
		if !taken {
			return id
		}
		t = t.Add(time.Nanosecond)
	}
}

// abandonFor ends a live attempt that is signing in provider's address, when
// the person removes that account. The caller holds c.write, which the
// attempt's final step also takes, so the attempt cannot complete after the
// removal and bring the account back. A first pass, resumed or chosen, runs
// without c.write; abandonFor returns once its native process has exited, or
// false when it did not exit in time. That holds even when the attempt has
// already ended, since a cancellation ends it before the process exits.
func (c *Catalog) abandonFor(p Provider, address string) bool {
	c.relay.mu.Lock()
	a := c.relay.attempts[p]
	// Before identity is known, any same-provider removal could be the grant
	// the attempt is about to publish. Fence it rather than resurrect a login.
	if a == nil || a.provider != p || (a.address != "" && a.address != address) || (a.native != "" && a.native != address) {
		c.relay.mu.Unlock()
		return true
	}
	ended := a.passEnded()
	running := a.passRunning()
	if finished(a.state) && !running {
		c.relay.mu.Unlock()
		return true
	}
	if !finished(a.state) {
		a.state, a.failure = "failed", Cancelled
	}
	a.discard = true
	c.relay.mu.Unlock()
	a.stop()
	if !running {
		return true
	}
	select {
	case <-ended:
		return true
	case <-time.After(15 * time.Second):
		return false
	}
}

// passEnded is closed once the attempt's first pass, which runs without
// c.write, has ended its native work: a chosen pass closes pass and a resumed
// one done, neither taking c.write. Nil when no such pass has started.
func (a *attempt) passEnded() chan struct{} {
	if a.resume {
		return a.done
	}
	return a.pass
}

// passRunning reports whether a first pass's native work may still run,
// which can outlast the attempt's own end after a cancellation. The caller
// holds relay.mu.
func (a *attempt) passRunning() bool {
	ended := a.passEnded()
	if ended == nil {
		return false
	}
	select {
	case <-ended:
		return false
	default:
		return true
	}
}

// live reports whether the attempt still owns its outcome.
func (c *Catalog) live(a *attempt) bool {
	c.relay.mu.Lock()
	defer c.relay.mu.Unlock()
	return c.relay.holds(a) && !finished(a.state)
}

func finished(state string) bool { return state == "completed" || state == "failed" }

func (c *Catalog) setAttempt(a *attempt, f func()) bool {
	c.relay.mu.Lock()
	defer c.relay.mu.Unlock()
	if !c.relay.holds(a) || finished(a.state) {
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
		var short quotaShortfall
		if errors.As(err, &short) {
			attrs = append(attrs, "needed_bytes", short.needed, "free_bytes", short.free)
		}
		c.log.Warn("integration_login", attrs...)
	}
}

// driveLogin runs the attempt to its end in the background, so the outcome
// does not depend on the browser polling or staying connected.
func (c *Catalog) driveLogin(ctx context.Context, e LoginEntry, a *attempt) {
	defer close(a.done)
	defer a.stop()
	// A level change at a provider that revokes all of the application's
	// tokens at once ends the old grant first (revokeFirstEntry).
	if rf, ok := e.(revokeFirstEntry); ok && a.relogin && a.level != "" {
		c.write.Lock()
		if !c.live(a) {
			c.write.Unlock()
			return
		}
		c.sync.stop(key{e.Provider(), a.address})
		err := rf.endLevel(ctx, c.env, a.address, a.level)
		c.reconcile()
		c.write.Unlock()
		if err != nil {
			if !errors.Is(err, FinalSyncFailed) && !errors.Is(err, RevokeFailed) {
				err = ToolFailed
			}
			c.failAttempt(a, loginPhaseError{phase: "level_change", err: err})
			return
		}
		// The last two-way pass may have taken long; consent gets its
		// whole lifetime from here.
		c.setAttempt(a, func() { a.until = c.now().Add(loginLifetime) })
	}
	// Consent and the folder decision expire; the explicit initial sync may
	// legitimately take hours. It remains cancellable by the person or by
	// daemon shutdown, but is not killed by the login's 20-minute deadline.
	phaseCtx, phaseCancel := context.WithDeadline(ctx, a.until)
	defer phaseCancel()
	var login Login
	var err error
	if le, ok := e.(LevelEntry); ok {
		login, err = le.StartLevelLogin(phaseCtx, c.env, a.address, a.level)
	} else {
		login, err = e.StartLogin(phaseCtx, c.env, a.address)
	}
	if err != nil {
		c.failAttempt(a, err)
		return
	}
	defer login.Cancel()
	if ms, ok := login.(*microsoftLogin); ok {
		ms.log = c.log
		ms.transition("code_issued", 0, 0)
		ms.accepted = func(flow string) error {
			if !c.setAttempt(a, func() { a.state, a.prompt = "completing", Prompt{Flow: flow} }) {
				return Cancelled
			}
			return nil
		}
	}
	native := ""
	if n, ok := login.(interface{ Native() string }); ok {
		native = n.Native()
	}
	if !c.setAttempt(a, func() { a.login, a.native = login, native }) {
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
	if prompt.Completed {
		state = "completing"
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
	if err == nil && !validCatalogAddress(e.Provider(), address) {
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
		if address != "" && validCatalogAddress(e.Provider(), address) && !a.existing[address] {
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
		if !c.setAttempt(a, func() { a.committing = true }) || ctx.Err() != nil {
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
			if !errors.Is(err, FinalSyncFailed) {
				err = ToolFailed
			}
			c.failAttempt(a, loginPhaseError{phase: "native_commit", err: err})
			return
		}
		if r, ok := login.(interface{ RevokeFailed() bool }); ok && r.RevokeFailed() {
			c.log.Warn("integration_revoke", "provider", string(e.Provider()), "outcome", "failed", "reason", "previous_login_kept")
		}
	}
	// A level change that turned roots which already sync to the other
	// direction runs their first pass in the new one as this attempt's pass,
	// so their sync does not stop. Like a chosen first pass it runs without
	// c.write, and a removal of the account waits for it (abandonFor).
	if ms, ok := login.(*microsoftLogin); ok && len(ms.restart) > 0 {
		k := key{e.Provider(), address}
		c.write.Lock()
		pass := make(chan struct{})
		if !c.live(a) || !c.setAttempt(a, func() { a.state, a.address, a.syncing, a.pass = "completing", address, true, pass }) {
			c.dropStale(e, a, address)
			c.write.Unlock()
			return
		}
		c.markResume(k, 0)
		c.forgetRefusal(k)
		c.write.Unlock()
		syncCtx := context.WithValue(ctx, syncProgressKey{}, func(p SyncProgress) {
			c.setAttempt(a, func() { a.progress = &p })
		})
		// The roots' files are local, so no count is needed; the pass still
		// waits for room the home can show.
		var syncErr error
		if room := c.quota(); !room.OK {
			syncErr = errQuotaUnavailable
		} else if room.Full {
			syncErr = errQuota
		} else {
			syncErr = ms.entry.restartPasses(syncCtx, c.env, address, ms.restart)
		}
		close(pass)
		if syncErr != nil {
			c.write.Lock()
			// Only a daemon stop leaves the pass for the next start to resume.
			if !c.live(a) || ctx.Err() == nil {
				forgetInterruptedPasses(c.env, ms.entry, address)
			}
			c.reconcile()
			c.write.Unlock()
			c.failAttempt(a, syncErr)
			return
		}
		if ctx.Err() != nil {
			c.write.Lock()
			c.dropStale(e, a, address)
			c.write.Unlock()
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
		// A suggestion that does not fit the home is no suggestion: the
		// person chooses folders or leaves the files out instead.
		var suggested uint64
		for _, f := range folders {
			if f.Suggested && !f.UnknownSize {
				suggested += f.Bytes
			}
		}
		if room.OK && suggested > room.Free {
			for i := range folders {
				folders[i].Suggested = false
			}
		}
		sizer, sizes := fe.(FolderSizer)
		measuring := map[string]bool{}
		if sizes {
			for _, f := range folders {
				if f.UnknownSize || f.Estimated {
					measuring[f.ID] = true
				}
			}
		}
		if !c.setAttempt(a, func() {
			a.state, a.address, a.folders, a.room, a.directory, a.measuring = "choose_folders", address, folders, room, dirs[0].Path, measuring
		}) {
			c.discardUnfinished(e, a, address)
			return
		}
		// Sizes are counted while the person chooses. The count reads the
		// provider only and ends before the choice is applied, so it never
		// overlaps the measurement or the pass that follows.
		sizeCtx, sizeCancel := context.WithCancel(phaseCtx)
		sized := make(chan struct{})
		if sizes && len(measuring) > 0 {
			go func() {
				defer close(sized)
				sizer.SizeFolders(sizeCtx, c.env, address, func(id string, bytes uint64) {
					c.setAttempt(a, func() {
						if a.state != "choose_folders" || bytes > maxSyncBytes {
							return
						}
						for i := range a.folders {
							if a.folders[i].ID == id {
								a.folders[i].Bytes, a.folders[i].UnknownSize, a.folders[i].Estimated = bytes, false, false
								delete(a.measuring, id)
							}
						}
					})
				})
				c.setAttempt(a, func() { a.measuring = nil })
			}()
		} else {
			close(sized)
		}
		var ids []string
		var chosen bool
		select {
		case ids = <-a.choose:
			chosen = true
		case <-phaseCtx.Done():
		}
		sizeCancel()
		<-sized
		switch {
		case chosen && len(ids) == 0:
			// The person left the files out; the login and the provider's
			// other services stay. Signing in again offers the choice.
			c.write.Lock()
			if !c.live(a) || ctx.Err() != nil {
				c.dropStale(e, a, address)
				c.write.Unlock()
				return
			}
			c.forgetRefusal(key{e.Provider(), address})
			if !c.setAttempt(a, func() { a.state, a.address = "completed", address }) {
				c.dropStale(e, a, address)
				c.write.Unlock()
				return
			}
			c.reconcile()
			c.write.Unlock()
			return
		case chosen:
			// The choice is applied only while the attempt still owns its
			// outcome: a removal or a cancellation that won the race leaves
			// nothing behind.
			c.write.Lock()
			if !c.live(a) {
				c.dropStale(e, a, address)
				c.write.Unlock()
				return
			}
			// The person's own choice replaces any earlier resume outcome
			// and refusal.
			c.markResume(key{e.Provider(), address}, 0)
			c.forgetRefusal(key{e.Provider(), address})
			// The count and the copy may take hours. Like a resumed pass they
			// run without c.write, so the person's other sign-ins and
			// connections are not held behind them: reconcile leaves this
			// account's client alone while the attempt syncs, and a removal
			// of the account waits for pass (abandonFor). pass is published
			// under c.write, so a removal either sees it or finds the attempt
			// gone before the pass starts.
			pass := make(chan struct{})
			if !c.setAttempt(a, func() { a.pass = pass }) {
				c.dropStale(e, a, address)
				c.write.Unlock()
				return
			}
			c.write.Unlock()
			syncErr := c.firstPass(ctx, fe, a, address, ids)
			close(pass)
			c.write.Lock()
			if syncErr != nil {
				// Keep the native login and partial files visible after failure.
				// No automatic resync: another initial choice must be explicit.
				// Only a daemon stop (the attempt still live, its context ended)
				// leaves the pass for the daemon to resume at its next start.
				if r, ok := fe.(resumableEntry); ok && (!c.live(a) || ctx.Err() == nil) {
					forgetInterruptedPasses(c.env, r, address)
				}
				// A refusal before the copy is said again after a restart.
				c.recordRefusal(key{e.Provider(), address}, syncErr)
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
		default:
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

// firstPass counts the chosen folders afresh, checks them against the room
// the home has now and copies them. No copy is allowed until a fresh count
// and a fresh quota observation admit it: a size counted while the person
// chose may be minutes old, so a native measurer counts again; without one,
// only sizes the entry itself listed are admitted. It runs without c.write.
func (c *Catalog) firstPass(ctx context.Context, fe FolderEntry, a *attempt, address string, ids []string) error {
	syncCtx := context.WithValue(ctx, syncProgressKey{}, func(p SyncProgress) {
		c.setAttempt(a, func() { a.progress = &p })
	})
	var bytes uint64
	if measured, ok := fe.(interface {
		MeasureFolders(context.Context, Env, string, []string) (uint64, error)
	}); ok {
		var err error
		if bytes, err = measured.MeasureFolders(syncCtx, c.env, address, ids); err != nil {
			return err
		}
	} else {
		c.relay.mu.Lock()
		unknown := false
		for _, id := range ids {
			for _, f := range a.folders {
				if f.ID == id {
					unknown = unknown || f.UnknownSize || f.Estimated
					bytes += f.Bytes // chooseFolders already checked the sum's bound
				}
			}
		}
		c.relay.mu.Unlock()
		if unknown {
			return ToolFailed
		}
	}
	room := c.quota()
	if !room.OK {
		return errQuotaUnavailable
	}
	if bytes > room.Free {
		return quotaShortfall{needed: bytes, free: room.Free}
	}
	return fe.ChooseFolders(syncCtx, c.env, address, ids)
}

// dropStale removes an abandoned new login or an explicitly removed account.
// Folder approval changes cancellation to a recoverable stop: keep the native
// login and partial files instead of erasing them. The caller holds c.write.
func (c *Catalog) dropStale(e Entry, a *attempt, address string) {
	if a.discard || (!a.existing[address] && !a.syncing) {
		_ = e.Remove(context.Background(), c.env, address)
		c.forgetRefusal(key{e.Provider(), address})
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
	c.forgetRefusal(key{e.Provider(), address})
	c.reconcile()
}

// redirect hands the pasted address to the waiting tool, once.
func (c *Catalog) redirect(owner, id, raw string) error {
	r := &c.relay
	r.mu.Lock()
	a := r.owned(owner, id)
	if a == nil {
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
		if r.holds(a) && a.state == "completing" && !a.syncing && !a.committing && !a.skipped {
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

// quotaShortfall is errQuota with the counted size of a chosen first pass
// and the room it did not fit, so the refusal's log tells how much space the
// choice needed. Sizes are totals only; no file or folder name is kept.
type quotaShortfall struct{ needed, free uint64 }

func (quotaShortfall) Error() string        { return errQuota.Error() }
func (quotaShortfall) Is(target error) bool { return target == errQuota }

var errFolders = errors.New("invalid_request")

// chooseFolders accepts the person's folder choice when it fits the room the
// home has now; the view refuses a choice that does not fit rather than
// letting sync run into a full quota.
func (c *Catalog) chooseFolders(owner, id string, ids []string) error {
	r := &c.relay
	r.mu.Lock()
	defer r.mu.Unlock()
	a := r.owned(owner, id)
	if a == nil {
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
				// The whole drive already holds every other folder.
				if f.Whole && len(ids) > 1 {
					return errFolders
				}
				unknown = unknown || f.UnknownSize || f.Estimated
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

// skipFolders completes a sign-in without syncing any files, when the
// provider has other services the login serves. Nothing is copied; signing
// in again offers the folder choice.
func (c *Catalog) skipFolders(owner, id string) error {
	r := &c.relay
	r.mu.Lock()
	defer r.mu.Unlock()
	a := r.owned(owner, id)
	if a == nil {
		return errAttemptMissing
	}
	if a.state != "choose_folders" {
		return errAttemptActive
	}
	e, ok := c.entry(a.provider).(SyncEntry)
	if !ok {
		return errFolders
	}
	files := map[string]bool{}
	for _, d := range e.Directories(c.env, a.address) {
		files[d.Service] = true
	}
	other := false
	for _, s := range e.Services() {
		other = other || !files[s]
	}
	if !other {
		// Without files the login would serve nothing.
		return errFolders
	}
	if _, ready := e.SyncCommand(c.env, a.address); ready {
		// A renewal whose files already sync: leaving them out would have
		// to stop that sync, which this choice does not do.
		return errFolders
	}
	a.state, a.skipped = "completing", true
	a.choose <- []string{}
	return nil
}

// cancelLogin is an explicit stop, never a dialog dismissal during sync.
// Before folder approval nothing new is kept; afterwards native partial files
// and the login remain visible for an explicit retry or removal.
func (c *Catalog) cancelLogin(owner, id string) error {
	r := &c.relay
	r.mu.Lock()
	a := r.owned(owner, id)
	if a == nil {
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
