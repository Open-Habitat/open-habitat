//go:build linux

package daemon

import (
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/nativegh"
	"github.com/Open-Habitat/open-habitat/internal/transport"
)

const RepoDisconnectPath = "/api/v1/account/github/disconnect"

func RepoDisconnectHandler(cfg transport.Config, trusted func(*http.Request) bool, adapter *nativegh.Adapter) http.Handler {
	var mu sync.Mutex
	token := ""
	until := time.Time{}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if adapter == nil || r.URL.Path != RepoDisconnectPath || r.RequestURI != RepoDisconnectPath || r.Host != "unix" || r.URL.RawQuery != "" || r.Header.Get("X-Agent-Host-Recent-Login") != "1" || len(r.TransferEncoding) != 0 {
			snapshotError(w, 403, "reauthentication_required")
			return
		}
		if !cloneWriter.TryLock() {
			snapshotError(w, 409, "workspace_busy")
			return
		}
		defer cloneWriter.Unlock()
		if r.Method == "GET" {
			if r.ContentLength > 0 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			state := adapter.Status(r.Context())
			if state != "connected" {
				snapshotError(w, 409, "github_auth_unavailable")
				return
			}
			next, err := newWorkspaceID()
			if err != nil {
				snapshotError(w, 503, "native_source_unavailable")
				return
			}
			mu.Lock()
			token = next
			until = time.Now().Add(2 * time.Minute)
			mu.Unlock()
			historyJSON(w, map[string]any{"schema_version": 1, "state": state, "observation_token": next, "scope": "user"})
			return
		}
		if r.Method != "POST" || r.ContentLength < 2 || r.ContentLength > 256 || r.Header.Get("Content-Type") != "application/json" {
			snapshotError(w, 400, "invalid_request")
			return
		}
		b, err := io.ReadAll(io.LimitReader(r.Body, 257))
		var in struct {
			Confirmation     string `json:"confirmation"`
			Scope            string `json:"scope"`
			ObservationToken string `json:"observation_token"`
		}
		if err != nil || int64(len(b)) != r.ContentLength || !catalogNoDuplicates(b) || strictCloneJSON(b, &in) != nil || in.Confirmation != "disconnect" || in.Scope != "user" {
			snapshotError(w, 400, "invalid_request")
			return
		}
		mu.Lock()
		valid := in.ObservationToken != "" && in.ObservationToken == token && time.Now().Before(until)
		token = ""
		mu.Unlock()
		if !valid || adapter.Status(r.Context()) != "connected" {
			snapshotError(w, 409, "stale_precondition")
			return
		}
		result, err := adapter.Disconnect(r.Context(), true, true)
		if err != nil || result.Phase != nativegh.Absent || adapter.Status(r.Context()) != "disconnected" {
			snapshotError(w, 409, "disconnect_partial")
			return
		}
		historyJSON(w, map[string]any{"schema_version": 1, "state": "disconnected", "revokes_oauth_token": false})
	})
}
