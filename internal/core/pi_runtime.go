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
	if err != nil {
		return nil, invalid
	}
	f := os.NewFile(uintptr(fd), path)
	defer f.Close()
	var st unix.Stat_t
	if unix.Fstat(fd, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Uid != 0 || st.Mode&0022 != 0 || st.Nlink != 1 || st.Size > 8192 {
		return nil, invalid
	}
	data, err := io.ReadAll(io.LimitReader(f, 8193))
	if err != nil || len(data) > 8192 {
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
