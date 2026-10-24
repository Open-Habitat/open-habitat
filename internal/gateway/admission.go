package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"slices"
	"strings"
	"time"
)

// Runtime admission (ADR 0030). The broker owns both admission sources; the
// gateway may only ask it to admit or withdraw site_admin entries, after its
// own administrator check. The gateway's part is the order that keeps every
// crash point closed: withdrawal records a durable deny and removes the
// subject's sessions before the broker withdraws; restore removes leftover
// sessions and clears the deny only after the broker confirms. Nothing here
// is retried automatically, and an unconfirmed outcome is reported as such.

// maxDenied bounds the deny list: at most every runtime entry plus slack for
// operator removals that a withdrawal raced.
const maxDenied = 512

// AccessRow and AccessPage mirror the broker's admission list.
type AccessRow struct {
	ID, Source, State, Username, LoginHint, Actor, At string
}
type AccessPage struct {
	Mode             string
	RuntimeAdmission bool
	Rows             []AccessRow
}

// AccessBroker is the broker's admission surface. Admit and Withdraw return
// ErrAccessUncertain when no definite reply arrived.
type AccessBroker interface {
	AccessList(context.Context) (AccessPage, error)
	AccessRead(context.Context, string) (AccessPage, error)
	Admit(ctx context.Context, id, loginHint, actor string) (AccessRow, error)
	Withdraw(ctx context.Context, id, actor string) (AccessRow, error)
}

// Definite broker refusals; nothing changed. ErrAccessUncertain means the
// change may or may not have been committed.
var (
	ErrAccessUncertain = errors.New("access change outcome uncertain")
	ErrAccessDisabled  = errors.New("runtime admission is switched off")
	ErrAccessFull      = errors.New("runtime admission is full")
	ErrAccessOpen      = errors.New("installation admits anyone")
	ErrOperatorOwned   = errors.New("admission belongs to site.json")
	ErrAccessDrift     = errors.New("binding failed verification")
	ErrAccessRefused   = errors.New("broker refused access change")
)

// GitHubUser is the public account a login or id resolves to.
type GitHubUser struct {
	ID, Login, Name, Type string
}

// UserDirectory resolves GitHub accounts through the public users API as the
// OAuth app, never with a person's token.
type UserDirectory interface {
	LookupLogin(context.Context, string) (GitHubUser, error)
	LookupID(context.Context, string) (GitHubUser, error)
}

var (
	ErrGitHubUserNotFound = errors.New("github user not found")
	ErrGitHubNotUser      = errors.New("github account is not a user")
	ErrGitHubLookup       = errors.New("github lookup unavailable")
)

func (a *Auth) deniedLocked(subject string) bool {
	return slices.Contains(a.settings.Denied, subject)
}

// subjectClosedLocked is true for a login flow started before the subject's
// sessions were revoked, or for any flow while the subject is denied.
func (a *Auth) subjectClosedLocked(subject string, serial uint64) bool {
	return serial <= a.revoked[subject] || a.deniedLocked(subject)
}

func (a *Auth) accessBroker() (AccessBroker, bool) {
	b, ok := a.broker.(AccessBroker)
	return b, ok
}

func (a *Auth) directory() (UserDirectory, bool) {
	d, ok := a.provider.(UserDirectory)
	return d, ok
}

// actorFor names the requester as the broker records it: the administrator's
// GitHub id, or root for the local control socket.
func actorFor(caller string) string {
	if caller == "" {
		return "root"
	}
	return caller
}

// setDenyLocked adds or removes subject from the durable deny list. Call
// under mu with the administrator check already made.
func (a *Auth) setDenyLocked(subject string, denied bool) error {
	if !a.administrationHealthy() {
		return ErrAdministrationState
	}
	if a.deniedLocked(subject) == denied {
		return nil
	}
	next := a.settings
	next.Denied = slices.DeleteFunc(append([]string{}, next.Denied...), func(id string) bool { return id == subject })
	if denied {
		next.Denied = append(next.Denied, subject)
		slices.Sort(next.Denied)
	}
	if len(next.Denied) == 0 {
		next.Denied = nil
	}
	return a.commitAdministration(next)
}

func (a *Auth) clearDeny(subject string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.setDenyLocked(subject, false)
}

// withdrawAccess ends a runtime-admitted person's web access. The Unix
// account, home, credentials, SSH and processes stay. caller is the
// administrator's subject, or empty for root's control socket.
func (a *Auth) withdrawAccess(ctx context.Context, caller, subject string) (AccessRow, error) {
	if !canonicalSubject(subject) {
		return AccessRow{}, errors.New("invalid subject")
	}
	broker, ok := a.accessBroker()
	if !ok {
		return AccessRow{}, errBrokerRead
	}
	a.accessMu.Lock()
	defer a.accessMu.Unlock()
	if caller != "" && !a.isAdministrator(caller) {
		return AccessRow{}, errAdminDenied
	}
	// Refuse what the broker would refuse before touching anything, so that
	// trying to remove someone root admits never signs them out.
	page, err := broker.AccessRead(ctx, subject)
	if err != nil {
		return AccessRow{}, errBrokerRead
	}
	if page.Mode == "any" {
		return AccessRow{}, ErrAccessOpen
	}
	if len(page.Rows) == 1 && page.Rows[0].Source == "operator" {
		return AccessRow{}, ErrOperatorOwned
	}
	// (1) durable deny and (2) session removal under one lock: a login that
	// races this either created its session before (removed here) or checks
	// the deny after (refused).
	a.mu.Lock()
	if caller != "" && !a.isAdministratorLocked(caller) {
		a.mu.Unlock()
		return AccessRow{}, errAdminDenied
	}
	if err = a.setDenyLocked(subject, true); err != nil {
		a.mu.Unlock()
		return AccessRow{}, err
	}
	removed, err := a.revokeSessionsLocked(subject)
	a.mu.Unlock()
	if err != nil {
		// The deny already refuses every lookup; the person is closed out,
		// but the broker was not asked.
		return AccessRow{}, ErrAccessUncertain
	}
	a.log.Info("access_withdrawal", "outcome", "accepted", "reason", "denied", "subject", subject, "sessions_removed", removed)
	// (3) the broker withdraws.
	row, err := broker.Withdraw(ctx, subject, actorFor(caller))
	switch {
	case err == nil:
	case errors.Is(err, ErrAccessUncertain):
		a.log.Warn("access_withdrawal", "outcome", "uncertain", "reason", "broker_reply_missing", "subject", subject)
		return AccessRow{}, ErrAccessUncertain
	default:
		// A definite refusal withdrew nothing (root admitted the id since the
		// read, or the mode changed). Lift the deny so access matches the
		// broker again; the removed sessions stay removed.
		if a.clearDeny(subject) != nil {
			return AccessRow{}, ErrAccessUncertain
		}
		return AccessRow{}, err
	}
	// A never-bound id leaves nothing behind, not even the deny, so a later
	// site.json admission of the same id is not silently refused.
	if row.State == "removed" && a.clearDeny(subject) != nil {
		// Withdrawn, but the deny the operation promised to drop remains.
		return AccessRow{}, ErrAccessUncertain
	}
	a.log.Info("access_withdrawal", "outcome", "accepted", "reason", "withdrawn", "subject", subject)
	return row, nil
}

// admitAccess admits a new GitHub id or restores a withdrawn one to the
// account its committed binding still names.
func (a *Auth) admitAccess(ctx context.Context, caller, subject string) (AccessRow, error) {
	if !canonicalSubject(subject) {
		return AccessRow{}, errors.New("invalid subject")
	}
	broker, ok := a.accessBroker()
	if !ok {
		return AccessRow{}, errBrokerRead
	}
	a.accessMu.Lock()
	defer a.accessMu.Unlock()
	if caller != "" && !a.isAdministrator(caller) {
		return AccessRow{}, errAdminDenied
	}
	page, err := broker.AccessRead(ctx, subject)
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
	hint := ""
	switch {
	case current != nil && current.Source == "operator":
		// Root already admits it; only a leftover deny can stand in the way.
	case current != nil && current.LoginHint != "":
		hint = current.LoginHint
	default:
		directory, ok := a.directory()
		if !ok {
			return AccessRow{}, ErrGitHubLookup
		}
		user, err := directory.LookupID(ctx, subject)
		if err != nil {
			return AccessRow{}, err
		}
		if user.Type != "User" || user.ID != subject {
			return AccessRow{}, ErrGitHubNotUser
		}
		hint = user.Login
	}
	a.mu.Lock()
	if caller != "" && !a.isAdministratorLocked(caller) {
		a.mu.Unlock()
		return AccessRow{}, errAdminDenied
	}
	denied := a.deniedLocked(subject)
	if denied {
		// Session records left from before the withdrawal must never come
		// back to life once the deny is lifted.
		if _, err = a.revokeSessionsLocked(subject); err != nil {
			a.mu.Unlock()
			return AccessRow{}, errors.New("session store unavailable")
		}
	}
	a.mu.Unlock()
	row := AccessRow{}
	if current != nil && current.Source == "operator" {
		row = *current
	} else {
		row, err = broker.Admit(ctx, subject, hint, actorFor(caller))
		if errors.Is(err, ErrAccessUncertain) {
			a.log.Warn("access_admission", "outcome", "uncertain", "reason", "broker_reply_missing", "subject", subject)
			return AccessRow{}, ErrAccessUncertain
		}
		if err != nil {
			return AccessRow{}, err
		}
	}
	if denied && a.clearDeny(subject) != nil {
		// Admitted by the broker, still refused here: repeating is safe.
		return AccessRow{}, ErrAccessUncertain
	}
	a.log.Info("access_admission", "outcome", "accepted", "reason", "admitted", "subject", subject)
	return row, nil
}

// accessView joins the broker's admission list with administrators and the
// gateway's denies. A deny with no broker row is listed too, so that nothing
// refusing a person is invisible.
type accessEntry struct {
	ID            string `json:"id"`
	Source        string `json:"source"`
	State         string `json:"state"`
	Username      string `json:"username,omitempty"`
	LoginHint     string `json:"login_hint,omitempty"`
	Actor         string `json:"actor,omitempty"`
	At            string `json:"at,omitempty"`
	LastSeen      string `json:"last_seen,omitempty"`
	Administrator bool   `json:"administrator"`
	Denied        bool   `json:"denied"`
}
type accessView struct {
	SchemaVersion    int           `json:"schema_version"`
	Mode             string        `json:"mode"`
	RuntimeAdmission bool          `json:"runtime_admission"`
	Entries          []accessEntry `json:"entries"`
}

func (a *Auth) accessList(ctx context.Context) (accessView, error) {
	broker, ok := a.accessBroker()
	if !ok {
		return accessView{}, errBrokerRead
	}
	page, err := broker.AccessList(ctx)
	if err != nil {
		return accessView{}, errBrokerRead
	}
	v := a.settingsView()
	seen := a.lastSeen()
	view := accessView{SchemaVersion: 1, Mode: page.Mode, RuntimeAdmission: page.RuntimeAdmission, Entries: []accessEntry{}}
	listed := map[string]bool{}
	for _, r := range page.Rows {
		listed[r.ID] = true
		view.Entries = append(view.Entries, accessEntry{r.ID, r.Source, r.State, r.Username, r.LoginHint, r.Actor, r.At, seen[r.ID], slices.Contains(v.Administrators, r.ID), slices.Contains(v.Denied, r.ID)})
	}
	for _, id := range v.Denied {
		if !listed[id] {
			view.Entries = append(view.Entries, accessEntry{ID: id, Source: "none", State: "denied", Denied: true})
		}
	}
	return view, nil
}

func entryFor(row AccessRow, a *Auth) accessEntry {
	v := a.settingsView()
	return accessEntry{row.ID, row.Source, row.State, row.Username, row.LoginHint, row.Actor, row.At, a.lastSeen()[row.ID], slices.Contains(v.Administrators, row.ID), slices.Contains(v.Denied, row.ID)}
}

// lastSeen is each subject's newest use of a live session. A session's idle
// deadline moves at most once per renewalInterval, so this is accurate to a
// day; once it is capped at the absolute deadline it only bounds the use from
// below. A signed-out or expired session leaves nothing: the gateway keeps no
// sign-in history beside its sessions.
func (a *Auth) lastSeen() map[string]string {
	a.mu.Lock()
	defer a.mu.Unlock()
	seen := map[string]time.Time{}
	if !a.sessionStoreHealthy() {
		return map[string]string{}
	}
	now := a.now()
	for _, s := range a.sessions {
		if !now.Before(s.idle) || !now.Before(s.absolute) {
			continue
		}
		used := s.idle.Add(-sessionIdle)
		if used.Before(s.created) {
			used = s.created
		}
		if used.After(seen[s.identity.Subject]) {
			seen[s.identity.Subject] = used
		}
	}
	out := make(map[string]string, len(seen))
	for subject, t := range seen {
		out[subject] = t.UTC().Format(time.RFC3339)
	}
	return out
}

// accessReason maps an access failure to the fixed wire vocabulary shared by
// the browser and root's control socket.
func accessReason(err error) (int, string) {
	switch {
	case errors.Is(err, errAdminDenied):
		return 403, "admin_required"
	case errors.Is(err, ErrAccessUncertain):
		return 503, "outcome_uncertain"
	case errors.Is(err, ErrAccessDisabled):
		return 409, "runtime_admission_disabled"
	case errors.Is(err, ErrAccessFull):
		return 409, "runtime_admission_full"
	case errors.Is(err, ErrAccessOpen):
		return 409, "admission_open"
	case errors.Is(err, ErrOperatorOwned):
		return 409, "operator_owned"
	case errors.Is(err, ErrAccessDrift):
		return 409, "binding_drift"
	case errors.Is(err, ErrGitHubUserNotFound):
		return 404, "github_user_not_found"
	case errors.Is(err, ErrGitHubNotUser):
		return 409, "github_not_user"
	case errors.Is(err, ErrGitHubLookup):
		return 503, "github_lookup_unavailable"
	case errors.Is(err, errBrokerRead):
		return 503, "broker_unavailable"
	case errors.Is(err, ErrAdministrationState):
		return 503, "administration_unavailable"
	case errors.Is(err, ErrAccessRefused):
		return 409, "access_refused"
	}
	return 503, "access_unavailable"
}

// accessHTTP serves the administrator's access list and its three actions.
// Every write checks the session, CSRF and the administrator role as current.
func (a *Auth) accessHTTP(w http.ResponseWriter, r *http.Request) {
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	path := r.URL.Path
	if !a.exact(r, path) || path != accessPath && path != accessPath+"/lookup" && path != accessPath+"/add" && path != accessPath+"/remove" {
		safe(w, 400, "invalid_request")
		return
	}
	if !a.isAdministrator(s.identity.Subject) {
		safe(w, 403, "admin_required")
		return
	}
	if path == accessPath {
		if r.Method != http.MethodGet {
			safe(w, 405, "method_not_allowed")
			return
		}
		view, err := a.accessList(r.Context())
		if err != nil {
			status, code := accessReason(err)
			safe(w, status, code)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(view)
		return
	}
	if r.Method != http.MethodPost {
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
	var body struct {
		Login string `json:"login"`
		ID    string `json:"id"`
	}
	dec := json.NewDecoder(io.LimitReader(r.Body, 257))
	dec.DisallowUnknownFields()
	if dec.Decode(&body) != nil || dec.Decode(new(any)) != io.EOF || path == accessPath+"/lookup" && (body.ID != "" || !githubLoginName(body.Login)) || path != accessPath+"/lookup" && (body.Login != "" || !canonicalSubject(body.ID)) {
		safe(w, 400, "invalid_request")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	switch path {
	case accessPath + "/lookup":
		user, err := a.lookupLogin(r.Context(), body.Login)
		if err != nil {
			status, code := accessReason(err)
			safe(w, status, code)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"schema_version": 1, "id": user.ID, "login": user.Login, "name": user.Name})
	case accessPath + "/add", accessPath + "/remove":
		var row AccessRow
		var err error
		if path == accessPath+"/add" {
			row, err = a.admitAccess(r.Context(), s.identity.Subject, body.ID)
		} else {
			row, err = a.withdrawAccess(r.Context(), s.identity.Subject, body.ID)
		}
		if err != nil {
			status, code := accessReason(err)
			safe(w, status, code)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"schema_version": 1, "entry": entryFor(row, a)})
	}
}

const accessPath = "/api/v1/server/access"

func (a *Auth) lookupLogin(ctx context.Context, login string) (GitHubUser, error) {
	directory, ok := a.directory()
	if !ok {
		return GitHubUser{}, ErrGitHubLookup
	}
	return directory.LookupLogin(ctx, login)
}

// githubLoginName is GitHub's login grammar: 1–39 ASCII letters, digits and
// single inner hyphens.
func githubLoginName(s string) bool {
	if len(s) < 1 || len(s) > 39 || strings.HasPrefix(s, "-") || strings.HasSuffix(s, "-") || strings.Contains(s, "--") {
		return false
	}
	for _, c := range s {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '-') {
			return false
		}
	}
	return true
}

// accessControl serves root's admin access operations over the control
// socket, with the same checks the browser gets except the session.
func (a *Auth) accessControl(ctx context.Context, payload []byte) ([]byte, error) {
	var r struct {
		Operation string `json:"operation"`
		Subject   string `json:"subject"`
		Login     string `json:"login"`
	}
	dec := json.NewDecoder(strings.NewReader(string(payload)))
	dec.DisallowUnknownFields()
	if dec.Decode(&r) != nil || dec.Decode(new(any)) != io.EOF {
		return nil, errors.New("invalid control request")
	}
	if !a.administrationAvailable() {
		return nil, ErrAdministrationState
	}
	switch r.Operation {
	case "access_list":
		if r.Subject != "" || r.Login != "" {
			break
		}
		view, err := a.accessList(ctx)
		if err != nil {
			return nil, err
		}
		return json.Marshal(view)
	case "access_lookup":
		if r.Subject != "" || !githubLoginName(r.Login) {
			break
		}
		user, err := a.lookupLogin(ctx, r.Login)
		if err != nil {
			return nil, err
		}
		return json.Marshal(map[string]any{"id": user.ID, "login": user.Login, "name": user.Name, "type": "user"})
	case "access_add", "access_remove":
		if r.Login != "" || !canonicalSubject(r.Subject) {
			break
		}
		var row AccessRow
		var err error
		if r.Operation == "access_add" {
			row, err = a.admitAccess(ctx, "", r.Subject)
		} else {
			row, err = a.withdrawAccess(ctx, "", r.Subject)
		}
		if err != nil {
			return nil, err
		}
		return json.Marshal(entryFor(row, a))
	}
	return nil, errors.New("invalid control request")
}

// accessControlError is the control-socket word for an access failure.
func accessControlError(err error) (string, bool) {
	status, code := accessReason(err)
	if code == "access_unavailable" && status == 503 {
		return "", false
	}
	return code, true
}
