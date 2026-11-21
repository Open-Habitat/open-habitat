//go:build linux

package cli

import (
	"io"
	"os"
	"path/filepath"

	"golang.org/x/sys/unix"
)

// Replace this process, rather than keeping the product's initialized packages
// resident beside every relay. Resolve beside the executing binary, not PATH or
// the mutable current selector: both files must come from the same generation.
func mcpRelayCommand(args []string, stdin io.Reader, stdout, stderr io.Writer) int {
	exe, err := os.Executable()
	if err == nil {
		relay := filepath.Join(filepath.Dir(exe), "open-habitat-mcp-relay")
		err = unix.Exec(relay, append([]string{relay}, args...), os.Environ())
	}
	return emitError(system("relay_unavailable", "the release's Microsoft relay is unavailable; reinstall the complete release"), options{}, stderr)
}
