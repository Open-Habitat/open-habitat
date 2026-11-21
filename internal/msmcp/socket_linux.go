//go:build linux

package msmcp

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"

	"golang.org/x/sys/unix"
)

// The endpoint lives in the person's home, not under /run: the daemon is a
// system service that cannot create files in its root-owned socket
// directory, and /run/user/<uid> exists only while the person lingers. Pi
// sessions the person starts over SSH or tmux reach the same path. The
// directory is 0700 and the socket 0600, both the person's, and every
// accepted connection must also come from the daemon's own kernel UID
// (SO_PEERCRED); the relay checks the listener's UID the same way. No other
// account, no gateway and no network listener can reach it.
var stateDir = []string{".local", "state", "open-habitat", "mcp"}

const socketName = "microsoft.sock"
const lockName = "microsoft.lock"

// SocketPath is the endpoint for a home.
func SocketPath(home string) string {
	return filepath.Join(append(append([]string{home}, stateDir...), socketName)...)
}

// errPeer is a connection from or to another kernel UID.
var errPeer = errors.New("msmcp: peer is not the person's own Unix user")

// openStateDir walks the endpoint's directory under home without following
// a symlink, creating what is missing with 0700, and returns the final
// directory's descriptor after proving it is the person's own and private.
func openStateDir(home string, create bool) (int, error) {
	fd, err := unix.Open(home, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if err != nil {
		return -1, err
	}
	for _, name := range stateDir {
		next, err := unix.Openat(fd, name, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
		if errors.Is(err, unix.ENOENT) && create {
			if err = unix.Mkdirat(fd, name, 0700); err == nil || errors.Is(err, unix.EEXIST) {
				next, err = unix.Openat(fd, name, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
			}
		}
		unix.Close(fd)
		if err != nil {
			return -1, err
		}
		fd = next
		var st unix.Stat_t
		if err := unix.Fstat(fd, &st); err != nil || int(st.Uid) != os.Geteuid() {
			unix.Close(fd)
			return -1, errPeer
		}
	}
	// The last directory is ours alone, whatever an earlier umask left.
	if create {
		if err := unix.Fchmod(fd, 0700); err != nil {
			unix.Close(fd)
			return -1, err
		}
	}
	var st unix.Stat_t
	if err := unix.Fstat(fd, &st); err != nil || st.Mode&0077 != 0 {
		unix.Close(fd)
		return -1, errPeer
	}
	return fd, nil
}

// fdPath names a file in a held directory; binding through it keeps a
// renamed or replaced directory from redirecting the socket.
func fdPath(dir int, name string) string {
	return fmt.Sprintf("/proc/self/fd/%d/%s", dir, name)
}

// endpoint is the daemon's listener and the lock that makes it the only one
// for the person: two daemons (an overlap during a restart) never both
// serve, so never both own a Microsoft child.
type endpoint struct {
	ln   *net.UnixListener
	lock *os.File
	dir  int
}

// errBusy is another daemon of the person already serving the endpoint.
var errBusy = errors.New("msmcp: another daemon serves the endpoint")

func listen(home string) (*endpoint, error) {
	dir, err := openStateDir(home, true)
	if err != nil {
		return nil, err
	}
	lockFd, err := unix.Openat(dir, lockName, unix.O_RDWR|unix.O_CREAT|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0600)
	if err != nil {
		unix.Close(dir)
		return nil, err
	}
	lock := os.NewFile(uintptr(lockFd), lockName)
	if err := unix.Flock(lockFd, unix.LOCK_EX|unix.LOCK_NB); err != nil {
		lock.Close()
		unix.Close(dir)
		if errors.Is(err, unix.EWOULDBLOCK) {
			return nil, errBusy
		}
		return nil, err
	}
	// Holding the lock, a socket file left by a daemon that died is stale.
	if err := unix.Unlinkat(dir, socketName, 0); err != nil && !errors.Is(err, unix.ENOENT) {
		lock.Close()
		unix.Close(dir)
		return nil, err
	}
	old := unix.Umask(0177)
	ln, err := net.ListenUnix("unix", &net.UnixAddr{Name: fdPath(dir, socketName), Net: "unix"})
	unix.Umask(old)
	if err != nil {
		lock.Close()
		unix.Close(dir)
		return nil, err
	}
	// Close never unlinks by the /proc name; the next listener does.
	ln.SetUnlinkOnClose(false)
	if err := unix.Fchmodat(dir, socketName, 0600, 0); err != nil {
		ln.Close()
		lock.Close()
		unix.Close(dir)
		return nil, err
	}
	return &endpoint{ln: ln, lock: lock, dir: dir}, nil
}

func (e *endpoint) close() {
	e.ln.Close()
	_ = unix.Unlinkat(e.dir, socketName, 0)
	unix.Close(e.dir)
	e.lock.Close()
}

// peerUIDOverride replaces the accepted peer's UID in one test, since an
// unprivileged test cannot connect as another UID. Nil in the product.
var peerUIDOverride atomic.Pointer[int]

// acceptedUID is the UID an accepted connection is judged by.
func acceptedUID(c *net.UnixConn) int {
	if p := peerUIDOverride.Load(); p != nil {
		return *p
	}
	return peerUID(c)
}

// peerUID is the connected peer's kernel UID, -1 when unknown.
func peerUID(c *net.UnixConn) int {
	raw, err := c.SyscallConn()
	if err != nil {
		return -1
	}
	uid := -1
	_ = raw.Control(func(fd uintptr) {
		if cred, err := unix.GetsockoptUcred(int(fd), unix.SOL_SOCKET, unix.SO_PEERCRED); err == nil {
			uid = int(cred.Uid)
		}
	})
	return uid
}

// Hello is the relay's first line: which provider, account and area this
// connection is for. It is a claim, never a credential: the daemon accepts
// only an account its own native configuration names and serves only that
// area's tools, so a relay naming another account gets no more than the
// person's own Unix user could already reach.
type Hello struct {
	Version  int    `json:"habitat_mcp"`
	Provider string `json:"provider"`
	Account  string `json:"account"`
	Area     string `json:"area"`
}

const helloVersion = 1

// maxHello bounds the first line.
const maxHello = 1024

func readHello(r *bufio.Reader) (Hello, error) {
	var line []byte
	for {
		chunk, prefix, err := r.ReadLine()
		if err != nil {
			return Hello{}, err
		}
		line = append(line, chunk...)
		if len(line) > maxHello {
			return Hello{}, errors.New("msmcp: hello too long")
		}
		if !prefix {
			break
		}
	}
	var h Hello
	dec := json.NewDecoder(strings.NewReader(string(line)))
	dec.DisallowUnknownFields()
	if dec.Decode(&h) != nil || dec.More() || h.Version != helloVersion || h.Provider != "microsoft" || h.Account == "" || len(h.Account) > 320 || h.Area == "" {
		return Hello{}, errors.New("msmcp: malformed hello")
	}
	return h, nil
}

// Dial connects to the person's endpoint and sends the hello. The listener
// must be the caller's own kernel UID: a socket another account planted
// could not be reached anyway (the directory is 0700), and this keeps it so
// even if the directory's mode were wrong. wake is called once when nothing
// listens yet, so a Pi started over SSH can start the person's daemon
// (its agent socket is socket-activated); then Dial retries until deadline.
func Dial(home string, h Hello, wake func(), deadline time.Duration) (*net.UnixConn, error) {
	h.Version = helloVersion
	line, err := json.Marshal(h)
	if err != nil {
		return nil, err
	}
	until := time.Now().Add(deadline)
	woke := false
	for {
		conn, err := dialOnce(home)
		if err == nil {
			_ = conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
			if _, err := conn.Write(append(line, '\n')); err != nil {
				conn.Close()
				return nil, err
			}
			_ = conn.SetWriteDeadline(time.Time{})
			return conn, nil
		}
		if errors.Is(err, errPeer) || time.Now().After(until) {
			return nil, err
		}
		if !woke && wake != nil {
			woke = true
			wake()
		}
		time.Sleep(200 * time.Millisecond)
	}
}

func dialOnce(home string) (*net.UnixConn, error) {
	dir, err := openStateDir(home, false)
	if err != nil {
		return nil, err
	}
	defer unix.Close(dir)
	c, err := net.DialUnix("unix", nil, &net.UnixAddr{Name: fdPath(dir, socketName), Net: "unix"})
	if err != nil {
		return nil, err
	}
	if peerUID(c) != os.Geteuid() {
		c.Close()
		return nil, errPeer
	}
	return c, nil
}
