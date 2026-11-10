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
	"sync"
	"sync/atomic"
	"time"

	"github.com/open-habitat/open-habitat/internal/udssecure"
)

// Giving the site AI key to people who joined before it existed, and
// replacing every copy of an earlier key when it changes (ADR 0030; Jari,
// 2026-10-24). The write happens only in the person's own daemon, as their
// Unix user, which decides under Pi's own file lock: it writes where Pi has
// no entry for the provider or exactly a copy the site gave earlier, and
// never over the person's own key or subscription. The gateway reaches that
// daemon as it reaches any bound person's, through the broker's authorize
// route, after its own administrator check; it reads no home and its
// request carries no identity. The administrator sees one word per person
// and never what kind of credential the person has.

// siteKeyDaemonPath is the daemon's SiteKeyPath. The gateway never proxies
// it from a browser.
const siteKeyDaemonPath = "/internal/v1/pi/site-key"

// siteKeyDaemonDeadline bounds one daemon call: the daemon runs native Pi,
// possibly waiting for Pi's lock.
const siteKeyDaemonDeadline = 20 * time.Second

var (
	errSubjectUnavailable = &OnboardingError{"subject_unavailable"}
	errSiteKeyChanged     = &OnboardingError{"site_key_changed"}
	errSiteKeyBusy        = &OnboardingError{"site_key_busy"}
)

// Check states are the daemon's word, or unknown when it did not answer.
var siteKeyChecks = []string{"absent", "current", "earlier", "own", "unknown"}

// Give outcomes are the daemon's word under Pi's lock; not_reached when
// nothing was sent, unknown when the daemon did not answer and the write
// may or may not have happened.
var siteKeyGiven = []string{"seeded", "replaced", "already_current", "kept"}

// lockSiteKeyOps waits briefly for another key change to end; a long one
// (a key change replacing many copies) answers site_key_busy instead.
func (a *Auth) lockSiteKeyOps(ctx context.Context) (func(), error) {
	wait := time.NewTimer(siteKeyDaemonDeadline + 5*time.Second)
	defer wait.Stop()
	select {
	case a.siteKeyOps <- struct{}{}:
		return func() { <-a.siteKeyOps }, nil
	case <-ctx.Done():
	case <-wait.C:
	}
	return nil, errSiteKeyBusy
}

// personRoute is a joined person's daemon, from the broker's authorize
// reply as revocation and device links use it. definite is false when the
// broker did not answer, true when it refused.
func (a *Auth) personRoute(ctx context.Context, subject string) (Identity, bool, error) {
	if !canonicalSubject(subject) {
		return Identity{}, true, errSubjectUnavailable
	}
	a.mu.Lock()
	denied := a.deniedLocked(subject)
	a.mu.Unlock()
	if denied {
		return Identity{}, true, errSubjectUnavailable
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	reply, err := a.broker.Exchange(ctx, BrokerRequest{Operation: "authorize", ID: subject})
	if err != nil {
		// Only the broker's refusal is definite; anything else may be a
		// person the broker could not answer for.
		var f BrokerFailure
		return Identity{}, errors.As(err, &f) && f == BrokerDenied, errSubjectUnavailable
	}
	target, ok := brokerIdentity(subject, reply)
	if !ok {
		return Identity{}, true, errSubjectUnavailable
	}
	return target, true, nil
}

type siteKeyDaemonRequest struct {
	SchemaVersion int      `json:"schema_version"`
	Action        string   `json:"action"`
	Provider      string   `json:"provider"`
	Salt          string   `json:"salt"`
	Current       string   `json:"current,omitempty"`
	Key           string   `json:"key,omitempty"`
	Earlier       []string `json:"earlier"`
}

// errNotSent: nothing reached the daemon, so nothing was written.
var errNotSent = errors.New("site key request not sent")

// askDaemon sends one site key request to target's own daemon and returns
// its one word. errNotSent means no request left the gateway.
func (a *Auth) askDaemon(ctx context.Context, target Identity, req siteKeyDaemonRequest) (string, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return "", errNotSent
	}
	b, err := a.postDaemon(ctx, target, siteKeyDaemonPath, body)
	if err != nil {
		return "", err
	}
	var reply struct {
		SchemaVersion int    `json:"schema_version"`
		State         string `json:"state"`
		Outcome       string `json:"outcome"`
	}
	dec := json.NewDecoder(bytes.NewReader(b))
	dec.DisallowUnknownFields()
	if dec.Decode(&reply) != nil || dec.Decode(new(any)) != io.EOF || reply.SchemaVersion != 1 {
		return "", errors.New("site key reply invalid")
	}
	if req.Action == "check" && reply.Outcome == "" && slices.Contains(siteKeyChecks[:4], reply.State) {
		return reply.State, nil
	}
	if req.Action == "seed" && reply.State == "" && slices.Contains(siteKeyGiven, reply.Outcome) {
		return reply.Outcome, nil
	}
	return "", errors.New("site key reply invalid")
}

// postDaemon sends one of the gateway's own requests to target's daemon and
// returns the reply body of a 200. errNotSent means no request left the
// gateway; any other error may follow a request the daemon acted on.
func (a *Auth) postDaemon(ctx context.Context, target Identity, path string, body []byte) ([]byte, error) {
	if a.snapshotDial == nil && udssecure.Mapped(target.Socket, target.UID) != nil {
		return nil, errNotSent
	}
	ctx, cancel := context.WithTimeout(ctx, siteKeyDaemonDeadline)
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
	b, err := io.ReadAll(io.LimitReader(res.Body, 1025))
	if err != nil || len(b) > 1024 || res.StatusCode != http.StatusOK {
		return nil, errors.New("daemon reply unavailable")
	}
	return b, nil
}

// storedSiteKey is the stored key and what a daemon compares it with, or
// errSiteKeyUnavailable. caller "" is root.
func (a *Auth) storedSiteKey(caller string) (siteKeyRecord, siteKeyMaterial, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if !a.siteKeyReadyLocked() {
		return siteKeyRecord{}, siteKeyMaterial{}, ErrAdministrationState
	}
	if caller != "" && !a.isAdministratorLocked(caller) {
		return siteKeyRecord{}, siteKeyMaterial{}, errAdminDenied
	}
	if a.siteKey == nil {
		return siteKeyRecord{}, siteKeyMaterial{}, errSiteKeyUnavailable
	}
	return *a.siteKey, a.siteKeyMaterialLocked(*a.siteKey), nil
}

// checkSiteKeyFor asks the person's daemon what their Pi holds for the
// site key's provider. It writes nothing anywhere.
func (a *Auth) checkSiteKeyFor(ctx context.Context, caller, subject string) (string, error) {
	k, m, err := a.storedSiteKey(caller)
	if err != nil {
		return "", err
	}
	target, definite, err := a.personRoute(ctx, subject)
	if err != nil {
		if definite {
			return "", err
		}
		return "unknown", nil
	}
	state, err := a.askDaemon(ctx, target, siteKeyDaemonRequest{SchemaVersion: 1, Action: "check", Provider: k.Provider, Salt: m.Salt, Current: m.Current, Earlier: m.Earlier})
	if err != nil {
		state = "unknown"
	}
	a.log.Info("site_ai_key_check", "outcome", state, "actor", actorFor(caller), "subject", subject)
	return state, nil
}

// giveSiteKeyTo writes the stored key into the person's Pi through their
// daemon. expect, when given, is the key the administrator reviewed; a key
// changed meanwhile is refused. Call without the ops lock held.
func (a *Auth) giveSiteKeyTo(ctx context.Context, caller, subject string, expect *siteKeyView) (string, error) {
	unlock, err := a.lockSiteKeyOps(ctx)
	if err != nil {
		return "", err
	}
	defer unlock()
	k, m, err := a.storedSiteKey(caller)
	if err != nil {
		return "", err
	}
	if expect != nil && (expect.Provider != k.Provider || expect.Suffix != k.Key[len(k.Key)-4:] || expect.SetAt != k.SetAt) {
		return "", errSiteKeyChanged
	}
	target, definite, err := a.personRoute(ctx, subject)
	if err != nil {
		if definite {
			return "", err
		}
		return "not_reached", nil
	}
	return a.giveLocked(ctx, caller, target, k, m), nil
}

// giveLocked is one write and its record, under the ops lock.
func (a *Auth) giveLocked(ctx context.Context, caller string, target Identity, k siteKeyRecord, m siteKeyMaterial) string {
	outcome, err := a.askDaemon(ctx, target, siteKeyDaemonRequest{SchemaVersion: 1, Action: "seed", Provider: k.Provider, Salt: m.Salt, Key: k.Key, Earlier: m.Earlier})
	switch {
	case errors.Is(err, errNotSent):
		outcome = "not_reached"
	default:
		if err != nil {
			// The daemon may have written before it failed to answer, and
			// nothing is retried. The copy is recorded as given, so a later
			// key still reaches it; a give that finds the person's own
			// credential removes the record again.
			outcome = "unknown"
		}
		a.mu.Lock()
		e := a.recordCopyLocked(target.Subject, k, outcome != "kept")
		a.mu.Unlock()
		if e != nil {
			a.log.Warn("site_ai_key_copies", "outcome", "degraded", "reason", "record_failed", "subject", target.Subject)
		}
	}
	a.log.Info("site_ai_key_give", "outcome", outcome, "actor", actorFor(caller), "subject", target.Subject, "user", target.Username)
	return outcome
}

type rotationResult struct {
	Subject string `json:"subject"`
	Outcome string `json:"outcome"`
}

// replaceCopies gives the stored key to every person whose recorded copy is
// of an earlier key of the same provider, so nobody is left on an old site
// key. It runs once per change of key; a person it could not reach stays on
// the record as holding the earlier key, and the administrator can give
// them the new one. Call with the ops lock held.
func (a *Auth) replaceCopies(ctx context.Context, caller string) []rotationResult {
	k, m, err := a.storedSiteKey(caller)
	if err != nil {
		return nil
	}
	a.mu.Lock()
	holders := a.staleHoldersLocked()
	a.mu.Unlock()
	if len(holders) == 0 {
		return nil
	}
	results := make([]rotationResult, len(holders))
	var wg sync.WaitGroup
	slots := make(chan struct{}, 4)
	for i, subject := range holders {
		wg.Add(1)
		go func() {
			defer wg.Done()
			slots <- struct{}{}
			defer func() { <-slots }()
			results[i] = rotationResult{Subject: subject, Outcome: "not_reached"}
			if target, _, err := a.personRoute(ctx, subject); err == nil {
				results[i].Outcome = a.giveLocked(ctx, caller, target, k, m)
			}
		}()
	}
	wg.Wait()
	return results
}

// setSiteKeyAndReplace is set followed by replacing the copies of earlier
// keys, under one ops lock so no give hands over the key being replaced.
func (a *Auth) setSiteKeyAndReplace(ctx context.Context, caller, provider, key string) (onboardingConfig, *siteKeyView, []rotationResult, error) {
	unlock, err := a.lockSiteKeyOps(ctx)
	if err != nil {
		return onboardingConfig{}, nil, nil, err
	}
	defer unlock()
	next, k, err := a.setSiteKey(caller, provider, key, false)
	if err != nil {
		return next, k, nil, err
	}
	// The key is stored whatever happens to its copies; the browser that
	// asked may leave without the rotation ending early.
	return next, k, a.replaceCopies(context.WithoutCancel(ctx), caller), nil
}

// replacedBy is who a set of provider's key would give the new key to: the
// people whose recorded copy is of a key of that provider other than key.
func (a *Auth) replacedBy(provider, key string) []string {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.ledger.Salt == "" {
		return []string{}
	}
	fp := siteKeyFingerprint(a.ledger.Salt, key)
	out := []string{}
	for subject, c := range a.ledger.Copies {
		for _, known := range a.ledger.Keys {
			if known.Fingerprint == c.Fingerprint && known.Provider == provider && known.Fingerprint != fp {
				out = append(out, subject)
			}
		}
	}
	slices.Sort(out)
	return out
}

// copiesEntry is one joined person on the AI-avain page's Jo liittyneet
// card: who they are and what the site has given them, never what their Pi
// holds now.
type copiesEntry struct {
	ID        string    `json:"id"`
	LoginHint string    `json:"login_hint,omitempty"`
	Username  string    `json:"username,omitempty"`
	Copy      *copyView `json:"copy,omitempty"`
}
type copiesView struct {
	SchemaVersion int           `json:"schema_version"`
	SiteKey       *siteKeyView  `json:"site_key,omitempty"`
	People        []copiesEntry `json:"people"`
	// Waiting is how many allowed people have not signed in yet; they get
	// the key at their first sign-in.
	Waiting int `json:"waiting"`
}

func (a *Auth) siteKeyCopies(ctx context.Context) (copiesView, error) {
	list, err := a.accessList(ctx)
	if err != nil {
		return copiesView{}, err
	}
	v := copiesView{SchemaVersion: 1, SiteKey: a.siteKeyView(), People: []copiesEntry{}}
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, e := range list.Entries {
		switch {
		case e.Denied:
		case e.State == "joined":
			v.People = append(v.People, copiesEntry{ID: e.ID, LoginHint: e.LoginHint, Username: e.Username, Copy: a.copyViewLocked(e.ID)})
		case e.State == "allowed":
			v.Waiting++
		}
	}
	return v, nil
}

func siteKeyGiveStatus(e error) (int, string) {
	var oe *OnboardingError
	switch {
	case errors.Is(e, errBrokerRead):
		return 503, "broker_unavailable"
	case errors.As(e, &oe) && oe == errSubjectUnavailable:
		return 404, oe.Reason
	case errors.As(e, &oe) && (oe == errSiteKeyChanged || oe == errSiteKeyBusy):
		return 409, oe.Reason
	}
	return onboardingStatus(e)
}

// siteKeyCopiesHTTP is the administrator's AI-avain page beyond the key
// itself: GET …/ai-key/copies, POST …/ai-key/check {subject} and POST
// …/ai-key/seed {subject, provider, suffix, set_at}.
func (a *Auth) siteKeyCopiesHTTP(w http.ResponseWriter, r *http.Request) {
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	path := r.URL.Path
	if !a.exact(r, path) || path != siteKeyPath+"/copies" && path != siteKeyPath+"/check" && path != siteKeyPath+"/seed" {
		safe(w, 400, "invalid_request")
		return
	}
	read := path == siteKeyPath+"/copies"
	if read && r.Method != http.MethodGet || !read && r.Method != http.MethodPost {
		safe(w, 405, "method_not_allowed")
		return
	}
	if !a.administrationAvailable() {
		safe(w, 503, "administration_unavailable")
		return
	}
	if !a.isAdministrator(s.identity.Subject) {
		safe(w, 403, "admin_required")
		return
	}
	reply := func(v any) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(v)
	}
	if read {
		v, err := a.siteKeyCopies(r.Context())
		if err != nil {
			safe(w, 503, "broker_unavailable")
			return
		}
		reply(v)
		return
	}
	if reason := a.authorizeWrite(r, s); reason != "" {
		safe(w, 403, reason)
		return
	}
	if r.Header.Get("Content-Type") != "application/json" {
		safe(w, 400, "invalid_request")
		return
	}
	var body struct {
		Subject  *string `json:"subject"`
		Provider *string `json:"provider"`
		Suffix   *string `json:"suffix"`
		SetAt    *string `json:"set_at"`
	}
	dec := json.NewDecoder(io.LimitReader(r.Body, 1025))
	dec.DisallowUnknownFields()
	seed := path == siteKeyPath+"/seed"
	if dec.Decode(&body) != nil || dec.Decode(new(any)) != io.EOF || body.Subject == nil {
		safe(w, 400, "invalid_request")
		return
	}
	expected := body.Provider != nil && body.Suffix != nil && body.SetAt != nil
	if seed != expected || !seed && (body.Provider != nil || body.Suffix != nil || body.SetAt != nil) {
		safe(w, 400, "invalid_request")
		return
	}
	if !seed {
		state, err := a.checkSiteKeyFor(r.Context(), s.identity.Subject, *body.Subject)
		if err != nil {
			status, code := siteKeyGiveStatus(err)
			safe(w, status, code)
			return
		}
		reply(map[string]any{"schema_version": 1, "subject": *body.Subject, "state": state})
		return
	}
	// The write outlives a browser that leaves: an answer it never reads is
	// still the person's state, recorded here.
	outcome, err := a.giveSiteKeyTo(context.WithoutCancel(r.Context()), s.identity.Subject, *body.Subject, &siteKeyView{Provider: *body.Provider, Suffix: *body.Suffix, SetAt: *body.SetAt})
	if err != nil {
		status, code := siteKeyGiveStatus(err)
		safe(w, status, code)
		return
	}
	reply(map[string]any{"schema_version": 1, "subject": *body.Subject, "outcome": outcome})
}

// siteKeyGiveControl serves root's admin ai-key seed and the copies list.
// ai_key_seed_check is the dry run: the person's daemon is asked, nothing
// is written.
func (a *Auth) siteKeyGiveControl(ctx context.Context, payload []byte) ([]byte, error) {
	var r struct {
		Operation string  `json:"operation"`
		Subject   *string `json:"subject"`
	}
	dec := json.NewDecoder(strings.NewReader(string(payload)))
	dec.DisallowUnknownFields()
	if dec.Decode(&r) != nil || dec.Decode(new(any)) != io.EOF {
		return nil, errors.New("invalid control request")
	}
	switch r.Operation {
	case "ai_key_copies":
		if r.Subject != nil {
			break
		}
		v, err := a.siteKeyCopies(ctx)
		if err != nil {
			return nil, err
		}
		return json.Marshal(v)
	case "ai_key_seed_check":
		if r.Subject == nil {
			break
		}
		state, err := a.checkSiteKeyFor(ctx, "", *r.Subject)
		if err != nil {
			return nil, err
		}
		return json.Marshal(map[string]any{"subject": *r.Subject, "state": state, "site_key": a.siteKeyView(), "copy": a.copyView(*r.Subject)})
	case "ai_key_seed":
		if r.Subject == nil {
			break
		}
		outcome, err := a.giveSiteKeyTo(ctx, "", *r.Subject, nil)
		if err != nil {
			return nil, err
		}
		return json.Marshal(map[string]any{"subject": *r.Subject, "outcome": outcome, "site_key": a.siteKeyView()})
	}
	return nil, errors.New("invalid control request")
}
