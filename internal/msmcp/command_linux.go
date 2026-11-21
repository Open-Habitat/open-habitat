//go:build linux

package msmcp

import (
	"fmt"
	"io"
	"net"
	"os"
	"os/user"
	"strconv"
	"strings"
	"time"
)

// Command runs the internal MCP transport, not an operator CLI. The public
// entry is open-habitat mcp-relay; stdout is exclusively the MCP byte stream.
func Command(args []string, stdin io.Reader, stdout, stderr io.Writer) int {
	fail := func(code, message string, exit int) int {
		fmt.Fprintf(stderr, "{\"schema_version\":1,\"error\":{\"code\":%q,\"message\":%q}}\n", code, message)
		return exit
	}
	if len(args) != 5 || args[0] != "microsoft" || args[1] != "--account" || args[3] != "--area" || strings.TrimSpace(args[2]) == "" || AreaTools(args[4]) == nil {
		return fail("usage", "expected mcp-relay microsoft --account ADDRESS --area mail|calendar|contacts|files|admin", 1)
	}
	home, err := os.UserHomeDir()
	if err != nil || home == "" || os.Geteuid() <= 0 {
		return fail("identity_unavailable", "the person's home is unavailable", 2)
	}
	if err := Relay(home, Hello{Provider: "microsoft", Account: args[2], Area: args[4]}, wakeDaemon, stdin, stdout); err != nil {
		// Never pass paths, account data or native errors to Pi's log.
		return fail("daemon_unavailable", "Habitat's Microsoft connection is not reachable; the person's daemon is not running", 2)
	}
	return 0
}

// A Pi started over SSH can wake its own daemon through the socket-activated
// agent endpoint. This request asks for nothing; any answer means it runs.
func wakeDaemon() {
	uid := os.Geteuid()
	if uid <= 0 {
		return
	}
	u, err := user.LookupId(strconv.Itoa(uid))
	if err != nil || u.Username == "" || strings.ContainsAny(u.Username, "/\\\x00") || u.Username == "." || u.Username == ".." {
		return
	}
	c, err := net.DialTimeout("unix", "/run/open-habitat/users/"+u.Username+"/agent.sock", 2*time.Second)
	if err != nil {
		return
	}
	defer c.Close()
	_ = c.SetDeadline(time.Now().Add(5 * time.Second))
	_, _ = io.WriteString(c, "GET /agent/v1/environment HTTP/1.1\r\nHost: open-habitat\r\nConnection: close\r\n\r\n")
	_, _ = c.Read(make([]byte, 1))
}
