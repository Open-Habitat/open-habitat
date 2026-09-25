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
	"sync/atomic"
	"syscall"
	"testing"
	"time"
)

func socketFixture(t *testing.T, s Server) (Client, string) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	c, path, done := serveFixture(t, s, ctx)
	t.Cleanup(func() {
		cancel()
		if err := <-done; err != nil {
			t.Errorf("serve: %v", err)
		}
	})
	return c, path
}

func serveFixture(t *testing.T, s Server, ctx context.Context) (Client, string, <-chan error) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "broker.sock")
	ln, err := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(path, 0660); err != nil {
		t.Fatal(err)
	}
	file, err := ln.File()
	if err != nil {
		t.Fatal(err)
	}
	ln.SetUnlinkOnClose(false)
	ln.Close()
	t.Cleanup(func() { file.Close() })
	s.SocketPath = path
	s.SocketOwnerUID = uint32(os.Getuid())
	done := make(chan error, 1)
	go func() { done <- s.Serve(ctx, []*os.File{file}) }()
	return Client{SocketPath: path, SocketOwnerUID: uint32(os.Getuid())}, path, done
}

func TestInheritedSocketValidation(t *testing.T) {
	p := filepath.Join(t.TempDir(), "sock")
	ln, err := net.ListenUnix("unix", &net.UnixAddr{Name: p, Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	f, err := ln.File()
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	for _, tc := range []struct {
		name  string
		files []*os.File
		path  string
	}{
		{"none", nil, p}, {"two", []*os.File{f, f}, p}, {"wrong path", []*os.File{f}, p + "x"},
		{"abstract", []*os.File{f}, "@bad"}, {"directory", []*os.File{f}, "/tmp/../tmp/broker"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if l, e := listener(tc.files, tc.path, uint32(os.Getuid())); e == nil {
				l.Close()
				t.Fatal("accepted")
			}
		})
	}
	regular, err := os.CreateTemp(t.TempDir(), "regular")
	if err != nil {
		t.Fatal(err)
	}
	defer regular.Close()
	if l, e := listener([]*os.File{regular}, p, uint32(os.Getuid())); e == nil {
		l.Close()
		t.Fatal("accepted regular file")
	}
	connected, err := net.Dial("unix", p)
	if err != nil {
		t.Fatal(err)
	}
	defer connected.Close()
	cf, err := connected.(*net.UnixConn).File()
	if err != nil {
		t.Fatal(err)
	}
	defer cf.Close()
	if l, e := listener([]*os.File{cf}, p, uint32(os.Getuid())); e == nil {
		l.Close()
		t.Fatal("accepted connected socket")
	}
	if l, e := listener([]*os.File{f}, p, uint32(os.Getuid()+1)); e == nil {
		l.Close()
		t.Fatal("accepted wrong owner")
	}
}

func TestPeerAndFailClosedDefault(t *testing.T) {
	var called atomic.Int32
	c, _ := socketFixture(t, Server{GatewayUID: uint32(os.Getuid()), Handler: func(ctx context.Context, _ Request) Reply {
		if deadline, ok := ctx.Deadline(); !ok || time.Until(deadline) > exchangeTimeout || ctx.Err() != nil {
			t.Errorf("missing live exchange budget: %v", deadline)
		}
		called.Add(1)
		return failure(Denied)
	}})
	r := request("authorize", "42", "")
	got, err := c.Exchange(context.Background(), r)
	if err != nil || got.Failure != Denied || called.Load() != 1 {
		t.Fatalf("%+v %v", got, err)
	}
	wrong := c
	wrong.SocketOwnerUID = uint32(os.Getuid() + 1)
	if _, err = wrong.Exchange(context.Background(), r); err == nil {
		t.Fatal("accepted incorrect broker peer")
	}
	c2, _ := socketFixture(t, Server{GatewayUID: uint32(os.Getuid() + 1), Handler: func(context.Context, Request) Reply { called.Add(1); return Reply{Version: 1, Failure: Denied} }})
	if _, err = c2.Exchange(context.Background(), r); err == nil {
		t.Fatal("accepted incorrect gateway peer")
	}
	if called.Load() != 1 {
		t.Fatal("wrong peer reached handler")
	}
	c3, _ := socketFixture(t, Server{GatewayUID: uint32(os.Getuid())})
	got, err = c3.Exchange(context.Background(), r)
	if err != nil || got.Failure != StateUnavailable || got.Route != nil {
		t.Fatalf("default: %+v %v", got, err)
	}
}

func TestMalformedFraming(t *testing.T) {
	var calls atomic.Int32
	_, path := socketFixture(t, Server{GatewayUID: uint32(os.Getuid()), Handler: func(context.Context, Request) Reply { calls.Add(1); return Reply{Version: 1, Failure: Denied} }})
	good, _ := EncodeRequest(request("authorize", "42", ""))
	cases := []struct {
		name string
		data []byte
	}{
		{"empty", nil}, {"short header", []byte{0, 0}}, {"zero", []byte{0, 0, 0, 0}},
		{"oversize", []byte{0, 0, 16, 1}}, {"short body", frame(good[:len(good)-1], uint32(len(good)))},
		{"trailing byte", append(frame(good, uint32(len(good))), 0)},
		{"duplicate", append(frame(good, uint32(len(good))), frame(good, uint32(len(good)))...)},
		{"unknown version", wire(`{"version":2,"operation":"authorize","provider":"github","id":"42"}`)},
		{"extra field", wire(`{"version":1,"operation":"authorize","provider":"github","id":"42","uid":1}`)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			conn, err := net.DialUnix("unix", nil, &net.UnixAddr{Name: path, Net: "unix"})
			if err != nil {
				t.Fatal(err)
			}
			defer conn.Close()
			conn.SetDeadline(time.Now().Add(time.Second))
			if len(tc.data) > 0 {
				if _, err = conn.Write(tc.data); err != nil {
					t.Fatal(err)
				}
			}
			conn.CloseWrite()
			var b [1]byte
			n, err := conn.Read(b[:])
			if n != 0 || !(errors.Is(err, io.EOF) || errors.Is(err, syscall.ECONNRESET)) {
				t.Fatalf("unexpected reply: %d %v", n, err)
			}
		})
	}
	if calls.Load() != 0 {
		t.Fatal("malformed request reached handler")
	}
}
func wire(s string) []byte { return frame([]byte(s), uint32(len(s))) }
func frame(b []byte, n uint32) []byte {
	out := make([]byte, 4+len(b))
	binary.BigEndian.PutUint32(out, n)
	copy(out[4:], b)
	return out
}

func TestTimeoutCancelReconnectAndBadReply(t *testing.T) {
	var calls atomic.Int32
	c, path := socketFixture(t, Server{GatewayUID: uint32(os.Getuid()), Handler: func(context.Context, Request) Reply { calls.Add(1); return Reply{Version: 1, Failure: Denied} }})
	conn, err := net.DialUnix("unix", nil, &net.UnixAddr{Name: path, Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	conn.Write([]byte{0, 0})
	conn.CloseWrite()
	conn.Close()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err = c.Exchange(ctx, request("authorize", "42", "")); err == nil {
		t.Fatal("cancel accepted")
	}
	ctx, stop := context.WithDeadline(context.Background(), time.Now().Add(-time.Second))
	defer stop()
	if _, err = c.Exchange(ctx, request("authorize", "42", "")); err == nil {
		t.Fatal("expired deadline accepted")
	}
	if r, err := c.Exchange(context.Background(), request("authorize", "42", "")); err != nil || r.Failure != Denied {
		t.Fatalf("reconnect: %+v %v", r, err)
	}
	// Cancellation of a live exchange interrupts the blocked response read.
	blocking, _ := socketFixture(t, Server{GatewayUID: uint32(os.Getuid()), Handler: func(ctx context.Context, _ Request) Reply {
		<-ctx.Done()
		return failure(StateUnavailable)
	}})
	live, abort := context.WithCancel(context.Background())
	returned := make(chan error, 1)
	go func() { _, e := blocking.Exchange(live, request("authorize", "42", "")); returned <- e }()
	time.Sleep(50 * time.Millisecond)
	abort()
	select {
	case e := <-returned:
		if e == nil {
			t.Fatal("cancelled exchange succeeded")
		}
	case <-time.After(time.Second):
		t.Fatal("cancellation did not interrupt exchange")
	}
	// A stalled request times out server-side, without calling the handler.
	stalled, err := net.DialUnix("unix", nil, &net.UnixAddr{Name: path, Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	stalled.Write([]byte{0})
	stalled.SetReadDeadline(time.Now().Add(3 * time.Second))
	var b [1]byte
	n, err := stalled.Read(b[:])
	stalled.Close()
	if n != 0 || err != io.EOF {
		t.Fatalf("stalled: %d %v", n, err)
	}
	if calls.Load() != 1 {
		t.Fatal("stalled request reached handler")
	}
	// A client cannot accept extra bytes even if the reply itself was valid.
	reply, _ := EncodeReply(Reply{Version: 1, Failure: Denied})
	if _, err := readFrameFromBytes(append(frame(reply, uint32(len(reply))), 0)); err == nil {
		t.Fatal("extra reply accepted")
	}
}
func readFrameFromBytes(b []byte) ([]byte, error) { return readFrame(&byteReader{b: b}) }

type byteReader struct{ b []byte }

func (r *byteReader) Read(p []byte) (int, error) {
	if len(r.b) == 0 {
		return 0, io.EOF
	}
	n := copy(p, r.b)
	r.b = r.b[n:]
	return n, nil
}

func TestCorruptStateNeverBecomesDefaultRoute(t *testing.T) {
	d := fixture(t)
	put(t, d, "allowlist.json", `{"version":1,"epoch":0,"ids":[]}`)
	if got := result(t, d, request("authorize", "42", "")); got.Failure != StateUnavailable {
		t.Fatal(got)
	}
	c, _ := socketFixture(t, Server{GatewayUID: uint32(os.Getuid())})
	got, err := c.Exchange(context.Background(), request("authorize", "42", ""))
	if err != nil || got.Route != nil || got.Failure != StateUnavailable {
		t.Fatalf("%+v %v", got, err)
	}
}

// All admitted handlers are paused; the next permitted client must be closed
// without running handler work. Releasing one restores admission, and cancel
// drains all in-flight exchanges (including a silent permitted peer).
func TestServerCapsAcceptedClientsAndDrains(t *testing.T) {
	entered := make(chan struct{}, maxActiveExchanges+1)
	release := make(chan struct{})
	var calls atomic.Int32
	c, path := socketFixture(t, Server{GatewayUID: uint32(os.Getuid()), Handler: func(context.Context, Request) Reply {
		calls.Add(1)
		entered <- struct{}{}
		<-release
		return Reply{Version: 1, Failure: Denied}
	}})
	clients := make([]*net.UnixConn, 0, maxActiveExchanges)
	released := false
	defer func() {
		if !released {
			close(release)
		}
		for _, conn := range clients {
			conn.Close()
		}
	}()
	payload, _ := EncodeRequest(request("authorize", "42", ""))
	for i := 0; i < maxActiveExchanges; i++ {
		conn, err := net.DialUnix("unix", nil, &net.UnixAddr{Name: path, Net: "unix"})
		if err != nil {
			t.Fatal(err)
		}
		clients = append(clients, conn)
		conn.SetDeadline(time.Now().Add(time.Second))
		if err := writeFrame(conn, payload); err != nil {
			t.Fatal(err)
		}
		if err := conn.CloseWrite(); err != nil {
			t.Fatal(err)
		}
		select {
		case <-entered:
		case <-time.After(time.Second):
			t.Fatal("handler not admitted")
		}
	}
	extra, err := net.DialUnix("unix", nil, &net.UnixAddr{Name: path, Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	defer extra.Close()
	extra.SetDeadline(time.Now().Add(time.Second))
	_ = writeFrame(extra, payload)
	_ = extra.CloseWrite()
	var b [1]byte
	n, err := extra.Read(b[:])
	if n != 0 || !(errors.Is(err, io.EOF) || errors.Is(err, syscall.ECONNRESET)) {
		t.Fatalf("excess not rejected: %d %v", n, err)
	}
	if calls.Load() != maxActiveExchanges {
		t.Fatal("excess reached handler")
	}
	close(release)
	released = true
	for _, conn := range clients {
		if _, err := readFrame(conn); err != nil {
			t.Fatal(err)
		}
	}
	deadline := time.After(time.Second)
	for {
		r, err := c.Exchange(context.Background(), request("authorize", "42", ""))
		if err == nil && r.Failure == Denied {
			break
		}
		select {
		case <-deadline:
			t.Fatalf("reconnect: %+v %v", r, err)
		case <-time.After(10 * time.Millisecond):
		}
	}
}

// CloseWrite is required framing and yields EOF even for a live client. The
// handler is instead bounded by the admitted exchange context.
func TestHandlerDeadlineAndParallelDrain(t *testing.T) {
	entered := make(chan context.Context, maxActiveExchanges)
	finished := make(chan error, maxActiveExchanges)
	var active atomic.Int32
	c, _ := socketFixture(t, Server{GatewayUID: uint32(os.Getuid()), Handler: func(ctx context.Context, _ Request) Reply {
		active.Add(1)
		entered <- ctx
		<-ctx.Done()
		active.Add(-1)
		finished <- ctx.Err()
		return failure(StateUnavailable)
	}})
	results := make(chan error, maxActiveExchanges)
	for i := 0; i < maxActiveExchanges; i++ {
		go func() {
			_, err := c.Exchange(context.Background(), request("authorize", "42", ""))
			results <- err
		}()
		// Ensure each request was admitted before filling the next slot.
		select {
		case ctx := <-entered:
			deadline, ok := ctx.Deadline()
			if !ok || time.Until(deadline) > exchangeTimeout || ctx.Err() != nil {
				t.Fatalf("unexpected handler deadline: %v", deadline)
			}
		case <-time.After(time.Second):
			t.Fatal("handler not entered")
		}
	}
	for i := 0; i < maxActiveExchanges; i++ {
		select {
		case err := <-finished:
			if !errors.Is(err, context.DeadlineExceeded) {
				t.Fatalf("handler context: %v", err)
			}
		case <-time.After(4 * time.Second):
			t.Fatal("handler exceeded exchange deadline")
		}
		select {
		case err := <-results:
			if err == nil {
				t.Fatal("timed out request succeeded")
			}
		case <-time.After(time.Second):
			t.Fatal("client not released")
		}
	}
	if n := active.Load(); n != 0 {
		t.Fatalf("handlers still active: %d", n)
	}
}

func TestParentCancelDrainsBlockedHandler(t *testing.T) {
	parent, cancel := context.WithCancel(context.Background())
	defer cancel()
	entered := make(chan struct{})
	finished := make(chan error, 1)
	c, _, done := serveFixture(t, Server{GatewayUID: uint32(os.Getuid()), Handler: func(ctx context.Context, _ Request) Reply {
		close(entered)
		<-ctx.Done()
		finished <- ctx.Err()
		return failure(StateUnavailable)
	}}, parent)
	result := make(chan error, 1)
	go func() {
		_, err := c.Exchange(context.Background(), request("authorize", "42", ""))
		result <- err
	}()
	select {
	case <-entered:
	case <-time.After(time.Second):
		cancel()
		<-done
		t.Fatal("handler not entered")
	}
	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(time.Second):
		t.Fatal("server did not drain handler")
	}
	if err := <-finished; !errors.Is(err, context.Canceled) {
		t.Fatalf("handler context: %v", err)
	}
	select {
	case err := <-result:
		if err == nil {
			t.Fatal("cancelled server returned reply")
		}
	case <-time.After(time.Second):
		t.Fatal("client remained connected")
	}
}

func TestServerCancelClosesStalledPeerAndDrains(t *testing.T) {
	path := filepath.Join(t.TempDir(), "broker.sock")
	ln, err := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(path, 0660); err != nil {
		t.Fatal(err)
	}
	f, err := ln.File()
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	ln.SetUnlinkOnClose(false)
	ln.Close()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() {
		done <- (Server{SocketPath: path, SocketOwnerUID: uint32(os.Getuid()), GatewayUID: uint32(os.Getuid())}).Serve(ctx, []*os.File{f})
	}()
	conn, err := net.DialUnix("unix", nil, &net.UnixAddr{Name: path, Net: "unix"})
	if err != nil {
		cancel()
		<-done
		t.Fatal(err)
	}
	defer conn.Close()
	conn.Write([]byte{0}) // permitted peer, incomplete frame
	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(time.Second):
		t.Fatal("cancel did not drain")
	}
}

// Slow, valid first provisioning has a separate handler budget; ordinary
// authorization never inherits it. The client must wait beyond old 2s limit.
func TestFirstEnsureBudgetAndFastAuthorize(t *testing.T) {
	entered := make(chan struct{})
	c, _ := socketFixture(t, Server{GatewayUID: uint32(os.Getuid()), Handler: func(ctx context.Context, r Request) Reply {
		if r.Operation == "authorize" {
			if d, ok := ctx.Deadline(); !ok || time.Until(d) > exchangeTimeout {
				t.Errorf("authorize budget: %v", d)
			}
			return failure(Denied)
		}
		if d, ok := ctx.Deadline(); !ok || time.Until(d) < ensureTimeout-time.Second {
			t.Errorf("ensure budget: %v", d)
		}
		close(entered)
		select {
		case <-time.After(2200 * time.Millisecond):
		case <-ctx.Done():
			return failure(StateUnavailable)
		}
		return failure(NameCollision)
	}})
	result := make(chan error, 1)
	go func() {
		r, err := c.Exchange(context.Background(), request("ensure", "42", "carol"))
		if err == nil && r.Failure != NameCollision {
			err = errors.New("wrong ensure reply")
		}
		result <- err
	}()
	<-entered
	if r, err := c.Exchange(context.Background(), request("authorize", "42", "")); err != nil || r.Failure != Denied {
		t.Fatalf("fast authorization: %+v %v", r, err)
	}
	if err := <-result; err != nil {
		t.Fatal(err)
	}
}

// A canceled or expired first operation must never publish a route or remove
// the journal, even if a host step returned after its caller went away.
func TestInterruptedEnsureKeepsJournal(t *testing.T) {
	w, h := writerFixture(t)
	entered := make(chan struct{})
	release := make(chan struct{})
	h.onStep = func(phase string) {
		if phase == "account" {
			close(entered)
			<-release
		}
	}
	parent, cancel := context.WithCancel(context.Background())
	defer cancel()
	c, _, done := serveFixture(t, Server{GatewayUID: uint32(os.Getuid()), Handler: w.Handle}, parent)
	result := make(chan error, 1)
	go func() { _, err := c.Exchange(context.Background(), request("ensure", "42", "carol")); result <- err }()
	select {
	case <-entered:
	case <-time.After(time.Second):
		close(release)
		t.Fatal("account not entered")
	}
	cancel()
	select {
	case err := <-result:
		if err == nil {
			t.Fatal("aborted client got route")
		}
	case <-time.After(time.Second):
		t.Fatal("client not released")
	}
	close(release)
	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(time.Second):
		t.Fatal("handler not drained")
	}
	if fileAbsent(filepath.Join(w.Dir, "pending.json")) {
		t.Fatal("lost interrupted marker")
	}
	if r := w.Handle(context.Background(), request("authorize", "42", "")); r.Failure != StateUnavailable || r.Route != nil {
		t.Fatal(r)
	}
}

func TestInsufficientRemainingBudgetBeforeJournal(t *testing.T) {
	w, _ := writerFixture(t)
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if r := w.Handle(ctx, request("ensure", "42", "carol")); r.Route != nil || r.Failure != StateUnavailable {
		t.Fatal(r)
	}
	if !fileAbsent(filepath.Join(w.Dir, "pending.json")) {
		t.Fatal("short waiter began mutation")
	}
}

func TestParallelEnsureSerializationAndRevocation(t *testing.T) {
	for _, otherID := range []bool{false, true} {
		t.Run(map[bool]string{false: "same-id", true: "different-id"}[otherID], func(t *testing.T) {
			w, h := writerFixture(t)
			if otherID {
				put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":4,"ids":[{"id":"42"},{"id":"43"}]}`)
			}
			entered := make(chan struct{})
			release := make(chan struct{})
			h.onStep = func(p string) {
				if p == "account" && len(h.steps) == 1 {
					close(entered)
					<-release
				}
			}
			c, _ := socketFixture(t, Server{GatewayUID: uint32(os.Getuid()), Handler: w.Handle})
			first := make(chan Reply, 1)
			go func() { r, _ := c.Exchange(context.Background(), request("ensure", "42", "carol")); first <- r }()
			select {
			case <-entered:
			case <-time.After(time.Second):
				close(release)
				t.Fatal("first ensure not entered")
			}
			id, name := "42", "renamed"
			if otherID {
				id, name = "43", "david"
			}
			second := make(chan Reply, 1)
			go func() { r, _ := c.Exchange(context.Background(), request("ensure", id, name)); second <- r }()
			close(release)
			a, b := <-first, <-second
			if a.Route == nil || b.Route == nil {
				t.Fatalf("parallel: %+v %+v", a, b)
			}
			if otherID && (a.Route.UID == b.Route.UID || a.Route.Username == b.Route.Username) {
				t.Fatalf("collision: %+v %+v", a, b)
			}
			if !otherID && (a.Route.UID != b.Route.UID || a.Route.Username != b.Route.Username || len(h.steps) != 5) {
				t.Fatalf("duplicate mutation: %+v %+v, %v", a, b, h.steps)
			}
			put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":5,"ids":[]}`)
			if r, err := c.Exchange(context.Background(), request("authorize", "42", "")); err != nil || r.Failure != Denied || r.Route != nil {
				t.Fatalf("revoked route: %+v %v", r, err)
			}
		})
	}
}
