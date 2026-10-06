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
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestGatewayObserveBoundSessionAndReply(t *testing.T) {
	now := time.Now()
	uid := os.Getuid()
	id := Identity{"github", "42", uid, "alice", "/run/open-habitat/users/alice/daemon.sock"}
	socket := filepath.Join(t.TempDir(), "daemon.sock")
	ln, e := net.Listen("unix", socket)
	if e != nil {
		t.Fatal(e)
	}
	defer ln.Close()
	calls := 0
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Method != "GET" || r.Header.Get("X-Agent-Host-Identity") != "" || r.Header.Get("Cookie") != "" || r.Header.Get("Authorization") != "" {
			t.Error("unbound request")
		}
		b := `{"schema_version":1,"full_name":"org/repo","state":"confirmed"}`
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Length", strconv.Itoa(len(b)))
		fmt.Fprint(w, b)
	})}
	go srv.Serve(ln)
	defer srv.Close()
	a := &Auth{cfg: OAuthConfig{Origin: "https://host.test"}, broker: newFakeBroker(), now: func() time.Time { return now }, sessions: map[string]session{"one": {identity: id, idle: now.Add(time.Hour), absolute: now.Add(time.Hour)}}}
	a.broker.(*fakeBroker).routes["42"] = BrokerRoute{UID: uint32(uid), Username: "alice", Socket: id.Socket}
	a.snapshotDial = func(ctx context.Context, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", socket)
	}
	h := NewWithAuth("", a)
	send := func(uri string, auth bool) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", "https://host.test"+uri, nil)
		r.RequestURI = r.URL.RequestURI()
		if auth {
			r.AddCookie(&http.Cookie{Name: cookieName, Value: "one"})
		}
		r.Header.Set("Authorization", "Bearer foreign")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	uri := githubObservePath + "?full_name=org%2Frepo"
	if w := send(uri, false); w.Code != 401 {
		t.Fatal(w.Code)
	}
	for _, bad := range []string{githubObservePath + "?full_name=org/repo", uri + "&uid=1", githubObservePath + "?full_name=other%2Frepo" + "&path=%2Fhome", githubObservePath + "?full_name=..%2Frepo"} {
		if w := send(bad, true); w.Code != 400 {
			t.Fatalf("%s: %d", bad, w.Code)
		}
	}
	if calls != 0 {
		t.Fatal(calls)
	}
	if w := send(uri, true); w.Code != 200 || !strings.Contains(w.Body.String(), `"state":"confirmed"`) || calls != 1 {
		t.Fatalf("%d %s %d", w.Code, w.Body.String(), calls)
	}
}
