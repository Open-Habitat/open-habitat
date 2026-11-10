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

// Both listeners must be supplied regardless of which one triggered activation.
func activatedSockets(cfg transport.Config) (*net.UnixListener, *net.UnixListener, error) {
	return activatedSocketsWith(cfg, transport.ValidateListener, transport.ValidateAgentListener)
}
func activatedSocketsWith(cfg transport.Config, gatewayCheck, agentCheck func(transport.Config, *net.UnixListener) error) (*net.UnixListener, *net.UnixListener, error) {
	defer func() {
		for _, k := range []string{"LISTEN_PID", "LISTEN_FDS", "LISTEN_FDNAMES"} {
			os.Unsetenv(k)
		}
	}()
	if os.Getenv("LISTEN_PID") != strconv.Itoa(os.Getpid()) || os.Getenv("LISTEN_FDS") != "2" {
		return nil, nil, activationDenied
	}
	names := strings.Split(os.Getenv("LISTEN_FDNAMES"), ":")
	if len(names) != 2 || !((names[0] == "daemon" && names[1] == "agent") || (names[0] == "agent" && names[1] == "daemon")) {
		return nil, nil, activationDenied
	}
	unix.CloseOnExec(3)
	unix.CloseOnExec(4)
	var daemon, agent *net.UnixListener
	for i, name := range names {
		path, validate := cfg.Socket, gatewayCheck
		if name == "agent" {
			path, validate = transport.AgentPath(cfg), agentCheck
		}
		ln, err := activatedFD(3+i, cfg, path, validate)
		if err != nil {
			if daemon != nil {
				daemon.Close()
			}
			if agent != nil {
				agent.Close()
			}
			return nil, nil, activationDenied
		}
		if name == "daemon" {
			daemon = ln
		} else {
			agent = ln
		}
	}
	return daemon, agent, nil
}
