//go:build linux

package provision

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func teamOp(w Writer, op, orgID, org, slug, actor string) Reply {
	return w.Handle(context.Background(), Request{Version: 1, Operation: op, Provider: "github", ID: orgID, LoginHint: org, Slug: slug, Actor: actor})
}
func signInTeams(w Writer, id, login string, obs ...TeamObservation) Reply {
	return w.Handle(context.Background(), Request{Version: 1, Operation: OpTeamSignIn, Provider: "github", ID: id, LoginHint: login, Teams: obs})
}

// noRow is a reply that names nobody: the person has no source.
func noRow(t *testing.T, r Reply) {
	t.Helper()
	if r.Failure != "" || r.Access == nil || len(r.Access.Rows) != 0 {
		t.Fatalf("expected no row: %+v", r)
	}
}
func obs(state, teamID string) TeamObservation {
	return TeamObservation{OrgID: "700", Slug: "habitat", TeamID: teamID, State: state}
}

// teamWriter lists one team, Example-Org/habitat, pinned to 900 unless
// pinned is false.
func teamWriter(t *testing.T, pinned bool) (Writer, *fakeHost) {
	t.Helper()
	w, h := runtimeWriter(t, true)
	if r := teamOp(w, OpTeamAdd, "700", "Example-Org", "habitat", "42"); r.Failure != "" || len(r.Access.Teams) != 1 {
		t.Fatal("team_add", r)
	}
	if pinned {
		if r := signInTeams(w, "60", "outsider", obs("none", "900")); r.Failure != "" {
			t.Fatal(r)
		}
		if a := allowState(t, w.Dir); a.Teams[0].TeamID != "900" || a.Members != nil {
			t.Fatalf("not pinned, or an outsider recorded: %+v", a)
		}
	}
	return w, h
}

// A member is admitted, signs in and gets an account; a non-member is
// refused and leaves nothing behind; a pending invitation (the gateway's
// none) is not membership.
func TestTeamMemberAdmitted(t *testing.T) {
	w, _ := teamWriter(t, true)
	if r := handle(w, "ensure", "61", "anna"); r.Failure != Denied {
		t.Fatal("admitted before any observation", r)
	}
	before := allowState(t, w.Dir).Epoch
	row := accessRow(t, signInTeams(w, "61", "anna", obs("active", "900")))
	if row.Source != SourceTeam || row.State != StateAllowed || row.TeamState != "member" || len(row.Teams) != 1 || row.Teams[0] != "900" || row.LoginHint != "anna" {
		t.Fatal(row)
	}
	routed := handle(w, "ensure", "61", "anna")
	if routed.Route == nil || routed.Epoch != before+1 {
		t.Fatal("member not admitted at the observation's epoch", routed)
	}
	if r := handle(w, "authorize", "61", ""); r.Route == nil {
		t.Fatal(r)
	}
	// The same answer again changes nothing: no write per sign-in.
	again := signInTeams(w, "61", "anna", obs("active", "900"))
	if again.Epoch != routed.Epoch || accessRow(t, again).State != StateJoined {
		t.Fatal("repeat observation wrote", again)
	}
	// A pending invitation and a stranger both answer none.
	noRow(t, signInTeams(w, "62", "invited", obs("none", "900")))
	if r := handle(w, "ensure", "62", "invited"); r.Failure != Denied {
		t.Fatal(r)
	}
}

// Leaving: the next sign-in's answer ends admission, keeps the account and
// is listed as left; an open session is not the broker's to end. A person
// admitted one by one keeps access when leaving the team.
func TestTeamLeaverAndBothReasons(t *testing.T) {
	w, _ := teamWriter(t, true)
	signInTeams(w, "61", "anna", obs("active", "900"))
	signInTeams(w, "63", "both", obs("active", "900"))
	if handle(w, "ensure", "61", "anna").Route == nil || handle(w, "ensure", "63", "both").Route == nil {
		t.Fatal("members not admitted")
	}
	if row := accessRow(t, admit(w, "63", "both", "42")); row.Source != SourceSiteAdmin || row.TeamState != "member" {
		t.Fatal("two reasons not both listed", row)
	}
	left := accessRow(t, signInTeams(w, "61", "anna", obs("none", "900")))
	if left.Source != SourceTeam || left.State != StateLeft || left.Username == "" || left.Teams[0] != "900" {
		t.Fatal(left)
	}
	if r := handle(w, "ensure", "61", "anna"); r.Failure != Denied {
		t.Fatal("leaver admitted", r)
	}
	if r := handle(w, "authorize", "61", ""); r.Failure != Denied {
		t.Fatal("leaver authorized", r)
	}
	both := accessRow(t, signInTeams(w, "63", "both", obs("none", "900")))
	if both.Source != SourceSiteAdmin || both.State != StateJoined || both.TeamState != "left" {
		t.Fatal(both)
	}
	if handle(w, "ensure", "63", "both").Route == nil {
		t.Fatal("individual admission lost with the team")
	}
	// Rejoining admits again; forget refuses to drop a record that admits.
	if row := accessRow(t, signInTeams(w, "61", "anna", obs("active", "900"))); row.State != StateJoined {
		t.Fatal(row)
	}
	if row := accessRow(t, w.Handle(context.Background(), Request{Version: 1, Operation: OpForget, Provider: "github", ID: "61", Actor: "42"})); row.TeamState != "member" {
		t.Fatal("forgot an admitting record", row)
	}
	signInTeams(w, "61", "anna", obs("none", "900"))
	if row := accessRow(t, w.Handle(context.Background(), Request{Version: 1, Operation: OpForget, Provider: "github", ID: "61", Actor: "42"})); row.Source != SourceTeam || row.State != StateRemoved {
		t.Fatal("forget", row)
	}
	if a := allowState(t, w.Dir); len(a.Members) != 1 || a.Members[0].ID != "63" {
		t.Fatalf("%+v", a.Members)
	}
}

// GitHub unavailable: never recorded as leaving, but a member whose
// membership could not be confirmed is not admitted either, and the team
// carries the time GitHub last failed to answer until a definite answer.
func TestTeamUnavailable(t *testing.T) {
	w, _ := teamWriter(t, true)
	signInTeams(w, "61", "anna", obs("active", "900"))
	if handle(w, "ensure", "61", "anna").Route == nil {
		t.Fatal("member not admitted")
	}
	row := accessRow(t, signInTeams(w, "61", "anna", obs("unknown", "")))
	if row.State != StateUnconfirmed || row.TeamState != "unconfirmed" || row.Teams[0] != "900" {
		t.Fatal(row)
	}
	if r := handle(w, "ensure", "61", "anna"); r.Failure != Denied {
		t.Fatal("unconfirmed member admitted", r)
	}
	a := allowState(t, w.Dir)
	if a.Teams[0].UnavailableAt == "" {
		t.Fatal("unavailability not recorded")
	}
	// A stranger meeting the outage records nothing about themselves.
	signInTeams(w, "64", "stranger", obs("unknown", ""))
	if a = allowState(t, w.Dir); len(a.Members) != 1 {
		t.Fatalf("%+v", a.Members)
	}
	// A team the observation omits (added after the gateway read the
	// list) is unknown too.
	if r := signInTeams(w, "61", "anna", TeamObservation{OrgID: "701", Slug: "other", State: "none"}); accessRow(t, r).State != StateUnconfirmed {
		t.Fatal(r)
	}
	if row = accessRow(t, signInTeams(w, "61", "anna", obs("active", "900"))); row.State != StateJoined {
		t.Fatal(row)
	}
	if a = allowState(t, w.Dir); a.Teams[0].UnavailableAt != "" {
		t.Fatal("unavailability not cleared by an answer")
	}
}

// The slug is pinned to the team it first resolved to; a later team behind
// the same slug answers nothing. An unpinned team cannot admit.
func TestTeamPinning(t *testing.T) {
	w, _ := teamWriter(t, false)
	if r := signInTeams(w, "61", "anna", obs("active", "")); r.Failure != Invalid {
		t.Fatal("active without a team id accepted", r)
	}
	if row := accessRow(t, signInTeams(w, "61", "anna", obs("active", "900"))); row.State != StateAllowed {
		t.Fatal(row)
	}
	noRow(t, signInTeams(w, "65", "usurper", obs("active", "901")))
	if a := allowState(t, w.Dir); a.Teams[0].TeamID != "900" || a.Teams[0].UnavailableAt == "" {
		t.Fatalf("%+v", a.Teams)
	}
}

// The switch bounds new admission through a team as it does one by one:
// with it off no team is added and no new member recorded, while existing
// members keep signing in and a leaver is still recorded.
func TestTeamSwitchAndBounds(t *testing.T) {
	w, _ := teamWriter(t, true)
	signInTeams(w, "61", "anna", obs("active", "900"))
	a := allowState(t, w.Dir)
	a.RuntimeAdmission = false
	put(t, w.Dir, "allowlist.json", string(marshal(a)))
	if r := teamOp(w, OpTeamAdd, "702", "other", "team", "42"); r.Failure != RuntimeDisabled {
		t.Fatal(r)
	}
	noRow(t, signInTeams(w, "66", "new", obs("active", "900")))
	if handle(w, "ensure", "61", "anna").Route == nil {
		t.Fatal("existing member refused with the switch off")
	}
	// One unanswered sign-in is not leaving: the next answer readmits.
	signInTeams(w, "61", "anna", obs("unknown", ""))
	if r := accessRow(t, signInTeams(w, "61", "anna", obs("active", "900"))); r.State != StateJoined {
		t.Fatal("unconfirmed member locked out with the switch off", r)
	}
	if r := accessRow(t, signInTeams(w, "61", "anna", obs("none", "900"))); r.State != StateLeft {
		t.Fatal(r)
	}
	// Rejoining after leaving is a new admission.
	if r := accessRow(t, signInTeams(w, "61", "anna", obs("active", "900"))); r.State != StateLeft {
		t.Fatal("leaver readmitted with the switch off", r)
	}
	a = allowState(t, w.Dir)
	a.RuntimeAdmission = true
	put(t, w.Dir, "allowlist.json", string(marshal(a)))
	for i := 1; i < MaxTeams; i++ {
		if r := teamOp(w, OpTeamAdd, "800", "org", "t"+strings.Repeat("x", i), "42"); r.Failure != "" {
			t.Fatal(i, r)
		}
	}
	if r := teamOp(w, OpTeamAdd, "800", "org", "full", "42"); r.Failure != RuntimeFull {
		t.Fatal(r)
	}
	if r := teamOp(w, OpTeamAdd, "700", "Example-Org", "habitat", "42"); r.Failure != "" || len(r.Access.Teams) != MaxTeams {
		t.Fatal("repeat add not idempotent", r)
	}
	w.AdmitAny = true
	if r := signInTeams(w, "61", "anna", obs("active", "900")); r.Failure != AdmissionOpen {
		t.Fatal(r)
	}
}

// Withdrawal ends a team member's access as it does an individual's, and
// stays in force through later sign-ins until a restore.
func TestTeamWithdrawRestore(t *testing.T) {
	w, _ := teamWriter(t, true)
	signInTeams(w, "61", "anna", obs("active", "900"))
	routed := handle(w, "ensure", "61", "anna")
	if routed.Route == nil {
		t.Fatal(routed)
	}
	row := accessRow(t, withdraw(w, "61", "42"))
	if row.Source != SourceSiteAdmin || row.State != StateWithdrawn || row.LoginHint != "anna" || row.TeamState != "" {
		t.Fatal(row)
	}
	if r := accessRow(t, signInTeams(w, "61", "anna", obs("active", "900"))); r.State != StateWithdrawn || r.TeamState != "" {
		t.Fatal("sign-in observation overrode a withdrawal", r)
	}
	if r := handle(w, "ensure", "61", "anna"); r.Failure != Denied {
		t.Fatal(r)
	}
	if r := accessRow(t, admit(w, "61", "anna", "42")); r.State != StateJoined || r.Source != SourceSiteAdmin {
		t.Fatal(r)
	}
	// A never-bound member's withdrawal leaves nothing.
	signInTeams(w, "67", "fresh", obs("active", "900"))
	if r := accessRow(t, withdraw(w, "67", "42")); r.State != StateRemoved || r.LoginHint != "fresh" {
		t.Fatal(r)
	}
	if a := allowState(t, w.Dir); a.member("67") != nil {
		t.Fatal("withdrawn record kept")
	}
}

// Removing a team ends what it gave without calling anyone a leaver.
func TestTeamRemove(t *testing.T) {
	w, _ := teamWriter(t, true)
	signInTeams(w, "61", "anna", obs("active", "900"))
	if handle(w, "ensure", "61", "anna").Route == nil {
		t.Fatal("member not admitted")
	}
	r := teamOp(w, OpTeamRemove, "700", "", "habitat", "42")
	if r.Failure != "" || len(r.Access.Teams) != 0 {
		t.Fatal(r)
	}
	if a := allowState(t, w.Dir); a.Members != nil || a.Teams != nil {
		t.Fatalf("%+v", a)
	}
	if r := handle(w, "ensure", "61", "anna"); r.Failure != Denied {
		t.Fatal(r)
	}
	if r := teamOp(w, OpTeamRemove, "700", "", "habitat", "42"); r.Failure != "" {
		t.Fatal("repeat removal", r)
	}
}

// Host apply's operator publication carries the team source over, and the
// installation state reports team admission as the broker's own.
func TestTeamSurvivesOperatorPublication(t *testing.T) {
	w, _ := teamWriter(t, true)
	signInTeams(w, "61", "anna", obs("active", "900"))
	next := operatorPublication(allowState(t, w.Dir), []string{"42", "43"}, true)
	if len(next.Teams) != 1 || len(next.Members) != 1 {
		t.Fatalf("%+v", next)
	}
	put(t, w.Dir, "allowlist.json", string(marshal(next)))
	if handle(w, "ensure", "61", "anna").Route == nil {
		t.Fatal("member lost by publication")
	}
}

// The admission file rejects malformed team state, and the wire rejects
// team fields outside their operations.
func TestTeamValidation(t *testing.T) {
	for _, bad := range []string{
		`{"teams":[{"org_id":"700","org":"o","slug":"Bad","actor":"42","at":"2026-10-24T09:00:00Z"}]}`,
		`{"teams":[{"org_id":"700","org":"o","slug":"a","actor":"42","at":"2026-10-24T09:00:00Z"},{"org_id":"700","org":"o","slug":"a","actor":"42","at":"2026-10-24T09:00:00Z"}]}`,
		`{"members":[{"id":"61","login_hint":"a","teams":[],"state":"member","at":"2026-10-24T09:00:00Z"}]}`,
		`{"members":[{"id":"61","login_hint":"a","teams":["9"],"state":"gone","at":"2026-10-24T09:00:00Z"}]}`,
		`{"members":[{"id":"61","login_hint":"a","teams":["9"],"state":"left","at":"2026-10-24T09:00:00Z","extra":1}]}`,
	} {
		var raw map[string]json.RawMessage
		if json.Unmarshal([]byte(bad), &raw) != nil {
			t.Fatal(bad)
		}
		if validTeams(raw["teams"], raw["members"]) == nil {
			t.Fatal("accepted", bad)
		}
	}
	for _, bad := range []string{
		`{"version":1,"operation":"ensure","provider":"github","id":"1","candidate":"a","slug":"x"}`,
		`{"version":1,"operation":"admit","provider":"github","id":"1","login_hint":"a","actor":"42","teams":[]}`,
		`{"version":1,"operation":"team_sign_in","provider":"github","id":"1","login_hint":"a","teams":[{"org_id":"7","slug":"x","state":"active","team_id":"9","extra":1}]}`,
		`{"version":1,"operation":"team_sign_in","provider":"github","id":"1","login_hint":"a","actor":"42","teams":[{"org_id":"7","slug":"x","state":"none"}]}`,
		`{"version":1,"operation":"team_add","provider":"github","id":"7","login_hint":"o","actor":"42"}`,
	} {
		if _, err := ParseRequest([]byte(bad)); err == nil {
			t.Fatal("accepted", bad)
		}
	}
}

// The widest row still fits a full page in one broker frame.
func TestAccessPageFitsFrame(t *testing.T) {
	teams := []string{}
	for i := 0; i < MaxTeams; i++ {
		teams = append(teams, "1234567890123456789"+string(rune('1'+i)))
	}
	rows := []AccessRow{}
	for i := 0; i < AccessPageSize; i++ {
		rows = append(rows, AccessRow{ID: "1234567890123456789" + string(rune('1'+i)), Source: SourceSiteAdmin, State: StateJoined, Username: strings.Repeat("u", 32), LoginHint: strings.Repeat("l", 39), Actor: "12345678901234567890", At: "2026-10-24T09:00:00Z", TeamState: "member", Teams: teams})
	}
	reply := Reply{Version: 1, Access: &AccessPage{Mode: "allowlist", RuntimeAdmission: true, Rows: rows}, Generation: 1 << 62, Epoch: 1 << 62, Next: "9999"}
	if _, err := EncodeReply(reply); err != nil {
		b, _ := json.Marshal(reply)
		t.Fatal(len(b), err)
	}
}

// Readmission through the team verifies the committed account as a restore
// does; a drifted one is left for the operator.
func TestTeamReadmissionVerifiesAccount(t *testing.T) {
	w, h := teamWriter(t, true)
	signInTeams(w, "61", "anna", obs("active", "900"))
	if handle(w, "ensure", "61", "anna").Route == nil {
		t.Fatal("member not admitted")
	}
	signInTeams(w, "61", "anna", obs("none", "900"))
	h.verifyErr = true
	if r := signInTeams(w, "61", "anna", obs("active", "900")); r.Failure != Drift {
		t.Fatal("readmitted a drifted binding", r)
	}
	if a := allowState(t, w.Dir); a.member("61").State != "left" {
		t.Fatal("drifted readmission committed")
	}
	h.verifyErr = false
	if r := accessRow(t, signInTeams(w, "61", "anna", obs("active", "900"))); r.State != StateJoined {
		t.Fatal(r)
	}
}
