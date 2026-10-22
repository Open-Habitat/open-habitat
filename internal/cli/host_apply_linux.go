//go:build linux

package cli

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"os/signal"
	"path/filepath"
	"regexp"
	"syscall"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/host"
)

type hostApplyOptions struct {
	request host.ApplyRequest
	stream  bool
}

func parseHostApply(args []string, jsonMode bool) (hostApplyOptions, error) {
	var o hostApplyOptions
	seen := map[string]bool{}
	for i := 0; i < len(args); i++ {
		k := args[i]
		if seen[k] {
			return o, usage("duplicate host apply flag; inspect host apply --help")
		}
		seen[k] = true
		switch k {
		case "--dry-run":
			o.request.DryRun = true
		case "--output=jsonl":
			o.stream = true
		case "--site", "--approved-plan":
			i++
			if i == len(args) {
				return o, usage("host apply requires a value for --site and --approved-plan")
			}
			if k == "--site" {
				o.request.SitePath = args[i]
			} else {
				o.request.ApprovedPlan = args[i]
			}
		default:
			return o, usage("unknown host apply flag; expected --site, --approved-plan, --dry-run, --output=jsonl")
		}
	}
	r := o.request
	if !filepath.IsAbs(r.SitePath) || filepath.Clean(r.SitePath) != r.SitePath || r.SitePath == "/" || !seen["--site"] || (seen["--approved-plan"] && !regexp.MustCompile(`^[0-9a-f]{64}$`).MatchString(r.ApprovedPlan)) || (!r.DryRun && !seen["--approved-plan"]) {
		return o, usage("host apply requires --site /absolute/site.json and, for a real run, --approved-plan with the 64-character lowercase plan ID")
	}
	if !r.DryRun && (!o.stream || jsonMode) || o.stream && jsonMode {
		return o, usage("host apply uses --output=jsonl, not --json; --json is supported only with --dry-run")
	}
	return o, nil
}

type hostApplyEvent struct {
	SchemaVersion int               `json:"schema_version"`
	Event         string            `json:"event"`
	Seq           uint64            `json:"seq"`
	Component     string            `json:"component"`
	Phase         string            `json:"phase"`
	Code          string            `json:"code,omitempty"`
	Data          *host.ApplyResult `json:"data,omitempty"`
}

func hostApplyCommand(args []string, opts options, stdout, stderr io.Writer) int {
	o, err := parseHostApply(args, opts.json)
	if err != nil {
		return emitError(err, opts, stderr)
	}
	// Keep the actual signal to preserve the canon's distinct cancellation exits.
	signals := make(chan os.Signal, 2)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)
	defer signal.Stop(signals)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	done := make(chan struct{})
	defer close(done)
	cancelled := make(chan os.Signal, 1)
	go func() {
		select {
		case sig := <-signals:
			cancelled <- sig
			cancel()
		case <-done:
		}
	}()
	result, err := runHostApply(ctx, o, stdout)
	if err == nil {
		// No executor exists yet. Observer changes alone must not enable success
		// or leave a stream with no terminal event.
		err = system("host_executor_unavailable", "qualified host executor is not available in this release")
	}
	ce := hostError(err)
	if errors.Is(err, context.Canceled) {
		ce = &cliError{code: "cancelled", message: "host apply cancelled; no activation was attempted", exit: 130}
		select {
		case sig := <-cancelled:
			if sig == syscall.SIGTERM {
				ce.exit = 143
			}
		default:
		}
	}
	if result.Plan.PlanID != "" {
		b, _ := json.Marshal(envelope(result))
		ce.result = b
	}
	if o.stream {
		event := "error"
		if ce.code == "cancelled" {
			event = "cancelled"
		}
		// The stream has one terminal record. Fatal stderr remains the shared
		// envelope; a broken output pipe is a system error, never a successful run.
		if e := json.NewEncoder(stdout).Encode(hostApplyEvent{SchemaVersion: 1, Event: event, Seq: 2, Component: "host", Phase: "preflight", Code: ce.code, Data: &result}); e != nil {
			return emitError(system("host_output_unavailable", "cannot write the host apply result stream"), opts, stderr)
		}
	}
	return emitError(ce, opts, stderr)
}

func runHostApply(ctx context.Context, o hostApplyOptions, w io.Writer) (host.ApplyResult, error) {
	if o.stream {
		if err := json.NewEncoder(w).Encode(hostApplyEvent{SchemaVersion: 1, Event: "progress", Seq: 1, Component: "host", Phase: "preflight"}); err != nil {
			return host.ApplyResult{}, err
		}
	}
	return host.Apply(ctx, o.request)
}
