//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/browserhost"
	"github.com/open-habitat/open-habitat/internal/transport"
	"github.com/open-habitat/open-habitat/internal/wsframe"
)

// standInHost serves a browser host's control and VNC sockets in dir: the
// control socket answers status with what the test sets, and the VNC socket
// echoes what it receives.
type standInHost struct {
	mu      sync.Mutex
	status  browserhost.Status
	picture []byte
	got     []string
}

func (s *standInHost) serve(t *testing.T, dir string) {
	t.Helper()
	control, err := net.Listen("unix", filepath.Join(dir, browserhost.ControlSocket))
	if err != nil {
		t.Fatal(err)
	}
	vnc, err := net.Listen("unix", filepath.Join(dir, browserhost.VNCSocket))
	if err != nil {
		t.Fatal(err)
	}
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		s.mu.Lock()
		s.got = append(s.got, r.Method+" "+r.URL.RequestURI()+" "+string(body))
		st, pic := s.status, s.picture
		s.mu.Unlock()
		switch r.URL.Path {
		case browserhost.WindowPath:
			_, _ = w.Write(pic)
		case browserhost.ViewerPath:
			w.WriteHeader(204)
		default:
			_ = json.NewEncoder(w).Encode(st)
		}
	})}
	go func() { _ = srv.Serve(control) }()
	go func() {
		for {
			c, err := vnc.Accept()
			if err != nil {
				return
			}
			go func() { _, _ = io.Copy(c, c); c.Close() }()
		}
	}()
	t.Cleanup(func() { srv.Close(); vnc.Close() })
}

func (s *standInHost) requests() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string(nil), s.got...)
}

func browserTestHost(t *testing.T, trustedPeer bool) (*browserHost, http.Handler, string) {
	t.Helper()
	dir, err := os.MkdirTemp("", "ohb")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	h := &browserHost{cfg: transport.Config{Home: dir, Username: "alice", UID: os.Getuid()}, ctx: context.Background(),
		log: slog.New(slog.NewTextHandler(io.Discard, nil)), privateDir: dir, trusted: func(string) bool { return false }, feature: func() bool { return true }}
	return h, h.handler(func(*http.Request) bool { return trustedPeer }), dir
}

func browserGet(t *testing.T, handler http.Handler, method, target string, body string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(method, "http://unix"+target, strings.NewReader(body))
	r.Host = "unix"
	if body != "" {
		r.Header.Set("Content-Type", "application/json")
	} else {
		r.ContentLength = 0
	}
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	return w
}

func TestBrowserIsUnavailableWithoutItsProgramsAndRefusesOtherPeers(t *testing.T) {
	h, handler, _ := browserTestHost(t, true)
	h.self = "/usr/bin/true"
	w := browserGet(t, handler, "GET", BrowserPath, "")
	var v browserView
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &v) != nil || v.State != "unavailable" {
		t.Fatalf("status %d %s", w.Code, w.Body)
	}
	if w := browserGet(t, handler, "POST", BrowserStartPath, ""); w.Code != 404 || !strings.Contains(w.Body.String(), "browser_unavailable") {
		t.Fatalf("start %d %s", w.Code, w.Body)
	}
	_, other, _ := browserTestHost(t, false)
	if w := browserGet(t, other, "GET", BrowserPath, ""); w.Code != 403 {
		t.Fatalf("other peer %d", w.Code)
	}
}

func TestBrowserStatusPassesOnlyKnownShapesFromTheHost(t *testing.T) {
	h, handler, dir := browserTestHost(t, true)
	h.start = func(string) error { return nil }
	ok := strings.Repeat("A", 32)
	host := &standInHost{status: browserhost.Status{Control: "person", Agent: true, Windows: []browserhost.Window{
		{ID: ok, Title: strings.Repeat("ö", 250), Origin: "https://login.example.invalid", Agent: true},
		{ID: "not-a-target", Title: "x"},
		{ID: strings.Repeat("B", 32), Title: "y", Origin: "javascript:alert(1)"},
	}, Pointer: &browserhost.Pointer{Window: ok, X: 2, Y: 0.5}, Request: &browserhost.Request{Window: ok, Text: "Syötä koodi"}}}
	host.serve(t, dir)
	w := browserGet(t, handler, "GET", BrowserPath, "")
	var v browserView
	if err := json.Unmarshal(w.Body.Bytes(), &v); err != nil || v.State != "running" || v.Control != "person" || !v.AgentConnected {
		t.Fatalf("status %s", w.Body)
	}
	if len(v.Windows) != 2 || len([]rune(v.Windows[0].Title)) != 200 || v.Windows[1].Origin != "" {
		t.Fatalf("windows %+v", v.Windows)
	}
	if v.Pointer != nil {
		t.Fatalf("a pointer outside its window passed: %+v", v.Pointer)
	}
	if v.Request == nil || v.Request.Text != "Syötä koodi" {
		t.Fatalf("request %+v", v.Request)
	}
	// The browser contract accepts what the daemon sends.
	b, _ := json.Marshal(v)
	if bytes.Contains(b, []byte("javascript")) {
		t.Fatal("an origin that is not http(s) passed")
	}
}

func TestBrowserControlNamesAWindowOnlyWhenThePersonTakesIt(t *testing.T) {
	h, handler, dir := browserTestHost(t, true)
	h.start = func(string) error { return nil }
	host := &standInHost{status: browserhost.Status{Control: "agent", Windows: []browserhost.Window{}}}
	host.serve(t, dir)
	win := strings.Repeat("C", 32)
	for _, bad := range []string{`{"control":"agent","window":"` + win + `"}`, `{"control":"person","window":"x"}`, `{"control":"nobody"}`, `{"control":"person","extra":1}`} {
		if w := browserGet(t, handler, "POST", BrowserControlPath, bad); w.Code != 400 {
			t.Errorf("%s: %d", bad, w.Code)
		}
	}
	if w := browserGet(t, handler, "POST", BrowserControlPath, `{"control":"person","window":"`+win+`"}`); w.Code != 200 {
		t.Fatalf("control %d %s", w.Code, w.Body)
	}
	got := host.requests()
	if last := got[len(got)-1]; !strings.Contains(last, browserhost.ControlPath) || !strings.Contains(last, win) {
		t.Fatalf("host got %v", got)
	}
}

func TestBrowserWindowPictureMustBeAJPEG(t *testing.T) {
	h, handler, dir := browserTestHost(t, true)
	h.start = func(string) error { return nil }
	host := &standInHost{picture: []byte("<html>not a picture</html>")}
	host.serve(t, dir)
	id := strings.Repeat("D", 32)
	if w := browserGet(t, handler, "GET", BrowserWindowPath+"?id="+id, ""); w.Code != 404 {
		t.Fatalf("non-JPEG relayed: %d", w.Code)
	}
	host.mu.Lock()
	host.picture = []byte{0xff, 0xd8, 0xff, 0xe0, 1, 2, 3}
	host.mu.Unlock()
	w := browserGet(t, handler, "GET", BrowserWindowPath+"?id="+id, "")
	if w.Code != 200 || w.Header().Get("Content-Type") != "image/jpeg" || w.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("picture %d %v", w.Code, w.Header())
	}
	if w := browserGet(t, handler, "GET", BrowserWindowPath+"?id="+id+"&x=1", ""); w.Code != 400 {
		t.Fatalf("extra query %d", w.Code)
	}
}

func TestBrowserViewRelaysBinaryFramesToTheDisplay(t *testing.T) {
	h, handler, dir := browserTestHost(t, true)
	h.start = func(string) error { return nil }
	(&standInHost{}).serve(t, dir)
	srv := httptest.NewUnstartedServer(handler)
	srv.Config.ConnContext = nil
	srv.Start()
	defer srv.Close()
	conn, err := net.Dial("tcp", strings.TrimPrefix(srv.URL, "http://"))
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	key, _ := wsframe.NewKey()
	_, _ = io.WriteString(conn, "GET "+BrowserViewPath+" HTTP/1.1\r\nHost: unix\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: "+key+"\r\n\r\n")
	br := bufio.NewReader(conn)
	res, err := http.ReadResponse(br, nil)
	if err != nil || !wsframe.ValidResponse(res, key) {
		t.Fatalf("upgrade %v %v", res, err)
	}
	_, _ = conn.Write(wsframe.AppendFrame(nil, wsframe.OpBinary, []byte("RFB 003.008\n"), true))
	_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	var got []byte
	for len(got) < 12 {
		f, err := wsframe.ReadFrame(br, 1<<16, false)
		if err != nil {
			t.Fatal(err)
		}
		if f.Op == wsframe.OpBinary {
			got = append(got, f.Payload...)
		}
	}
	if string(got) != "RFB 003.008\n" {
		t.Fatalf("display echoed %q", got)
	}
}

func TestAgentBrowserRoutesGiveTheAddressAndRespectTheSwitch(t *testing.T) {
	h, _, dir := browserTestHost(t, true)
	h.start = func(string) error { return nil }
	host := &standInHost{status: browserhost.Status{Control: "agent", Windows: []browserhost.Window{}}}
	host.serve(t, dir)
	routes := h.agentRoutes()
	call := func(path, method, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "http://unix"+path, strings.NewReader(body))
		if body == "" {
			r.ContentLength = 0
		}
		w := httptest.NewRecorder()
		routes[path].ServeHTTP(w, r)
		return w
	}
	w := call(AgentBrowserPath, "GET", "")
	var st struct {
		State       string `json:"state"`
		CDPEndpoint string `json:"cdp_endpoint"`
	}
	if json.Unmarshal(w.Body.Bytes(), &st) != nil || st.State != "running" || st.CDPEndpoint != "ws+unix://"+filepath.Join(dir, "cdp.sock")+":/devtools/browser" {
		t.Fatalf("agent status %s", w.Body)
	}
	h.feature = func() bool { return false }
	if w := call(AgentBrowserStartPath, "POST", ""); w.Code != 409 || !strings.Contains(w.Body.String(), "browser_feature_off") {
		t.Fatalf("start with the switch off: %d %s", w.Code, w.Body)
	}
	for _, bad := range []string{`{}`, `{"text":""}`, `{"text":"` + strings.Repeat("a", 301) + `"}`, `{"clear":true,"text":"x"}`, `{"text":"x","window":"nope"}`} {
		if w := call(AgentBrowserRequestPath, "POST", bad); w.Code != 400 {
			t.Errorf("%s: %d", bad, w.Code)
		}
	}
	if w := call(AgentBrowserRequestPath, "POST", `{"text":"Syötä koodi"}`); w.Code != 200 {
		t.Fatalf("request %d %s", w.Code, w.Body)
	}
}
