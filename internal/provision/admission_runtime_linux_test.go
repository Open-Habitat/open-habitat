//go:build linux

package provision

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func admit(w Writer, id, hint, actor string) Reply {
	return w.Handle(context.Background(), Request{Version: 1, Operation: "admit", Provider: "github", ID: id, LoginHint: hint, Actor: actor})
}
func withdraw(w Writer, id, actor string) Reply {
	return w.Handle(context.Background(), Request{Version: 1, Operation: "withdraw", Provider: "github", ID: id, Actor: actor})
}
func accessRow(t *testing.T, r Reply) AccessRow {
	t.Helper()
	if r.Failure != "" || r.Access == nil || len(r.Access.Rows) != 1 {
		t.Fatalf("not one access row: %+v", r)
	}
	return r.Access.Rows[0]
}
func allowState(t *testing.T, dir string) allowFile {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(dir, "allowlist.json"))
	if err != nil {
		t.Fatal(err)
	}
	var a allowFile
	if json.Unmarshal(b, &a) != nil {
		t.Fatal(string(b))
	}
	return a
}

func runtimeWriter(t *testing.T, on bool) (Writer, *fakeHost) {
	t.Helper()
	w, h := writerFixture(t)
	w.Now = func() time.Time { return time.Date(2026, 10, 24, 9, 30, 0, 0, time.UTC) }
	put(t, w.Dir, "allowlist.json", fmt.Sprintf(`{"version":1,"epoch":4,"ids":[{"id":"42"}],"runtime_admission":%t}`, on))
	return w, h
}

// The switch governs only what the gateway may add: with it off, admit is
// refused although the request arrives on the gateway's own socket, while
// withdraw keeps working and an operator id is reported as already admitted.
func TestRuntimeAdmissionSwitch(t *testing.T) {
	w, _ := runtimeWriter(t, false)
	if r := admit(w, "50", "newcomer", "42"); r.Failure != RuntimeDisabled {
		t.Fatal("admit with the switch off", r)
	}
	if a := allowState(t, w.Dir); a.Epoch != 4 || a.Runtime != nil {
		t.Fatalf("refused admit wrote: %+v", a)
	}
	if row := accessRow(t, admit(w, "42", "operator", "42")); row.Source != SourceOperator || row.State != StateAllowed {
		t.Fatal("operator id not reported admitted", row)
	}
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":4,"ids":[{"id":"42"}],"runtime_admission":false,"runtime":[{"id":"51","state":"admitted","login_hint":"kept","actor":"42","at":"2026-10-24T09:00:00Z"}]}`)
	if row := accessRow(t, admit(w, "51", "kept", "42")); row.State != StateAllowed || row.Actor != "42" {
		t.Fatal("already-admitted id refused with the switch off", row)
	}
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":5,"ids":[{"id":"42"}],"runtime_admission":false,"runtime":[{"id":"52","state":"admitted","login_hint":"later","actor":"42","at":"2026-10-24T09:00:00Z"}]}`)
	if row := accessRow(t, withdraw(w, "52", "root")); row.State != StateRemoved || row.Actor != "root" {
		t.Fatal("withdraw while the switch is off", row)
	}
	if a := allowState(t, w.Dir); a.Runtime != nil || a.Epoch != 6 {
		t.Fatalf("never-bound withdrawal left state: %+v", a)
	}
	w.AdmitAny = true
	if r := admit(w, "53", "anyone", "42"); r.Failure != AdmissionOpen {
		t.Fatal(r)
	}
	if r := withdraw(w, "53", "42"); r.Failure != AdmissionOpen {
		t.Fatal(r)
	}
}

// Admission is the union of both sources; operator entries are never the
// gateway's to withdraw; a bound withdrawal keeps its entry so restore returns
// the same account; a never-bound one leaves nothing.
func TestRuntimeAdmissionWithdrawRestore(t *testing.T) {
	w, h := runtimeWriter(t, true)
	row := accessRow(t, admit(w, "50", "Newcomer", "42"))
	if row.Source != SourceSiteAdmin || row.State != StateAllowed || row.Actor != "42" || row.At != "2026-10-24T09:30:00Z" || row.LoginHint != "Newcomer" {
		t.Fatal(row)
	}
	if again := admit(w, "50", "Newcomer", "root"); accessRow(t, again).Actor != "42" || again.Epoch != 5 {
		t.Fatal("admit is not idempotent", again)
	}
	first := handle(w, "ensure", "50", "Newcomer")
	if first.Route == nil {
		t.Fatal(first)
	}
	if r := withdraw(w, "42", "50"); r.Failure != OperatorOwned {
		t.Fatal("withdrew an operator id", r)
	}
	row = accessRow(t, withdraw(w, "50", "42"))
	if row.State != StateWithdrawn || row.Username != first.Route.Username {
		t.Fatal(row)
	}
	if r := handle(w, "authorize", "50", ""); r.Failure != Denied {
		t.Fatal("authorize after withdrawal", r)
	}
	if r := handle(w, "ensure", "50", "Newcomer"); r.Failure != Denied {
		t.Fatal("ensure after withdrawal", r)
	}
	if r := withdraw(w, "50", "42"); accessRow(t, r).State != StateWithdrawn {
		t.Fatal("withdraw is not idempotent", r)
	}
	// Restore verifies the committed account and returns to it.
	h.verifyErr = true
	if r := admit(w, "50", "Newcomer", "42"); r.Failure != Drift {
		t.Fatal("restored a drifted binding", r)
	}
	h.verifyErr = false
	if row = accessRow(t, admit(w, "50", "Newcomer", "42")); row.State != StateJoined {
		t.Fatal(row)
	}
	again := handle(w, "authorize", "50", "")
	if again.Route == nil || again.Route.UID != first.Route.UID || again.Route.Username != first.Route.Username {
		t.Fatalf("restore changed the account: %+v %+v", first.Route, again.Route)
	}
	accessRow(t, admit(w, "51", "passer", "42"))
	if row = accessRow(t, withdraw(w, "51", "42")); row.State != StateRemoved {
		t.Fatal(row)
	}
	if b, _ := os.ReadFile(filepath.Join(w.Dir, "allowlist.json")); strings.Contains(string(b), `"51"`) {
		t.Fatal("never-bound withdrawal left an entry", string(b))
	}
	if r := withdraw(w, "51", "42"); accessRow(t, r).State != StateRemoved {
		t.Fatal("repeat withdrawal of a removed id", r)
	}
	list := w.Handle(context.Background(), Request{Version: 1, Operation: "access_list", Provider: "github", ID: "0"})
	if list.Access == nil || len(list.Access.Rows) != 2 || list.Access.Rows[0].ID != "42" || list.Access.Rows[1].ID != "50" || !list.Access.RuntimeAdmission {
		t.Fatalf("list: %+v", list.Access)
	}
}

func TestRuntimeAdmissionCapAndPaging(t *testing.T) {
	w, _ := runtimeWriter(t, true)
	entries := make([]string, 0, MaxRuntimeAdmission)
	for i := 0; i < MaxRuntimeAdmission; i++ {
		entries = append(entries, fmt.Sprintf(`{"id":"%d","state":"admitted","login_hint":"person-%d","actor":"42","at":"2026-10-24T09:00:00Z"}`, 1000+i, i))
	}
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":4,"ids":[{"id":"42"}],"runtime_admission":true,"runtime":[`+strings.Join(entries, ",")+`]}`)
	if r := admit(w, "5000", "one-more", "42"); r.Failure != RuntimeFull {
		t.Fatal("cap not enforced", r)
	}
	if r := admit(w, "1000", "person-0", "42"); r.Failure != "" {
		t.Fatal("an admitted id at the cap", r)
	}
	seen, next := 0, ""
	for {
		r := w.Handle(context.Background(), Request{Version: 1, Operation: "access_list", Provider: "github", ID: "0", Candidate: next})
		if r.Access == nil {
			t.Fatal(r)
		}
		seen += len(r.Access.Rows)
		if r.Next == "" {
			break
		}
		next = r.Next
	}
	if seen != MaxRuntimeAdmission+1 {
		t.Fatalf("paged %d rows", seen)
	}
	// 257 entries is not a state the broker accepts.
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":4,"ids":[],"runtime_admission":true,"runtime":[`+strings.Join(append(entries, `{"id":"9999","state":"admitted","login_hint":"x","actor":"42","at":"2026-10-24T09:00:00Z"}`), ",")+`]}`)
	if r := handle(w, "authorize", "1000", ""); r.Failure != StateUnavailable {
		t.Fatal("oversized runtime source accepted", r)
	}
}

// Every durable step of a change leaves the broker closed or consistent: an
// interrupted staging write blocks all routes until the operator looks, and
// a committed file whose head lags is simply observed by the next exchange.
func TestRuntimeAdmissionRestartPoints(t *testing.T) {
	w, _ := runtimeWriter(t, true)
	accessRow(t, admit(w, "50", "newcomer", "42"))
	if handle(w, "ensure", "50", "newcomer").Route == nil {
		t.Fatal("ensure")
	}
	put(t, w.Dir, "allowlist.json.next", `{"version":1,"epoch":6,"ids":[{"id":"42"}]}`)
	for _, r := range []Reply{withdraw(w, "50", "42"), admit(w, "51", "x", "42"), handle(w, "authorize", "50", "")} {
		if r.Failure != StateUnavailable {
			t.Fatal("staged write not closed", r)
		}
	}
	if _, err := w.startupBindings(context.Background()); err == nil {
		t.Fatal("startup with staged admission")
	}
	os.Remove(filepath.Join(w.Dir, "allowlist.json.next"))
	// The file committed, the head write did not.
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":6,"ids":[{"id":"42"}],"runtime_admission":true,"runtime":[{"id":"50","state":"withdrawn","login_hint":"newcomer","actor":"42","at":"2026-10-24T09:30:00Z"}]}`)
	if r := handle(w, "authorize", "50", ""); r.Failure != Denied {
		t.Fatal("withdrawal committed before the head lost", r)
	}
	bindings, err := w.startupBindings(context.Background())
	if err != nil || len(bindings) != 0 {
		t.Fatal("restart restores a withdrawn binding", bindings, err)
	}
	if row := accessRow(t, admit(w, "50", "newcomer", "42")); row.State != StateJoined {
		t.Fatal(row)
	}
	if bindings, err = w.startupBindings(context.Background()); err != nil || len(bindings) != 1 {
		t.Fatal("restart lost the restored binding", bindings, err)
	}
}

// host apply converges only the operator source and the switch; runtime
// entries survive, and a staging file the broker left is never completed.
func TestHostPublicationKeepsRuntimeEntries(t *testing.T) {
	p, owner, policy := installFixture(t)
	ctx := context.Background()
	if _, e := initializeBroker(ctx, p, "broker", policy, []string{"123"}, owner, nil); e != nil {
		t.Fatal(e)
	}
	dir := filepath.Join(p, "broker")
	put(t, dir, "allowlist.json", `{"version":1,"epoch":2,"ids":[{"id":"123"}],"runtime_admission":true,"runtime":[{"id":"50","state":"admitted","login_hint":"newcomer","actor":"123","at":"2026-10-24T09:30:00Z"}]}`)
	put(t, dir, "head.json", `{"version":1,"epoch":2,"generation":1}`)
	s, e := inspectInstallation(ctx, dir, owner)
	if e != nil || !s.RuntimeAdmission || !s.Admits("50") || !s.RuntimeAdmits("50") || len(s.Runtime) != 1 || s.Runtime[0].Actor != "123" {
		t.Fatalf("%+v %v", s, e)
	}
	n, e := publishAdmission(ctx, dir, owner, s.Token, []string{"456"}, false)
	if e != nil {
		t.Fatal(e)
	}
	if !n.Admits("50") || n.Admits("123") || n.RuntimeAdmission || len(n.Runtime) != 1 || n.Epoch != 3 {
		t.Fatalf("publication changed the runtime source: %+v", n)
	}
	put(t, dir, "head.json", `{"version":1,"epoch":3,"generation":1}`)
	// A staging file from an interrupted broker withdraw is not this site's
	// publication; completion refuses it.
	put(t, dir, "allowlist.json.next", `{"version":1,"epoch":4,"ids":[{"id":"456"}]}`)
	if e = completeAdmissionPublication(ctx, dir, policy, []string{"456"}, false, owner); e == nil {
		t.Fatal("completed a broker staging file as an operator publication")
	}
}

func TestAccessProtocolRejectsUntrustedInput(t *testing.T) {
	for _, input := range []string{
		`{"version":1,"operation":"admit","provider":"github","id":"50","actor":"42"}`,
		`{"version":1,"operation":"admit","provider":"github","id":"50","login_hint":"a","actor":"someone"}`,
		`{"version":1,"operation":"admit","provider":"github","id":"50","login_hint":"a","actor":"42","candidate":"a"}`,
		`{"version":1,"operation":"withdraw","provider":"github","id":"50","login_hint":"a","actor":"42"}`,
		`{"version":1,"operation":"withdraw","provider":"github","id":"50"}`,
		`{"version":1,"operation":"access_list","provider":"github","id":"50"}`,
		`{"version":1,"operation":"access_read","provider":"github","id":"50","actor":"42"}`,
		`{"version":1,"operation":"ensure","provider":"github","id":"50","candidate":"a","actor":"42"}`,
		`{"version":1,"operation":"authorize","provider":"github","id":"50","login_hint":"a"}`,
	} {
		if _, err := ParseRequest([]byte(input)); err == nil {
			t.Errorf("accepted %s", input)
		}
	}
	for _, input := range []string{
		`{"version":1,"access":{"mode":"allowlist","runtime_admission":true,"rows":[{"id":"42","source":"operator","state":"joined","username":"a","actor":"42"}]},"generation":1,"epoch":1}`,
		`{"version":1,"access":{"mode":"allowlist","runtime_admission":true,"rows":[{"id":"50","source":"site_admin","state":"withdrawn","login_hint":"a","actor":"42","at":"2026-10-24T09:30:00Z"}]},"generation":1,"epoch":1}`,
		`{"version":1,"access":{"mode":"open","runtime_admission":true,"rows":[]},"generation":1,"epoch":1}`,
		`{"version":1,"access":{"mode":"allowlist","rows":[]},"generation":1,"epoch":1}`,
		`{"version":1,"failure":"operator_owned","access":{"mode":"allowlist","runtime_admission":true,"rows":[]}}`,
		`{"version":1,"access":{"mode":"allowlist","runtime_admission":true,"rows":[]},"route":{"uid":42,"username":"alice","socket":"/run/open-habitat/users/alice/daemon.sock"},"generation":1,"epoch":1}`,
	} {
		if _, err := ParseReply([]byte(input)); err == nil {
			t.Errorf("accepted reply %s", input)
		}
	}
}
