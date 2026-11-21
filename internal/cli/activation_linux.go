//go:build linux

package cli

import (
	"errors"
	"net"
	"os"
	"strconv"
	"strings"

	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

var activationDenied = errors.New("invalid daemon socket activation")

func activatedFD(fd int, cfg transport.Config, path string, validate func(transport.Config, *net.UnixListener) error) (*net.UnixListener, error) {
	// Set CLOEXEC before any operation which might create a child. Do not
	// close an unrelated fd when the envelope is missing or stale.
	unix.CloseOnExec(fd)
	domain, err := unix.GetsockoptInt(fd, unix.SOL_SOCKET, unix.SO_DOMAIN)
	if err != nil || domain != unix.AF_UNIX {
		return nil, activationDenied
	}
	kind, err := unix.GetsockoptInt(fd, unix.SOL_SOCKET, unix.SO_TYPE)
	if err != nil || kind != unix.SOCK_STREAM {
		return nil, activationDenied
	}
	accepting, err := unix.GetsockoptInt(fd, unix.SOL_SOCKET, unix.SO_ACCEPTCONN)
	if err != nil || accepting != 1 {
		return nil, activationDenied
	}
	address, err := unix.Getsockname(fd)
	if err != nil {
		return nil, activationDenied
	}
	ua, ok := address.(*unix.SockaddrUnix)
	if !ok || ua.Name != path {
		return nil, activationDenied
	}
	file := os.NewFile(uintptr(fd), "activated-daemon-socket")
	ln, err := net.FileListener(file)
	_ = file.Close()
	if err != nil {
		return nil, activationDenied
	}
	listener, ok := ln.(*net.UnixListener)
	if !ok {
		_ = ln.Close()
		return nil, activationDenied
	}
	listener.SetUnlinkOnClose(false)
	if validate(cfg, listener) != nil {
		_ = listener.Close()
		return nil, activationDenied
	}
	return listener, nil
}

// The three listeners are supplied together whichever one triggered
// activation: daemon.sock (the gateway, as the owner), agent.sock (the
// person's own agents) and guest.sock (other people, through the gateway).
type activated struct{ daemon, agent, guest *net.UnixListener }

func (a activated) close() {
	for _, ln := range []*net.UnixListener{a.daemon, a.agent, a.guest} {
		if ln != nil {
			ln.Close()
		}
	}
}

func activatedSockets(cfg transport.Config) (activated, error) {
	return activatedSocketsWith(cfg, transport.ValidateListener, transport.ValidateAgentListener, transport.ValidateGuestListener)
}
func activatedSocketsWith(cfg transport.Config, gatewayCheck, agentCheck, guestCheck func(transport.Config, *net.UnixListener) error) (activated, error) {
	defer func() {
		for _, k := range []string{"LISTEN_PID", "LISTEN_FDS", "LISTEN_FDNAMES"} {
			os.Unsetenv(k)
		}
	}()
	if os.Getenv("LISTEN_PID") != strconv.Itoa(os.Getpid()) || os.Getenv("LISTEN_FDS") != "3" {
		return activated{}, activationDenied
	}
	names := strings.Split(os.Getenv("LISTEN_FDNAMES"), ":")
	seen := map[string]bool{}
	for _, name := range names {
		if (name != "daemon" && name != "agent" && name != "guest") || seen[name] {
			return activated{}, activationDenied
		}
		seen[name] = true
	}
	if len(names) != 3 {
		return activated{}, activationDenied
	}
	for i := range names {
		unix.CloseOnExec(3 + i)
	}
	var out activated
	for i, name := range names {
		path, validate, slot := cfg.Socket, gatewayCheck, &out.daemon
		switch name {
		case "agent":
			path, validate, slot = transport.AgentPath(cfg), agentCheck, &out.agent
		case "guest":
			path, validate, slot = transport.GuestPath(cfg), guestCheck, &out.guest
		}
		ln, err := activatedFD(3+i, cfg, path, validate)
		if err != nil {
			out.close()
			return activated{}, activationDenied
		}
		*slot = ln
	}
	return out, nil
}
