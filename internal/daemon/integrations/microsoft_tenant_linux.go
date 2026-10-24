//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

// An account's native configs name the application and tenant they were
// signed in with: rclone's remotes refresh through their own `tenant`, and
// Pi's MCP registration starts the Outlook server with its own environment.
// When the operator later sets another tenant for the same application (the
// single-tenant change replaced `common`), the account follows it here, in
// the person's own files, without a new sign-in: the refresh token is
// redeemed at the new tenant first, and only a grant that tenant accepts is
// written. A grant it refuses, or a sign-in made with another application,
// leaves the configs as they are and tells the person to sign in again.

// The reasons an account cannot follow the operator's current application.
// They are login_expired failures on every service of the account.
const (
	// AppChanged: the sign-in was made with another application, whose
	// refresh token the current one cannot redeem. Signing in again does.
	AppChanged = "app_changed"
	// TenantChanged: the current tenant refused the sign-in's grant (expired,
	// revoked, consent or policy). Signing in again does.
	TenantChanged = "tenant_changed"
	// OutsideTenant: the account is not in the tenant's directory, so
	// signing in again cannot help.
	OutsideTenant = "outside_tenant"
)

// AlignEntry keeps an account's native configuration on the operator's
// current application. The catalog calls Align with its write lock held;
// Align calls stop before it changes a file the sync client reads.
type AlignEntry interface {
	Entry
	// Misaligned reports, from files only, whether the account's native
	// configuration names another application than the operator's current
	// one and has not already been refused for it.
	Misaligned(env Env, address string) bool
	// Align brings the configuration to the current application or records
	// why it cannot. An error means it could not be decided now.
	Align(ctx context.Context, env Env, address string, stop func()) error
}

var _ AlignEntry = (*microsoft)(nil)

// microsoftNative is what an account's native configs say about the app.
type microsoftNative struct {
	clients, tenants []string // the rclone remotes'
	token            string   // the remotes' most recently refreshed token
	mcpClient        string   // the Pi registration's, empty when unknown
	mcpTenant        string
}

func (n microsoftNative) remotesStale(app MicrosoftApp) bool {
	for _, t := range n.tenants {
		if !strings.EqualFold(t, app.TenantID) {
			return true
		}
	}
	return len(n.tenants) != len(n.clients)
}

func (n microsoftNative) mcpStale(app MicrosoftApp) bool {
	return n.mcpTenant != "" && !strings.EqualFold(n.mcpTenant, app.TenantID)
}

func (n microsoftNative) otherApp(app MicrosoftApp) bool {
	for _, c := range n.clients {
		if !strings.EqualFold(c, app.ClientID) {
			return true
		}
	}
	return n.mcpClient != "" && !strings.EqualFold(n.mcpClient, app.ClientID)
}

// microsoftReadNative reads the account's rclone config and Pi registration.
// Neither is a secret to the person's own daemon; nothing read here is logged.
func microsoftReadNative(env Env, address string) (microsoftNative, error) {
	var n microsoftNative
	if !ValidAddress(address) {
		return n, ToolFailed
	}
	fd, err := openHomeDir(env.Home, false, splitPath(microsoftDir)...)
	if err == nil {
		data, err := readFileAt(fd, address+".conf", 64<<10)
		unix.Close(fd)
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return n, err
		}
		var newest time.Time
		for _, line := range strings.Split(string(data), "\n") {
			key, value, ok := strings.Cut(line, "=")
			if !ok {
				continue
			}
			value = strings.TrimSpace(value)
			switch strings.TrimSpace(key) {
			case "client_id":
				n.clients = append(n.clients, value)
			case "tenant":
				n.tenants = append(n.tenants, value)
			case "token":
				var t struct {
					Expiry time.Time `json:"expiry"`
				}
				if json.Unmarshal([]byte(value), &t) == nil && (n.token == "" || t.Expiry.After(newest)) {
					n.token, newest = value, t.Expiry
				}
			}
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return n, err
	}

	pi, err := openHomeDir(env.Home, false, ".pi", "agent")
	if errors.Is(err, os.ErrNotExist) {
		return n, nil
	}
	if err != nil {
		return n, err
	}
	defer unix.Close(pi)
	data, err := readFileAt(pi, "mcp.json", 1<<20)
	if errors.Is(err, os.ErrNotExist) {
		return n, nil
	}
	if err != nil {
		return n, err
	}
	var config struct {
		Servers map[string]struct {
			Env map[string]string `json:"env"`
		} `json:"mcpServers"`
	}
	if json.Unmarshal(data, &config) != nil {
		return n, ToolFailed
	}
	server := config.Servers[microsoftServerName(address)]
	n.mcpClient, n.mcpTenant = server.Env["MS365_MCP_CLIENT_ID"], server.Env["MS365_MCP_TENANT_ID"]
	return n, nil
}

type microsoftRefusal struct {
	app    MicrosoftApp
	reason string
}

// refusal is the reason the account cannot follow app, if one was found.
// It lives as long as the daemon: a restart tries again once.
func (m *microsoft) refusal(address string, app MicrosoftApp) string {
	m.alignMu.Lock()
	defer m.alignMu.Unlock()
	r, ok := m.refused[address]
	if !ok || r.app != app {
		return ""
	}
	return r.reason
}

func (m *microsoft) refuse(address string, app MicrosoftApp, reason string) {
	m.alignMu.Lock()
	defer m.alignMu.Unlock()
	if m.refused == nil {
		m.refused = map[string]microsoftRefusal{}
	}
	if reason == "" {
		delete(m.refused, address)
	} else {
		m.refused[address] = microsoftRefusal{app, reason}
	}
}

func (m *microsoft) Misaligned(env Env, address string) bool {
	app, ok := env.microsoftApp()
	if !ok {
		return false
	}
	n, err := microsoftReadNative(env, address)
	if err != nil || !(n.remotesStale(app) || n.mcpStale(app) || n.otherApp(app)) {
		return false
	}
	return m.refusal(address, app) == ""
}

func (m *microsoft) Align(ctx context.Context, env Env, address string, stop func()) error {
	// A native first pass can hold the account's tools for hours; the next
	// check tries again rather than waiting behind it.
	if !m.native.TryLock() {
		return ToolFailed
	}
	defer m.native.Unlock()
	app, ok := env.microsoftApp()
	if !ok {
		return nil
	}
	n, err := microsoftReadNative(env, address)
	if err != nil {
		return err
	}
	if n.otherApp(app) {
		m.refuse(address, app, AppChanged)
		return nil
	}
	if n.remotesStale(app) {
		reason, err := m.redeemAtTenant(ctx, env, app, address, n.token, stop)
		if err != nil {
			return err
		}
		if reason != "" {
			m.refuse(address, app, reason)
			return nil
		}
	}
	if n.mcpStale(app) {
		// The remotes' grant, from the same sign-in as MSAL's, now works at
		// the tenant: the tenant accepts this person. Without remotes, MSAL's
		// own tool is asked through the tenant. Its failure text does not
		// tell a refused grant from an outage (the pinned tool reports
		// "Silent token acquisition failed" for both), so only the phrases
		// that do decide a refusal and anything else is asked again.
		if len(n.clients) == 0 {
			switch microsoftMCPState(ctx, env, address) {
			case StateOK:
			case StateLoginExpired:
				m.refuse(address, app, TenantChanged)
				return nil
			default:
				return ServerUnreachable
			}
		}
		if err := microsoftRegister(ctx, env, app, address); err != nil {
			return err
		}
	}
	m.refuse(address, app, "")
	return nil
}

// redeemAtTenant refreshes the remotes' newest grant at the current tenant
// and, when the tenant accepts it, stops the sync client and writes the
// tenant and the refreshed token into every remote. It returns the refusal
// reason, or an error when the tenant gave no answer about the grant.
func (m *microsoft) redeemAtTenant(ctx context.Context, env Env, app MicrosoftApp, address, stored string, stop func()) (string, error) {
	var old struct {
		Refresh string `json:"refresh_token"`
	}
	if json.Unmarshal([]byte(stored), &old) != nil || old.Refresh == "" {
		return TenantChanged, nil
	}
	var token struct {
		Access  string `json:"access_token"`
		Refresh string `json:"refresh_token"`
		Expires int    `json:"expires_in"`
		Error   string `json:"error"`
		Codes   []int  `json:"error_codes"`
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := m.request(ctx, microsoftAuthority(app)+"token", url.Values{"client_id": {app.ClientID}, "grant_type": {"refresh_token"}, "refresh_token": {old.Refresh}, "scope": {microsoftScopes}}, "", &token); err != nil {
		return "", err
	}
	if token.Error != "" {
		for _, c := range token.Codes {
			// The user is not in the tenant's directory (50020, 50034) or
			// must first be invited into it as a guest (90072).
			if c == 50020 || c == 50034 || c == 90072 {
				return OutsideTenant, nil
			}
		}
		switch token.Error {
		case "invalid_grant", "interaction_required", "consent_required", "invalid_client", "unauthorized_client", "access_denied":
			return TenantChanged, nil
		}
		// temporarily_unavailable and the like decide nothing.
		return "", ServerUnreachable
	}
	if token.Access == "" || token.Expires <= 0 || token.Expires > 86400 {
		return "", ToolFailed
	}
	if token.Refresh == "" {
		token.Refresh = old.Refresh
	}
	fresh, _ := json.Marshal(map[string]any{"access_token": token.Access, "refresh_token": token.Refresh, "token_type": "Bearer", "expiry": time.Now().Add(time.Duration(token.Expires) * time.Second).UTC().Format(time.RFC3339)})

	// rclone writes its refreshed token back into this file; a running
	// client must not save its old tenant's view over the new one.
	stop()

	fd, err := openHomeDir(env.Home, false, splitPath(microsoftDir)...)
	if err != nil {
		return "", err
	}
	defer unix.Close(fd)
	data, err := readFileAt(fd, address+".conf", 64<<10)
	if err != nil {
		return "", err
	}
	// A section runs to the next header; blank lines inside it are rclone's
	// to allow. A missing tenant goes after the section's last key.
	lines := strings.Split(string(data), "\n")
	out := make([]string, 0, len(lines)+4)
	inRemote, hasTenant, last := false, false, 0
	endRemote := func() {
		if inRemote && !hasTenant {
			out = append(out[:last], append([]string{"tenant = " + app.TenantID}, out[last:]...)...)
		}
	}
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]") {
			endRemote()
			inRemote, hasTenant = true, false
			out = append(out, line)
			last = len(out)
			continue
		}
		key, _, ok := strings.Cut(line, "=")
		switch k := strings.TrimSpace(key); {
		case ok && inRemote && k == "tenant":
			line, hasTenant = "tenant = "+app.TenantID, true
		case ok && inRemote && k == "token":
			line = "token = " + string(fresh)
		}
		out = append(out, line)
		if inRemote && trimmed != "" {
			last = len(out)
		}
	}
	endRemote()
	if err := writeFileAt(fd, address+".conf", []byte(strings.Join(out, "\n")), 0600); err != nil {
		return "", err
	}
	return "", nil
}

// microsoftRegister registers, or replaces, the account's Outlook server in
// Pi's MCP configuration with the current application's environment.
func microsoftRegister(ctx context.Context, env Env, app MicrosoftApp, address string) error {
	pi, ok := env.Tool("pi")
	if !ok {
		return ToolFailed
	}
	mcp, ok := microsoftMCPCommand(env, app, microsoftMCPDir+"/"+address, address)
	if !ok {
		return ToolFailed
	}
	args := []string{"mcp", "add", microsoftServerName(address)}
	for _, e := range mcp.Env {
		args = append(args, "--env", e)
	}
	args = append(args, "--", mcp.Path)
	args = append(args, mcp.Args...)
	if _, err := env.run(ctx, Command{Path: pi, Args: args}, nil); err != nil {
		return ToolFailed
	}
	return nil
}

// alignedView shows a refused account as needing a new sign-in, with the
// reason, on every service.
func (m *microsoft) alignedView(env Env, address string, services []Service) {
	app, ok := env.microsoftApp()
	if !ok {
		return
	}
	reason := m.refusal(address, app)
	if reason == "" {
		return
	}
	n, err := microsoftReadNative(env, address)
	if err != nil || !(n.remotesStale(app) || n.mcpStale(app) || n.otherApp(app)) {
		// A new sign-in wrote the current application.
		m.refuse(address, app, "")
		return
	}
	for i := range services {
		services[i].State, services[i].Failure = StateLoginExpired, reason
	}
}
