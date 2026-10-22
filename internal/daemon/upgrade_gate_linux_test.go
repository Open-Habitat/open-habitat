//go:build linux

package daemon

import (
	"os"
	"path/filepath"
	"testing"
)

func TestUpgradeMutationGateRetainsUnpublishedDenial(t *testing.T) {
	path := filepath.Join(t.TempDir(), "closed")
	if upgradeEntryClosed(path) {
		t.Fatal("absent fence denied")
	}
	if e := os.WriteFile(path+".next", nil, 0600); e != nil {
		t.Fatal(e)
	}
	if !upgradeEntryClosed(path) {
		t.Fatal("unpublished closure admitted native mutation")
	}
	if e := os.Remove(path + ".next"); e != nil {
		t.Fatal(e)
	}
	if e := os.Symlink("missing", path+".next"); e != nil {
		t.Fatal(e)
	}
	if !upgradeEntryClosed(path) {
		t.Fatal("ambiguous publication admitted native mutation")
	}
}
