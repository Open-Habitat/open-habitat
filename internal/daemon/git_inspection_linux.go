//go:build linux

package daemon

import (
	"context"
	"strconv"
	"sync"
	"time"
)

// Snapshot and detail reads must not make an idle workspace look busy. Drain
// their bounded commands before scanning /proc and prevent new ones during the
// scan. Never exempt a PID, command name or daemon descendant: a person's shell,
// Git writes and Pi tools must still block, even when started through the daemon.
var gitInspectionScan sync.RWMutex

func inspectGit(ctx context.Context, home string, fd int, args ...string) ([]byte, error) {
	gitInspectionScan.RLock()
	defer gitInspectionScan.RUnlock()
	return cloneCommandWithTimeout(ctx, 2*time.Second, "/usr/bin/git", home, strconv.Itoa(fd), append([]string{"-c", "core.fsmonitor=false", "-c", "core.quotepath=false"}, args...)...)
}
