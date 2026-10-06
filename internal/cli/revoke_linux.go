//go:build linux

package cli

import (
	"bufio"
	"context"
	"errors"
	"io"
	"net"
	"os"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/maintainer/native-agent-host/internal/gateway"
	"golang.org/x/sys/unix"
)

const revokeSocket = "/run/native-agent-host/revoke.sock"

var adminControlSocket = revokeSocket

// The socket is created by systemd, root:root 0600; the gateway cannot
// create it or change its permissions. SO_PEERCRED independently checks root.
func revokeListener() (net.Listener, error) {
	defer func() {
		for _, k := range []string{"LISTEN_PID", "LISTEN_FDS", "LISTEN_FDNAMES"} {
			_ = os.Unsetenv(k)
		}
	}()
	if os.Getenv("LISTEN_PID") != strconv.Itoa(os.Getpid()) || os.Getenv("LISTEN_FDS") != "1" || os.Getenv("LISTEN_FDNAMES") != "revoke" {
		return nil, errors.New("revoke socket activation missing")
	}
	unix.CloseOnExec(3)
	domain, e := unix.GetsockoptInt(3, unix.SOL_SOCKET, unix.SO_DOMAIN)
	if e != nil || domain != unix.AF_UNIX {
		return nil, errors.New("invalid revoke descriptor")
	}
	kind, e := unix.GetsockoptInt(3, unix.SOL_SOCKET, unix.SO_TYPE)
	if e != nil || kind != unix.SOCK_STREAM {
		return nil, errors.New("invalid revoke descriptor")
	}
	accepting, e := unix.GetsockoptInt(3, unix.SOL_SOCKET, unix.SO_ACCEPTCONN)
	if e != nil || accepting != 1 {
		return nil, errors.New("invalid revoke descriptor")
	}
	address, e := unix.Getsockname(3)
	ua, ok := address.(*unix.SockaddrUnix)
	if e != nil || !ok || ua.Name != revokeSocket {
		return nil, errors.New("invalid revoke socket address")
	}
	f := os.NewFile(3, "revoke-socket")
	if f == nil {
		return nil, errors.New("missing descriptor")
	}
	defer f.Close()
	ln, err := net.FileListener(f)
	if err != nil {
		return nil, err
	}
	if _, ok := ln.(*net.UnixListener); !ok {
		ln.Close()
		return nil, errors.New("not a unix listener")
	}
	ln.(*net.UnixListener).SetUnlinkOnClose(false)
	return ln, nil
}

func serveRevocations(ctx context.Context, ln net.Listener, auth *gateway.Auth) {
	go func() { <-ctx.Done(); ln.Close() }()
	for {
		c, err := ln.Accept()
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			auth.LogControlFailure() // private control failure must not be silent while HTTP still serves
			select {
			case <-ctx.Done():
				return
			case <-time.After(100 * time.Millisecond):
				continue
			}
		}
		go func() {
			defer c.Close()
			_ = c.SetDeadline(time.Now().Add(5 * time.Second))
			uc, ok := c.(*net.UnixConn)
			if !ok {
				return
			}
			raw, err := uc.SyscallConn()
			if err != nil {
				return
			}
			var uid uint32 = ^uint32(0)
			err = raw.Control(func(fd uintptr) {
				cred, e := syscall.GetsockoptUcred(int(fd), syscall.SOL_SOCKET, syscall.SO_PEERCRED)
				if e == nil {
					uid = cred.Uid
				}
			})
			if err != nil || uid != 0 {
				return
			}
			line, err := bufio.NewReader(io.LimitReader(c, 1100)).ReadString('\n')
			if err != nil || len(line) > 1090 {
				return
			}
			if strings.HasPrefix(line, "ADMIN ") {
				result, e := auth.AdminControl(ctx, []byte(strings.TrimSuffix(strings.TrimPrefix(line, "ADMIN "), "\n")))
				if e != nil {
					auth.LogAdminControlFailure(e)
					c.Write([]byte("ERROR " + gateway.AdminControlError(e) + "\n"))
				} else {
					c.Write(append(result, '\n'))
				}
				return
			}
			if len(line) > 32 {
				return
			}
			if auth.RevokeSubject(ctx, strings.TrimSuffix(line, "\n")) != nil {
				c.Write([]byte("DENIED\n"))
				return
			}
			c.Write([]byte("OK\n"))
		}()
	}
}

func revokeCommand(args []string) (any, error) {
	if len(args) != 2 || args[0] != "subject" {
		return nil, usage("expected revoke subject <canonical numeric GitHub ID> (root only)")
	}
	if os.Geteuid() != 0 {
		return nil, system("permission_denied", "root required")
	}
	id := args[1]
	n, e := strconv.ParseUint(id, 10, 64)
	if e != nil || n == 0 || strconv.FormatUint(n, 10) != id {
		return nil, usage("invalid subject")
	}
	c, e := net.DialTimeout("unix", revokeSocket, 3*time.Second)
	if e != nil {
		return nil, system("control_unavailable", "private gateway control socket unavailable")
	}
	defer c.Close()
	c.SetDeadline(time.Now().Add(5 * time.Second))
	if _, e = c.Write([]byte(id + "\n")); e != nil {
		return nil, system("control_unavailable", "revoke request failed")
	}
	line, e := bufio.NewReader(c).ReadString('\n')
	if e != nil {
		return nil, system("control_unavailable", "revocation acknowledgement missing; status unknown, inspect gateway before retry")
	}
	if line != "OK\n" {
		return nil, system("revoke_denied", "broker binding or control channel denied revocation")
	}
	return envelope(map[string]any{"revoked": true}), nil
}
