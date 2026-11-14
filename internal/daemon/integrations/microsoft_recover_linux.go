//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

// These options live with the native roots, like habitat_grant. Discovery is
// a one-time repair of pre-fix inventories, not a policy to select future sites.
// A pending root survives a stop between publishing its config and first sync.
const microsoftDiscoveryFixed = "# habitat_sharepoint_discovery: literal-site-id-v1\n"
const microsoftRecoverySelected = "habitat_recovery_selected"

var microsoftRecoveryPassFailed = errors.New("library recovery initial pass failed")
var microsoftRecoveryBusy = errors.New("library recovery native process busy")

func microsoftRecoveryRetry(err error) bool {
	var status microsoftHTTPStatus
	return errors.Is(err, microsoftRecoveryBusy) || errors.Is(err, ServerUnreachable) ||
		(errors.As(err, &status) && (status == 429 || status >= 500))
}

func microsoftRecoveryNeeded(env Env, address string) bool {
	fd, err := openHomeDir(env.Home, false, splitPath(microsoftDir)...)
	if err != nil {
		return false
	}
	defer unix.Close(fd)
	data, err := readFileAt(fd, address+".conf", maxMicrosoftConfigRead)
	if err != nil {
		return false
	}
	roots, err := microsoftRemotes(env, address)
	if err != nil || len(roots) == 0 {
		return false
	}
	if !strings.Contains(string(data), microsoftDiscoveryFixed) || microsoftMigrationNeeded(env, address) {
		return true
	}
	for _, r := range roots {
		if r.RecoverySelected && !microsoftReady(env, address, r) && !listingsFailed(env.Home, microsoftWork(address, r.Name)) {
			return true
		}
	}
	return false
}

// recoverLibraries runs only with the account's supervised client stopped and
// the relay slot held. It first brings a config with a token per root to one
// token (migrate). It preserves existing sections (including the token, grant
// and paths); rediscovery can only append newly offered roots.
func (m *microsoft) recoverLibraries(ctx context.Context, env Env, address string) error {
	m.native.Lock()
	defer m.native.Unlock()
	if err := m.migrate(env, address); err != nil {
		return err
	}
	roots, err := microsoftRemotes(env, address)
	if err != nil {
		return err
	}
	fd, err := openHomeDir(env.Home, false, splitPath(microsoftDir)...)
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	data, err := readFileAt(fd, address+".conf", maxMicrosoftConfigRead)
	if err != nil {
		return err
	}
	if !strings.Contains(string(data), microsoftDiscoveryFixed) {
		// No remote means no rclone grant to refresh. Do not borrow Outlook's
		// credentials or infer a file selection from a mail-only connection.
		if len(roots) == 0 {
			return nil
		}
		n, err := microsoftReadNative(env, address)
		if err != nil {
			return err
		}
		app, _, ok := microsoftAccountApp(env, n)
		if !ok || n.otherApp(app) || n.remotesStale(app) {
			return ToolFailed
		}
		cmd, ok := microsoftCommand(env, address, "about", roots[0].Name+":", "--json")
		if !ok {
			return ToolFailed
		}
		if err, rejected := dropboxStatus(ctx, env, cmd); err != nil {
			if rejected {
				return ToolFailed
			}
			return ServerUnreachable
		}
		// Let rclone refresh and persist its own token before using it for Graph.
		n, err = microsoftReadNative(env, address)
		if err != nil {
			return err
		}
		var token struct {
			Access string `json:"access_token"`
		}
		if json.Unmarshal([]byte(n.token), &token) != nil || token.Access == "" {
			return ToolFailed
		}
		data, err = readFileAt(fd, address+".conf", maxMicrosoftConfigRead)
		if err != nil {
			return err
		}
		var granted []string
		grantRecorded := false
		for _, line := range strings.Split(string(data), "\n") {
			k, v, ok := strings.Cut(line, "=")
			if ok && strings.TrimSpace(k) == grantKey {
				granted = strings.Fields(v)
				grantRecorded = true
				break
			}
		}
		// Before grant recording, these roots were created only with the full
		// files grant. Never substitute that default for an explicitly empty grant.
		if !grantRecorded {
			granted = strings.Fields(microsoftScopes)
		}
		scopes := microsoftGranted(granted)
		// This repair restores followed sites' libraries only.
		l := &microsoftLogin{entry: m, env: env, app: app, address: address, token: []byte(n.token), granted: granted}
		if err := l.discover(ctx, token.Access, scopes); err != nil {
			return err
		}
		all := len(roots) > 0
		existing := map[string]bool{}
		for _, r := range roots {
			existing[r.Name] = true
			all = all && microsoftReady(env, address, r)
		}
		var added strings.Builder
		// Config sections are generated locally by discover, never provider text.
		for _, section := range strings.Split(string(l.config), "\n[")[1:] {
			name, _, _ := strings.Cut(section, "]")
			if existing[name] || name == microsoftAccount {
				continue
			}
			added.WriteString("\n[" + section)
			if all {
				added.WriteString("\n" + microsoftRecoverySelected + " = true\n")
			}
		}
		// A real 403/404 with literal IDs is a completed inventory, not a
		// reason to interrupt healthy sync every minute indefinitely.
		merged := microsoftDiscoveryFixed + string(data) + added.String()
		if len(merged) > maxMicrosoftConfig {
			return ToolFailed
		}
		if err := writeFileAt(fd, address+".conf", []byte(merged), 0600); err != nil {
			return err
		}
		roots, err = microsoftRemotes(env, address)
		if err != nil {
			return err
		}
	}
	for _, r := range roots {
		if !r.RecoverySelected || microsoftReady(env, address, r) {
			continue
		}
		// An abort is not permission to bypass bisync's safeguards.
		work := microsoftWork(address, r.Name)
		if listingsFailed(env.Home, work) {
			return microsoftRecoveryPassFailed
		}
		if err := microsoftInitialPass(ctx, env, address, r); err != nil {
			return errors.Join(microsoftRecoveryPassFailed, err)
		}
	}
	return nil
}

// recoverMicrosoft retries startup discovery after network outages or a busy
// login. The normal relay exclusion also makes removal wait for native work.
func (c *Catalog) recoverMicrosoft(ctx context.Context) {
	accounts, _ := c.accounts()
	delay := c.resumeFirst
	for len(accounts) > 0 && ctx.Err() == nil {
		var pending []listed
		for _, a := range accounts {
			m, ok := a.entry.(*microsoft)
			if !ok || !microsoftRecoveryNeeded(c.env, a.address) {
				continue
			}
			if !c.tryRecoverMicrosoft(ctx, m, a.address) {
				pending = append(pending, a)
			}
		}
		accounts = pending
		if len(accounts) == 0 {
			return
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(delay):
		}
		delay = min(2*delay, c.resumeMax)
	}
}

func (c *Catalog) tryRecoverMicrosoft(ctx context.Context, m *microsoft, address string) bool {
	c.write.Lock()
	if c.stopping || ctx.Err() != nil {
		c.write.Unlock()
		return true
	}
	exists, err := c.has(m, address)
	if err != nil {
		c.write.Unlock()
		return false
	}
	if !exists {
		c.write.Unlock()
		return true
	}
	if c.quota().Full {
		c.write.Unlock()
		return false
	}
	c.relay.mu.Lock()
	if !c.filesFree() {
		c.relay.mu.Unlock()
		c.write.Unlock()
		return false
	}
	runCtx, cancel := context.WithCancel(ctx)
	a := &attempt{id: c.now().UTC().Format("20060102T150405.000000000"), provider: Microsoft, address: address, relogin: true, resume: true, state: "completing", syncing: true, cancel: cancel, until: c.now().Add(100 * 365 * 24 * time.Hour), done: make(chan struct{}), existing: map[string]bool{address: true}}
	c.relay.put(a)
	c.relay.mu.Unlock()
	k := key{Microsoft, address}
	c.sync.stop(k)
	c.write.Unlock()
	// Do not interfere with a native bisync process outside our supervisor.
	roots, err := microsoftRemotes(c.env, address)
	if err == nil {
		for _, r := range roots {
			work := microsoftWork(address, r.Name)
			name, data, state := bisyncLock(c.env, work, c.now())
			switch state {
			case lockHeld:
				err = microsoftRecoveryBusy
			case lockForeign:
				err = ToolFailed
			case lockStale:
				// Stopping our loop can leave a dead process's lock behind.
				// Use the same ownership/change proof as interrupted resume.
				if removeLock(c.env, work, name, data) != nil {
					err = microsoftRecoveryBusy
				}
			}
			// Expired locks belong to rclone's own takeover, not us.
			if err != nil {
				break
			}
		}
	}
	migrating := microsoftMigrationNeeded(c.env, address)
	if err == nil {
		syncCtx := context.WithValue(runCtx, syncProgressKey{}, func(p SyncProgress) { c.setAttempt(a, func() { a.progress = &p }) })
		err = m.recoverLibraries(syncCtx, c.env, address)
	}
	if migrating {
		outcome := "completed"
		if microsoftMigrationNeeded(c.env, address) {
			outcome = "deferred"
		}
		c.log.Info("integration_config_migration", "provider", string(Microsoft), "outcome", outcome, "change", "one_token_per_account")
	}
	removed := c.finishResume(a, err)
	c.write.Lock()
	c.reconcile()
	c.write.Unlock()
	if removed || ctx.Err() != nil {
		return true
	}
	outcome := "completed"
	if err != nil {
		outcome = "failed"
		if microsoftRecoveryRetry(err) && !errors.Is(err, microsoftRecoveryPassFailed) {
			outcome = "deferred"
		}
	}
	attrs := []any{"provider", string(Microsoft), "outcome", outcome}
	// Discovery's step and Graph's allowlisted answer, never provider text.
	var discovery microsoftDiscoveryError
	if errors.As(err, &discovery) {
		attrs = append(attrs, discovery.diagnostic()...)
	}
	c.log.Info("integration_library_recovery", attrs...)
	// A failed initial pass is not blindly repeated while the daemon lives.
	// Its native interrupted state is handled by startup resume, or the
	// person can choose again; a critical abort always remains stopped.
	return errors.Is(err, microsoftRecoveryPassFailed) || !microsoftRecoveryRetry(err)
}
