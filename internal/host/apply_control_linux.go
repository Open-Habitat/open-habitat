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
func (n *nativeApply) verifySettings(ctx context.Context) error {
	var settings applySettings
	if e := control(ctx, map[string]any{"operation": "show"}, &settings); e != nil {
		return e
	}
	if settings.Version != 1 || n.site.Storage.EnforceUserQuota && settings.DefaultLimitBytes != n.site.Storage.DefaultLimit() {
		return ErrNativeApply
	}
	state, e := provision.InspectInstallation(ctx)
	if e != nil {
		return e
	}
	want := []string{}
	n.roles = []AdministratorOutcome{}
	for _, id := range n.site.Identities.Administrators {
		if slices.Contains(state.BoundSubjects, id) {
			want = append(want, id)
			n.roles = append(n.roles, AdministratorOutcome{id, "granted"})
		} else {
			n.roles = append(n.roles, AdministratorOutcome{id, "deferred_until_bound"})
		}
	}
	slices.Sort(settings.Administrators)
	slices.Sort(want)
	if !slices.Equal(settings.Administrators, want) {
		return ErrNativeApply
	}
	// A pending declaration is authority the gateway will grant on its own,
	// so it must be one site.json still makes. A declaration missing from an
	// installation that predates pending declarations is not required: such
	// a person is granted by the next deliberate apply after binding.
	for _, id := range settings.Pending {
		if !slices.Contains(n.site.Identities.Administrators, id) {
			return ErrNativeApply
		}
	}
	return nil
}

// convergeRoles makes the gateway's administrators exactly site.json's
// declared ones that are bound, and records each declared but unbound one as
// pending, which the gateway grants at the sign-in that creates its binding.
// Roles and pending declarations site.json no longer makes are removed.
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
		if !slices.Contains(declared, id) {
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
		if !slices.Contains(settings.Administrators, id) {
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
