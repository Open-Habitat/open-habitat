//go:build linux

package cli

import (
	"io"
	"net"
	"os"
	"runtime/debug"
	"time"

	"github.com/open-habitat/open-habitat/internal/msmcp"
)

// mcpRelayCommand is a Pi MCP entry's stdio command for one area of one
// connected Microsoft account (ADR 0039). It is MCP's stdio transport, not
// the canon's resource surface: stdout is the protocol and stdin Pi's
// requests. The daemon owns the one Microsoft process, its area filter and
// every account binding; the relay only copies bytes to the person's own
// endpoint and names the account and area it was registered for.
func mcpRelayCommand(args []string, stdin io.Reader, stdout, stderr io.Writer) int {
	if len(args) != 5 || args[0] != "microsoft" || args[1] != "--account" || args[3] != "--area" || args[2] == "" || msmcp.AreaTools(args[4]) == nil {
		return emitError(usage("expected mcp-relay microsoft --account ADDRESS --area mail|calendar|contacts|files|admin"), options{}, stderr)
	}
	// A relay lives as long as its conversation, twenty of them for four
	// conversations: give back what the binary's package initialisation
	// left on the heap, and keep the copy loop's own garbage small.
	debug.SetGCPercent(20)
	debug.FreeOSMemory()
	home, err := os.UserHomeDir()
	if err != nil || home == "" || os.Geteuid() <= 0 {
		return emitError(system("identity_unavailable", "the person's home is unavailable"), options{}, stderr)
	}
	if err := msmcp.Relay(home, msmcp.Hello{Provider: "microsoft", Account: args[2], Area: args[4]}, wakeDaemon, stdin, stdout); err != nil {
		// Fixed text: no path or native error reaches Pi's log.
		return emitError(system("daemon_unavailable", "Habitat's Microsoft connection is not reachable; the person's daemon is not running"), options{}, stderr)
	}
	return 0
}

// wakeDaemon starts the person's daemon through its socket-activated own-user
// agent socket, for a Pi started over SSH while no browser had started it.
// The request asks for nothing; any answer means the daemon runs.
func wakeDaemon() {
	path, err := personalSocket()
	if err != nil {
		return
	}
	c, err := net.DialTimeout("unix", path, 2*time.Second)
	if err != nil {
		return
	}
	defer c.Close()
	_ = c.SetDeadline(time.Now().Add(5 * time.Second))
	_, _ = io.WriteString(c, "GET /agent/v1/environment HTTP/1.1\r\nHost: open-habitat\r\nConnection: close\r\n\r\n")
	_, _ = c.Read(make([]byte, 1))
}
