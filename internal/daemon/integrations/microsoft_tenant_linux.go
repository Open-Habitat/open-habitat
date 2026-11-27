//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"slices"
	"strings"
	"time"

	"golang.org/x/sys/unix"

	"github.com/open-habitat/open-habitat/internal/msmcp"
)

// A connection's native configs name the application and tenant they were
// signed in with: rclone's remotes refresh through their own `tenant`, and
// Pi's entries start the Outlook server with their own environment. The
// tenant is also part of the connection's name, and a connection is never
// moved to another tenant: when the operator's sections no longer have an
// application at the name's tenant, the connection reports tenant_removed
// and nothing is redeemed anywhere else. Signing in at another tenant makes
// another connection. Within its tenant a connection uses the application
// its configs name (the cell of that client id); another client id there is
// app_changed, which signing in again repairs.

// The reasons a connection cannot run with the operator's current
// applications. They are login_expired failures on every service.
const (
	// AppChanged: the sign-in was made with another application of the
	// tenant, whose refresh token the current one cannot redeem. Signing in
	// again does.
	AppChanged = "app_changed"
	// TenantRemoved: the operator has no application at the connection's
	// tenant now. Signing in again from the card cannot help; adding the
	// tenant back resumes the connection without a sign-in.
	TenantRemoved = "tenant_removed"
	// OutsideTenant: the account is not in the tenant's directory, so
	// signing in again cannot help.
	OutsideTenant = "outside_tenant"
)

// AlignEntry keeps an account's native configuration in the form this
// release writes. The catalog calls Align with its write lock held; Align
// calls stop before it changes a file the sync client reads.
type AlignEntry interface {
	Entry
	// Misaligned reports, from files only, whether the account's native
	// configuration needs Align.
	Misaligned(env Env, address string) bool
	// Align brings the configuration to the current form. An error means
	// it could not be done now.
	Align(ctx context.Context, env Env, address string, stop func()) error
}

var _ AlignEntry = (*microsoft)(nil)

// microsoftNative is what a connection's native configs say about the app.
type microsoftNative struct {
	clients, tenants []string // the rclone remotes'
	token            string   // the remotes' most recently refreshed token
	mcpClient        string   // the Pi registration's, empty when unknown
	mcpTenant        string
	mcpAllowed       string   // the registration's --allowed-scopes, from its grant
	mcpArgs          []string // a single entry's server arguments
	// mcpPin is the identity the registration's server accepts.
	mcpPin microsoftPin
	// mcpReshape: the registration is current in what it allows but not
	// in form (a single entry of an earlier release, or area entries this
	// release would write differently), so it is rewritten as area
	// entries with its own native environment, without a new sign-in.
	mcpReshape bool
}

// client is the application the configs were signed in with.
func (n microsoftNative) client() string {
	if n.mcpClient != "" {
		return n.mcpClient
	}
	if len(n.clients) > 0 {
		return n.clients[0]
	}
	return ""
}

// mcpOutdated is a single entry an earlier release wrote without the
// current tool list (the Outlook presets before agents searched files):
// what it allows has to be asked of the tenant again.
func (n microsoftNative) mcpOutdated() bool {
	return n.mcpClient != "" && n.mcpArgs != nil && !slices.Equal(n.mcpArgs, microsoftMCPArgs(n.mcpAllowed))
}

func (n microsoftNative) otherApp(app MicrosoftApp) bool {
	for _, c := range n.clients {
		if !strings.EqualFold(c, app.ClientID) {
			return true
		}
	}
	return n.mcpClient != "" && !strings.EqualFold(n.mcpClient, app.ClientID)
}

// otherTenant: a config names another tenant than the connection's name.
func (n microsoftNative) otherTenant(tenant string) bool {
	if tenant == "" {
		return false
	}
	for _, t := range n.tenants {
		if !strings.EqualFold(t, tenant) {
			return true
		}
	}
	return n.mcpTenant != "" && !strings.EqualFold(n.mcpTenant, tenant)
}

// pin is the identity the connection's server and verification accept: the
// registration's own pin, or for configs without one the address, as
// before immutable pins.
func (n microsoftNative) pin(key string) microsoftPin {
	if n.mcpPin.home != "" || n.mcpPin.username != "" {
		return n.mcpPin
	}
	return microsoftPin{username: microsoftAddressOf(key)}
}

// microsoftAccountApp is the configured application a connection runs with
// and its level, from the operator's file at this moment: the cell of the
// name's tenant whose client id its configs name. When the tenant has
// cells but none with that client id (or the configs disagree with the
// name), it is the tenant's broadest cell with app_changed, which a new
// sign-in at that cell repairs. When the tenant has none, ok is false and
// the reason is tenant_removed. A bare address from before names is in the
// tenant its files name; one whose tenant cannot be read is app_changed with
// the broadest application, so its tools do not run and a sign-in replaces it.
func microsoftAccountApp(env Env, key string, n microsoftNative) (app MicrosoftApp, level Level, reason string, ok bool) {
	apps := env.microsoftApps()
	tenant := microsoftTenantOf(key)
	unresolved := false
	if tenant == "" {
		// A bare address awaiting its name is in the tenant its files name.
		// One whose files name none, or two, is not guessed: its tools do
		// not run and it asks for the sign-in that replaces it.
		tenant, _ = microsoftBareTenant(env, key)
		unresolved = tenant == ""
	}
	if len(apps) == 0 {
		if tenant != "" && !unresolved {
			return MicrosoftApp{}, "", TenantRemoved, false
		}
		return MicrosoftApp{}, "", "", false
	}
	if unresolved {
		for _, l := range microsoftLevels {
			if a, has := apps[l]; has {
				return a, l, AppChanged, true
			}
		}
	}
	client := n.client()
	var first Level
	for _, l := range microsoftLevels {
		a, has := apps[l]
		if !has || (tenant != "" && !strings.EqualFold(a.TenantID, tenant)) {
			continue
		}
		if first == "" {
			first = l
		}
		if client != "" && strings.EqualFold(a.ClientID, client) {
			app, level = a, l
			break
		}
	}
	if first == "" {
		return MicrosoftApp{}, "", TenantRemoved, false
	}
	if level == "" {
		app, level = apps[first], first
		if client != "" {
			reason = AppChanged
		}
	}
	if reason == "" && (n.otherApp(app) || n.otherTenant(tenant)) {
		reason = AppChanged
	}
	return app, level, reason, true
}

// microsoftAppOf reads the connection's native configs for microsoftAccountApp.
func microsoftAppOf(env Env, key string) (MicrosoftApp, Level, string, bool) {
	n, err := microsoftReadNative(env, key)
	if err != nil {
		return MicrosoftApp{}, "", "", false
	}
	return microsoftAccountApp(env, key, n)
}

// microsoftReadNative reads the connection's rclone config and Pi registration.
// Neither is a secret to the person's own daemon; nothing read here is logged.
func microsoftReadNative(env Env, key string) (microsoftNative, error) {
	var n microsoftNative
	if !validMicrosoftAccount(key) {
		return n, ToolFailed
	}
	fd, err := openHomeDir(env.Home, false, splitPath(microsoftDir)...)
	if err == nil {
		data, err := readFileAt(fd, key+".conf", maxMicrosoftConfigRead)
		unix.Close(fd)
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return n, err
		}
		n.clients, n.tenants, n.token = microsoftConfigApps(data)
	} else if !errors.Is(err, os.ErrNotExist) {
		return n, err
	}

	registration, servers, err := microsoftServerOf(env, key)
	if err != nil {
		return n, err
	}
	var server struct {
		Env  map[string]string `json:"env"`
		Args []string          `json:"args"`
	}
	// The area entries are read first; a single entry left beside them
	// by an interrupted migration goes at the next registration.
	name, single := registration.areas["files"], false
	for _, area := range msmcp.AreaNames() {
		if name == "" {
			name = registration.areas[area]
		}
	}
	if name == "" && len(registration.old) > 0 {
		name, single = registration.old[0], true
	}
	if raw := servers[name]; raw != nil && json.Unmarshal(raw, &server) != nil {
		return n, ToolFailed
	}
	n.mcpClient, n.mcpTenant = server.Env["MS365_MCP_CLIENT_ID"], server.Env["MS365_MCP_TENANT_ID"]
	n.mcpPin = microsoftPin{home: server.Env[microsoftHomeEnv], username: server.Env[microsoftUsernameEnv]}
	if single {
		n.mcpArgs = server.Args
		if n.mcpArgs == nil {
			n.mcpArgs = []string{}
		}
		for i, a := range server.Args {
			if a == "--allowed-scopes" && i+1 < len(server.Args) {
				n.mcpAllowed = server.Args[i+1]
			}
		}
	} else {
		n.mcpAllowed = server.Env[microsoftAllowedEnv]
	}
	if n.mcpClient != "" && !n.mcpOutdated() {
		app := MicrosoftApp{ClientID: n.mcpClient, TenantID: n.mcpTenant}
		n.mcpReshape = !microsoftAreasCurrent(env, servers, registration, app, key, n.mcpAllowed, n.pin(key))
	}
	return n, nil
}

// microsoftConfigApps reads the remotes' client ids and tenants from an
// rclone config, and the token rclone refreshed last.
func microsoftConfigApps(data []byte) (clients, tenants []string, token string) {
	var newest time.Time
	for _, line := range strings.Split(string(data), "\n") {
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		value = strings.TrimSpace(value)
		switch strings.TrimSpace(key) {
		case "client_id":
			clients = append(clients, value)
		case "tenant":
			tenants = append(tenants, value)
		case "token":
			var t struct {
				Expiry time.Time `json:"expiry"`
			}
			if json.Unmarshal([]byte(value), &t) == nil && (token == "" || t.Expiry.After(newest)) {
				token, newest = value, t.Expiry
			}
		}
	}
	return clients, tenants, token
}

func (m *microsoft) Misaligned(env Env, key string) bool {
	if microsoftNamePending(env, microsoftAddressOf(key)) {
		return true
	}
	n, err := microsoftReadNative(env, key)
	if err != nil {
		return false
	}
	if n.mcpReshape && env.Relay != "" {
		return true
	}
	_, _, reason, ok := microsoftAccountApp(env, key, n)
	return ok && reason == "" && n.mcpOutdated()
}

func (m *microsoft) Align(ctx context.Context, env Env, key string, stop func()) error {
	// A native first pass can hold the account's tools for hours; the next
	// check tries again rather than waiting behind it.
	if !m.native.TryLock() {
		return ToolFailed
	}
	defer m.native.Unlock()
	resume, err := m.pause(ctx)
	if err != nil {
		return ServerUnreachable
	}
	defer resume()
	// A connection of the form before names gets its name first, a step of
	// its own: the catalog lists it under the new name afterwards.
	if address := microsoftAddressOf(key); microsoftNamePending(env, address) {
		// rclone reads the config and the listings that move.
		stop()
		_, err := microsoftMigrateName(ctx, env, address)
		return err
	}
	// A registration of an earlier form (one entry, under whichever name)
	// becomes the five area entries first, keeping its own native
	// environment: no sign-in, nothing else changes. It is a step of its
	// own: the catalog rewrites the skill after a successful Align, so a
	// later failure here must not leave the skill naming entries that do
	// not exist. Anything else misaligned follows at the next check.
	n, err := microsoftReadNative(env, key)
	if err != nil {
		return err
	}
	if n.mcpReshape && env.Relay != "" {
		allowed := n.mcpAllowed
		if allowed == "" {
			allowed = microsoftMCPScopes
		}
		return microsoftRegister(ctx, env, MicrosoftApp{ClientID: n.mcpClient, TenantID: n.mcpTenant}, key, allowed, n.pin(key))
	}
	app, _, reason, ok := microsoftAccountApp(env, key, n)
	if !ok || reason != "" || !n.mcpOutdated() {
		// A connection that cannot run is shown so (alignedView); nothing
		// here may move it to another application or tenant.
		return nil
	}
	// An earlier release's registration also leaves out files, so the
	// tenant's current grant decides which tools it now offers; a refused
	// grant keeps the Outlook scopes until the next sign-in.
	allowed := microsoftAllowed(microsoftGranted(strings.Fields(n.mcpAllowed)))
	if n.mcpAllowed == "" {
		allowed = microsoftMCPScopes
	}
	switch state, scopes := microsoftVerify(ctx, env, key, false); state {
	case "ok":
		if len(scopes) > 0 {
			allowed = microsoftAllowed(microsoftGranted(scopes))
		}
	case "refused", "outside_tenant":
	default:
		return ServerUnreachable
	}
	return microsoftRegister(ctx, env, app, key, allowed, n.pin(key))
}

// alignedView shows a connection that cannot run with the operator's
// current applications as needing a new sign-in, with the reason, on every
// service. It is read from the files and the operator's file each time, so
// a section added back resumes the connection at the next check.
func (m *microsoft) alignedView(env Env, key string, services []Service) {
	n, err := microsoftReadNative(env, key)
	if err != nil {
		return
	}
	_, _, reason, _ := microsoftAccountApp(env, key, n)
	if reason == "" {
		return
	}
	for i := range services {
		services[i].State, services[i].Failure = StateLoginExpired, reason
	}
}
