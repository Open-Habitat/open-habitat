//go:build linux

package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestGatewayRepoCatalogPrePiMappedSocket(t *testing.T) {
	uid := os.Getuid()
	now := time.Now()
	paths := map[string]string{}
	malformed := ""
	mappings := []Identity{{"github", "42", uid, "alice", "/run/open-habitat/users/alice/daemon.sock"}, {"github", "43", uid, "bob", "/run/open-habitat/users/bob/daemon.sock"}}
	for _, m := range mappings {
		dir := t.TempDir()
		socket := filepath.Join(dir, "daemon.sock")
		ln, e := net.Listen("unix", socket)
		if e != nil {
			t.Fatal(e)
		}
		paths[m.Socket] = socket
		subject := m.Subject
		srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("X-Agent-Host-Identity") != "" || r.Header.Get("X-Agent-Host-Display-Name") != "" || r.Header.Get("Cookie") != "" || r.Header.Get("X-Agent-Host-Socket") != "" || r.Header.Get("Authorization") != "" {
				w.WriteHeader(403)
				return
			}
			switch r.URL.Path {
			case githubReposPath:
				if malformed != "" {
					b := malformed
					w.Header().Set("Content-Type", "application/json")
					w.Header().Set("Content-Length", strconv.Itoa(len(b)))
					fmt.Fprint(w, b)
					return
				}
				b := fmt.Sprintf(`{"schema_version":1,"login":"person%s","complete":true,"repositories":[{"full_name":"org/repo%s","private":true,"description":"","html_url":"https://github.com/org/repo%s","pushed_at":null,"size_kib":1,"default_branch":"main","owner_type":"Organization"}]}`, subject, subject, subject)
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Content-Length", strconv.Itoa(len(b)))
				fmt.Fprint(w, b)
			case "/api/v1/snapshot":
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(428)
				fmt.Fprint(w, `{"schema_version":1,"error":{"code":"pi_onboarding_required"}}`)
			default:
				w.WriteHeader(404)
			}
		})}
		go srv.Serve(ln)
		t.Cleanup(func() { srv.Close(); ln.Close() })
	}
	a := &Auth{cfg: OAuthConfig{Origin: "https://host.test"}, broker: newFakeBroker(), now: func() time.Time { return now }, sessions: map[string]session{}}
	for i, m := range mappings {
		a.broker.(*fakeBroker).routes[m.Subject] = BrokerRoute{UID: uint32(uid), Username: m.Username, Socket: m.Socket}
		a.sessions[strconv.Itoa(i)] = session{identity: m, idle: now.Add(time.Hour), absolute: now.Add(time.Hour)}
	}
	a.snapshotDial = func(ctx context.Context, p string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", paths[p])
	}
	var logs bytes.Buffer
	a.log = CallbackLogger(&logs)
	h := NewWithAuth("", a)
	send := func(id, path string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", "https://host.test"+path, nil)
		r.RequestURI = r.URL.RequestURI()
		if id != "" {
			r.AddCookie(&http.Cookie{Name: cookieName, Value: id})
		}
		r.Header.Set("X-Agent-Host-Identity", identityID(mappings[1]))
		r.Header.Set("X-Agent-Host-Socket", mappings[1].Socket)
		r.Header.Set("Authorization", "Bearer forged")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	for i, m := range mappings {
		id := strconv.Itoa(i)
		w := send(id, githubReposPath)
		if w.Code != 200 || !strings.Contains(w.Body.String(), "org/repo"+m.Subject) || !strings.Contains(w.Body.String(), `"login":"person`+m.Subject+`"`) || strings.Contains(w.Body.String(), "org/repo"+mappings[1-i].Subject) || w.Header().Get("Cache-Control") != "no-store" {
			t.Fatalf("catalog %s: %d %s", id, w.Code, w.Body.String())
		}
		if w := send(id, "/api/v1/snapshot"); w.Code != 428 {
			t.Fatalf("daemon Pi gate response not forwarded: %d %s", w.Code, w.Body.String())
		}
	}
	// A real TLS/ALPN request, not only a synthetic ProtoMajor assignment.
	tls := httptest.NewUnstartedServer(h)
	tls.EnableHTTP2 = true
	tls.StartTLS()
	t.Cleanup(tls.Close)
	for i, m := range mappings {
		req, err := http.NewRequest("GET", tls.URL+githubReposPath, nil)
		if err != nil {
			t.Fatal(err)
		}
		req.Host = "host.test"
		req.AddCookie(&http.Cookie{Name: cookieName, Value: strconv.Itoa(i)})
		res, err := tls.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		body, err := io.ReadAll(res.Body)
		res.Body.Close()
		if err != nil || res.ProtoMajor != 2 || res.StatusCode != 200 || !strings.Contains(string(body), "org/repo"+m.Subject) || strings.Contains(string(body), "org/repo"+mappings[1-i].Subject) {
			t.Fatalf("HTTP/2 mapped catalog: protocol=%s status=%d body=%s err=%v", res.Proto, res.StatusCode, body, err)
		}
	}

	for _, path := range []string{githubReposPath + "?page=1&limit=2", githubReposPath + "?owner=bob"} {
		logs.Reset()
		if w := send("0", path); w.Code != 400 {
			t.Fatalf("bad path %s: %d", path, w.Code)
		}
		assertCatalogDiagnostic(t, logs.Bytes(), "invalid_request")
	}
	for _, malformed = range []string{
		`{"schema_version":1,"complete":true,"repositories":[],"extra":"secret"}`,
		`{"schema_version":1,"login":"../secret","complete":true,"repositories":[]}`,
	} {
		logs.Reset()
		if w := send("0", githubReposPath); w.Code != 503 || strings.Contains(w.Body.String(), "secret") {
			t.Fatalf("malformed daemon reply: %d %s", w.Code, w.Body.String())
		}
		assertCatalogDiagnostic(t, logs.Bytes(), "catalog_invalid")
	}
	if w := send("", githubReposPath); w.Code != 401 {
		t.Fatal(w.Code)
	}
}

func assertCatalogDiagnostic(t *testing.T, data []byte, reason string) {
	t.Helper()
	found := false
	for _, line := range bytes.Split(bytes.TrimSpace(data), []byte("\n")) {
		var record map[string]any
		if err := json.Unmarshal(line, &record); err != nil {
			t.Fatal(err)
		}
		if record["event"] == "github_repo_catalog" && record["reason"] == reason && record["outcome"] == "rejected" {
			found = true
		}
	}
	if !found {
		t.Fatalf("missing catalog reason %s: %s", reason, data)
	}
	for _, marker := range []string{"secret", "forged", "Bearer", "repositories", "page=", "owner="} {
		if bytes.Contains(data, []byte(marker)) {
			t.Fatalf("diagnostic leaked %s: %s", marker, data)
		}
	}
}
