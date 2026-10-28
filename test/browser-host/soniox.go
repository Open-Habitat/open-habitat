package main

import (
	"bufio"
	"crypto/tls"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/daemon"
	"github.com/Open-Habitat/open-habitat/internal/wsframe"
)

// sonioxFake is a synthetic Soniox on the host's own TLS origin: the
// temporary-key API the daemon calls and the real-time WebSocket the
// browser streams to. No real key or network is used. The browser case
// drives what Soniox "hears" through /fixture/soniox.
type sonioxFake struct {
	mu sync.Mutex
	// mint is the API's next answer: ok, rejected, limit or unavailable.
	mint string
	// refuse makes the next stream answer its start with error 401.
	refuse  bool
	issued  map[string]bool
	minted  int
	conns   map[*sonioxConn]bool
	configs []json.RawMessage
	// keepalives, audio bytes and ended streams as the fake saw them.
	keepalives, audio, ended int
	authHeader                string
	origin                    func() string
}

type sonioxConn struct {
	mu   sync.Mutex
	conn net.Conn
}

func (c *sonioxConn) send(op byte, payload []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	_ = c.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	_, _ = c.conn.Write(wsframe.AppendFrame(nil, op, payload, false))
}

func (c *sonioxConn) json(v any) {
	b, _ := json.Marshal(v)
	c.send(wsframe.OpText, b)
}

func newSonioxFake(origin func() string) *sonioxFake {
	return &sonioxFake{mint: "ok", issued: map[string]bool{}, conns: map[*sonioxConn]bool{}, origin: origin}
}

// endpoints is where the daemon's fixture constructor points every region.
func (f *sonioxFake) endpoints() daemon.SpeechEndpoints {
	base := f.origin()
	return daemon.SpeechEndpoints{API: base + "/fixture/soniox", WebSocket: "wss://" + strings.TrimPrefix(base, "https://") + "/fixture/soniox/ws"}
}

// client trusts the host's ephemeral certificate, as only the fixture may.
func (f *sonioxFake) client() *http.Client {
	return &http.Client{Timeout: 10 * time.Second, Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
}

// serve handles /fixture/soniox/… : the API, the stream and the control.
func (f *sonioxFake) serve(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/fixture/soniox/v1/auth/temporary-api-key":
		f.mintKey(w, r)
	case "/fixture/soniox/ws":
		f.stream(w, r)
	case "/fixture/soniox":
		f.control(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (f *sonioxFake) mintKey(w http.ResponseWriter, r *http.Request) {
	var body struct {
		UsageType          string `json:"usage_type"`
		ExpiresIn          int    `json:"expires_in_seconds"`
		SingleUse          bool   `json:"single_use"`
		MaxSessionDuration int    `json:"max_session_duration_seconds"`
	}
	if r.Method != http.MethodPost || json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&body) != nil || body.UsageType != "transcribe_websocket" || !body.SingleUse || body.MaxSessionDuration != 600 || body.ExpiresIn != 60 {
		http.Error(w, `{"error_type":"invalid_request"}`, 400)
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.authHeader = r.Header.Get("Authorization")
	switch f.mint {
	case "rejected":
		http.Error(w, `{"error_type":"unauthenticated","message":"synthetic detail"}`, 401)
		return
	case "limit":
		http.Error(w, `{"error_type":"rate_limited"}`, 429)
		return
	case "unavailable":
		http.Error(w, `{"error_type":"internal"}`, 503)
		return
	}
	f.minted++
	key := "snx_temp_fixture" + strconv.Itoa(f.minted)
	f.issued[key] = false
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"api_key": key, "expires_at": time.Now().Add(time.Minute).UTC().Format(time.RFC3339Nano)})
}

func (f *sonioxFake) stream(w http.ResponseWriter, r *http.Request) {
	protocols := strings.Split(r.Header.Get("Sec-WebSocket-Protocol"), ",")
	if !wsframe.IsUpgrade(r) || len(protocols) != 2 || strings.TrimSpace(protocols[0]) != "soniox-api-key" {
		http.Error(w, "bad handshake", 400)
		return
	}
	key := strings.TrimSpace(protocols[1])
	hj, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, "no hijack", 500)
		return
	}
	conn, rw, err := hj.Hijack()
	if err != nil {
		return
	}
	defer conn.Close()
	accept := wsframe.SwitchingProtocols(r.Header.Get("Sec-WebSocket-Key"))
	accept = append(accept[:len(accept)-2], []byte("Sec-WebSocket-Protocol: soniox-api-key\r\n\r\n")...)
	if _, err = conn.Write(accept); err != nil {
		return
	}
	c := &sonioxConn{conn: conn}
	reader := bufio.NewReader(rw)
	first, err := wsframe.ReadFrame(reader, 1<<16, true)
	if err != nil || first.Op != wsframe.OpText {
		return
	}
	f.mu.Lock()
	used, known := f.issued[key]
	f.issued[key] = true
	refuse := f.refuse || !known || used
	f.refuse = false
	f.configs = append(f.configs, json.RawMessage(first.Payload))
	if !refuse {
		f.conns[c] = true
	}
	f.mu.Unlock()
	if refuse {
		// A single-use key works once; Soniox answers with an error frame.
		c.json(map[string]any{"error_code": 401, "error_message": "Invalid or expired temporary API key"})
		c.send(wsframe.OpClose, wsframe.ClosePayload(1000, ""))
		return
	}
	defer func() {
		f.mu.Lock()
		delete(f.conns, c)
		f.mu.Unlock()
	}()
	c.json(map[string]any{"tokens": []any{}, "final_audio_proc_ms": 0, "total_audio_proc_ms": 0})
	for {
		frame, err := wsframe.ReadFrame(reader, 1<<20, true)
		if err != nil {
			return
		}
		switch frame.Op {
		case wsframe.OpBinary:
			f.mu.Lock()
			f.audio += len(frame.Payload)
			f.mu.Unlock()
		case wsframe.OpText:
			if len(frame.Payload) == 0 {
				// End of audio: what is left is final, then finished.
				f.mu.Lock()
				f.ended++
				f.mu.Unlock()
				c.json(map[string]any{"tokens": []any{}, "finished": true})
				c.send(wsframe.OpClose, wsframe.ClosePayload(1000, ""))
				return
			}
			var m struct {
				Type string `json:"type"`
			}
			if json.Unmarshal(frame.Payload, &m) == nil && m.Type == "keepalive" {
				f.mu.Lock()
				f.keepalives++
				f.mu.Unlock()
			}
		case wsframe.OpClose:
			return
		case wsframe.OpPing:
			c.send(wsframe.OpPong, frame.Payload)
		}
	}
}

// control serves /fixture/soniox?action=…: mint=<answer>, refuse, say
// (a JSON body of tokens sent to every open stream), drop (close every
// open stream at once) and state.
func (f *sonioxFake) control(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	switch q.Get("action") {
	case "mint":
		f.mu.Lock()
		f.mint = q.Get("value")
		f.mu.Unlock()
	case "refuse":
		f.mu.Lock()
		f.refuse = true
		f.mu.Unlock()
	case "say":
		var tokens []map[string]any
		if json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&tokens) != nil {
			http.Error(w, "tokens", 400)
			return
		}
		f.mu.Lock()
		conns := make([]*sonioxConn, 0, len(f.conns))
		for c := range f.conns {
			conns = append(conns, c)
		}
		f.mu.Unlock()
		for _, c := range conns {
			c.json(map[string]any{"tokens": tokens})
		}
	case "drop":
		f.mu.Lock()
		for c := range f.conns {
			_ = c.conn.Close()
			delete(f.conns, c)
		}
		f.mu.Unlock()
	case "state":
		f.mu.Lock()
		defer f.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"minted": f.minted, "open": len(f.conns), "configs": f.configs, "keepalives": f.keepalives, "audio": f.audio, "ended": f.ended, "authorization": f.authHeader})
		return
	default:
		http.Error(w, "unknown soniox fixture action", 400)
		return
	}
	w.WriteHeader(204)
}
