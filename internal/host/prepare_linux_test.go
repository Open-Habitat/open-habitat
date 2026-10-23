//go:build linux

package host

import (
	"context"
	"errors"
	"github.com/Open-Habitat/open-habitat/internal/provision"
	"github.com/Open-Habitat/open-habitat/internal/storagebaseline"
	"github.com/Open-Habitat/open-habitat/internal/storagequota"
	"golang.org/x/sys/unix"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func prepareFixture(t *testing.T) (string, prepareSources, *int) {
	site, src, _, _ := storageFixture(t)
	root := filepath.Join(filepath.Dir(site), "root")
	if err := os.Mkdir(root, 0700); err != nil {
		t.Fatal(err)
	}
	calls := new(int)
	ops := quotaProbeOps{reserve: func(context.Context, int) (storagequota.ProbeRecord, error) {
		*calls++
		return storagequota.ProbeRecord{UID: 61000}, nil
	}, write: func(context.Context, int, *os.File, storagequota.ProbeRecord, string) error { return nil }, restore: func(int, storagequota.ProbeRecord) error { return nil }}
	return site, prepareSources{src, root, filepath.Dir(site), "unused", ops, time.Now, func(context.Context) (string, error) { return "988", nil }}, calls
}
func TestPrepareApprovalAndNoWrite(t *testing.T) {
	site, src, calls := prepareFixture(t)
	before := snapshot(t, filepath.Dir(site))
	preview, err := prepare(context.Background(), PrepareRequest{SitePath: site, DryRun: true}, src)
	if err != nil || !preview.Plan.Approvable || preview.Plan.Ready || len(preview.Would) == 0 || len(preview.Requirements) < 3 {
		t.Fatal(preview, err)
	}
	if snapshot(t, filepath.Dir(site)) != before || *calls != 0 {
		t.Fatal("preview wrote")
	}
	req := PrepareRequest{SitePath: site, ApprovedPlan: preview.Plan.PlanID, ApproveDisruption: true}
	req.ApprovedPlan = strings.Repeat("0", 64)
	if _, err = prepare(context.Background(), req, src); !errors.Is(err, ErrStalePlan) {
		t.Fatal(err)
	}
	if snapshot(t, filepath.Dir(site)) != before {
		t.Fatal("stale wrote")
	}
	req.ApprovedPlan = preview.Plan.PlanID
	result, err := prepare(context.Background(), req, src)
	if err != nil || result.Outcome != "prepared" || result.Operation == nil || result.Operation.Status != "completed" || *calls != 1 {
		t.Fatal(result, err, *calls)
	}
	preview, err = prepare(context.Background(), PrepareRequest{SitePath: site, DryRun: true}, src)
	if err != nil {
		t.Fatal(err)
	}
	req.ApprovedPlan = preview.Plan.PlanID
	before = snapshot(t, filepath.Dir(site))
	result, err = prepare(context.Background(), req, src)
	if err != nil || result.Outcome != "no_change" || *calls != 1 || snapshot(t, filepath.Dir(site)) != before {
		t.Fatal("not no-op", result, err, *calls)
	}
	// Policy drift invalidates approval, not just quota/volume drift.
	policy := policyPath(src.root, preparePolicies(Site{})[0].Path)
	if err = os.WriteFile(policy, []byte("{}"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err = prepare(context.Background(), req, src); !errors.Is(err, ErrStalePlan) {
		t.Fatal(err)
	}
}
func TestPrepareRefusesBeforeObservationAndCannotBeUnlocked(t *testing.T) {
	called := false
	observe := func(context.Context, string) (Plan, error) { called = true; return Plan{}, nil }
	for _, req := range []PrepareRequest{{SitePath: "relative", DryRun: true}, {SitePath: "/site.json", ApproveDisruption: true}, {SitePath: "/site.json", ApprovedPlan: strings.Repeat("a", 64)}, {SitePath: "/site.json", ApprovedPlan: "SECRET", DryRun: true}} {
		if _, err := preflightPrepare(context.Background(), req, observe); err == nil || called {
			t.Fatal(err)
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := preflightPrepare(ctx, PrepareRequest{SitePath: "/site.json", DryRun: true}, observe); !errors.Is(err, context.Canceled) || called {
		t.Fatal(err)
	}
	if _, err := preflightPrepare(context.Background(), PrepareRequest{SitePath: "/site.json", DryRun: true}, observe); !errors.Is(err, ErrHomeMount) {
		t.Fatal(err)
	}
}
func TestPrepareRecoveryAndCustomerOfflineWork(t *testing.T) {
	site, src, _ := prepareFixture(t)
	src.inspect.enforcement = func(homeMount) error { return os.ErrPermission }
	if _, err := prepare(context.Background(), PrepareRequest{SitePath: site, DryRun: true}, src); !errors.Is(err, ErrQuotaEnforcement) {
		t.Fatal(err)
	}
	src.inspect.enforcement = func(homeMount) error { return nil }
	l, err := openOperationLock(context.Background(), src.inspect.journal, src.inspect.owner, time.Now)
	if err != nil {
		t.Fatal(err)
	}
	s, err := loadSite(site, src.inspect.owner)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = l.Begin("prepare", strings.Repeat("a", 64), s.Release); err != nil {
		t.Fatal(err)
	}
	l.Close()
	before := snapshot(t, filepath.Dir(site))
	if _, err = prepare(context.Background(), PrepareRequest{SitePath: site, DryRun: true}, src); !errors.Is(err, ErrRecovery) {
		t.Fatal(err)
	}
	if snapshot(t, filepath.Dir(site)) != before {
		t.Fatal("evidence changed")
	}
}
func TestPrepareUnderLockAndUnsafePolicy(t *testing.T) {
	site, src, calls := prepareFixture(t)
	preview, err := prepare(context.Background(), PrepareRequest{SitePath: site, DryRun: true}, src)
	if err != nil {
		t.Fatal(err)
	}
	// Lock acquisition occurs after preliminary observation. Change a bound host
	// input at the injected clock boundary, which runs in Begin only; instead use
	// a busy writer to prove no probe runs outside the operation lock.
	l, err := openOperationLock(context.Background(), src.inspect.journal, src.inspect.owner, time.Now)
	if err != nil {
		t.Fatal(err)
	}
	_, err = prepare(context.Background(), PrepareRequest{SitePath: site, ApprovedPlan: preview.Plan.PlanID, ApproveDisruption: true}, src)
	if !errors.Is(err, ErrBusy) || *calls != 0 {
		t.Fatal(err, *calls)
	}
	l.Close()
	p := preparePolicies(Site{})[0]
	path := policyPath(src.root, p.Path)
	if err = ensurePolicyDir(filepath.Dir(path), src.inspect.owner); err != nil {
		t.Fatal(err)
	}
	if err = os.Symlink(site, path); err != nil {
		t.Fatal(err)
	}
	if _, err = prepare(context.Background(), PrepareRequest{SitePath: site, DryRun: true}, src); err == nil || *calls != 0 {
		t.Fatal(err)
	}
}

func TestPrepareRevalidatesApprovalUnderLock(t *testing.T) {
	site, src, calls := prepareFixture(t)
	preview, err := prepare(context.Background(), PrepareRequest{SitePath: site, DryRun: true}, src)
	if err != nil {
		t.Fatal(err)
	}
	original := src.inspect.broker
	changed := false
	src.inspect.broker = func(ctx context.Context) (provision.InstallationState, error) {
		fd, e := openDir(src.inspect.journal, src.inspect.owner, true)
		if e == nil {
			e = unix.Flock(fd, unix.LOCK_EX|unix.LOCK_NB)
			unix.Close(fd)
			if e == unix.EWOULDBLOCK && !changed {
				changed = true
				p := preparePolicies(Site{})[0]
				path := policyPath(src.root, p.Path)
				if e = ensurePolicyDir(filepath.Dir(path), src.inspect.owner); e != nil {
					t.Fatal(e)
				}
				if e = os.WriteFile(path, []byte("changed-after-approval"), 0600); e != nil {
					t.Fatal(e)
				}
			}
		}
		return original(ctx)
	}
	_, err = prepare(context.Background(), PrepareRequest{SitePath: site, ApprovedPlan: preview.Plan.PlanID, ApproveDisruption: true}, src)
	if !changed || !errors.Is(err, ErrStalePlan) || *calls != 0 {
		t.Fatal("no under-lock revalidation", changed, err, *calls)
	}
	if _, err = os.Stat(filepath.Join(src.inspect.journal, "active.json")); !os.IsNotExist(err) {
		t.Fatal("created operation before revalidation", err)
	}
}

func TestPreparePolicyFailureRetainsFence(t *testing.T) {
	for _, stop := range []string{"quota_probe", "policy_installing", "session_restarting"} {
		t.Run(stop, func(t *testing.T) {
			site, src, _ := prepareFixture(t)
			preview, err := prepare(context.Background(), PrepareRequest{SitePath: site, DryRun: true}, src)
			if err != nil {
				t.Fatal(err)
			}
			// Losing progress delivery at any durable phase cannot authorize replay,
			// especially after policy publication and before disruptive restarts.
			req := PrepareRequest{SitePath: site, ApprovedPlan: preview.Plan.PlanID, ApproveDisruption: true, Progress: func(phase string) error {
				if phase == stop {
					return os.ErrClosed
				}
				return nil
			}}
			result, err := prepare(context.Background(), req, src)
			if !errors.Is(err, os.ErrClosed) || result.Operation == nil || result.Operation.ID == "" || result.Outcome != "incomplete" {
				t.Fatal(result, err)
			}
			if stop == "session_restarting" && result.Operation.Phase != stop {
				t.Fatal("restart intent not durable", result.Operation)
			}
			if _, err = prepare(context.Background(), PrepareRequest{SitePath: site, DryRun: true}, src); (stop != "session_restarting" && !errors.Is(err, ErrRecovery)) || (stop == "session_restarting" && err != nil) {
				t.Fatal(err)
			}
		})
	}
}

func TestPrepareShippedPolicyAndMode(t *testing.T) {
	site, src, calls := prepareFixture(t)
	s, err := loadSite(site, src.inspect.owner)
	if err != nil {
		t.Fatal(err)
	}
	policies, err := src.policies(context.Background(), s)
	if err != nil {
		t.Fatal(err)
	}
	// A transport installing the release templates and native prepare install
	// identical files. No second tmpfiles policy or alternative proc bytes exist.
	for _, p := range policies {
		if err = installPolicy(src.root, p, src.inspect.owner); err != nil {
			t.Fatal(err)
		}
		st, e := os.Stat(policyPath(src.root, p.Path))
		if e != nil || st.Mode().Perm() != 0644 {
			t.Fatal(st, e)
		}
	}
	if _, err = os.Stat(policyPath(src.root, "/etc/tmpfiles.d/open-habitat-host.conf")); !os.IsNotExist(err) {
		t.Fatal("duplicate policy", err)
	}
	preview, err := prepare(context.Background(), PrepareRequest{SitePath: site, DryRun: true}, src)
	if err != nil {
		t.Fatal(err)
	}
	req := PrepareRequest{SitePath: site, ApprovedPlan: preview.Plan.PlanID, ApproveDisruption: true}
	result, err := prepare(context.Background(), req, src)
	if err != nil || result.Outcome != "prepared" || *calls != 1 {
		t.Fatal(result, err)
	}
	preview, err = prepare(context.Background(), PrepareRequest{SitePath: site, DryRun: true}, src)
	if err != nil || len(preview.Would) != 0 {
		t.Fatal(preview, err)
	}
	before := snapshot(t, filepath.Dir(site))
	req.ApprovedPlan = preview.Plan.PlanID
	result, err = prepare(context.Background(), req, src)
	if err != nil || result.Outcome != "no_change" || *calls != 1 || snapshot(t, filepath.Dir(site)) != before {
		t.Fatal(result, err)
	}
	if err = os.Chmod(policyPath(src.root, policies[0].Path), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err = prepare(context.Background(), req, src); !errors.Is(err, ErrStalePlan) {
		t.Fatal("policy mode not approved", err)
	}
}

func TestPrepareStorageBootPolicyContract(t *testing.T) {
	s := Site{}
	s.Storage.HomeUUID = "12345678-1234-1234-1234-123456789abc"
	for _, p := range preparePolicies(s) {
		if p.Path == "/etc/open-habitat/storage-policy.json" {
			got, ok := storagebaseline.ParsePolicy([]byte(p.Content))
			if !ok || got.HomeUUID != s.Storage.HomeUUID {
				t.Fatal("preparation cannot satisfy boot storage contract")
			}
			return
		}
	}
	t.Fatal("missing boot storage policy")
}

func TestPrepareNumericGIDAlreadyPreparedRerun(t *testing.T) {
	site, src, calls := prepareFixture(t)
	ctx := context.Background()
	for i := 0; i < 2; i++ {
		preview, err := prepare(ctx, PrepareRequest{SitePath: site, DryRun: true}, src)
		if err != nil {
			t.Fatal(err)
		}
		result, err := prepare(ctx, PrepareRequest{SitePath: site, ApprovedPlan: preview.Plan.PlanID, ApproveDisruption: true}, src)
		if err != nil || result.Outcome != "prepared" {
			t.Fatal(result, err)
		}
		b, err := os.ReadFile(policyPath(src.root, "/etc/systemd/system/open-habitat-proc.service"))
		if err != nil || !strings.Contains(string(b), "gid=988 /proc") || strings.Contains(string(b), "gid=open-habitat-proc") || strings.Contains(string(b), "gid=@") {
			t.Fatal(string(b), err)
		}
		// A runtime target change invalidates the no-op proof, as on the pilot.
		b, err = os.ReadFile(site)
		if err != nil {
			t.Fatal(err)
		}
		s, err := loadSite(site, src.inspect.owner)
		if err != nil {
			t.Fatal(err)
		}
		b = []byte(strings.Replace(string(b), s.Release.ManifestSHA256, strings.Repeat("f", 64), 1))
		if err = os.WriteFile(site, b, 0600); err != nil {
			t.Fatal(err)
		}
	}
	if *calls != 2 {
		t.Fatal("did not reprepare", *calls)
	}
}
