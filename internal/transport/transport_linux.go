//go:build linux

// Package transport implements the bounded HTTP/1.1 native credential handoff
// on the daemon's systemd-created per-user Unix socket.
package transport

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/maintainer/native-agent-host/internal/gateway"
	"github.com/maintainer/native-agent-host/internal/udssecure"
	"golang.org/x/sys/unix"
)

const Path = "/internal/v1/native-credentials/github"
const maxBody = 8192
const maxToken = 4096
const maxField = 128
const deadline = 5 * time.Second
const maxHeaders = 2048

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

// Config comes only from trusted local configuration, never the socket.
type Config struct {
	GatewayUID int    `json:"gateway_uid"`
	UID        int    `json:"uid"`
	Username   string `json:"username"`
	Home       string `json:"home"`
	Socket     string `json:"socket"`
	Provider   string `json:"provider"`
	Subject    string `json:"subject"`
	// BindingFile is the root-owned per-UID numeric binding produced by the broker.
	// Legacy static handoffs without this field keep their existing contract.
	BindingFile string `json:"binding_file,omitempty"`
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
	if c.BindingFile != "" && c.BindingFile != "/etc/native-agent-host/daemon-"+c.Username+".json" {
		return denied
	}
	if c.GatewayUID <= 0 || c.UID <= 0 || c.UID != os.Geteuid() || c.Provider != "github" || !validSubject(c.Subject) || c.Username == "" || len(c.Username) > maxField || c.Home == "" || !filepath.IsAbs(c.Home) || filepath.Clean(c.Home) != c.Home || (socketOK(c.Socket) && c.Socket != "/run/native-agent-host/users/"+c.Username+"/daemon.sock") || (!socketOK(c.Socket) && !(testPath && filepath.IsAbs(c.Socket))) {
		return denied
	}
	u, e := user.LookupId(strconv.Itoa(c.UID))
	if e != nil || u.Username != c.Username || u.HomeDir != c.Home {
		return denied
	}
	return verifyBinding(c)
}

// verifyBinding independently rereads the broker-created root binding before
// accepting each handoff, not a subject or UID asserted by the gateway.
// It is deliberately unavailable for unprivileged replacement or symlinks.
func verifyBinding(c Config) error {
	if c.BindingFile == "" {
		return nil
	}
	etc, err := unix.Open("/etc", unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return denied
	}
	defer unix.Close(etc)
	var st unix.Stat_t
	if unix.Fstat(etc, &st) != nil || st.Uid != 0 || st.Mode&unix.S_IFMT != unix.S_IFDIR || st.Mode&0022 != 0 {
		return denied
	}
	dir, err := unix.Openat(etc, "native-agent-host", unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return denied
	}
	defer unix.Close(dir)
	if unix.Fstat(dir, &st) != nil || st.Uid != 0 || st.Mode&unix.S_IFMT != unix.S_IFDIR || st.Mode&0022 != 0 {
		return denied
	}
	fd, err := unix.Openat(dir, "daemon-"+c.Username+".json", unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if err != nil {
		return denied
	}
	f := os.NewFile(uintptr(fd), "binding")
	defer f.Close()
	if unix.Fstat(fd, &st) != nil || st.Uid != 0 || int(st.Gid) != c.UID || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Mode&0777 != 0640 || st.Nlink != 1 || st.Size < 1 || st.Size > 4096 {
		return denied
	}
	b := make([]byte, st.Size)
	if n, err := io.ReadFull(f, b); err != nil || n != len(b) {
		return denied
	}
	var v struct {
		Component string `json:"component"`
		Handoff   Config `json:"handoff"`
	}
	d := json.NewDecoder(bytes.NewReader(b))
	d.DisallowUnknownFields()
	if d.Decode(&v) != nil || d.Decode(new(any)) != io.EOF || v.Component != "daemon" || v.Handoff != c {
		return denied
	}
	return nil
}

// ValidateConfig checks the trusted local daemon identity against the effective
// UID and OS account. It must never be called on request-derived configuration.
func ValidateConfig(c Config) error { return validate(c, false) }

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
	body, e := json.Marshal(request{1, hex.EncodeToString(nonce[:]), m.Provider, subject, m.UID, m.Username, token})
	if e != nil || len(body) > maxBody {
		return denied
	}
	// The disposable test-path seam must not silently follow a symlink either.
	if s.testPath && s.dial == nil {
		info, err := os.Lstat(m.Socket)
		if err != nil || info.Mode()&os.ModeSymlink != 0 || info.Mode()&os.ModeSocket == 0 {
			return denied
		}
	}
	if s.dial == nil && !s.testPath && udssecure.Mapped(m.Socket, m.UID) != nil {
		return denied
	}
	dial := s.dial
	if dial == nil {
		dial = func(ctx context.Context, p string) (net.Conn, error) {
			return (&net.Dialer{Timeout: deadline}).DialContext(ctx, "unix", p)
		}
	}
	if ctx.Err() != nil {
		return denied
	}
	conn, e := dial(ctx, m.Socket)
	if e != nil {
		return denied
	}
	defer conn.Close()
	uc, ok := conn.(*net.UnixConn)
	// PID 1 created this systemd listener as root. The daemon UID is
	// attested by the root-controlled pathname and socket owner, not by the
	// listener's SO_PEERCRED (which remains 0 after fd handoff).
	if !ok || (s.dial == nil && !s.testPath && (peerUID(uc) != 0 || udssecure.Mapped(m.Socket, m.UID) != nil)) || ((s.dial != nil || s.testPath) && peerUID(uc) != m.UID) {
		return denied
	}
	stop, e := setDeadline(ctx, conn)
	if e != nil {
		return denied
	}
	defer stop()
	req, e := http.NewRequestWithContext(ctx, http.MethodPost, "http://unix"+Path, bytes.NewReader(body))
	if e != nil {
		return denied
	}
	req.Header.Set("Content-Type", "application/json")
	req.Close = true
	if req.Write(conn) != nil {
		return denied
	}
	bounded := &io.LimitedReader{R: conn, N: maxHeaders + 1024}
	reader := bufio.NewReader(bounded)
	res, e := http.ReadResponse(reader, req)
	if e != nil {
		return denied
	}
	defer res.Body.Close()
	// A 204 is the only success. HTTP forbids a body on 204; reject framing
	// that attempts to disguise one rather than consuming untrusted text.
	if res.ProtoMajor != 1 || res.ProtoMinor != 1 || res.StatusCode != http.StatusNoContent || res.ContentLength != 0 || len(res.TransferEncoding) != 0 || len(res.Header.Values("Content-Length")) != 0 {
		return denied
	}
	var tail [1]byte
	if n, err := reader.Read(tail[:]); n != 0 || err != io.EOF || bounded.N == 0 {
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
func decode(body []byte) (request, error) {
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
	if v.Version != 1 || len(v.Nonce) != 32 || v.Provider != "github" || len(v.Username) > maxField || !validSubject(v.Subject) || len(v.Token) == 0 || len(v.Token) > maxToken {
		return request{}, denied
	}
	if b, e := hex.DecodeString(v.Nonce); e != nil || len(b) != 16 {
		return request{}, denied
	}
	return v, nil
}

// Consumer receives the token only after peer, identity, framing and mapping checks.
type Consumer func(context.Context, string) error
type Server struct {
	cfg      Config
	consume  Consumer
	mu       sync.Mutex
	seen     map[string]struct{}
	testPath bool
}

func NewServer(cfg Config, consume Consumer) (*Server, error) { return newServer(cfg, consume, false) }
func newServer(cfg Config, consume Consumer, testPath bool) (*Server, error) {
	if consume == nil || validate(cfg, testPath) != nil {
		return nil, denied
	}
	return &Server{cfg: cfg, consume: consume, seen: make(map[string]struct{}), testPath: testPath}, nil
}

type peerKey struct{}

// TrustedPeer is set only by the guarded Unix listener after SO_PEERCRED.
func (s *Server) TrustedPeer(r *http.Request) bool {
	return r.Context().Value(peerKey{}) == s.cfg.GatewayUID && validate(s.cfg, s.testPath) == nil
}

// Handler can be mounted on the same daemon ServeMux as future workspace routes.
// Its peer context is installed by Serve, not derived from HTTP headers.
func (s *Server) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json")
		reject := func() {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = io.WriteString(w, `{"schema_version":1,"error":"handoff_denied"}`)
		}
		if r.Context().Value(peerKey{}) != s.cfg.GatewayUID || validate(s.cfg, s.testPath) != nil {
			reject()
			return
		}
		if r.ProtoMajor != 1 || r.ProtoMinor != 1 || r.Method != http.MethodPost || r.RequestURI != Path || r.URL.Path != Path || r.URL.RawQuery != "" || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 || len(r.TransferEncoding) != 0 || r.ContentLength <= 0 || r.ContentLength > maxBody || len(r.Header.Values("Content-Length")) != 1 {
			reject()
			return
		}
		body, e := io.ReadAll(io.LimitReader(r.Body, maxBody+1))
		if e != nil || int64(len(body)) != r.ContentLength || len(body) > maxBody {
			reject()
			return
		}
		v, e := decode(body)
		if e != nil || v.Provider != s.cfg.Provider || v.Subject != s.cfg.Subject || v.UID != s.cfg.UID || v.Username != s.cfg.Username {
			reject()
			return
		}
		s.mu.Lock()
		_, found := s.seen[v.Nonce]
		if found || len(s.seen) >= 4096 {
			s.mu.Unlock()
			reject()
			return
		}
		s.seen[v.Nonce] = struct{}{}
		s.mu.Unlock()
		if s.consume(r.Context(), v.Token) != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
}

// Serve accepts only a pre-opened listener; no bind or unlink occurs here.
func (s *Server) Serve(ctx context.Context, ln *net.UnixListener) error {
	return s.ServeMux(ctx, ln, nil)
}

// ServeMux mounts the handoff on a caller-supplied mux, allowing later routes.
func (s *Server) ServeMux(ctx context.Context, ln *net.UnixListener, mux *http.ServeMux) error {
	if ln == nil {
		return denied
	}
	addr, ok := ln.Addr().(*net.UnixAddr)
	if !ok || addr.Name != s.cfg.Socket {
		return denied
	}
	if checkListener(s.cfg, ln, s.testPath, false) != nil {
		if queued, ok := startupConnections.LoadAndDelete(ln); ok {
			for _, c := range queued.([]*net.UnixConn) {
				_ = c.Close()
			}
		}
		return denied
	}
	if mux == nil {
		mux = http.NewServeMux()
	}
	mux.Handle(Path, s.Handler())
	srv := &http.Server{Handler: mux, MaxHeaderBytes: maxHeaders, ReadHeaderTimeout: deadline, ReadTimeout: deadline, WriteTimeout: deadline, IdleTimeout: deadline, ConnContext: func(c context.Context, n net.Conn) context.Context {
		if u, ok := n.(*slotConn); ok {
			return context.WithValue(c, peerKey{}, peerUID(u.UnixConn))
		}
		return c
	}}
	srv.SetKeepAlivesEnabled(false)
	shutdownDone := make(chan struct{})
	stop := context.AfterFunc(ctx, func() {
		defer close(shutdownDone)
		grace, cancel := context.WithTimeout(context.Background(), deadline)
		defer cancel()
		_ = srv.Shutdown(grace)
	})
	defer func() {
		if !stop() {
			<-shutdownDone
		}
	}()
	pending, _ := startupConnections.LoadAndDelete(ln)
	guard := &guardListener{UnixListener: ln, cfg: s.cfg, ctx: ctx, slots: make(chan struct{}, 64)}
	if pending != nil {
		guard.pending = pending.([]*net.UnixConn)
		defer func() {
			for _, c := range guard.pending {
				_ = c.Close()
			}
		}()
	}
	err := srv.Serve(guard)
	if ctx.Err() != nil {
		return nil
	}
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return denied
}

// A real socket activation starts with a gateway connection already queued.
// Preserve those verified peers until ServeMux takes over the listener; the
// startup challenge must never consume the triggering request.
var startupConnections sync.Map // *net.UnixListener -> []*net.UnixConn

// ValidateListener probes that the configured pathname reaches the supplied
// listener and verifies its ownership and mode before serving.
func ValidateListener(cfg Config, ln *net.UnixListener) error {
	return validateListener(cfg, ln, false)
}
func validateListener(cfg Config, ln *net.UnixListener, testPath bool) error {
	return checkListener(cfg, ln, testPath, !testPath)
}
func checkListener(cfg Config, ln *net.UnixListener, testPath, probePath bool) error {
	if ln == nil || validate(cfg, testPath) != nil {
		return denied
	}
	addr, ok := ln.Addr().(*net.UnixAddr)
	if !ok || addr.Name != cfg.Socket {
		return denied
	}
	path, e := os.Lstat(cfg.Socket)
	if e != nil || path.Mode()&os.ModeSocket == 0 || path.Mode()&os.ModeSymlink != 0 {
		return denied
	}
	if probePath {
		var queued []*net.UnixConn
		verified := false
		defer func() {
			if !verified {
				for _, c := range queued {
					_ = c.Close()
				}
			}
		}()
		// Socket fd inode differs from pathname inode on Linux. Prove this
		// pathname reaches the supplied listener by a bounded connect/accept.
		_ = ln.SetDeadline(time.Now().Add(time.Second))
		defer ln.SetDeadline(time.Time{})
		probe, e := net.DialTimeout("unix", cfg.Socket, time.Second)
		if e != nil {
			return denied
		}
		defer probe.Close()
		var challenge [16]byte
		if _, e = rand.Read(challenge[:]); e != nil {
			return denied
		}
		_ = probe.SetDeadline(time.Now().Add(time.Second))
		if _, e = probe.Write(challenge[:]); e != nil {
			return denied
		}
		for {
			accepted, e := ln.AcceptUnix()
			if e != nil {
				return denied
			}
			peer := peerUID(accepted)
			if peer == cfg.GatewayUID && peer != cfg.UID {
				if len(queued) == 64 {
					_ = accepted.Close()
					return denied
				}
				queued = append(queued, accepted)
				continue
			}
			if peer != cfg.UID {
				_ = accepted.Close()
				return denied
			}
			_ = accepted.SetReadDeadline(time.Now().Add(time.Second))
			var response [16]byte
			_, e = io.ReadFull(accepted, response[:])
			_ = accepted.Close()
			if e != nil || response != challenge {
				return denied
			}
			break
		}
		if !testPath {
			stat, ok := path.Sys().(*syscall.Stat_t)
			if !ok || int(stat.Uid) != cfg.UID || path.Mode().Perm() != 0660 {
				return denied
			}
		}
		if len(queued) > 0 {
			startupConnections.Store(ln, queued)
		}
		verified = true
		return nil
	}
	if !testPath {
		stat, ok := path.Sys().(*syscall.Stat_t)
		if !ok || int(stat.Uid) != cfg.UID || path.Mode().Perm() != 0660 {
			return denied
		}
	}
	return nil
}

type guardListener struct {
	*net.UnixListener
	cfg     Config
	ctx     context.Context
	slots   chan struct{}
	pending []*net.UnixConn
}

func (l *guardListener) Accept() (net.Conn, error) {
	for {
		if l.ctx.Err() != nil {
			return nil, net.ErrClosed
		}
		var c *net.UnixConn
		var e error
		if len(l.pending) > 0 {
			c = l.pending[0]
			l.pending = l.pending[1:]
		} else {
			_ = l.UnixListener.SetDeadline(time.Now().Add(time.Second))
			c, e = l.UnixListener.AcceptUnix()
		}
		if e != nil {
			if ne, ok := e.(net.Error); ok && ne.Timeout() {
				continue
			}
			return nil, e
		}
		if peerUID(c) != l.cfg.GatewayUID {
			_ = c.Close()
			continue
		}
		select {
		case l.slots <- struct{}{}:
			return &slotConn{UnixConn: c, release: func() { <-l.slots }}, nil
		default:
			_ = c.Close()
		}
	}
}

type slotConn struct {
	*net.UnixConn
	once    sync.Once
	release func()
	reader  io.Reader
}

// net/http coalesces duplicate equal Content-Length fields before a handler
// can inspect them. Inspect the bounded wire header first, on the HTTP reader
// goroutine, and replay its exact bytes to net/http's parser.
func (c *slotConn) Read(p []byte) (int, error) {
	if c.reader == nil {
		br := bufio.NewReaderSize(c.UnixConn, maxHeaders)
		header := make([]byte, 0, 512)
		for !bytes.HasSuffix(header, []byte("\r\n\r\n")) {
			if len(header) >= maxHeaders {
				return 0, denied
			}
			b, e := br.ReadByte()
			if e != nil {
				return 0, e
			}
			header = append(header, b)
		}
		lines := bytes.Split(header, []byte("\r\n"))
		cl := 0
		te := 0
		for _, line := range lines[1 : len(lines)-2] {
			if len(line) == 0 || line[0] == ' ' || line[0] == '\t' {
				return 0, denied
			}
			name, _, ok := bytes.Cut(line, []byte(":"))
			if !ok {
				return 0, denied
			}
			if bytes.EqualFold(name, []byte("Content-Length")) {
				cl++
			}
			if bytes.EqualFold(name, []byte("Transfer-Encoding")) {
				te++
			}
		}
		if cl > 1 || te > 1 || cl > 0 && te > 0 {
			return 0, denied
		}
		c.reader = io.MultiReader(bytes.NewReader(header), br)
	}
	return c.reader.Read(p)
}
func (c *slotConn) Close() error { e := c.UnixConn.Close(); c.once.Do(c.release); return e }
