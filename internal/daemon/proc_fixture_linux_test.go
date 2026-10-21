//go:build linux

package daemon

import (
	"os"
	"path/filepath"
	"strconv"
	"testing"
)

// exposeTestProcess keeps real procfs descriptor/UID checks, but limits the
// census to this fixture's children instead of other sessions on the host.
func exposeTestProcess(t testing.TB, proc string, pid int) {
	t.Helper()
	name := filepath.Join(proc, strconv.Itoa(pid))
	if err := os.Symlink(filepath.Join("/proc", strconv.Itoa(pid)), name); err != nil {
		t.Fatal(err)
	}
}

func isolateDeletionProcesses(t *testing.T) string {
	t.Helper()
	old := deletionProcRoot
	proc := t.TempDir()
	deletionProcRoot = proc
	t.Cleanup(func() { deletionProcRoot = old })
	return proc
}
