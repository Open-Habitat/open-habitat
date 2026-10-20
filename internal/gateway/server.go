// Package gateway owns authentication/session boundaries and static UI serving.
// It must not inspect user homes or execute native agents.
package gateway

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
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
		mux.HandleFunc("/api/v1/server", s.auth.adminHTTP)
		mux.HandleFunc("/api/v1/server/administration", s.auth.adminHTTP)
		mux.HandleFunc("/api/v1/server/storage", s.auth.quotaHTTP)
		mux.HandleFunc("/api/v1/account/storage", s.auth.quotaHTTP)
		mux.HandleFunc("/api/v1/snapshot", s.auth.snapshot)
		mux.HandleFunc("/api/v1/workspaces/git", s.auth.workspaceGit)
		mux.HandleFunc("/api/v1/workspaces/git/fetch", s.auth.workspaceGitFetch)
		mux.HandleFunc(workspaceCommandsPath, s.auth.workspaceComposerRead)
		mux.HandleFunc(workspaceFilesPath, s.auth.workspaceComposerRead)
		mux.HandleFunc(workspaceFilePreviewPath, s.auth.workspaceComposerRead)
		mux.HandleFunc(terminalsPath, s.auth.terminalList)
		mux.HandleFunc(terminalClosePath, s.auth.terminalClose)
		mux.HandleFunc(terminalPath, s.auth.terminal)
		mux.HandleFunc("/api/v1/workspaces", s.auth.workspaces)
		mux.HandleFunc("/api/v1/workspaces/github/publish", s.auth.githubPublish)
		mux.HandleFunc("/api/v1/account/github/disconnect", s.auth.githubDisconnect)
		mux.HandleFunc(gitIdentityPath, s.auth.gitIdentity)
		mux.HandleFunc("/api/v1/local-files", s.auth.localFiles)
		mux.HandleFunc("/api/v1/attachments", s.auth.attachments)
		mux.HandleFunc("/api/v1/attachments/", s.auth.attachments)
		mux.HandleFunc("/api/v1/events", s.auth.conversation)
		mux.HandleFunc("/api/v1/conversations", s.auth.conversation)
		mux.HandleFunc("/api/v1/conversations/", s.auth.conversation)
		mux.HandleFunc("/api/v1/onboarding/pi/status", s.auth.piStatus)
		mux.HandleFunc("/api/v1/pi/credentials", s.auth.piCredentials)
		mux.HandleFunc("/api/v1/pi/credentials/openai", s.auth.piCredentials)
		mux.HandleFunc("/api/v1/pi/models", s.auth.piModels)
		mux.HandleFunc("/api/v1/pi/claude-login", s.auth.claudeLogin)
		mux.HandleFunc("/api/v1/onboarding/github/repos", s.auth.githubRepos)
		mux.HandleFunc(githubLookupPath, s.auth.githubLookup)
		mux.HandleFunc(githubClonesPath, s.auth.githubClones)
		mux.HandleFunc(githubCloneEventsPath, s.auth.githubCloneEvents)
		mux.HandleFunc("/api/v1/onboarding/github/checkout", s.auth.githubObserve)
		mux.HandleFunc("/api/v1/onboarding/pi/attempt", s.auth.piAttempt)
		mux.HandleFunc("/api/v1/agents/", s.auth.history)
		mux.HandleFunc(integrationsPath, s.auth.integrations)
		mux.HandleFunc(integrationAccountsPath, s.auth.integrations)
		mux.HandleFunc(integrationLoginPath, s.auth.integrations)
		mux.HandleFunc(editorPath, s.auth.editorStatus)
		mux.HandleFunc(editorOpenPath, s.auth.editorOpen)
		mux.HandleFunc(editorStopPath, s.auth.editorStop)
	}
	mux.HandleFunc("/", s.ui)
	if s.auth != nil {
		var h http.Handler = mux
		if s.auth.log != nil {
			h = diagnostic.Requests(s.auth.log, diagnostic.RequestOptions{ID: func(*http.Request) string { return diagnostic.NewRequestID() }}, mux)
		}
		app := frameProtection(s.auth.accessIngress(h))
		// Unknown tunnel hosts must never reach app UI, cookies or OAuth redirects.
		// Health probes remain available independently of the public host routing.
		editor := s.auth.accessIngress(http.HandlerFunc(s.auth.editorServe))
		appHost := strings.TrimPrefix(s.auth.cfg.Origin, "https://")
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Host == appHost || (r.Method == http.MethodGet || r.Method == http.MethodHead) && (r.URL.Path == "/healthz" || r.URL.Path == "/readyz") {
				app.ServeHTTP(w, r)
				return
			}
			if s.auth.cfg.EditorOrigin != "" && s.auth.isEditorHost(r.Host) {
				editor.ServeHTTP(w, r)
				return
			}
			http.Error(w, "misdirected request", http.StatusMisdirectedRequest)
		})
	}
	return frameProtection(mux)
}

func frameProtection(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Security-Policy", "frame-ancestors 'none'")
		w.Header().Set("X-Frame-Options", "DENY")
		next.ServeHTTP(w, r)
	})
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
		if relative == "index.html" {
			// A deploy changes the asset hashes referenced by the shell.
			w.Header().Set("Cache-Control", "no-store")
		}
		http.ServeFile(w, r, candidate)
		return
	}
	if !knownUIRoute(r.URL.Path) {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	http.ServeFile(w, r, filepath.Join(s.staticDir, "index.html"))
}
func knownUIRoute(path string) bool {
	return path == "/" || path == "/link" || path == "/settings" || path == "/administration" || path == "/workspaces" || strings.HasPrefix(path, "/workspaces/") || strings.HasPrefix(path, "/agents/pi:") || strings.HasPrefix(path, "/operations/")
}
