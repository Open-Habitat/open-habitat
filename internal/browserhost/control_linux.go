//go:build linux

package browserhost

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"time"
)

// The control socket's routes. Only the daemon (and anything else running
// as the same person) reaches them.
const (
	StatusPath  = "/status"
	WindowPath  = "/window"
	ControlPath = "/control"
	RequestPath = "/request"
	ViewerPath  = "/viewer"
	StopPath    = "/stop"
)

// TargetPattern is a Chrome target id as Chrome prints it.
var TargetPattern = regexp.MustCompile(`^[0-9A-F]{32}$`)

// Status is what the control socket says about the browser.
type Status struct {
	Control string   `json:"control"`
	Agent   bool     `json:"agent"`
	Windows []Window `json:"windows"`
	Pointer *Pointer `json:"pointer,omitempty"`
	Request *Request `json:"request,omitempty"`
}

// Window is one page target.
type Window struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Origin string `json:"origin"`
	// Agent marks the window the agent last acted in.
	Agent bool `json:"agent"`
}

// Pointer is the agent's pointer in a window, in fractions of its viewport.
type Pointer struct {
	Window string  `json:"window"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	AgeMS  int64   `json:"age_ms"`
	Clicks []Click `json:"clicks"`
}

// Click is one recent press.
type Click struct {
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	AgeMS int64   `json:"age_ms"`
}

// Request is a window's need of the person, in the agent's words.
type Request struct {
	Window string `json:"window"`
	Text   string `json:"text"`
	AgeMS  int64  `json:"age_ms"`
}

type window struct {
	id, title, url string
}

const (
	listFresh  = 500 * time.Millisecond
	imageFresh = 900 * time.Millisecond
	clickShown = 4 * time.Second
	pointShown = 15 * time.Second
	maxWindows = 24
	// unpaintedRetry spaces the pictures of a tab Chrome does not paint.
	unpaintedRetry = 10 * time.Second
)

func (h *host) list(ctx context.Context) []window {
	h.mu.Lock()
	if time.Since(h.listed) < listFresh {
		w := h.windows
		h.mu.Unlock()
		return w
	}
	h.mu.Unlock()
	res, err := h.mux.call(ctx, "Target.getTargets", map[string]any{}, "")
	if err != nil {
		h.mu.Lock()
		defer h.mu.Unlock()
		return h.windows
	}
	var r struct {
		TargetInfos []struct {
			TargetID string `json:"targetId"`
			Type     string `json:"type"`
			Title    string `json:"title"`
			URL      string `json:"url"`
		} `json:"targetInfos"`
	}
	_ = json.Unmarshal(res, &r)
	var out []window
	for _, t := range r.TargetInfos {
		if t.Type == "page" && TargetPattern.MatchString(t.TargetID) && len(out) < maxWindows {
			out = append(out, window{t.TargetID, t.Title, t.URL})
		}
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	h.windows, h.listed = out, time.Now()
	for id := range h.images {
		if !hasWindow(out, id) {
			delete(h.images, id)
			delete(h.metrics, id)
			delete(h.failed, id)
		}
	}
	return out
}

func hasWindow(ws []window, id string) bool {
	for _, w := range ws {
		if w.id == id {
			return true
		}
	}
	return false
}

// origin shows where a window is without its path or query, which can
// carry tokens.
func origin(raw string) string {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || (u.Scheme != "https" && u.Scheme != "http") {
		return ""
	}
	return u.Scheme + "://" + u.Host
}

func clip(s string, n int) string {
	r := []rune(s)
	if len(r) > n {
		return string(r[:n-1]) + "…"
	}
	return s
}

func (h *host) status(ctx context.Context) Status {
	windows := h.list(ctx)
	m := h.mux
	m.mu.Lock()
	st := Status{Control: "agent", Agent: m.agent != nil, Windows: []Window{}}
	if m.person {
		st.Control = "person"
	}
	now := m.now()
	for _, w := range windows {
		st.Windows = append(st.Windows, Window{ID: w.id, Title: clip(w.title, 200), Origin: clip(origin(w.url), 200), Agent: w.id == m.lastWindow})
	}
	if r := m.request; r != nil && hasWindow(windows, r.target) {
		st.Request = &Request{Window: r.target, Text: r.text, AgeMS: now.Sub(r.at).Milliseconds()}
	}
	p := m.pointer
	m.mu.Unlock()
	h.mu.Lock()
	vp, ok := h.metrics[p.target]
	h.mu.Unlock()
	if p.target != "" && ok && vp.w > 0 && vp.h > 0 && now.Sub(p.at) < pointShown && hasWindow(windows, p.target) {
		ptr := &Pointer{Window: p.target, X: frac(p.x, vp.w), Y: frac(p.y, vp.h), AgeMS: now.Sub(p.at).Milliseconds(), Clicks: []Click{}}
		for _, c := range p.clicks {
			if age := now.Sub(c.at); age < clickShown {
				ptr.Clicks = append(ptr.Clicks, Click{X: frac(c.x, vp.w), Y: frac(c.y, vp.h), AgeMS: age.Milliseconds()})
			}
		}
		st.Pointer = ptr
	}
	return st
}

func frac(v, max float64) float64 {
	f := v / max
	if f < 0 {
		return 0
	}
	if f > 1 {
		return 1
	}
	return float64(int(f*1000)) / 1000
}

// picture is a small JPEG of one window, taken through the host's own
// session at half size. A window Chrome does not paint (a background tab)
// keeps its last picture.
func (h *host) picture(ctx context.Context, id string) ([]byte, bool) {
	if !hasWindow(h.list(ctx), id) {
		return nil, false
	}
	h.shot.Lock()
	defer h.shot.Unlock()
	h.mu.Lock()
	if img := h.images[id]; img != nil && time.Since(img.at) < imageFresh {
		h.mu.Unlock()
		return img.jpeg, true
	}
	h.mu.Unlock()
	// A tab behind another never paints: after one failed picture, ask it
	// again only now and then.
	h.mu.Lock()
	failed := h.failed[id]
	h.mu.Unlock()
	if time.Since(failed) < unpaintedRetry {
		h.mu.Lock()
		defer h.mu.Unlock()
		if img := h.images[id]; img != nil {
			return img.jpeg, true
		}
		return nil, false
	}
	cctx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
	defer cancel()
	last := func() ([]byte, bool) {
		h.mu.Lock()
		defer h.mu.Unlock()
		if img := h.images[id]; img != nil {
			return img.jpeg, true
		}
		return nil, false
	}
	session, err := h.mux.hostSessionFor(cctx, id)
	if err != nil {
		return last()
	}
	var vp viewport
	if res, err := h.mux.call(cctx, "Page.getLayoutMetrics", map[string]any{}, session); err == nil {
		var lm struct {
			CSSLayoutViewport struct {
				ClientWidth  float64 `json:"clientWidth"`
				ClientHeight float64 `json:"clientHeight"`
			} `json:"cssLayoutViewport"`
		}
		if json.Unmarshal(res, &lm) == nil {
			vp = viewport{lm.CSSLayoutViewport.ClientWidth, lm.CSSLayoutViewport.ClientHeight}
		}
	}
	params := map[string]any{"format": "jpeg", "quality": 55, "optimizeForSpeed": true}
	if vp.w > 0 && vp.h > 0 {
		params["clip"] = map[string]any{"x": 0, "y": 0, "width": vp.w, "height": vp.h, "scale": 0.5}
	}
	res, err := h.mux.call(cctx, "Page.captureScreenshot", params, session)
	if err != nil {
		h.mu.Lock()
		h.failed[id] = time.Now()
		h.mu.Unlock()
		return last()
	}
	var shot struct {
		Data string `json:"data"`
	}
	data, derr := []byte(nil), json.Unmarshal(res, &shot)
	if derr == nil {
		data, derr = base64.StdEncoding.DecodeString(shot.Data)
	}
	if derr != nil || len(data) < 4 || !bytes.HasPrefix(data, []byte{0xff, 0xd8}) {
		return last()
	}
	h.mu.Lock()
	h.images[id] = &image{jpeg: data, at: time.Now()}
	delete(h.failed, id)
	if vp.w > 0 {
		h.metrics[id] = vp
	}
	h.mu.Unlock()
	return data, true
}

func controlJSON(w http.ResponseWriter, status int, v any) {
	b, _ := json.Marshal(v)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Length", strconv.Itoa(len(b)))
	w.WriteHeader(status)
	_, _ = w.Write(b)
}

func decodeExact(r *http.Request, v any) bool {
	if r.Header.Get("Content-Type") != "application/json" {
		return false
	}
	dec := json.NewDecoder(io.LimitReader(r.Body, 4096))
	dec.DisallowUnknownFields()
	return dec.Decode(v) == nil && dec.Decode(new(any)) == io.EOF
}

func (h *host) controlHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == StatusPath && r.Method == http.MethodGet:
			controlJSON(w, 200, h.status(r.Context()))
		case r.URL.Path == WindowPath && r.Method == http.MethodGet:
			id := r.URL.Query().Get("id")
			if !TargetPattern.MatchString(id) {
				controlJSON(w, 400, map[string]string{"error": "invalid_request"})
				return
			}
			img, ok := h.picture(r.Context(), id)
			if !ok {
				controlJSON(w, 404, map[string]string{"error": "window_unavailable"})
				return
			}
			w.Header().Set("Content-Type", "image/jpeg")
			w.Header().Set("Content-Length", strconv.Itoa(len(img)))
			_, _ = w.Write(img)
		case r.URL.Path == ControlPath && r.Method == http.MethodPost:
			var body struct {
				Control string `json:"control"`
				Window  string `json:"window,omitempty"`
			}
			if !decodeExact(r, &body) || (body.Control != "person" && body.Control != "agent") || (body.Window != "" && (body.Control != "person" || !TargetPattern.MatchString(body.Window))) {
				controlJSON(w, 400, map[string]string{"error": "invalid_request"})
				return
			}
			h.mux.setControl(body.Control == "person")
			// Taking control for one window brings it to the front, so the
			// person's view shows what needs them.
			if body.Window != "" && hasWindow(h.list(r.Context()), body.Window) {
				h.mux.fire("Target.activateTarget", map[string]string{"targetId": body.Window}, "")
			}
			h.log.Info("browser_control", "outcome", "accepted", "reason", body.Control)
			controlJSON(w, 200, h.status(r.Context()))
		case r.URL.Path == RequestPath && r.Method == http.MethodPost:
			var body struct {
				Window string `json:"window,omitempty"`
				Text   string `json:"text,omitempty"`
				Clear  bool   `json:"clear,omitempty"`
			}
			if !decodeExact(r, &body) || (body.Window != "" && !TargetPattern.MatchString(body.Window)) {
				controlJSON(w, 400, map[string]string{"error": "invalid_request"})
				return
			}
			if body.Clear {
				if body.Text != "" || body.Window != "" {
					controlJSON(w, 400, map[string]string{"error": "invalid_request"})
					return
				}
				h.mux.clearRequest()
				controlJSON(w, 200, h.status(r.Context()))
				return
			}
			text, ok := cleanText(body.Text)
			if !ok {
				controlJSON(w, 400, map[string]string{"error": "invalid_request"})
				return
			}
			windows := h.list(r.Context())
			if body.Window != "" && !hasWindow(windows, body.Window) {
				controlJSON(w, 404, map[string]string{"error": "window_unavailable"})
				return
			}
			if body.Window == "" && len(windows) == 0 {
				controlJSON(w, 404, map[string]string{"error": "window_unavailable"})
				return
			}
			target := body.Window
			if target == "" {
				h.mux.mu.Lock()
				last := h.mux.lastWindow
				h.mux.mu.Unlock()
				if !hasWindow(windows, last) {
					last = windows[0].id
				}
				target = last
			}
			h.mux.setRequest(target, text)
			controlJSON(w, 200, h.status(r.Context()))
		case r.URL.Path == ViewerPath && r.Method == http.MethodPost:
			h.mux.touch()
			w.WriteHeader(http.StatusNoContent)
		case r.URL.Path == StopPath && r.Method == http.MethodPost:
			w.WriteHeader(http.StatusNoContent)
			h.stop()
		default:
			controlJSON(w, 400, map[string]string{"error": "invalid_request"})
		}
	})
}

// ControlClient dials a host's control socket.
func ControlClient(dir string) *http.Client {
	socket := dir + "/" + ControlSocket
	return &http.Client{Timeout: 8 * time.Second, Transport: &http.Transport{
		DisableKeepAlives: true,
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return (&net.Dialer{Timeout: 2 * time.Second}).DialContext(ctx, "unix", socket)
		},
	}}
}
