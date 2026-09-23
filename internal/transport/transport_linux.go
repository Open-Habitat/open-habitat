//go:build linux

// Package transport implements the single-use, local gateway-to-daemon token handoff.
// It is not a general HTTP API or a credential store.
package transport

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/maintainer/native-agent-host/internal/gateway"
	"golang.org/x/sys/unix"
)

const maxFrame = 8192
const maxToken = 4096
const maxField = 128
const deadline = 5 * time.Second

var denied = errors.New("native token handoff failed")

type request struct {
	Version  int    `json:"version"`
	Nonce    string `json:"nonce"`
	Provider string `json:"provider"`
	Subject  string `json:"subject"`
	UID      int    `json:"uid"`
	Username string `json:"username"`
	Token    string `json:"token"`
}

// Config comes only from the daemon's trusted local configuration, never the socket.
type Config struct {
	GatewayUID int    `json:"gateway_uid"`
	UID        int    `json:"uid"`
	Username   string `json:"username"`
	Home       string `json:"home"`
	Socket     string `json:"socket"`
	Provider   string `json:"provider"`
	Subject    string `json:"subject"`
}

func socketOK(path string) bool {
	const prefix = "/run/native-agent-host/users/"
	suffix := strings.TrimPrefix(path, prefix)
	parts := strings.Split(suffix, "/")
	return strings.HasPrefix(path, prefix) && len(path) < 108 && len(parts) == 2 && parts[0] != "" && parts[0] != "." && parts[0] != ".." && parts[1] == "daemon.sock" && !strings.ContainsAny(parts[0], "\\\x00\r\n")
}
func validSubject(s string) bool {
	n, e := strconv.ParseUint(s, 10, 64)
	return e == nil && n > 0 && strconv.FormatUint(n, 10) == s && len(s) <= maxField
}
func validate(c Config, testPath bool) error {
	if c.GatewayUID <= 0 || c.UID <= 0 || c.UID != os.Geteuid() || c.Provider != "github" || !validSubject(c.Subject) || c.Username == "" || len(c.Username) > maxField || c.Home == "" || !filepath.IsAbs(c.Home) || filepath.Clean(c.Home) != c.Home || (socketOK(c.Socket) && c.Socket != "/run/native-agent-host/users/"+c.Username+"/daemon.sock") || (!socketOK(c.Socket) && !(testPath && filepath.IsAbs(c.Socket))) {
		return denied
	}
	u, e := user.LookupId(strconv.Itoa(c.UID))
	if e != nil || u.Username != c.Username || u.HomeDir != c.Home {
		return denied
	}
	return nil
}

// NewSink only accepts a production socket from the fixed gateway mapping.
func NewSink() gateway.TokenSink { return Sink{} }

type Sink struct {
	dial     func(context.Context, string) (net.Conn, error)
	testPath bool
}

func (s Sink) Deliver(ctx context.Context, m gateway.Identity, subject, token string) error {
	if (!socketOK(m.Socket) && !(s.testPath && filepath.IsAbs(m.Socket))) || m.Provider != "github" || !validSubject(subject) || m.Subject != subject || m.UID <= 0 || m.Username == "" || len(m.Username) > maxField || (socketOK(m.Socket) && m.Socket != "/run/native-agent-host/users/"+m.Username+"/daemon.sock") || len(token) == 0 || len(token) > maxToken {
		return denied
	}
	var nonce [16]byte
	if _, e := rand.Read(nonce[:]); e != nil {
		return denied
	}
	r := request{Version: 1, Nonce: hex.EncodeToString(nonce[:]), Provider: m.Provider, Subject: subject, UID: m.UID, Username: m.Username, Token: token}
	body, e := json.Marshal(r)
	if e != nil || len(body) > maxFrame {
		return denied
	}
	// Reject a changed or symlinked target before dialing; the peer UID is
	// checked again on the connected descriptor, not inferred from the path.
	if s.dial == nil {
		info, e := os.Lstat(m.Socket)
		if e != nil || info.Mode()&os.ModeSocket == 0 || info.Mode()&os.ModeSymlink != 0 {
			return denied
		}
	}
	dial := s.dial
	if dial == nil {
		dial = func(ctx context.Context, p string) (net.Conn, error) {
			return (&net.Dialer{Timeout: deadline}).DialContext(ctx, "unix", p)
		}
	}
	conn, e := dial(ctx, m.Socket)
	if e != nil {
		return denied
	}
	defer conn.Close()
	uc, ok := conn.(*net.UnixConn)
	if !ok || peerUID(uc) != m.UID {
		return denied
	}
	stop, e := setDeadline(ctx, conn)
	if e != nil {
		return denied
	}
	defer stop()
	if e = writeFrame(conn, body); e != nil {
		return denied
	}
	if uc.CloseWrite() != nil {
		return denied
	}
	var response [1]byte
	if _, e = io.ReadFull(conn, response[:]); e != nil || response[0] != 1 {
		return denied
	}
	var tail [1]byte
	if n, e := conn.Read(tail[:]); n != 0 || e != io.EOF {
		return denied
	}
	return nil
}
func peerUID(c *net.UnixConn) int {
	raw, e := c.SyscallConn()
	if e != nil {
		return -1
	}
	var peer *unix.Ucred
	var pe error
	if raw.Control(func(fd uintptr) { peer, pe = unix.GetsockoptUcred(int(fd), unix.SOL_SOCKET, unix.SO_PEERCRED) }) != nil || pe != nil || peer == nil {
		return -1
	}
	return int(peer.Uid)
}
func setDeadline(ctx context.Context, c net.Conn) (func() bool, error) {
	if e := ctx.Err(); e != nil {
		return nil, e
	}
	limit := time.Now().Add(deadline)
	if d, ok := ctx.Deadline(); ok && d.Before(limit) {
		limit = d
	}
	if e := c.SetDeadline(limit); e != nil {
		return nil, e
	}
	stop := context.AfterFunc(ctx, func() { _ = c.SetDeadline(time.Now()) })
	return stop, ctx.Err()
}
func writeFrame(w io.Writer, b []byte) error {
	var length [4]byte
	binary.BigEndian.PutUint32(length[:], uint32(len(b)))
	for _, part := range [][]byte{length[:], b} {
		for len(part) > 0 {
			n, e := w.Write(part)
			if e != nil {
				return e
			}
			if n <= 0 {
				return io.ErrShortWrite
			}
			part = part[n:]
		}
	}
	return nil
}
func readFrame(r io.Reader) (request, error) {
	var length [4]byte
	if _, e := io.ReadFull(r, length[:]); e != nil {
		return request{}, denied
	}
	n := binary.BigEndian.Uint32(length[:])
	if n == 0 || n > maxFrame {
		return request{}, denied
	}
	body := make([]byte, int(n))
	if _, e := io.ReadFull(r, body); e != nil {
		return request{}, denied
	}
	var tail [1]byte
	if count, e := r.Read(tail[:]); count != 0 || e != io.EOF {
		return request{}, denied
	}
	// Inspect keys before decoding: encoding/json otherwise accepts duplicate keys.
	keys := json.NewDecoder(bytes.NewReader(body))
	t, e := keys.Token()
	if e != nil || t != json.Delim('{') {
		return request{}, denied
	}
	allowed := map[string]bool{"version": true, "nonce": true, "provider": true, "subject": true, "uid": true, "username": true, "token": true}
	seen := map[string]bool{}
	for keys.More() {
		k, e := keys.Token()
		if e != nil {
			return request{}, denied
		}
		name, ok := k.(string)
		if !ok || !allowed[name] || seen[name] {
			return request{}, denied
		}
		seen[name] = true
		var field json.RawMessage
		if keys.Decode(&field) != nil {
			return request{}, denied
		}
	}
	if len(seen) != len(allowed) {
		return request{}, denied
	}
	if t, e = keys.Token(); e != nil || t != json.Delim('}') {
		return request{}, denied
	}
	if _, e = keys.Token(); e != io.EOF {
		return request{}, denied
	}
	var v request
	d := json.NewDecoder(bytes.NewReader(body))
	d.DisallowUnknownFields()
	if d.Decode(&v) != nil || d.Decode(new(any)) != io.EOF {
		return request{}, denied
	}
	if v.Version != 1 || len(v.Nonce) != 32 || len(v.Provider) > maxField || len(v.Username) > maxField || !validSubject(v.Subject) || len(v.Token) == 0 || len(v.Token) > maxToken {
		return request{}, denied
	}
	if b, e := hex.DecodeString(v.Nonce); e != nil || len(b) != 16 {
		return request{}, denied
	}
	return v, nil
}

// Consumer receives the token only after peer, local identity, frame and mapping checks.
// It must not retain or log the token. There is no native gh consumer in phase 2A.
type Consumer func(context.Context, string) error
type Server struct {
	cfg      Config
	consume  Consumer
	mu       sync.Mutex
	seen     map[string]struct{}
	testPath bool
	slots    chan struct{}
}

func NewServer(cfg Config, consume Consumer) (*Server, error) { return newServer(cfg, consume, false) }
func newServer(cfg Config, consume Consumer, testPath bool) (*Server, error) {
	if consume == nil || validate(cfg, testPath) != nil {
		return nil, denied
	}
	return &Server{cfg: cfg, consume: consume, seen: make(map[string]struct{}), testPath: testPath, slots: make(chan struct{}, 64)}, nil
}

// Serve accepts a pre-opened systemd socket. It never creates or unlinks a socket.
func (s *Server) Serve(ctx context.Context, ln *net.UnixListener) error {
	if ln == nil {
		return denied
	}
	addr, ok := ln.Addr().(*net.UnixAddr)
	if !ok || addr.Name != s.cfg.Socket {
		return denied
	}
	info, e := os.Lstat(s.cfg.Socket)
	if e != nil || info.Mode()&os.ModeSocket == 0 || info.Mode()&os.ModeSymlink != 0 {
		return denied
	}
	if !s.testPath {
		st, ok := info.Sys().(*syscall.Stat_t)
		if !ok || int(st.Uid) != s.cfg.UID || info.Mode().Perm()&^os.FileMode(0660) != 0 {
			return denied
		}
	}
	// Never trust a listener at a different target, even if supplied by the caller.
	for {
		_ = ln.SetDeadline(time.Now().Add(time.Second))
		conn, e := ln.AcceptUnix()
		if e != nil {
			if ctx.Err() != nil {
				return nil
			}
			if ne, ok := e.(net.Error); ok && ne.Timeout() {
				continue
			}
			return denied
		}
		select {
		case s.slots <- struct{}{}:
			go func() { defer func() { <-s.slots }(); s.handle(ctx, conn) }()
		default:
			_ = conn.Close()
		}
	}
}
func (s *Server) handle(ctx context.Context, c *net.UnixConn) {
	defer c.Close()
	raw, e := c.SyscallConn()
	if e != nil {
		return
	}
	var peer *unix.Ucred
	var pe error
	if raw.Control(func(fd uintptr) { peer, pe = unix.GetsockoptUcred(int(fd), unix.SOL_SOCKET, unix.SO_PEERCRED) }) != nil || pe != nil || peer == nil || int(peer.Uid) != s.cfg.GatewayUID {
		return
	}
	if validate(s.cfg, s.testPath) != nil {
		return
	}
	stop, e := setDeadline(ctx, c)
	if e != nil {
		return
	}
	defer stop()
	v, e := readFrame(c)
	if e != nil {
		return
	}
	if v.Provider != s.cfg.Provider || v.Subject != s.cfg.Subject || v.UID != s.cfg.UID || v.Username != s.cfg.Username {
		return
	}
	s.mu.Lock()
	if _, found := s.seen[v.Nonce]; found || len(s.seen) >= 4096 {
		s.mu.Unlock()
		return
	}
	s.seen[v.Nonce] = struct{}{}
	s.mu.Unlock()
	if s.consume(ctx, v.Token) != nil {
		return
	}
	_, _ = io.Copy(c, bytes.NewReader([]byte{1}))
}
