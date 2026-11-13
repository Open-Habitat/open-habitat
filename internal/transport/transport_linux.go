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
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/user"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/open-habitat/open-habitat/internal/diagnostic"
	"github.com/open-habitat/open-habitat/internal/gateway"
	"github.com/open-habitat/open-habitat/internal/udssecure"
	"golang.org/x/sys/unix"
)

const Path = "/internal/v1/native-credentials/github"
const maxBody = 8192
const maxToken = 4096
const maxField = 128
const deadline = 5 * time.Second
const maxHeaders = 2048

// One answer per default: 20 names of at most 140 bytes and their outcome,
// and the seed's one word.
const maxPlanReply = 4096

// seedDeadline bounds a handoff that seeds: the daemon runs native Pi to
// write the key after installing the token and answering the plan.
const seedDeadline = 20 * time.Second

var denied = errors.New("native token handoff failed")

// ErrServeEnded is what ServeMux and ServeAgent return when their listener
// passed its checks and the accept loop then ended without a cancellation.
// Every refusal before serving stays the opaque denied error, so a caller
// can tell "this listener was refused" from "serving stopped" without either
// carrying native error text.
var ErrServeEnded = errors.New("daemon listener stopped serving")

type request struct {
	Version  int    `json:"version"`
	Nonce    string `json:"nonce"`
	Provider string `json:"provider"`
	Subject  string `json:"subject"`
	UID      int    `json:"uid"`
	Username string `json:"username"`
	Token    string `json:"token"`
	// Plan is present only in the login in which the broker created the
	// binding, and only in auto or skip mode (ADR 0030).
	Plan *Plan `json:"plan,omitempty"`
	// Seed is the site AI key, present only in that same login and only
	// while the site offers one.
	Seed *Seed `json:"seed,omitempty"`
	// Replace is present, and true, only in a reconnect the person started
	// from settings while signed in as this same account.
	Replace bool `json:"replace,omitempty"`
}

// Seed is the site AI key for this person's Pi. The daemon writes it only
// where their Pi has no credential for the provider.
type Seed struct {
	Provider string `json:"provider"`
	Key      string `json:"key"`
}

var seedKey = regexp.MustCompile(`^sk-[A-Za-z0-9_-]{20,200}$`)

func validSeed(s Seed) bool {
	return (s.Provider == "openai" || s.Provider == "anthropic" || s.Provider == "deepseek") && seedKey.MatchString(s.Key)
}

// SeedOutcomes are the daemon's answers to a seed.
var seedOutcomes = []string{"seeded", "already_present", "failed"}

// Plan is the site's repository plan for this person: names the gateway
// checked this person can read. It can only select among the person's own
// clones, with the person's own gh, into their own ~/src.
type Plan struct {
	Mode     string   `json:"mode"`
	Defaults []string `json:"defaults"`
}

// MaxPlanDefaults matches the site configuration's bound.
const MaxPlanDefaults = 20

// PlanOutcome is one default's answer; Outcome is queued or already_present.
type PlanOutcome struct {
	FullName string `json:"full_name"`
	Outcome  string `json:"outcome"`
}

var planOwner = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9-]{0,38}$`)
var planName = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,100}$`)

// ValidPlanName is GitHub's owner/repo grammar.
func ValidPlanName(s string) bool {
	owner, name, ok := strings.Cut(s, "/")
	return ok && planOwner.MatchString(owner) && planName.MatchString(name) && name != "." && name != ".."
}

func validPlan(p Plan) bool {
	if p.Mode != "auto" && p.Mode != "skip" || len(p.Defaults) < 1 || len(p.Defaults) > MaxPlanDefaults {
		return false
	}
	seen := map[string]bool{}
	for _, n := range p.Defaults {
		if !ValidPlanName(n) || seen[strings.ToLower(n)] {
			return false
		}
		seen[strings.ToLower(n)] = true
	}
	return true
}

// validOutcomes requires exactly one answer per default, in the plan's order.
func validOutcomes(p Plan, out []PlanOutcome) bool {
	if len(out) != len(p.Defaults) {
		return false
	}
	for i, o := range out {
		if o.FullName != p.Defaults[i] || o.Outcome != "queued" && o.Outcome != "already_present" {
			return false
		}
	}
	return true
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
	const prefix = "/run/open-habitat/users/"
	suffix := strings.TrimPrefix(path, prefix)
	parts := strings.Split(suffix, "/")
	return strings.HasPrefix(path, prefix) && len(path) < 108 && len(parts) == 2 && parts[0] != "" && parts[0] != "." && parts[0] != ".." && parts[1] == "daemon.sock" && !strings.ContainsAny(parts[0], "\\\x00\r\n")
}
func validSubject(s string) bool {
	n, e := strconv.ParseUint(s, 10, 64)
	return e == nil && n > 0 && strconv.FormatUint(n, 10) == s && len(s) <= maxField
}
func validate(c Config, testPath bool) error {
	if c.BindingFile != "" && c.BindingFile != "/etc/open-habitat-daemon/daemon/user-mappings/daemon-"+c.Username+".json" {
		return denied
	}
	if c.GatewayUID <= 0 || c.UID <= 0 || c.UID != os.Geteuid() || c.Provider != "github" || !validSubject(c.Subject) || c.Username == "" || len(c.Username) > maxField || c.Home == "" || !filepath.IsAbs(c.Home) || filepath.Clean(c.Home) != c.Home || (socketOK(c.Socket) && c.Socket != "/run/open-habitat/users/"+c.Username+"/daemon.sock") || (!socketOK(c.Socket) && !(testPath && filepath.IsAbs(c.Socket))) {
		return denied
	}
	u, e := user.LookupId(strconv.Itoa(c.UID))
	if e != nil || u.Username != c.Username || u.HomeDir != c.Home {
		return denied
	}
	return verifyBinding(c)
}

// verifyBinding checks the broker-created root binding at daemon startup,
// not a subject or UID asserted by the gateway.
// It is deliberately unavailable for unprivileged replacement or symlinks.
func verifyBinding(c Config) error {
	if c.BindingFile == "" {
		return nil
	}
	return verifyBindingUnder("/etc", c, 0, 0, c.UID)
}

// verifyBindingUnder walks only root-controlled directories via descriptors.
// The root and expected owners are parameters solely for disposable synthetic tests.
func verifyBindingUnder(etcPath string, c Config, rootUID, rootGID, privateGID int) error {
	etc, err := unix.Open(etcPath, unix.O_PATH|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return denied
	}
	defer unix.Close(etc)
	var st unix.Stat_t
	if unix.Fstat(etc, &st) != nil || st.Uid != uint32(rootUID) || st.Mode&unix.S_IFMT != unix.S_IFDIR || st.Mode&0022 != 0 {
		return denied
	}
	parent := etc
	defer func() {
		if parent != etc {
			unix.Close(parent)
		}
	}()
	for _, part := range []string{"open-habitat-daemon", "daemon", "user-mappings"} {
		dir, err := unix.Openat(parent, part, unix.O_PATH|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
		if err != nil {
			return denied
		}
		if parent != etc {
			unix.Close(parent)
		}
		parent = dir
		if unix.Fstat(dir, &st) != nil || st.Uid != uint32(rootUID) || st.Gid != uint32(rootGID) || st.Mode&unix.S_IFMT != unix.S_IFDIR || st.Mode&07777 != 0711 {
			return denied
		}
	}
	fd, err := unix.Openat(parent, "daemon-"+c.Username+".json", unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if err != nil {
		return denied
	}
	f := os.NewFile(uintptr(fd), "binding")
	defer f.Close()
	if unix.Fstat(fd, &st) != nil || st.Uid != uint32(rootUID) || st.Gid != uint32(privateGID) || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Mode&07777 != 0640 || st.Nlink != 1 || st.Size < 1 || st.Size > 4096 {
		return denied
	}
	// An extended ACL can give another UID read access while retaining 0640.
	// No ACL is part of the binding contract; refuse an unreadable ACL state too.
	if _, err := unix.Fgetxattr(fd, "system.posix_acl_access", nil); err != unix.ENODATA {
		return denied
	}
	b := make([]byte, st.Size)
	if n, err := io.ReadFull(f, b); err != nil || n != len(b) {
		return denied
	}
	return bindingMatches(b, c)
}

func bindingMatches(b []byte, c Config) error {
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

// NewFixtureSink is the offline distinct-UID fixture seam: it hands off to a
// daemon that bound its own socket, so the kernel peer it requires is that
// daemon's UID rather than PID 1's. Production uses NewSink.
func NewFixtureSink() gateway.TokenSink { return Sink{testPath: true} }

type Sink struct {
	dial     func(context.Context, string) (net.Conn, error)
	testPath bool
}

func (s Sink) Deliver(ctx context.Context, m gateway.Identity, subject, token string) (gateway.Handoff, error) {
	out, err := s.deliver(ctx, m, subject, token, nil, nil, false)
	return gateway.Handoff(out.GitHubToken), err
}

// DeliverReplacing hands over the token of the person's explicit reconnect,
// which may take the place of gh's working login of the same account.
func (s Sink) DeliverReplacing(ctx context.Context, m gateway.Identity, subject, token string) (gateway.Handoff, error) {
	out, err := s.deliver(ctx, m, subject, token, nil, nil, true)
	return gateway.Handoff(out.GitHubToken), err
}

// DeliverFirst hands the token, the repository plan and the site AI key over
// in one request. The daemon installs the token first and answers the plan
// and the seed only after that.
func (s Sink) DeliverFirst(ctx context.Context, m gateway.Identity, subject, token string, first gateway.FirstLogin) (gateway.FirstLoginReply, error) {
	var p *Plan
	var seed *Seed
	if first.Plan != nil {
		p = &Plan{Mode: first.Plan.Mode, Defaults: append([]string{}, first.Plan.Defaults...)}
		if !validPlan(*p) {
			return gateway.FirstLoginReply{}, denied
		}
	}
	if first.Seed != nil {
		seed = &Seed{Provider: first.Seed.Provider, Key: first.Seed.Key}
		if !validSeed(*seed) {
			return gateway.FirstLoginReply{}, denied
		}
	}
	if p == nil && seed == nil {
		return gateway.FirstLoginReply{}, denied
	}
	out, err := s.deliver(ctx, m, subject, token, p, seed, false)
	if err != nil {
		return gateway.FirstLoginReply{}, err
	}
	result := gateway.FirstLoginReply{Token: gateway.Handoff(out.GitHubToken), AIKey: out.AIKey}
	for _, o := range out.Defaults {
		result.Defaults = append(result.Defaults, gateway.PlanOutcome{FullName: o.FullName, Outcome: o.Outcome})
	}
	return result, nil
}

// reply is the daemon's answer to every handoff: what became of the token,
// defaults exactly when there was a plan, ai_key exactly when a seed.
type reply struct {
	SchemaVersion int           `json:"schema_version"`
	GitHubToken   string        `json:"github_token"`
	Defaults      []PlanOutcome `json:"defaults,omitempty"`
	AIKey         string        `json:"ai_key,omitempty"`
}

func validReply(plan *Plan, seed *Seed, v reply) bool {
	if v.SchemaVersion != 1 || v.GitHubToken != string(gateway.HandoffInUse) && v.GitHubToken != string(gateway.HandoffUnused) || (plan == nil) != (v.Defaults == nil) || (seed == nil) != (v.AIKey == "") {
		return false
	}
	if plan != nil && !validOutcomes(*plan, v.Defaults) {
		return false
	}
	return seed == nil || slices.Contains(seedOutcomes, v.AIKey)
}

func (s Sink) deliver(ctx context.Context, m gateway.Identity, subject, token string, plan *Plan, seed *Seed, replace bool) (reply, error) {
	if (!socketOK(m.Socket) && !(s.testPath && filepath.IsAbs(m.Socket))) || m.Provider != "github" || !validSubject(subject) || m.Subject != subject || m.UID <= 0 || m.Username == "" || len(m.Username) > maxField || (socketOK(m.Socket) && m.Socket != "/run/open-habitat/users/"+m.Username+"/daemon.sock") || len(token) == 0 || len(token) > maxToken {
		return reply{}, denied
	}
	var nonce [16]byte
	if _, e := rand.Read(nonce[:]); e != nil {
		return reply{}, denied
	}
	body, e := json.Marshal(request{1, hex.EncodeToString(nonce[:]), m.Provider, subject, m.UID, m.Username, token, plan, seed, replace})
	if e != nil || len(body) > maxBody {
		return reply{}, denied
	}
	// The disposable test-path seam must not silently follow a symlink either.
	if s.testPath && s.dial == nil {
		info, err := os.Lstat(m.Socket)
		if err != nil || info.Mode()&os.ModeSymlink != 0 || info.Mode()&os.ModeSocket == 0 {
			return reply{}, denied
		}
	}
	if s.dial == nil && !s.testPath && udssecure.Mapped(m.Socket, m.UID) != nil {
		return reply{}, denied
	}
	dial := s.dial
	if dial == nil {
		dial = func(ctx context.Context, p string) (net.Conn, error) {
			return (&net.Dialer{Timeout: deadline}).DialContext(ctx, "unix", p)
		}
	}
	if ctx.Err() != nil {
		return reply{}, denied
	}
	conn, e := dial(ctx, m.Socket)
	if e != nil {
		return reply{}, denied
	}
	defer conn.Close()
	uc, ok := conn.(*net.UnixConn)
	// PID 1 created this systemd listener as root. The daemon UID is
	// attested by the root-controlled pathname and socket owner, not by the
	// listener's SO_PEERCRED (which remains 0 after fd handoff).
	if !ok || (s.dial == nil && !s.testPath && (peerUID(uc) != 0 || udssecure.Mapped(m.Socket, m.UID) != nil)) || ((s.dial != nil || s.testPath) && peerUID(uc) != m.UID) {
		return reply{}, denied
	}
	limitBy := deadline
	if seed != nil {
		limitBy = seedDeadline
	}
	stop, e := setDeadline(ctx, conn, limitBy)
	if e != nil {
		return reply{}, denied
	}
	defer stop()
	req, e := http.NewRequestWithContext(ctx, http.MethodPost, "http://unix"+Path, bytes.NewReader(body))
	if e != nil {
		return reply{}, denied
	}
	req.Header.Set("Content-Type", "application/json")
	req.Close = true
	if req.Write(conn) != nil {
		return reply{}, denied
	}
	bounded := &io.LimitedReader{R: conn, N: maxHeaders + 1024 + maxPlanReply}
	reader := bufio.NewReader(bounded)
	res, e := http.ReadResponse(reader, req)
	if e != nil {
		return reply{}, denied
	}
	defer res.Body.Close()
	// The only success is a 200 whose exact-length body says what became of
	// the token and answers every default, in order, and the seed, each with
	// a fixed outcome.
	if res.ProtoMajor != 1 || res.ProtoMinor != 1 || res.StatusCode != http.StatusOK || res.Header.Get("Content-Type") != "application/json" || len(res.Header.Values("Content-Type")) != 1 || res.ContentLength < 1 || res.ContentLength > maxPlanReply || len(res.TransferEncoding) != 0 || len(res.Header.Values("Content-Length")) != 1 {
		return reply{}, denied
	}
	body, e = io.ReadAll(io.LimitReader(res.Body, maxPlanReply+1))
	if e != nil || int64(len(body)) != res.ContentLength {
		return reply{}, denied
	}
	var tail [1]byte
	if n, err := reader.Read(tail[:]); n != 0 || err != io.EOF || bounded.N == 0 {
		return reply{}, denied
	}
	var v reply
	d := json.NewDecoder(bytes.NewReader(body))
	d.DisallowUnknownFields()
	if d.Decode(&v) != nil || d.Decode(new(any)) != io.EOF || !validReply(plan, seed, v) {
		return reply{}, denied
	}
	return v, nil
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
func setDeadline(ctx context.Context, c net.Conn, within time.Duration) (func() bool, error) {
	if e := ctx.Err(); e != nil {
		return nil, e
	}
	limit := time.Now().Add(within)
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
	allowed := map[string]bool{"version": true, "nonce": true, "provider": true, "subject": true, "uid": true, "username": true, "token": true, "plan": true, "seed": true, "replace": true}
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
	// Every field is required except the plan, the seed and replace, each
	// absent or one of its kind.
	for name := range allowed {
		if !seen[name] && name != "plan" && name != "seed" && name != "replace" {
			return request{}, denied
		}
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
	if seen["plan"] && (v.Plan == nil || !validPlan(*v.Plan)) {
		return request{}, denied
	}
	if seen["seed"] && (v.Seed == nil || !validSeed(*v.Seed)) {
		return request{}, denied
	}
	// A reconnect is never the binding-creating login, and false is spelled
	// by leaving the field out.
	if seen["replace"] && (!v.Replace || seen["plan"] || seen["seed"]) {
		return request{}, denied
	}
	return v, nil
}

// Consumer receives the token only after peer, identity, framing and mapping
// checks. replace is the person's explicit reconnect: the token may take the
// place of gh's working login of the same account. unused says the person's
// gh kept its own login and positively holds another token, so the gateway
// may revoke this one; when in doubt it is false.
type Consumer func(ctx context.Context, token string, replace bool) (unused bool, err error)

// PlanConsumer acts on a validated plan after the token is installed. It
// answers every default, in order; it never sees the token.
type PlanConsumer func(context.Context, Plan) []PlanOutcome

// SeedConsumer writes the site AI key into the person's Pi only where it has
// no credential for that provider, after the token and the plan. It answers
// one of seeded, already_present or failed, and never sees the token.
type SeedConsumer func(context.Context, Seed) string
type Server struct {
	cfg      Config
	consume  Consumer
	plan     PlanConsumer
	seed     SeedConsumer
	mu       sync.Mutex
	seen     map[string]struct{}
	testPath bool
	log      *slog.Logger
}

func NewServer(cfg Config, consume Consumer) (*Server, error) { return newServer(cfg, consume, false) }
func newServer(cfg Config, consume Consumer, testPath bool) (*Server, error) {
	if consume == nil || validate(cfg, testPath) != nil {
		return nil, denied
	}
	return &Server{cfg: cfg, consume: consume, seen: make(map[string]struct{}), testPath: testPath, log: diagnostic.New(os.Stderr, "daemon")}, nil
}

type peerKey struct{}

// SetPlanConsumer enables plans. Without one a handoff that carries a plan
// is refused before its token is consumed.
func (s *Server) SetPlanConsumer(p PlanConsumer) { s.plan = p }

// SetSeedConsumer enables seeds, as SetPlanConsumer does plans.
func (s *Server) SetSeedConsumer(c SeedConsumer) { s.seed = c }

// TrustedPeer is set only by the guarded Unix listener after SO_PEERCRED.
func (s *Server) TrustedPeer(r *http.Request) bool {
	return r.Context().Value(peerKey{}) == s.cfg.GatewayUID
}

// Handler can be mounted on the same daemon ServeMux as future workspace routes.
// Its peer context is installed by Serve, not derived from HTTP headers.
func (s *Server) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json")
		reject := func() {
			s.log.Warn("credential_handoff", "outcome", "rejected", "reason", "handoff_denied")
			w.WriteHeader(http.StatusBadRequest)
			_, _ = io.WriteString(w, `{"schema_version":1,"error":"handoff_denied"}`)
		}
		if r.Context().Value(peerKey{}) != s.cfg.GatewayUID {
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
		if e != nil || v.Provider != s.cfg.Provider || v.Subject != s.cfg.Subject || v.UID != s.cfg.UID || v.Username != s.cfg.Username || v.Plan != nil && s.plan == nil || v.Seed != nil && s.seed == nil {
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
		unused, e := s.consume(r.Context(), v.Token, v.Replace)
		if e != nil {
			s.log.Warn("credential_handoff", "outcome", "failed", "reason", "native_install_unavailable", "user", s.cfg.Username)
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		answer := reply{SchemaVersion: 1, GitHubToken: string(gateway.HandoffInUse)}
		if unused {
			answer.GitHubToken = string(gateway.HandoffUnused)
		}
		if v.Seed != nil {
			_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(seedDeadline))
		}
		if v.Plan != nil {
			answer.Defaults = s.plan(r.Context(), *v.Plan)
			if !validOutcomes(*v.Plan, answer.Defaults) {
				// The token is installed; only the plan's answer is unknown.
				s.log.Warn("credential_handoff", "outcome", "failed", "reason", "plan_unavailable", "user", s.cfg.Username)
				w.WriteHeader(http.StatusServiceUnavailable)
				return
			}
		}
		if v.Seed != nil {
			// A seed that cannot be written is an answer, not a failed
			// handoff: the person signs in and the AI step shows.
			answer.AIKey = s.seed(r.Context(), *v.Seed)
			if !slices.Contains(seedOutcomes, answer.AIKey) {
				answer.AIKey = "failed"
			}
		}
		out, e := json.Marshal(answer)
		if e != nil || len(out) > maxPlanReply {
			s.log.Warn("credential_handoff", "outcome", "failed", "reason", "plan_unavailable", "user", s.cfg.Username)
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		s.log.Info("credential_handoff", "outcome", "accepted", "user", s.cfg.Username, "github_token", answer.GitHubToken, "plan", map[bool]string{true: "answered", false: "none"}[v.Plan != nil], "ai_key", map[bool]string{true: answer.AIKey, false: "none"}[v.Seed != nil])
		w.Header().Set("Content-Length", strconv.Itoa(len(out)))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(out)
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
	return ErrServeEnded
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
