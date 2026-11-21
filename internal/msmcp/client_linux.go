//go:build linux

package msmcp

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"net"
	"slices"
	"sync"
	"time"
)

// client is one relay connection: one Pi entry of one conversation.
type client struct {
	s     *Server
	conn  *net.UnixConn
	hello Hello
	area  map[string]bool
	ctx   context.Context

	out    chan []byte
	mu     sync.Mutex
	closed bool
	// outstanding are the ids of requests not yet answered; cancelled are
	// those the client withdrew, whose late answers are dropped.
	outstanding map[string]bool
	withdrawn   map[string]bool
}

// maxClientLine bounds one request from Pi; tool arguments are small.
const maxClientLine = 4 << 20

// supportedProtocols are MCP revisions whose tool messages this bridge
// carries unchanged. A client asking for one of them gets it back.
var supportedProtocols = []string{"2024-11-05", "2025-03-26", "2025-06-18"}

func (s *Server) serveConn(conn *net.UnixConn) {
	defer conn.Close()
	r := bufio.NewReaderSize(conn, 64<<10)
	_ = conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	h, err := readHello(r)
	if err != nil {
		return
	}
	_ = conn.SetReadDeadline(time.Time{})
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	cl := &client{s: s, conn: conn, hello: h, area: AreaTools(h.Area), ctx: ctx, out: make(chan []byte, 256), outstanding: map[string]bool{}, withdrawn: map[string]bool{}}
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return
	}
	s.clients[cl] = true
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		delete(s.clients, cl)
		s.mu.Unlock()
	}()
	writerDone := make(chan struct{})
	go func() {
		defer close(writerDone)
		for line := range cl.out {
			_ = conn.SetWriteDeadline(time.Now().Add(30 * time.Second))
			if _, err := conn.Write(append(line, '\n')); err != nil {
				conn.Close()
				for range cl.out {
				}
				return
			}
		}
	}()
	for {
		line, err := readLine(r, maxClientLine)
		if err != nil {
			break
		}
		cl.handle(line)
	}
	cancel()
	cl.close()
	<-writerDone
}

// close marks the client gone: its queued calls are pruned and its sent
// ones cancelled at the child.
func (c *client) close() {
	c.mu.Lock()
	ids := make([]string, 0, len(c.outstanding))
	for id := range c.outstanding {
		ids = append(ids, id)
	}
	c.closed = true
	c.mu.Unlock()
	for _, id := range ids {
		c.s.cancel(c, json.RawMessage(id), "client disconnected")
	}
	c.mu.Lock()
	close(c.out)
	c.mu.Unlock()
	c.s.signal()
}

func (c *client) gone() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.closed
}

// send queues a line for the client. A client that stops reading is
// dropped rather than allowed to hold the child's output.
func (c *client) send(line []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return
	}
	select {
	case c.out <- line:
	default:
		c.conn.Close()
	}
}

func (c *client) reply(id json.RawMessage, result any) {
	out, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": id, "result": result})
	c.send(out)
	c.finish(id)
}

func (c *client) errorReply(id json.RawMessage, e *rpcError) {
	if c.cancelled(id) {
		c.finish(id)
		return
	}
	out, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": id, "error": e})
	c.send(out)
	c.finish(id)
}

func (c *client) cancelled(id json.RawMessage) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.withdrawn[string(id)]
}

func (c *client) finish(id json.RawMessage) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.outstanding, string(id))
	delete(c.withdrawn, string(id))
}

// begin admits a request id, refusing a duplicate or one past the bound.
func (c *client) begin(id json.RawMessage) *rpcError {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.outstanding[string(id)] {
		return &rpcError{-32600, "duplicate request id"}
	}
	if len(c.outstanding) >= c.s.opt.PerClient {
		return errTooMany
	}
	c.outstanding[string(id)] = true
	return nil
}

func (c *client) handle(line []byte) {
	var msg struct {
		ID     json.RawMessage `json:"id"`
		Method string          `json:"method"`
		Params json.RawMessage `json:"params"`
	}
	if json.Unmarshal(line, &msg) != nil {
		out, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": nil, "error": rpcError{-32700, "parse error"}})
		c.send(out)
		return
	}
	if msg.Method == "" {
		return // a response to nothing this bridge asked
	}
	if len(msg.ID) == 0 || string(msg.ID) == "null" {
		if msg.Method == "notifications/cancelled" {
			var p struct {
				RequestID json.RawMessage `json:"requestId"`
			}
			if json.Unmarshal(msg.Params, &p) == nil && len(p.RequestID) > 0 {
				id := compact(p.RequestID)
				c.mu.Lock()
				known := c.outstanding[string(id)]
				if known {
					c.withdrawn[string(id)] = true
				}
				c.mu.Unlock()
				if known {
					c.s.cancel(c, id, "cancelled by the client")
				}
			}
		}
		return
	}
	id := compact(msg.ID)
	if e := c.begin(id); e != nil {
		out, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": id, "error": e})
		c.send(out)
		return
	}
	switch msg.Method {
	case "ping":
		c.reply(id, struct{}{})
	case "initialize", "tools/list", "tools/call":
		go c.request(id, msg.Method, msg.Params)
	default:
		c.errorReply(id, &rpcError{-32601, "method not found"})
	}
}

// request answers one initialize, listing or call. Each is resolved from
// the daemon's records afresh, so a removed account or changed level never
// answers from what was true when the connection opened.
func (c *client) request(id json.RawMessage, method string, params json.RawMessage) {
	if c.area == nil {
		c.errorReply(id, &rpcError{-32000, "Unknown Microsoft area."})
		return
	}
	b, err := c.s.resolve(c.hello.Account)
	if err != nil {
		c.errorReply(id, errAccount)
		return
	}
	m, e := c.s.metaFor(c.ctx, c, b)
	if e != nil {
		c.errorReply(id, e)
		return
	}
	switch method {
	case "initialize":
		var p struct {
			Protocol string `json:"protocolVersion"`
		}
		_ = json.Unmarshal(params, &p)
		protocol := m.protocol
		if slices.Contains(supportedProtocols, p.Protocol) {
			protocol = p.Protocol
		}
		result := map[string]any{"protocolVersion": protocol, "capabilities": map[string]any{"tools": map[string]any{}}, "serverInfo": m.serverInfo}
		if m.instructions != "" {
			result["instructions"] = m.instructions
		}
		c.reply(id, result)
	case "tools/list":
		c.reply(id, map[string]any{"tools": c.filter(m)})
	case "tools/call":
		var p struct {
			Name string          `json:"name"`
			Meta json.RawMessage `json:"_meta"`
		}
		if json.Unmarshal(params, &p) != nil || !c.area[p.Name] || !m.offers(p.Name) {
			c.errorReply(id, errUnknownTool)
			return
		}
		call := &call{c: c, id: id, method: method, params: params, binding: b}
		var meta struct {
			Token json.RawMessage `json:"progressToken"`
		}
		if len(p.Meta) > 0 && json.Unmarshal(p.Meta, &meta) == nil && len(meta.Token) > 0 && string(meta.Token) != "null" {
			call.progress = meta.Token
		}
		if c.cancelled(id) {
			c.finish(id)
			return
		}
		c.s.submit(call)
	}
}

// filter is the area's part of the listing: the server already left out
// what the account's level cannot run, and no area holds a sign-in tool.
func (c *client) filter(m *meta) []json.RawMessage {
	out := []json.RawMessage{}
	for i, name := range m.names {
		if c.area[name] {
			out = append(out, m.tools[i])
		}
	}
	return out
}

// compact is an id's canonical text, so a cancellation names the request
// whatever whitespace the client used. Numbers keep their digits.
func compact(raw json.RawMessage) json.RawMessage {
	var b bytes.Buffer
	if json.Compact(&b, raw) != nil {
		return raw
	}
	return b.Bytes()
}
