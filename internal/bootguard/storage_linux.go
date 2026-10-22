//go:build linux

// Package bootguard verifies installed policy without maintenance authority.
// It creates no directories, identities, limits, bindings or readiness markers.
package bootguard

import (
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/Open-Habitat/open-habitat/internal/storagebaseline"
	"golang.org/x/sys/unix"
)

// Read the fixed non-secret policy through root-owned, non-writable ancestry.
// openat prevents a link at any component from selecting another policy.
func readPolicy(path string) ([]byte, error) {
	fd, e := unix.Open("/", unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if e != nil {
		return nil, e
	}
	defer func() { unix.Close(fd) }()
	parts := strings.Split(strings.TrimPrefix(path, "/"), "/")
	for n, part := range parts {
		flags := unix.O_RDONLY | unix.O_NOFOLLOW | unix.O_NONBLOCK | unix.O_CLOEXEC
		if n < len(parts)-1 {
			flags |= unix.O_DIRECTORY
		}
		next, e := unix.Openat(fd, part, flags, 0)
		if e != nil {
			return nil, e
		}
		unix.Close(fd)
		fd = next
		var st unix.Stat_t
		if unix.Fstat(fd, &st) != nil || st.Uid != 0 || st.Mode&0022 != 0 {
			return nil, storagebaseline.ErrStorage
		}
		if n == len(parts)-1 && (st.Mode&unix.S_IFMT != unix.S_IFREG || st.Nlink != 1 || st.Size > 4096) {
			return nil, storagebaseline.ErrStorage
		}
	}
	// The duplicate belongs to File; the original stays with the directory walk.
	dup, e := unix.Dup(fd)
	if e != nil {
		return nil, e
	}
	f := os.NewFile(uintptr(dup), "storage-policy")
	defer f.Close()
	return io.ReadAll(io.LimitReader(f, 4097))
}

// Storage returns a fixed journal-safe reason, never native errors or policy
// bytes. Success is a fresh observation, not a receipt valid for later boots.
func Storage() string {
	if os.Geteuid() != 0 {
		return "root_required"
	}
	b, e := readPolicy("/etc/open-habitat/storage-policy.json")
	if e != nil {
		return "storage_policy_unavailable"
	}
	p, ok := parsePolicy(b)
	if !ok {
		return "storage_policy_invalid"
	}
	return check(p.HomeUUID)
}
func parsePolicy(b []byte) (storagebaseline.Policy, bool) { return storagebaseline.ParsePolicy(b) }

func check(uuid string) string {
	b, e := os.ReadFile("/proc/self/mountinfo")
	if e != nil {
		return "home_mount_unavailable"
	}
	m, status, reason := storagebaseline.MountFrom(b)
	if status != "pass" {
		return reason
	}
	path := filepath.Join("/dev/disk/by-uuid", uuid)
	super, e := storagebaseline.ReadSuperblock(path, m.Device)
	if e != nil {
		return "home_uuid_unavailable"
	}
	status, reason = storagebaseline.QuotaFormat(super, uuid)
	if status != "pass" {
		return reason
	}
	if storagebaseline.Enforcement(m) != nil {
		return "quota_enforcement_required"
	}
	return "verified"
}
