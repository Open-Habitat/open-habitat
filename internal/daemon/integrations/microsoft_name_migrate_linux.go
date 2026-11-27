//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"golang.org/x/sys/unix"
)

// The migration to connection names (microsoft_name_linux.go). Before names
// every store of a connection was named by its address; the migration renames
// them to `<address>~<tenant>` at the first check after the upgrade, without a
// new sign-in. The tenant is read from the connection's own files: its Pi
// entries' MS365_MCP_TENANT_ID and its rclone remotes' tenant, which must
// agree where both exist. Nothing is guessed: a bare address whose tenant
// cannot be read stays as it is, asks for a new sign-in, and is removed with
// the connection that replaces it (microsoftRemoveLeftover).
//
// Each step is a rename without replacement or one whole-file write, and the
// name is a function of the address and the tenant the files name, so an
// interrupted migration is recognised from the files alone and finished at
// the next check. The rclone config moves last and the Pi entries after it:
// until then each of them still names the tenant. Tokens, the grant, the
// level, the entries' names, synced directories and fetched files do not
// change. This code goes once the installations that had connections from
// before names have passed it.

// microsoftNameStore is one store of a connection from before names: a
// directory entry named by the key, with a fixed prefix and suffix.
type microsoftNameStore struct{ dir, prefix, suffix string }

// microsoftNameStores in the order the migration renames them.
var microsoftNameStores = []microsoftNameStore{
	{dir: microsoftMCPDir},
	{dir: microsoftMCPDir + "/.pending"},
	{dir: microsoftMCPDir + "/.previous"},
	{dir: microsoftDir + "/bisync"},
	{dir: ".local/share/rclone/microsoft-backups"},
	{dir: refusalDir, prefix: string(Microsoft) + "-", suffix: ".json"},
	{dir: microsoftDir, suffix: ".conf"},
}

func (s microsoftNameStore) entry(key string) string { return s.prefix + key + s.suffix }

// exists says whether the store holds an entry for key.
func (s microsoftNameStore) exists(env Env, key string) (bool, error) {
	fd, err := openHomeDir(env.Home, false, splitPath(s.dir)...)
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	defer unix.Close(fd)
	var st unix.Stat_t
	err = unix.Fstatat(fd, s.entry(key), &st, unix.AT_SYMLINK_NOFOLLOW)
	if errors.Is(err, unix.ENOENT) {
		return false, nil
	}
	return err == nil, err
}

// microsoftBareTenant is the tenant a bare address's own files name,
// lowercase, or "" when they name none, disagree, or do not name a GUID.
func microsoftBareTenant(env Env, address string) (string, error) {
	if !ValidAddress(address) {
		return "", nil
	}
	tenants := map[string]bool{}
	registration, servers, err := microsoftServerOf(env, address)
	if err != nil {
		return "", err
	}
	for _, name := range registration.names() {
		var e struct {
			Env map[string]string `json:"env"`
		}
		if json.Unmarshal(servers[name], &e) != nil {
			return "", nil
		}
		tenants[strings.ToLower(e.Env["MS365_MCP_TENANT_ID"])] = true
	}
	fd, err := openHomeDir(env.Home, false, splitPath(microsoftDir)...)
	if err == nil {
		data, err := readFileAt(fd, address+".conf", maxMicrosoftConfigRead)
		unix.Close(fd)
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return "", err
		}
		_, remotes, _ := microsoftConfigApps(data)
		for _, t := range remotes {
			tenants[strings.ToLower(t)] = true
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return "", err
	}
	if len(tenants) != 1 {
		return "", nil
	}
	for t := range tenants {
		if microsoftTenantGUID.MatchString(t) {
			return t, nil
		}
	}
	return "", nil
}

// microsoftNamePending says whether the address has stores or entries from
// before names that the migration can rename now: their tenant can be read,
// and no store of the name it gives is in the way.
func microsoftNamePending(env Env, address string) bool {
	tenant, err := microsoftBareTenant(env, address)
	if err != nil || tenant == "" {
		return false
	}
	name := microsoftName(address, tenant)
	found := false
	for _, s := range microsoftNameStores {
		from, err := s.exists(env, address)
		if err != nil {
			return false
		}
		if !from {
			continue
		}
		if to, err := s.exists(env, name); err != nil || to {
			return false
		}
		found = true
	}
	if found {
		return true
	}
	registration, _, err := microsoftServerOf(env, address)
	return err == nil && registration.configured()
}

// microsoftMigrateName renames the address's stores and entries to its name
// and returns the name, or "" when there is nothing it can rename. The caller
// holds the native lock with the Microsoft child paused and the account's
// sync stopped; a pass that still runs defers it.
func microsoftMigrateName(ctx context.Context, env Env, address string) (string, error) {
	if !microsoftNamePending(env, address) {
		return "", nil
	}
	tenant, err := microsoftBareTenant(env, address)
	if err != nil || tenant == "" {
		return "", err
	}
	name := microsoftName(address, tenant)
	roots, err := microsoftRemotes(env, address)
	if err != nil {
		return "", err
	}
	for _, r := range roots {
		if microsoftPassRunning(env, address, r.Name) {
			return "", microsoftRecoveryBusy
		}
	}
	for _, s := range microsoftNameStores {
		if s.dir == microsoftDir {
			// Before the config, which names the roots, moves: an
			// interruption after the listings moved still finds them.
			if err := microsoftRenameLocks(env, address, name, roots); err != nil {
				return "", err
			}
		}
		fd, err := openHomeDir(env.Home, false, splitPath(s.dir)...)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			return "", err
		}
		err = unix.Renameat2(fd, s.entry(address), fd, s.entry(name), unix.RENAME_NOREPLACE)
		unix.Close(fd)
		if errors.Is(err, unix.ENOENT) {
			continue
		}
		if err != nil {
			return "", err
		}
	}
	if err := microsoftRenameEntries(ctx, env, address, name); err != nil {
		return "", err
	}
	return name, nil
}

// microsoftRenameLocks points the session a stale bisync lock names at its
// root's new working directory, so rclone still judges an interrupted pass
// by it. A lock that does not parse stays as it is.
func microsoftRenameLocks(env Env, address, name string, roots []microsoftRemote) error {
	for _, r := range roots {
		work := microsoftWork(name, r.Name)
		names, fd, err := listHomeDir(env.Home, work)
		if err != nil {
			return err
		}
		if fd < 0 {
			continue
		}
		from, to := filepath.Join(env.Home, microsoftWork(address, r.Name))+"/", filepath.Join(env.Home, work)+"/"
		for _, n := range names {
			if !strings.HasSuffix(n, ".lck") {
				continue
			}
			data, err := readFileAt(fd, n, 4096)
			if err != nil {
				unix.Close(fd)
				return err
			}
			var lock map[string]any
			if json.Unmarshal(data, &lock) != nil {
				continue
			}
			session, _ := lock["Session"].(string)
			rest, ok := strings.CutPrefix(session, from)
			if !ok {
				continue
			}
			lock["Session"] = to + rest
			data, _ = json.Marshal(lock)
			if err := writeFileAt(fd, n, data, 0600); err != nil {
				unix.Close(fd)
				return err
			}
		}
		unix.Close(fd)
	}
	return nil
}

// microsoftBareAddresses are the addresses that have a store or Pi entries
// from before names.
func microsoftBareAddresses(env Env) ([]string, error) {
	found := map[string]bool{}
	for _, s := range microsoftNameStores {
		names, fd, err := listHomeDir(env.Home, s.dir)
		if err != nil {
			return nil, err
		}
		if fd >= 0 {
			unix.Close(fd)
		}
		for _, n := range names {
			rest, ok := strings.CutPrefix(n, s.prefix)
			a, ok2 := strings.CutSuffix(rest, s.suffix)
			if ok && ok2 && ValidAddress(a) {
				found[a] = true
			}
		}
	}
	_, servers, err := microsoftPiServers(env)
	if err != nil {
		return nil, err
	}
	prefix := filepath.Join(env.Home, microsoftMCPDir) + "/"
	for _, raw := range servers {
		var e struct {
			Env map[string]string `json:"env"`
		}
		if json.Unmarshal(raw, &e) != nil {
			continue
		}
		rest, ok := strings.CutPrefix(e.Env["MS365_MCP_TOKEN_CACHE_PATH"], prefix)
		if a, file, _ := strings.Cut(rest, "/"); ok && file == ".token-cache.json" && ValidAddress(a) {
			found[a] = true
		}
	}
	out := make([]string, 0, len(found))
	for a := range found {
		out = append(out, a)
	}
	sort.Strings(out)
	return out, nil
}

// migrateNames renames every connection from before names that it can, when
// the daemon starts and before any sync client or the Microsoft child runs.
// One that a pass of an earlier daemon still holds is left to Align.
func (m *microsoft) migrateNames(ctx context.Context, env Env, log *slog.Logger) {
	m.native.Lock()
	defer m.native.Unlock()
	addresses, err := microsoftBareAddresses(env)
	if err != nil {
		log.Warn("integration_config_migration", "provider", string(Microsoft), "outcome", "deferred", "change", "connection_name", "reason", "native_unavailable")
		return
	}
	for _, a := range addresses {
		if !microsoftNamePending(env, a) {
			continue
		}
		outcome := "completed"
		if _, err := microsoftMigrateName(ctx, env, a); err != nil {
			outcome = "deferred"
		}
		log.Info("integration_config_migration", "provider", string(Microsoft), "outcome", outcome, "change", "connection_name")
	}
}
