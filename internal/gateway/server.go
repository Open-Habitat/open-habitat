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

type Server struct {
	staticDir string
	auth      *Auth
}

func New(staticDir string) http.Handler { return (&Server{staticDir: staticDir}).routes() }

// NewWithAuth enables the gateway auth core; nil keeps the foundation fail-closed.
func NewWithAuth(staticDir string, auth *Auth) http.Handler {
	return (&Server{staticDir: staticDir, auth: auth}).routes()
}
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
	if s.auth != nil {
		s.auth.routes(mux)
		mux.HandleFunc("/api/v1/snapshot", s.auth.snapshot)
		mux.HandleFunc("/api/v1/agents/", s.auth.history)
		mux.HandleFunc("/api/v1/content/", s.auth.history)
	}
	mux.HandleFunc("/", s.ui)
	if s.auth != nil {
		return s.auth.accessIngress(mux)
	}
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
	// Indexing metadata applies only to the UI static surface, never to API,
	// session, or OAuth handlers. It is not an authentication boundary.
	w.Header().Set("X-Robots-Tag", "noindex, nofollow, noarchive")
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
	return path == "/" || path == "/settings" || path == "/workspaces" || strings.HasPrefix(path, "/workspaces/") || strings.HasPrefix(path, "/agents/pi:") || strings.HasPrefix(path, "/operations/")
}
