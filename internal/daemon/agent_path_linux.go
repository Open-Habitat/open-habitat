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
	return filepath.Dir(launchedExecutable(executable, invoked))
}

// launchedExecutable is the absolute path this binary was started through
// (e.g. the installation's current selector) if it reaches these same bytes,
// else the resolved executable. os.Executable resolves symlinks, so it names
// one release generation; the launch path follows upgrades, so shells,
// editors and the registered Git helper never pin an old generation that a
// release switch and its removal leave behind. Relative or unclean argv[0]
// must never introduce cwd or an unverified path.
func launchedExecutable(executable, invoked string) string {
	if filepath.IsAbs(invoked) && filepath.Clean(invoked) == invoked {
		actual, err := os.Stat(executable)
		launch, launchErr := os.Stat(invoked)
		if err == nil && launchErr == nil && os.SameFile(actual, launch) {
			return invoked
		}
	}
	return executable
}
