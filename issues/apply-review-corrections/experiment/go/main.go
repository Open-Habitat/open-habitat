//go:build linux

package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net"
	"os"
	"os/exec"
	"os/signal"
	"strconv"
	"syscall"
	"time"
)

type result struct {
	Role     string `json:"role"`
	PeerUID  uint32 `json:"peer_uid,omitempty"`
	ChildPID int    `json:"child_pid,omitempty"`
}

func peerUID(c *net.UnixConn) (uint32, error) {
	raw, err := c.SyscallConn()
	if err != nil {
		return 0, err
	}
	var uid uint32
	var sockErr error
	if err = raw.Control(func(fd uintptr) {
		var u *syscall.Ucred
		u, sockErr = syscall.GetsockoptUcred(int(fd), syscall.SOL_SOCKET, syscall.SO_PEERCRED)
		if sockErr == nil {
			uid = u.Uid
		}
	}); err != nil {
		return 0, err
	}
	return uid, sockErr
}

func serveOnce(path string, expected uint) error {
	_ = os.Remove(path)
	l, err := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
	if err != nil {
		return err
	}
	l.SetUnlinkOnClose(false)
	defer l.Close()
	if err := os.Chmod(path, 0660); err != nil {
		return err
	}
	c, err := l.AcceptUnix()
	if err != nil {
		return err
	}
	defer c.Close()
	uid, err := peerUID(c)
	if err != nil {
		return err
	}
	if uid != uint32(expected) {
		return fmt.Errorf("peer_not_authorized: expected uid %d, got %d", expected, uid)
	}
	return json.NewEncoder(c).Encode(result{Role: "daemon", PeerUID: uid})
}

func runChild(ctx context.Context) error {
	cmd := exec.Command("/bin/sh", "-c", "trap 'exit 0' TERM; while :; do sleep 1; done")
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if err := cmd.Start(); err != nil {
		return err
	}
	_ = json.NewEncoder(os.Stdout).Encode(result{Role: "daemon", ChildPID: cmd.Process.Pid})
	<-ctx.Done()
	if err := syscall.Kill(-cmd.Process.Pid, syscall.SIGTERM); err != nil && !errors.Is(err, syscall.ESRCH) {
		return err
	}
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	select {
	case <-done:
		return nil
	case <-time.After(2 * time.Second):
		_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		<-done
		return errors.New("child shutdown exceeded grace period")
	}
}

func main() {
	role := flag.String("role", "", "gateway or daemon")
	socket := flag.String("socket", "", "Unix socket path")
	expected := flag.Uint("expected-peer-uid", uint(os.Getuid()), "accepted peer UID")
	child := flag.Bool("child", false, "run a directly owned child until SIGTERM")
	flag.Parse()
	if *role != "gateway" && *role != "daemon" {
		fmt.Fprintln(os.Stderr, "role must be gateway or daemon")
		os.Exit(1)
	}
	var err error
	if *child {
		ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
		defer stop()
		err = runChild(ctx)
	} else if *role == "daemon" {
		if *socket == "" {
			err = errors.New("socket is required")
		} else {
			err = serveOnce(*socket, *expected)
		}
	} else {
		json.NewEncoder(os.Stdout).Encode(result{Role: *role})
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	_ = strconv.IntSize
}
