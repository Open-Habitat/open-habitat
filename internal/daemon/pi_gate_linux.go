//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/maintainer/native-agent-host/internal/transport"
)

// PiStatusHandler discloses only the mapped daemon's native credential state.
// It never reads workspaces, history or the credential value into the response.
func PiStatusHandler(cfg transport.Config, trusted func(*http.Request) bool, status func(context.Context) string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.RequestURI != "/api/v1/onboarding/pi/status" || r.URL.RawQuery != "" || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		// The listener's default five-second write deadline is too short for
		// the native helper. Recorders without deadline support need no override.
		_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(14 * time.Second))
		state := status(r.Context())
		if r.Context().Err() != nil {
			state = "unknown"
		}
		if state != "usable" && state != "missing" {
			state = "unknown"
		}
		b, _ := json.Marshal(map[string]any{"schema_version": 1, "pi": map[string]string{"state": state}})
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Length", strconv.Itoa(len(b)))
		w.WriteHeader(200)
		_, _ = w.Write(b)
	})
}
