//go:build linux

package core

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"

	"golang.org/x/sys/unix"
)

// SharedPiRuntimePath is an installation-wide operator selector, not a user
// binding. A missing or invalid selector disables Pi without disabling the daemon.
const SharedPiRuntimePath = "/opt/open-habitat/pi-runtime.json"

func LoadSharedPiRuntime() (*PiRuntimeConfig, error) {
	return loadSharedPiRuntime(SharedPiRuntimePath)
}

func loadSharedPiRuntime(path string) (*PiRuntimeConfig, error) {
	invalid := errors.New("untrusted Pi runtime selector")
	data, err := ReadOperatorFile(path, 8192)
	if err != nil {
		return nil, invalid
	}
	var cfg PiRuntimeConfig
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	if dec.Decode(&cfg) != nil || dec.Decode(new(any)) != io.EOF || cfg.Node == "" || cfg.Entry == "" || cfg.Manifest == "" {
		return nil, invalid
	}
	return &cfg, nil
}

// ErrOperatorFileMissing distinguishes an installation that has not
// configured a feature from one whose configuration cannot be trusted.
var ErrOperatorFileMissing = errors.New("operator file missing")

// ReadOperatorFile reads an installation-wide file that only root may have
// written: every directory up to / and the file itself are root-owned and not
// group- or world-writable, the file is a single-link regular file, and no
// symlink is followed. A person's daemon trusts nothing else as operator
// configuration.
func ReadOperatorFile(path string, max int64) ([]byte, error) {
	invalid := errors.New("untrusted operator file")
	if !filepath.IsAbs(path) || filepath.Clean(path) != path {
		return nil, invalid
	}
	for dir := filepath.Dir(path); ; dir = filepath.Dir(dir) {
		var st unix.Stat_t
		if unix.Fstatat(unix.AT_FDCWD, dir, &st, unix.AT_SYMLINK_NOFOLLOW) != nil || st.Mode&unix.S_IFMT != unix.S_IFDIR || st.Uid != 0 || st.Mode&0022 != 0 {
			return nil, invalid
		}
		if dir == "/" {
			break
		}
	}
	fd, err := unix.Open(path, unix.O_RDONLY|unix.O_CLOEXEC|unix.O_NOFOLLOW|unix.O_NONBLOCK, 0)
	if errors.Is(err, unix.ENOENT) {
		return nil, ErrOperatorFileMissing
	}
	if err != nil {
		return nil, invalid
	}
	f := os.NewFile(uintptr(fd), path)
	defer f.Close()
	var st unix.Stat_t
	if unix.Fstat(fd, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Uid != 0 || st.Mode&0022 != 0 || st.Nlink != 1 || st.Size > max {
		return nil, invalid
	}
	data, err := io.ReadAll(io.LimitReader(f, max+1))
	if err != nil || int64(len(data)) > max {
		return nil, invalid
	}
	return data, nil
}
