//go:build linux

package integrations

import (
	"encoding/json"
	"errors"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

// microsoftMigrate rewrites a config whose roots are each their own rclone
// remote with their own copy of the token into the account remote and one
// alias per root (microsoftAccount). The account takes the application,
// tenant and token of the root whose token rclone refreshed last; a root
// keeps its own path, label and recovery choice. The grant moves to the
// account when every root recorded the same one, and otherwise stays with
// each root so no root changes its sync direction. Lines before the first
// section, such as the discovery marker, are kept.
func microsoftMigrate(data []byte, address string) ([]byte, error) {
	roots, legacy, err := microsoftParseRoots(data, address)
	if err != nil || len(legacy) == 0 {
		return nil, ToolFailed
	}
	type section struct {
		name string
		keys map[string]string
	}
	var head []string
	var sections []section
	for _, line := range strings.Split(string(data), "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]") {
			sections = append(sections, section{strings.Trim(trimmed, "[]"), map[string]string{}})
			continue
		}
		if len(sections) == 0 {
			if trimmed != "" {
				head = append(head, line)
			}
			continue
		}
		if key, value, ok := strings.Cut(trimmed, "="); ok {
			sections[len(sections)-1].keys[strings.TrimSpace(key)] = strings.TrimSpace(value)
		}
	}
	var account map[string]string
	var newest time.Time
	grants := map[string]bool{}
	for _, s := range sections {
		if s.name == microsoftAccount {
			// A config written after this form has no root of its own kind.
			return nil, ToolFailed
		}
		var t struct {
			Expiry time.Time `json:"expiry"`
		}
		if json.Unmarshal([]byte(s.keys["token"]), &t) != nil || s.keys["client_id"] == "" || s.keys["tenant"] == "" {
			return nil, ToolFailed
		}
		if account == nil || t.Expiry.After(newest) {
			account, newest = s.keys, t.Expiry
		}
		// An unrecorded grant is its own kind: such a root syncs both ways.
		grant, recorded := s.keys[grantKey]
		if !recorded {
			grant = "\x00"
		}
		grants[strings.Join(strings.Fields(grant), " ")] = true
	}
	shared := len(grants) == 1
	_, accountGrant := account[grantKey]
	var b strings.Builder
	for _, line := range head {
		b.WriteString(line + "\n")
	}
	b.WriteString("[" + microsoftAccount + "]\ntype = onedrive\nclient_id = " + account["client_id"] + "\nregion = global\ntenant = " + account["tenant"] + "\n")
	if shared && accountGrant {
		b.WriteString(grantKey + " = " + account[grantKey] + "\n")
	}
	b.WriteString("token = " + account["token"] + "\n\n")
	for i, s := range sections {
		r := roots[i]
		if r.Name != s.name || !microsoftDriveID.MatchString(r.DriveID) || !slices.Contains([]string{"personal", "business", "documentLibrary"}, r.DriveType) {
			return nil, ToolFailed
		}
		b.WriteString("[" + s.name + "]\ntype = alias\nremote = " + microsoftAccount + ",drive_id=" + r.DriveID + ",drive_type=" + r.DriveType + ":\n")
		for _, key := range []string{"description", microsoftLabelKey, microsoftRecoverySelected} {
			if v, ok := s.keys[key]; ok {
				b.WriteString(key + " = " + v + "\n")
			}
		}
		if g, ok := s.keys[grantKey]; ok && !shared {
			b.WriteString(grantKey + " = " + g + "\n")
		}
		b.WriteString("\n")
	}
	out := []byte(b.String())
	// The new form must say exactly what the old one did about every root.
	migrated, left, err := microsoftParseRoots(out, address)
	if err != nil || len(left) != 0 || len(migrated) != len(roots) || len(out) > maxMicrosoftConfigRead {
		return nil, ToolFailed
	}
	for i := range roots {
		if migrated[i] != roots[i] {
			return nil, ToolFailed
		}
	}
	return out, nil
}

// microsoftListingsMoved is the part of a native bisync file name that
// names a root's remote: rclone names a pair's listings, and the other files
// of its session, after its two paths, and an alias's path is the account
// remote it points to. Both remotes are at their drive's root.
func microsoftListingsMoved(remote string) (string, string) {
	return ".." + remote + "_.", ".." + microsoftAccount + "_."
}

// microsoftMoveListings renames a root's bisync session files from its own
// remote's name to the account's, so the alias continues the same pair
// instead of starting over (or stopping on listings it cannot find). A lock
// moves too, naming the new session inside, so rclone still judges an
// interrupted pass by it (an expired lock makes it distrust the listings).
// The caller has made sure no pass runs. Nothing is overwritten: a name the
// alias already uses is an error, and a second run finds nothing to do.
func microsoftMoveListings(env Env, address, remote string) error {
	work := microsoftWork(address, remote)
	names, fd, err := listHomeDir(env.Home, work)
	if err != nil || fd < 0 {
		return err
	}
	defer unix.Close(fd)
	from, to := microsoftListingsMoved(remote)
	for _, n := range names {
		if !strings.Contains(n, from) {
			continue
		}
		moved := strings.Replace(n, from, to, 1)
		if session, ok := strings.CutSuffix(moved, ".lck"); ok {
			if err := microsoftMoveLock(fd, n, moved, filepath.Join(env.Home, work, session)); err != nil {
				return err
			}
			continue
		}
		if err := unix.Renameat2(fd, n, fd, moved, unix.RENAME_NOREPLACE); err != nil {
			return err
		}
	}
	return nil
}

// microsoftMoveLock moves a bisync lock to the new session's name with the
// session it names rewritten; a lock that does not parse moves as it is.
func microsoftMoveLock(fd int, name, moved, session string) error {
	data, err := readFileAt(fd, name, 4096)
	if err != nil {
		return err
	}
	var lock map[string]any
	if json.Unmarshal(data, &lock) == nil {
		lock["Session"] = session
		if data, err = json.Marshal(lock); err != nil {
			return err
		}
	}
	// A stop between writing the new lock and removing the old one left
	// the new one already written: removing the old one finishes the move.
	if err := writeNewFileAt(fd, moved, data, 0600); err != nil && !errors.Is(err, unix.EEXIST) {
		return err
	}
	return unix.Unlinkat(fd, name, 0)
}

// microsoftListingsUnmoved reports whether a root's work directory still
// holds session files under its own remote's name.
func microsoftListingsUnmoved(env Env, address, remote string) bool {
	names, fd, err := listHomeDir(env.Home, microsoftWork(address, remote))
	if err != nil || fd < 0 {
		return false
	}
	unix.Close(fd)
	from, _ := microsoftListingsMoved(remote)
	return slices.ContainsFunc(names, func(n string) bool { return strings.Contains(n, from) })
}

// microsoftMigrationNeeded reports whether the account's config or its
// roots' listings are still in the form with a token per root.
func microsoftMigrationNeeded(env Env, address string) bool {
	roots, legacy, err := microsoftReadRoots(env, address)
	if err != nil {
		return false
	}
	if len(legacy) > 0 {
		return true
	}
	for _, r := range roots {
		if microsoftListingsUnmoved(env, address, r.Name) {
			return true
		}
	}
	return false
}

// migrate brings the account to one token: the config first, then each
// root's session files. The caller holds m.native with the account's sync
// client stopped; a pass still running defers it. Until every root's files
// have moved, SyncCommand leaves out the roots whose files have not.
// microsoftPassRunning reports whether a process may still use the root's
// pair: a live or unreadable lock, or a process naming its work directory.
func microsoftPassRunning(env Env, address, remote string) bool {
	_, _, state := bisyncLock(env, microsoftWork(address, remote), time.Now())
	return state == lockHeld || state == lockForeign
}

func (m *microsoft) migrate(env Env, address string) error {
	roots, legacy, err := microsoftReadRoots(env, address)
	if err != nil {
		return err
	}
	// A pass that runs, or a lock that is not provably ours, waits.
	for _, r := range roots {
		if microsoftPassRunning(env, address, r.Name) {
			return microsoftRecoveryBusy
		}
	}
	if len(legacy) > 0 {
		fd, err := openHomeDir(env.Home, false, splitPath(microsoftDir)...)
		if err != nil {
			return err
		}
		defer unix.Close(fd)
		data, err := readFileAt(fd, address+".conf", maxMicrosoftConfigRead)
		if err != nil {
			return err
		}
		migrated, err := microsoftMigrate(data, address)
		if err != nil {
			return err
		}
		if err := writeFileAt(fd, address+".conf", migrated, 0600); err != nil {
			return err
		}
	}
	for _, r := range roots {
		if err := microsoftMoveListings(env, address, r.Name); err != nil {
			return err
		}
	}
	return nil
}
