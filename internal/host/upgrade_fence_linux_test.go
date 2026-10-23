//go:build linux

package host

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/bootguard"
	"github.com/Open-Habitat/open-habitat/internal/entryfence"
)

// Fixed production paths are exercised only in the disposable root container.
func TestUpgradePublicFenceNative(t *testing.T) {
	if os.Getenv("HOST_INIT_UID_CONTAINER") != "1" || os.Geteuid() != 0 {
		t.Skip("requires disposable root container")
	}
	paths := []string{entryfence.UpgradePath, entryfence.AgentUpgradePath}
	for _, path := range paths {
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			t.Fatal(err)
		}
		for _, name := range []string{path, path + ".next"} {
			if _, err := os.Lstat(name); !errors.Is(err, os.ErrNotExist) {
				t.Fatalf("fixture collision: %s", name)
			}
		}
		t.Cleanup(func() { os.Remove(path); os.Remove(path + ".next") })
	}
	if got := bootguard.Upgrade(); got != "verified" {
		t.Fatal(got)
	}
	// An interruption before the public marker is published must still fence a
	// reboot through the predecessor's unchanged /etc cold-start guard.
	if err := installPolicy("/", policyFile{entryfence.UpgradePath, "closed\n"}, 0); err != nil {
		t.Fatal(err)
	}
	if got := bootguard.Upgrade(); got == "verified" {
		t.Fatal("cold-only publication allowed startup")
	}
	if err := publishUpgradeFences(); err != nil {
		t.Fatal(err)
	}
	if !entryfence.Closed(entryfence.AgentUpgradePath) || bootguard.Upgrade() == "verified" {
		t.Fatal("root publication did not close both hot and cold readers")
	}
	for _, path := range paths {
		if err := os.WriteFile(path+".next", []byte("closed\n"), 0644); err != nil {
			t.Fatal(err)
		}
		if err := removeUpgradeFence(); !errors.Is(err, ErrRecovery) {
			t.Fatalf("stage ignored: %v", err)
		}
		for _, final := range paths {
			if _, err := os.Lstat(final); err != nil {
				t.Fatal("staged removal partially reopened entries", err)
			}
		}
		if err := os.Remove(path + ".next"); err != nil {
			t.Fatal(err)
		}
	}
	if err := removeUpgradeFence(); err != nil {
		t.Fatal(err)
	}
	if entryfence.Closed(entryfence.AgentUpgradePath) || bootguard.Upgrade() != "verified" {
		t.Fatal("root removal did not reopen both readers")
	}
}
