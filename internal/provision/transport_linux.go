//go:build linux

package provision

import (
	"context"
	"encoding/binary"
	"errors"
	"io"
	"net"
	"os"
	"path/filepath"
	"sync"
	"time"

	"golang.org/x/sys/unix"
)

// The broker transport accepts only an inherited, already bound and listening
// AF_UNIX stream socket. The caller must pass exactly the systemd socket FD;
// neither this package nor its default handler creates accounts or routes.
const exchangeTimeout = 2 * time.Second // admission, framing and authorize
// A first ensure runs several journal fsyncs and individually bounded (3s)
// NSS, ACL and systemd commands. This is a separate finite mutation budget,
// never granted before a complete, validated frame from the permitted UID.
const ensureTimeout = 90 * time.Second
const ensureClientTimeout = ensureTimeout + exchangeTimeout + 3*time.Second

func longExchange(operation string) bool {
	return operation == "ensure" || operation == "admit" || operation == "withdraw" || operation == OpStopRevoked
}

const maxActiveEnsures = 2 // includes lock waiters; the writer itself serializes mutations

// Hard cap applies even when the permitted gateway UID is compromised.
const maxActiveExchanges = 8

var ErrTransport = errors.New("broker transport unavailable")

// Handler must honor ctx while waiting for locks or host operations. Closing
// the socket cannot interrupt a handler that ignores cancellation.
type Handler func(context.Context, Request) Reply

type Server struct {
	GatewayUID uint32
	// SocketOwnerUID is the expected socket owner (0 in production).
	// Non-root values are for hermetic tests only.
	SocketOwnerUID uint32
	// SocketPath is the configured, absolute systemd ListenStream path.
	SocketPath string
	// Handler must be supplied explicitly. Nil never returns a route.
	Handler Handler
}

type Client struct {
	SocketPath string
	// SocketOwnerUID is the expected owner of the systemd listening socket
	// (normally 0); SO_PEERCRED identifies its creator, not the acceptor.
	SocketOwnerUID uint32
}

func validPath(path string) bool {
	return filepath.IsAbs(path) && filepath.Clean(path) == path && path != "/" && len(path) < 108 && path[0] != '@'
}

func listener(files []*os.File, path string, owner uint32) (*net.UnixListener, error) {
	if len(files) != 1 || files[0] == nil || !validPath(path) {
		return nil, ErrTransport
	}
	fd := int(files[0].Fd())
	var st unix.Stat_t
	if unix.Fstat(fd, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFSOCK || st.Uid != owner {
		return nil, ErrTransport
	}
	typ, err := unix.GetsockoptInt(fd, unix.SOL_SOCKET, unix.SO_TYPE)
	if err != nil || typ != unix.SOCK_STREAM {
		return nil, ErrTransport
	}
	listening, err := unix.GetsockoptInt(fd, unix.SOL_SOCKET, unix.SO_ACCEPTCONN)
	if err != nil || listening != 1 {
		return nil, ErrTransport
	}
	sa, err := unix.Getsockname(fd)
	addr, ok := sa.(*unix.SockaddrUnix)
	if err != nil || !ok || addr.Name != path {
		return nil, ErrTransport
	}
	var pathStat unix.Stat_t
	if unix.Lstat(path, &pathStat) != nil || pathStat.Mode&unix.S_IFMT != unix.S_IFSOCK || pathStat.Uid != owner || pathStat.Mode&0007 != 0 {
		return nil, ErrTransport
	}
	// FileListener duplicates the inherited descriptor. The caller retains its FD.
	ln, err := net.FileListener(files[0])
	if err != nil {
		return nil, ErrTransport
	}
	ul, ok := ln.(*net.UnixListener)
	if !ok {
		ln.Close()
		return nil, ErrTransport
	}
	ul.SetUnlinkOnClose(false)
	return ul, nil
}

func peerUID(c *net.UnixConn) (uint32, error) {
	raw, err := c.SyscallConn()
	if err != nil {
		return 0, ErrTransport
	}
	var cred *unix.Ucred
	var controlErr error
	err = raw.Control(func(fd uintptr) { cred, controlErr = unix.GetsockoptUcred(int(fd), unix.SOL_SOCKET, unix.SO_PEERCRED) })
	if err != nil || controlErr != nil || cred == nil {
		return 0, ErrTransport
	}
	return cred.Uid, nil
}

// Serve stops accepting on cancellation. Every accepted connection has an
// independent deadline; malformed exchanges are dropped without invoking the
// handler. Admission is capped and excess clients are closed immediately.
// Each admitted exchange has a context bounded by the exchange timeout and
// Serve's parent context. Cancellation closes its socket and waits for the
// handler to honor ctx; a socket deadline cannot interrupt arbitrary handler
// code. A nil handler returns state_unavailable.
func (s Server) Serve(ctx context.Context, files []*os.File) error {
	if ctx == nil || s.GatewayUID == 0 {
		return ErrTransport
	}
	ln, err := listener(files, s.SocketPath, s.SocketOwnerUID)
	if err != nil {
		return err
	}
	defer ln.Close()
	stopAccept := context.AfterFunc(ctx, func() { _ = ln.Close() })
	defer stopAccept()
	var wg sync.WaitGroup
	defer wg.Wait()
	active := make(chan struct{}, maxActiveExchanges)
	ensures := make(chan struct{}, maxActiveEnsures)
	for {
		if ctx.Err() != nil {
			return nil
		}
		if err := ln.SetDeadline(time.Now().Add(100 * time.Millisecond)); err != nil {
			return ErrTransport
		}
		conn, err := ln.AcceptUnix()
		if ne, ok := err.(net.Error); ok && ne.Timeout() {
			continue
		}
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			return ErrTransport
		}
		// Never queue an accepted client waiting for capacity: a peer that
		// holds the permitted UID must not create unbounded workers or FDs.
		if ctx.Err() != nil {
			conn.Close()
			return nil
		}
		select {
		case active <- struct{}{}:
			// Start the budget at admission, not after peer validation or framing.
			exchangeCtx, cancel := context.WithTimeout(ctx, exchangeTimeout)
			wg.Add(1)
			go func() {
				defer wg.Done()
				defer func() { <-active }()
				defer conn.Close()
				defer cancel()
				if exchangeCtx.Err() == nil {
					s.exchange(ctx, exchangeCtx, conn, ensures)
				}
			}()
		default:
			conn.Close()
		}
	}
}

func (s Server) exchange(parent, admission context.Context, conn *net.UnixConn, ensures chan struct{}) {
	stopAdmission := context.AfterFunc(admission, func() { _ = conn.Close() })
	defer stopAdmission()
	ctx := admission
	deadline, _ := ctx.Deadline() // every exchange is created with WithTimeout
	if conn.SetDeadline(deadline) != nil {
		return
	}
	uid, err := peerUID(conn)
	if err != nil || uid != s.GatewayUID {
		return
	}
	b, err := readFrame(conn)
	if err != nil {
		return
	}
	r, err := ParseRequest(b)
	if err != nil || ctx.Err() != nil {
		return
	}
	// Admit may rebuild a restored binding's runtime directory with the same
	// bounded host commands, and withdraw and stop_revoked stop people's
	// listeners, so they share ensure's mutation budget and slots.
	if longExchange(r.Operation) {
		// Never allow slow framing to buy a long-lived worker or FD. Reject
		// excess valid ensures instead of queueing behind a stalled mutation.
		select {
		case ensures <- struct{}{}:
			defer func() { <-ensures }()
		default:
			return
		}
		if admission.Err() != nil {
			return
		}
		if !stopAdmission() || admission.Err() != nil {
			return
		}
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(parent, ensureTimeout)
		defer cancel()
		stop := context.AfterFunc(ctx, func() { _ = conn.Close() })
		defer stop()
		deadline, _ = ctx.Deadline()
		if conn.SetDeadline(deadline) != nil {
			return
		}
	}
	reply := Reply{Version: 1, Failure: StateUnavailable}
	if s.Handler != nil {
		reply = s.Handler(ctx, r)
	}
	if ctx.Err() != nil {
		return
	}
	b, err = EncodeReply(reply)
	if err != nil {
		return
	}
	_ = writeFrame(conn, b)
	_ = conn.CloseWrite()
}

// Exchange validates the reply, including absence of trailing frames. Context
// cancellation closes the connection, including while waiting for EOF.
func (c Client) Exchange(ctx context.Context, r Request) (Reply, error) {
	if ctx == nil || !validPath(c.SocketPath) {
		return Reply{}, ErrTransport
	}
	b, err := EncodeRequest(r)
	if err != nil {
		return Reply{}, ErrInvalid
	}
	budget := exchangeTimeout
	if longExchange(r.Operation) {
		budget = ensureClientTimeout
	}
	deadline := time.Now().Add(budget)
	if d, ok := ctx.Deadline(); ok && d.Before(deadline) {
		deadline = d
	}
	dialer := net.Dialer{Deadline: deadline}
	raw, err := dialer.DialContext(ctx, "unix", c.SocketPath)
	if err != nil {
		return Reply{}, ErrTransport
	}
	conn, ok := raw.(*net.UnixConn)
	if !ok {
		raw.Close()
		return Reply{}, ErrTransport
	}
	defer conn.Close()
	stop := context.AfterFunc(ctx, func() { conn.Close() })
	defer stop()
	uid, err := peerUID(conn)
	if err != nil || uid != c.SocketOwnerUID {
		return Reply{}, ErrTransport
	}
	if conn.SetDeadline(deadline) != nil {
		return Reply{}, ErrTransport
	}
	if writeFrame(conn, b) != nil || conn.CloseWrite() != nil {
		return Reply{}, ErrTransport
	}
	b, err = readFrame(conn)
	if err != nil {
		return Reply{}, ErrTransport
	}
	reply, err := ParseReply(b)
	if err != nil {
		return Reply{}, ErrTransport
	}
	if ctx.Err() != nil {
		return Reply{}, ErrTransport
	}
	return reply, nil
}

// A frame is uint32 big-endian length plus <= MaxMessage bytes, followed by
// EOF (half-close). Reading the EOF rejects duplicates and extra bytes before
// any handler or reply is used; short headers and payloads are denied.
func readFrame(r io.Reader) ([]byte, error) {
	var header [4]byte
	if _, err := io.ReadFull(r, header[:]); err != nil {
		return nil, ErrTransport
	}
	n := binary.BigEndian.Uint32(header[:])
	if n == 0 || n > MaxMessage {
		return nil, ErrTransport
	}
	b := make([]byte, n)
	if _, err := io.ReadFull(r, b); err != nil {
		return nil, ErrTransport
	}
	var extra [1]byte
	count, err := r.Read(extra[:])
	if count != 0 || err != io.EOF {
		return nil, ErrTransport
	}
	return b, nil
}
func writeFrame(w io.Writer, b []byte) error {
	if len(b) == 0 || len(b) > MaxMessage {
		return ErrTransport
	}
	var header [4]byte
	binary.BigEndian.PutUint32(header[:], uint32(len(b)))
	for _, part := range [][]byte{header[:], b} {
		for len(part) != 0 {
			n, err := w.Write(part)
			if err != nil || n <= 0 {
				return ErrTransport
			}
			part = part[n:]
		}
	}
	return nil
}
