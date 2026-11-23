//go:build linux

package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"slices"
	"strings"
	"sync/atomic"
	"time"

	"github.com/open-habitat/open-habitat/internal/udssecure"
)

// Removing a person (ADR 0037). The gateway's part is the order and its own
// state: (1) a durable removal record and deny, and the person's sessions,
// view addresses and shares removed, as on withdrawal; (2) while the daemon
// still runs, one gateway-built request asking it to disconnect everything;
// (3) the broker schedules the removal, withdraws and closes the person out.
// Every step is repeatable, and repeating the action continues from what is
// recorded. When the broker has deleted the data and dropped the binding,
// the gateway drops what it keeps about the subject (onboarding receipt,
// designation, site key copy entry, deny) and the record itself, so a later
// admission of the same GitHub id is a new account with a new onboarding.
// The record stays only as long as the person can still be restored (Jari,
// 2026-11-21): a cancel drops it too.

// RemovalState is the broker's removal of a bound person, as an access row
// carries it.
type RemovalState struct {
	Stage, Due, Actor, At, Reason string
}

// RemovalBroker is the broker's removal surface. Both return
// ErrAccessUncertain when no definite reply arrived.
type RemovalBroker interface {
	ScheduleRemoval(ctx context.Context, id, loginHint, actor, when string) (AccessRow, error)
	CancelRemoval(ctx context.Context, id, actor string) (AccessRow, error)
}

var (
	ErrRemovalPending = errors.New("a removal is scheduled for the subject")
	ErrRemovalStarted = errors.New("the removal's data stage has begun")
	errSelfRemoval    = errors.New("an administrator cannot remove themselves")
	errLoginMismatch  = errors.New("typed login does not name the subject")
)

// Removal timings, as the broker takes them.
const (
	removalNow   = "now"
	removalGrace = "grace"
)

// removalRecord is the gateway's record of one subject's removal. It holds
// no username, path or content: who asked, when, and what the person's
// daemon answered about their services.
type removalRecord struct {
	LoginHint   string `json:"login_hint"`
	Actor       string `json:"actor"`
	ScheduledAt string `json:"scheduled_at"`
	// Disconnect is done when the daemon answered, not_reached when it did
	// not; empty until the request was made.
	Disconnect string          `json:"disconnect,omitempty"`
	Providers  []providerCount `json:"providers,omitempty"`
}

// providerCount is the daemon's count of one provider's accounts by
// outcome.
type providerCount struct {
	Provider  string `json:"provider"`
	Revoked   int    `json:"revoked"`
	LocalOnly int    `json:"local_only"`
	Failed    int    `json:"failed"`
}

// disconnectProviders are the providers a daemon may count.
var disconnectProviders = []string{"google", "microsoft", "atlassian", "trello", "imap", "caldav", "carddav", "dropbox", "gitea", "gitlab", "tailscale"}

func validRemovalRecords(m map[string]removalRecord) bool {
	if len(m) > maxDenied {
		return false
	}
	for subject, r := range m {
		if !canonicalSubject(subject) || !githubLoginName(r.LoginHint) || r.Actor != "root" && !canonicalSubject(r.Actor) || !validRFC3339(r.ScheduledAt) || r.Disconnect != "" && r.Disconnect != "done" && r.Disconnect != "not_reached" || len(r.Providers) > len(disconnectProviders) || r.Disconnect != "done" && len(r.Providers) != 0 {
			return false
		}
		seen := map[string]bool{}
		for _, p := range r.Providers {
			if !slices.Contains(disconnectProviders, p.Provider) || seen[p.Provider] || p.Revoked < 0 || p.LocalOnly < 0 || p.Failed < 0 || p.Revoked+p.LocalOnly+p.Failed > 1024 {
				return false
			}
			seen[p.Provider] = true
		}
	}
	return true
}

func (a *Auth) removalBroker() (RemovalBroker, bool) {
	b, ok := a.broker.(RemovalBroker)
	return b, ok
}

// removalView is what the access list says about a subject's removal.
type removalView struct {
	Stage      string          `json:"stage"`
	Due        string          `json:"due"`
	Actor      string          `json:"actor"`
	At         string          `json:"at"`
	Reason     string          `json:"reason,omitempty"`
	Disconnect string          `json:"disconnect,omitempty"`
	Providers  []providerCount `json:"providers,omitempty"`
}

// removalViewOf joins the broker's removal with the gateway's record. The
// broker's closing and closed are one stage to an administrator: scheduled.
func removalViewOf(r *RemovalState, rec *removalRecord) *removalView {
	if r == nil {
		return nil
	}
	stage := "scheduled"
	if r.Stage == "removing" {
		stage = "removing"
	}
	v := &removalView{Stage: stage, Due: r.Due, Actor: r.Actor, At: r.At, Reason: r.Reason}
	if rec != nil {
		v.Disconnect = rec.Disconnect
		v.Providers = append([]providerCount{}, rec.Providers...)
	}
	return v
}

// removePerson schedules subject's removal: when is now or grace. login is
// the GitHub login the administrator typed, checked again here against the
// subject. caller is the administrator's subject, or empty for root.
func (a *Auth) removePerson(ctx context.Context, caller, subject, login, when string) (AccessRow, error) {
	if !canonicalSubject(subject) || when != removalNow && when != removalGrace || !githubLoginName(login) {
		return AccessRow{}, errors.New("invalid removal request")
	}
	access, ok := a.accessBroker()
	removal, ok2 := a.removalBroker()
	if !ok || !ok2 {
		return AccessRow{}, errBrokerRead
	}
	a.accessMu.Lock()
	defer a.accessMu.Unlock()
	if caller != "" && !a.isAdministrator(caller) {
		return AccessRow{}, errAdminDenied
	}
	if caller == subject {
		return AccessRow{}, errSelfRemoval
	}
	// A role root's site.json gives is root's to end first.
	if role := roleFor(a.settingsView(), subject); role != nil && role.Source == "operator" {
		return AccessRow{}, ErrOperatorOwned
	}
	page, err := access.AccessRead(ctx, subject)
	if err != nil {
		return AccessRow{}, errBrokerRead
	}
	if page.Mode == "any" {
		return AccessRow{}, ErrAccessOpen
	}
	var current *AccessRow
	if len(page.Rows) == 1 {
		current = &page.Rows[0]
	}
	if current != nil && current.Source == "operator" {
		return AccessRow{}, ErrOperatorOwned
	}
	a.mu.Lock()
	rec, recorded := a.settings.Removals[subject]
	a.mu.Unlock()
	hint, err := a.confirmLogin(ctx, subject, login, current, rec, recorded)
	if err != nil {
		return AccessRow{}, err
	}
	// (1) the record, the deny and the sessions under one lock.
	a.mu.Lock()
	if caller != "" && !a.isAdministratorLocked(caller) {
		a.mu.Unlock()
		return AccessRow{}, errAdminDenied
	}
	next := a.settings
	next.Removals = cloneRemovals(a.settings.Removals)
	if !recorded {
		rec = removalRecord{LoginHint: hint, Actor: actorFor(caller), ScheduledAt: a.now().UTC().Format(time.RFC3339)}
		next.Removals[subject] = rec
	}
	if !slices.Contains(next.Denied, subject) {
		next.Denied = append(append([]string{}, next.Denied...), subject)
		slices.Sort(next.Denied)
	}
	if err := a.commitAdministration(next); err != nil {
		a.mu.Unlock()
		return AccessRow{}, err
	}
	removed, err := a.revokeSessionsLocked(subject)
	a.mu.Unlock()
	if err != nil {
		return AccessRow{}, ErrAccessUncertain
	}
	a.log.Info("person_removal", "outcome", "accepted", "reason", "denied", "subject", subject, "sessions_removed", removed)
	// (2) the daemon disconnects the person's services, once.
	if rec.Disconnect == "" {
		rec.Disconnect, rec.Providers = a.disconnectAll(ctx, subject)
		a.mu.Lock()
		if _, still := a.settings.Removals[subject]; still {
			next := a.settings
			next.Removals = cloneRemovals(a.settings.Removals)
			next.Removals[subject] = rec
			err = a.commitAdministration(next)
		}
		a.mu.Unlock()
		if err != nil {
			return AccessRow{}, ErrAccessUncertain
		}
		a.log.Info("person_removal", "outcome", rec.Disconnect, "reason", "services_disconnected", "subject", subject)
	}
	// (3) the broker schedules, withdraws and closes the person out.
	row, err := removal.ScheduleRemoval(ctx, subject, hint, actorFor(caller), when)
	switch {
	case err == nil:
	case errors.Is(err, ErrAccessUncertain):
		a.log.Warn("person_removal", "outcome", "uncertain", "reason", "broker_reply_missing", "subject", subject)
		return AccessRow{}, ErrAccessUncertain
	default:
		// A definite refusal scheduled nothing. Access stays withdrawn at
		// the gateway only if the broker had withdrawn it before.
		a.mu.Lock()
		next := a.settings
		next.Removals = cloneRemovals(a.settings.Removals)
		delete(next.Removals, subject)
		if current == nil || current.State != "withdrawn" {
			next.Denied = slices.DeleteFunc(append([]string{}, next.Denied...), func(id string) bool { return id == subject })
		}
		cerr := a.commitAdministration(next)
		a.mu.Unlock()
		if cerr != nil {
			return AccessRow{}, ErrAccessUncertain
		}
		return AccessRow{}, err
	}
	if row.State == "removed" {
		// Nothing was bound: there is nothing to wait for.
		if err := a.completeRemoval(subject); err != nil {
			return AccessRow{}, ErrAccessUncertain
		}
	}
	a.log.Info("person_removal", "outcome", "accepted", "reason", "scheduled", "subject", subject, "when", when)
	return row, nil
}

// confirmLogin checks the typed login against the subject: the login the
// broker or the record keeps, else GitHub's current one for the id. GitHub
// logins compare case-insensitively.
func (a *Auth) confirmLogin(ctx context.Context, subject, login string, current *AccessRow, rec removalRecord, recorded bool) (string, error) {
	hint := ""
	switch {
	case current != nil && current.LoginHint != "":
		hint = current.LoginHint
	case recorded:
		hint = rec.LoginHint
	}
	if hint != "" && strings.EqualFold(hint, login) {
		return hint, nil
	}
	directory, ok := a.directory()
	if !ok {
		if hint == "" {
			return "", ErrGitHubLookup
		}
		return "", errLoginMismatch
	}
	user, err := directory.LookupID(ctx, subject)
	if err != nil {
		if hint != "" {
			return "", errLoginMismatch
		}
		return "", err
	}
	if user.ID != subject || !strings.EqualFold(user.Login, login) {
		return "", errLoginMismatch
	}
	return user.Login, nil
}

// cancelPersonRemoval cancels a removal before its data stage. Access stays
// withdrawn; restoring it is the separate admission.
func (a *Auth) cancelPersonRemoval(ctx context.Context, caller, subject string) (AccessRow, error) {
	if !canonicalSubject(subject) {
		return AccessRow{}, errors.New("invalid subject")
	}
	removal, ok := a.removalBroker()
	if !ok {
		return AccessRow{}, errBrokerRead
	}
	a.accessMu.Lock()
	defer a.accessMu.Unlock()
	if caller != "" && !a.isAdministrator(caller) {
		return AccessRow{}, errAdminDenied
	}
	row, err := removal.CancelRemoval(ctx, subject, actorFor(caller))
	if err != nil {
		return AccessRow{}, err
	}
	a.mu.Lock()
	if _, recorded := a.settings.Removals[subject]; recorded {
		next := a.settings
		next.Removals = cloneRemovals(a.settings.Removals)
		delete(next.Removals, subject)
		err = a.commitAdministration(next)
	}
	a.mu.Unlock()
	if err != nil {
		return AccessRow{}, ErrAccessUncertain
	}
	a.log.Info("person_removal", "outcome", "accepted", "reason", "cancelled", "subject", subject)
	return row, nil
}

func cloneRemovals(m map[string]removalRecord) map[string]removalRecord {
	out := make(map[string]removalRecord, len(m)+1)
	for k, v := range m {
		out[k] = v
	}
	return out
}

// completeRemoval drops what the gateway keeps about a subject whose data
// the broker has removed: the onboarding receipt, an administrator
// designation, the site key copy entry, the deny and the removal record.
func (a *Auth) completeRemoval(subject string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if !a.administrationHealthy() {
		return ErrAdministrationState
	}
	if _, had := a.ledger.Copies[subject]; had {
		next, err := a.ledgerBaseLocked()
		if err != nil {
			return err
		}
		delete(next.Copies, subject)
		if err := a.commitLedgerLocked(next); err != nil {
			return err
		}
	}
	next := a.settings
	next.Removals = cloneRemovals(a.settings.Removals)
	delete(next.Removals, subject)
	if len(next.Removals) == 0 {
		next.Removals = nil
	}
	next.Denied = slices.DeleteFunc(append([]string{}, next.Denied...), func(id string) bool { return id == subject })
	if len(next.Denied) == 0 {
		next.Denied = nil
	}
	if _, ok := next.OnboardingReceipts[subject]; ok {
		receipts := make(map[string]onboardingReceipt, len(next.OnboardingReceipts))
		for k, v := range next.OnboardingReceipts {
			if k != subject {
				receipts[k] = v
			}
		}
		if len(receipts) == 0 {
			receipts = nil
		}
		next.OnboardingReceipts = receipts
	}
	next.Designated = slices.DeleteFunc(append([]designation{}, next.Designated...), func(d designation) bool { return d.ID == subject })
	if len(next.Designated) == 0 {
		next.Designated = nil
	}
	designated := slices.ContainsFunc(a.settings.Designated, func(d designation) bool { return d.ID == subject })
	if designated {
		next.Administrators = slices.DeleteFunc(append([]string{}, next.Administrators...), func(id string) bool { return id == subject })
	}
	if err := a.commitAdministration(next); err != nil {
		return err
	}
	a.log.Info("person_removal", "outcome", "completed", "reason", "data_removed", "subject", subject)
	return nil
}

// settleRemoval finishes the gateway's part of subject's removal once the
// broker shows it done: a bound row without a removal is a cancelled one
// (root's or lost reply), an unbound or absent row a completed one. A row
// still under removal, or no definite read, changes nothing.
func (a *Auth) settleRemoval(row *AccessRow, subject string) {
	a.mu.Lock()
	_, recorded := a.settings.Removals[subject]
	a.mu.Unlock()
	if !recorded || row != nil && row.Removal != nil {
		return
	}
	if row != nil && row.Username != "" {
		a.mu.Lock()
		next := a.settings
		next.Removals = cloneRemovals(a.settings.Removals)
		delete(next.Removals, subject)
		if len(next.Removals) == 0 {
			next.Removals = nil
		}
		_ = a.commitAdministration(next)
		a.mu.Unlock()
		return
	}
	_ = a.completeRemoval(subject)
}

// settleRemovalOf reads subject's broker row and settles its removal; the
// sign-in and admission call it before they rely on the deny or receipt.
func (a *Auth) settleRemovalOf(ctx context.Context, subject string) {
	a.mu.Lock()
	_, recorded := a.settings.Removals[subject]
	a.mu.Unlock()
	if !recorded {
		return
	}
	access, ok := a.accessBroker()
	if !ok {
		return
	}
	page, err := access.AccessRead(ctx, subject)
	if err != nil || len(page.Rows) > 1 {
		return
	}
	var row *AccessRow
	if len(page.Rows) == 1 {
		row = &page.Rows[0]
	}
	a.settleRemoval(row, subject)
}

// disconnectAllPath is the daemon's DisconnectAllPath. The gateway never
// proxies it from a browser.
const disconnectAllPath = "/internal/v1/account/disconnect-all"

// disconnectAllDeadline bounds the daemon call; the daemon bounds its own
// work a little below it.
const disconnectAllDeadline = 110 * time.Second

// disconnectAll asks subject's own daemon to disconnect everything. The
// route is the broker's authorize answer for the binding, which the
// gateway's own deny does not affect; a daemon that does not answer, or a
// person the broker no longer routes (already withdrawn), is not_reached:
// their tokens are deleted with the home.
func (a *Auth) disconnectAll(ctx context.Context, subject string) (string, []providerCount) {
	authorize, cancel := context.WithTimeout(ctx, 10*time.Second)
	reply, err := a.broker.Exchange(authorize, BrokerRequest{Operation: "authorize", ID: subject})
	cancel()
	if err != nil {
		return "not_reached", nil
	}
	target, ok := brokerIdentity(subject, reply)
	if !ok {
		return "not_reached", nil
	}
	b, err := a.postDaemonLong(ctx, target, disconnectAllPath, []byte(`{"schema_version":1}`))
	if err != nil {
		return "not_reached", nil
	}
	var out struct {
		SchemaVersion int             `json:"schema_version"`
		Providers     []providerCount `json:"providers"`
	}
	dec := json.NewDecoder(bytes.NewReader(b))
	dec.DisallowUnknownFields()
	if dec.Decode(&out) != nil || dec.Decode(new(any)) != io.EOF || out.SchemaVersion != 1 || out.Providers == nil {
		return "not_reached", nil
	}
	check := removalRecord{LoginHint: "x", Actor: "root", ScheduledAt: "2000-01-01T00:00:00Z", Disconnect: "done", Providers: out.Providers}
	if !validRemovalRecords(map[string]removalRecord{"1": check}) {
		return "not_reached", nil
	}
	return "done", out.Providers
}

// postDaemonLong is postDaemon with the disconnect's deadline and a reply
// large enough for every provider's counts.
func (a *Auth) postDaemonLong(ctx context.Context, target Identity, path string, body []byte) ([]byte, error) {
	if a.snapshotDial == nil && udssecure.Mapped(target.Socket, target.UID) != nil {
		return nil, errNotSent
	}
	ctx, cancel := context.WithTimeout(ctx, disconnectAllDeadline)
	defer cancel()
	var dialed atomic.Bool
	transport := &http.Transport{
		MaxResponseHeaderBytes: 16 << 10,
		DisableKeepAlives:      true,
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			conn, err := a.dialDaemon(ctx, target)
			dialed.Store(err == nil)
			return conn, err
		},
	}
	defer transport.CloseIdleConnections()
	r, err := http.NewRequestWithContext(ctx, http.MethodPost, "http://unix"+path, bytes.NewReader(body))
	if err != nil {
		return nil, errNotSent
	}
	r.Header.Set("Content-Type", "application/json")
	res, err := transport.RoundTrip(r)
	if err != nil {
		if !dialed.Load() {
			return nil, errNotSent
		}
		return nil, err
	}
	defer res.Body.Close()
	b, err := io.ReadAll(io.LimitReader(res.Body, 4097))
	if err != nil || len(b) > 4096 || res.StatusCode != http.StatusOK {
		return nil, errors.New("daemon reply unavailable")
	}
	return b, nil
}
