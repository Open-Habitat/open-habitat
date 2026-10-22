//go:build linux

package host

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"

	"github.com/Open-Habitat/open-habitat/internal/storagebaseline"
	"golang.org/x/sys/unix"
)

// storageEvidence is a point-in-time read, never a preparation certificate.
// The mount ID binds the kernel quota query to the mount just inspected, not
// another ext4 filesystem reached through a racing /home replacement.
type homeMount struct{ id, device string }
type storageEvidence struct {
	format, enforcement Check
	token               string
}

func homeMountFrom(b []byte) (homeMount, string, string) {
	m, s, r := storagebaseline.MountFrom(b)
	return homeMount{m.ID, m.Device}, s, r
}
func readHomeSuperblock(path, device string) ([]byte, error) {
	b, e := storagebaseline.ReadSuperblock(path, device)
	if e == storagebaseline.ErrStorage {
		e = ErrTrust
	}
	return b, e
}
func journaledQuotaFormat(b []byte, uuid string) (string, string) {
	return storagebaseline.QuotaFormat(b, uuid)
}
func homeQuotaEnforcement(m homeMount) error {
	return storagebaseline.Enforcement(storagebaseline.Mount{ID: m.id, Device: m.device})
}

func observeStorage(s Site, src inspectSources) (string, string, storageEvidence) {
	ev := storageEvidence{format: Check{"storage.quota_format", "unavailable", "home_mount_required"}, enforcement: Check{"storage.enforcement", "unavailable", "home_mount_required"}}
	b, err := os.ReadFile(src.mountInfo)
	if err != nil {
		return "unavailable", "observation_unavailable", ev
	}
	m, status, reason := homeMountFrom(b)
	if status != "pass" {
		return status, reason, ev
	}
	var st unix.Stat_t
	path := filepath.Join(src.homeDevice, s.Storage.HomeUUID)
	if src.statDevice(path, &st) != nil {
		return "unavailable", "home_uuid_unavailable", ev
	}
	if st.Mode&unix.S_IFMT != unix.S_IFBLK || fmtDevice(st.Rdev) != m.device {
		return "fail", "home_uuid_mismatch", ev
	}
	ev.enforcement.Reason = "quota_format_required"
	super, err := src.superblock(path, m.device)
	if err != nil {
		ev.format = Check{"storage.quota_format", "unavailable", "quota_format_unavailable"}
		return "pass", "home_mount_observed", ev
	}
	ev.format.Status, ev.format.Reason = journaledQuotaFormat(super, s.Storage.HomeUUID)
	if ev.format.Status != "pass" {
		return "pass", "home_mount_observed", ev
	}
	ev.enforcement = Check{"storage.enforcement", "unavailable", "quota_enforcement_unavailable"}
	if src.enforcement(m) == nil {
		ev.enforcement = Check{"storage.enforcement", "pass", "kernel_user_quota_enforced"}
	}
	// Bind only qualified feature predicates. Other bits (e.g. ORPHAN_PRESENT
	// across freeze/thaw) can change without changing storage qualification.
	compat := binary.LittleEndian.Uint32(super[0x5c:]) & 0x4
	rocompat := binary.LittleEndian.Uint32(super[0x64:]) & 0x100
	token := fmt.Sprintf("%s:%s:%x:%x:%x:%x", m.id, m.device, super[0x68:0x78], compat, rocompat, super[0x240:0x244])
	sum := sha256.Sum256([]byte(token))
	ev.token = hex.EncodeToString(sum[:])
	return "pass", "home_mount_observed", ev
}

func observeHome(s Site, src inspectSources) (string, string) {
	status, reason, _ := observeStorage(s, src)
	return status, reason
}

func fmtDevice(dev uint64) string { return fmt.Sprintf("%d:%d", unix.Major(dev), unix.Minor(dev)) }
