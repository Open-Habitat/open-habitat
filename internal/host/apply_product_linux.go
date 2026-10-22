//go:build linux

package host

import (
	"golang.org/x/sys/unix"
	"os"
	"path/filepath"
)

// Root maintenance does not adopt an unprivileged user's mutable extraction.
// Support both shipped bin/web and the installed executable-bridge/web layout.
func productInputs() (string, string, fileIdentity, error) {
	exe, e := os.Executable()
	if e != nil {
		return "", "", fileIdentity{}, e
	}
	root := filepath.Dir(exe)
	if filepath.Base(root) == "bin" {
		root = filepath.Dir(root)
	}
	web := root + "/web"
	fd, e := openDir(filepath.Dir(exe), 0, false)
	if e != nil {
		return "", "", fileIdentity{}, e
	}
	defer unix.Close(fd)
	f, e := unix.Openat(fd, filepath.Base(exe), unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if e != nil {
		return "", "", fileIdentity{}, e
	}
	defer unix.Close(f)
	var st unix.Stat_t
	if unix.Fstat(f, &st) != nil || st.Uid != 0 || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Mode&0022 != 0 || st.Mode&0111 != 0111 || st.Nlink != 1 {
		return "", "", fileIdentity{}, ErrTrust
	}
	if _, e = trustedBytes(web+"/index.html", MaxSiteBytes); e != nil {
		return "", "", fileIdentity{}, e
	}
	id := fileIdentity{st.Dev, st.Ino, st.Uid, st.Gid, st.Mode, st.Size, st.Mtim, st.Ctim}
	return exe, web, id, nil
}
