//go:build linux

package gateway

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestCombinedPayloadAllowlist(t *testing.T) {
	agent := map[string]string{"agent_id":"pi:12345678-1234-1234-1234-123456789012"}
	for _, tc := range []struct{ kind, body string; want bool }{
		{"queue.changed", `{"revision":"queue_00000001","steering":["hello"],"follow_up":[]}`, true},
		{"queue.changed", `{"revision":"queue_00000001","steering":["hello"],"follow_up":[],"secret":"x"}`, false},
		{"assistant.delta", `{"text":"x"}`, false},
	} {
		if got := validCombinedPayload(tc.kind, agent, []byte(tc.body)); got != tc.want { t.Errorf("%s: got %v", tc.kind, got) }
	}
}

func TestEventsGatewayReplaysAndRejectsForeignFrames(t *testing.T) {
	now := time.Now()
	uid := os.Getuid()
	m := Identity{"github", "42", uid, "alice", "/run/native-agent-host/users/alice/daemon.sock"}
	socket := filepath.Join(t.TempDir(), "daemon.sock")
	ln, err := net.Listen("unix", socket)
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	const instance = "12345678-1234-4123-8123-123456789abc"
	var extra atomic.Bool
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/events" || r.Header.Get("X-Agent-Host-Identity") != identityID(m) {
			t.Errorf("bad forwarded request %s", r.URL.String())
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(200)
		for i := 1; i <= 2; i++ {
			field := ""
			if extra.Load() {
				field = `,"unknown":"leak"`
			}
			_, _ = fmt.Fprintf(w, "id: ev1:%s:%d\nevent: snapshot.invalidated\ndata: {\"schema_version\":1,\"event_id\":\"evt_example%04d\",\"cursor\":\"ev1:%s:%d\",\"server_instance_id\":\"%s\",\"sequence\":%d,\"emitted_at\":\"2026-09-30T18:00:00Z\",\"kind\":\"snapshot.invalidated\",\"resource\":{\"scope\":\"user\"},\"payload\":{\"reason\":\"source_changed\"}%s}\n\n", instance, i, i, instance, i, instance, i, field)
			w.(http.Flusher).Flush()
		}
	})}
	go srv.Serve(ln)
	defer srv.Close()
	a := &Auth{cfg: OAuthConfig{Origin: "https://host.test"}, broker: newFakeBroker(), now: func() time.Time { return now }, sessions: map[string]session{}}
	a.broker.(*fakeBroker).routes["42"] = BrokerRoute{UID: uint32(uid), Username: "alice", Socket: m.Socket}
	cookie := strings.Repeat("A", 43)
	a.sessions[cookie] = session{identity: m, epoch: 1, generation: 1, csrf: cookie, idle: now.Add(time.Hour), absolute: now.Add(time.Hour)}
	a.snapshotDial = func(ctx context.Context, p string) (net.Conn, error) {
		if p != m.Socket {
			t.Errorf("wrong socket %s", p)
		}
		return (&net.Dialer{}).DialContext(ctx, "unix", socket)
	}
	h := NewWithAuth("", a)
	send := func() *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", "https://host.test/api/v1/events?after=ev1:"+instance+":0", nil)
		r.RequestURI = "/api/v1/events?after=ev1:" + instance + ":0"
		r.AddCookie(&http.Cookie{Name: cookieName, Value: cookie})
		w := httptest.NewRecorder()
		h.ServeHTTP(streamRecorder{w}, r)
		return w
	}
	w := send()
	if w.Code != 200 || strings.Count(w.Body.String(), "event: snapshot.invalidated") != 2 || !strings.Contains(w.Body.String(), "id: ev1:"+instance+":2") {
		t.Fatalf("stream %d %s", w.Code, w.Body.String())
	}
	extra.Store(true)
	w = send()
	if strings.Contains(w.Body.String(), "unknown") || strings.Contains(w.Body.String(), "event: snapshot.invalidated") {
		t.Fatalf("forwarded invalid frame: %s", w.Body.String())
	}
}
