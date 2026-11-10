//go:build linux

package browserhost

import (
	"bufio"

	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/open-habitat/open-habitat/internal/wsframe"
)

// The browser host owns Chrome's one DevTools pipe and shares it between
// the person's agent and itself. Chrome cannot tell its clients apart on a
// pipe, so the host rewrites command ids, remembers which client attached
// which session and routes replies and events by that. The host's own use is
// narrow: it lists the windows and takes their pictures for the strip. It
// enables no domain, so the only events of its own are its attachments.
//
// One agent at a time drives the browser. When it leaves, the host undoes
// what a CDP client leaves behind in Chrome (its sessions and auto-attach),
// so the next client sees the same open pages instead of an empty list.
// When the person takes control, the agent's commands wait in the host until
// they give it back: the agent waits, as the person was promised.

var errAgentBusy = errors.New("another agent is using the browser")

// heldLimit bounds what an agent may send while the person has control.
const (
	heldMessages = 2000
	heldBytes    = 16 << 20
	agentQueue   = 8192
)

type agentConn struct {
	ws    *wsConn
	send  chan []byte
	gone  chan struct{}
	once  sync.Once
	mux   *cdpMux
	since time.Time
}

// hostOwner marks sessions and commands that are the host's own.
var hostOwner = &agentConn{}

type route struct {
	owner    *agentConn
	id       json.RawMessage
	method   string
	targetID string
	reply    chan cdpReply
	dropped  bool
}

type cdpReply struct {
	result json.RawMessage
	err    error
}

type click struct {
	x, y float64
	at   time.Time
}

type pointer struct {
	target string
	x, y   float64
	at     time.Time
	clicks []click
}

type windowRequest struct {
	target string
	text   string
	at     time.Time
}

type cdpMux struct {
	out   io.Writer
	outMu sync.Mutex
	// dispatchMu orders the agent's commands, their replay after the
	// person's control and an agent's cleanup as one sequence in the pipe.
	dispatchMu sync.Mutex
	log        *slog.Logger
	now        func() time.Time

	mu      sync.Mutex
	nextID  int64
	pending map[int64]*route
	owner   map[string]*agentConn
	parent  map[string]string
	target  map[string]string
	// page marks the sessions of page targets: only those are windows.
	page          map[string]bool
	hostSession   map[string]string
	hostAttaching map[string]int
	// ambiguous holds root attachment events for a target the host is
	// attaching to: until the host's own reply names its session, the event
	// may be the host's or the agent's (an auto-attach at the same moment).
	ambiguous map[string][][]byte
	// cleaning is closed when a departed agent's cleanup is in Chrome's
	// pipe; the next agent waits for it so its commands come after.
	cleaning   chan struct{}
	agent      *agentConn
	person     bool
	held       [][]byte
	heldSize   int
	pointer    pointer
	lastWindow string
	request    *windowRequest
	// activity is when an agent last left or the person last looked; an
	// attached agent is activity by itself.
	activity time.Time
	closed   bool
}

func newCDPMux(out io.Writer, log *slog.Logger, now func() time.Time) *cdpMux {
	return &cdpMux{out: out, log: log, now: now, pending: map[int64]*route{}, owner: map[string]*agentConn{},
		parent: map[string]string{}, target: map[string]string{}, page: map[string]bool{}, hostSession: map[string]string{}, hostAttaching: map[string]int{}, ambiguous: map[string][][]byte{}, activity: now()}
}

func (m *cdpMux) writeChrome(msg []byte) error {
	m.outMu.Lock()
	defer m.outMu.Unlock()
	if _, err := m.out.Write(append(msg, 0)); err != nil {
		return err
	}
	return nil
}

// readChrome routes Chrome's messages until the pipe ends.
func (m *cdpMux) readChrome(in io.Reader) error {
	r := bufio.NewReaderSize(in, 1<<20)
	for {
		msg, err := r.ReadBytes(0)
		if err != nil {
			m.shutdown()
			return err
		}
		m.fromChrome(msg[:len(msg)-1])
	}
}

func (m *cdpMux) shutdown() {
	m.mu.Lock()
	m.closed = true
	agent := m.agent
	pending := m.pending
	m.pending = map[int64]*route{}
	m.mu.Unlock()
	for _, r := range pending {
		if r.reply != nil {
			r.reply <- cdpReply{err: errors.New("browser closed")}
		}
	}
	if agent != nil {
		agent.disconnect(1001, "browser closed")
	}
}

// call sends one of the host's own commands and waits for its reply.
func (m *cdpMux) call(ctx context.Context, method string, params any, session string) (json.RawMessage, error) {
	p, _ := json.Marshal(params)
	reply := make(chan cdpReply, 1)
	m.mu.Lock()
	if m.closed {
		m.mu.Unlock()
		return nil, errors.New("browser closed")
	}
	m.nextID++
	id := m.nextID
	r := &route{owner: hostOwner, method: method, reply: reply}
	if method == "Target.attachToTarget" {
		var t struct {
			TargetID string `json:"targetId"`
		}
		_ = json.Unmarshal(p, &t)
		r.targetID = t.TargetID
		m.hostAttaching[t.TargetID]++
	}
	m.pending[id] = r
	m.mu.Unlock()
	msg := map[string]any{"id": id, "method": method, "params": json.RawMessage(p)}
	if session != "" {
		msg["sessionId"] = session
	}
	b, _ := json.Marshal(msg)
	if err := m.writeChrome(b); err != nil {
		return nil, err
	}
	select {
	case rep := <-reply:
		return rep.result, rep.err
	case <-ctx.Done():
		m.mu.Lock()
		if r, ok := m.pending[id]; ok {
			r.dropped = true
		}
		m.mu.Unlock()
		return nil, ctx.Err()
	}
}

// send writes a host command whose answer nobody reads, in the caller's
// order.
func (m *cdpMux) send(method string, params any) {
	p, _ := json.Marshal(params)
	m.mu.Lock()
	if m.closed {
		m.mu.Unlock()
		return
	}
	m.nextID++
	id := m.nextID
	m.pending[id] = &route{owner: hostOwner, method: method}
	m.mu.Unlock()
	b, _ := json.Marshal(map[string]any{"id": id, "method": method, "params": json.RawMessage(p)})
	_ = m.writeChrome(b)
}

// fire sends a host command whose answer nobody needs.
func (m *cdpMux) fire(method string, params any, session string) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, _ = m.call(ctx, method, params, session)
	}()
}

type chromeMessage struct {
	ID        *int64          `json:"id"`
	Method    string          `json:"method"`
	SessionID string          `json:"sessionId"`
	Params    json.RawMessage `json:"params"`
	Result    json.RawMessage `json:"result"`
	Error     json.RawMessage `json:"error"`
}

func (m *cdpMux) fromChrome(msg []byte) {
	var head chromeMessage
	if json.Unmarshal(msg, &head) != nil {
		return
	}
	m.mu.Lock()
	if head.ID != nil {
		r := m.pending[*head.ID]
		delete(m.pending, *head.ID)
		if r == nil {
			m.mu.Unlock()
			return
		}
		if r.method == "Target.attachToTarget" {
			var res struct {
				SessionID string `json:"sessionId"`
			}
			_ = json.Unmarshal(head.Result, &res)
			switch {
			case res.SessionID == "":
			case r.owner == hostOwner:
				// Recorded even when the caller gave up waiting: the session
				// is the host's either way and must not reach the agent.
				m.owner[res.SessionID] = hostOwner
				m.target[res.SessionID] = r.targetID
				m.hostSession[r.targetID] = res.SessionID
			case r.dropped || r.owner != m.agent:
				m.fireLocked("Target.detachFromTarget", map[string]string{"sessionId": res.SessionID})
			default:
				m.owner[res.SessionID] = r.owner
				m.target[res.SessionID] = r.targetID
			}
			if r.owner == hostOwner {
				if m.hostAttaching[r.targetID]--; m.hostAttaching[r.targetID] <= 0 {
					delete(m.hostAttaching, r.targetID)
				}
				// The reply names the host's session: every other event held
				// for this target was the agent's.
				held := m.ambiguous[r.targetID]
				delete(m.ambiguous, r.targetID)
				for _, ev := range held {
					m.attachedLocked(ev)
				}
			}
		}
		if r.owner == hostOwner {
			m.mu.Unlock()
			if r.reply != nil {
				if len(head.Error) > 0 {
					r.reply <- cdpReply{err: errors.New("cdp error")}
				} else {
					r.reply <- cdpReply{result: head.Result}
				}
			}
			return
		}
		agent := m.agent
		m.mu.Unlock()
		if r.dropped || r.owner != agent {
			return
		}
		agent.deliver(rewriteID(msg, r.id))
		return
	}
	var to *agentConn
	switch head.Method {
	case "Target.attachedToTarget":
		var p struct {
			TargetInfo struct {
				TargetID string `json:"targetId"`
			} `json:"targetInfo"`
		}
		_ = json.Unmarshal(head.Params, &p)
		if head.SessionID == "" && m.hostAttaching[p.TargetInfo.TargetID] > 0 {
			m.ambiguous[p.TargetInfo.TargetID] = append(m.ambiguous[p.TargetInfo.TargetID], msg)
			m.mu.Unlock()
			return
		}
		m.attachedLocked(msg)
		m.mu.Unlock()
		return
	case "Target.detachedFromTarget":
		var p struct {
			SessionID string `json:"sessionId"`
		}
		_ = json.Unmarshal(head.Params, &p)
		own := m.owner[p.SessionID]
		if own == hostOwner {
			if t := m.target[p.SessionID]; m.hostSession[t] == p.SessionID {
				delete(m.hostSession, t)
			}
		}
		delete(m.owner, p.SessionID)
		delete(m.target, p.SessionID)
		delete(m.parent, p.SessionID)
		delete(m.page, p.SessionID)
		if head.SessionID != "" {
			own = m.owner[head.SessionID]
		}
		to = own
	case "Target.targetDestroyed":
		var p struct {
			TargetID string `json:"targetId"`
		}
		_ = json.Unmarshal(head.Params, &p)
		if m.request != nil && m.request.target == p.TargetID {
			m.request = nil
		}
		to = m.agent
		if head.SessionID != "" {
			to = m.owner[head.SessionID]
		}
	default:
		if head.SessionID != "" {
			to = m.owner[head.SessionID]
		} else {
			to = m.agent
		}
	}
	agent := m.agent
	m.mu.Unlock()
	if to == nil || to == hostOwner || to != agent {
		return
	}
	agent.deliver(msg)
}

// attachedLocked records who owns a new session and forwards the event to
// the agent when it is the agent's. A session already known (the host's,
// from its reply) keeps its owner; a child session belongs to its parent's
// owner; any other root attachment is the agent's.
func (m *cdpMux) attachedLocked(msg []byte) {
	var head struct {
		SessionID string `json:"sessionId"`
		Params    struct {
			SessionID  string `json:"sessionId"`
			TargetInfo struct {
				TargetID string `json:"targetId"`
				Type     string `json:"type"`
			} `json:"targetInfo"`
		} `json:"params"`
	}
	if json.Unmarshal(msg, &head) != nil {
		return
	}
	p := head.Params
	own, known := m.owner[p.SessionID]
	switch {
	case known:
	case head.SessionID != "":
		own = m.owner[head.SessionID]
	default:
		own = m.agent
	}
	if own == nil {
		// Nobody asked for it (its client has left): let it go.
		m.fireLocked("Target.detachFromTarget", map[string]string{"sessionId": p.SessionID})
		return
	}
	m.owner[p.SessionID] = own
	m.target[p.SessionID] = p.TargetInfo.TargetID
	if p.TargetInfo.Type == "page" {
		m.page[p.SessionID] = true
	}
	if head.SessionID != "" {
		m.parent[p.SessionID] = head.SessionID
	}
	if own == hostOwner {
		m.hostSession[p.TargetInfo.TargetID] = p.SessionID
		return
	}
	if own == m.agent {
		own.deliver(msg)
	}
}

// fireLocked sends a host command nobody waits for, from under m.mu.
func (m *cdpMux) fireLocked(method string, params any) {
	go m.fire(method, params, "")
}

// rewriteID replaces a message's id with the agent's own.
func rewriteID(msg []byte, id json.RawMessage) []byte {
	var m map[string]json.RawMessage
	if json.Unmarshal(msg, &m) != nil {
		return msg
	}
	m["id"] = id
	b, _ := json.Marshal(m)
	return b
}

// connect makes ws the agent. A second agent is refused while one drives.
func (m *cdpMux) connect(ws *wsConn) (*agentConn, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	// The previous agent's cleanup goes into the pipe first.
	for m.cleaning != nil {
		wait := m.cleaning
		m.mu.Unlock()
		select {
		case <-wait:
		case <-time.After(5 * time.Second):
			m.mu.Lock()
			return nil, errAgentBusy
		}
		m.mu.Lock()
	}
	if m.closed {
		return nil, errors.New("browser closed")
	}
	if m.agent != nil {
		return nil, errAgentBusy
	}
	a := &agentConn{ws: ws, send: make(chan []byte, agentQueue), gone: make(chan struct{}), mux: m, since: m.now()}
	m.agent = a
	go a.writer()
	return a, nil
}

func (a *agentConn) deliver(msg []byte) {
	select {
	case a.send <- msg:
	case <-a.gone:
	default:
		// An agent that does not read its events would hold the whole
		// browser's traffic in memory.
		go a.disconnect(1008, "agent too slow")
	}
}

func (a *agentConn) writer() {
	for {
		select {
		case msg := <-a.send:
			if a.ws.write(wsframe.OpText, msg) != nil {
				go a.disconnect(1011, "write failed")
				return
			}
		case <-a.gone:
			return
		}
	}
}

func (a *agentConn) disconnect(code uint16, reason string) {
	a.once.Do(func() {
		close(a.gone)
		a.ws.close(code, reason)
		a.mux.leave(a)
	})
}

// fromAgent forwards one command, or holds it while the person has control.
func (m *cdpMux) fromAgent(a *agentConn, msg []byte) error {
	var fields map[string]json.RawMessage
	if json.Unmarshal(msg, &fields) != nil {
		return errors.New("invalid message")
	}
	if _, ok := fields["id"]; !ok {
		return errors.New("invalid message")
	}
	m.dispatchMu.Lock()
	defer m.dispatchMu.Unlock()
	m.mu.Lock()
	if m.agent != a {
		m.mu.Unlock()
		return io.EOF
	}
	if m.person {
		if len(m.held) >= heldMessages || m.heldSize+len(msg) > heldBytes {
			m.mu.Unlock()
			return errors.New("too much held")
		}
		m.held = append(m.held, msg)
		m.heldSize += len(msg)
		m.mu.Unlock()
		return nil
	}
	out := m.forwardLocked(a, fields)
	m.mu.Unlock()
	return m.writeChrome(out)
}

func (m *cdpMux) forwardLocked(a *agentConn, fields map[string]json.RawMessage) []byte {
	m.nextID++
	id := m.nextID
	var method, session string
	_ = json.Unmarshal(fields["method"], &method)
	_ = json.Unmarshal(fields["sessionId"], &session)
	r := &route{owner: a, id: fields["id"], method: method}
	if method == "Target.attachToTarget" {
		var t struct {
			TargetID string `json:"targetId"`
		}
		_ = json.Unmarshal(fields["params"], &t)
		r.targetID = t.TargetID
	}
	m.pending[id] = r
	if t := m.target[session]; t != "" && m.page[session] {
		m.lastWindow = t
		if method == "Input.dispatchMouseEvent" {
			m.observePointer(t, fields["params"])
		}
	}
	fields["id"], _ = json.Marshal(id)
	b, _ := json.Marshal(fields)
	return b
}

// observePointer keeps the agent's last pointer position and recent presses
// so the person sees where the agent points and clicks. CDP coordinates are
// CSS pixels of the page's viewport.
func (m *cdpMux) observePointer(target string, params json.RawMessage) {
	var p struct {
		Type string  `json:"type"`
		X    float64 `json:"x"`
		Y    float64 `json:"y"`
	}
	if json.Unmarshal(params, &p) != nil || p.X < 0 || p.Y < 0 || p.X > 1e5 || p.Y > 1e5 {
		return
	}
	now := m.now()
	if m.pointer.target != target {
		m.pointer.clicks = nil
	}
	m.pointer.target, m.pointer.x, m.pointer.y, m.pointer.at = target, p.X, p.Y, now
	if p.Type == "mousePressed" {
		m.pointer.clicks = append(m.pointer.clicks, click{p.X, p.Y, now})
		if len(m.pointer.clicks) > 5 {
			m.pointer.clicks = m.pointer.clicks[len(m.pointer.clicks)-5:]
		}
	}
}

// leave forgets an agent and undoes the state it left in Chrome.
func (m *cdpMux) leave(a *agentConn) {
	m.dispatchMu.Lock()
	defer m.dispatchMu.Unlock()
	m.mu.Lock()
	if m.agent != a {
		m.mu.Unlock()
		return
	}
	m.agent = nil
	m.held, m.heldSize = nil, 0
	m.activity = m.now()
	var sessions []string
	for s, own := range m.owner {
		if own == a {
			sessions = append(sessions, s)
		}
	}
	for _, s := range sessions {
		delete(m.owner, s)
		delete(m.target, s)
		delete(m.parent, s)
		delete(m.page, s)
	}
	for _, r := range m.pending {
		if r.owner == a {
			r.dropped = true
		}
	}
	closed := m.closed
	cleaning := make(chan struct{})
	if !closed {
		m.cleaning = cleaning
	}
	m.mu.Unlock()
	if closed {
		return
	}
	// Written in order before the next agent may send anything; their
	// answers are not needed.
	for _, s := range sessions {
		m.send("Target.detachFromTarget", map[string]string{"sessionId": s})
	}
	m.send("Target.setAutoAttach", map[string]any{"autoAttach": false, "waitForDebuggerOnStart": false, "flatten": true})
	m.send("Target.setDiscoverTargets", map[string]any{"discover": false})
	m.send("Browser.setDownloadBehavior", map[string]any{"behavior": "default"})
	m.mu.Lock()
	m.cleaning = nil
	close(cleaning)
	m.mu.Unlock()
	m.log.Info("browser_agent", "outcome", "closed", "reason", "agent_left", "sessions", len(sessions))
}

// setControl gives the browser to the person or back to the agent. Giving
// it back sends what the agent asked meanwhile and clears the request the
// person answered.
func (m *cdpMux) setControl(person bool) {
	m.dispatchMu.Lock()
	defer m.dispatchMu.Unlock()
	m.mu.Lock()
	if m.person == person {
		m.mu.Unlock()
		return
	}
	m.person = person
	m.activity = m.now()
	var out [][]byte
	if !person {
		m.request = nil
		if a := m.agent; a != nil {
			for _, msg := range m.held {
				var fields map[string]json.RawMessage
				if json.Unmarshal(msg, &fields) == nil {
					out = append(out, m.forwardLocked(a, fields))
				}
			}
		}
		m.held, m.heldSize = nil, 0
	}
	m.mu.Unlock()
	for _, msg := range out {
		if m.writeChrome(msg) != nil {
			return
		}
	}
}

func (m *cdpMux) touch() {
	m.mu.Lock()
	m.activity = m.now()
	m.mu.Unlock()
}

// idleSince is when the browser was last in use, or zero while an agent is
// attached.
func (m *cdpMux) idleSince() time.Time {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.agent != nil {
		return time.Time{}
	}
	return m.activity
}

// setRequest records that a window needs the person. Text is the agent's
// own words and stays data: the browser shows it as text.
func (m *cdpMux) setRequest(target, text string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if target == "" {
		target = m.lastWindow
	}
	m.request = &windowRequest{target: target, text: text, at: m.now()}
}

func (m *cdpMux) clearRequest() {
	m.mu.Lock()
	m.request = nil
	m.mu.Unlock()
}

// cleanText keeps a request short, printable and on one line.
func cleanText(s string) (string, bool) {
	if !utf8.ValidString(s) {
		return "", false
	}
	var b strings.Builder
	n := 0
	for _, r := range s {
		if r == '\n' || r == '\t' || r == '\r' {
			r = ' '
		}
		if r < 0x20 || r == 0x7f || (r >= 0x80 && r < 0xa0) || r == 0x2028 || r == 0x2029 || (r >= 0x202a && r <= 0x202e) || (r >= 0x2066 && r <= 0x2069) {
			continue
		}
		b.WriteRune(r)
		n++
	}
	out := strings.Join(strings.Fields(b.String()), " ")
	if out == "" || n > 300 {
		return "", false
	}
	return out, true
}

// hostSessionFor attaches the host to a page once and keeps the session.
func (m *cdpMux) hostSessionFor(ctx context.Context, target string) (string, error) {
	m.mu.Lock()
	s := m.hostSession[target]
	m.mu.Unlock()
	if s != "" {
		return s, nil
	}
	res, err := m.call(ctx, "Target.attachToTarget", map[string]any{"targetId": target, "flatten": true}, "")
	if err != nil {
		return "", err
	}
	var r struct {
		SessionID string `json:"sessionId"`
	}
	if json.Unmarshal(res, &r) != nil || r.SessionID == "" {
		return "", errors.New("no session")
	}
	return r.SessionID, nil
}
