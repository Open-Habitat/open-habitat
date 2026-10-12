//go:build linux

package daemon

import (
	"os"
	"testing"
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
