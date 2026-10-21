//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// A model can finish after the ordinary transport write deadline. Exercise a
// real HTTP connection: ResponseRecorder cannot expose a lost response.
func TestTitleReplySurvivesOrdinaryWriteDeadline(t *testing.T) {
	for _, history := range []bool{false, true} {
		t.Run(fmt.Sprintf("history=%t", history), func(t *testing.T) {
			h := newHeldHarness(t)
			c, stop := h.daemon()
			defer stop()
			id := h.create(c)
			h.eventually("idle", func() bool { _, s := h.status(c, id); return s.State == "idle" })
			if w := h.send(c, id, "Synthetic topic", heldA); w.Code != 200 {
				t.Fatal(w.Body.String())
			}
			h.eventually("settled", func() bool {
				c.mu.Lock()
				defer c.mu.Unlock()
				s := c.sessions[id]
				return s.settled && !s.naming
			})
			if history {
				stop()
				c, stop = h.daemon()
				defer stop()
			}
			calls := 0
			c.titleGenerator = func(string) (string, error) {
				calls++
				time.Sleep(120 * time.Millisecond)
				return "", titleModelTimeout
			}
			handler := func(w http.ResponseWriter, r *http.Request) { c.regenerateTitle(w, r, id) }
			body := ""
			if history {
				handler = func(w http.ResponseWriter, r *http.Request) { c.historyTitle(w, r, id) }
				body = fmt.Sprintf(`{"workspace_id":%q}`, h.workspace)
			}
			srv := httptest.NewUnstartedServer(http.HandlerFunc(handler))
			srv.Config.WriteTimeout = 50 * time.Millisecond
			srv.Start()
			defer srv.Close()
			response, err := srv.Client().Post(srv.URL, "application/json", strings.NewReader(body))
			if err != nil {
				t.Fatalf("lost title reply after model completed: %v", err)
			}
			defer response.Body.Close()
			var reply struct{ State, Reason string }
			if err := json.NewDecoder(response.Body).Decode(&reply); err != nil {
				t.Fatal(err)
			}
			if response.StatusCode != 200 || reply.State != "failed" || reply.Reason != string(titleModelTimeout) || calls != 1 {
				t.Fatalf("reply %d %+v; calls %d", response.StatusCode, reply, calls)
			}
		})
	}
}
