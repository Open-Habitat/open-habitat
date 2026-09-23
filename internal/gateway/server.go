// Package gateway owns authentication/session boundaries and static UI serving.
// It must not inspect user homes or execute native agents.
package gateway

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

type Server struct{ staticDir string }

func New(staticDir string) http.Handler { return (&Server{staticDir: staticDir}).routes() }
func (s *Server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{"status": "ok", "schema_version": 1})
	})
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, _ *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{"status": "foundation-only", "schema_version": 1})
	})
	mux.HandleFunc("/api/", func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, `{"schema_version":1,"error":{"code":"not_implemented","message":"product API is not implemented by the foundation"}}`, http.StatusNotImplemented)
	})
	mux.HandleFunc("/events", func(w http.ResponseWriter, _ *http.Request) { http.NotFound(w, nil) })
	mux.HandleFunc("/auth/", func(w http.ResponseWriter, _ *http.Request) { http.NotFound(w, nil) })
	mux.HandleFunc("/", s.ui)
	return mux
}
func (s *Server) ui(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if s.staticDir == "" {
		http.Error(w, "static client unavailable", http.StatusServiceUnavailable)
		return
	}
	// Serve only regular files beneath the immutable static root. API, event and
	// auth prefixes are registered on more-specific patterns and never reach here.
	relative := strings.TrimPrefix(filepath.Clean("/"+r.URL.Path), "/")
	candidate := filepath.Join(s.staticDir, relative)
	if info, err := os.Stat(candidate); err == nil && info.Mode().IsRegular() {
		http.ServeFile(w, r, candidate)
		return
	}
	if !knownUIRoute(r.URL.Path) {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, filepath.Join(s.staticDir, "index.html"))
}
func knownUIRoute(path string) bool {
	return path == "/" || path == "/workspaces" || strings.HasPrefix(path, "/workspaces/") || strings.HasPrefix(path, "/operations/")
}
