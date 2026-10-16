// Package cli implements the non-interactive operator surface.
package cli

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/Open-Habitat/open-habitat/internal/core"
	"github.com/Open-Habitat/open-habitat/internal/daemon"
	"github.com/Open-Habitat/open-habitat/internal/gateway"
	"github.com/Open-Habitat/open-habitat/internal/provision"
	"github.com/Open-Habitat/open-habitat/internal/transport"
	"io"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime/debug"
	"strings"
	"syscall"

	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
)

const schemaVersion = 1

var version = "0.0.0-dev"
var buildCommit = ""

type options struct{ json, verbose bool }
type cliError struct {
	code, message string
	exit          int
	invalid       any
	expected      any
}

func (e *cliError) Error() string { return e.message }
func usage(message string) *cliError {
	return &cliError{code: "invalid_arguments", message: message, exit: 1}
}
func system(code, message string) *cliError { return &cliError{code: code, message: message, exit: 2} }
func Run(args []string, stdout, stderr io.Writer) int {
	opts, rest, globalErr := globals(args)
	if globalErr != nil {
		return emitError(globalErr, options{}, stderr)
	}
	var err error
	if len(rest) == 0 {
		return emitError(usage("a subcommand is required; expected version, config, doctor, gateway, daemon, broker, admin, maintenance, or skill"), opts, stderr)
	}
	if rest[0] == "--version" {
		rest = []string{"version"}
	}
	if !opts.json && len(rest) == 3 && rest[0] == "skill" && rest[1] == "print" && rest[2] == "operator" {
		fmt.Fprint(stdout, operatorSkillContent())
		return 0
	}
	var out any
	switch rest[0] {
	case "version":
		out, err = versionOutput(rest[1:])
	case "config":
		out, err = configCommand(rest[1:])
	case "doctor":
		out, err = doctorCommand(rest[1:])
	case "gateway", "daemon":
		out, err = execCommand(rest[0], rest[1:], opts, stderr)
	case "broker":
		out, err = brokerCommand(rest[1:])
	case "admin":
		out, err = adminCommand(rest[1:])
	case "maintenance":
		out, err = maintenanceCommand(rest[1:])
	case "revoke":
		out, err = revokeCommand(rest[1:])
	case "skill":
		out, err = skillCommand(rest[1:])
	case "help", "--help", "-h":
		out = helpOutput()
	default:
		err = usage(fmt.Sprintf("unknown subcommand %q", rest[0]))
	}
	if err != nil {
		// Service stderr is an operator diagnostic stream, not a place for
		// arbitrary config paths, native errors or credential-bearing URLs.
		if len(rest) >= 2 && rest[1] == "exec" && (rest[0] == "gateway" || rest[0] == "daemon" || rest[0] == "broker") {
			var ce *cliError
			reason := "internal_error"
			exit := 2
			if errors.As(err, &ce) {
				reason, exit = ce.code, ce.exit
			}
			diagnostic.New(stderr, rest[0]).Error("service_failed", "outcome", "failed", "reason", reason)
			return exit
		}
		return emitError(err, opts, stderr)
	}
	if out != nil {
		if opts.json {
			_ = json.NewEncoder(stdout).Encode(out)
		} else {
			fmt.Fprintln(stdout, text(out))
		}
	}
	return 0
}
func globals(args []string) (options, []string, *cliError) {
	var o options
	rest := make([]string, 0, len(args))
	for _, a := range args {
		switch a {
		case "--json":
			o.json = true
		case "--verbose":
			o.verbose = true
		default:
			if strings.HasPrefix(a, "--json=") || strings.HasPrefix(a, "--verbose=") {
				return o, nil, usage(fmt.Sprintf("invalid boolean flag %q; pass the flag without a value", a))
			}
			rest = append(rest, a)
		}
	}
	return o, rest, nil
}
func emitError(err error, o options, w io.Writer) int {
	ce := &cliError{code: "internal_error", message: err.Error(), exit: 2}
	errors.As(err, &ce)
	if o.json {
		payload := map[string]any{"schema_version": schemaVersion, "error": map[string]any{"code": ce.code, "message": ce.message}}
		_ = json.NewEncoder(w).Encode(payload)
	} else {
		fmt.Fprintf(w, "error: %s\n", ce.message)
	}
	return ce.exit
}
func text(v any) string { b, _ := json.MarshalIndent(v, "", "  "); return string(b) }
func envelope(data any) map[string]any {
	return map[string]any{"schema_version": schemaVersion, "data": data, "warnings": []any{}}
}
func noArgs(args []string) *cliError {
	if len(args) > 0 {
		return usage(fmt.Sprintf("unexpected argument %q", args[0]))
	}
	return nil
}
func versionOutput(args []string) (any, error) {
	if e := noArgs(args); e != nil {
		return nil, e
	}
	commit, prov := buildProvenance()
	return envelope(map[string]any{"version": version, "commit": commit, "schema_version": schemaVersion, "supported_schemas": []int{1}, "build_provenance": prov, "skills": []any{map[string]any{"name": "operator", "cli_version": version, "schema_version": 1}}}), nil
}
func buildProvenance() (any, map[string]any) {
	if len(buildCommit) == 40 {
		return buildCommit, map[string]any{"kind": "ci-injected", "note": "release build revision"}
	}
	if bi, ok := debug.ReadBuildInfo(); ok {
		for _, s := range bi.Settings {
			if s.Key == "vcs.revision" && len(s.Value) == 40 {
				return s.Value, map[string]any{"kind": "git", "note": "Go VCS build metadata"}
			}
		}
	}
	return nil, map[string]any{"kind": "vendored", "note": "no VCS revision in this development build"}
}
func componentFlag(args []string) (core.Component, []string, *cliError) {
	var c core.Component
	rest := []string{}
	for i := 0; i < len(args); i++ {
		if args[i] == "--component" {
			if i+1 >= len(args) {
				return "", nil, usage("--component requires gateway or daemon")
			}
			i++
			c = core.Component(args[i])
		} else {
			rest = append(rest, args[i])
		}
	}
	if c != core.Gateway && c != core.Daemon {
		return "", nil, usage(fmt.Sprintf("invalid --component %q; expected gateway or daemon", c))
	}
	return c, rest, nil
}
func configPath(c core.Component) string {
	if p := os.Getenv("OPEN_HABITAT_CONFIG"); p != "" {
		return p
	}
	return "/etc/open-habitat/" + string(c) + ".json"
}
func configCommand(args []string) (any, error) {
	if len(args) == 0 {
		return nil, usage("config requires path or show")
	}
	verb := args[0]
	c, rest, e := componentFlag(args[1:])
	if e != nil {
		return nil, e
	}
	if x := noArgs(rest); x != nil {
		return nil, x
	}
	p := configPath(c)
	source := "default"
	if os.Getenv("OPEN_HABITAT_CONFIG") != "" {
		source = "env"
	}
	switch verb {
	case "path":
		return envelope(map[string]any{"component": c, "path": p, "source": source}), nil
	case "show":
		_, statErr := os.Stat(p)
		return envelope(map[string]any{"component": c, "config_path": map[string]any{"value": p, "source": source}, "exists": statErr == nil, "data_root": map[string]any{"value": stateDir(), "source": stateSource()}}), nil
	default:
		return nil, usage(fmt.Sprintf("unknown config verb %q; expected path or show", verb))
	}
}
func doctorCommand(args []string) (any, error) {
	c, rest, e := componentFlag(args)
	if e != nil {
		return nil, e
	}
	if x := noArgs(rest); x != nil {
		return nil, x
	}
	checks := []any{map[string]any{"id": "binary.provenance", "status": "ok", "message": "version metadata is inspectable"}, map[string]any{"id": "config.path", "status": "ok", "message": fmt.Sprintf("%s config path resolves to %s", c, configPath(c))}, map[string]any{"id": "authority.boundary", "status": "ok", "message": fmt.Sprintf("%s role selected explicitly", c)}}
	return envelope(map[string]any{"component": c, "checks": checks, "summary": map[string]int{"ok": 3, "warn": 0, "fail": 0}}), nil
}
func parseConfig(args []string) (string, *cliError) {
	if len(args) != 3 || args[0] != "exec" || args[1] != "--config" || strings.TrimSpace(args[2]) == "" {
		return "", usage("expected exec --config <non-empty-path>")
	}
	return args[2], nil
}
func execCommand(role string, args []string, o options, stderr io.Writer) (any, error) {
	path, e := parseConfig(args)
	if e != nil {
		return nil, e
	}
	c := core.Component(role)
	cfg, err := core.LoadConfig(path, c)
	if err != nil {
		return nil, system("config_io", err.Error())
	}
	var h http.Handler
	if c == core.Gateway {
		if cfg.OAuth != nil {
			a, e := gateway.NewAuth(*cfg.OAuth, gateway.AuthOptions{Version: version, Provider: gateway.GitHubProvider{ClientID: cfg.OAuth.ClientID, ClientSecret: cfg.OAuth.ClientSecret, CallbackURL: cfg.OAuth.CallbackURL}, Sink: transport.NewSink(), Broker: gatewayBroker{}, SessionFile: "/var/lib/open-habitat-gateway/sessions.json", AdminFile: "/var/lib/open-habitat-gateway/administration.json", Log: gateway.CallbackLogger(stderr)})
			if e != nil {
				if errors.Is(e, gateway.ErrAdministrationState) {
					return nil, system("invalid_administration_state", "private gateway administration state requires operator repair")
				}
				return nil, system("invalid_auth_config", "invalid gateway authentication configuration")
			}
			control, controlErr := revokeListener()
			if controlErr != nil {
				return nil, system("activation_failed", "private revocation socket activation required")
			}
			defer control.Close()
			controlCtx, controlStop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
			defer controlStop()
			go serveRevocations(controlCtx, control, a)
			h = gateway.NewWithAuth(cfg.StaticDir, a)
		} else {
			h = gateway.New(cfg.StaticDir)
		}
	} else {
		if cfg.Handoff != nil {
			// No TCP fallback: activation and adapter preparation complete before Serve.
			ln, activationErr := activatedSocket(*cfg.Handoff)
			if activationErr != nil {
				return nil, system("activation_failed", "invalid daemon socket activation")
			}
			defer ln.Close()
			_, adapter, adapterErr := daemon.NewNativeHandoff(*cfg.Handoff)
			if adapterErr != nil {
				return nil, system("native_adapter_unavailable", "native credential adapter unavailable")
			}
			ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
			defer stop()
			// The JIT binding is byte-verified by the root broker. Pi's separate
			// installation selector is never taken from that per-user binding.
			runtime, runtimeErr := core.LoadSharedPiRuntime()
			if runtimeErr != nil {
				return nil, system("native_runtime_unavailable", "invalid Pi runtime selector")
			}
			diagnostic.New(stderr, role).Info("service_ready", "outcome", "ready")
			if err := daemon.ServeHTTP(ctx, ln, *cfg.Handoff, adapter, daemonHealthMux(), runtime); err != nil {
				// ServeHTTP returns only fixed, redacted startup/transport errors;
				// surface the reason so an unsafe runtime can be repaired.
				return nil, system("server_failed", "daemon socket service failed: "+err.Error())
			}
			return nil, nil
		}
		h = daemon.New()
	}
	ln, err := net.Listen("tcp", cfg.Listen)
	if err != nil {
		return nil, system("listen_failed", fmt.Sprintf("listen %q: %v", cfg.Listen, err))
	}
	diagnostic.New(stderr, role).Info("service_ready", "outcome", "ready")
	srv := &http.Server{Handler: h}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	go func() { <-ctx.Done(); srv.Shutdown(context.Background()) }()
	var serveErr error
	if cfg.OAuth != nil {
		serveErr = srv.ServeTLS(ln, cfg.TLSCert, cfg.TLSKey)
	} else {
		serveErr = srv.Serve(ln)
	}
	if err := serveErr; err != nil && err != http.ErrServerClosed {
		return nil, system("server_failed", err.Error())
	}
	return nil, nil
}
func daemonHealthMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.Handle("GET /healthz", daemon.New())
	return mux
}
func adminCommand(args []string) (any, error) {
	if len(args) == 2 && args[0] == "readiness" && args[1] == "show" {
		return envelope(map[string]any{"status": "foundation-only", "ready": false, "reason": "authentication and per-user routing are not implemented"}), nil
	}
	return adminServerCommand(args)
}
func stateDir() string {
	if p := os.Getenv("OPEN_HABITAT_STATE_DIR"); p != "" {
		return p
	}
	return "/run/open-habitat"
}
func stateSource() string {
	if os.Getenv("OPEN_HABITAT_STATE_DIR") != "" {
		return "env"
	}
	return "default"
}
func maintenanceCommand(args []string) (any, error) {
	if len(args) < 1 || (args[0] != "enter" && args[0] != "leave") {
		return nil, usage("maintenance requires enter or leave")
	}
	verb := args[0]
	key := ""
	dry := false
	for i := 1; i < len(args); i++ {
		switch args[i] {
		case "--dry-run":
			dry = true
		case "--idempotency-key":
			if i+1 >= len(args) {
				return nil, usage("--idempotency-key requires a non-empty value")
			}
			i++
			key = args[i]
		default:
			return nil, usage(fmt.Sprintf("unknown maintenance option %q", args[i]))
		}
	}
	if strings.TrimSpace(key) == "" {
		return nil, usage("--idempotency-key is required and must not be blank")
	}
	action := "create"
	if verb == "leave" {
		action = "delete"
	}
	if dry {
		return envelope(map[string]any{"dry_run": true, "would": []any{map[string]any{"action": action, "resource": "maintenance-marker", "input": map[string]any{"idempotency_key": key}}}}), nil
	}
	if err := os.MkdirAll(stateDir(), 0700); err != nil {
		return nil, system("io_create_state", err.Error())
	}
	p := filepath.Join(stateDir(), "maintenance")
	if verb == "enter" {
		if err := os.WriteFile(p, []byte(key+"\n"), 0600); err != nil {
			return nil, system("io_write_state", err.Error())
		}
	} else if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
		return nil, system("io_remove_state", err.Error())
	}
	return envelope(map[string]any{"state": map[string]string{"enter": "entered", "leave": "left"}[verb], "idempotency_key": key}), nil
}

const operatorSkill = `---
name: operator
description: Operate and diagnose Open Habitat runtime roles non-interactively.
cli_version: "0.0.0-dev"
schema_version: 1
---
# Open Habitat operator

Inspect configuration before starting a role. Prefer structured output:
    open-habitat --json doctor --component gateway
Never infer readiness from process liveness alone.
For first browser administrator appointment, wait for the person's binding,
then as root run admin users list --json to find the numeric subject, followed
by admin role update <subject> --administrator true --json. Use admin settings
show/update to inspect or change the shared name. These commands require the
running gateway and its root-only control socket, not a browser role.
`

func operatorSkillContent() string {
	return strings.Replace(operatorSkill, "0.0.0-dev", version, 1)
}

func skillCommand(args []string) (any, error) {
	if len(args) == 0 {
		return nil, usage("skill requires list, print, or install")
	}
	switch args[0] {
	case "list":
		if len(args) != 1 {
			return nil, usage("skill list takes no arguments")
		}
		return envelope(map[string]any{
			"supported_agents": []string{"claude", "pi", "codex"},
			"install": map[string]any{
				"selection_flag": "--agent", "default": "all", "accepted_values": []string{"claude", "pi", "codex", "all"},
				"target_flag": "--target", "dry_run_flag": "--dry-run", "force_flag": "--force", "interactive": false,
				"no_clobber_default": true, "overwrite_requires_force": true,
				"layouts": []any{
					map[string]string{"agent": "claude", "path": ".claude/skills/<name>/...", "form": "agent-skill-tree"},
					map[string]string{"agent": "pi", "path": ".pi/agent/skills/<name>/...", "form": "agent-skill-tree"},
					map[string]string{"agent": "codex", "path": ".codex/skills/<name>/...", "form": "agent-skill-tree"},
				},
			},
			"skills": []any{map[string]any{"name": "operator", "description": "Operate and diagnose Open Habitat"}},
		}), nil
	case "print":
		if len(args) != 2 || args[1] != "operator" {
			return nil, usage("expected skill print operator")
		}
		return envelope(map[string]any{"name": "operator", "cli_version": version, "schema_version_skill": 1, "content": operatorSkillContent(), "path_in_repo": "internal/cli/operator/SKILL.md"}), nil
	case "install":
		return skillInstall(args[1:])
	default:
		return nil, usage(fmt.Sprintf("unknown skill verb %q", args[0]))
	}
}
func skillInstall(args []string) (any, error) {
	if len(args) < 1 || args[0] != "operator" {
		return nil, usage("expected skill install operator --agent claude|pi|codex|all [--target PATH] [--dry-run] [--force]")
	}
	agent := "all"
	target := "."
	dry := false
	force := false
	for i := 1; i < len(args); i++ {
		switch args[i] {
		case "--agent":
			if i+1 >= len(args) {
				return nil, usage("--agent requires a value")
			}
			i++
			agent = args[i]
		case "--target":
			if i+1 >= len(args) {
				return nil, usage("--target requires a value")
			}
			i++
			target = args[i]
		case "--dry-run":
			dry = true
		case "--force":
			force = true
		default:
			return nil, usage(fmt.Sprintf("unknown skill install option %q", args[i]))
		}
	}
	layouts := map[string]string{"claude": ".claude/skills/operator/SKILL.md", "pi": ".pi/agent/skills/operator/SKILL.md", "codex": ".codex/skills/operator/SKILL.md"}
	selected := []string{}
	if agent == "all" {
		selected = []string{"claude", "pi", "codex"}
	} else if _, ok := layouts[agent]; ok {
		selected = []string{agent}
	} else {
		return nil, usage(fmt.Sprintf("invalid --agent %q; expected claude, pi, codex, or all", agent))
	}
	would := []any{}
	for _, a := range selected {
		p := filepath.Join(target, layouts[a])
		action := "create"
		if _, err := os.Stat(p); err == nil {
			action = "update"
			if !force {
				return nil, usage(fmt.Sprintf("refusing to overwrite existing skill %q without --force", p))
			}
		}
		would = append(would, map[string]any{"action": action, "resource": "skill", "path": p})
		if !dry {
			if err := os.MkdirAll(filepath.Dir(p), 0755); err != nil {
				return nil, system("io_create_skill", err.Error())
			}
			if err := os.WriteFile(p, []byte(operatorSkillContent()), 0644); err != nil {
				return nil, system("io_write_skill", err.Error())
			}
		}
	}
	return envelope(map[string]any{"dry_run": dry, "would": would}), nil
}
func helpOutput() any {
	return envelope(map[string]any{"name": "open-habitat", "subcommands": []string{"version", "config path|show", "doctor", "gateway exec", "daemon exec", "broker exec", "admin readiness show", "admin settings show|update", "admin users list", "admin role update", "admin storage list|update", "maintenance enter|leave", "revoke subject", "skill list|print|install"}, "global_flags": []string{"--json", "--verbose", "--version"}})
}

type gatewayBroker struct{}

func (gatewayBroker) ListBound(ctx context.Context) ([]gateway.BoundUser, error) {
	users := make([]gateway.BoundUser, 0)
	next := ""
	var generation uint64
	for {
		reply, err := (provision.Client{SocketPath: provision.BrokerSocket, SocketOwnerUID: 0}).Exchange(ctx, provision.Request{Version: 1, Operation: "list", Provider: "github", ID: "0", Candidate: next})
		if err != nil || reply.Failure != "" || reply.Users == nil || len(users) > 1024 || generation != 0 && reply.Generation != generation {
			return nil, gateway.ErrBrokerUnavailable
		}
		generation = reply.Generation
		for _, u := range *reply.Users {
			users = append(users, gateway.BoundUser{ID: u.ID, Username: u.Username})
		}
		if reply.Next == "" {
			return users, nil
		}
		if reply.Next == next || len(*reply.Users) == 0 {
			return nil, gateway.ErrBrokerUnavailable
		}
		next = reply.Next
	}
}
func (gatewayBroker) LookupBound(ctx context.Context, id string) (bool, error) {
	reply, err := (provision.Client{SocketPath: provision.BrokerSocket, SocketOwnerUID: 0}).Exchange(ctx, provision.Request{Version: 1, Operation: "lookup", Provider: "github", ID: id})
	if err != nil {
		return false, gateway.ErrBrokerUnavailable
	}
	if reply.Failure == provision.Denied {
		return false, nil
	}
	if reply.Failure != "" || reply.Users == nil || len(*reply.Users) != 1 || (*reply.Users)[0].ID != id {
		return false, gateway.ErrBrokerUnavailable
	}
	return true, nil
}

// mapBrokerReply translates only validated protocol enums, never wire text.
func mapBrokerReply(reply provision.Reply, err error) (gateway.BrokerReply, error) {
	if err != nil {
		return gateway.BrokerReply{}, gateway.BrokerTransport
	}
	switch reply.Failure {
	case provision.StateUnavailable:
		return gateway.BrokerReply{}, gateway.BrokerStateUnavailable
	case provision.Denied:
		return gateway.BrokerReply{}, gateway.BrokerDenied
	case provision.NameCollision:
		return gateway.BrokerReply{}, gateway.BrokerNameCollision
	case provision.Drift:
		return gateway.BrokerReply{}, gateway.BrokerDrift
	case provision.Invalid:
		// The requested diagnostic vocabulary has no invalid_request class.
		// Treat a rejected request as invalid_reply, never as transport.
		return gateway.BrokerReply{}, gateway.BrokerInvalidReply
	case "":
		if reply.Route == nil {
			return gateway.BrokerReply{}, gateway.BrokerInvalidReply
		}
		return gateway.BrokerReply{Route: &gateway.BrokerRoute{UID: reply.Route.UID, Username: reply.Route.Username, Socket: reply.Route.Socket}, Generation: reply.Generation, Epoch: reply.Epoch}, nil
	default:
		return gateway.BrokerReply{}, gateway.BrokerInvalidReply
	}
}
func (gatewayBroker) Exchange(ctx context.Context, r gateway.BrokerRequest) (gateway.BrokerReply, error) {
	request := provision.Request{Version: 1, Operation: r.Operation, Provider: "github", ID: r.ID, Candidate: r.Candidate}
	if r.Operation == "ensure" && r.DefaultLimitBytes != 0 {
		request.DefaultLimitBytes = &r.DefaultLimitBytes
	}
	reply, err := (provision.Client{SocketPath: provision.BrokerSocket, SocketOwnerUID: 0}).Exchange(ctx, request)
	return mapBrokerReply(reply, err)
}

// The gateway supplies only an authenticated provider subject. The broker
// resolves its committed binding and never accepts a client-selected UID.
func (gatewayBroker) ReadQuota(ctx context.Context, subject string) (gateway.Quota, gateway.QuotaFilesystem, error) {
	r, err := (provision.Client{SocketPath: provision.BrokerSocket, SocketOwnerUID: 0}).Exchange(ctx, provision.Request{Version: 1, Operation: "quota_read", Provider: "github", ID: subject})
	if err == nil && r.Failure == provision.Denied {
		return gateway.Quota{}, gateway.QuotaFilesystem{}, gateway.ErrBoundUserNotFound
	}
	if err != nil || r.Failure != "" || r.Quota == nil {
		return gateway.Quota{}, gateway.QuotaFilesystem{}, gateway.ErrBrokerUnavailable
	}
	return gateway.Quota{UsageBytes: r.Quota.UsageBytes, LimitBytes: r.Quota.LimitBytes}, gateway.QuotaFilesystem{CapacityBytes: r.Quota.CapacityBytes, FreeBytes: r.Quota.FreeBytes}, nil
}
func (gatewayBroker) SetQuota(ctx context.Context, subject string, limit uint64) error {
	r, err := (provision.Client{SocketPath: provision.BrokerSocket, SocketOwnerUID: 0}).Exchange(ctx, provision.Request{Version: 1, Operation: "quota_set", Provider: "github", ID: subject, LimitBytes: &limit})
	if err == nil && r.Failure == provision.Denied {
		return gateway.ErrBoundUserNotFound
	}
	if err != nil || r.Failure != "" || r.Quota == nil || r.Quota.LimitBytes != limit {
		return gateway.ErrBrokerUnavailable
	}
	return nil
}
