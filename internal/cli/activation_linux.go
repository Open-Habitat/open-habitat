//go:build linux

package cli

import (
	"errors"
	"net"
	"os"
	"strconv"

	"github.com/maintainer/native-agent-host/internal/transport"
	"golang.org/x/sys/unix"
)

var activationDenied = errors.New("invalid daemon socket activation")

// activatedSocket takes ownership of fd 3 only after checking the activation
// envelope. FileListener duplicates it with close-on-exec; the original is
// closed before any native child can be started.
func activatedSocket(cfg transport.Config) (*net.UnixListener, error) {
	return activatedSocketWith(cfg, transport.ValidateListener)
}
func activatedSocketWith(cfg transport.Config, validate func(transport.Config, *net.UnixListener) error) (*net.UnixListener, error) {
	defer func() {
		for _, k := range []string{"LISTEN_PID", "LISTEN_FDS", "LISTEN_FDNAMES"} {
			_ = os.Unsetenv(k)
		}
	}()
	if os.Getenv("LISTEN_PID") != strconv.Itoa(os.Getpid()) || os.Getenv("LISTEN_FDS") != "1" {
		return nil, activationDenied
	}
	name := os.Getenv("LISTEN_FDNAMES")
	if name != "" && name != "daemon" && name != "daemon.sock" {
		return nil, activationDenied
	}
	// Set CLOEXEC before any operation which might create a child. Do not
	// close an unrelated fd when the envelope is missing or stale.
	unix.CloseOnExec(3)
	domain, err := unix.GetsockoptInt(3, unix.SOL_SOCKET, unix.SO_DOMAIN)
	if err != nil || domain != unix.AF_UNIX {
		return nil, activationDenied
	}
	kind, err := unix.GetsockoptInt(3, unix.SOL_SOCKET, unix.SO_TYPE)
	if err != nil || kind != unix.SOCK_STREAM {
		return nil, activationDenied
	}
	accepting, err := unix.GetsockoptInt(3, unix.SOL_SOCKET, unix.SO_ACCEPTCONN)
	if err != nil || accepting != 1 {
		return nil, activationDenied
	}
	address, err := unix.Getsockname(3)
	if err != nil {
		return nil, activationDenied
	}
	ua, ok := address.(*unix.SockaddrUnix)
	if !ok || ua.Name != cfg.Socket {
		return nil, activationDenied
	}
	file := os.NewFile(3, "activated-daemon-socket")
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
