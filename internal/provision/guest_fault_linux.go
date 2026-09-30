//go:build linux && nah_guest_fault

package provision

import (
	"os"
	"strings"
	"syscall"
)

// This code exists only in the disposable guest build. The fixture creates
// the root-owned marker before an ensure; production builds omit this file.
func guestCrashAfterStep(phase string) {
	b, err := os.ReadFile("/run/nah-guest-broker-crash")
	if err == nil && strings.TrimSpace(string(b)) == phase {
		_ = syscall.Kill(os.Getpid(), syscall.SIGKILL)
	}
}
