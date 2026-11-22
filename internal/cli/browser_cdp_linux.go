//go:build linux

package cli

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"time"

	"github.com/open-habitat/open-habitat/internal/wsframe"
)

// browserCDP is one bounded CLI operation, not a second browser owner. The
// existing host arbitrates control and marks targets when this client attaches.
// Calls are serial; only navigation lifecycle events need retaining between replies.
type browserCDP struct {
	conn    net.Conn
	reader  *bufio.Reader
	id      int
	session string
	loads   map[string]bool
	loaders map[string]string
}

var errBrowserCDPBusy = errors.New("another browser client is connected or disconnecting")

func dialBrowserCDP(ctx context.Context, socket, path string) (*browserCDP, error) {
	conn, err := (&net.Dialer{}).DialContext(ctx, "unix", socket)
	if err != nil {
		return nil, err
	}
	ok := false
	defer func() {
		if !ok {
			conn.Close()
		}
	}()
	deadline, _ := ctx.Deadline()
	conn.SetDeadline(deadline)
	key, err := wsframe.NewKey()
	if err != nil {
		return nil, err
	}
	if _, err = fmt.Fprintf(conn, "GET %s HTTP/1.1\r\nHost: browser\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: %s\r\n\r\n", path, key); err != nil {
		return nil, err
	}
	reader := bufio.NewReader(conn)
	res, err := http.ReadResponse(reader, nil)
	if err != nil {
		return nil, err
	}
	if !wsframe.ValidResponse(res, key) {
		if res.StatusCode == http.StatusConflict {
			return nil, errBrowserCDPBusy
		}
		return nil, fmt.Errorf("browser connection refused (%d)", res.StatusCode)
	}
	ok = true
	return &browserCDP{conn: conn, reader: reader, loads: map[string]bool{}}, nil
}

func (c *browserCDP) next() (map[string]json.RawMessage, error) {
	var data []byte
	started := false
	for {
		f, err := wsframe.ReadFrame(c.reader, 8<<20, false)
		if err != nil {
			return nil, err
		}
		switch f.Op {
		case wsframe.OpPing:
			if _, err := c.conn.Write(wsframe.AppendFrame(nil, wsframe.OpPong, f.Payload, true)); err != nil {
				return nil, err
			}
			continue
		case wsframe.OpPong:
			continue
		case wsframe.OpClose:
			return nil, io.EOF
		case wsframe.OpText:
			if started {
				return nil, wsframe.ErrProtocol
			}
			started = true
		case wsframe.OpContinuation:
			if !started {
				return nil, wsframe.ErrProtocol
			}
		default:
			return nil, wsframe.ErrProtocol
		}
		if len(data)+len(f.Payload) > 8<<20 {
			return nil, wsframe.ErrProtocol
		}
		data = append(data, f.Payload...)
		if !f.Fin {
			continue
		}
		var m map[string]json.RawMessage
		if err := json.Unmarshal(data, &m); err != nil {
			return nil, err
		}
		var method, session string
		json.Unmarshal(m["method"], &method)
		json.Unmarshal(m["sessionId"], &session)
		if method == "Page.lifecycleEvent" && session == c.session {
			var p struct{ Name, LoaderID, FrameID string }
			json.Unmarshal(m["params"], &p)
			if p.Name == "load" && len(c.loads) < 256 {
				c.loads[p.FrameID+":"+p.LoaderID] = true
			}
			if p.Name == "init" && c.loaders != nil && (len(c.loaders) < 256 || c.loaders[p.FrameID] != "") {
				c.loaders[p.FrameID] = p.LoaderID
			}
		}
		return m, nil
	}
}

func (c *browserCDP) call(method string, params any, out any) error {
	c.id++
	b, err := json.Marshal(map[string]any{"id": c.id, "method": method, "params": params, "sessionId": c.session})
	if err != nil {
		return err
	}
	if _, err := c.conn.Write(wsframe.AppendFrame(nil, wsframe.OpText, b, true)); err != nil {
		return err
	}
	for {
		m, err := c.next()
		if err != nil {
			return err
		}
		var id int
		json.Unmarshal(m["id"], &id)
		if id != c.id {
			continue
		}
		if len(m["error"]) != 0 {
			return &browserCDPRejected{method: method}
		}
		if out == nil {
			return nil
		}
		return json.Unmarshal(m["result"], out)
	}
}

type browserCDPRejected struct{ method string }

func (e *browserCDPRejected) Error() string {
	return e.method + " refused; inspect the page before retrying"
}

func (c *browserCDP) evaluate(expression string) (json.RawMessage, error) {
	return c.evaluateGesture(expression, false)
}

func (c *browserCDP) evaluateGesture(expression string, gesture bool) (json.RawMessage, error) {
	var out struct {
		Result struct {
			Value json.RawMessage `json:"value"`
		} `json:"result"`
		Exception json.RawMessage `json:"exceptionDetails"`
	}
	err := c.call("Runtime.evaluate", map[string]any{"expression": expression, "awaitPromise": true, "returnByValue": true, "userGesture": gesture}, &out)
	if err != nil {
		return nil, err
	}
	if len(out.Exception) != 0 {
		return nil, fmt.Errorf("page script failed; inspect the page before retrying")
	}
	if len(out.Result.Value) == 0 {
		return json.RawMessage("null"), nil
	}
	return out.Result.Value, nil
}

// Wait on the document's load event, not a guessed sleep or network-idle
// heuristic (a signed-in application may keep connections open indefinitely).
func (c *browserCDP) loaded() error {
	_, err := c.evaluate(`new Promise(resolve => { if (document.readyState === 'complete') resolve(true); else window.addEventListener('load', () => resolve(true), {once:true}); })`)
	return err
}

func (c *browserCDP) navigate(url string) error {
	if err := c.call("Page.enable", map[string]any{}, nil); err != nil {
		return err
	}
	if err := c.call("Page.setLifecycleEventsEnabled", map[string]any{"enabled": true}, nil); err != nil {
		return err
	}
	c.loads = map[string]bool{}
	c.loaders = map[string]string{}
	var nav struct {
		FrameID, LoaderID, ErrorText string
		IsDownload                   bool
	}
	if err := c.call("Page.navigate", map[string]any{"url": url}, &nav); err != nil {
		return err
	}
	if nav.ErrorText != "" || nav.IsDownload {
		return fmt.Errorf("navigation did not load a document; use download for files")
	}
	if nav.LoaderID == "" {
		return c.loaded()
	}
	for {
		loader := nav.LoaderID
		if newest := c.loaders[nav.FrameID]; newest != "" {
			loader = newest
		}
		if c.loads[nav.FrameID+":"+loader] {
			return nil
		}
		if _, err := c.next(); err != nil {
			return err
		}
	}
}

const browserCommandTimeout = 30 * time.Second
