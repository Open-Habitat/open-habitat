//go:build linux

package daemon

import (
	"fmt"
	"net"

	"golang.org/x/sys/unix"
)

// PeerUID obtains kernel-authenticated credentials from a Unix-domain peer.
// Browser headers and requested usernames are never authority.
func PeerUID(connection *net.UnixConn) (uint32, error) {
	raw, err := connection.SyscallConn()
	if err != nil {
		return 0, fmt.Errorf("unix connection: %w", err)
	}
	var credentials *unix.Ucred
	var controlErr error
	if err := raw.Control(func(fd uintptr) {
		credentials, controlErr = unix.GetsockoptUcred(int(fd), unix.SOL_SOCKET, unix.SO_PEERCRED)
	}); err != nil {
		return 0, fmt.Errorf("peer control: %w", err)
	}
	if controlErr != nil {
		return 0, fmt.Errorf("peer credentials: %w", controlErr)
	}
	return credentials.Uid, nil
}
