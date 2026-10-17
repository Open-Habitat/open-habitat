//go:build linux

package daemon

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/core"
	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
	"github.com/Open-Habitat/open-habitat/internal/nativegh"
	"github.com/Open-Habitat/open-habitat/internal/transport"
)

// ServeHandoff serves a pre-opened, configured systemd Unix listener as the
// mapped user. A real native credential consumer must be supplied by phase 2B;
// nil is rejected, rather than acknowledging tokens without installing them.
func ServeHandoff(ctx context.Context, listener *net.UnixListener, cfg transport.Config, consume transport.Consumer) error {
	server, err := transport.NewServer(cfg, consume)
	if err != nil {
		return err
	}
	return server.Serve(ctx, listener)
}

// ServeHTTP accepts a pre-opened per-user listener and mounts internal handoff
// alongside future daemon workspace routes on a shared HTTP/1.1 ServeMux.
func ServeHTTP(ctx context.Context, listener *net.UnixListener, cfg transport.Config, adapter *nativegh.Adapter, mux *http.ServeMux, runtime *core.PiRuntimeConfig) error {
	if adapter == nil {
		return errors.New("native credential adapter unavailable")
	}
	server, err := transport.NewServer(cfg, adapter.Consumer())
	if err != nil {
		return err
	}
	if mux == nil {
		mux = http.NewServeMux()
	}
	// A missing selector is an unsafe deployment, not a first-use login state.
	if runtime == nil {
		return errors.New("native Pi runtime unavailable")
	}
	// Pi status is queried only by the explicit onboarding endpoint.
	pi := &PiDevice{Home: cfg.Home}
	if runtime != nil {
		pi.Node, pi.Entry, pi.Manifest = runtime.Node, runtime.Entry, runtime.Manifest
		pi.TrustedRuntime = true
		pi.SharedSelector = true
	}
	if err := pi.validate(); err != nil {
		return err
	}
	piStatus := func(parent context.Context) string {
		ctx, cancel := context.WithTimeout(parent, 12*time.Second)
		defer cancel()
		return pi.StatusContext(ctx)
	}
	mux.Handle("GET /api/v1/onboarding/pi/status", PiStatusHandler(cfg, server.TrustedPeer, piStatus))
	mux.Handle("/api/v1/pi/credentials", PiCredentialsHandler(cfg, server.TrustedPeer, pi))
	mux.Handle("/api/v1/pi/credentials/openai", PiCredentialsHandler(cfg, server.TrustedPeer, pi))
	mux.Handle("/api/v1/pi/models", PiModelsHandler(cfg, server.TrustedPeer, pi))
	mux.Handle("/api/v1/pi/claude-login", ClaudeLoginHandler(cfg, server.TrustedPeer, pi))
	mux.Handle(RepoCatalogPath, RepoCatalogHandler(cfg, server.TrustedPeer))
	mux.Handle(RepoLookupPath, RepoLookupHandler(cfg, server.TrustedPeer))
	mux.Handle(GitIdentityPath, GitIdentityHandler(cfg, server.TrustedPeer))
	clones := NewCloneJobs(ctx, cfg, server.TrustedPeer)
	mux.Handle(RepoClonesPath, clones.Handler())
	mux.Handle(RepoCloneEventsPath, clones.Events())
	mux.Handle(RepoObservePath, RepoObserveHandler(cfg, server.TrustedPeer, clones))

	mux.Handle(RepoPublishPath, RepoPublishHandler(cfg, server.TrustedPeer))
	mux.Handle(RepoDisconnectPath, RepoDisconnectHandler(cfg, server.TrustedPeer, adapter))
	journal := newEventJournal()
	controller := newConversationController(ctx, cfg, runtime, server.TrustedPeer, piStatus)
	controller.journal = journal
	mux.Handle("/api/v1/onboarding/pi/attempt", PiAttemptHandler(cfg, server.TrustedPeer, pi, controller.ClearPiAuthFailures))
	mux.Handle(WorkspaceGitPath, WorkspaceGitHandler(cfg, server.TrustedPeer))
	mux.Handle(WorkspacePath, WorkspaceHandlerWithArchive(cfg, server.TrustedPeer, controller))
	go watchNativeHistory(ctx, cfg, journal, nil)
	mux.Handle(SnapshotPath, snapshotHandlerWithController(cfg, server.TrustedPeer, Discover, nativeSessions, cfg.Home, adapter.ObservedStatus, journal, controller))
	mux.Handle("/api/v1/events", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		journal.stream(w, r, func() bool {
			return server.TrustedPeer(r)
		})
	}))
	mux.Handle("/api/v1/agents/", HistoryHandler(cfg, server.TrustedPeer))
	mux.Handle("/api/v1/conversations", controller)
	mux.Handle("/api/v1/conversations/", controller)
	defer controller.shutdown()
	// The handoff route that transport adds to outer logs its own outcome.
	outer := http.NewServeMux()
	outer.Handle("/", RequestLog(diagnostic.New(os.Stderr, "daemon").With("user", cfg.Username), server.TrustedPeer, mux))
	return server.ServeMux(ctx, listener, outer)
}

// RequestLog records the daemon's side of slow, failed and mutating requests.
// It reuses the gateway's request ID only from the verified gateway peer, and
// never generates one: a daemon line without an ID did not come through it.
func RequestLog(log *slog.Logger, trusted func(*http.Request) bool, next http.Handler) http.Handler {
	return diagnostic.Requests(log, diagnostic.RequestOptions{ID: func(r *http.Request) string {
		if id := r.Header.Get(diagnostic.RequestIDHeader); trusted(r) && diagnostic.ValidRequestID(id) {
			return id
		}
		return ""
	}}, next)
}
