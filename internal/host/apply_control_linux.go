//go:build linux

package host

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"github.com/Open-Habitat/open-habitat/internal/provision"
	"io"
	"net"
	"slices"
	"time"
)

type applySettings struct {
	Version           int      `json:"version"`
	Name              string   `json:"name"`
	Administrators    []string `json:"administrators"`
	DefaultLimitBytes uint64   `json:"default_limit_bytes"`
	// Pending are declared administrators the gateway grants at the
	// sign-in that binds them.
	Pending []string `json:"pending_administrators"`
	// Designated are roles a browser administrator gave. They are the
	// gateway's own administration, not site.json's, so apply neither
	// removes nor requires them.
	Designated []applyDesignation `json:"designated_administrators"`
}
type applyDesignation struct {
	ID string `json:"id"`
}

func (s applySettings) designated(id string) bool {
	return slices.Contains(s.Designated, applyDesignation{id})
}

func control(ctx context.Context, request any, reply any) error {
	b, e := json.Marshal(request)
	if e != nil || len(b) > 1024 {
		return ErrNativeApply
	}
	d := net.Dialer{Timeout: time.Second}
	c, e := d.DialContext(ctx, "unix", "/run/open-habitat/revoke.sock")
	if e != nil {
		return ErrNativeApply
	}
	defer c.Close()
	c.SetDeadline(time.Now().Add(5 * time.Second))
	if _, e = c.Write(append(append([]byte("ADMIN "), b...), '\n')); e != nil {
		return ErrNativeApply
	}
	// The users reply carries every person's onboarding receipt, up to the
	// gateway's 3 MiB administration state.
	b, e = bufio.NewReader(io.LimitReader(c, 4<<20+1)).ReadBytes('\n')
	if e != nil || bytes.HasPrefix(b, []byte("ERROR ")) {
		return ErrNativeApply
	}
	if json.Unmarshal(b, reply) != nil {
		return ErrNativeApply
	}
	return nil
}
func revokeSubject(ctx context.Context, id string) error {
	d := net.Dialer{Timeout: time.Second}
	c, e := d.DialContext(ctx, "unix", "/run/open-habitat/revoke.sock")
	if e != nil {
		return ErrNativeApply
	}
	defer c.Close()
	c.SetDeadline(time.Now().Add(5 * time.Second))
	if _, e = c.Write([]byte(id + "\n")); e != nil {
		return ErrNativeApply
	}
	b, e := bufio.NewReader(io.LimitReader(c, 64)).ReadString('\n')
	if e != nil || b != "OK\n" {
		return ErrNativeApply
	}
	return nil
}
func waitControl(ctx context.Context) error {
	timer := time.NewTimer(45 * time.Second)
	defer timer.Stop()
	tick := time.NewTicker(200 * time.Millisecond)
	defer tick.Stop()
	for {
		var s applySettings
		if e := control(ctx, map[string]any{"operation": "show"}, &s); e == nil && s.Version == 1 {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timer.C:
			return ErrNativeApply
		case <-tick.C:
		}
	}
}

// admissionPublished reports whether the broker's operator source and switch
// are exactly this site's. Runtime entries are the broker's, not the site's.
func admissionPublished(state provision.InstallationState, s Site) bool {
	return slices.Equal(state.Admission, s.Identities.Admission) && state.RuntimeAdmission == s.Identities.RuntimeAdmission
}

func (n *nativeApply) converge(ctx context.Context) error {
	if e := waitControl(ctx); e != nil {
		return e
	}
	state, e := provision.InspectInstallation(ctx)
	if e != nil {
		return e
	}
	// Revocations occur under the old admission, while the root-owned entry
	// gate denies new HTTP requests. A failed removal never opens that gate.
	// An id the site_admin source still admits stays admitted and keeps its
	// sessions: host apply converges only the operator source.
	for _, id := range state.Admission {
		if !slices.Contains(n.site.Identities.Admission, id) && !state.RuntimeAdmits(id) && slices.Contains(state.BoundSubjects, id) {
			if e = revokeSubject(ctx, id); e != nil {
				return e
			}
		}
	}
	if !admissionPublished(state, n.site) {
		state, e = provision.InspectInstallation(ctx)
		if e != nil {
			return e
		}
		if _, e = provision.PublishAdmission(ctx, state.Token, n.site.Identities.Admission, n.site.Identities.RuntimeAdmission); e != nil {
			return e
		}
	}
	// Root's switch for browser-set app credentials. The broker writes them
	// only under the operation lock this apply holds.
	if e = provision.PublishIntegrationSetup(ctx, n.site.BrowserSetup()); e != nil {
		return e
	}
	// Root's login-shell declaration. Publication moves existing accounts
	// to their required shell, including back to nologin, under the broker
	// lock while entries are closed. Admission is already published: a
	// declared subject must be operator-admitted.
	shell, subjects := n.site.LoginShellPolicy()
	if e = provision.PublishLoginShells(ctx, shell, subjects); e != nil {
		return e
	}
	// The gateway's existing read asks the broker to observe admission. Only the
	// broker may advance its high-water mark, never the installation operator.
	var users []struct {
		ID       string `json:"id"`
		Username string `json:"username"`
	}
	if e = control(ctx, map[string]any{"operation": "users"}, &users); e != nil {
		return e
	}
	state, e = provision.InspectInstallation(ctx)
	if e != nil || state.Epoch != state.ObservedEpoch {
		return ErrNativeApply
	}
	if e = liftOperatorDenies(ctx, control); e != nil {
		return e
	}
	var settings applySettings
	if e = control(ctx, map[string]any{"operation": "show"}, &settings); e != nil {
		return e
	}
	var ack struct {
		OK bool `json:"ok"`
	}
	// Without user quotas the broker sets no limits, so no default exists to
	// converge; the gateway's administrative value is left as it is.
	if n.site.Storage.EnforceUserQuota && settings.DefaultLimitBytes != n.site.Storage.DefaultLimit() {
		if e = control(ctx, map[string]any{"operation": "default_limit", "default_limit_bytes": n.site.Storage.DefaultLimit()}, &ack); e != nil || !ack.OK {
			return ErrNativeApply
		}
	}
	if n.roles, e = convergeRoles(ctx, control, n.site.Identities.Administrators, state.BoundSubjects, settings); e != nil {
		return e
	}
	return n.verifySettings(ctx)
}

// administrationCheck says how much of the gateway's administration must
// equal site.json. Root's administrators come only from site.json, so every
// check that requires them requires exactly the declared ones; a browser
// administrator's designations are the gateway's own and never required. The quota default is
// different: site.json declares it and apply converges it, but a current
// administrator may change it in the browser afterwards, so between applies
// the gateway's value is the live one.
type administrationCheck int

const (
	// administrationConverged is configuration apply's readback after it set
	// site.json's roles and default.
	administrationConverged administrationCheck = iota
	// administrationDeclared is a release upgrade's: it converges nothing, so
	// it requires site.json's roles but neither reverts nor refuses a default
	// an administrator changed since the last apply.
	administrationDeclared
	// administrationCurrent is an accepted upgrade's recovery: entry has
	// reopened, so it validates only that the gateway's current
	// administration is readable, never historical desired roles/defaults.
	administrationCurrent
)

func (n *nativeApply) verifySettings(ctx context.Context) error {
	_, e := n.verifyAdministration(ctx, administrationConverged)
	return e
}

// verifyAdministration reads the gateway's administration back and returns the
// reason naming the first observation that does not satisfy check.
func (n *nativeApply) verifyAdministration(ctx context.Context, check administrationCheck) (string, error) {
	var settings applySettings
	if e := control(ctx, map[string]any{"operation": "show"}, &settings); e != nil {
		return "administration_unavailable", e
	}
	state, e := provision.InspectInstallation(ctx)
	if e != nil {
		return "broker_unavailable", e
	}
	roles, reason := administrationMatches(n.site, settings, state.BoundSubjects, check)
	if roles != nil {
		n.roles = roles
	}
	if reason != "" {
		return reason, ErrNativeApply
	}
	return "", nil
}

func administrationMatches(s Site, settings applySettings, bound []string, check administrationCheck) ([]AdministratorOutcome, string) {
	if settings.Version != 1 {
		return nil, "administration_version_unsupported"
	}
	// Without user quotas the broker sets no limits and apply leaves the
	// gateway's default alone, so there is nothing to require of it.
	if s.Storage.EnforceUserQuota {
		live := settings.DefaultLimitBytes
		switch {
		case check == administrationConverged && live != s.Storage.DefaultLimit():
			return nil, "default_limit_not_applied"
		case live < 1<<20 || live > 1<<50 || live%1024 != 0:
			return nil, "default_limit_invalid"
		}
	}
	want := []string{}
	roles := []AdministratorOutcome{}
	for _, id := range s.Identities.Administrators {
		if slices.Contains(bound, id) {
			want = append(want, id)
			roles = append(roles, AdministratorOutcome{id, "granted"})
		} else {
			roles = append(roles, AdministratorOutcome{id, "deferred_until_bound"})
		}
	}
	got := slices.DeleteFunc(slices.Clone(settings.Administrators), func(id string) bool {
		return settings.designated(id) && !slices.Contains(want, id)
	})
	slices.Sort(got)
	slices.Sort(want)
	if !slices.Equal(got, want) {
		return roles, "administrators_not_applied"
	}
	// A pending declaration is authority the gateway will grant on its own,
	// so it must be one site.json still makes. A declaration missing from an
	// installation that predates pending declarations is not required: such
	// a person is granted by the next deliberate apply after binding.
	for _, id := range settings.Pending {
		if !slices.Contains(s.Identities.Administrators, id) {
			return roles, "administrators_not_applied"
		}
	}
	return roles, ""
}

// convergeRoles makes the gateway's root-given administrators exactly
// site.json's declared ones that are bound, and records each declared but
// unbound one as pending, which the gateway grants at the sign-in that
// creates its binding. Roles and pending declarations site.json no longer
// makes are removed. A role a browser administrator designated is left as it
// is, unless site.json declares the same id: then root's operation takes it
// over, so the browser can no longer revoke a role site.json gives.
func convergeRoles(ctx context.Context, exchange func(context.Context, any, any) error, declared, bound []string, settings applySettings) ([]AdministratorOutcome, error) {
	var ack struct {
		OK bool `json:"ok"`
	}
	set := func(operation, id string, administrator bool) error {
		ack.OK = false
		if e := exchange(ctx, map[string]any{"operation": operation, "subject": id, "administrator": administrator}, &ack); e != nil || !ack.OK {
			return ErrNativeApply
		}
		return nil
	}
	for _, id := range settings.Administrators {
		if !slices.Contains(declared, id) && !settings.designated(id) {
			if e := set("role", id, false); e != nil {
				return nil, e
			}
		}
	}
	// An obsolete declaration is withdrawn with a role removal, which drops the
	// pending entry and any grant a sign-in made from it since settings was read.
	for _, id := range settings.Pending {
		if !slices.Contains(declared, id) {
			if e := set("role", id, false); e != nil {
				return nil, e
			}
		}
	}
	roles := []AdministratorOutcome{}
	for _, id := range declared {
		if !slices.Contains(bound, id) {
			if e := set("role_declared", id, true); e != nil {
				return nil, e
			}
			roles = append(roles, AdministratorOutcome{id, "deferred_until_bound"})
			continue
		}
		if !slices.Contains(settings.Administrators, id) || settings.designated(id) {
			if e := set("role", id, true); e != nil {
				return nil, e
			}
		}
		roles = append(roles, AdministratorOutcome{id, "granted"})
	}
	return roles, nil
}

// liftOperatorDenies restores web access for ids site.json now admits but a
// browser withdrawal left denied in the gateway: root's admission is the
// operator source's, and the gateway deny must not silently reduce it. The
// gateway's own restore removes leftover sessions before lifting the deny.
func liftOperatorDenies(ctx context.Context, exchange func(context.Context, any, any) error) error {
	var view struct {
		SchemaVersion int `json:"schema_version"`
		Entries       []struct {
			ID     string `json:"id"`
			Source string `json:"source"`
			Denied bool   `json:"denied"`
		} `json:"entries"`
	}
	if e := exchange(ctx, map[string]any{"operation": "access_list"}, &view); e != nil || view.SchemaVersion != 1 {
		return ErrNativeApply
	}
	for _, entry := range view.Entries {
		if entry.Source != "operator" || !entry.Denied {
			continue
		}
		var row struct {
			ID     string `json:"id"`
			Denied bool   `json:"denied"`
		}
		if e := exchange(ctx, map[string]any{"operation": "access_add", "subject": entry.ID}, &row); e != nil || row.ID != entry.ID || row.Denied {
			return ErrNativeApply
		}
	}
	return nil
}
