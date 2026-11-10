//go:build linux

// Package bootguard verifies installed policy without maintenance authority.
// It creates no directories, identities, limits, bindings or readiness markers.
package bootguard

import (
	"os"
	"path/filepath"

	"github.com/open-habitat/open-habitat/internal/storagebaseline"
)

func readPolicy(path string) ([]byte, error) { return storagebaseline.ReadPolicy(path) }

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
	return check(p)
}
func parsePolicy(b []byte) (storagebaseline.Policy, bool) { return storagebaseline.ParsePolicy(b) }

func check(p storagebaseline.Policy) string {
	b, e := os.ReadFile("/proc/self/mountinfo")
	if e != nil {
		return "home_mount_unavailable"
	}
	find := storagebaseline.MountFrom
	if !p.UserQuota {
		find = storagebaseline.HomeFilesystemFrom
	}
	m, status, reason := find(b)
	if status != "pass" {
		return reason
	}
	path := filepath.Join("/dev/disk/by-uuid", p.HomeUUID)
	super, e := storagebaseline.ReadSuperblock(path, m.Device)
	if e != nil {
		return "home_uuid_unavailable"
	}
	if !p.UserQuota {
		// No limits to verify: only that homes are on the declared filesystem.
		if status, reason = storagebaseline.Identity(super, p.HomeUUID); status != "pass" {
			return reason
		}
		if storagebaseline.Pinned(m) != nil {
			return "home_mount_unavailable"
		}
		return "verified"
	}
	status, reason = storagebaseline.QuotaFormat(super, p.HomeUUID)
	if status != "pass" {
		return reason
	}
	if storagebaseline.Enforcement(m) != nil {
		return "quota_enforcement_required"
	}
	return "verified"
}
