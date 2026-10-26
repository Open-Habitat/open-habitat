//go:build linux

package transport

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
	"github.com/Open-Habitat/open-habitat/internal/gateway"
)

func shortDir(t *testing.T) string {
	t.Helper()
	d, e := os.MkdirTemp("/tmp", "oh-uds-")
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { _ = os.RemoveAll(d) })
	return d
}
func fixture(t *testing.T) (*Server, *net.UnixListener, gateway.Identity, *atomic.Int32) {
	t.Helper()
	u, e := user.Current()
	if e != nil {
		t.Fatal(e)
	}
	path := filepath.Join(shortDir(t), "sock")
	ln, e := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { _ = ln.Close() })
	cfg := Config{GatewayUID: os.Getuid(), UID: os.Geteuid(), Username: u.Username, Home: u.HomeDir, Socket: path, Provider: "github", Subject: "42"}
	calls := new(atomic.Int32)
	s, e := newServer(cfg, func(_ context.Context, token string) (bool, error) {
		if token != "sentinel-secret" {
			t.Error("unexpected token")
		}
		calls.Add(1)
		return false, nil
	}, true)
	if e != nil {
		t.Fatal(e)
	}
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go func() { _ = s.Serve(ctx, ln) }()
	return s, ln, gateway.Identity{Provider: "github", Subject: "42", UID: cfg.UID, Username: cfg.Username, Socket: path}, calls
}
func raw(t *testing.T, path, method, uri, headers string, body []byte) int {
	t.Helper()
	c, e := net.Dial("unix", path)
	if e != nil {
		t.Fatal(e)
	}
	defer c.Close()
	_ = c.SetDeadline(time.Now().Add(time.Second))
	_, e = fmt.Fprintf(c, "%s %s HTTP/1.1\r\nHost: unix\r\n%s\r\n", method, uri, headers)
	if e != nil {
		t.Fatal(e)
	}
	_, _ = c.Write(body)
	res, e := http.ReadResponse(bufio.NewReader(c), nil)
	if e != nil {
		return 0
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, 1024))
	return res.StatusCode
}
func payload(m gateway.Identity, nonce string) []byte {
	b, _ := json.Marshal(request{1, nonce, "github", "42", m.UID, m.Username, "sentinel-secret", nil, nil})
	return b
}
func send(t *testing.T, m gateway.Identity, b []byte) int {
	t.Helper()
	return raw(t, m.Socket, "POST", Path, fmt.Sprintf("Content-Type: application/json\r\nContent-Length: %d\r\n", len(b)), b)
}
func TestHandoffDiagnosticDoesNotExposeCredentials(t *testing.T) {
	s, _, m, calls := fixture(t)
	var out bytes.Buffer
	s.log = diagnostic.New(&out, "daemon")
	if got := send(t, m, payload(m, strings.Repeat("a", 32))); got != http.StatusOK {
		t.Fatalf("handoff: %d", got)
	}
	if got := send(t, m, payload(m, strings.Repeat("a", 32))); got != http.StatusBadRequest {
		t.Fatalf("replayed handoff: %d", got)
	}
	if calls.Load() != 1 || strings.Contains(out.String(), "sentinel-secret") || strings.Contains(out.String(), `"subject"`) || strings.Contains(out.String(), m.Socket) {
		t.Fatalf("diagnostic leaked content or changed delivery: %s", out.String())
	}
	var lines []map[string]any
	for _, line := range bytes.Split(bytes.TrimSpace(out.Bytes()), []byte{'\n'}) {
		var record map[string]any
		if err := json.Unmarshal(line, &record); err != nil {
			t.Fatal(err)
		}
		lines = append(lines, record)
	}
	if len(lines) != 2 || lines[0]["outcome"] != "accepted" || lines[0]["user"] != m.Username || lines[1]["reason"] != "handoff_denied" {
		t.Fatalf("unexpected handoff events: %v", lines)
	}
}

func TestJITBindingFailsClosedWithoutRootOwnedConfig(t *testing.T) {
	u, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	uid, err := strconv.Atoi(u.Uid)
	if err != nil {
		t.Fatal(err)
	}
	cfg := Config{GatewayUID: uid, UID: os.Geteuid(), Username: u.Username, Home: u.HomeDir, Socket: "/run/open-habitat/users/" + u.Username + "/daemon.sock", Provider: "github", Subject: "42", BindingFile: "/etc/open-habitat-daemon/daemon/user-mappings/daemon-" + u.Username + ".json"}
	if validate(cfg, false) == nil {
		t.Fatal("accepted absent or untrusted binding")
	}
	cfg.BindingFile = "/tmp/daemon-" + u.Username + ".json"
	if validate(cfg, false) == nil {
		t.Fatal("accepted untrusted binding path")
	}
}

func TestJITBindingNumericIdentityAndStrictDecode(t *testing.T) {
	cfg := Config{GatewayUID: 21003, UID: 22010, Username: "pilot", Home: "/home/pilot", Socket: "/run/open-habitat/users/pilot/daemon.sock", Provider: "github", Subject: "42", BindingFile: "/etc/open-habitat-daemon/daemon/user-mappings/daemon-pilot.json"}
	encode := func(c Config) []byte {
		b, err := json.Marshal(struct {
			Component string `json:"component"`
			Handoff   Config `json:"handoff"`
		}{"daemon", c})
		if err != nil {
			t.Fatal(err)
		}
		return b
	}
	if bindingMatches(encode(cfg), cfg) != nil {
		t.Fatal("valid numeric binding rejected")
	}
	for name, changed := range map[string]Config{"numeric-id": func() Config { v := cfg; v.Subject = "43"; return v }(), "uid": func() Config { v := cfg; v.UID++; return v }(), "username": func() Config { v := cfg; v.Username = "other"; return v }(), "gateway-peer": func() Config { v := cfg; v.GatewayUID++; return v }()} {
		t.Run(name, func(t *testing.T) {
			if bindingMatches(encode(changed), cfg) == nil {
				t.Fatal("accepted mismatched binding")
			}
		})
	}
	if bindingMatches(append(encode(cfg), []byte(`{"component":"daemon"}`)...), cfg) == nil {
		t.Fatal("accepted trailing binding")
	}
}

func TestHandoffAndRejections(t *testing.T) {
	_, _, m, calls := fixture(t)
	sink := Sink{testPath: true}
	if _, e := sink.Deliver(context.Background(), m, "42", "sentinel-secret"); e != nil {
		t.Fatal(e)
	}
	if calls.Load() != 1 {
		t.Fatal(calls.Load())
	}
	m.Subject = "43"
	if _, e := sink.Deliver(context.Background(), m, "42", "sentinel-secret"); e == nil {
		t.Fatal("mapping accepted")
	}
	m.Subject = "42"
	m.UID++
	if _, e := sink.Deliver(context.Background(), m, "42", "sentinel-secret"); e == nil {
		t.Fatal("target accepted")
	}
	m.UID--
	b := payload(m, strings.Repeat("a", 32))
	if got := send(t, m, b); got != 200 {
		t.Fatalf("status %d", got)
	}
	if got := send(t, m, b); got == 200 {
		t.Fatal("replay accepted")
	}
	for _, bad := range [][]byte{b[:len(b)-1], append(append([]byte{}, b...), byte('x')), []byte(`{"version":1}`), bytes.Replace(b, []byte(`"version":1`), []byte(`"version":2`), 1), bytes.Replace(b, []byte(`"version":1`), []byte(`"version":1,"version":1`), 1), bytes.Replace(b, []byte(`"token":`), []byte(`"extra":1,"token":`), 1), bytes.Replace(b, []byte(`"subject":"42"`), []byte(`"subject":"43"`), 1), bytes.Replace(b, []byte(`"uid":`+strconv.Itoa(m.UID)), []byte(`"uid":`+strconv.Itoa(m.UID+1)), 1)} {
		if got := send(t, m, bad); got == 200 {
			t.Fatalf("invalid accepted: %s", bad)
		}
	}
	for _, tc := range []struct{ method, uri, headers string }{{"GET", Path, ""}, {"POST", Path + "?x=1", ""}, {"POST", Path + "/", ""}, {"POST", Path, "Content-Type: text/plain\r\n"}, {"POST", Path, "Content-Type: application/json\r\nContent-Type: application/json\r\n"}, {"POST", Path, "Content-Type: application/json\r\nTransfer-Encoding: chunked\r\n"}} {
		headers := tc.headers
		if !strings.Contains(headers, "Transfer-Encoding") {
			headers += fmt.Sprintf("Content-Length: %d\r\n", len(b))
		}
		if got := raw(t, m.Socket, tc.method, tc.uri, headers, b); got == 200 {
			t.Fatalf("accepted %s %s %s", tc.method, tc.uri, headers)
		}
	}
	if got := raw(t, m.Socket, "POST", Path, fmt.Sprintf("Content-Type: application/json\r\nContent-Length: %d\r\n", maxBody+1), nil); got == 200 {
		t.Fatal("oversize accepted")
	}
	if calls.Load() != 2 {
		t.Fatal("bad input consumed", calls.Load())
	}
}
func TestOneDialAndRedaction(t *testing.T) {
	var attempts int
	sink := Sink{testPath: true, dial: func(context.Context, string) (net.Conn, error) { attempts++; return nil, io.ErrUnexpectedEOF }}
	m := gateway.Identity{Provider: "github", Subject: "42", UID: os.Geteuid(), Username: "user", Socket: filepath.Join(t.TempDir(), "missing")}
	for i := 0; i < 2; i++ {
		_, e := sink.Deliver(context.Background(), m, "42", "sentinel-secret")
		if e == nil || strings.Contains(e.Error(), "sentinel-secret") {
			t.Fatal(e)
		}
	}
	if attempts != 2 {
		t.Fatal(attempts)
	}
}
func TestPartialRequestDeadline(t *testing.T) {
	_, _, m, calls := fixture(t)
	c, e := net.Dial("unix", m.Socket)
	if e != nil {
		t.Fatal(e)
	}
	defer c.Close()
	_, _ = io.WriteString(c, "POST "+Path+" HTTP/1.1\r\nHost: unix\r\nContent-Length: 100\r\nContent-Type: application/json\r\n\r\n{")
	_ = c.SetReadDeadline(time.Now().Add(20 * time.Millisecond))
	var buf [1]byte
	_, e = c.Read(buf[:])
	if ne, ok := e.(net.Error); !ok || !ne.Timeout() {
		t.Fatalf("expected deadline: %v", e)
	}
	if calls.Load() != 0 {
		t.Fatal("partial consumed")
	}
}

func TestConsumerFailureReplayAndCapacity(t *testing.T) {
	u, e := user.Current()
	if e != nil {
		t.Fatal(e)
	}
	path := filepath.Join(shortDir(t), "sock")
	ln, e := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
	if e != nil {
		t.Fatal(e)
	}
	defer ln.Close()
	cfg := Config{GatewayUID: os.Getuid(), UID: os.Geteuid(), Username: u.Username, Home: u.HomeDir, Socket: path, Provider: "github", Subject: "42"}
	calls := new(atomic.Int32)
	s, e := newServer(cfg, func(context.Context, string) (bool, error) {
		calls.Add(1)
		return false, fmt.Errorf("sentinel-secret native failure")
	}, true)
	if e != nil {
		t.Fatal(e)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() { _ = s.Serve(ctx, ln) }()
	m := gateway.Identity{Provider: "github", Subject: "42", UID: cfg.UID, Username: cfg.Username, Socket: path}
	b := payload(m, strings.Repeat("b", 32))
	if got := send(t, m, b); got == 200 {
		t.Fatal("consumer failed")
	}
	if got := send(t, m, b); got == 200 {
		t.Fatal("replayed failure")
	}
	if calls.Load() != 1 {
		t.Fatal(calls.Load())
	}
	s.mu.Lock()
	for len(s.seen) < 4096 {
		s.seen[fmt.Sprintf("%032x", len(s.seen))] = struct{}{}
	}
	s.mu.Unlock()
	if got := send(t, m, payload(m, strings.Repeat("c", 32))); got == 200 || calls.Load() != 1 {
		t.Fatal("capacity failed open")
	}
}
func TestForgedPeerHeaderAndFraming(t *testing.T) {
	_, _, m, calls := fixture(t)
	b := payload(m, strings.Repeat("d", 32))
	base := fmt.Sprintf("Content-Type: application/json\r\nContent-Length: %d\r\nX-Agent-Host-Identity: forged\r\n", len(b))
	for _, h := range []string{"Content-Type: application/json\r\nTransfer-Encoding: chunked\r\nContent-Length: 0\r\n", base + fmt.Sprintf("Content-Length: %d\r\n", len(b)), "Content-Type: application/json\r\nContent-Length: 0\r\n"} {
		if raw(t, m.Socket, "POST", Path, h, b) == 200 {
			t.Fatalf("ambiguous framing accepted: %q", h)
		}
	}
	if calls.Load() != 0 {
		t.Fatal("forged header consumed")
	}
}
func TestSuccessResponseMustEnd(t *testing.T) {
	_, _, m, _ := fixture(t)
	// One dial, but a malicious same-UID peer sends a second response after a success.
	sink := Sink{testPath: true, dial: func(ctx context.Context, _ string) (net.Conn, error) {
		client, server := net.Pipe()
		go func() {
			defer server.Close()
			_, _ = io.Copy(io.Discard, io.LimitReader(server, 2048))
			_, _ = io.WriteString(server, okReply+okReply)
		}()
		return client, nil
	}}
	// A non-Unix injected connection cannot provide kernel credentials.
	if _, e := sink.Deliver(context.Background(), m, "42", "sentinel-secret"); e == nil {
		t.Fatal("non-Unix peer accepted")
	}
}

// okReply is a well-formed plan-less success from the daemon.
const okReply = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 44\r\n\r\n{\"schema_version\":1,\"github_token\":\"in_use\"}"

func TestResponseBoundsAndExactSuccess(t *testing.T) {
	_, _, m, _ := fixture(t)
	for _, reply := range []string{
		"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n",
		"HTTP/1.1 302 Found\r\nLocation: http://example.com/\r\nContent-Length: 0\r\n\r\n",
		// The earlier plan-less contract says nothing about the token.
		"HTTP/1.1 204 No Content\r\n\r\n",
		okReply + okReply,
		strings.Replace(okReply, "\r\n\r\n", "\r\nX-Pad: "+strings.Repeat("x", maxHeaders+1024+4096)+"\r\n\r\n", 1),
		strings.Replace(okReply, `"in_use"`, `"in-use"`, 1),
		strings.Replace(okReply, `,"github_token":"in_use"`, `,"github_tokem":"in_use"`, 1),
		strings.Replace(okReply, `{"schema_version":1,"github_token":"in_use"}`, `{"schema_version":1,"github_token":"x"}   `, 1),
	} {
		path := filepath.Join(shortDir(t), "fake")
		ln, e := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
		if e != nil {
			t.Fatal(e)
		}
		done := make(chan struct{})
		go func() {
			defer close(done)
			c, e := ln.AcceptUnix()
			if e != nil {
				return
			}
			defer c.Close()
			_ = c.SetDeadline(time.Now().Add(time.Second))
			r, e := http.ReadRequest(bufio.NewReader(c))
			if e != nil {
				return
			}
			_, _ = io.Copy(io.Discard, r.Body)
			_ = r.Body.Close()
			_, _ = io.WriteString(c, reply)
		}()
		sink := Sink{testPath: true, dial: func(ctx context.Context, _ string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "unix", path)
		}}
		if _, e := sink.Deliver(context.Background(), m, "42", "sentinel-secret"); e == nil || strings.Contains(e.Error(), "sentinel-secret") {
			t.Fatalf("response accepted or leaked: %q", reply[:20])
		}
		_ = ln.Close()
		<-done
	}
}

// The binding walk is exercised against a disposable tree, never /etc or a
// real account. File ownership expectations use this test process's UID/GID.
func TestBindingTraversalPolicy(t *testing.T) {
	root := t.TempDir()
	etc := filepath.Join(root, "etc")
	if err := os.Mkdir(etc, 0755); err != nil {
		t.Fatal(err)
	}
	parent := etc
	for _, name := range []string{"open-habitat-daemon", "daemon", "user-mappings"} {
		parent = filepath.Join(parent, name)
		if err := os.Mkdir(parent, 0711); err != nil {
			t.Fatal(err)
		}
		if err := os.Chmod(parent, 0711); err != nil {
			t.Fatal(err)
		}
	}
	cfg := Config{GatewayUID: 21003, UID: 22010, Username: "pilot", Home: "/home/pilot", Socket: "/run/open-habitat/users/pilot/daemon.sock", Provider: "github", Subject: "42", BindingFile: "/etc/open-habitat-daemon/daemon/user-mappings/daemon-pilot.json"}
	body, err := json.Marshal(struct {
		Component string `json:"component"`
		Handoff   Config `json:"handoff"`
	}{"daemon", cfg})
	if err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(parent, "daemon-pilot.json")
	if err := os.WriteFile(file, body, 0640); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(file, 0640); err != nil {
		t.Fatal(err)
	}
	check := func(want bool) {
		t.Helper()
		if ok := verifyBindingUnder(etc, cfg, os.Getuid(), os.Getgid(), os.Getgid()) == nil; ok != want {
			t.Fatalf("binding accepted=%v, want %v", ok, want)
		}
	}
	check(true)
	if verifyBindingUnder(etc, cfg, os.Getuid()+1, os.Getgid(), os.Getgid()) == nil || verifyBindingUnder(etc, cfg, os.Getuid(), os.Getgid()+1, os.Getgid()) == nil || verifyBindingUnder(etc, cfg, os.Getuid(), os.Getgid(), os.Getgid()+1) == nil {
		t.Fatal("accepted wrong owner or private group")
	}
	for _, p := range []string{filepath.Join(etc, "open-habitat-daemon"), filepath.Join(etc, "open-habitat-daemon", "daemon"), parent} {
		for _, mode := range []os.FileMode{0755, 0700, 0731} {
			if err := os.Chmod(p, mode); err != nil {
				t.Fatal(err)
			}
			check(false)
			if err := os.Chmod(p, 0711); err != nil {
				t.Fatal(err)
			}
		}
	}
	for _, mode := range []os.FileMode{0600, 0660, 0644} {
		if err := os.Chmod(file, mode); err != nil {
			t.Fatal(err)
		}
		check(false)
	}
	if err := os.Chmod(file, 0640); err != nil {
		t.Fatal(err)
	}
	check(true)
	if err := os.Remove(file); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(root, "other"), file); err != nil {
		t.Fatal(err)
	}
	check(false)
	if err := os.Remove(file); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(parent); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(root, "other"), parent); err != nil {
		t.Fatal(err)
	}
	check(false)
}

// The daemon says whether gh kept another token instead of this one; only
// its unused answer reaches the gateway as unused, with or without a plan.
func TestHandoffSaysWhetherTheTokenIsUnused(t *testing.T) {
	s, _, m, calls := fixture(t)
	sink := Sink{testPath: true}
	use, e := sink.Deliver(context.Background(), m, "42", "sentinel-secret")
	if e != nil || use != gateway.HandoffInUse {
		t.Fatal(use, e)
	}
	s.consume = func(context.Context, string) (bool, error) { calls.Add(1); return true, nil }
	if use, e = sink.Deliver(context.Background(), m, "42", "sentinel-secret"); e != nil || use != gateway.HandoffUnused {
		t.Fatal(use, e)
	}
	s.SetPlanConsumer(func(_ context.Context, p Plan) []PlanOutcome { return []PlanOutcome{{p.Defaults[0], "queued"}} })
	reply, e := sink.DeliverFirst(context.Background(), m, "42", "sentinel-secret", gateway.FirstLogin{Plan: &gateway.RepositoryPlan{Mode: "auto", Defaults: []string{"o/r"}}})
	if e != nil || reply.Token != gateway.HandoffUnused || len(reply.Defaults) != 1 {
		t.Fatal(reply, e)
	}
	// A failed install answers nothing, so nothing can be revoked.
	s.consume = func(context.Context, string) (bool, error) { return true, errors.New("install failed") }
	if use, e = sink.Deliver(context.Background(), m, "42", "sentinel-secret"); e == nil || use != "" {
		t.Fatal(use, e)
	}
	if calls.Load() != 3 {
		t.Fatal(calls.Load())
	}
}

// The plan travels in the same one-time handoff: the daemon installs the
// token first, then answers every default in order. A plan the daemon has no
// consumer for, or that breaks the owner/repo grammar or the bound, is refused
// before the token is consumed.
func TestHandoffPlan(t *testing.T) {
	s, _, m, calls := fixture(t)
	sink := Sink{testPath: true}
	plan := gateway.RepositoryPlan{Mode: "auto", Defaults: []string{"northstar-demo/product", "northstar-demo/infra"}}
	if _, e := deliverPlan(sink, m, plan); e == nil || calls.Load() != 0 {
		t.Fatal("plan accepted without a consumer", e, calls.Load())
	}
	var got []Plan
	tokenFirst := true
	s.SetPlanConsumer(func(_ context.Context, p Plan) []PlanOutcome {
		tokenFirst = tokenFirst && calls.Load() == int32(len(got)+1)
		got = append(got, p)
		return []PlanOutcome{{p.Defaults[0], "queued"}, {p.Defaults[1], "already_present"}}
	})
	out, e := deliverPlan(sink, m, plan)
	if e != nil || len(out) != 2 || out[0] != (gateway.PlanOutcome{FullName: "northstar-demo/product", Outcome: "queued"}) || out[1].Outcome != "already_present" || !tokenFirst {
		t.Fatal(out, e, tokenFirst)
	}
	if len(got) != 1 || got[0].Mode != "auto" || strings.Join(got[0].Defaults, ",") != "northstar-demo/product,northstar-demo/infra" {
		t.Fatal(got)
	}
	// The plan-less handoff answers only what became of the token.
	if _, e := sink.Deliver(context.Background(), m, "42", "sentinel-secret"); e != nil {
		t.Fatal(e)
	}
	before := calls.Load()
	many := make([]string, MaxPlanDefaults+1)
	for i := range many {
		many[i] = fmt.Sprintf("o/r%d", i)
	}
	for i, bad := range []Plan{
		{Mode: "preselected", Defaults: []string{"o/r"}},
		{Mode: "auto", Defaults: []string{}},
		{Mode: "auto", Defaults: many},
		{Mode: "skip", Defaults: []string{"o/r", "O/R"}},
		{Mode: "skip", Defaults: []string{"../r"}},
		{Mode: "skip", Defaults: []string{"o/.."}},
		{Mode: "skip", Defaults: []string{"o/r/x"}},
	} {
		b, _ := json.Marshal(request{1, fmt.Sprintf("%032x", 1000+i), "github", "42", m.UID, m.Username, "sentinel-secret", &bad, nil})
		if code := send(t, m, b); code == 200 || code == 204 {
			t.Fatalf("invalid plan accepted: %+v", bad)
		}
		if _, e := deliverPlan(sink, m, gateway.RepositoryPlan{Mode: bad.Mode, Defaults: bad.Defaults}); e == nil {
			t.Fatalf("sink sent invalid plan: %+v", bad)
		}
	}
	if calls.Load() != before {
		t.Fatal("invalid plan consumed a token")
	}
	b := payload(m, strings.Repeat("e", 32))
	if code := send(t, m, bytes.Replace(b, []byte(`"token":`), []byte(`"plan":null,"token":`), 1)); code == 200 || code == 204 {
		t.Fatal("null plan accepted")
	}
}

// A same-UID peer cannot pass off a different answer: the sink accepts only
// one outcome per default, in order, with a fixed word.
func TestPlanReplyMustAnswerThePlan(t *testing.T) {
	_, _, m, _ := fixture(t)
	plan := gateway.RepositoryPlan{Mode: "skip", Defaults: []string{"o/a", "o/b"}}
	for _, body := range []string{
		`{"schema_version":1,"defaults":[{"full_name":"o/a","outcome":"queued"}]}`,
		`{"schema_version":1,"defaults":[{"full_name":"o/b","outcome":"queued"},{"full_name":"o/a","outcome":"queued"}]}`,
		`{"schema_version":1,"defaults":[{"full_name":"o/a","outcome":"queued"},{"full_name":"o/b","outcome":"cloned"}]}`,
		`{"schema_version":1,"defaults":[{"full_name":"o/a","outcome":"queued"},{"full_name":"o/b","outcome":"queued"}],"token":"x"}`,
	} {
		reply := fmt.Sprintf("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: %d\r\n\r\n%s", len(body), body)
		path := filepath.Join(shortDir(t), "fake")
		ln, e := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
		if e != nil {
			t.Fatal(e)
		}
		done := make(chan struct{})
		go func() {
			defer close(done)
			c, e := ln.AcceptUnix()
			if e != nil {
				return
			}
			defer c.Close()
			r, e := http.ReadRequest(bufio.NewReader(c))
			if e != nil {
				return
			}
			_, _ = io.Copy(io.Discard, r.Body)
			_, _ = io.WriteString(c, reply)
		}()
		sink := Sink{testPath: true, dial: func(ctx context.Context, _ string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "unix", path)
		}}
		if _, e := deliverPlan(sink, m, plan); e == nil {
			t.Fatalf("accepted %s", body)
		}
		_ = ln.Close()
		<-done
	}
}

// deliverPlan is DeliverFirst with only a plan, as a site without a key sends.
func deliverPlan(sink Sink, m gateway.Identity, plan gateway.RepositoryPlan) ([]gateway.PlanOutcome, error) {
	reply, e := sink.DeliverFirst(context.Background(), m, "42", "sentinel-secret", gateway.FirstLogin{Plan: &plan})
	return reply.Defaults, e
}

// The site AI key travels in the same one-time handoff: the daemon installs
// the token first, then answers the plan, then the seed. A seed the daemon
// has no consumer for, or that is not a literal key of a known provider, is
// refused before the token is consumed. A seed that cannot be written is an
// answer, not a failed handoff.
func TestHandoffSeed(t *testing.T) {
	s, _, m, calls := fixture(t)
	sink := Sink{testPath: true}
	key := "sk-ant-" + strings.Repeat("K", 30)
	seed := gateway.FirstLogin{Seed: &gateway.SiteKeySeed{Provider: "anthropic", Key: key}}
	if _, e := sink.DeliverFirst(context.Background(), m, "42", "sentinel-secret", seed); e == nil || calls.Load() != 0 {
		t.Fatal("seed accepted without a consumer", e, calls.Load())
	}
	var order []string
	s.SetPlanConsumer(func(_ context.Context, p Plan) []PlanOutcome {
		order = append(order, "plan")
		return []PlanOutcome{{p.Defaults[0], "queued"}}
	})
	answer := "seeded"
	s.SetSeedConsumer(func(_ context.Context, got Seed) string {
		if calls.Load() != 1 || got.Provider != "anthropic" || got.Key != key {
			t.Errorf("seed %+v before token: %d", got, calls.Load())
		}
		order = append(order, "seed")
		return answer
	})
	both := gateway.FirstLogin{Plan: &gateway.RepositoryPlan{Mode: "skip", Defaults: []string{"o/r"}}, Seed: seed.Seed}
	reply, e := sink.DeliverFirst(context.Background(), m, "42", "sentinel-secret", both)
	if e != nil || reply.AIKey != "seeded" || len(reply.Defaults) != 1 || strings.Join(order, ",") != "plan,seed" {
		t.Fatal(reply, e, order)
	}
	answer = "written somewhere"
	calls.Store(0)
	if reply, e = sink.DeliverFirst(context.Background(), m, "42", "sentinel-secret", seed); e != nil || reply.AIKey != "failed" || reply.Defaults != nil {
		t.Fatal("an unknown seed answer is not failed", reply, e)
	}
	before := calls.Load()
	for i, bad := range []Seed{
		{Provider: "mistral", Key: key},
		{Provider: "openai", Key: "!cat ~/.ssh/id_ed25519"},
		{Provider: "openai", Key: "$OPENAI_API_KEY"},
		{Provider: "openai", Key: "sk-short"},
	} {
		b, _ := json.Marshal(request{1, fmt.Sprintf("%032x", 2000+i), "github", "42", m.UID, m.Username, "sentinel-secret", nil, &bad})
		if code := send(t, m, b); code == 200 || code == 204 {
			t.Fatalf("invalid seed accepted: %+v", bad)
		}
		if _, e := sink.DeliverFirst(context.Background(), m, "42", "sentinel-secret", gateway.FirstLogin{Seed: &gateway.SiteKeySeed{Provider: bad.Provider, Key: bad.Key}}); e == nil {
			t.Fatalf("sink sent invalid seed: %+v", bad)
		}
	}
	if calls.Load() != before {
		t.Fatal("invalid seed consumed a token")
	}
}

// A same-UID peer cannot pass off a seed answer that was not asked for, or
// omit one that was.
func TestSeedReplyMustAnswerTheSeed(t *testing.T) {
	_, _, m, _ := fixture(t)
	seed := &gateway.SiteKeySeed{Provider: "openai", Key: "sk-" + strings.Repeat("K", 30)}
	plan := &gateway.RepositoryPlan{Mode: "skip", Defaults: []string{"o/a"}}
	for _, c := range []struct {
		first gateway.FirstLogin
		body  string
	}{
		{gateway.FirstLogin{Seed: seed}, `{"schema_version":1}`},
		{gateway.FirstLogin{Seed: seed}, `{"schema_version":1,"ai_key":"stolen"}`},
		{gateway.FirstLogin{Seed: seed}, `{"schema_version":1,"ai_key":"seeded","defaults":[{"full_name":"o/a","outcome":"queued"}]}`},
		{gateway.FirstLogin{Plan: plan}, `{"schema_version":1,"defaults":[{"full_name":"o/a","outcome":"queued"}],"ai_key":"seeded"}`},
		{gateway.FirstLogin{Plan: plan, Seed: seed}, `{"schema_version":1,"defaults":[{"full_name":"o/a","outcome":"queued"}]}`},
	} {
		reply := fmt.Sprintf("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: %d\r\n\r\n%s", len(c.body), c.body)
		path := filepath.Join(shortDir(t), "fake")
		ln, e := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
		if e != nil {
			t.Fatal(e)
		}
		done := make(chan struct{})
		go func() {
			defer close(done)
			conn, e := ln.AcceptUnix()
			if e != nil {
				return
			}
			defer conn.Close()
			r, e := http.ReadRequest(bufio.NewReader(conn))
			if e != nil {
				return
			}
			_, _ = io.Copy(io.Discard, r.Body)
			_, _ = io.WriteString(conn, reply)
		}()
		sink := Sink{testPath: true, dial: func(ctx context.Context, _ string) (net.Conn, error) {
			return (&net.Dialer{}).DialContext(ctx, "unix", path)
		}}
		if _, e := sink.DeliverFirst(context.Background(), m, "42", "sentinel-secret", c.first); e == nil {
			t.Fatalf("accepted %s", c.body)
		}
		_ = ln.Close()
		<-done
	}
}
