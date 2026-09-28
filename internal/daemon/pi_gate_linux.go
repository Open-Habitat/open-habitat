//go:build linux

package daemon

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/maintainer/native-agent-host/internal/transport"
)

// piGate checks the authenticated hop before querying Pi, then fails closed
// before invoking any native read. A fresh native check is made for each request.
func piGate(cfg transport.Config, trusted func(*http.Request) bool, status func() string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if status() != "usable" {
			snapshotError(w, 428, "pi_onboarding_required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// PiStatusHandler discloses only the mapped daemon's native credential state.
// It never reads workspaces, history or the credential value into the response.
func PiStatusHandler(cfg transport.Config, trusted func(*http.Request) bool, status func() string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.RequestURI != "/api/v1/onboarding/pi/status" || r.URL.RawQuery != "" || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		state := status()
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
