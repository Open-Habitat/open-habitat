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
	b, e = bufio.NewReader(io.LimitReader(c, 131073)).ReadBytes('\n')
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
	if settings.DefaultLimitBytes != n.site.Storage.DefaultLimitBytes {
		if e = control(ctx, map[string]any{"operation": "default_limit", "default_limit_bytes": n.site.Storage.DefaultLimitBytes}, &ack); e != nil || !ack.OK {
			return ErrNativeApply
		}
	}
	for _, id := range settings.Administrators {
		if !slices.Contains(n.site.Identities.Administrators, id) {
			if e = control(ctx, map[string]any{"operation": "role", "subject": id, "administrator": false}, &ack); e != nil || !ack.OK {
				return ErrNativeApply
			}
		}
	}
	n.roles = []AdministratorOutcome{}
	for _, id := range n.site.Identities.Administrators {
		if !slices.Contains(state.BoundSubjects, id) {
			n.roles = append(n.roles, AdministratorOutcome{id, "deferred_until_bound"})
			continue
		}
		if !slices.Contains(settings.Administrators, id) {
			if e = control(ctx, map[string]any{"operation": "role", "subject": id, "administrator": true}, &ack); e != nil || !ack.OK {
				return ErrNativeApply
			}
		}
		n.roles = append(n.roles, AdministratorOutcome{id, "granted"})
	}
	return n.verifySettings(ctx)
}
func (n *nativeApply) verifySettings(ctx context.Context) error {
	var settings applySettings
	if e := control(ctx, map[string]any{"operation": "show"}, &settings); e != nil {
		return e
	}
	if settings.Version != 1 || settings.DefaultLimitBytes != n.site.Storage.DefaultLimitBytes {
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
	return nil
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
