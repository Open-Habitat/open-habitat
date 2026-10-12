//go:build linux

package storagequota

import (
	"testing"
	"unsafe"
)

func TestQuotaStatEnforcementAndABI(t *testing.T) {
	if size := unsafe.Sizeof(quotaStat{}); size != 160 {
		t.Fatalf("fs_quota_statv v1 ABI size: %d", size)
	}
	for _, tc := range []struct {
		flags uint16
		want  bool
	}{{0, false}, {userAcct, false}, {userEnforced, false}, {userAcct | userEnforced, true}} {
		if got := quotaEnforced(tc.flags); got != tc.want {
			t.Fatalf("flags %#x: enforced=%v, want %v", tc.flags, got, tc.want)
		}
	}
}

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
