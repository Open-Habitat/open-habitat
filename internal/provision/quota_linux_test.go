//go:build linux

package provision

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/storagequota"
)

func TestQuotaProtocolStrict(t *testing.T) {
	for _, raw := range []string{
		`{"version":1,"operation":"quota_list","provider":"github","id":"42"}`,
		`{"version":1,"operation":"quota_list","provider":"github","id":"0","candidate":"-1"}`,
		`{"version":1,"operation":"quota_list","provider":"github","id":"0","uid":2100}`,
		`{"version":1,"operation":"quota_list","provider":"github","id":"0","limit_bytes":1048576}`,
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

// Model ordinary systemctl latency while keeping the real five-second control
// budget. An unavailable account must not erase the other 49 observations.
type slowQuotaHost struct {
	HostExecutor
	delay time.Duration
	drift string
}

func (h slowQuotaHost) Verify(ctx context.Context, i ExecutorIdentity) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(h.delay):
	}
	if i.ID() == h.drift {
		return ErrInvalid
	}
	return nil
}

type uidQuotas struct {
	seen []uint32
	fail uint32
}

func (q *uidQuotas) Read(uid uint32) (storagequota.Quota, error) {
	q.seen = append(q.seen, uid)
	if uid == q.fail {
		return storagequota.Quota{}, errors.New("private native failure")
	}
	return storagequota.Quota{Usage: uint64(uid), Limit: 1 << 30}, nil
}
func (q *uidQuotas) Set(uint32, uint64) error { return ErrInvalid }

func TestQuotaPages50WithinControlDeadline(t *testing.T) {
	w, h := writerFixture(t)
	w.UIDMax = 2149
	bindings := make([]binding, 0, 50)
	for i := 0; i < 50; i++ {
		bindings = append(bindings, binding{ID: strconv.Itoa(i + 1), Username: fmt.Sprintf("user%d", i), UID: uint32(2100 + i)})
	}
	put(t, w.Dir, "bindings.json", string(marshal(ledgerFile{Version: 1, Generation: 7, Bindings: bindings})))
	q := &uidQuotas{fail: 2123}
	w.Quota = q
	w.Executor = slowQuotaHost{HostExecutor: h, delay: 100 * time.Millisecond, drift: "7"}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	start := time.Now()
	next := ""
	rows := []QuotaRow{}
	for {
		r := w.Handle(ctx, Request{Version: 1, Operation: "quota_list", Provider: "github", ID: "0", Candidate: next})
		wire, err := EncodeReply(r)
		if err != nil || len(wire) > MaxMessage || r.Quotas == nil {
			t.Fatalf("page failed: %+v %v", r, err)
		}
		rows = append(rows, r.Quotas.Rows...)
		if r.Next == "" {
			break
		}
		next = r.Next
	}
	t.Logf("50 committed accounts (100ms verify, one unit drift, one quota failure): %.3f seconds", time.Since(start).Seconds())
	if len(rows) != 50 || ctx.Err() != nil {
		t.Fatalf("incomplete list %d: %v", len(rows), ctx.Err())
	}
	for i, row := range rows {
		unavailable := i == 6 || i == 23
		if row.Unavailable != unavailable || unavailable && (row.UsageBytes != 0 || row.LimitBytes != 0) || !unavailable && row.UsageBytes != uint64(2100+i) {
			t.Fatalf("wrong UID/error isolation: %+v", row)
		}
	}
	for _, uid := range q.seen {
		if uid < 2100 || uid > 2149 || uid == 2106 {
			t.Fatalf("unverified UID queried: %d", uid)
		}
	}
}

func TestQuotaPageReplyRejectsMalformedRows(t *testing.T) {
	base := Reply{Version: 1, Generation: 1, Epoch: 1, Quotas: &QuotaPage{Rows: []QuotaRow{{BoundUser: BoundUser{ID: "42", Username: "alice"}, UsageBytes: 1, LimitBytes: 1 << 30}}, CapacityBytes: 2 << 30, FreeBytes: 1 << 30}}
	good, err := EncodeReply(base)
	if err != nil {
		t.Fatal(err)
	}
	for _, raw := range []string{
		strings.Replace(string(good), `"unavailable":false`, `"unavailable":null`, 1),
		strings.Replace(string(good), `"unavailable":false`, `"unavailable":true`, 1),
		strings.Replace(string(good), `"usage_bytes":1`, `"usage_bytes":1,"uid":2100`, 1),
		strings.Replace(string(good), `"limit_bytes":1073741824`, `"limit_bytes":0`, 1),
		strings.Replace(string(good), `"capacity_bytes":2147483648`, `"capacity_bytes":null`, 1),
	} {
		if _, err := ParseReply([]byte(raw)); err == nil {
			t.Fatalf("accepted malformed page %s", raw)
		}
	}
	base.Quotas.Rows = []QuotaRow{}
	if _, err := EncodeReply(base); err != nil {
		t.Fatal("empty installation quota page", err)
	}
	base.Quotas.Rows = []QuotaRow{{BoundUser: BoundUser{ID: "42", Username: "alice"}, Unavailable: true}}
	if _, err := EncodeReply(base); err != nil {
		t.Fatal("unavailable-only quota page", err)
	}
}
