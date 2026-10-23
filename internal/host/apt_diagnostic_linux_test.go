//go:build linux

package host

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestAptFailureDiagnostics(t *testing.T) {
	for _, tc := range []struct{ text, class string }{
		{"E: Failed to fetch https://user:URL_SECRET@mirror.example/ubuntu/pool/zlib1g-dev_1.3_amd64.deb?token=QUERY_SECRET#FRAGMENT_SECRET 404 Not Found", "mirror_index_mismatch"},
		{"E: Hash Sum mismatch", "mirror_index_mismatch"},
		{"E: Unmet dependencies: git Depends: missing", "unmet_dependencies"},
		{"E: Unable to correct problems, you have held broken packages.", "held_or_broken_packages"},
		{"E: Could not get lock /var/lib/dpkg/lock-frontend. It is held by process 123", "dpkg_lock"},
		{"E: An unknown failure password=PASSWORD_SECRET\nAuthorization: Bearer AUTH_SECRET", "unknown"},
		{"E: password=\"PASSWORD_SECRET with spaces\"\nAuthori\x00zation: Basic AUTH_SECRET", "unknown"},
	} {
		t.Run(tc.class+tc.text[:3], func(t *testing.T) {
			e := aptFailure(tc.text, ErrNativeApply)
			if e.Class != tc.class || !errors.Is(e, ErrNativeApply) {
				t.Fatal(e)
			}
			for _, secret := range []string{"URL_SECRET", "QUERY_SECRET", "FRAGMENT_SECRET", "PASSWORD_SECRET", "AUTH_SECRET"} {
				if strings.Contains(e.Error(), secret) {
					t.Fatal("leaked", secret)
				}
			}
			if tc.class == "mirror_index_mismatch" && strings.Contains(tc.text, "404") && (!strings.Contains(e.Excerpt, "404") || !strings.Contains(e.Excerpt, "zlib1g-dev_1.3_amd64.deb")) {
				t.Fatal(e)
			}
		})
	}
	long := aptFailure(strings.Repeat("E: harmless diagnostic\n", 200)+"E: Failed https://user:URL_SECRET@mirror.example/pool/git_2_amd64.deb?token=QUERY_SECRET 404", ErrNativeApply)
	if len(long.Excerpt) > maxAptExcerpt || !strings.HasPrefix(long.Excerpt, "[truncated]") || !strings.Contains(long.Excerpt, "404") || strings.Contains(long.Excerpt, "SECRET") {
		t.Fatal(long)
	}
	var b aptStderr
	b.Write([]byte(strings.Repeat("x", 128*1024)))
	b.Write([]byte("\nE: Hash Sum mismatch\n"))
	e := b.failure(context.DeadlineExceeded)
	if len(b.data) > 64*1024 || len(e.Excerpt) > maxAptExcerpt || e.Class != "mirror_index_mismatch" || !errors.Is(e, context.DeadlineExceeded) {
		t.Fatal(e)
	}
	if !strings.Contains(e.Excerpt, "Hash Sum mismatch") {
		t.Fatal(e)
	}
	// A single oversized line may start with a credential outside the retained tail.
	b = aptStderr{}
	b.Write([]byte("password=" + strings.Repeat("SECRET", 20000)))
	if strings.Contains(b.failure(ErrNativeApply).Excerpt, "SECRET") {
		t.Fatal("partial line leaked")
	}
}

func TestApplyAptFailureJournalAndContinuation(t *testing.T) {
	dir, owner := operationFixture(t)
	p := Plan{Inspection: Inspection{Target: Release{"0.1.0", strings.Repeat("0", 64)}}, PlanID: strings.Repeat("1", 64), Approvable: true}
	fail := true
	d := applyDriver{journal: dir, owner: owner, now: time.Now, observe: func(context.Context, string) (Plan, error) { return p, nil }, binding: func(context.Context, string) (string, error) { return "bound", nil }, complete: func(context.Context) (bool, error) { return !fail, nil }, steps: []applyStep{{"staging", func(context.Context) error {
		if fail {
			return errors.Join(ErrRuntimePackages, ErrRuntimePackageInstall, aptFailure("E: Failed to fetch https://u:SECRET@mirror.example/pool/git_2_amd64.deb 404 Not Found", ErrNativeApply))
		}
		return nil
	}}}}
	req := ApplyRequest{SitePath: "/site.json", ApprovedPlan: p.PlanID}
	r, err := executeApply(context.Background(), req, d)
	if !errors.Is(err, ErrRuntimePackageInstall) || r.Operation == nil {
		t.Fatal(r, err)
	}
	got, err := showOperation(dir, r.Operation.ID, owner)
	if err != nil || got != *r.Operation || !strings.Contains(got.AptFailure, "404") || strings.Contains(got.AptFailure, "SECRET") || got.Status != "running" {
		t.Fatal(got, err)
	}
	fail = false
	r, err = executeApply(context.Background(), req, d)
	if err != nil || r.Outcome != "applied" || r.Operation.AptFailure != "" {
		t.Fatal(r, err)
	}
}

func TestUpgradeAptFailureJournal(t *testing.T) {
	d, req, _, _ := upgradeTestDriver(t)
	d.steps = []upgradeStep{{"activating", func(context.Context, *Lock, Operation) error {
		return errors.Join(ErrRuntimePackageInstall, aptFailure("E: Could not get lock /var/lib/dpkg/lock-frontend", context.DeadlineExceeded))
	}}}
	r, err := executeUpgrade(context.Background(), req, d)
	if !errors.Is(err, context.DeadlineExceeded) || r.Operation == nil {
		t.Fatal(r, err)
	}
	got, err := showOperation(d.journal, r.Operation.ID, d.owner)
	if err != nil || got != *r.Operation || !strings.Contains(got.AptFailure, "dpkg_lock") || r.EntryClosure != "verified_closed" {
		t.Fatal(got, err)
	}
}
