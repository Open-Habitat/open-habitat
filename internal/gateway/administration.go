package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"
)

// BoundUser is the broker's public selection projection: never a route or credential.
type BoundUser struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}
type BrokerReader interface {
	ListBound(context.Context) ([]BoundUser, error)
	LookupBound(context.Context, string) (bool, error)
}

// ErrAdministrationState distinguishes a corrupt shared state record from OAuth config.
var ErrAdministrationState = errors.New("invalid gateway administration state")
var errAdminDenied = errors.New("administrator role removed")
var ErrBoundUserNotFound = errors.New("subject is not bound")
var errBindingNotFound = ErrBoundUserNotFound
var errBrokerRead = errors.New("broker read unavailable")

type serverSettings struct {
	Version           int      `json:"version"`
	Name              string   `json:"name"`
	Administrators    []string `json:"administrators"`
	DefaultLimitBytes uint64   `json:"default_limit_bytes,omitempty"`
	// DefaultLanguage is the administrator's choice of the server's default
	// interface language. Absent, the installation's configuration decides.
	DefaultLanguage string `json:"default_language,omitempty"`
	// Onboarding is absent until the first write; defaultOnboarding stands in.
	Onboarding *onboardingConfig `json:"onboarding,omitempty"`
	// Denied holds the subjects whose web access a runtime withdrawal is
	// ending or has ended (ADR 0030). The login callback and every session
	// lookup refuse them. A deny only refuses; it is cleared only after the
	// broker confirms a restore, or confirms that nothing was withdrawn.
	Denied []string `json:"denied,omitempty"`
	// OnboardingReceipts holds, per subject, what the binding-creating
	// sign-in did with the site's defaults (onboarding_plan.go).
	OnboardingReceipts map[string]onboardingReceipt `json:"onboarding_receipts,omitempty"`
	// PendingAdministrators are subjects site.json declares as administrators
	// but whose binding did not exist when host apply converged roles. Only
	// root's control socket adds one; the sign-in that finds the subject
	// bound moves it to Administrators, so the declaration takes effect at
	// first sign-in without the gateway reading root's site file.
	PendingAdministrators []string `json:"pending_administrators,omitempty"`
	// Designated are administrator roles a browser administrator gave
	// (designation.go). Each is pending until its subject is in
	// Administrators; root's own role operations take a designated subject
	// over, so a role is always either root's or a designation, never both.
	Designated []designation `json:"designated_administrators,omitempty"`
}

// The record is read whole at startup and rewritten whole on each change;
// the upgrade operator digests it within 4 MiB.
const maxAdministrationBytes = 3 << 20

func emptySettings() serverSettings { return serverSettings{Version: 1, Administrators: []string{}} }
func canonicalSubject(id string) bool {
	n, e := strconv.ParseUint(id, 10, 64)
	return e == nil && n > 0 && strconv.FormatUint(n, 10) == id
}
func validName(name string) bool {
	if len(name) > 80 || len(strings.TrimSpace(name)) != len(name) {
		return false
	}
	for _, c := range name {
		if c < 32 || c == 127 {
			return false
		}
	}
	return true
}
func validLanguage(language string) bool {
	return language == "system" || language == "fi" || language == "en" || language == "en-US" || language == "en-GB"
}

// defaultLanguage is the server's default interface language: the
// administrator's choice, else the installation's, else system (the browser).
func (a *Auth) defaultLanguage() string {
	if v := a.settingsView().DefaultLanguage; v != "" {
		return v
	}
	if a.cfg.DefaultLanguage != "" {
		return a.cfg.DefaultLanguage
	}
	return "system"
}

func validSettings(s serverSettings) bool {
	if s.Version != 1 || !validName(s.Name) || s.DefaultLanguage != "" && !validLanguage(s.DefaultLanguage) || s.Administrators == nil || len(s.Administrators) > 1024 || (s.DefaultLimitBytes != 0 && !validQuotaLimit(s.DefaultLimitBytes)) || !validStoredOnboarding(s.Onboarding) {
		return false
	}
	seen := map[string]bool{}
	for _, id := range s.Administrators {
		if !canonicalSubject(id) || seen[id] {
			return false
		}
		seen[id] = true
	}
	if len(s.PendingAdministrators) > 1024 {
		return false
	}
	seen = map[string]bool{}
	for _, id := range s.PendingAdministrators {
		if !canonicalSubject(id) || seen[id] {
			return false
		}
		seen[id] = true
	}
	if !validDesignations(s) {
		return false
	}
	if len(s.Denied) > maxDenied {
		return false
	}
	seen = map[string]bool{}
	for _, id := range s.Denied {
		if !canonicalSubject(id) || seen[id] {
			return false
		}
		seen[id] = true
	}
	for subject, r := range s.OnboardingReceipts {
		if !validReceipt(subject, r) {
			return false
		}
	}
	return true
}

// The gateway holds the only in-process writer lock for browser and control changes.
// State is outside the release; a corrupt existing record fails startup closed.
func (a *Auth) loadAdministration(path string) (err error) {
	defer func() {
		if err != nil {
			err = ErrAdministrationState
		}
	}()
	a.adminEstablished = false
	a.adminFile = path
	a.settings = emptySettings()
	if path == "" {
		return nil
	}
	f, e := os.Open(path)
	if os.IsNotExist(e) {
		return nil
	}
	if e != nil {
		return e
	}
	defer f.Close()
	info, e := f.Stat()
	if e != nil || !privateSessionFile(info) || info.Size() > maxAdministrationBytes {
		return errors.New("invalid administration state")
	}
	dec := json.NewDecoder(io.LimitReader(f, maxAdministrationBytes+1))
	dec.DisallowUnknownFields()
	var state serverSettings
	if dec.Decode(&state) != nil || dec.Decode(new(any)) != io.EOF || !validSettings(state) {
		return errors.New("invalid administration state")
	}
	a.settings = state
	a.adminEstablished = true
	return nil
}
func (a *Auth) administrationHealthy() bool {
	if a.adminFile == "" || !a.adminEstablished {
		return true
	}
	info, e := os.Lstat(a.adminFile)
	return e == nil && privateSessionFile(info)
}
func (a *Auth) commitAdministration(next serverSettings) error {
	if !a.administrationHealthy() {
		return ErrAdministrationState
	}
	if !validSettings(next) {
		return errors.New("invalid settings")
	}
	if a.adminFile != "" {
		if info, e := os.Lstat(a.adminFile); e == nil {
			if !privateSessionFile(info) {
				return errors.New("invalid administration file")
			}
		} else if a.adminEstablished || !os.IsNotExist(e) {
			return ErrAdministrationState
		}
		b, e := json.Marshal(next)
		if e != nil || len(b) > maxAdministrationBytes {
			return errors.New("invalid settings size")
		}
		dir := filepath.Dir(a.adminFile)
		f, e := os.CreateTemp(dir, ".admin-*")
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
		if e = os.Rename(f.Name(), a.adminFile); e != nil {
			return e
		}
		// Once renamed, the new record is authoritative even if the directory sync fails.
		a.settings = next
		a.adminEstablished = true
		d, e := os.Open(dir)
		if e != nil {
			return e
		}
		e = d.Sync()
		d.Close()
		if e != nil {
			return e
		}
	}
	a.settings = next
	return nil
}

// isAdministratorLocked is the role as authority. A subject whose web
// access a withdrawal is ending holds none, even with a request already past
// its session check: the deny is set under this lock before the sessions go.
func (a *Auth) isAdministratorLocked(id string) bool {
	if !a.administrationHealthy() || a.deniedLocked(id) {
		return false
	}
	for _, admin := range a.settings.Administrators {
		if admin == id {
			return true
		}
	}
	return false
}
func (a *Auth) isAdministrator(id string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.isAdministratorLocked(id)
}
func (a *Auth) administrationAvailable() bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.administrationHealthy()
}
func (a *Auth) settingsView() serverSettings {
	a.mu.Lock()
	defer a.mu.Unlock()
	if !a.administrationHealthy() {
		return emptySettings()
	}
	return a.settings
}
func (a *Auth) changeDefaultLimitFor(caller string, limit uint64) error {
	if !validQuotaLimit(limit) {
		return errors.New("invalid quota limit")
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if !a.administrationHealthy() {
		return ErrAdministrationState
	}
	if caller != "" && !a.isAdministratorLocked(caller) {
		return errAdminDenied
	}
	next := a.settings
	next.DefaultLimitBytes = limit
	return a.commitAdministration(next)
}
func (a *Auth) changeDefaultLanguageFor(caller, language string) error {
	if !validLanguage(language) {
		return errors.New("invalid language")
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if !a.administrationHealthy() {
		return ErrAdministrationState
	}
	if !a.isAdministratorLocked(caller) {
		return errAdminDenied
	}
	next := a.settings
	next.DefaultLanguage = language
	return a.commitAdministration(next)
}
func (a *Auth) changeName(name string) error { return a.changeNameFor("", name) }
func (a *Auth) changeNameFor(caller, name string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if !a.administrationHealthy() {
		return ErrAdministrationState
	}
	if caller != "" && !a.isAdministratorLocked(caller) {
		return errAdminDenied
	}
	next := a.settings
	next.Name = name
	return a.commitAdministration(next)
}

// changeRole is root's role operation, used by host apply to converge the
// administrators to site.json. No browser path reaches it; the browser's
// own role write is a designation (designation.go).
func (a *Auth) changeRole(ctx context.Context, id string, administrator bool) error {
	if !canonicalSubject(id) {
		return errors.New("invalid subject")
	}
	// Granting needs a current bound target. Removal only subtracts authority:
	// permit root recovery even when a binding is gone or the broker is offline.
	if administrator {
		reader, ok := a.broker.(BrokerReader)
		if !ok {
			return errBrokerRead
		}
		bound, e := reader.LookupBound(ctx, id)
		if e != nil {
			return errBrokerRead
		}
		if !bound {
			return errBindingNotFound
		}
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if !a.administrationHealthy() {
		return ErrAdministrationState
	}
	next := a.settings
	next.Administrators = withoutSubject(next.Administrators, id)
	found := len(next.Administrators) != len(a.settings.Administrators)
	if administrator {
		next.Administrators = append(next.Administrators, id)
	}
	// Either way the subject's declaration is no longer waiting: a grant
	// fulfils it, and a removal withdraws it. Root's grant also takes over a
	// browser designation, so a site.json role is never revocable as one.
	next.PendingAdministrators = withoutSubject(next.PendingAdministrators, id)
	next.Designated = withoutDesignation(next.Designated, id)
	pending := len(next.PendingAdministrators) != len(a.settings.PendingAdministrators) || len(next.Designated) != len(a.settings.Designated)
	if found == administrator && !pending {
		return nil
	}
	return a.commitAdministration(next)
}

// declareRole is root's operation for a site.json administrator whose
// binding host apply did not observe. The declaration is recorded before the
// binding is looked up, and the login callback grants a pending subject
// after its broker recheck, so a binding created concurrently is granted by
// one of the two. A declaration is withdrawn through changeRole, which also
// removes a grant a concurrent sign-in made from it.
func (a *Auth) declareRole(ctx context.Context, id string) error {
	if !canonicalSubject(id) {
		return errors.New("invalid subject")
	}
	a.mu.Lock()
	if !a.administrationHealthy() {
		a.mu.Unlock()
		return ErrAdministrationState
	}
	var e error
	// A browser designation of the same subject becomes root's: granted
	// stays granted, pending stays pending, and neither is revocable from
	// the browser any more.
	granted := slices.Contains(a.settings.Administrators, id)
	if a.designatedLocked(id) || !slices.Contains(a.settings.PendingAdministrators, id) && !granted {
		next := a.settings
		next.Designated = withoutDesignation(next.Designated, id)
		if !granted && !slices.Contains(next.PendingAdministrators, id) {
			next.PendingAdministrators = append(append([]string{}, next.PendingAdministrators...), id)
		}
		e = a.commitAdministration(next)
	}
	pending := slices.Contains(a.settings.PendingAdministrators, id)
	a.mu.Unlock()
	if e != nil || !pending {
		return e
	}
	reader, ok := a.broker.(BrokerReader)
	if !ok {
		return nil
	}
	if bound, e := reader.LookupBound(ctx, id); e != nil || !bound {
		// Still pending: the next sign-in, or the next apply, grants it.
		return nil
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.grantPendingLocked(id)
}

// grantPendingLocked grants a subject, now known to be bound, the role root
// declared or a browser administrator designated for it. A subject nobody
// named is never granted here. The id is the GitHub account's numeric id
// from the sign-in, never a login, so a renamed or reused login cannot
// receive someone else's role.
func (a *Auth) grantPendingLocked(id string) error {
	if !a.administrationHealthy() {
		return nil
	}
	declared := slices.Contains(a.settings.PendingAdministrators, id)
	if !declared && (!a.designatedLocked(id) || slices.Contains(a.settings.Administrators, id)) {
		return nil
	}
	next := a.settings
	next.PendingAdministrators = withoutSubject(next.PendingAdministrators, id)
	next.Administrators = append(withoutSubject(next.Administrators, id), id)
	return a.commitAdministration(next)
}
func withoutSubject(ids []string, id string) []string {
	out := make([]string, 0, len(ids))
	for _, v := range ids {
		if v != id {
			out = append(out, v)
		}
	}
	return out
}
func (a *Auth) adminHTTP(w http.ResponseWriter, r *http.Request) {
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	if !a.exact(r, "/api/v1/server") && !a.exact(r, "/api/v1/server/administration") {
		safe(w, 400, "invalid_request")
		return
	}
	if r.URL.RawQuery != "" {
		safe(w, 400, "invalid_request")
		return
	}
	if !a.administrationAvailable() {
		safe(w, 503, "administration_unavailable")
		return
	}
	if r.URL.Path == "/api/v1/server" && r.Method == http.MethodGet {
		v := a.settingsView()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(struct {
			Version       int    `json:"schema_version"`
			Name          string `json:"name"`
			Administrator bool   `json:"administrator"`
			BuildVersion  string `json:"version"`
			Commit        string `json:"commit,omitempty"`
		}{1, v.Name, a.isAdministrator(s.identity.Subject), a.version, a.commit})
		return
	}
	if !a.isAdministrator(s.identity.Subject) {
		safe(w, 403, "admin_required")
		return
	}
	if r.URL.Path == "/api/v1/server/administration" && r.Method == http.MethodGet {
		reader, ok := a.broker.(BrokerReader)
		if !ok {
			safe(w, 503, "broker_unavailable")
			return
		}
		users, e := reader.ListBound(r.Context())
		if e != nil {
			safe(w, 503, "broker_unavailable")
			return
		}
		v := a.settingsView()
		type row struct {
			ID            string `json:"id"`
			Username      string `json:"username"`
			Administrator bool   `json:"administrator"`
		}
		rows := make([]row, 0, len(users))
		for _, u := range users {
			admin := false
			for _, id := range v.Administrators {
				if id == u.ID {
					admin = true
					break
				}
			}
			rows = append(rows, row{u.ID, u.Username, admin})
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(struct {
			Version           int    `json:"schema_version"`
			Name              string `json:"name"`
			DefaultLanguage   string `json:"default_language"`
			Users             []row  `json:"users"`
			DefaultLimitBytes uint64 `json:"default_limit_bytes"`
		}{1, v.Name, a.defaultLanguage(), rows, v.DefaultLimitBytes})
		return
	}
	if r.URL.Path != "/api/v1/server/administration" || r.Method != http.MethodPut {
		safe(w, 405, "method_not_allowed")
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
	// Roles are not settings: root's come from site.json over the control
	// socket, and a browser administrator's designations go through the
	// access list (designation.go).
	var request struct {
		Name              *string `json:"name"`
		DefaultLimitBytes *uint64 `json:"default_limit_bytes"`
		DefaultLanguage   *string `json:"default_language"`
	}
	dec := json.NewDecoder(io.LimitReader(r.Body, 1025))
	dec.DisallowUnknownFields()
	if dec.Decode(&request) != nil || dec.Decode(new(any)) != io.EOF || (boolInt(request.Name != nil)+boolInt(request.DefaultLimitBytes != nil)+boolInt(request.DefaultLanguage != nil) != 1) || request.DefaultLimitBytes != nil && !validQuotaLimit(*request.DefaultLimitBytes) || request.DefaultLanguage != nil && !validLanguage(*request.DefaultLanguage) {
		safe(w, 400, "invalid_request")
		return
	}
	var e error
	if request.Name != nil {
		if !validName(*request.Name) {
			safe(w, 400, "invalid_request")
			return
		}
		e = a.changeNameFor(s.identity.Subject, *request.Name)
	} else if request.DefaultLanguage != nil {
		e = a.changeDefaultLanguageFor(s.identity.Subject, *request.DefaultLanguage)
	} else {
		e = a.changeDefaultLimitFor(s.identity.Subject, *request.DefaultLimitBytes)
	}
	if errors.Is(e, errAdminDenied) {
		safe(w, 403, "admin_required")
		return
	}
	if e != nil {
		safe(w, 503, "administration_unavailable")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// siteLanguageHTTP tells sign-in and the landing page, which know no person
// yet, the server's default language. It is public: the value names nothing
// about anyone, and a page before sign-in has no session to show.
func (a *Auth) siteLanguageHTTP(w http.ResponseWriter, r *http.Request) {
	if !a.exact(r, "/api/v1/site/language") {
		safe(w, 400, "invalid_request")
		return
	}
	if r.Method != http.MethodGet {
		safe(w, 405, "method_not_allowed")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		Version         int    `json:"schema_version"`
		DefaultLanguage string `json:"default_language"`
	}{1, a.defaultLanguage()})
}

// maxControlPayload bounds one root control request; an onboarding document
// with 20 default repositories is the largest.
const maxControlPayload = 8192

// AdminControl is called only after the private control listener verifies root
// peer credentials. The CLI client belongs to server-administration-cli.
func (a *Auth) AdminControl(ctx context.Context, payload []byte) ([]byte, error) {
	var r struct {
		Operation         string  `json:"operation"`
		Name              string  `json:"name"`
		Subject           string  `json:"subject"`
		Administrator     *bool   `json:"administrator"`
		DefaultLimitBytes *uint64 `json:"default_limit_bytes"`
		LimitBytes        *uint64 `json:"limit_bytes"`
	}
	if len(payload) > maxControlPayload {
		return nil, errors.New("invalid control request")
	}
	var op struct {
		Operation string `json:"operation"`
	}
	if json.Unmarshal(payload, &op) == nil && strings.HasPrefix(op.Operation, "onboarding_") {
		return a.onboardingControl(payload)
	}
	if strings.HasPrefix(op.Operation, "access_") {
		return a.accessControl(ctx, payload)
	}
	if strings.HasPrefix(op.Operation, "integration_") {
		return a.integrationControl(ctx, payload)
	}
	if op.Operation == "ai_key_copies" || strings.HasPrefix(op.Operation, "ai_key_seed") {
		return a.siteKeyGiveControl(ctx, payload)
	}
	if strings.HasPrefix(op.Operation, "ai_key_") {
		return a.siteKeyControl(ctx, payload)
	}
	dec := json.NewDecoder(strings.NewReader(string(payload)))
	dec.DisallowUnknownFields()
	if dec.Decode(&r) != nil || dec.Decode(new(any)) != io.EOF {
		return nil, errors.New("invalid control request")
	}
	switch r.Operation {
	case "users":
		if r.Name != "" || r.Subject != "" || r.Administrator != nil || r.DefaultLimitBytes != nil || r.LimitBytes != nil {
			break
		}
		if !a.administrationAvailable() {
			return nil, ErrAdministrationState
		}
		reader, ok := a.broker.(BrokerReader)
		if !ok {
			return nil, errBrokerRead
		}
		users, e := reader.ListBound(ctx)
		if e != nil {
			return nil, errBrokerRead
		}
		type user struct {
			BoundUser
			Onboarding *onboardingReceipt `json:"onboarding,omitempty"`
		}
		receipts := a.settingsView().OnboardingReceipts
		out := make([]user, 0, len(users))
		for _, u := range users {
			out = append(out, user{u, receiptView(receipts, u.ID)})
		}
		return json.Marshal(out)
	case "show":
		if r.Name != "" || r.Subject != "" || r.Administrator != nil || r.DefaultLimitBytes != nil || r.LimitBytes != nil {
			break
		}
		if !a.administrationAvailable() {
			return nil, ErrAdministrationState
		}
		// The settings record without onboarding, access and receipts,
		// which have their own operations.
		v := a.settingsView()
		v.Onboarding = nil
		v.Denied = nil
		v.OnboardingReceipts = nil
		return json.Marshal(v)
	case "name":
		if r.Subject != "" || r.Administrator != nil || r.DefaultLimitBytes != nil || r.LimitBytes != nil || !validName(r.Name) {
			break
		}
		if e := a.changeName(r.Name); e != nil {
			return nil, e
		}
		return []byte(`{"ok":true}`), nil
	case "default_limit":
		if r.Name != "" || r.Subject != "" || r.Administrator != nil || r.LimitBytes != nil || r.DefaultLimitBytes == nil || !validQuotaLimit(*r.DefaultLimitBytes) {
			break
		}
		if e := a.changeDefaultLimitFor("", *r.DefaultLimitBytes); e != nil {
			return nil, e
		}
		return []byte(`{"ok":true}`), nil
	case "quota_users":
		if r.Name != "" || r.Subject != "" || r.Administrator != nil || r.LimitBytes != nil || r.DefaultLimitBytes != nil {
			break
		}
		return a.quotaUsers(ctx)
	case "quota_set":
		if r.Name != "" || r.Administrator != nil || r.DefaultLimitBytes != nil || r.LimitBytes == nil || !canonicalSubject(r.Subject) || !validQuotaLimit(*r.LimitBytes) {
			break
		}
		if e := a.setQuota(ctx, "", r.Subject, *r.LimitBytes); e != nil {
			return nil, e
		}
		return []byte(`{"ok":true}`), nil
	case "role":
		if r.Name != "" || r.Administrator == nil || r.DefaultLimitBytes != nil || r.LimitBytes != nil {
			break
		}
		if e := a.changeRole(ctx, r.Subject, *r.Administrator); e != nil {
			return nil, e
		}
		return []byte(`{"ok":true}`), nil
	case "role_declared":
		if r.Name != "" || r.Administrator == nil || !*r.Administrator || r.DefaultLimitBytes != nil || r.LimitBytes != nil {
			break
		}
		if e := a.declareRole(ctx, r.Subject); e != nil {
			return nil, e
		}
		return []byte(`{"ok":true}`), nil
	}
	return nil, errors.New("invalid control request")
}

// AdminControlError maps private control failures to a fixed, non-sensitive wire vocabulary.
// AdminControlDeadline is how long root's control exchange for payload may
// take. Giving the site key waits for native Pi in the person's daemon, and
// a new key replaces every recorded copy, four people at a time.
func AdminControlDeadline(payload []byte) time.Duration {
	var op struct {
		Operation string `json:"operation"`
	}
	_ = json.Unmarshal(payload, &op)
	switch op.Operation {
	case "ai_key_seed", "ai_key_seed_check":
		return siteKeyDaemonDeadline + 15*time.Second
	case "ai_key_set":
		return 5 * time.Minute
	}
	return 5 * time.Second
}

func AdminControlError(err error) string {
	var oe *OnboardingError
	if code, ok := integrationControlError(err); ok {
		return code
	}
	if code, ok := accessControlError(err); ok {
		return code
	}
	switch {
	case errors.As(err, &oe):
		return oe.Reason
	case errors.Is(err, errBindingNotFound):
		return "not_found"
	case errors.Is(err, ErrQuotaNotInUse):
		return "storage_limits_not_in_use"
	case errors.Is(err, errBrokerRead):
		return "broker_unavailable"
	case errors.Is(err, ErrAdministrationState):
		return "administration_unavailable"
	default:
		var pathErr *os.PathError
		if errors.As(err, &pathErr) {
			return "state_io"
		}
		return "request_failed"
	}
}
