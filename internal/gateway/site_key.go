package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"
)

// The site AI key (ADR 0030) is the gateway's one persistent provider
// credential and the single exception to "the host keeps no credential
// store". It lives in its own gateway-UID 0600 file beside, not inside, the
// administration state, so no administration read, digest or receipt ever
// carries it. Nothing reads it back beyond provider, a four-character suffix
// and when it was set; it is never logged. It is handed over once, in the
// handoff of the login whose ensure created the binding, and the person's
// daemon writes it only where their Pi has no credential for that provider.
// The gateway never proxies use, issues per-person tokens or recalls a copy.
//
// offer is site_key exactly while a key is stored. The two records are
// separate files, so each change has one commit point and leaves only one
// kind of interrupted state: set writes the key and then the offer, delete
// writes the offer and then removes the key. A key whose offer is not
// site_key is therefore always an unfinished change that was never reported
// as done, and loading removes it.

var siteKeyProviders = []string{"openai", "anthropic", "deepseek"}

// siteKeyShape is the daemon's literal-key rule (pi_credentials_linux.go):
// Pi runs `!…` values and expands `$NAME`, so only a literal key is stored.
// Anthropic keys are sk-ant-…, which the others never are.
var siteKeyShape = regexp.MustCompile(`^sk-[A-Za-z0-9_-]{20,200}$`)

func validSiteKey(provider, key string) bool {
	if !slices.Contains(siteKeyProviders, provider) || !siteKeyShape.MatchString(key) {
		return false
	}
	return strings.HasPrefix(key, "sk-ant-") == (provider == "anthropic")
}

const maxSiteKeyFile = 1024

type siteKeyRecord struct {
	Version  int    `json:"version"`
	Provider string `json:"provider"`
	Key      string `json:"key"`
	SetAt    string `json:"set_at"`
}

// siteKeyView is all that is ever read back.
type siteKeyView struct {
	Provider string `json:"provider"`
	Suffix   string `json:"suffix"`
	SetAt    string `json:"set_at,omitempty"`
}

func (k *siteKeyRecord) view() *siteKeyView {
	if k == nil {
		return nil
	}
	return &siteKeyView{Provider: k.Provider, Suffix: k.Key[len(k.Key)-4:], SetAt: k.SetAt}
}

// SiteKeySeed is the copy the binding-creating login hands to the person's
// daemon with the token.
type SiteKeySeed struct {
	Provider, Key string
	// record is the stored key the copy is of, for the copies record.
	record siteKeyRecord
}

var errSiteKeyUnavailable = &OnboardingError{"site_key_unavailable"}

// loadSiteKey reads the key file once at startup. A file that is not the
// gateway's private record fails startup closed, like the administration
// state; a key left by an interrupted change is removed.
func (a *Auth) loadSiteKey(path string) error {
	a.siteKeyFile = path
	a.siteKey = nil
	if path == "" {
		return nil
	}
	f, e := os.Open(path)
	if os.IsNotExist(e) {
		return nil
	}
	if e != nil {
		return ErrAdministrationState
	}
	defer f.Close()
	info, e := f.Stat()
	if e != nil || !privateSessionFile(info) || info.Size() > maxSiteKeyFile {
		return ErrAdministrationState
	}
	var k siteKeyRecord
	dec := json.NewDecoder(io.LimitReader(f, maxSiteKeyFile+1))
	dec.DisallowUnknownFields()
	if dec.Decode(&k) != nil || dec.Decode(new(any)) != io.EOF || !validSiteKeyRecord(k) {
		return ErrAdministrationState
	}
	if a.onboardingLocked().AIAccount.Offer != "site_key" {
		if a.removeSiteKeyFile() != nil {
			return ErrAdministrationState
		}
		a.log.Warn("site_ai_key", "outcome", "removed", "reason", "unfinished_change")
		return nil
	}
	a.siteKey = &k
	return nil
}

func validSiteKeyRecord(k siteKeyRecord) bool {
	at, e := time.Parse(time.RFC3339, k.SetAt)
	return k.Version == 1 && validSiteKey(k.Provider, k.Key) && e == nil && at.UTC().Format(time.RFC3339) == k.SetAt
}

func (a *Auth) writeSiteKeyFile(k siteKeyRecord) error {
	b, e := json.Marshal(k)
	if e != nil {
		return e
	}
	dir := filepath.Dir(a.siteKeyFile)
	f, e := os.CreateTemp(dir, ".site-ai-key-*")
	if e != nil {
		return e
	}
	defer os.Remove(f.Name())
	if e = f.Chmod(0600); e == nil {
		_, e = f.Write(b)
	}
	if e == nil {
		e = f.Sync()
	}
	if closeErr := f.Close(); e == nil {
		e = closeErr
	}
	if e != nil {
		return e
	}
	if e = os.Rename(f.Name(), a.siteKeyFile); e != nil {
		return e
	}
	// Once renamed, the new key is the stored one even if the directory
	// sync fails.
	if syncDir(dir) != nil {
		a.log.Warn("site_ai_key", "outcome", "degraded", "reason", "directory_sync_failed")
	}
	return nil
}

func (a *Auth) removeSiteKeyFile() error {
	if e := os.Remove(a.siteKeyFile); e != nil && !os.IsNotExist(e) {
		return e
	}
	return syncDir(filepath.Dir(a.siteKeyFile))
}

func syncDir(dir string) error {
	d, e := os.Open(dir)
	if e != nil {
		return e
	}
	defer d.Close()
	return d.Sync()
}

// siteKeyReady says whether this gateway can hold a key at all: synthetic
// gateways without the file have no site key.
func (a *Auth) siteKeyReadyLocked() bool {
	return a.siteKeyFile != "" && a.adminFile != "" && a.administrationHealthy()
}

// siteKeySeed is the copy for a binding-creating login, or nil when the site
// offers none.
func (a *Auth) siteKeySeed() *SiteKeySeed {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.siteKey == nil || !a.administrationHealthy() || a.onboardingLocked().AIAccount.Offer != "site_key" {
		return nil
	}
	return &SiteKeySeed{Provider: a.siteKey.Provider, Key: a.siteKey.Key, record: *a.siteKey}
}

func (a *Auth) siteKeyView() *siteKeyView {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.siteKey.view()
}

// setSiteKey stores the key and makes offer site_key in the same operation.
// Replacing a stored key changes future seeds only. caller is the browser
// administrator, or "" for root. dry checks without writing.
func (a *Auth) setSiteKey(caller, provider, key string, dry bool) (onboardingConfig, *siteKeyView, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if !a.siteKeyReadyLocked() {
		return onboardingConfig{}, nil, ErrAdministrationState
	}
	if caller != "" && !a.isAdministratorLocked(caller) {
		return onboardingConfig{}, nil, errAdminDenied
	}
	if !validSiteKey(provider, key) {
		return onboardingConfig{}, nil, onboardingInvalid("invalid_key")
	}
	current := a.onboardingLocked()
	next := current
	next.Integrations = append([]onboardingIntegration{}, current.Integrations...)
	next.Repositories.Defaults = append([]string{}, current.Repositories.Defaults...)
	if current.AIAccount.Offer != "site_key" {
		next.Version++
		next.AIAccount.Offer = "site_key"
	}
	if dry {
		return next, &siteKeyView{Provider: provider, Suffix: key[len(key)-4:]}, nil
	}
	record := siteKeyRecord{Version: 1, Provider: provider, Key: key, SetAt: a.now().UTC().Format(time.RFC3339)}
	// The key's fingerprint is known before the key is stored, so a copy of
	// it can always be recognised later; a known key that was never stored
	// matches nobody's copy.
	if e := a.recordKeyLocked(record); e != nil {
		return onboardingConfig{}, nil, e
	}
	if e := a.writeSiteKeyFile(record); e != nil {
		return onboardingConfig{}, nil, e
	}
	if next.Version != current.Version {
		settings := a.settings
		settings.Onboarding = &next
		// A commit whose rename happened is the new record even when it
		// reports a later failure; only an offer that did not change takes
		// the key back. If removing it fails, the next start removes it.
		if e := a.commitAdministration(settings); e != nil && a.onboardingLocked().AIAccount.Offer != "site_key" {
			if a.removeSiteKeyFile() != nil {
				a.log.Warn("site_ai_key", "outcome", "degraded", "reason", "unfinished_change")
			}
			return onboardingConfig{}, nil, e
		}
	}
	a.siteKey = &record
	a.log.Info("site_ai_key", "outcome", "accepted", "reason", "set", "provider", provider, "actor", actorFor(caller))
	return next, a.siteKey.view(), nil
}

// deleteSiteKey removes the key and sets the replacement offer. Seeded people
// keep their copies; only revoking the key at the provider stops them.
func (a *Auth) deleteSiteKey(caller, offer string, dry bool) (onboardingConfig, *siteKeyView, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if !a.siteKeyReadyLocked() {
		return onboardingConfig{}, nil, ErrAdministrationState
	}
	if caller != "" && !a.isAdministratorLocked(caller) {
		return onboardingConfig{}, nil, errAdminDenied
	}
	if offer == "site_key" || !slices.Contains(onboardingOffers, offer) {
		return onboardingConfig{}, nil, onboardingInvalid("invalid_offer")
	}
	current := a.onboardingLocked()
	// An offer whose key file is gone (removed by hand) is left the same way,
	// so the administrator is never stuck on a key the site does not hold.
	if a.siteKey == nil && current.AIAccount.Offer != "site_key" {
		return onboardingConfig{}, nil, errSiteKeyUnavailable
	}
	next := current
	next.Integrations = append([]onboardingIntegration{}, current.Integrations...)
	next.Repositories.Defaults = append([]string{}, current.Repositories.Defaults...)
	next.Version++
	next.AIAccount.Offer = offer
	if dry {
		return next, nil, nil
	}
	settings := a.settings
	settings.Onboarding = &next
	if e := a.commitAdministration(settings); e != nil && a.onboardingLocked().AIAccount.Offer == "site_key" {
		return onboardingConfig{}, nil, e
	}
	// The offer is the commit point: from here on no login seeds. A key
	// file that could not be removed is inert and the next start removes it,
	// since its offer is no longer site_key; reporting the committed delete
	// as failed would only make its retry refuse.
	a.siteKey = nil
	if a.removeSiteKeyFile() != nil {
		a.log.Warn("site_ai_key", "outcome", "degraded", "reason", "unfinished_change")
	}
	a.log.Info("site_ai_key", "outcome", "accepted", "reason", "delete", "actor", actorFor(caller))
	return next, nil, nil
}

const siteKeyPath = "/api/v1/server/onboarding/ai-key"

// siteKeyHTTP is POST …/ai-key/set {provider, key} and POST …/ai-key/delete
// {offer} for a current administrator with the session's CSRF proof. Each
// returns the onboarding configuration as GET /api/v1/server/onboarding does.
func (a *Auth) siteKeyHTTP(w http.ResponseWriter, r *http.Request) {
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	path := r.URL.Path
	if !a.exact(r, path) || path != siteKeyPath+"/set" && path != siteKeyPath+"/delete" {
		safe(w, 400, "invalid_request")
		return
	}
	if r.Method != http.MethodPost {
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
	if reason := a.authorizeWrite(r, s); reason != "" {
		safe(w, 403, reason)
		return
	}
	if r.Header.Get("Content-Type") != "application/json" {
		safe(w, 400, "invalid_request")
		return
	}
	var body struct {
		Provider *string `json:"provider"`
		Key      *string `json:"key"`
		Offer    *string `json:"offer"`
	}
	dec := json.NewDecoder(io.LimitReader(r.Body, 1025))
	dec.DisallowUnknownFields()
	set := path == siteKeyPath+"/set"
	if dec.Decode(&body) != nil || dec.Decode(new(any)) != io.EOF || set != (body.Provider != nil && body.Key != nil) || set == (body.Offer != nil) {
		safe(w, 400, "invalid_request")
		return
	}
	var next onboardingConfig
	var k *siteKeyView
	var rotation []rotationResult
	var e error
	if set {
		next, k, rotation, e = a.setSiteKeyAndReplace(r.Context(), s.identity.Subject, *body.Provider, *body.Key)
	} else {
		next, k, e = a.deleteSiteKey(s.identity.Subject, *body.Offer, false)
	}
	if e != nil {
		status, code := siteKeyGiveStatus(e)
		safe(w, status, code)
		return
	}
	if rotation != nil {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(struct {
			onboardingReply
			Rotation []rotationResult `json:"rotation"`
		}{onboardingReply{1, next, k}, rotation})
		return
	}
	replyOnboarding(w, next, k)
}

// siteKeyControl serves root's admin ai-key commands. The *_check operations
// are the dry run: the same checks, nothing written.
func (a *Auth) siteKeyControl(ctx context.Context, payload []byte) ([]byte, error) {
	var r struct {
		Operation string  `json:"operation"`
		Provider  *string `json:"provider"`
		Key       *string `json:"key"`
		Offer     *string `json:"offer"`
	}
	dec := json.NewDecoder(strings.NewReader(string(payload)))
	dec.DisallowUnknownFields()
	if dec.Decode(&r) != nil || dec.Decode(new(any)) != io.EOF {
		return nil, errors.New("invalid control request")
	}
	type reply struct {
		Stored   bool         `json:"stored"`
		Offer    string       `json:"offer"`
		Version  int          `json:"version"`
		SiteKey  *siteKeyView `json:"site_key,omitempty"`
		Previous *siteKeyView `json:"previous,omitempty"`
		// Rotation is each earlier copy a set replaced; Replaces is who a
		// dry run's set would give the new key to; Holders is who keeps a
		// copy after a delete.
		Rotation []rotationResult `json:"rotation,omitempty"`
		Replaces []string         `json:"replaces,omitempty"`
		Holders  []string         `json:"holders,omitempty"`
	}
	answer := func(c onboardingConfig, k, previous *siteKeyView) ([]byte, error) {
		return json.Marshal(reply{Stored: k != nil, Offer: c.AIAccount.Offer, Version: c.Version, SiteKey: k, Previous: previous})
	}
	switch r.Operation {
	case "ai_key_show":
		if r.Provider != nil || r.Key != nil || r.Offer != nil {
			break
		}
		c, k, ok := a.onboardingWithKey()
		if !ok {
			return nil, ErrAdministrationState
		}
		return answer(c, k, nil)
	case "ai_key_set", "ai_key_set_check":
		if r.Provider == nil || r.Key == nil || r.Offer != nil {
			break
		}
		previous := a.siteKeyView()
		if r.Operation == "ai_key_set_check" {
			next, k, e := a.setSiteKey("", *r.Provider, *r.Key, true)
			if e != nil {
				return nil, e
			}
			return json.Marshal(reply{Stored: true, Offer: next.AIAccount.Offer, Version: next.Version, SiteKey: k, Previous: previous, Replaces: a.replacedBy(*r.Provider, *r.Key)})
		}
		next, k, rotation, e := a.setSiteKeyAndReplace(ctx, "", *r.Provider, *r.Key)
		if e != nil {
			return nil, e
		}
		return json.Marshal(reply{Stored: true, Offer: next.AIAccount.Offer, Version: next.Version, SiteKey: k, Previous: previous, Rotation: rotation})
	case "ai_key_delete", "ai_key_delete_check":
		if r.Provider != nil || r.Key != nil || r.Offer == nil {
			break
		}
		previous := a.siteKeyView()
		next, _, e := a.deleteSiteKey("", *r.Offer, r.Operation == "ai_key_delete_check")
		if e != nil {
			return nil, e
		}
		return json.Marshal(reply{Offer: next.AIAccount.Offer, Version: next.Version, Previous: previous, Holders: a.copyHolders()})
	}
	return nil, errors.New("invalid control request")
}
