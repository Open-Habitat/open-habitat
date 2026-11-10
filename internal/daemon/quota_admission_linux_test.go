//go:build linux

package daemon

import (
	"os"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/storagebaseline"
	"golang.org/x/sys/unix"
)

func TestQuotaCloneAdmissionRejectsOtherUID(t *testing.T) {
	dir := t.TempDir()
	f, err := os.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	uid := uint32(os.Geteuid())
	if uid == ^uint32(0) {
		t.Skip("UID overflow")
	}
	if quotaCloneAdmission(int(f.Fd()), uid+1) {
		t.Fatal("admitted another user's directory")
	}
}

func TestNoUserQuotaOnlyFromDeclaredPolicy(t *testing.T) {
	saved := installedStorage
	t.Cleanup(func() { installedStorage = saved })
	installedStorage = func() (storagebaseline.Policy, error) { return storagebaseline.Policy{}, storagebaseline.ErrStorage }
	if noUserQuota() {
		t.Fatal("an unreadable policy skipped quota requirements")
	}
	if q := agentEnvironment("0", "", time.Now())["quota"].(map[string]any); q["state"] == "not_in_use" {
		t.Fatalf("environment without a policy: %v", q)
	}
	installedStorage = func() (storagebaseline.Policy, error) {
		return storagebaseline.Policy{SchemaVersion: 1, HomeUUID: "00000000-0000-4000-8000-000000000001", UserQuota: true}, nil
	}
	if noUserQuota() {
		t.Fatal("a quota policy skipped quota requirements")
	}
	installedStorage = func() (storagebaseline.Policy, error) {
		return storagebaseline.Policy{SchemaVersion: 1, HomeUUID: "00000000-0000-4000-8000-000000000001"}, nil
	}
	if q := agentEnvironment("0", "", time.Now())["quota"].(map[string]any); q["state"] != "not_in_use" || q["source"] != "storage_policy" || len(q) != 2 {
		t.Fatalf("environment without quotas: %v", q)
	}
	// Without quotas the shared filesystem is the only bound, and another
	// UID's directory is still refused.
	var home unix.Stat_t
	if unix.Stat("/home", &home) != nil {
		t.Skip("no /home")
	}
	f, err := os.Open("/home")
	if err != nil {
		t.Skip("unreadable /home")
	}
	defer f.Close()
	var st unix.Stat_t
	if unix.Fstat(int(f.Fd()), &st) != nil {
		t.Fatal("stat")
	}
	if !quotaCloneAdmission(int(f.Fd()), st.Uid) {
		t.Fatal("same-filesystem clone refused without quotas")
	}
	if quotaCloneAdmission(int(f.Fd()), st.Uid+1) {
		t.Fatal("another owner's directory admitted without quotas")
	}
}
