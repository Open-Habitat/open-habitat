package gateway

import (
	"context"
	"errors"
	"slices"
	"time"
)

// An administrator's own role write (Jari, 2026-10-30): a browser
// administrator names someone on the access list as administrator before or
// after their first sign-in. The role is recorded by the GitHub account's
// numeric id, never its login, and granted only to a sign-in the broker has
// bound to that id, exactly as root's site.json declarations are, so a
// renamed or reused login never inherits it. Designations are a second role
// source beside root's, the way site_admin admission is beside operator
// admission: host apply converges only root's roles and leaves these alone,
// and the browser can revoke only these, never a role site.json gives.

// designation is one role a browser administrator gave: pending until its
// subject is in Administrators, granted after.
type designation struct {
	ID    string `json:"id"`
	Actor string `json:"actor"`
	At    string `json:"at"`
}

// errNotAdmitted refuses a designation for an id that cannot sign in: no
// admission row, a withdrawn one, or a gateway deny.
var errNotAdmitted = errors.New("subject is not admitted")

func validDesignations(s serverSettings) bool {
	if len(s.Designated) > 1024 {
		return false
	}
	seen := map[string]bool{}
	for _, d := range s.Designated {
		if !canonicalSubject(d.ID) || seen[d.ID] || !canonicalSubject(d.Actor) || slices.Contains(s.PendingAdministrators, d.ID) {
			return false
		}
		if _, e := time.Parse(time.RFC3339, d.At); e != nil {
			return false
		}
		seen[d.ID] = true
	}
	return true
}

func (a *Auth) designatedLocked(id string) bool {
	return slices.ContainsFunc(a.settings.Designated, func(d designation) bool { return d.ID == id })
}

func withoutDesignation(ds []designation, id string) []designation {
	out := slices.DeleteFunc(slices.Clone(ds), func(d designation) bool { return d.ID == id })
	if len(out) == 0 {
		return nil
	}
	return out
}

// roleEntry is an access row's administrator role and where it comes from.
type roleEntry struct {
	Source string `json:"source"`
	State  string `json:"state"`
	Actor  string `json:"actor,omitempty"`
	At     string `json:"at,omitempty"`
}

func roleFor(v serverSettings, id string) *roleEntry {
	granted := slices.Contains(v.Administrators, id)
	for _, d := range v.Designated {
		if d.ID == id {
			state := "pending"
			if granted {
				state = "granted"
			}
			return &roleEntry{"site_admin", state, d.Actor, d.At}
		}
	}
	switch {
	case granted:
		return &roleEntry{Source: "operator", State: "granted"}
	case slices.Contains(v.PendingAdministrators, id):
		return &roleEntry{Source: "operator", State: "pending"}
	}
	return nil
}

// designateAdministrator gives subject the administrator role from caller,
// a current administrator. A bound subject holds it at once; any other
// holds it from the sign-in that binds it. The designation is recorded
// before the binding is looked up, and the login callback grants after its
// broker recheck, so a binding created concurrently is granted by one of
// the two. A subject that already has a role keeps the one it has.
func (a *Auth) designateAdministrator(ctx context.Context, caller, subject string) (AccessRow, error) {
	if !canonicalSubject(subject) || !canonicalSubject(caller) {
		return AccessRow{}, errors.New("invalid subject")
	}
	broker, ok := a.accessBroker()
	if !ok {
		return AccessRow{}, errBrokerRead
	}
	// Serialised with admission changes, so a withdrawal that deletes the
	// subject's admission cannot leave a designation behind it unseen.
	a.accessMu.Lock()
	defer a.accessMu.Unlock()
	if !a.isAdministrator(caller) {
		return AccessRow{}, errAdminDenied
	}
	page, err := broker.AccessRead(ctx, subject)
	if err != nil {
		return AccessRow{}, errBrokerRead
	}
	if len(page.Rows) != 1 || page.Rows[0].State != "allowed" && page.Rows[0].State != "joined" {
		return AccessRow{}, errNotAdmitted
	}
	row := page.Rows[0]
	a.mu.Lock()
	if !a.isAdministratorLocked(caller) {
		a.mu.Unlock()
		return AccessRow{}, errAdminDenied
	}
	if !a.administrationHealthy() {
		a.mu.Unlock()
		return AccessRow{}, ErrAdministrationState
	}
	if a.deniedLocked(subject) {
		a.mu.Unlock()
		return AccessRow{}, errNotAdmitted
	}
	if roleFor(a.settings, subject) == nil {
		next := a.settings
		next.Designated = append(slices.Clone(next.Designated), designation{subject, caller, a.now().UTC().Format(time.RFC3339)})
		if err = a.commitAdministration(next); err != nil {
			a.mu.Unlock()
			return AccessRow{}, err
		}
		a.log.Info("administrator_designation", "outcome", "accepted", "reason", "designated", "subject", subject, "actor", caller)
	}
	waiting := a.designatedLocked(subject) && !slices.Contains(a.settings.Administrators, subject)
	a.mu.Unlock()
	if !waiting {
		return row, nil
	}
	reader, ok := a.broker.(BrokerReader)
	if !ok {
		return row, nil
	}
	if bound, e := reader.LookupBound(ctx, subject); e != nil || !bound {
		// Still pending: the sign-in that binds the subject grants it.
		return row, nil
	}
	a.mu.Lock()
	err = a.grantPendingLocked(subject)
	a.mu.Unlock()
	if err != nil {
		return AccessRow{}, err
	}
	return row, nil
}

// revokeDesignation removes a role a browser administrator gave, pending or
// granted. The role ends at once: every administrator check reads the
// current record. A role site.json gives is refused as root's.
func (a *Auth) revokeDesignation(ctx context.Context, caller, subject string) (AccessRow, error) {
	if !canonicalSubject(subject) || !canonicalSubject(caller) {
		return AccessRow{}, errors.New("invalid subject")
	}
	broker, ok := a.accessBroker()
	if !ok {
		return AccessRow{}, errBrokerRead
	}
	a.accessMu.Lock()
	defer a.accessMu.Unlock()
	if !a.isAdministrator(caller) {
		return AccessRow{}, errAdminDenied
	}
	// The reply's row is read first, so a broker that fails after the
	// change cannot turn a committed revocation into an error.
	page, err := broker.AccessRead(ctx, subject)
	if err != nil {
		return AccessRow{}, errBrokerRead
	}
	row := AccessRow{ID: subject, Source: "none", State: "unlisted"}
	if len(page.Rows) == 1 {
		row = page.Rows[0]
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if len(page.Rows) == 0 && a.deniedLocked(subject) {
		// The list shows a bare deny as denied; the reply must not hide it.
		row.State = "denied"
	}
	if !a.isAdministratorLocked(caller) {
		return AccessRow{}, errAdminDenied
	}
	if !a.administrationHealthy() {
		return AccessRow{}, ErrAdministrationState
	}
	role := roleFor(a.settings, subject)
	switch {
	case role == nil:
		return row, nil
	case role.Source != "site_admin":
		return AccessRow{}, ErrOperatorOwned
	}
	next := a.settings
	next.Designated = withoutDesignation(next.Designated, subject)
	next.Administrators = withoutSubject(next.Administrators, subject)
	if err = a.commitAdministration(next); err != nil {
		return AccessRow{}, err
	}
	a.log.Info("administrator_designation", "outcome", "accepted", "reason", "revoked", "subject", subject, "actor", caller)
	return row, nil
}

// dropDesignationLocked forgets a never-granted designation whose admission
// was just deleted: nobody can sign in as it any more, and re-admitting the
// id later must not bring a role back with it.
func (a *Auth) dropDesignationLocked(subject string) error {
	if !a.administrationHealthy() || !a.designatedLocked(subject) || slices.Contains(a.settings.Administrators, subject) {
		return nil
	}
	next := a.settings
	next.Designated = withoutDesignation(next.Designated, subject)
	return a.commitAdministration(next)
}
