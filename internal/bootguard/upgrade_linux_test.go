//go:build linux

package bootguard

import (
	"golang.org/x/sys/unix"
	"os"
	"testing"
)

func TestUpgradeColdWriterLock(t *testing.T) {
	if os.Geteuid() != 0 {
		t.Skip("root-only trusted lock ancestry; root container runs this")
	}
	dir, e := os.MkdirTemp("/root", "upgrade-gate-")
	if e != nil {
		t.Fatal(e)
	}
	defer os.RemoveAll(dir)
	if got := upgradeLock(dir); got != "upgrade_closed" {
		t.Fatal(got)
	}
	fd, e := unix.Open(dir, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if e != nil {
		t.Fatal(e)
	}
	defer unix.Close(fd)
	if e = unix.Flock(fd, unix.LOCK_EX|unix.LOCK_NB); e != nil {
		t.Fatal(e)
	}
	if got := upgradeLock(dir); got != "upgrade_closed" {
		t.Fatal("unrelated host lock authorized upgrade", got)
	}
	lease, e := unix.Open(dir+"/upgrade-live", unix.O_CREAT|unix.O_RDWR|unix.O_CLOEXEC, 0600)
	if e != nil {
		t.Fatal(e)
	}
	defer unix.Close(lease)
	if e = unix.Flock(lease, unix.LOCK_EX|unix.LOCK_NB); e != nil {
		t.Fatal(e)
	}
	if got := upgradeLock(dir); got != "verified" {
		t.Fatal(got)
	}
	unix.Flock(lease, unix.LOCK_UN)
	if got := upgradeLock(dir); got != "upgrade_closed" {
		t.Fatal("dead upgrade lease authorized startup", got)
	}

	unix.Flock(fd, unix.LOCK_UN)
	if got := upgradeLock(dir); got != "upgrade_closed" {
		t.Fatal(got)
	}
	if e = os.Chmod(dir, 0777); e != nil {
		t.Fatal(e)
	}
	if got := upgradeLock(dir); got != "upgrade_fence_unavailable" {
		t.Fatal(got)
	}
}
