//go:build linux

package daemon

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"unicode/utf8"

	"github.com/maintainer/native-agent-host/internal/transport"
	"golang.org/x/sys/unix"
)

// validWorkspaceName mirrors the command contract and excludes names that
// cannot be represented as a single, ordinary entry beneath ~/src.
func validWorkspaceName(name string) bool {
	if name == "" || len(name) > 255 || !utf8.ValidString(name) || name[0] == '.' || name[0] == '-' || strings.ContainsRune(name, '/') {
		return false
	}
	for _, c := range name {
		if c == 0 || c < 32 || c == 127 {
			return false
		}
	}
	return true
}

// workspaceSource pins the trusted account's src directory. Every caller must
// revalidate its name before reporting success, not merely trust this fd.
func workspaceSource(cfg transport.Config) (int, unix.Stat_t, error) {
	src, err := cloneSource(cfg, cfg.Home, false)
	if err != nil {
		return -1, unix.Stat_t{}, err
	}
	s, err := stat(src)
	if err != nil {
		unix.Close(src)
		return -1, unix.Stat_t{}, err
	}
	return src, s, nil
}

// openWorkspace checks the directory entry against the opened descriptor.
// It deliberately rejects mount crossings, symlinks and substituted entries.
func openWorkspace(src int, name string) (int, unix.Stat_t, error) {
	if !validWorkspaceName(name) {
		return -1, unix.Stat_t{}, errors.New("invalid workspace name")
	}
	var before unix.Stat_t
	if err := unix.Fstatat(src, name, &before, unix.AT_SYMLINK_NOFOLLOW); err != nil {
		return -1, unix.Stat_t{}, err
	}
	if before.Mode&unix.S_IFMT != unix.S_IFDIR {
		return -1, unix.Stat_t{}, errors.New("unsafe workspace entry")
	}
	fd, err := dir(unix.Openat2, src, name, true)
	if err != nil {
		return -1, unix.Stat_t{}, err
	}
	opened, err := stat(fd)
	if err != nil || !same(before, opened) {
		unix.Close(fd)
		return -1, unix.Stat_t{}, errors.New("workspace replaced")
	}
	return fd, opened, nil
}

func workspaceStillNamed(src int, name string, expected unix.Stat_t) bool {
	fd, _, err := openWorkspace(src, name)
	if err != nil {
		return false
	}
	defer unix.Close(fd)
	now, err := stat(fd)
	return err == nil && same(expected, now)
}

func newWorkspaceID() (string, error) {
	var bytes [24]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return "", err
	}
	return "ws_" + base64.RawURLEncoding.EncodeToString(bytes[:]), nil
}

// writeWorkspaceSettings refuses invalid existing metadata rather than
// overwriting a person's opaque or newer annotation. Rename is atomic inside
// the pinned .agent-host directory; fsync makes an acknowledged update durable.
func writeWorkspaceSettings(child int, id, display string) error {
	if !idPattern.MatchString(id) || (display != "" && (!utf8.ValidString(display) || len(display) > 255)) {
		return errors.New("invalid settings")
	}
	err := unix.Mkdirat(child, ".agent-host", 0700)
	if err != nil && !errors.Is(err, unix.EEXIST) {
		return err
	}
	d, err := dir(unix.Openat2, child, ".agent-host", true)
	if err != nil {
		return err
	}
	defer unix.Close(d)
	current, currentID, _ := metadata(unix.Openat2, child)
	if current == "error" || current == "valid" && currentID != id {
		return errors.New("annotation unavailable")
	}
	settings := struct {
		Version int    `json:"schema_version"`
		ID      string `json:"workspace_id"`
		Display string `json:"display_name,omitempty"`
	}{1, id, display}
	data, err := json.Marshal(settings)
	if err != nil {
		return err
	}
	var nonce [12]byte
	if _, err = rand.Read(nonce[:]); err != nil {
		return err
	}
	tmp := ".workspace-" + base64.RawURLEncoding.EncodeToString(nonce[:])
	fd, err := unix.Openat(d, tmp, unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0600)
	if err != nil {
		return err
	}
	defer unix.Unlinkat(d, tmp, 0)
	file := os.NewFile(uintptr(fd), tmp)
	_, err = file.Write(data)
	if err == nil {
		err = file.Sync()
	}
	closeErr := file.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	// Existing metadata can change independently while writing. Check again;
	// an external same-UID writer remains responsible for coordinating writes.
	current, currentID, _ = metadata(unix.Openat2, child)
	if current == "error" || current == "valid" && currentID != id {
		return errors.New("annotation changed")
	}
	if err = unix.Renameat(d, tmp, d, "workspace.json"); err != nil {
		return err
	}
	return unix.Fsync(d)
}
