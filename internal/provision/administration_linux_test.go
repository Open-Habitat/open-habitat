//go:build linux

package provision

import (
	"context"
	"fmt"
	"strconv"
	"testing"
)

func TestEmptyBoundUserListRoundTrips(t *testing.T) {
	w, _ := writerFixture(t)
	reply := w.Handle(context.Background(), Request{Version: 1, Operation: "list", Provider: "github", ID: "0"})
	if reply.Users == nil || len(*reply.Users) != 0 || reply.Failure != "" {
		t.Fatalf("empty ledger list: %+v", reply)
	}
	wire, err := EncodeReply(reply)
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := ParseReply(wire)
	if err != nil || parsed.Users == nil || len(*parsed.Users) != 0 {
		t.Fatalf("empty list roundtrip: %+v %v", parsed, err)
	}
}
func TestReadBindingsWithoutDaemonReadiness(t *testing.T) {
	w, h := writerFixture(t)
	if r := handle(w, "ensure", "42", "alice"); r.Route == nil {
		t.Fatal(r)
	}
	h.routeErr = true
	listed := w.Handle(context.Background(), Request{Version: 1, Operation: "list", Provider: "github", ID: "0"})
	if len(*listed.Users) != 1 || (*listed.Users)[0].ID != "42" || (*listed.Users)[0].Username != "alice" {
		t.Fatalf("list: %+v", listed)
	}
	found := w.Handle(context.Background(), Request{Version: 1, Operation: "lookup", Provider: "github", ID: "42"})
	if len(*found.Users) != 1 || found.Route != nil {
		t.Fatalf("lookup: %+v", found)
	}
	missing := w.Handle(context.Background(), Request{Version: 1, Operation: "lookup", Provider: "github", ID: "43"})
	if missing.Failure != Denied {
		t.Fatalf("unbound lookup: %+v", missing)
	}
	if r := handle(w, "authorize", "42", ""); r.Route != nil {
		t.Fatalf("authorize ignored daemon readiness: %+v", r)
	}
	if _, err := EncodeReply(listed); err != nil {
		t.Fatal(err)
	}
}
func TestReadProtocolRejectsExtraAuthority(t *testing.T) {
	for _, s := range []string{
		`{"version":1,"operation":"list","provider":"github","id":"42"}`,
		`{"version":1,"operation":"lookup","provider":"github","id":"0"}`,
		`{"version":1,"operation":"lookup","provider":"github","id":"42","candidate":"alice"}`,
	} {
		if _, err := ParseRequest([]byte(s)); err == nil {
			t.Fatalf("accepted %s", s)
		}
	}
	if _, err := ParseReply([]byte(`{"version":1,"users":[{"id":"42","username":"alice","socket":"/tmp/evil"}],"epoch":1,"generation":1}`)); err == nil {
		t.Fatal("route leaked through projection")
	}
}
func TestBoundUserPagination(t *testing.T) {
	w, _ := writerFixture(t)
	type row struct {
		ID       string `json:"id"`
		UID      uint32 `json:"uid"`
		Username string `json:"username"`
	}
	users := make([]row, 35)
	for i := range users {
		users[i] = row{strconv.Itoa(i + 1), uint32(2100 + i), fmt.Sprintf("test%d", i)}
	}
	put(t, w.Dir, "bindings.json", string(marshal(struct {
		Version    int   `json:"version"`
		Generation int   `json:"generation"`
		Bindings   []row `json:"bindings"`
	}{1, 7, users})))
	first := w.Handle(context.Background(), Request{Version: 1, Operation: "list", Provider: "github", ID: "0"})
	if len(*first.Users) != 30 || first.Next != "30" {
		t.Fatalf("first page: %+v", first)
	}
	second := w.Handle(context.Background(), Request{Version: 1, Operation: "list", Provider: "github", ID: "0", Candidate: first.Next})
	if len(*second.Users) != 5 || second.Next != "" || (*second.Users)[0].ID != "31" {
		t.Fatalf("second page: %+v", second)
	}
}
