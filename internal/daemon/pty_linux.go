//go:build linux

package daemon

import (
	"fmt"
	"os"
	"os/exec"
	"syscall"

	"golang.org/x/sys/unix"
)

// openPTY allocates a pseudo-terminal pair from /dev/ptmx. The controller is
// non-blocking so that closing it wakes a pending Read through Go's poller.
func openPTY() (controller, terminal *os.File, err error) {
	fd, err := unix.Open("/dev/ptmx", unix.O_RDWR|unix.O_NOCTTY|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, nil, err
	}
	if err := unix.IoctlSetPointerInt(fd, unix.TIOCSPTLCK, 0); err != nil {
		unix.Close(fd)
		return nil, nil, err
	}
	n, err := unix.IoctlGetInt(fd, unix.TIOCGPTN)
	if err != nil {
		unix.Close(fd)
		return nil, nil, err
	}
	tfd, err := unix.Open(fmt.Sprintf("/dev/pts/%d", n), unix.O_RDWR|unix.O_NOCTTY|unix.O_CLOEXEC, 0)
	if err != nil {
		unix.Close(fd)
		return nil, nil, err
	}
	if err := unix.SetNonblock(fd, true); err != nil {
		unix.Close(fd)
		unix.Close(tfd)
		return nil, nil, err
	}
	return os.NewFile(uintptr(fd), "pty-controller"), os.NewFile(uintptr(tfd), "pty-terminal"), nil
}

func resizePTY(f *os.File, cols, rows int) error {
	raw, err := f.SyscallConn()
	if err != nil {
		return err
	}
	var ioctlErr error
	err = raw.Control(func(fd uintptr) {
		ioctlErr = unix.IoctlSetWinsize(int(fd), unix.TIOCSWINSZ, &unix.Winsize{Col: uint16(cols), Row: uint16(rows)})
	})
	if err != nil {
		return err
	}
	return ioctlErr
}

// startOnPTY runs cmd as the session leader of a new terminal of the given
// size. The caller owns the returned controller; the terminal side is closed
// here once the child holds it.
func startOnPTY(cmd *exec.Cmd, cols, rows int) (*os.File, error) {
	controller, terminal, err := openPTY()
	if err != nil {
		return nil, err
	}
	defer terminal.Close()
	if err := unix.IoctlSetWinsize(int(terminal.Fd()), unix.TIOCSWINSZ, &unix.Winsize{Col: uint16(cols), Row: uint16(rows)}); err != nil {
		controller.Close()
		return nil, err
	}
	cmd.Stdin, cmd.Stdout, cmd.Stderr = terminal, terminal, terminal
	// The terminal client ends with the daemon; the tmux server it attaches to
	// does not, which is the point.
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true, Setctty: true, Ctty: 0, Pdeathsig: syscall.SIGKILL}
	if err := cmd.Start(); err != nil {
		controller.Close()
		return nil, err
	}
	return controller, nil
}
