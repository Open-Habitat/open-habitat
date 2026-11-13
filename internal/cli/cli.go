// Package cli implements the non-interactive operator surface.
package cli

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/open-habitat/open-habitat/internal/core"
	"github.com/open-habitat/open-habitat/internal/daemon"
	"github.com/open-habitat/open-habitat/internal/gateway"
	"github.com/open-habitat/open-habitat/internal/provision"
	"github.com/open-habitat/open-habitat/internal/transport"
	"io"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime/debug"
	"strconv"
	"strings"
	"syscall"

	"github.com/open-habitat/open-habitat/internal/diagnostic"
)

const schemaVersion = 1

var version = "0.0.0-dev"
var buildCommit = ""

type options struct{ json, verbose bool }
type cliError struct {
	code, message string
	// detail is a fixed, enumerated word logged beside code on a service's
	// stderr, where message is never written.
	detail   string
	exit     int
	invalid  any
	expected any
	result   json.RawMessage
}

func (e *cliError) Error() string { return e.message }
func usage(message string) *cliError {
	return &cliError{code: "invalid_arguments", message: message, exit: 1}
}
func system(code, message string) *cliError { return &cliError{code: code, message: message, exit: 2} }
func Run(args []string, stdout, stderr io.Writer) int {
	opts, rest, globalErr := globals(args)
	if globalErr != nil {
		if protectedAgentArgs(args) {
			globalErr = usage("invalid global flag on protected credential surface; use --json or --verbose without a value")
		}
		return emitError(globalErr, options{}, stderr)
	}
	var err error
	if len(rest) == 0 {
		return emitError(usage("a subcommand is required; expected version, config, doctor, gateway, daemon, broker, admin, maintenance, or skill"), opts, stderr)
	}
	if rest[0] == "--version" {
		rest[0] = "version"
	}
	if !opts.json && len(rest) == 3 && rest[0] == "skill" && rest[1] == "print" && (rest[2] == "operator" || rest[2] == "agent") {
		fmt.Fprint(stdout, skillContent(rest[2]))
		return 0
	}
	var out any
	if helpRequested(rest) {
		if protectedAgentArgs(rest) && len(rest) >= 3 {
			out, err = commandHelp(rest[:3])
			if err != nil {
				err = usage("unknown protected command; inspect agent --help")
			}
		} else {
			out, err = commandHelp(rest)
		}
	} else {
		switch rest[0] {
		case "host":
			if len(rest) >= 2 && rest[1] == "upgrade" {
				return hostUpgradeCommand(rest[2:], opts, stdout, stderr)
			}
			if len(rest) >= 2 && rest[1] == "prepare" {
				return hostMaintenanceCommand(rest[2:], opts, stdout, stderr, true)
			}
			if len(rest) >= 2 && rest[1] == "apply" {
				return hostApplyCommand(rest[2:], opts, stdout, stderr)
			}
			out, err = hostCommand(rest[1:])
		case "agent":
			out, err = agentCommand(rest[1:])
		case "gitea":
			return giteaCommand(rest[1:], os.Stdin, stdout, stderr)
		case "gitlab":
			return gitlabCommand(rest[1:], os.Stdin, stdout, stderr)
		case "version":
			out, err = versionOutput(rest[1:])
		case "config":
			out, err = configCommand(rest[1:])
		case "doctor":
			out, err = doctorCommand(rest[1:])
		case "gateway", "daemon":
			if rest[0] == "daemon" && len(rest) >= 2 && rest[1] == "browser-host" {
				out, err = browserHostCommand(rest[2:], stderr)
				break
			}
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
	}
	if err != nil {
		// Service stderr is an operator diagnostic stream, not a place for
		// arbitrary config paths, native errors or credential-bearing URLs.
		if len(rest) >= 2 && rest[1] == "exec" && (rest[0] == "gateway" || rest[0] == "daemon" || rest[0] == "broker") {
			return logServiceFailure(stderr, rest[0], err)
		}
		return emitError(err, opts, stderr)
	}
	if out != nil {
		if opts.json {
			_ = json.NewEncoder(stdout).Encode(out)
		} else {
			printWarnings(out, stderr)
			if helpRequested(rest) {
				fmt.Fprintln(stdout, helpText(out))
			} else {
				fmt.Fprintln(stdout, text(out))
			}
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
		if ce.result != nil {
			payload["error"].(map[string]any)["result"] = ce.result
		}
		_ = json.NewEncoder(w).Encode(payload)
	} else {
		fmt.Fprintf(w, "error: %s\n", ce.message)
		if ce.result != nil {
			printWarnings(ce.result, w)
		}
	}
	return ce.exit
}
func printWarnings(v any, w io.Writer) {
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	var result struct {
		Warnings []struct {
			Message string `json:"message"`
			Fix     string `json:"fix_suggestion"`
		} `json:"warnings"`
	}
	if json.Unmarshal(b, &result) != nil {
		return
	}
	for _, warning := range result.Warnings {
		fmt.Fprintf(w, "warning: %s %s\n", warning.Message, warning.Fix)
	}
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
	return envelope(map[string]any{"version": version, "commit": commit, "schema_version": schemaVersion, "supported_schemas": []int{1}, "build_provenance": prov, "skills": []any{map[string]any{"name": "operator", "cli_version": version, "schema_version": 1}, map[string]any{"name": "agent", "cli_version": version, "schema_version": 1}}}), nil
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

// runningCommit is the source commit for the browser's version display, or
// empty when this development build has none.
func runningCommit() string {
	commit, _ := buildProvenance()
	s, _ := commit.(string)
	return s
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
	if !hasComponent(args[1:]) {
		return personalConfig(args)
	}
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
	if !hasComponent(args) {
		return personalDoctor(args)
	}
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
			a, e := gateway.NewAuth(*cfg.OAuth, gateway.AuthOptions{GitHubExpiryFile: gateway.GitHubExpiryFile, Version: version, Commit: runningCommit(), Provider: gateway.GitHubProvider{ClientID: cfg.OAuth.ClientID, ClientSecret: cfg.OAuth.ClientSecret, CallbackURL: cfg.OAuth.CallbackURL}, Sink: transport.NewSink(), Broker: gatewayBroker{}, SessionFile: "/var/lib/open-habitat-gateway/sessions.json", AdminFile: "/var/lib/open-habitat-gateway/administration.json", SiteKeyFile: "/var/lib/open-habitat-gateway/site-ai-key.json", Log: gateway.CallbackLogger(stderr)})
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
			ln, agentListener, activationErr := activatedSockets(*cfg.Handoff)
			if activationErr != nil {
				return nil, system("activation_failed", "invalid daemon socket activation")
			}
			defer ln.Close()
			defer agentListener.Close()
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
			if err := daemon.ServeHTTP(ctx, ln, *cfg.Handoff, adapter, daemonHealthMux(), runtime, daemon.AgentListener{Listener: agentListener, Version: version, Commit: runningCommit()}); err != nil {
				// The journal gets the refusing check's code, never the
				// message: an operator repairs that check from it.
				return nil, daemonServeFailure(err)
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
	if cfg.EntryGate != "" {
		h = entryGate(cfg.EntryGate, h)
	}
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

// logServiceFailure writes a service's last diagnostic: the error's code and,
// when it has one, its enumerated detail. The message is never written.
func logServiceFailure(stderr io.Writer, component string, err error) int {
	var ce *cliError
	reason, detail := "internal_error", ""
	exit := 2
	if errors.As(err, &ce) {
		reason, detail, exit = ce.code, ce.detail, ce.exit
	}
	fields := []any{"outcome", "failed", "reason", reason}
	if detail != "" {
		fields = append(fields, "detail", detail)
	}
	diagnostic.New(stderr, component).Error("service_failed", fields...)
	return exit
}
func daemonServeFailure(err error) *cliError {
	e := system("server_failed", "daemon socket service failed: "+err.Error())
	e.detail = daemon.StartupRefusalCode(err)
	return e
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
			"skills": []any{map[string]any{"name": "operator", "description": "Operate and diagnose Open Habitat"}, map[string]any{"name": "agent", "description": "Read your own native agent environment and launch context"}},
		}), nil
	case "print":
		if len(args) != 2 || (args[1] != "operator" && args[1] != "agent") {
			return nil, usage("expected skill print operator|agent")
		}
		return envelope(map[string]any{"name": args[1], "cli_version": version, "schema_version_skill": 1, "content": skillContent(args[1]), "path_in_repo": "internal/cli/" + args[1] + "/SKILL.md"}), nil
	case "install":
		return skillInstall(args[1:])
	default:
		return nil, usage(fmt.Sprintf("unknown skill verb %q", args[0]))
	}
}
func skillInstall(args []string) (any, error) {
	if len(args) < 1 || (args[0] != "operator" && args[0] != "agent") {
		return nil, usage("expected skill install operator|agent --agent claude|pi|codex|all [--target PATH] [--dry-run] [--force]")
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
	layouts := map[string]string{"claude": ".claude/skills/" + args[0] + "/SKILL.md", "pi": ".pi/agent/skills/" + args[0] + "/SKILL.md", "codex": ".codex/skills/" + args[0] + "/SKILL.md"}
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
			if err := os.WriteFile(p, []byte(skillContent(args[0])), 0644); err != nil {
				return nil, system("io_write_skill", err.Error())
			}
		}
	}
	return envelope(map[string]any{"dry_run": dry, "would": would}), nil
}
func helpOutput() any {
	return envelope(map[string]any{"name": "open-habitat", "subcommands": []string{"version", "config path|show", "doctor", "gateway exec", "daemon exec", "broker exec", "admin readiness show", "admin settings show|update", "admin onboarding show|update", "admin ai-key show|copies|set|delete|seed", "admin access list|lookup|add|remove", "admin integrations list|set|clear", "admin users list", "admin role update", "admin storage list|update", "maintenance enter|leave", "revoke subject", "skill list|print|install"}, "global_flags": []string{"--json", "--verbose", "--version"}})
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
		return gateway.BrokerReply{Route: &gateway.BrokerRoute{UID: reply.Route.UID, Username: reply.Route.Username, Socket: reply.Route.Socket}, Generation: reply.Generation, Epoch: reply.Epoch, Created: reply.Created}, nil
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
	if r.Quota.NotInUse {
		return gateway.Quota{}, gateway.QuotaFilesystem{CapacityBytes: r.Quota.CapacityBytes, FreeBytes: r.Quota.FreeBytes}, gateway.ErrQuotaNotInUse
	}
	return gateway.Quota{UsageBytes: r.Quota.UsageBytes, LimitBytes: r.Quota.LimitBytes}, gateway.QuotaFilesystem{CapacityBytes: r.Quota.CapacityBytes, FreeBytes: r.Quota.FreeBytes}, nil
}
func (gatewayBroker) ListQuotas(ctx context.Context) ([]gateway.QuotaRow, gateway.QuotaFilesystem, error) {
	return collectQuotaPages(ctx, func(ctx context.Context, r provision.Request) (provision.Reply, error) {
		return (provision.Client{SocketPath: provision.BrokerSocket, SocketOwnerUID: 0}).Exchange(ctx, r)
	})
}

func collectQuotaPages(ctx context.Context, exchange func(context.Context, provision.Request) (provision.Reply, error)) ([]gateway.QuotaRow, gateway.QuotaFilesystem, error) {
	rows := make([]gateway.QuotaRow, 0)
	next := ""
	var generation, epoch uint64
	var fs gateway.QuotaFilesystem
	seen := map[string]bool{}
	for {
		r, err := exchange(ctx, provision.Request{Version: 1, Operation: "quota_list", Provider: "github", ID: "0", Candidate: next})
		if err != nil || r.Failure != "" || r.Quotas == nil || generation != 0 && (r.Generation != generation || r.Epoch != epoch) {
			return nil, fs, gateway.ErrBrokerUnavailable
		}
		if generation == 0 {
			fs = gateway.QuotaFilesystem{CapacityBytes: r.Quotas.CapacityBytes, FreeBytes: r.Quotas.FreeBytes}
			if r.Quotas.NotInUse {
				return rows, fs, gateway.ErrQuotaNotInUse
			}
		}
		if r.Quotas.NotInUse {
			return nil, fs, gateway.ErrBrokerUnavailable
		}
		generation, epoch = r.Generation, r.Epoch
		if r.Quotas.CapacityBytes != fs.CapacityBytes {
			return nil, fs, gateway.ErrBrokerUnavailable
		}
		for _, q := range r.Quotas.Rows {
			if seen[q.ID] || len(rows) >= 4096 {
				return nil, fs, gateway.ErrBrokerUnavailable
			}
			seen[q.ID] = true
			rows = append(rows, gateway.QuotaRow{BoundUser: gateway.BoundUser{ID: q.ID, Username: q.Username}, Quota: gateway.Quota{UsageBytes: q.UsageBytes, LimitBytes: q.LimitBytes}, Unavailable: q.Unavailable})
		}
		if r.Next == "" {
			return rows, fs, nil
		}
		offset, err := strconv.Atoi(r.Next)
		if err != nil || offset != len(rows) || len(r.Quotas.Rows) == 0 {
			return nil, fs, gateway.ErrBrokerUnavailable
		}
		next = r.Next
	}
}

func (gatewayBroker) SetQuota(ctx context.Context, subject string, limit uint64) error {
	r, err := (provision.Client{SocketPath: provision.BrokerSocket, SocketOwnerUID: 0}).Exchange(ctx, provision.Request{Version: 1, Operation: "quota_set", Provider: "github", ID: subject, LimitBytes: &limit})
	if err == nil && r.Failure == provision.Denied {
		return gateway.ErrBoundUserNotFound
	}
	if err == nil && r.Failure == provision.QuotaNotInUse {
		return gateway.ErrQuotaNotInUse
	}
	if err != nil || r.Failure != "" || r.Quota == nil || r.Quota.LimitBytes != limit {
		return gateway.ErrBrokerUnavailable
	}
	return nil
}

// Admission operations (ADR 0030). A reply that does not arrive, or a
// state_unavailable after which the broker may already have committed, is
// uncertain; only the broker's fixed refusals are definite.
func (gatewayBroker) brokerAccess(ctx context.Context, r provision.Request) (provision.Reply, error) {
	return (provision.Client{SocketPath: provision.BrokerSocket, SocketOwnerUID: 0}).Exchange(ctx, r)
}
func (b gatewayBroker) AccessList(ctx context.Context) (gateway.AccessPage, error) {
	return collectAccessPages(ctx, b.brokerAccess)
}
func (b gatewayBroker) AccessRead(ctx context.Context, id string) (gateway.AccessPage, error) {
	r, err := b.brokerAccess(ctx, provision.Request{Version: 1, Operation: "access_read", Provider: "github", ID: id})
	if err != nil || r.Failure != "" || r.Access == nil || len(r.Access.Rows) > 1 || len(r.Access.Rows) == 1 && r.Access.Rows[0].ID != id {
		return gateway.AccessPage{}, gateway.ErrBrokerUnavailable
	}
	return accessPage(*r.Access), nil
}
func (b gatewayBroker) Admit(ctx context.Context, id, loginHint, actor string) (gateway.AccessRow, error) {
	return accessWrite(b.brokerAccess(ctx, provision.Request{Version: 1, Operation: "admit", Provider: "github", ID: id, LoginHint: loginHint, Actor: actor}))
}
func (b gatewayBroker) Withdraw(ctx context.Context, id, actor string) (gateway.AccessRow, error) {
	return accessWrite(b.brokerAccess(ctx, provision.Request{Version: 1, Operation: "withdraw", Provider: "github", ID: id, Actor: actor}))
}

// StopRevoked asks the broker to stop every revoked person's listeners.
// Any failure, including a missing reply, means some may still run.
func (b gatewayBroker) StopRevoked(ctx context.Context) error {
	r, err := b.brokerAccess(ctx, provision.Request{Version: 1, Operation: provision.OpStopRevoked, Provider: "github", ID: "0"})
	if err != nil || r.Failure != "" || r.Access == nil || len(r.Access.Rows) != 0 {
		return gateway.ErrAccessUncertain
	}
	return nil
}

// Team source operations. As with admission, only the broker's fixed
// refusals are definite; a missing reply or state_unavailable is uncertain.
func (b gatewayBroker) Teams(ctx context.Context) ([]gateway.TeamSource, error) {
	r, err := b.brokerAccess(ctx, provision.Request{Version: 1, Operation: provision.OpTeamList, Provider: "github", ID: "0"})
	if err != nil || r.Failure != "" || r.Access == nil {
		return nil, gateway.ErrBrokerUnavailable
	}
	return teamSources(*r.Access), nil
}
func (b gatewayBroker) AddTeam(ctx context.Context, orgID, org, slug, actor string) ([]gateway.TeamSource, error) {
	return teamWrite(b.brokerAccess(ctx, provision.Request{Version: 1, Operation: provision.OpTeamAdd, Provider: "github", ID: orgID, LoginHint: org, Slug: slug, Actor: actor}))
}
func (b gatewayBroker) RemoveTeam(ctx context.Context, orgID, slug, actor string) ([]gateway.TeamSource, error) {
	return teamWrite(b.brokerAccess(ctx, provision.Request{Version: 1, Operation: provision.OpTeamRemove, Provider: "github", ID: orgID, Slug: slug, Actor: actor}))
}
func (b gatewayBroker) TeamSignIn(ctx context.Context, id, login string, observed []gateway.TeamObservation) error {
	obs := make([]provision.TeamObservation, 0, len(observed))
	for _, o := range observed {
		obs = append(obs, provision.TeamObservation{OrgID: o.OrgID, Slug: o.Slug, TeamID: o.TeamID, State: o.State})
	}
	r, err := b.brokerAccess(ctx, provision.Request{Version: 1, Operation: provision.OpTeamSignIn, Provider: "github", ID: id, LoginHint: login, Teams: obs})
	if err == nil && r.Failure == "" && r.Access != nil && len(r.Access.Rows) <= 1 {
		return nil
	}
	_, err = accessWrite(r, err)
	if err == nil {
		err = gateway.ErrAccessUncertain
	}
	return err
}
func (b gatewayBroker) Forget(ctx context.Context, id, actor string) (gateway.AccessRow, error) {
	return accessWrite(b.brokerAccess(ctx, provision.Request{Version: 1, Operation: provision.OpForget, Provider: "github", ID: id, Actor: actor}))
}

func teamWrite(r provision.Reply, err error) ([]gateway.TeamSource, error) {
	if err == nil && r.Failure == "" {
		if r.Access == nil {
			return nil, gateway.ErrAccessUncertain
		}
		return teamSources(*r.Access), nil
	}
	_, err = accessWrite(r, err)
	return nil, err
}

func teamSources(p provision.AccessPage) []gateway.TeamSource {
	out := make([]gateway.TeamSource, 0, len(p.Teams))
	for _, t := range p.Teams {
		out = append(out, gateway.TeamSource{OrgID: t.OrgID, Org: t.Org, Slug: t.Slug, TeamID: t.TeamID, Actor: t.Actor, At: t.At, UnavailableAt: t.UnavailableAt})
	}
	return out
}

func accessWrite(r provision.Reply, err error) (gateway.AccessRow, error) {
	if err != nil {
		return gateway.AccessRow{}, gateway.ErrAccessUncertain
	}
	switch r.Failure {
	case "":
	case provision.RuntimeDisabled:
		return gateway.AccessRow{}, gateway.ErrAccessDisabled
	case provision.RuntimeFull:
		return gateway.AccessRow{}, gateway.ErrAccessFull
	case provision.AdmissionOpen:
		return gateway.AccessRow{}, gateway.ErrAccessOpen
	case provision.OperatorOwned:
		return gateway.AccessRow{}, gateway.ErrOperatorOwned
	case provision.Drift:
		return gateway.AccessRow{}, gateway.ErrAccessDrift
	case provision.StateUnavailable:
		return gateway.AccessRow{}, gateway.ErrAccessUncertain
	default:
		return gateway.AccessRow{}, gateway.ErrAccessRefused
	}
	if r.Access == nil || len(r.Access.Rows) != 1 {
		return gateway.AccessRow{}, gateway.ErrAccessUncertain
	}
	return accessPage(*r.Access).Rows[0], nil
}

// Live-limit operations. Only the broker's fixed refusals are definite; a
// missing reply or state_unavailable after a write is uncertain.
func (b gatewayBroker) LiveLimits(ctx context.Context) (gateway.LiveLimits, error) {
	r, err := b.brokerAccess(ctx, provision.Request{Version: 1, Operation: provision.OpLiveLimitList, Provider: "github", ID: "0"})
	if err != nil || r.Failure != "" || r.LiveLimits == nil {
		return gateway.LiveLimits{}, gateway.ErrBrokerUnavailable
	}
	return liveLimits(*r.LiveLimits), nil
}
func (b gatewayBroker) SetLiveLimit(ctx context.Context, subject string, limit int) (gateway.LiveLimits, error) {
	request := provision.Request{Version: 1, Operation: provision.OpLiveLimitClear, Provider: "github", ID: subject}
	if subject == "" {
		request.ID = "0"
	}
	if limit != 0 {
		request.Operation, request.LiveLimit = provision.OpLiveLimitSet, &limit
	}
	r, err := b.brokerAccess(ctx, request)
	switch {
	case err != nil || r.Failure == provision.StateUnavailable:
		return gateway.LiveLimits{}, gateway.ErrLiveLimitUncertain
	case r.Failure == provision.Denied:
		return gateway.LiveLimits{}, gateway.ErrBoundUserNotFound
	case r.Failure != "":
		return gateway.LiveLimits{}, gateway.ErrBrokerUnavailable
	case r.LiveLimits == nil:
		return gateway.LiveLimits{}, gateway.ErrLiveLimitUncertain
	}
	return liveLimits(*r.LiveLimits), nil
}
func liveLimits(p provision.LiveLimitPage) gateway.LiveLimits {
	out := gateway.LiveLimits{Default: p.Default, People: make([]gateway.LiveLimitPerson, 0, len(p.People))}
	for _, x := range p.People {
		out.People = append(out.People, gateway.LiveLimitPerson{ID: x.ID, Limit: x.Limit})
	}
	return out
}

// Integration app operations. As with admission, only the broker's fixed
// refusals are definite; a missing reply or state_unavailable is uncertain.
func (b gatewayBroker) IntegrationList(ctx context.Context) (gateway.IntegrationApps, error) {
	r, err := b.brokerAccess(ctx, provision.Request{Version: 1, Operation: provision.OpIntegrationList, Provider: "all", ID: "0"})
	if err != nil || r.Failure != "" || r.Integrations == nil {
		return gateway.IntegrationApps{}, gateway.ErrBrokerUnavailable
	}
	return integrationApps(*r.Integrations), nil
}
func (b gatewayBroker) SetIntegrationApp(ctx context.Context, provider string, fields map[string]string, actor string) (gateway.IntegrationApps, error) {
	return integrationWrite(b.brokerAccess(ctx, provision.Request{Version: 1, Operation: provision.OpIntegrationSet, Provider: provider, ID: "0", Actor: actor, Fields: fields}))
}
func (b gatewayBroker) ClearIntegrationApp(ctx context.Context, provider, actor string) (gateway.IntegrationApps, error) {
	return integrationWrite(b.brokerAccess(ctx, provision.Request{Version: 1, Operation: provision.OpIntegrationClear, Provider: provider, ID: "0", Actor: actor}))
}

func integrationWrite(r provision.Reply, err error) (gateway.IntegrationApps, error) {
	if err != nil {
		return gateway.IntegrationApps{}, gateway.ErrIntegrationUncertain
	}
	switch r.Failure {
	case "":
	case provision.BrowserSetupOff:
		return gateway.IntegrationApps{}, gateway.ErrBrowserSetupOff
	case provision.HostBusy:
		return gateway.IntegrationApps{}, gateway.ErrHostBusy
	case provision.IntegrationsFile:
		return gateway.IntegrationApps{}, gateway.ErrIntegrationsFile
	case provision.StateUnavailable:
		return gateway.IntegrationApps{}, gateway.ErrIntegrationUncertain
	default:
		return gateway.IntegrationApps{}, gateway.ErrIntegrationRefused
	}
	if r.Integrations == nil {
		return gateway.IntegrationApps{}, gateway.ErrIntegrationUncertain
	}
	return integrationApps(*r.Integrations), nil
}

func integrationApps(p provision.IntegrationPage) gateway.IntegrationApps {
	out := gateway.IntegrationApps{BrowserSetup: p.BrowserSetup, Apps: make([]gateway.IntegrationApp, 0, len(p.Apps))}
	for _, x := range p.Apps {
		out.Apps = append(out.Apps, gateway.IntegrationApp{Provider: x.Provider, ClientID: x.ClientID, TenantID: x.TenantID, Usable: x.Usable, Source: x.Source, Actor: x.Actor, At: x.At})
	}
	return out
}

func accessPage(p provision.AccessPage) gateway.AccessPage {
	out := gateway.AccessPage{Mode: p.Mode, RuntimeAdmission: p.RuntimeAdmission, Rows: make([]gateway.AccessRow, 0, len(p.Rows))}
	for _, x := range p.Rows {
		out.Rows = append(out.Rows, gateway.AccessRow{ID: x.ID, Source: x.Source, State: x.State, Username: x.Username, LoginHint: x.LoginHint, Actor: x.Actor, At: x.At, TeamState: x.TeamState, Teams: x.Teams})
	}
	return out
}

// collectAccessPages reads the whole admission list at one epoch.
func collectAccessPages(ctx context.Context, exchange func(context.Context, provision.Request) (provision.Reply, error)) (gateway.AccessPage, error) {
	var out gateway.AccessPage
	next := ""
	var epoch, generation uint64
	seen := map[string]bool{}
	for {
		r, err := exchange(ctx, provision.Request{Version: 1, Operation: "access_list", Provider: "github", ID: "0", Candidate: next})
		if err != nil || r.Failure != "" || r.Access == nil || epoch != 0 && (r.Epoch != epoch || r.Generation != generation || r.Access.Mode != out.Mode || r.Access.RuntimeAdmission != out.RuntimeAdmission) {
			return gateway.AccessPage{}, gateway.ErrBrokerUnavailable
		}
		page := accessPage(*r.Access)
		if epoch == 0 {
			out = gateway.AccessPage{Mode: page.Mode, RuntimeAdmission: page.RuntimeAdmission, Rows: []gateway.AccessRow{}}
		}
		epoch, generation = r.Epoch, r.Generation
		for _, row := range page.Rows {
			if seen[row.ID] || len(out.Rows) >= 1024 {
				return gateway.AccessPage{}, gateway.ErrBrokerUnavailable
			}
			seen[row.ID] = true
			out.Rows = append(out.Rows, row)
		}
		if r.Next == "" {
			return out, nil
		}
		offset, err := strconv.Atoi(r.Next)
		if err != nil || offset != len(out.Rows) || len(page.Rows) == 0 {
			return gateway.AccessPage{}, gateway.ErrBrokerUnavailable
		}
		next = r.Next
	}
}
