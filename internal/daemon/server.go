// Package daemon owns per-UID native facts and process access. The foundation
// exposes health only; native histories and controls arrive in later slices.
package daemon

import (
	"encoding/json"
	"net/http"
)

func New() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{"status": "ok", "role": "daemon", "schema_version": 1})
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, `{"schema_version":1,"error":{"code":"not_implemented","message":"native API is not implemented by the foundation"}}`, http.StatusNotImplemented)
	})
	return mux
}
