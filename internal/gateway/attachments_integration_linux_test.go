//go:build linux

package gateway_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/daemon"
	"github.com/open-habitat/open-habitat/internal/gateway"
	"github.com/open-habitat/open-habitat/internal/transport"
)

func TestSlowAttachmentThroughGateway(t *testing.T) {
	if testing.Short() {
		t.Skip("exercises the former 60-second upload cutoff")
	}
	home := t.TempDir()
	socket := "@oh-upload-" + filepath.Base(home) + fmt.Sprint(os.Getpid(), time.Now().UnixNano())
	ln, err := net.Listen("unix", socket)
	if err != nil {
		t.Fatal(err)
	}
	identity := gateway.Identity{Provider: "github", Subject: "42", UID: 1001, Username: "alice", Socket: "/run/open-habitat/users/alice/daemon.sock"}
	handler := daemon.AttachmentsHandler(transport.Config{Home: home}, func(*http.Request) bool { return true })
	// Match the user-socket server's default deadlines. The real attachment
	// handler, not the fixture, must extend them before reading the body.
	backend := &http.Server{Handler: handler, ReadTimeout: 5 * time.Second, WriteTimeout: 5 * time.Second}
	go backend.Serve(ln)
	t.Cleanup(func() { backend.Close() })
	auth, err := gateway.NewAuth(gateway.OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, gateway.AuthOptions{Provider: routeProvider{}, Sink: routeSink{}, Broker: routeBroker{[]gateway.Identity{identity}}, SnapshotDial: func(ctx context.Context, p string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", socket)
	}, SnapshotPeerUID: func(*net.UnixConn) int { return identity.UID }})
	if err != nil {
		t.Fatal(err)
	}
	h := gateway.NewWithAuth("", auth)
	get := func(path string, cookie *http.Cookie) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", "https://host.test"+path, nil)
		if cookie != nil {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	start := get("/auth/github/start", nil)
	loc, err := url.Parse(start.Header().Get("Location"))
	if err != nil {
		t.Fatal(err)
	}
	cb := get("/auth/github/callback?state="+loc.Query().Get("state")+"&code=42", start.Result().Cookies()[0])
	if cb.Code != 303 {
		t.Fatalf("login: %d %s", cb.Code, cb.Body.String())
	}
	cookie := cb.Result().Cookies()[1]
	var session struct {
		CSRF string `json:"csrf"`
	}
	if err := json.Unmarshal(get("/auth/session", cookie).Body.Bytes(), &session); err != nil {
		t.Fatal(err)
	}
	front := httptest.NewTLSServer(h)
	defer front.Close()
	reader, writer := io.Pipe()
	defer reader.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 75*time.Second)
	defer cancel()
	stop := context.AfterFunc(ctx, func() { reader.Close() })
	defer stop()
	const chunks = 62
	uploadDone := make(chan struct{})
	go func() {
		defer close(uploadDone)
		defer writer.Close()
		for i := 0; i < chunks; i++ {
			if i > 0 {
				select {
				case <-time.After(time.Second):
				case <-ctx.Done():
					return
				}
			}
			if _, err := io.WriteString(writer, "x"); err != nil {
				return
			}
		}
	}()
	req, err := http.NewRequestWithContext(ctx, "POST", front.URL+daemon.AttachmentsPath, reader)
	if err != nil {
		t.Fatal(err)
	}
	req.Host = "host.test"
	req.ContentLength = chunks
	req.AddCookie(cookie)
	req.Header.Set("Origin", "https://host.test")
	req.Header.Set("X-Agent-Host-CSRF", session.CSRF)
	resp, err := front.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("upload: %d %s", resp.StatusCode, body)
	}
	var saved struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(body, &saved); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(home, "attachments", saved.ID))
	if err != nil || string(data) != strings.Repeat("x", chunks) {
		t.Fatalf("saved body: %q, %v", data, err)
	}
	<-uploadDone
}
