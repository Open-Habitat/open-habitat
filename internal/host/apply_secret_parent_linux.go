//go:build linux

package host

import (
	"errors"
	"golang.org/x/sys/unix"
	"os"
	"path/filepath"
)

// Mode 0750/0640 alone is not an exclusive secret boundary: an inherited named
// ACL can grant another UID read/search while those mode bits still look right.
// Refuse unsafe existing metadata rather than removing a customer's ACLs.
func secretParentSafe(path string, owner uint32) error {
	current := path
	for {
		fd, e := openDir(current, owner, false)
		if e == nil {
			defer unix.Close(fd)
			names := []string{"system.posix_acl_default"}
			if current == path {
				names = append(names, "system.posix_acl_access")
			}
			return noACLAttributes(fd, names)
		}
		if !errors.Is(e, os.ErrNotExist) {
			return e
		}
		next := filepath.Dir(current)
		if next == current {
			return ErrTrust
		}
		current = next
	}
}
func noACLAttributes(fd int, names []string) error {
	for _, name := range names {
		_, e := unix.Fgetxattr(fd, name, nil)
		if e != unix.ENODATA && e != unix.ENOTSUP {
			return ErrTrust
		}
	}
	return nil
}

// The shared bootstrap parent carries root-private source files and a separate
// group-private gateway subtree. Search permission exposes no source bytes;
// requiring a canonical mode avoids dependence on supplementary groups/ACLs.
// The operator owns existing bootstrap metadata; check/apply never chmod it.
func gatewayAncestorSafe(path string, owner uint32) error {
	fd, e := openDir(path, owner, false)
	if errors.Is(e, os.ErrNotExist) {
		return nil
	} // apply creates it with 0755
	if e != nil {
		return e
	}
	defer unix.Close(fd)
	var st unix.Stat_t
	if unix.Fstat(fd, &st) != nil || st.Gid != 0 || (st.Mode&07777 != 0711 && st.Mode&07777 != 0755) {
		return ErrTrust
	}
	return noACLAttributes(fd, []string{"system.posix_acl_access", "system.posix_acl_default"})
}
