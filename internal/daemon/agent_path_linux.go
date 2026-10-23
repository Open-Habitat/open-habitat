//go:build linux

package daemon

import (
	"os"
	"path/filepath"
)

// agentPath is for native user work started by the mapped user's daemon. Home comes
// from the daemon's verified account binding, never an HTTP or gateway value.
// Host-managed commands keep their separate, absolute executable paths and
// restricted environments.
func agentPath(home string) string {
	// Keep directories even before installation so tools installed during a
	// conversation are immediately available to subsequent child processes.
	path := "PATH=" + filepath.Join(home, ".local", "bin") + ":" + filepath.Join(home, ".cargo", "bin") + ":/usr/local/bin:/usr/bin:/bin"
	// The CLI is not necessarily installed in a system PATH directory. No
	// per-user wrapper or profile edit is needed to reach the shipped binary.
	if executable, err := os.Executable(); err == nil {
		path += ":" + agentReleaseBin(executable, os.Args[0])
	}
	return path
}

func agentReleaseBin(executable, invoked string) string {
	// os.Executable resolves symlinks. Preserve the absolute launch directory
	// (e.g. the installation's current selector) only if it reaches these same
	// bytes. Shells and editors can then follow upgrades without pinning an old
	// generation. Relative argv[0] must never introduce cwd into the tool PATH.
	if filepath.IsAbs(invoked) {
		actual, err := os.Stat(executable)
		launch, launchErr := os.Stat(invoked)
		if err == nil && launchErr == nil && os.SameFile(actual, launch) {
			return filepath.Dir(invoked)
		}
	}
	return filepath.Dir(executable)
}
