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

	"github.com/open-habitat/open-habitat/internal/browserhost"
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
	// Only the attached main frame matters when a click starts navigation.
	clickFrame   string
	clickLoading bool
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
		if session == c.session && c.clickFrame != "" {
			var p struct{ FrameID string }
			json.Unmarshal(m["params"], &p)
			if p.FrameID == c.clickFrame {
				switch method {
				case "Page.frameStartedLoading", "Page.frameRequestedNavigation":
					c.clickLoading = true
				case "Page.frameStoppedLoading", "Page.navigatedWithinDocument":
					c.clickLoading = false
				}
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
			var e struct {
				Message string `json:"message"`
			}
			_ = json.Unmarshal(m["error"], &e)
			if e.Message == browserhost.PersonTookControl {
				// The command waited while the person drove and was never
				// sent: the page may now be different.
				return &cliError{code: "browser_person_took_control", message: "the person took control during this command and it was not carried out; inspect the page before continuing", exit: 1}
			}
			if e.Message == browserhost.RevealedRefused || e.Message == browserhost.GuardFailed {
				return browserActionRefused(e.Message)
			}
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

// pageAction runs one of the host's page scripts. The agent has no
// JavaScript of its own in the page: the host refuses it, because a script
// could read what the person typed there.
func (c *browserCDP) pageAction(action, selector, value string) (json.RawMessage, error) {
	var out struct {
		Result struct {
			Value json.RawMessage `json:"value"`
		} `json:"result"`
		Exception json.RawMessage `json:"exceptionDetails"`
	}
	params := map[string]any{"action": action}
	if selector != "" {
		params["selector"] = selector
	}
	if value != "" {
		params["value"] = value
	}
	err := c.call(browserhost.PageActionMethod, params, &out)
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

// Wait on the document's load event (browserhost.PageLoaded).
func (c *browserCDP) loaded() error {
	_, err := c.pageAction(browserhost.PageLoaded, "", "")
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

// Subscribe before the gesture; subscribing afterwards can miss the entire
// navigation. A protocol round-trip drains events caused by the gesture before
// deciding whether there is a main-frame load to wait for. Later timer-driven
// navigations are not attributed to this command.
func (c *browserCDP) prepareClick() error {
	if err := c.call("Page.enable", map[string]any{}, nil); err != nil {
		return err
	}
	var tree struct {
		Tree struct{ Frame struct{ ID string } } `json:"frameTree"`
	}
	if err := c.call("Page.getFrameTree", map[string]any{}, &tree); err != nil {
		return err
	}
	c.clickFrame = tree.Tree.Frame.ID
	c.clickLoading = false
	return nil
}

func (c *browserCDP) settleClick() error {
	if err := c.call("Page.getFrameTree", map[string]any{}, nil); err != nil {
		return err
	}
	for c.clickLoading {
		if _, err := c.next(); err != nil {
			return err
		}
	}
	return c.loaded()
}

func (c *browserCDP) pageMetadata(result map[string]any) error {
	v, err := c.pageAction(browserhost.PageMetadata, "", "")
	if err != nil {
		return err
	}
	var page struct{ URL, Title string }
	if err := json.Unmarshal(v, &page); err != nil {
		return err
	}
	result["url"], result["title"] = page.URL, page.Title
	return nil
}

const browserCommandTimeout = 30 * time.Second
