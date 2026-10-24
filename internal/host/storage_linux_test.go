//go:build linux

package host

import (
	"context"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/sys/unix"
)

func storageFixture(t *testing.T) (string, inspectSources, Site, []byte) {
	t.Helper()
	path, src, s := inspectionFixture(t)
	mounts := "1 0 8:1 / / rw - ext4 /dev/root rw\n2 1 8:42 / /home rw - ext4 /dev/home rw\n"
	if err := os.WriteFile(src.mountInfo, []byte(mounts), 0600); err != nil {
		t.Fatal(err)
	}
	src.statDevice = func(path string, st *unix.Stat_t) error {
		if path != filepath.Join(src.homeDevice, s.Storage.HomeUUID) {
			t.Fatal("wrong UUID device")
		}
		st.Mode, st.Rdev = unix.S_IFBLK, unix.Mkdev(8, 42)
		return nil
	}
	b := make([]byte, 1024)
	binary.LittleEndian.PutUint16(b[0x38:], 0xef53)
	binary.LittleEndian.PutUint32(b[0x5c:], 0x4)
	binary.LittleEndian.PutUint32(b[0x64:], 0x100)
	binary.LittleEndian.PutUint32(b[0x240:], 3)
	uuid, err := hex.DecodeString(strings.ReplaceAll(s.Storage.HomeUUID, "-", ""))
	if err != nil {
		t.Fatal(err)
	}
	copy(b[0x68:], uuid)
	src.superblock = func(path, dev string) ([]byte, error) {
		if path != filepath.Join(src.homeDevice, s.Storage.HomeUUID) || dev != "8:42" {
			t.Fatal("unbound device read")
		}
		return b, nil
	}
	src.enforcement = func(m homeMount) error {
		if m.id != "2" || m.device != "8:42" {
			t.Fatal("unbound enforcement query")
		}
		return nil
	}
	return path, src, s, b
}
func storageCheck(t *testing.T, site string, src inspectSources, code string) Check {
	t.Helper()
	r, err := inspect(context.Background(), site, src)
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range r.Checks {
		if c.Code == code {
			return c
		}
	}
	t.Fatal("missing check", code)
	return Check{}
}
func TestStorageReadOnlyQualificationAndBinding(t *testing.T) {
	site, src, _, super := storageFixture(t)
	before := snapshot(t, filepath.Dir(site))
	for _, code := range []string{"storage.home", "storage.quota_format", "storage.enforcement"} {
		if c := storageCheck(t, site, src, code); c.Status != "pass" {
			t.Fatal(c)
		}
	}
	p, err := buildPlan(context.Background(), site, src)
	if err != nil || p.Approvable || p.Ready {
		t.Fatal("baseline is not activation authority", p, err)
	}
	if c := storageCheck(t, site, src, "storage.boot_policy"); c.Status != "unavailable" {
		t.Fatal(c)
	}
	if before != snapshot(t, filepath.Dir(site)) {
		t.Fatal("storage reads mutated state")
	}
	// ext4 clears ORPHAN_PRESENT while freezing a clean journal and restores
	// it on thaw. Backup snapshots must not invalidate an otherwise identical
	// qualification. This simulates the superblock transition, not fsfreeze.
	binary.LittleEndian.PutUint32(super[0x64:], 0x10100)
	frozen, err := buildPlan(context.Background(), site, src)
	if err != nil || frozen.PlanID != p.PlanID {
		t.Fatal("runtime orphan flag changed qualification", err)
	}
	// Replacement by another mount of the same device still invalidates approval.
	b, _ := os.ReadFile(src.mountInfo)
	os.WriteFile(src.mountInfo, []byte(strings.Replace(string(b), "2 1 8:42", "3 1 8:42", 1)), 0600)
	src.enforcement = func(homeMount) error { return nil }
	q, err := buildPlan(context.Background(), site, src)
	if err != nil || p.PlanID == q.PlanID {
		t.Fatal("mount replacement not bound", err)
	}
}
func TestStorageFailuresDoNotReachLaterProbes(t *testing.T) {
	for _, tc := range []struct {
		name           string
		edit           func(*inspectSources, []byte)
		status, reason string
	}{
		{"missing quota feature", func(_ *inspectSources, b []byte) { binary.LittleEndian.PutUint32(b[0x64:], 0) }, "fail", "offline_journaled_user_quota_required"},
		{"missing journal", func(_ *inspectSources, b []byte) { binary.LittleEndian.PutUint32(b[0x5c:], 0) }, "fail", "offline_journaled_user_quota_required"},
		{"missing user inode", func(_ *inspectSources, b []byte) { binary.LittleEndian.PutUint32(b[0x240:], 0) }, "fail", "offline_journaled_user_quota_required"},
		{"wrong UUID", func(_ *inspectSources, b []byte) { b[0x68] ^= 1 }, "fail", "home_uuid_mismatch"},
		{"not ext4", func(_ *inspectSources, b []byte) { b[0x38] = 0 }, "fail", "invalid_ext4_superblock"},
		{"short read", func(src *inspectSources, _ []byte) {
			src.superblock = func(string, string) ([]byte, error) { return nil, io.ErrUnexpectedEOF }
		}, "unavailable", "quota_format_unavailable"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			site, src, _, b := storageFixture(t)
			tc.edit(&src, b)
			src.enforcement = func(homeMount) error { t.Fatal("unsafe enforcement query"); return nil }
			c := storageCheck(t, site, src, "storage.quota_format")
			if c.Status != tc.status || c.Reason != tc.reason {
				t.Fatal(c)
			}
			if c := storageCheck(t, site, src, "storage.enforcement"); c.Status != "unavailable" || c.Reason != "quota_format_required" {
				t.Fatal(c)
			}
		})
	}
	_, src, s, _ := storageFixture(t)
	src.statDevice = func(string, *unix.Stat_t) error { return os.ErrNotExist }
	src.superblock = func(string, string) ([]byte, error) { t.Fatal("device read before mount identity"); return nil, nil }
	if status, reason, _ := observeStorage(s, src); status != "unavailable" || reason != "home_uuid_unavailable" {
		t.Fatal(status, reason)
	}
}
func TestStorageKernelFailureIsNotEnforcement(t *testing.T) {
	site, src, _, _ := storageFixture(t)
	src.enforcement = func(homeMount) error { return errors.New("PRIVATE_NATIVE_ERROR") }
	c := storageCheck(t, site, src, "storage.enforcement")
	if c.Status != "unavailable" || c.Reason != "quota_enforcement_unavailable" {
		t.Fatal(c)
	}
	// A changing kernel result must not yield a mixed plan.
	calls := 0
	src.enforcement = func(homeMount) error {
		calls++
		if calls%2 == 0 {
			return unix.EPERM
		}
		return nil
	}
	if _, err := buildPlan(context.Background(), site, src); !errors.Is(err, ErrUnstable) {
		t.Fatal(err)
	}
}
func TestStorageRejectsAmbiguousAndNestedMounts(t *testing.T) {
	base := "1 0 8:1 / / rw - ext4 /dev/root rw\n2 1 8:42 / /home rw - ext4 /dev/home rw\n"
	for _, suffix := range []string{
		"3 1 8:43 / /home rw - ext4 /dev/other rw\n",
		"3 1 8:43 / / rw - ext4 /dev/other rw\n",
		"3 2 8:43 / /home/person rw - ext4 /dev/other rw\n",
	} {
		if _, status, _ := homeMountFrom([]byte(base + suffix)); status == "pass" {
			t.Fatal("unsafe topology accepted", suffix)
		}
	}
	for _, replace := range []string{"2 1 8:42 / /home rw - ext4 /dev/home ro", "0 1 8:42 / /home rw - ext4 /dev/home rw", "2 1 8:42 / /home rw - ext4"} {
		b := strings.Split(base, "\n")[0] + "\n" + replace + "\n"
		if _, status, _ := homeMountFrom([]byte(b)); status == "pass" {
			t.Fatal("unsafe mount record", replace)
		}
	}
}
func TestStorageNativeReadersRefuseUnboundInputs(t *testing.T) {
	_, _, s, b := storageFixture(t)
	image := filepath.Join(t.TempDir(), "not-a-device")
	os.WriteFile(image, append(make([]byte, 1024), b...), 0600)
	if _, err := readHomeSuperblock(image, "8:42"); !errors.Is(err, ErrTrust) {
		t.Fatal("ordinary file treated as device", err)
	}
	if err := homeQuotaEnforcement(homeMount{"0", "0:0"}); err == nil {
		t.Fatal("unbound kernel query accepted")
	}
	if status, _ := journaledQuotaFormat(b[:512], s.Storage.HomeUUID); status != "fail" {
		t.Fatal("truncated superblock accepted")
	}
}

// An actual e2fsprogs-generated unmounted image checks the ABI offsets without
// needing a loop mount, root, or mutation of any host filesystem configuration.
func TestStorageExt4Image(t *testing.T) {
	mkfs, err := exec.LookPath("mkfs.ext4")
	if err != nil {
		t.Skip("e2fsprogs unavailable; synthetic superblock tests still run")
	}
	_, _, s, _ := storageFixture(t)
	for _, quotas := range []bool{false, true} {
		image := filepath.Join(t.TempDir(), "ext4.img")
		f, err := os.OpenFile(image, os.O_RDWR|os.O_CREATE|os.O_EXCL, 0600)
		if err != nil {
			t.Fatal(err)
		}
		if err := f.Truncate(32 << 20); err != nil {
			t.Fatal(err)
		}
		f.Close()
		features := "^quota"
		if quotas {
			features = "quota"
		}
		cmd := exec.Command(mkfs, "-q", "-F", "-U", s.Storage.HomeUUID, "-O", features, image)
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("mkfs fixture: %v: %s", err, out)
		}
		f, err = os.Open(image)
		if err != nil {
			t.Fatal(err)
		}
		b := make([]byte, 1024)
		_, err = f.ReadAt(b, 1024)
		f.Close()
		if err != nil {
			t.Fatal(err)
		}
		status, reason := journaledQuotaFormat(b, s.Storage.HomeUUID)
		if quotas && status != "pass" || !quotas && (status != "fail" || reason != "offline_journaled_user_quota_required") {
			t.Fatal(quotas, status, reason)
		}
	}
}

// An ordinary single-filesystem server: /home is a directory on the root
// filesystem, which has no quota features. Only a site declaring no user
// quotas qualifies it, and no quota query is ever made.
func TestStorageWithoutUserQuotaOnRootFilesystem(t *testing.T) {
	site, src, s, super := storageFixture(t)
	os.WriteFile(src.mountInfo, []byte("1 0 8:1 / / rw - ext4 /dev/root rw\n"), 0600)
	src.statDevice = func(path string, st *unix.Stat_t) error {
		st.Mode, st.Rdev = unix.S_IFBLK, unix.Mkdev(8, 1)
		return nil
	}
	for _, off := range []int{0x5c, 0x64, 0x240} {
		binary.LittleEndian.PutUint32(super[off:], 0)
	}
	src.superblock = func(path, dev string) ([]byte, error) {
		if dev != "8:1" {
			t.Fatal("unbound device read")
		}
		return super, nil
	}
	src.enforcement = func(homeMount) error { t.Fatal("quota queried without user quotas"); return nil }
	if c := storageCheck(t, site, src, "storage.home"); c.Status != "fail" || c.Reason != "separate_home_required" {
		t.Fatal("quota site accepted /home on the root filesystem", c)
	}
	s.Storage.EnforceUserQuota, s.Storage.DefaultLimitBytes = false, nil
	b, _ := json.Marshal(s)
	os.WriteFile(site, b, 0600)
	pinned := 0
	src.pinned = func(m homeMount) error {
		if m.id != "1" || m.device != "8:1" {
			t.Fatal("unbound home pin")
		}
		pinned++
		return nil
	}
	for code, reason := range map[string]string{"storage.home": "home_on_root_filesystem_observed", "storage.quota_format": "user_quota_not_declared", "storage.enforcement": "user_quota_not_declared"} {
		if c := storageCheck(t, site, src, code); c.Status != "pass" || c.Reason != reason {
			t.Fatal(c)
		}
	}
	if pinned == 0 {
		t.Fatal("home not pinned to the observed mount")
	}
	p, err := buildPlan(context.Background(), site, src)
	if err != nil || p.storageIdentity == "" {
		t.Fatal("storage identity not bound", err)
	}
	// The declared UUID still binds the filesystem, and nested mounts or a
	// read-only root are still refused.
	super[0x68] ^= 1
	if c := storageCheck(t, site, src, "storage.quota_format"); c.Status != "fail" || c.Reason != "home_uuid_mismatch" {
		t.Fatal(c)
	}
	super[0x68] ^= 1
	for _, mounts := range []string{
		"1 0 8:1 / / rw - ext4 /dev/root rw\n2 1 8:3 / /home/alice rw - ext4 /dev/alice rw\n",
		"1 0 8:1 / / ro - ext4 /dev/root ro\n",
		"1 0 8:1 / / rw - xfs /dev/root rw\n",
	} {
		os.WriteFile(src.mountInfo, []byte(mounts), 0600)
		if c := storageCheck(t, site, src, "storage.home"); c.Status == "pass" {
			t.Fatal("unsupported home accepted", mounts)
		}
	}
	// A dedicated /home without quotas is also an installation without them.
	os.WriteFile(src.mountInfo, []byte("1 0 8:1 / / rw - ext4 /dev/root rw\n2 1 8:42 / /home rw - ext4 /dev/home rw\n"), 0600)
	src.statDevice = func(path string, st *unix.Stat_t) error {
		st.Mode, st.Rdev = unix.S_IFBLK, unix.Mkdev(8, 42)
		return nil
	}
	src.superblock = func(string, string) ([]byte, error) { return super, nil }
	src.pinned = func(homeMount) error { return nil }
	if c := storageCheck(t, site, src, "storage.home"); c.Status != "pass" || c.Reason != "home_mount_observed" {
		t.Fatal(c)
	}
}
