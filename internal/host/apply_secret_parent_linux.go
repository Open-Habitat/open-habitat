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
