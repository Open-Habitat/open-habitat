//go:build linux

package storagequota

import "testing"

func TestInvalidUIDAndLimitsNeverReachKernel(t *testing.T) {
	for _, uid := range []uint32{0, 999, 60001, ^uint32(0)} {
		if _, err := Read(uid); err != ErrUnavailable {
			t.Fatalf("Read(%d): %v", uid, err)
		}
		if err := Set(uid, 1<<30); err != ErrUnavailable {
			t.Fatalf("Set(%d): %v", uid, err)
		}
	}
	for _, bytes := range []uint64{0, 1024, 1<<20 + 1, 1<<50 + 1024, ^uint64(0)} {
		if err := Set(1000, bytes); err != ErrUnavailable {
			t.Fatalf("Set(%d): %v", bytes, err)
		}
	}
}
