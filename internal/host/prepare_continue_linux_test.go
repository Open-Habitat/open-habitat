//go:build linux

package host

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	policy "github.com/Open-Habitat/open-habitat"
)

func interruptedSessionFixture(t *testing.T) (string, prepareSources, *int, Operation) {
	t.Helper()
	site, src, calls := prepareFixture(t)
	preview, err := prepare(context.Background(), PrepareRequest{SitePath: site, DryRun: true}, src)
	if err != nil {
		t.Fatal(err)
	}
	r, err := prepare(context.Background(), PrepareRequest{SitePath: site, ApprovedPlan: preview.Plan.PlanID, ApproveDisruption: true, Progress: func(p string) error {
		if p == "session_restarting" {
			return os.ErrClosed
		}
		return nil
	}}, src)
	if !errors.Is(err, os.ErrClosed) {
		t.Fatal(err)
	}
	legacy := strings.ReplaceAll(policy.ProcService, "gid=@PROC_GID@", "gid=open-habitat-proc")
	legacy = strings.ReplaceAll(legacy, "# host prepare renders @PROC_GID@ from the validated native exemption group.\n", "")
	if err = installPolicy(src.root, policyFile{"/etc/systemd/system/open-habitat-proc.service", legacy}, src.inspect.owner); err != nil {
		t.Fatal(err)
	}
	return site, src, calls, *r.Operation
}
func TestPrepareContinueSessionRestart(t *testing.T) {
	site, src, calls, old := interruptedSessionFixture(t)
	before := snapshot(t, filepath.Dir(site))
	preview, err := prepare(context.Background(), PrepareRequest{SitePath: site, DryRun: true}, src)
	if err != nil || !preview.Plan.Approvable || len(preview.Would) != 2 {
		t.Fatal(preview, err)
	}
	if snapshot(t, filepath.Dir(site)) != before {
		t.Fatal("preview wrote")
	}
	if _, err = prepare(context.Background(), PrepareRequest{SitePath: site, ApprovedPlan: old.PlanID, ApproveDisruption: true}, src); !errors.Is(err, ErrStalePlan) {
		t.Fatal("old approval accepted", err)
	}
	r, err := prepare(context.Background(), PrepareRequest{SitePath: site, ApprovedPlan: preview.Plan.PlanID, ApproveDisruption: true}, src)
	if err != nil || r.Outcome != "prepared" || r.Operation.ID != old.ID || r.Operation.PlanID != old.PlanID || r.Operation.Seq <= old.Seq || *calls != 1 {
		t.Fatal(r, err, *calls)
	}
	preview, err = prepare(context.Background(), PrepareRequest{SitePath: site, DryRun: true}, src)
	if err != nil {
		t.Fatal(err)
	}
	r, err = prepare(context.Background(), PrepareRequest{SitePath: site, ApprovedPlan: preview.Plan.PlanID, ApproveDisruption: true}, src)
	if err != nil || r.Outcome != "no_change" || *calls != 1 {
		t.Fatal(r, err)
	}
}
func TestPrepareContinueRefusesAmbiguousEvidence(t *testing.T) {
	for _, kind := range []string{"dirty-probe", "missing-probe", "probe-directory", "receipt-split", "staged-receipt", "staged-policy", "foreign-policy", "storage-policy", "target-change", "wrong-phase"} {
		t.Run(kind, func(t *testing.T) {
			site, src, _, o := interruptedSessionFixture(t)
			write := func(path string, b []byte) {
				t.Helper()
				if err := os.WriteFile(path, b, 0600); err != nil {
					t.Fatal(err)
				}
			}
			switch kind {
			case "dirty-probe":
				path := filepath.Join(src.inspect.journal, o.ID+"-probe.json")
				b, _ := os.ReadFile(path)
				write(path, []byte(strings.Replace(string(b), `"cleaned":true`, `"cleaned":false`, 1)))
			case "missing-probe":
				os.Remove(filepath.Join(src.inspect.journal, o.ID+"-probe.json"))
			case "probe-directory":
				if err := os.Mkdir(filepath.Join(src.home, ".open-habitat-probe-"+o.ID), 0700); err != nil {
					t.Fatal(err)
				}
			case "receipt-split":
				o.Seq++
				b, _ := json.Marshal(o)
				write(filepath.Join(src.inspect.journal, o.ID+".json"), b)
			case "staged-receipt":
				write(filepath.Join(src.inspect.journal, o.ID+".json.next"), []byte("{}"))
			case "staged-policy":
				write(policyPath(src.root, "/etc/systemd/system/open-habitat-proc.service.next"), []byte("unknown"))
			case "foreign-policy":
				write(policyPath(src.root, "/etc/systemd/system/open-habitat-proc.service"), []byte("foreign"))
			case "storage-policy":
				write(policyPath(src.root, "/etc/open-habitat/storage-policy.json"), []byte("{}"))
			case "target-change":
				b, _ := os.ReadFile(site)
				s, _ := loadSite(site, src.inspect.owner)
				write(site, []byte(strings.Replace(string(b), s.Release.ManifestSHA256, strings.Repeat("f", 64), 1)))
			case "wrong-phase":
				o.Phase = "policy_installing"
				b, _ := json.Marshal(o)
				write(filepath.Join(src.inspect.journal, "active.json"), b)
				write(filepath.Join(src.inspect.journal, o.ID+".json"), b)
			}
			before := snapshot(t, filepath.Dir(site))
			if _, err := prepare(context.Background(), PrepareRequest{SitePath: site, DryRun: true}, src); !errors.Is(err, ErrRecovery) {
				t.Fatal(err)
			}
			if snapshot(t, filepath.Dir(site)) != before {
				t.Fatal("refusal changed evidence")
			}
		})
	}
}

func TestPrepareContinueSameInputPolicyStage(t *testing.T) {
	site, src, calls, old := interruptedSessionFixture(t)
	s, err := loadSite(site, src.inspect.owner)
	if err != nil {
		t.Fatal(err)
	}
	ps, err := src.policies(context.Background(), s)
	if err != nil {
		t.Fatal(err)
	}
	path := policyPath(src.root, "/etc/systemd/system/open-habitat-proc.service.next")
	for _, p := range ps {
		if p.Path == "/etc/systemd/system/open-habitat-proc.service" {
			if err = os.WriteFile(path, []byte(p.Content), 0644); err != nil {
				t.Fatal(err)
			}
		}
	}
	before := snapshot(t, filepath.Dir(site))
	preview, err := prepare(context.Background(), PrepareRequest{SitePath: site, DryRun: true}, src)
	if err != nil || !preview.Plan.Approvable {
		t.Fatal(preview, err)
	}
	if snapshot(t, filepath.Dir(site)) != before {
		t.Fatal("preview wrote")
	}
	stage, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if err = os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if _, err = prepare(context.Background(), PrepareRequest{SitePath: site, ApprovedPlan: preview.Plan.PlanID, ApproveDisruption: true}, src); !errors.Is(err, ErrStalePlan) {
		t.Fatal("stage change not bound to approval", err)
	}
	if err = os.WriteFile(path, stage, 0644); err != nil {
		t.Fatal(err)
	}
	preview, err = prepare(context.Background(), PrepareRequest{SitePath: site, DryRun: true}, src)
	if err != nil {
		t.Fatal(err)
	}
	r, err := prepare(context.Background(), PrepareRequest{SitePath: site, ApprovedPlan: preview.Plan.PlanID, ApproveDisruption: true}, src)
	if err != nil || r.Outcome != "prepared" || r.Operation.ID != old.ID || *calls != 1 {
		t.Fatal(r, err, *calls)
	}
	if _, err = os.Lstat(path); !os.IsNotExist(err) {
		t.Fatal("stage not consumed", err)
	}
}

func TestPreparePreservesUnsafeJournalDiagnostic(t *testing.T) {
	site, src, _ := prepareFixture(t)
	if err := os.MkdirAll(src.inspect.journal, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(src.inspect.journal, 0750); err != nil {
		t.Fatal(err)
	}
	before := snapshot(t, filepath.Dir(site))
	r, err := prepare(context.Background(), PrepareRequest{SitePath: site, DryRun: true}, src)
	if !errors.Is(err, ErrPrepareBlocked) {
		t.Fatal("unsafe journal misclassified", r, err)
	}
	found := false
	for _, c := range r.Plan.Checks {
		if c.Code == "operation.fence" && c.Reason == "unsafe_operation_journal" {
			found = true
		}
	}
	if !found {
		t.Fatal("lost typed journal diagnostic", r)
	}
	if snapshot(t, filepath.Dir(site)) != before {
		t.Fatal("unsafe journal changed")
	}
}
