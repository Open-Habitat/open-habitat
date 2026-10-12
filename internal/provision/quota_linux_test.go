//go:build linux

package provision

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/storagequota"
)

func TestQuotaProtocolStrict(t *testing.T) {
	for _, raw := range []string{
		`{"version":1,"operation":"quota_set","provider":"github","id":"42"}`,
		`{"version":1,"operation":"quota_set","provider":"github","id":"42","limit_bytes":null}`,
		`{"version":1,"operation":"quota_set","provider":"github","id":"42","limit_bytes":1048577}`,
		`{"version":1,"operation":"quota_read","provider":"github","id":"42","uid":2100}`,
		`{"version":1,"operation":"quota_read","provider":"github","id":"42","limit_bytes":1048576}`,
		`{"version":1,"operation":"ensure","provider":"github","id":"42","candidate":"alice","default_limit_bytes":0}`,
		`{"version":1,"operation":"ensure","provider":"github","id":"42","candidate":"alice","default_limit_bytes":1125899906843648}`,
	} {
		if _, err := ParseRequest([]byte(raw)); err == nil {
			t.Fatalf("accepted %s", raw)
		}
	}
	for _, raw := range []string{
		`{"version":1,"quota":{"usage_bytes":12,"limit_bytes":1048576,"uid":2100},"generation":1,"epoch":1}`,
		`{"version":1,"quota":{"limit_bytes":1048576},"generation":1,"epoch":1}`,
		`{"version":1,"quota":{"usage_bytes":12,"limit_bytes":1048576},"generation":1,"epoch":1,"route":{}}`,
		`{"version":1,"quota":{"usage_bytes":12,"limit_bytes":1048576,"capacity_bytes":100,"free_bytes":101},"generation":1,"epoch":1}`,
	} {
		if _, err := ParseReply([]byte(raw)); err == nil {
			t.Fatalf("accepted %s", raw)
		}
	}
}

func TestQuotaUnavailableBeforeFirstAccountLeavesNoHostMutation(t *testing.T) {
	w, h := writerFixture(t)
	w.QuotaEnabled = func() error { return storagequota.ErrUnavailable }
	if err := w.Startup(context.Background()); err == nil {
		t.Fatal("empty broker started without quota accounting")
	}
	if got := handle(w, "ensure", "42", "carol"); got.Failure != StateUnavailable {
		t.Fatalf("unavailable quota accepted: %+v", got)
	}
	if !fileAbsent(filepath.Join(w.Dir, "pending.json")) || len(h.steps) != 0 {
		t.Fatal("host mutated before quota preflight")
	}
}

func TestQuotaStartupDiagnosticsHaveFixedReasons(t *testing.T) {
	w, _ := writerFixture(t)
	var stages []string
	w.GuardEvent = func(stage string) { stages = append(stages, stage) }
	w.QuotaEnabled = func() error { return storagequota.ErrUnavailable }
	if err := w.Startup(context.Background()); err == nil || len(stages) != 1 || stages[0] != "quota_not_enforced" {
		t.Fatalf("unavailable filesystem: %v %v", err, stages)
	}
	w.QuotaEnabled = func() error { return nil }
	if got := handle(w, "ensure", "42", "carol"); got.Route == nil {
		t.Fatal(got)
	}
	w.Quota.(*fakeQuota).quota.Limit = 0
	if err := w.Startup(context.Background()); err == nil || len(stages) != 2 || stages[1] != "binding_quota_missing" {
		t.Fatalf("unlimited bound account: %v %v", err, stages)
	}
}

func TestQuotaBoundAndJournaled(t *testing.T) {
	w, _ := writerFixture(t)
	q := w.Quota.(*fakeQuota)
	missing := request("ensure", "42", "carol")
	missing.DefaultLimitBytes = nil
	if got := w.Handle(context.Background(), missing); got.Failure != Invalid {
		t.Fatal(got)
	}
	if !fileAbsent(filepath.Join(w.Dir, "pending.json")) {
		t.Fatal("journal before default validated")
	}
	q.fail = true
	if got := handle(w, "ensure", "42", "carol"); got.Failure != Drift {
		t.Fatal(got)
	}
	b, err := os.ReadFile(filepath.Join(w.Dir, "bindings.json"))
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != `{"version":1,"generation":7,"bindings":[]}` {
		t.Fatalf("published after quota failure: %s", b)
	}
	var j journal
	b, err = os.ReadFile(filepath.Join(w.Dir, "pending.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err := decode(b, &j, "version", "id", "username", "uid", "phase", "epoch", "generation"); err != nil || j.Phase != "quota" {
		t.Fatalf("journal: %+v %v", j, err)
	}
	// A separate clean fixture exercises successful publication and bound-only admin.
	w, _ = writerFixture(t)
	q = w.Quota.(*fakeQuota)
	if got := handle(w, "ensure", "42", "carol"); got.Route == nil || q.uid != got.Route.UID {
		t.Fatal(got, q.uid)
	}
	q.fail = true
	if got := w.Handle(context.Background(), Request{Version: 1, Operation: "authorize", Provider: "github", ID: "42"}); got.Route != nil || got.Failure != StateUnavailable {
		t.Fatalf("route permitted after quota accounting lost: %+v", got)
	}
	if err := w.Startup(context.Background()); err == nil {
		t.Fatal("broker started without readable user quota")
	}
	q.fail = false
	q.quota.Usage = 2 << 30
	limit := uint64(1 << 20) // deliberately below current usage
	r := Request{Version: 1, Operation: "quota_set", Provider: "github", ID: "42", LimitBytes: &limit}
	if got := w.Handle(context.Background(), r); got.Quota == nil || got.Quota.UsageBytes != 2<<30 || got.Quota.LimitBytes != limit || q.uid != 2100 {
		t.Fatal(got, q.uid)
	}
	if got := w.Handle(context.Background(), Request{Version: 1, Operation: "quota_read", Provider: "github", ID: "42"}); got.Quota == nil || got.Quota.LimitBytes != limit {
		t.Fatal(got)
	}
	if got := w.Handle(context.Background(), Request{Version: 1, Operation: "quota_read", Provider: "github", ID: "43"}); got.Failure != Denied {
		t.Fatal(got)
	}
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":5,"ids":[]}`)
	if got := w.Handle(context.Background(), r); got.Quota == nil || got.Quota.LimitBytes != limit {
		t.Fatalf("revoked account could not be administered: %+v", got)
	}
	if got := w.Handle(context.Background(), Request{Version: 1, Operation: "authorize", Provider: "github", ID: "42"}); got.Failure != Denied {
		t.Fatalf("quota administration readmitted revoked account: %+v", got)
	}
}
