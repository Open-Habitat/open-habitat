//go:build linux

package daemon

import (
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"syscall"
	"time"
)

// Claude Code's global config can carry a long project history.
const maxClaudeConfig = 64 << 20

// markClaudeOnboarded records Claude Code's first-run onboarding as finished,
// as Claude Code does when a person completes it interactively. Signing in
// through Habitat is that person's first use of Claude Code, so without it an
// interactive Claude Code (a worker, the person's own shell) opens on the
// theme picker that no one may be watching. Claude Code shows the onboarding
// only while hasCompletedOnboarding is not true, and resets it on a login
// that changes the account, so it is set after every completed sign-in.
//
// Only that one member changes; the rest of the person's config is kept. The
// write holds Claude Code's own config lock (a directory beside the file) so
// a Claude Code running meanwhile neither loses nor overwrites it.
func markClaudeOnboarded(home string) error {
	config := filepath.Join(home, ".claude.json")
	// Claude Code reads a legacy config instead when it is a regular file
	// that is non-empty, or writable while the current one is absent. Its
	// owner used Claude Code before this sign-in, so it is left alone.
	if st, err := os.Stat(filepath.Join(home, ".claude", ".config.json")); err == nil && st.Mode().IsRegular() {
		if _, err := os.Lstat(config); st.Size() > 0 || st.Mode().Perm()&0222 != 0 && errors.Is(err, os.ErrNotExist) {
			return nil
		}
	}
	lock := config + ".lock"
	for deadline := time.Now().Add(2 * time.Second); ; time.Sleep(50 * time.Millisecond) {
		err := os.Mkdir(lock, 0700)
		if err == nil {
			break
		}
		// A stale lock is Claude Code's to recover, never removed here.
		if !errors.Is(err, os.ErrExist) || time.Now().After(deadline) {
			return errors.New("claude config locked")
		}
	}
	// Claude Code takes over a lock whose mtime is 10 s old. Ours is never
	// refreshed, so it is used only well inside that window, and only while
	// it is still our directory.
	held := time.Now()
	ours, err := os.Lstat(lock)
	if err != nil {
		return errors.New("claude config locked")
	}
	// A takeover recreates the directory; its inode number may be reused,
	// its mtime is new.
	isOurs := func() bool {
		current, err := os.Lstat(lock)
		return err == nil && os.SameFile(ours, current) && current.ModTime().Equal(ours.ModTime())
	}
	defer func() {
		if isOurs() {
			_ = os.Remove(lock)
		}
	}()
	members := map[string]json.RawMessage{}
	f, err := os.OpenFile(config, os.O_RDONLY|syscall.O_NOFOLLOW, 0)
	if err == nil {
		data, err := readOwnPrivateFile(f)
		_ = f.Close()
		// An unparsable file is reported, not replaced: it may hold the only
		// copy of the person's settings, and Claude Code repairs its own file.
		if err != nil || json.Unmarshal(data, &members) != nil || members == nil {
			return errors.New("claude config unreadable")
		}
		if string(members["hasCompletedOnboarding"]) == "true" {
			return nil
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return errors.New("claude config unreadable")
	}
	members["hasCompletedOnboarding"] = json.RawMessage("true")
	data, err := json.MarshalIndent(members, "", "  ")
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(home, ".claude.json.open-habitat-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	_, err = tmp.Write(data)
	if err == nil {
		err = tmp.Sync()
	}
	if closeErr := tmp.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return err
	}
	if time.Since(held) >= 5*time.Second || !isOurs() {
		return errors.New("claude config lock expired")
	}
	return os.Rename(tmp.Name(), config)
}

// readOwnPrivateFile reads a regular file owned by this UID and closed to
// group and others, the shape the Claude sign-in requires of its store.
func readOwnPrivateFile(f *os.File) ([]byte, error) {
	st, err := f.Stat()
	if err != nil {
		return nil, err
	}
	owner, ok := st.Sys().(*syscall.Stat_t)
	if !ok || owner.Uid != uint32(os.Geteuid()) || !st.Mode().IsRegular() || st.Mode().Perm()&0077 != 0 || st.Size() > maxClaudeConfig {
		return nil, errors.New("unsafe claude config")
	}
	data, err := io.ReadAll(io.LimitReader(f, maxClaudeConfig+1))
	if err != nil || len(data) > maxClaudeConfig {
		return nil, errors.New("unsafe claude config")
	}
	return data, nil
}
