//go:build linux

package daemon

import "path/filepath"

// agentPath is for native user work started by the mapped user's daemon. Home comes
// from the daemon's verified account binding, never an HTTP or gateway value.
// Host-managed commands keep their separate, absolute executable paths and
// restricted environments.
func agentPath(home string) string {
	// Keep directories even before installation so tools installed during a
	// conversation are immediately available to subsequent child processes.
	return "PATH=" + filepath.Join(home, ".local", "bin") + ":" + filepath.Join(home, ".cargo", "bin") + ":/usr/local/bin:/usr/bin:/bin"
}
