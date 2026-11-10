//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os/user"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/diagnostic"
	"github.com/open-habitat/open-habitat/internal/nativegh"
	"github.com/open-habitat/open-habitat/internal/transport"
)

// Only the verified gateway's well-formed ID joins a daemon record to a
// gateway record; anything else is logged without an ID, never invented.
func TestRequestLogTakesIDOnlyFromTrustedGateway(t *testing.T) {
	for _, tc := range []struct {
		name    string
		trusted bool
		id      string
		want    string
	}{
		{"trusted", true, "AAAAAAAAAAAAAAAA", `"request_id":"AAAAAAAAAAAAAAAA"`},
		{"untrusted_peer", false, "AAAAAAAAAAAAAAAA", ""},
		{"malformed", true, "synthetic\"marker", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var buf bytes.Buffer
			h := RequestLog(diagnostic.New(&buf, "daemon").With("user", "alice"), func(*http.Request) bool { return tc.trusted }, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusNoContent)
			}))
			r := httptest.NewRequest("POST", "http://unix/api/v1/workspaces", nil)
			r.Header.Set(diagnostic.RequestIDHeader, tc.id)
			h.ServeHTTP(httptest.NewRecorder(), r)
			out := buf.String()
			if !strings.Contains(out, `"route":"/api/v1/workspaces"`) || !strings.Contains(out, `"user":"alice"`) {
				t.Fatalf("record: %s", out)
			}
			if tc.want == "" && strings.Contains(out, "request_id") || tc.want != "" && !strings.Contains(out, tc.want) || strings.Contains(out, "marker") {
				t.Fatalf("request id handling: %s", out)
			}
		})
	}
}

// A slow snapshot names which native observation took the time, so a live
// report can be attributed without strace.
func TestSlowSnapshotRecordsPhases(t *testing.T) {
	u, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	uid, _ := strconv.Atoi(u.Uid)
	cfg := transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: u.HomeDir, Provider: "github", Subject: "42", Socket: "/run/open-habitat/users/" + u.Username + "/daemon.sock"}
	slowGitHub := func(context.Context) nativegh.Observation {
		time.Sleep(diagnostic.SlowRead)
		return nativegh.Observation{State: "connected"}
	}
	snapshot := snapshotHandlerWithStatus(cfg, func(*http.Request) bool { return true }, func(transport.Config) Discovery { return Discovery{State: "empty"} }, func(transport.Config) ([]nativeSession, error) { return nil, nil }, t.TempDir(), slowGitHub)
	var buf bytes.Buffer
	r := httptest.NewRequest("GET", "http://unix/api/v1/snapshot", nil)
	r.RequestURI = SnapshotPath
	w := httptest.NewRecorder()
	RequestLog(diagnostic.New(&buf, "daemon"), func(*http.Request) bool { return true }, snapshot).ServeHTTP(w, r)
	var rec struct {
		Route  string           `json:"route"`
		Phases map[string]int64 `json:"phases_ms"`
	}
	if w.Code != 200 || json.Unmarshal(buf.Bytes(), &rec) != nil || rec.Route != SnapshotPath {
		t.Fatalf("status %d record %s", w.Code, buf.String())
	}
	for _, phase := range []string{"discovery", "taskfleet", "sessions", "git", "github"} {
		if _, ok := rec.Phases[phase]; !ok {
			t.Fatalf("missing phase %s: %s", phase, buf.String())
		}
	}
	if rec.Phases["github"] < diagnostic.SlowRead.Milliseconds() {
		t.Fatalf("github phase not attributed: %s", buf.String())
	}
}
