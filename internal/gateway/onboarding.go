package gateway

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"slices"
	"strings"
)

// The site onboarding configuration (ADR 0030) is gateway administration
// state beside the name and default quota: one writer lock, one record and the
// same validation from the browser (session + administrator + CSRF) and from
// root's control socket. host apply never writes it. It is presentation and
// a plan the gateway itself puts into requests it builds; a daemon never reads
// it and the person-side read never carries the default repositories.

const maxOnboardingDefaults = 20

var onboardingModes = []string{"preselected", "auto", "skip"}
var onboardingOffers = []string{"all", "chatgpt", "claude", "openai_key", "anthropic_key", "deepseek_key", "site_key"}

// onboardingProviders is the integrations catalog's provider order
// (internal/daemon/integrations providerOrder). Integration steps follow it,
// so a stored list is kept in this order whatever order it was given in.
var onboardingProviders = []string{"google", "microsoft", "imap", "caldav", "carddav", "dropbox"}

type onboardingRepositories struct {
	Mode     string   `json:"mode"`
	Defaults []string `json:"defaults"`
}
type onboardingIntegration struct {
	Provider string `json:"provider"`
	Required bool   `json:"required"`
}
type onboardingAIAccount struct {
	Offer string `json:"offer"`
}

// onboardingDocument is what an administrator writes; onboardingConfig adds
// the revision that guards a whole-document replacement.
type onboardingDocument struct {
	Repositories onboardingRepositories  `json:"repositories"`
	Integrations []onboardingIntegration `json:"integrations"`
	AIAccount    onboardingAIAccount     `json:"ai_account"`
}
type onboardingConfig struct {
	Version int `json:"version"`
	onboardingDocument
}

// defaultOnboarding is what a site that never saved one offers: the person
// chooses repositories, no integration step is on the route until an
// administrator adds one (Jari 24.10.2026), and every AI option is shown. Its
// version is 0, so the first write names --expected-version 0.
func defaultOnboarding() onboardingConfig {
	return onboardingConfig{Version: 0, onboardingDocument: onboardingDocument{
		Repositories: onboardingRepositories{Mode: "preselected", Defaults: []string{}},
		Integrations: []onboardingIntegration{},
		AIAccount:    onboardingAIAccount{Offer: "all"},
	}}
}

// OnboardingError is a fixed reason shared by the HTTP and control paths, so
// both reject the same document with the same word.
type OnboardingError struct{ Reason string }

func (e *OnboardingError) Error() string { return "onboarding: " + e.Reason }

var errOnboardingConflict = &OnboardingError{"version_conflict"}

func onboardingInvalid(reason string) error { return &OnboardingError{reason} }

// validRepositoryName is GitHub's owner/repo grammar, the same pattern the
// repository contracts use.
func validRepositoryName(name string) bool {
	owner, repo, ok := strings.Cut(name, "/")
	if !ok || len(owner) < 1 || len(owner) > 39 || len(repo) < 1 || len(repo) > 100 || repo == "." || repo == ".." {
		return false
	}
	for i, c := range owner {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '-' && i > 0) {
			return false
		}
	}
	for _, c := range repo {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '-' || c == '_' || c == '.') {
			return false
		}
	}
	return true
}

// normalizeOnboarding validates a document and returns its canonical form:
// integrations in catalog order. GitHub names compare case-insensitively, so
// two spellings of one repository are a duplicate.
func normalizeOnboarding(d onboardingDocument) (onboardingDocument, error) {
	if !slices.Contains(onboardingModes, d.Repositories.Mode) {
		return d, onboardingInvalid("invalid_mode")
	}
	if d.Repositories.Defaults == nil || d.Integrations == nil {
		return d, onboardingInvalid("invalid_document")
	}
	if len(d.Repositories.Defaults) > maxOnboardingDefaults {
		return d, onboardingInvalid("too_many_defaults")
	}
	seen := map[string]bool{}
	destinations := map[string]bool{}
	for _, name := range d.Repositories.Defaults {
		if !validRepositoryName(name) {
			return d, onboardingInvalid("invalid_repository_name")
		}
		if seen[strings.ToLower(name)] {
			return d, onboardingInvalid("duplicate_default")
		}
		seen[strings.ToLower(name)] = true
		// A clone lands in ~/src/<repo>, so two owners' repositories of one
		// name can never both be fetched for a person.
		_, repo, _ := strings.Cut(strings.ToLower(name), "/")
		if destinations[repo] {
			return d, onboardingInvalid("duplicate_destination")
		}
		destinations[repo] = true
	}
	given := map[string]bool{}
	for _, i := range d.Integrations {
		if !slices.Contains(onboardingProviders, i.Provider) {
			return d, onboardingInvalid("unknown_provider")
		}
		if given[i.Provider] {
			return d, onboardingInvalid("duplicate_provider")
		}
		given[i.Provider] = true
	}
	if !slices.Contains(onboardingOffers, d.AIAccount.Offer) {
		return d, onboardingInvalid("invalid_offer")
	}
	// offer is site_key exactly while a site key is stored, and the gateway
	// stores none yet.
	if d.AIAccount.Offer == "site_key" {
		return d, onboardingInvalid("site_key_unavailable")
	}
	out := onboardingDocument{
		Repositories: onboardingRepositories{Mode: d.Repositories.Mode, Defaults: append([]string{}, d.Repositories.Defaults...)},
		Integrations: make([]onboardingIntegration, 0, len(d.Integrations)),
		AIAccount:    d.AIAccount,
	}
	for _, p := range onboardingProviders {
		for _, i := range d.Integrations {
			if i.Provider == p {
				out.Integrations = append(out.Integrations, i)
			}
		}
	}
	return out, nil
}

// validStoredOnboarding accepts only a canonical record a write could have made.
func validStoredOnboarding(c *onboardingConfig) bool {
	if c == nil {
		return true
	}
	n, e := normalizeOnboarding(c.onboardingDocument)
	if e != nil || c.Version < 1 || c.Version > 1<<30 {
		return false
	}
	b1, _ := json.Marshal(n)
	b2, _ := json.Marshal(c.onboardingDocument)
	return string(b1) == string(b2)
}

func (a *Auth) onboardingLocked() onboardingConfig {
	if a.settings.Onboarding == nil {
		return defaultOnboarding()
	}
	return *a.settings.Onboarding
}

// onboardingView reads the current configuration; ok is false when the
// administration state is unavailable, which is never answered with defaults.
func (a *Auth) onboardingView() (onboardingConfig, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if !a.administrationHealthy() {
		return onboardingConfig{}, false
	}
	c := a.onboardingLocked()
	c.Repositories.Defaults = append([]string{}, c.Repositories.Defaults...)
	c.Integrations = append([]onboardingIntegration{}, c.Integrations...)
	return c, true
}

// checkOnboarding validates a replacement against the current version without
// writing: the shared dry-run and the first half of every write.
func (a *Auth) checkOnboardingLocked(caller string, expected int, d onboardingDocument) (onboardingConfig, error) {
	if !a.administrationHealthy() {
		return onboardingConfig{}, ErrAdministrationState
	}
	if caller != "" && !a.isAdministratorLocked(caller) {
		return onboardingConfig{}, errAdminDenied
	}
	n, e := normalizeOnboarding(d)
	if e != nil {
		return onboardingConfig{}, e
	}
	current := a.onboardingLocked()
	if expected != current.Version {
		return onboardingConfig{}, errOnboardingConflict
	}
	return onboardingConfig{Version: current.Version + 1, onboardingDocument: n}, nil
}

// updateOnboardingFor replaces the whole document when expected names the
// current version. caller is the browser administrator, or "" for root.
func (a *Auth) updateOnboardingFor(caller string, expected int, d onboardingDocument) (onboardingConfig, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	next, e := a.checkOnboardingLocked(caller, expected, d)
	if e != nil {
		return onboardingConfig{}, e
	}
	settings := a.settings
	settings.Onboarding = &next
	if e = a.commitAdministration(settings); e != nil {
		return onboardingConfig{}, e
	}
	return next, nil
}

func (a *Auth) checkOnboarding(expected int, d onboardingDocument) (onboardingConfig, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.checkOnboardingLocked("", expected, d)
}

// decodeOnboardingDocument reads one strict JSON object. version is the
// optional revision a show reply carried; the caller compares it.
func decodeOnboardingDocument(r io.Reader, limit int64) (d onboardingDocument, expected *int, version *int, err error) {
	// required is a boolean whose zero value is legal, so its absence is
	// checked rather than read as false.
	type integration struct {
		Provider string `json:"provider"`
		Required *bool  `json:"required"`
	}
	var raw struct {
		ExpectedVersion *int                    `json:"expected_version"`
		Version         *int                    `json:"version"`
		Repositories    *onboardingRepositories `json:"repositories"`
		Integrations    *[]integration          `json:"integrations"`
		AIAccount       *onboardingAIAccount    `json:"ai_account"`
	}
	dec := json.NewDecoder(io.LimitReader(r, limit+1))
	dec.DisallowUnknownFields()
	if dec.Decode(&raw) != nil || dec.Decode(new(any)) != io.EOF || raw.Repositories == nil || raw.Integrations == nil || raw.AIAccount == nil {
		return d, nil, nil, onboardingInvalid("invalid_document")
	}
	integrations := make([]onboardingIntegration, 0, len(*raw.Integrations))
	for _, i := range *raw.Integrations {
		if i.Required == nil {
			return d, nil, nil, onboardingInvalid("invalid_document")
		}
		integrations = append(integrations, onboardingIntegration{Provider: i.Provider, Required: *i.Required})
	}
	return onboardingDocument{Repositories: *raw.Repositories, Integrations: integrations, AIAccount: *raw.AIAccount}, raw.ExpectedVersion, raw.Version, nil
}

type onboardingReply struct {
	SchemaVersion int `json:"schema_version"`
	onboardingConfig
}

// siteOnboarding is the person-side read: the steps and the offer, never the
// site's default repositories or how many there are.
type siteOnboarding struct {
	SchemaVersion int `json:"schema_version"`
	Repositories  struct {
		Mode    string   `json:"mode"`
		Imports []string `json:"imports,omitempty"`
	} `json:"repositories"`
	Integrations []onboardingIntegration `json:"integrations"`
	AIAccount    onboardingAIAccount     `json:"ai_account"`
}

// personOnboarding is what one person's route shows: the site's current
// steps, and the names the site fetches for this person, only their own
// readable ones from the sign-in that created their account
// (onboarding_plan.go).
func personOnboarding(c onboardingConfig, r *onboardingReceipt) siteOnboarding {
	v := siteOnboarding{SchemaVersion: 1, Integrations: c.Integrations, AIAccount: c.AIAccount}
	v.Repositories.Mode = c.Repositories.Mode
	if r != nil && r.Mode != "preselected" {
		v.Repositories.Imports = r.readable()
	}
	return v
}

func onboardingStatus(e error) (int, string) {
	var oe *OnboardingError
	switch {
	case errors.Is(e, errAdminDenied):
		return 403, "admin_required"
	case errors.As(e, &oe) && oe == errOnboardingConflict:
		return 409, oe.Reason
	case errors.As(e, &oe):
		return 400, oe.Reason
	}
	return 503, "administration_unavailable"
}

// siteOnboardingHTTP is GET /api/v1/onboarding/site for any signed-in person.
func (a *Auth) siteOnboardingHTTP(w http.ResponseWriter, r *http.Request) {
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if !a.exact(r, "/api/v1/onboarding/site") {
		safe(w, 400, "invalid_request")
		return
	}
	if r.Method != http.MethodGet {
		safe(w, 405, "method_not_allowed")
		return
	}
	c, ok := a.onboardingView()
	if !ok {
		safe(w, 503, "administration_unavailable")
		return
	}
	var receipt *onboardingReceipt
	if got, found := a.receiptFor(s.identity.Subject); found {
		receipt = &got
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(personOnboarding(c, receipt))
}

// serverOnboardingHTTP is GET and PUT /api/v1/server/onboarding for a current
// administrator; a write also needs the session's CSRF proof.
func (a *Auth) serverOnboardingHTTP(w http.ResponseWriter, r *http.Request) {
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if !a.exact(r, "/api/v1/server/onboarding") {
		safe(w, 400, "invalid_request")
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodPut {
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
	reply := func(c onboardingConfig) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(onboardingReply{1, c})
	}
	if r.Method == http.MethodGet {
		c, ok := a.onboardingView()
		if !ok {
			safe(w, 503, "administration_unavailable")
			return
		}
		reply(c)
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
	d, expected, version, e := decodeOnboardingDocument(r.Body, 16384)
	if e == nil && (expected == nil || version != nil) {
		e = onboardingInvalid("invalid_document")
	}
	if e != nil {
		status, code := onboardingStatus(e)
		safe(w, status, code)
		return
	}
	next, e := a.updateOnboardingFor(s.identity.Subject, *expected, d)
	if e != nil {
		status, code := onboardingStatus(e)
		safe(w, status, code)
		return
	}
	reply(next)
}

// onboardingControl serves root's admin onboarding commands. onboarding_check
// is the dry run: the same validation and version check, nothing written.
func (a *Auth) onboardingControl(payload []byte) ([]byte, error) {
	var r struct {
		Operation       string          `json:"operation"`
		ExpectedVersion *int            `json:"expected_version"`
		Document        json.RawMessage `json:"document"`
	}
	dec := json.NewDecoder(strings.NewReader(string(payload)))
	dec.DisallowUnknownFields()
	if dec.Decode(&r) != nil || dec.Decode(new(any)) != io.EOF {
		return nil, errors.New("invalid control request")
	}
	switch r.Operation {
	case "onboarding_show":
		if r.ExpectedVersion != nil || r.Document != nil {
			break
		}
		c, ok := a.onboardingView()
		if !ok {
			return nil, ErrAdministrationState
		}
		return json.Marshal(c)
	case "onboarding_check", "onboarding_update":
		if r.ExpectedVersion == nil || r.Document == nil {
			break
		}
		d, expected, version, e := decodeOnboardingDocument(strings.NewReader(string(r.Document)), maxControlPayload)
		if e == nil && (expected != nil || version != nil) {
			e = onboardingInvalid("invalid_document")
		}
		if e != nil {
			return nil, e
		}
		var next onboardingConfig
		if r.Operation == "onboarding_check" {
			next, e = a.checkOnboarding(*r.ExpectedVersion, d)
		} else {
			next, e = a.updateOnboardingFor("", *r.ExpectedVersion, d)
		}
		if e != nil {
			return nil, e
		}
		return json.Marshal(next)
	}
	return nil, errors.New("invalid control request")
}
