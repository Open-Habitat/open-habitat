//go:build linux

package msmcp

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"os"
	"os/exec"
	"strconv"
	"sync"
	"syscall"
	"time"
)

// Binding is the native configuration one account's calls run under. Equal
// keys share the running child; a different key means the slot must drain,
// stop and reap the child before a replacement starts. The resolver builds
// it from the daemon's own records, never from anything the relay says
// beyond the account's address.
type Binding struct {
	// Account is the address the binding signs in as; Key must include it.
	Account string
	Key     string
	Path    string
	Args    []string
	Env     []string // the child's whole environment
	Dir     string
}

// Resolver turns an account address into its binding, or refuses it. It is
// asked again for every listing and every call, so a removed account or a
// changed level takes effect at the next request.
type Resolver func(account string) (Binding, error)

// Options tune a Server; zero values take the defaults.
type Options struct {
	// Idle stops the child after this long with nothing in flight.
	Idle time.Duration
	// Start bounds the child's start, initialize and listing.
	Start time.Duration
	// Stop is how long a stopping child gets after its stdin closes, and
	// again after SIGTERM, before SIGKILL.
	Stop time.Duration
	// Drain bounds how long a pending account switch waits for the running
	// account's calls; after it they are failed as of unknown outcome.
	Drain time.Duration
	// Queue bounds the calls waiting for the slot.
	Queue int
	// PerClient bounds one connection's outstanding requests.
	PerClient int
	Log       *slog.Logger
	// started, when set, observes every child start (tests).
	started func(Binding)
}

// Server is the person's one Microsoft MCP slot and its endpoint.
type Server struct {
	resolve Resolver
	opt     Options
	log     *slog.Logger

	mu        sync.Mutex
	closed    bool
	child     *child
	prev      *child // the last child, until it is reaped
	queue     []*call
	switching bool
	meta      map[string]*meta // by binding key; what the server offers under it
	nextID    int64
	nextTok   int64
	wake      chan struct{}
	clients   map[*client]bool
	done      chan struct{}
}

// NewServer makes a slot that starts children with resolve's bindings.
func NewServer(resolve Resolver, opt Options) *Server {
	if opt.Idle <= 0 {
		opt.Idle = 10 * time.Minute
	}
	if opt.Start <= 0 {
		opt.Start = 60 * time.Second
	}
	if opt.Stop <= 0 {
		opt.Stop = 3 * time.Second
	}
	if opt.Drain <= 0 {
		opt.Drain = 2 * time.Minute
	}
	if opt.Queue <= 0 {
		opt.Queue = 64
	}
	if opt.PerClient <= 0 {
		opt.PerClient = 32
	}
	if opt.Log == nil {
		opt.Log = slog.New(slog.DiscardHandler)
	}
	return &Server{resolve: resolve, opt: opt, log: opt.Log, meta: map[string]*meta{}, wake: make(chan struct{}, 1), clients: map[*client]bool{}, done: make(chan struct{})}
}

// Serve listens on the person's endpoint until ctx ends, then stops the
// child and waits for it to be reaped. While another daemon of the same
// person holds the endpoint it keeps trying, so at most one serves.
func (s *Server) Serve(ctx context.Context, home string) error {
	var ep *endpoint
	for {
		var err error
		ep, err = listen(home)
		if err == nil {
			break
		}
		if !errors.Is(err, errBusy) {
			s.log.Warn("microsoft_mcp", "outcome", "unavailable", "reason", "endpoint_unavailable")
		}
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(5 * time.Second):
		}
	}
	defer ep.close()
	return s.serveListener(ctx, ep.ln)
}

func (s *Server) serveListener(ctx context.Context, ln *net.UnixListener) error {
	go s.run()
	stop := context.AfterFunc(ctx, func() { ln.Close() })
	defer stop()
	defer s.shutdown()
	for {
		c, err := ln.AcceptUnix()
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			var ne net.Error
			if errors.As(err, &ne) && ne.Timeout() {
				continue
			}
			return err
		}
		if acceptedUID(c) != os.Geteuid() || os.Geteuid() <= 0 {
			c.Close()
			continue
		}
		go s.serveConn(c)
	}
}

// shutdown fails what is queued, stops the child and waits for its reaping.
func (s *Server) shutdown() {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return
	}
	s.closed = true
	queued := s.queue
	s.queue = nil
	ch := s.child
	clients := make([]*client, 0, len(s.clients))
	for c := range s.clients {
		clients = append(clients, c)
	}
	s.mu.Unlock()
	for _, c := range queued {
		c.fail(errShutdown)
	}
	for _, c := range clients {
		c.conn.Close()
	}
	if ch != nil {
		s.stopChild(ch)
	}
	s.signal()
	<-s.done
}

// Release stops the child when it runs an account that is being removed,
// failing its calls, so a removed sign-in is not kept alive in memory.
func (s *Server) Release(account string) {
	s.mu.Lock()
	ch := s.child
	s.mu.Unlock()
	if ch != nil && ch.account == account {
		s.stopChild(ch)
	}
}

// Running reports the child's PID, 0 when none runs (tests and the
// footprint measurement).
func (s *Server) Running() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.child == nil || s.child.cmd.Process == nil {
		return 0
	}
	return s.child.cmd.Process.Pid
}

func (s *Server) signal() {
	select {
	case s.wake <- struct{}{}:
	default:
	}
}

// Errors a client reads. The upstream one says a call's outcome is unknown
// and that it was not repeated: an automatic retry could send a mail twice.
var (
	errUpstream    = &rpcError{-32000, "The Microsoft server stopped before it answered. Whether this call took effect is unknown, and Habitat did not repeat it; check before trying again."}
	errStart       = &rpcError{-32000, "The Microsoft server could not be started for this account. Settings → Integrations shows whether the account needs a new sign-in."}
	errBusyQueue   = &rpcError{-32000, "Habitat's Microsoft connection is busy with other conversations; try again shortly."}
	errTooMany     = &rpcError{-32000, "Too many Microsoft requests are already waiting from this conversation."}
	errShutdown    = &rpcError{-32000, "Habitat's Microsoft connection is stopping; the call was not made."}
	errAccount     = &rpcError{-32000, "This Microsoft account is not connected in Habitat; the person can connect it in Settings → Integrations."}
	errUnknownTool = &rpcError{-32602, "That tool is not in this area. describeNamespace on the area lists its tools; another area of the same account may have it."}
)

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (e *rpcError) Error() string { return e.Message }

// meta is what the native server said under one binding: its initialize
// result and its tool listing. It is the daemon's memory of the current
// process family, never written anywhere, and keyed by the whole binding so
// a level change never answers from the old listing.
type meta struct {
	protocol     string
	serverInfo   json.RawMessage
	instructions string
	tools        []json.RawMessage
	names        []string
}

func (m *meta) offers(name string) bool {
	for _, n := range m.names {
		if n == name {
			return true
		}
	}
	return false
}

// call is one client request waiting for, or being answered by, the child.
// An internal call (initialize, tools/list) has result set instead of a
// client.
type call struct {
	c        *client
	id       json.RawMessage
	method   string
	params   json.RawMessage
	binding  Binding
	progress json.RawMessage // the client's own progress token, nil if none
	token    string          // the token the child sees in its place
	upID     int64
	sent     bool
	finished bool
	ch       *child
	result   chan json.RawMessage // internal: the whole response
	ready    chan *meta           // a wait for the binding's meta
}

func (c *call) fail(e *rpcError) {
	switch {
	case c.ready != nil:
		close(c.ready)
	case c.result != nil:
		close(c.result)
	case c.c != nil:
		c.c.errorReply(c.id, e)
	}
}

// child is one running native server.
type child struct {
	binding  Binding
	account  string
	cmd      *exec.Cmd
	in       chan []byte
	inflight map[int64]*call
	tokens   map[string]*call
	ready    bool
	lastUse  time.Time
	quit     chan struct{} // closed once to stop the child
	quitOnce sync.Once
	exited   chan struct{} // the reader saw EOF
	reaped   chan struct{} // Wait returned and the group is gone
	stopping bool
	drainBy  time.Time // when a pending switch stops waiting for in-flight calls
}

// run is the slot's scheduler. It alone starts and switches children.
func (s *Server) run() {
	defer close(s.done)
	for {
		s.mu.Lock()
		if s.closed {
			ch := s.child
			s.mu.Unlock()
			if ch != nil {
				<-ch.reaped
			}
			return
		}
		s.pruneQueue()
		if len(s.queue) == 0 {
			var idle <-chan time.Time
			if ch := s.child; ch != nil && ch.ready && len(ch.inflight) == 0 {
				left := s.opt.Idle - time.Since(ch.lastUse)
				if left <= 0 {
					s.mu.Unlock()
					s.stopChild(ch)
					continue
				}
				idle = time.After(left)
			}
			s.mu.Unlock()
			select {
			case <-s.wake:
			case <-idle:
			}
			continue
		}
		head := s.queue[0]
		ch := s.child
		if ch != nil && ch.ready && ch.binding.Key == head.binding.Key {
			s.switching = false
			n := 0
			for n < len(s.queue) && s.queue[n].binding.Key == ch.binding.Key {
				n++
			}
			batch := append([]*call(nil), s.queue[:n]...)
			s.queue = append(s.queue[:0:0], s.queue[n:]...)
			for _, c := range batch {
				s.dispatchLocked(ch, c)
			}
			s.mu.Unlock()
			continue
		}
		if ch != nil {
			// Another binding waits: let what runs finish, admit nothing new
			// to this child, then stop and reap it before the next starts.
			s.switching = true
			if ch.drainBy.IsZero() {
				ch.drainBy = time.Now().Add(s.opt.Drain)
			}
			if left := time.Until(ch.drainBy); len(ch.inflight) > 0 && !ch.stopping && left > 0 {
				s.mu.Unlock()
				select {
				case <-s.wake:
				case <-time.After(left):
				}
				continue
			}
			s.mu.Unlock()
			s.stopChild(ch)
			continue
		}
		prev := s.prev
		s.mu.Unlock()
		if prev != nil {
			<-prev.reaped
		}
		s.startChild(head.binding)
	}
}

// pruneQueue drops calls whose client went away.
func (s *Server) pruneQueue() {
	kept := s.queue[:0]
	for _, c := range s.queue {
		if c.c != nil && c.c.gone() {
			continue
		}
		kept = append(kept, c)
	}
	for i := len(kept); i < len(s.queue); i++ {
		s.queue[i] = nil
	}
	s.queue = kept
}

// startChild starts the native server for b, initializes it and reads its
// listing. On failure it fails every queued call for b.
func (s *Server) startChild(b Binding) {
	cmd := exec.Command(b.Path, b.Args...)
	cmd.Env, cmd.Dir = b.Env, b.Dir
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true, Pdeathsig: syscall.SIGKILL}
	stdin, err1 := cmd.StdinPipe()
	stdout, err2 := cmd.StdoutPipe()
	// The native server's diagnostics can name the account and its mail;
	// they are not kept.
	cmd.Stderr = io.Discard
	ch := &child{binding: b, account: b.Account, cmd: cmd, in: make(chan []byte, 256), quit: make(chan struct{}), inflight: map[int64]*call{}, tokens: map[string]*call{}, lastUse: time.Now(), exited: make(chan struct{}), reaped: make(chan struct{})}
	if err1 != nil || err2 != nil || cmd.Start() != nil {
		s.log.Warn("microsoft_mcp", "outcome", "start_failed")
		s.failKey(b.Key, errStart)
		return
	}
	if s.opt.started != nil {
		s.opt.started(b)
	}
	// The writer alone owns stdin. Closing it is the polite stop: the
	// native server exits at EOF. ch.in is never closed.
	go func() {
		defer stdin.Close()
		for {
			select {
			case line := <-ch.in:
				if _, err := stdin.Write(line); err != nil {
					return
				}
			case <-ch.quit:
				return
			case <-ch.exited:
				return
			}
		}
	}()
	s.mu.Lock()
	s.child, s.prev = ch, ch
	s.mu.Unlock()
	go s.read(ch, stdout)

	m, ok := s.handshake(ch)
	s.mu.Lock()
	if !ok || s.child != ch {
		s.mu.Unlock()
		s.log.Warn("microsoft_mcp", "outcome", "start_failed", "reason", "handshake")
		s.stopChild(ch)
		s.failKey(b.Key, errStart)
		return
	}
	s.meta[b.Key] = m
	ch.ready = true
	ch.lastUse = time.Now()
	s.mu.Unlock()
	s.signal()
}

// handshake initializes the child and reads every page of its listing.
func (s *Server) handshake(ch *child) (*meta, bool) {
	ctx, cancel := context.WithTimeout(context.Background(), s.opt.Start)
	defer cancel()
	init, ok := s.internal(ctx, ch, "initialize", json.RawMessage(`{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"open-habitat","version":"1"}}`))
	if !ok {
		return nil, false
	}
	var ir struct {
		Result struct {
			Protocol     string          `json:"protocolVersion"`
			ServerInfo   json.RawMessage `json:"serverInfo"`
			Instructions string          `json:"instructions"`
		} `json:"result"`
	}
	if json.Unmarshal(init, &ir) != nil || ir.Result.Protocol == "" {
		return nil, false
	}
	ch.in <- []byte(`{"jsonrpc":"2.0","method":"notifications/initialized"}` + "\n")
	m := &meta{protocol: ir.Result.Protocol, serverInfo: ir.Result.ServerInfo, instructions: ir.Result.Instructions}
	cursor := ""
	for page := 0; page < 20; page++ {
		params := json.RawMessage(`{}`)
		if cursor != "" {
			params, _ = json.Marshal(map[string]string{"cursor": cursor})
		}
		raw, ok := s.internal(ctx, ch, "tools/list", params)
		if !ok {
			return nil, false
		}
		var lr struct {
			Result struct {
				Tools      []json.RawMessage `json:"tools"`
				NextCursor string            `json:"nextCursor"`
			} `json:"result"`
		}
		if json.Unmarshal(raw, &lr) != nil {
			return nil, false
		}
		for _, t := range lr.Result.Tools {
			var named struct {
				Name string `json:"name"`
			}
			if json.Unmarshal(t, &named) != nil || named.Name == "" {
				return nil, false
			}
			m.tools = append(m.tools, t)
			m.names = append(m.names, named.Name)
		}
		if cursor = lr.Result.NextCursor; cursor == "" {
			return m, true
		}
	}
	return nil, false
}

func (s *Server) internal(ctx context.Context, ch *child, method string, params json.RawMessage) (json.RawMessage, bool) {
	c := &call{method: method, params: params, binding: ch.binding, result: make(chan json.RawMessage, 1)}
	s.mu.Lock()
	if s.child != ch {
		s.mu.Unlock()
		return nil, false
	}
	s.dispatchLocked(ch, c)
	s.mu.Unlock()
	select {
	case raw, ok := <-c.result:
		return raw, ok
	case <-ch.exited:
		return nil, false
	case <-ctx.Done():
		return nil, false
	}
}

// failKey fails the queued calls of one binding.
func (s *Server) failKey(key string, e *rpcError) {
	s.mu.Lock()
	var failed []*call
	kept := s.queue[:0]
	for _, c := range s.queue {
		if c.binding.Key == key {
			failed = append(failed, c)
		} else {
			kept = append(kept, c)
		}
	}
	s.queue = kept
	s.mu.Unlock()
	for _, c := range failed {
		c.fail(e)
	}
	s.signal()
}

// dispatchLocked sends c to ch. A meta wait completes at once.
func (s *Server) dispatchLocked(ch *child, c *call) {
	if c.ready != nil {
		c.ready <- s.meta[ch.binding.Key]
		return
	}
	s.nextID++
	c.upID, c.sent, c.ch = s.nextID, true, ch
	params := c.params
	if c.progress != nil {
		s.nextTok++
		c.token = "oh-" + strconv.FormatInt(s.nextTok, 10)
		params = withProgressToken(params, c.token)
		ch.tokens[c.token] = c
	}
	msg := map[string]any{"jsonrpc": "2.0", "id": c.upID, "method": c.method}
	if len(params) > 0 {
		msg["params"] = params
	}
	line, _ := json.Marshal(msg)
	ch.lastUse = time.Now()
	select {
	case ch.in <- append(line, '\n'):
		ch.inflight[c.upID] = c
	default:
		// The child stopped reading its input; it is treated as gone.
		c.sent = false
		if c.token != "" {
			delete(ch.tokens, c.token)
		}
		go c.fail(errUpstream)
	}
}

// read routes the child's output to the calls that asked.
func (s *Server) read(ch *child, out io.Reader) {
	r := bufio.NewReaderSize(out, 64<<10)
	for {
		line, err := readLine(r, 64<<20)
		if err != nil {
			break
		}
		var msg struct {
			ID     json.RawMessage `json:"id"`
			Method string          `json:"method"`
			Params json.RawMessage `json:"params"`
		}
		if json.Unmarshal(line, &msg) != nil {
			continue
		}
		switch {
		case msg.Method != "" && len(msg.ID) > 0:
			// The child asks its client something (sampling, roots): this
			// client offers no such capability.
			reply, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": msg.ID, "error": rpcError{-32601, "not supported"}})
			select {
			case ch.in <- append(reply, '\n'):
			default:
			}
		case msg.Method == "notifications/progress":
			s.routeProgress(ch, msg.Params)
		case msg.Method != "":
			// Other notifications (logging, list changes) concern no one call.
		default:
			s.routeResponse(ch, msg.ID, line)
		}
	}
	close(ch.exited)
	// Every call still in flight has an unknown outcome. It is failed, not
	// sent again.
	s.mu.Lock()
	inflight := ch.inflight
	ch.inflight = map[int64]*call{}
	ch.tokens = map[string]*call{}
	if s.child == ch {
		s.child = nil
	}
	s.mu.Unlock()
	for _, c := range inflight {
		if !c.finished {
			c.fail(errUpstream)
		}
	}
	go func() {
		_ = ch.cmd.Wait()
		_ = syscall.Kill(-ch.cmd.Process.Pid, syscall.SIGKILL)
		close(ch.reaped)
		s.signal()
	}()
	s.signal()
}

func (s *Server) routeResponse(ch *child, rawID json.RawMessage, line []byte) {
	id, err := strconv.ParseInt(string(rawID), 10, 64)
	if err != nil {
		return
	}
	s.mu.Lock()
	c := ch.inflight[id]
	if c != nil {
		delete(ch.inflight, id)
		if c.token != "" {
			delete(ch.tokens, c.token)
		}
		c.finished = true
	}
	s.mu.Unlock()
	if c == nil {
		return
	}
	defer s.signal()
	if c.result != nil {
		c.result <- line
		return
	}
	if c.c == nil || c.c.cancelled(c.id) {
		return
	}
	var resp map[string]json.RawMessage
	if json.Unmarshal(line, &resp) != nil {
		c.c.errorReply(c.id, errUpstream)
		return
	}
	resp["id"] = c.id
	resp["jsonrpc"] = json.RawMessage(`"2.0"`)
	out, _ := json.Marshal(resp)
	c.c.send(out)
	c.c.finish(c.id)
}

func (s *Server) routeProgress(ch *child, params json.RawMessage) {
	var p map[string]json.RawMessage
	if json.Unmarshal(params, &p) != nil {
		return
	}
	var token string
	if json.Unmarshal(p["progressToken"], &token) != nil {
		return
	}
	s.mu.Lock()
	c := ch.tokens[token]
	s.mu.Unlock()
	if c == nil || c.c == nil || c.c.cancelled(c.id) {
		return
	}
	p["progressToken"] = c.progress
	out, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "method": "notifications/progress", "params": p})
	c.c.send(out)
}

// stopChild closes the child's input, then SIGTERMs and finally SIGKILLs
// its process group, and returns once it is reaped. Its calls in flight
// fail as of unknown outcome when its output ends.
func (s *Server) stopChild(ch *child) {
	s.mu.Lock()
	ch.stopping = true
	if s.child == ch {
		s.child = nil
	}
	s.mu.Unlock()
	ch.quitOnce.Do(func() {
		close(ch.quit)
		go func() {
			for _, sig := range []syscall.Signal{syscall.SIGTERM, syscall.SIGKILL} {
				select {
				case <-ch.reaped:
					return
				case <-time.After(s.opt.Stop):
				}
				_ = syscall.Kill(-ch.cmd.Process.Pid, sig)
			}
		}()
	})
	<-ch.reaped
	s.signal()
}

// submit queues a call, or dispatches it at once when the slot runs its
// binding and nothing waits ahead of it.
func (s *Server) submit(c *call) {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		c.fail(errShutdown)
		return
	}
	if ch := s.child; ch != nil && ch.ready && !ch.stopping && !s.switching && len(s.queue) == 0 && ch.binding.Key == c.binding.Key {
		s.dispatchLocked(ch, c)
		s.mu.Unlock()
		return
	}
	if len(s.queue) >= s.opt.Queue {
		s.mu.Unlock()
		c.fail(errBusyQueue)
		return
	}
	s.queue = append(s.queue, c)
	s.mu.Unlock()
	s.signal()
}

// cancel withdraws a client's call: a queued one leaves the queue, a sent
// one is cancelled at the child (whose late answer is then dropped).
func (s *Server) cancel(cl *client, id json.RawMessage, reason string) {
	s.mu.Lock()
	for i, c := range s.queue {
		if c.c == cl && bytes.Equal(c.id, id) {
			s.queue = append(s.queue[:i], s.queue[i+1:]...)
			s.mu.Unlock()
			cl.finish(id)
			s.signal()
			return
		}
	}
	var target *call
	if ch := s.child; ch != nil {
		for _, c := range ch.inflight {
			if c.c == cl && bytes.Equal(c.id, id) {
				target = c
			}
		}
	}
	if target == nil && s.prev != nil {
		for _, c := range s.prev.inflight {
			if c.c == cl && bytes.Equal(c.id, id) {
				target = c
			}
		}
	}
	if target != nil {
		// The native server does not answer a cancelled request, so the
		// call leaves the in-flight set now; a late answer is dropped.
		delete(target.ch.inflight, target.upID)
		if target.token != "" {
			delete(target.ch.tokens, target.token)
		}
		target.finished = true
		msg, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "method": "notifications/cancelled", "params": map[string]any{"requestId": target.upID, "reason": reason}})
		select {
		case target.ch.in <- append(msg, '\n'):
		default:
		}
	}
	s.mu.Unlock()
	if target != nil {
		cl.finish(id)
		s.signal()
	}
}

// meta returns what the server offers under b, starting the slot for b when
// nothing is known about it yet.
func (s *Server) metaFor(ctx context.Context, cl *client, b Binding) (*meta, *rpcError) {
	s.mu.Lock()
	m := s.meta[b.Key]
	s.mu.Unlock()
	if m != nil {
		return m, nil
	}
	c := &call{c: cl, binding: b, ready: make(chan *meta, 1)}
	s.submit(c)
	select {
	case m, ok := <-c.ready:
		if !ok || m == nil {
			return nil, errStart
		}
		return m, nil
	case <-ctx.Done():
		s.cancelWait(c)
		return nil, errShutdown
	}
}

func (s *Server) cancelWait(c *call) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, q := range s.queue {
		if q == c {
			s.queue = append(s.queue[:i], s.queue[i+1:]...)
			return
		}
	}
}

func withProgressToken(params json.RawMessage, token string) json.RawMessage {
	var p map[string]json.RawMessage
	if json.Unmarshal(params, &p) != nil || p == nil {
		return params
	}
	var m map[string]json.RawMessage
	if json.Unmarshal(p["_meta"], &m) != nil || m == nil {
		return params
	}
	m["progressToken"], _ = json.Marshal(token)
	p["_meta"], _ = json.Marshal(m)
	out, _ := json.Marshal(p)
	return out
}

func readLine(r *bufio.Reader, max int) ([]byte, error) {
	var line []byte
	for {
		chunk, prefix, err := r.ReadLine()
		if err != nil {
			return nil, err
		}
		if len(line)+len(chunk) > max {
			return nil, errors.New("msmcp: line too long")
		}
		line = append(line, chunk...)
		if !prefix {
			return line, nil
		}
	}
}
