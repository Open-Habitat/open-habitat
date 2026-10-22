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

type hostMaintenanceOptions struct {
	request             host.ApplyRequest
	stream              bool
	prepare             bool
	upgrade             bool
	approveInterruption bool
	approveDisruption   bool
}

func parseHostApply(args []string, jsonMode bool) (hostMaintenanceOptions, error) {
	return parseHostMaintenance(args, jsonMode, false)
}

func parseHostMaintenance(args []string, jsonMode, prepare bool) (hostMaintenanceOptions, error) {
	o := hostMaintenanceOptions{prepare: prepare}
	command := "host apply"
	if prepare {
		command = "host prepare"
	}
	seen := map[string]bool{}
	for i := 0; i < len(args); i++ {
		k := args[i]
		if seen[k] {
			return o, usage("duplicate " + command + " flag; inspect " + command + " --help")
		}
		seen[k] = true
		switch k {
		case "--approve-disruption":
			if !prepare {
				return o, usage("--approve-disruption is only supported by host prepare")
			}
			o.approveDisruption = true
		case "--dry-run":
			o.request.DryRun = true
		case "--output=jsonl":
			o.stream = true
		case "--site", "--approved-plan":
			i++
			if i == len(args) {
				return o, usage(command + " requires a value for --site and --approved-plan")
			}
			if k == "--site" {
				o.request.SitePath = args[i]
			} else {
				o.request.ApprovedPlan = args[i]
			}
		default:
			return o, usage("unknown maintenance flag; inspect " + command + " --help")
		}
	}
	r := o.request
	if prepare && !r.DryRun && !o.approveDisruption {
		return o, usage("host prepare requires --approve-disruption for a real run; dry-run does not require approval")
	}
	if !filepath.IsAbs(r.SitePath) || filepath.Clean(r.SitePath) != r.SitePath || r.SitePath == "/" || !seen["--site"] || (seen["--approved-plan"] && !regexp.MustCompile(`^[0-9a-f]{64}$`).MatchString(r.ApprovedPlan)) || (!r.DryRun && !seen["--approved-plan"]) {
		return o, usage(command + " requires --site /absolute/site.json and, for a real run, --approved-plan with the 64-character lowercase plan ID")
	}
	if !r.DryRun && (!o.stream || jsonMode) || o.stream && jsonMode {
		return o, usage(command + " uses --output=jsonl, not --json; --json is supported only with --dry-run")
	}
	return o, nil
}

type hostMaintenanceEvent struct {
	SchemaVersion int    `json:"schema_version"`
	Event         string `json:"event"`
	Seq           uint64 `json:"seq"`
	Component     string `json:"component"`
	Phase         string `json:"phase"`
	Code          string `json:"code,omitempty"`
	Data          any    `json:"data,omitempty"`
}

func hostUpgradeCommand(args []string, opts options, stdout, stderr io.Writer) int {
	return hostMaintenanceMode(args, opts, stdout, stderr, false, true)
}

func hostApplyCommand(args []string, opts options, stdout, stderr io.Writer) int {
	return hostMaintenanceCommand(args, opts, stdout, stderr, false)
}

func hostMaintenanceCommand(args []string, opts options, stdout, stderr io.Writer, prepare bool) int {
	return hostMaintenanceMode(args, opts, stdout, stderr, prepare, false)
}

func hostMaintenanceMode(args []string, opts options, stdout, stderr io.Writer, prepare, upgrade bool) int {
	var o hostMaintenanceOptions
	var err error
	if upgrade {
		o, err = parseHostUpgrade(args, opts.json)
	} else {
		o, err = parseHostMaintenance(args, opts.json, prepare)
	}
	if err != nil {
		return emitError(err, opts, stderr)
	}
	// Keep the actual signal to preserve the canon's distinct cancellation exits.
	signals := make(chan os.Signal, 2)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)
	defer signal.Stop(signals)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
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
	phase := "preflight"
	seq := uint64(1)
	progress := func(next string) error {
		phase = next
		if !o.stream {
			return nil
		}
		seq++
		return json.NewEncoder(stdout).Encode(hostMaintenanceEvent{SchemaVersion: 1, Event: "progress", Seq: seq, Component: "host", Phase: phase})
	}
	result, err := runHostMaintenance(ctx, o, stdout, progress)
	if err == nil {
		if o.stream {
			if e := json.NewEncoder(stdout).Encode(hostMaintenanceEvent{SchemaVersion: 1, Event: "result", Seq: seq + 1, Component: "host", Phase: "completed", Data: result}); e != nil {
				return emitError(system("host_output_unavailable", "cannot write maintenance result; inspect operation before retry"), opts, stderr)
			}
			return 0
		}
		if e := json.NewEncoder(stdout).Encode(envelope(result)); e != nil {
			return emitError(system("host_output_unavailable", "cannot write maintenance result"), opts, stderr)
		}
		return 0
	}
	ce := hostError(err)
	if errors.Is(err, context.Canceled) {
		ce = &cliError{code: "cancelled", message: "host maintenance cancelled; inspect operation evidence before retry", exit: 130}
		if errors.Is(err, host.ErrEntryFence) {
			ce.message += "; durable entry closure unavailable, keep external ingress closed"
		}
		select {
		case sig := <-cancelled:
			if sig == syscall.SIGTERM {
				ce.exit = 143
			}
		default:
		}
	}
	if r, ok := result.(host.PrepareResult); ok && r.Operation != nil {
		phase = r.Operation.Phase
	}
	var data any
	if result != nil {
		data = result
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
		if e := json.NewEncoder(stdout).Encode(hostMaintenanceEvent{SchemaVersion: 1, Event: event, Seq: seq + 1, Component: "host", Phase: phase, Code: ce.code, Data: data}); e != nil {
			return emitError(system("host_output_unavailable", "cannot write the host maintenance result stream"), opts, stderr)
		}
	}
	return emitError(ce, opts, stderr)
}

func runHostMaintenance(ctx context.Context, o hostMaintenanceOptions, w io.Writer, progress func(string) error) (any, error) {
	if o.stream {
		if err := json.NewEncoder(w).Encode(hostMaintenanceEvent{SchemaVersion: 1, Event: "progress", Seq: 1, Component: "host", Phase: "preflight"}); err != nil {
			return nil, err
		}
	}
	if o.upgrade {
		r, e := host.Upgrade(ctx, host.UpgradeRequest{SitePath: o.request.SitePath, ApprovedPlan: o.request.ApprovedPlan, DryRun: o.request.DryRun, ApproveMaintenance: o.approveDisruption, ApproveInterruption: o.approveInterruption, Progress: progress})
		return r, e
	}
	if o.prepare {
		r, e := host.Prepare(ctx, host.PrepareRequest{SitePath: o.request.SitePath, ApprovedPlan: o.request.ApprovedPlan, DryRun: o.request.DryRun, ApproveDisruption: o.approveDisruption, Progress: progress})
		if r.Plan.PlanID == "" {
			return nil, e
		}
		return r, e
	}
	o.request.Progress = progress
	r, e := host.Apply(ctx, o.request)
	if r.Plan.PlanID == "" {
		return nil, e
	}
	return r, e
}

func parseHostUpgrade(args []string, jsonMode bool) (hostMaintenanceOptions, error) {
	filtered := []string{}
	seen := map[string]bool{}
	maintenance, interruption := false, false
	for i := 0; i < len(args); i++ {
		k := args[i]
		if k == "--approve-maintenance" || k == "--approve-interruption" {
			if seen[k] {
				return hostMaintenanceOptions{}, usage("duplicate host upgrade approval flag")
			}
			seen[k] = true
			if k == "--approve-maintenance" {
				maintenance = true
			} else {
				interruption = true
			}
			continue
		}
		if k == "--approve-disruption" {
			return hostMaintenanceOptions{}, usage("host upgrade uses --approve-maintenance and optional --approve-interruption")
		}
		filtered = append(filtered, k)
		if k == "--site" || k == "--approved-plan" {
			i++
			if i >= len(args) {
				return hostMaintenanceOptions{}, usage("missing host upgrade flag value")
			}
			filtered = append(filtered, args[i])
		}
	}
	o, e := parseHostMaintenance(filtered, jsonMode, false)
	if e != nil {
		return o, e
	}
	o.upgrade = true
	o.approveDisruption = maintenance
	o.approveInterruption = interruption
	if !o.request.DryRun && !maintenance {
		return o, usage("host upgrade requires --approve-maintenance; busy/unobservable work additionally requires --approve-interruption")
	}
	return o, nil
}
