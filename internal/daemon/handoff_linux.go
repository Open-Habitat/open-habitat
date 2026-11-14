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

	"github.com/open-habitat/open-habitat/internal/core"
	"github.com/open-habitat/open-habitat/internal/daemon/integrations"
	"github.com/open-habitat/open-habitat/internal/diagnostic"
	"github.com/open-habitat/open-habitat/internal/nativegh"
	"github.com/open-habitat/open-habitat/internal/nativegitea"
	"github.com/open-habitat/open-habitat/internal/nativegitlab"
	"github.com/open-habitat/open-habitat/internal/transport"
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
func ServeHTTP(ctx context.Context, listener *net.UnixListener, cfg transport.Config, adapter *nativegh.Adapter, mux *http.ServeMux, runtime *core.PiRuntimeConfig, agents ...AgentListener) error {
	if adapter == nil {
		return refuse(RefusalAdapterUnavailable, errors.New("native credential adapter unavailable"))
	}
	// The person's explicit reconnect that got the workflow scope is their
	// opt-in to it, remembered beside the token.
	adapter.OnReconnected(func(scopes []string) {
		if rememberGitHubWorkflow(cfg.Home, scopes) != nil {
			diagnostic.New(os.Stderr, "daemon").Warn("github_workflow_preference", "outcome", "failed", "reason", "preferences_unavailable")
		}
	})
	server, err := transport.NewServer(cfg, adapter.Consumer())
	if err != nil {
		return refuse(RefusalTransportConfig, err)
	}
	if mux == nil {
		mux = http.NewServeMux()
	}
	// A missing selector is an unsafe deployment, not a first-use login state.
	if runtime == nil {
		return refuse(RefusalPiRuntimeMissing, errors.New("native Pi runtime unavailable"))
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
	// A completed sign-in or a saved key ends a provider's refusal: the
	// conversations forget it and every open page reads the snapshot again.
	var signedIn func()
	credentials := afterKeySaved(PiCredentialsHandler(cfg, server.TrustedPeer, pi), func() { signedIn() })
	for _, path := range PiCredentialPaths(PiCredentialsPath) {
		mux.Handle(path, credentials)
	}
	mux.Handle(SiteKeyPath, SiteKeyHandler(cfg, server.TrustedPeer, pi))
	speech := NewSpeech(cfg, server.TrustedPeer)
	speech.Mount(mux)
	mux.Handle("/api/v1/pi/models", PiModelsHandler(cfg, server.TrustedPeer, pi))
	mux.Handle(RecapSettingsPath, RecapSettingsHandler(cfg, server.TrustedPeer, pi))
	claude := &claudeLogin{device: pi, onSignedIn: func() { signedIn() }}
	mux.Handle("/api/v1/pi/claude-login", claude.handler(cfg, server.TrustedPeer))
	mux.Handle(RepoCatalogPath, RepoCatalogHandler(cfg, server.TrustedPeer))
	githubOrgs := newGitHubOrgs(func(ctx context.Context, args ...string) ([]byte, error) { return runRepoGH(ctx, cfg.Home, args...) })
	mux.Handle(RepoLookupPath, repoLookupHandlerNoting(cfg, server.TrustedPeer, githubOrgs))
	mux.Handle(GitIdentityPath, GitIdentityHandler(cfg, server.TrustedPeer))
	integrationEnv := newIntegrationEnv(cfg)
	forges := Forges{Gitea: newGitea(cfg, integrationEnv), GitLab: newGitLab(cfg, integrationEnv)}
	clones := NewCloneJobs(ctx, cfg, server.TrustedPeer).WithForges(forges)
	server.SetPlanConsumer(clones.Plan)
	server.SetSeedConsumer(func(ctx context.Context, s transport.Seed) string { return pi.SeedSiteKey(ctx, s.Provider, s.Key) })
	mux.Handle(RepoClonesPath, clones.Handler())
	mux.Handle(RepoCloneEventsPath, clones.Events())
	mux.Handle(RepoObservePath, RepoObserveHandler(cfg, server.TrustedPeer, clones))

	mux.Handle(RepoPublishPath, RepoPublishHandler(cfg, server.TrustedPeer))
	mux.Handle(RepoDisconnectPath, RepoDisconnectHandler(cfg, server.TrustedPeer, adapter))
	journal := newEventJournal()
	controller := newConversationController(ctx, cfg, runtime, server.TrustedPeer, piStatus)
	controller.journal = journal
	// A changed GitHub connection or organisation restriction is news to
	// every open page: it reads the snapshot again. A connection check that
	// ends while a snapshot is being built counts against it like a native
	// write: that snapshot may carry "checking" under a cursor already past
	// this news, so it leaves another notice after its cursor.
	adapter.OnChange(func() { journal.appendInvalidation("") })
	githubOrgs.changed = journal.appendSnapshotRaceInvalidation
	controller.github = &githubWatch{recheck: adapter.Recheck, orgs: githubOrgs}
	go controller.recapRestingConversations(ctx)
	signedIn = func() {
		controller.ClearPiAuthFailures()
		journal.appendInvalidation("")
	}
	mux.Handle("/api/v1/onboarding/pi/attempt", PiAttemptHandler(cfg, server.TrustedPeer, pi, signedIn))
	mux.Handle(WorkspaceGitPath, WorkspaceGitHandler(cfg, server.TrustedPeer))
	mux.Handle(WorkspaceGitFetchPath, WorkspaceGitFetchHandler(cfg, server.TrustedPeer, forges))
	mux.Handle(EditorFilesPrefix, controller.EditorFiles())
	mux.Handle(AccountPreferencesPath, AccountPreferencesHandler(cfg, server.TrustedPeer))
	mux.Handle(AccountKeysPath, AccountKeysHandler(cfg, server.TrustedPeer))
	mux.Handle(StorageBreakdownPath, StorageBreakdownHandler(cfg, server.TrustedPeer))
	mux.Handle(OwnMachinesPath, OwnMachinesHandler(cfg, server.TrustedPeer))
	mux.Handle(FirstRoutePath, FirstRouteHandler(cfg, server.TrustedPeer))
	mux.Handle(WorkspaceFilesPath, WorkspaceFilesHandler(cfg, server.TrustedPeer))
	mux.Handle(WorkspaceFilePreviewPath, WorkspaceFilePreviewHandler(cfg, server.TrustedPeer))
	mux.Handle(WorkspaceFileTreePath, WorkspaceFileTreeHandler(cfg, server.TrustedPeer))
	mux.Handle(WorkspaceIconPath, WorkspaceIconHandler(cfg, server.TrustedPeer))
	views := ViewsHandler(cfg, server.TrustedPeer)
	mux.Handle(ViewsPath, views)
	mux.Handle(ViewsPath+"/", views)
	mux.Handle(WorkspaceCommandsPath, controller.WorkspaceCommands())
	mux.Handle(WorkspaceStartPagePath, controller.WorkspaceStartPage())
	mux.Handle(WorkspaceIconSuggestionsPath, controller.WorkspaceIconSuggestions())
	terminals := newTerminalHost(ctx, cfg, diagnostic.New(os.Stderr, "daemon").With("user", cfg.Username, "component", "terminal"))
	mux.Handle(TerminalsPath, terminals.TerminalsHandler(server.TrustedPeer))
	mux.Handle(TerminalClosePath, terminals.TerminalCloseHandler(server.TrustedPeer))
	mux.Handle(TerminalPath, terminals.TerminalHandler(server.TrustedPeer))
	mux.Handle(WorkspacePath, WorkspaceHandlerWithArchive(cfg, server.TrustedPeer, controller))
	go watchNativeHistory(ctx, cfg, journal, nil)
	attachments := AttachmentsHandler(cfg, server.TrustedPeer)
	mux.Handle(AttachmentsPath, attachments)
	mux.Handle(AttachmentsPath+"/", attachments)
	mux.Handle(SnapshotPath, snapshotHandlerWithForges(cfg, server.TrustedPeer, DiscoverListing, nativeSessions, cfg.Home, adapter.ObservedConnection, journal, controller, forges))
	mux.Handle("/api/v1/events", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		journal.stream(w, r, func() bool {
			return server.TrustedPeer(r)
		})
	}))
	mux.Handle("/api/v1/agents/", HistoryHandler(cfg, server.TrustedPeer))
	mux.Handle(ContextDetailPattern, ContextDetailHandler(cfg, server.TrustedPeer, pi))
	catalog := newIntegrations(ctx, cfg, integrationEnv, forges)
	// A recovery, migration or login cancelled at shutdown finishes its step
	// before the daemon exits.
	defer catalog.Stop()
	integrationRoutes := catalog.Handler(func(r *http.Request) bool { return historyAuthorized(cfg, server.TrustedPeer, r) })
	for _, path := range []string{integrations.ListPath, integrations.AccountsPath, integrations.LoginPath, integrations.GiteaPath, integrations.GiteaReposPath, integrations.GitLabPath, integrations.GitLabReposPath, integrations.GitLabTokensPath, integrations.FilesPath} {
		mux.Handle(path, integrationRoutes)
	}
	mux.Handle("/api/v1/conversations", controller)
	mux.Handle("/api/v1/conversations/", controller)
	defer controller.shutdown()
	browser := newBrowserHost(ctx, cfg, diagnostic.New(os.Stderr, "daemon").With("user", cfg.Username, "component", "browser"))
	controller.browser = browser
	browser.mount(mux, server.TrustedPeer)
	editor := EditorHandler(ctx, cfg, server.TrustedPeer, diagnostic.New(os.Stderr, "daemon").With("user", cfg.Username, "component", "editor"))
	for _, path := range []string{EditorPath, EditorStartPath, EditorWorkspacePath, EditorOpenPath, EditorStopPath} {
		mux.Handle(path, editor)
	}
	// The handoff route that transport adds to outer logs its own outcome.
	outer := http.NewServeMux()
	outer.Handle("/", RequestLog(diagnostic.New(os.Stderr, "daemon").With("user", cfg.Username), server.TrustedPeer, mux))
	// The editor relay is code-server's traffic, long-lived connections
	// included, with paths that are not fixed routes: it is not logged per
	// request.
	outer.Handle(EditorRelayPrefix, editor)
	// View files are read per request like the editor relay, with paths that
	// are the person's file names: not logged per request either.
	outer.Handle(ViewExportPrefix, ViewExportHandler(cfg, server.TrustedPeer))
	// Offered files likewise: their paths are the person's file names.
	offers := FileOffersHandler(cfg, server.TrustedPeer)
	outer.Handle(FileOffersPath, offers)
	outer.Handle(FileOffersPath+"/", offers)
	// Share this controller, not the browser mux or its trusted-peer capability.
	if len(agents) > 0 {
		agent := agents[0]
		child, cancel := context.WithCancel(ctx)
		defer cancel()
		results := make(chan error, 2)
		go func() {
			results <- listenerRefusal(RefusalAgentListener, RefusalAgentServeEnded, transport.ServeAgent(child, agent.Listener, cfg, agentHandlerWithLogins(cfg, controller, agent.Version, agent.Commit, pi, catalog, claude, speech, clones)))
		}()
		go func() {
			results <- listenerRefusal(RefusalDaemonListener, RefusalDaemonServeEnded, server.ServeMux(child, listener, outer))
		}()
		err := <-results
		cancel()
		other := <-results
		if err != nil {
			return err
		}
		return other
	}
	return listenerRefusal(RefusalDaemonListener, RefusalDaemonServeEnded, server.ServeMux(ctx, listener, outer))
}

// listenerRefusal tags a transport serve error: a listener refused before
// serving, or an accept loop that ended on its own.
func listenerRefusal(refused, ended string, err error) error {
	if errors.Is(err, transport.ErrServeEnded) {
		return refuse(ended, err)
	}
	return refuse(refused, err)
}

// newIntegrations starts the person's integration catalog (ADR 0026): the
// operator's pinned tools, run as this user, with sync clients supervised for
// the daemon's lifetime. An untrusted or malformed operator configuration
// leaves every entry unavailable rather than stopping the daemon.
func newIntegrations(ctx context.Context, cfg transport.Config, env integrations.Env, forges Forges) *integrations.Catalog {
	log := diagnostic.New(os.Stderr, "daemon").With("user", cfg.Username, "component", "integrations")
	opts := []integrations.Option{integrations.WithTrash(func(rel string) error { return TrashCloudDirectory(cfg.Home, rel) })}
	if forges.Gitea != nil {
		opts = append(opts, integrations.WithGitea(forges.Gitea))
	}
	if forges.GitLab != nil {
		opts = append(opts, integrations.WithGitLab(forges.GitLab))
	}
	catalog := integrations.New(env, integrations.Production(), log, opts...)
	catalog.Start(ctx)
	return catalog
}

func newIntegrationEnv(cfg transport.Config) integrations.Env {
	log := diagnostic.New(os.Stderr, "daemon").With("user", cfg.Username, "component", "integrations")
	load := func() (integrations.Config, error) {
		cfg, err := integrations.LoadConfig(log)
		if err != nil {
			log.Warn("integrations_config", "outcome", "ignored", "reason", "untrusted_configuration")
		}
		return cfg, err
	}
	return integrations.Env{Home: cfg.Home, LoadConfig: load}
}

// newGitea is the one Gitea adapter the integrations routes and the clone
// jobs share (ADR 0031). Git runs this binary as the credential helper; a
// daemon that cannot name its own executable offers no Gitea. The helper is
// registered at the path systemd launched the daemon through
// (/opt/open-habitat/current/open-habitat), so a person's Git configuration
// keeps working after an upgrade switches that selector and the previous
// generation is removed, and the next daemon finds its registration its own.
func newGitea(cfg transport.Config, env integrations.Env) *integrations.GiteaAdapter {
	executable, err := os.Executable()
	if err != nil {
		return nil
	}
	g, err := integrations.NewGitea(env, nativegitea.NewClient(), "/usr/bin/git", launchedExecutable(executable, os.Args[0]))
	if err != nil {
		return nil
	}
	return g
}

// newGitLab is the one GitLab adapter the integrations routes and the clone
// jobs share, with the helper registered at the launch path as for Gitea.
func newGitLab(cfg transport.Config, env integrations.Env) *integrations.GitLabAdapter {
	executable, err := os.Executable()
	if err != nil {
		return nil
	}
	g, err := integrations.NewGitLab(env, nativegitlab.NewClient(), "/usr/bin/git", launchedExecutable(executable, os.Args[0]))
	if err != nil {
		return nil
	}
	return g
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
