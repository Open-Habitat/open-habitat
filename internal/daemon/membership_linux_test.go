//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

const memberConv = "11111111-2222-4333-8444-555555555555"

// membershipFixture is one settled native history in one workspace, owned by
// github:42, with the multiplayer feature on.
func membershipFixture(t *testing.T) (*ConversationController, func(id string, archived bool) (int, string)) {
	t.Helper()
	c, archive := archiveQueueFixture(t, []string{memberConv})
	c.cfg.Provider, c.cfg.Subject = "github", "42"
	if err := savePreferences(c.cfg.Home, accountPreferences{Engine: "codemirror6", Experimental: map[string]bool{MultiplayerFeature: true}}); err != nil {
		t.Fatal(err)
	}
	return c, archive
}

type membersBody struct {
	Generation uint64         `json:"generation"`
	Members    []memberRecord `json:"members"`
	Revocation string         `json:"revocation"`
	Error      struct {
		Code string `json:"code"`
	} `json:"error"`
}

func memberCall(t *testing.T, c *ConversationController, method string, body any) (int, membersBody, string) {
	t.Helper()
	var reader *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reader = bytes.NewReader(b)
	} else {
		reader = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, "http://unix/api/v1/conversations/"+memberConv+"/members", reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	w := httptest.NewRecorder()
	c.members(w, req, memberConv)
	var out membersBody
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out, w.Body.String()
}

func control(action, subject, name string) map[string]string {
	m := map[string]string{"action": action, "subject": subject}
	if name != "" {
		m["display_name"] = name
	}
	return m
}

var ville = guestParticipant{Subject: "github:1001", DisplayName: "Example Participant"}

func TestMembershipLifecycleDecidesEveryGuestAccess(t *testing.T) {
	c, _ := membershipFixture(t)
	if _, ok := c.authorizeGuest(memberConv, ville, true); ok {
		t.Fatal("a person with no membership was admitted")
	}
	if _, ok := c.joinMember(memberConv, ville); ok {
		t.Fatal("a person with no invitation joined")
	}
	code, reply, raw := memberCall(t, c, "POST", control("invite", ville.Subject, "Example Participant"))
	if code != 200 || len(reply.Members) != 1 || reply.Members[0].State != stateInvited || reply.Members[0].Role != roleParticipant {
		t.Fatalf("invite: %d %s", code, raw)
	}
	matchesSchema(t, "conversation-members.schema.json", raw)
	info, err := os.Stat(filepath.Join(c.home, ".local", "state", "open-habitat", membershipFile))
	if err != nil || info.Mode().Perm() != 0600 {
		t.Fatalf("record mode: %v %v", info, err)
	}
	// An invited person may join and nothing else.
	if _, ok := c.authorizeGuest(memberConv, ville, false); ok {
		t.Fatal("an invited person passed a joined-only check")
	}
	if _, _, ok := c.admitGuestStream(context.Background(), memberConv, ville); ok {
		t.Fatal("an invited person opened a stream")
	}
	if code, _, raw := memberCall(t, c, "POST", control("full_rights", ville.Subject, "")); code != 409 {
		t.Fatalf("full rights for an invitation: %d %s", code, raw)
	}
	// Someone else naming the same conversation stays out.
	if _, ok := c.joinMember(memberConv, guestParticipant{Subject: "github:1002", DisplayName: "Other"}); ok {
		t.Fatal("an uninvited person joined")
	}
	joined, ok := c.joinMember(memberConv, ville)
	if !ok || joined["state"] != stateJoined {
		t.Fatalf("join: %v %v", joined, ok)
	}
	if _, ok := c.authorizeGuest(memberConv, ville, false); !ok {
		t.Fatal("a joined person was refused")
	}
	_, before, _ := memberCall(t, c, "GET", nil)
	code, reply, raw = memberCall(t, c, "POST", control("full_rights", ville.Subject, ""))
	if code != 200 || reply.Members[0].Role != roleFullRights || reply.Generation <= before.Generation || reply.Members[0].Generation != reply.Generation {
		t.Fatalf("full rights: %d %s", code, raw)
	}
	granted := reply.Generation
	code, reply, raw = memberCall(t, c, "POST", control("take_back", ville.Subject, ""))
	if code != 200 || reply.Members[0].Role != roleParticipant || reply.Members[0].State != stateJoined || reply.Generation <= granted || reply.Revocation != "not_running" {
		t.Fatalf("take back: %d %s", code, raw)
	}
	matchesSchema(t, "conversation-members.schema.json", raw)
	if _, ok := c.authorizeGuest(memberConv, ville, false); !ok {
		t.Fatal("taking full rights away removed the person")
	}
	// Every change waits as a Habitat line while Pi is not running.
	record, err := loadMembership(c.home)
	if err != nil {
		t.Fatal(err)
	}
	var events []string
	for _, l := range record.Conversations["pi:"+memberConv].Lines {
		events = append(events, l.Event)
	}
	if want := []string{"joined", "full_rights_given", "full_rights_taken"}; len(events) != len(want) || events[0] != want[0] || events[1] != want[1] || events[2] != want[2] {
		t.Fatalf("lines: %v", events)
	}
	// Removal refuses the next request and ends open streams.
	ctx, release, ok := c.admitGuestStream(context.Background(), memberConv, ville)
	if !ok {
		t.Fatal("a joined person's stream was refused")
	}
	defer release()
	code, reply, raw = memberCall(t, c, "POST", control("remove", ville.Subject, ""))
	if code != 200 || len(reply.Members) != 0 || reply.Revocation != "not_running" {
		t.Fatalf("remove: %d %s", code, raw)
	}
	if ctx.Err() == nil {
		t.Fatal("removal left the person's stream open")
	}
	if _, ok := c.authorizeGuest(memberConv, ville, true); ok {
		t.Fatal("a removed person was admitted")
	}
	if _, ok := c.joinMember(memberConv, ville); ok {
		t.Fatal("a removed person joined again")
	}
	if code, _, _ := memberCall(t, c, "POST", control("remove", ville.Subject, "")); code != 404 {
		t.Fatalf("removing twice: %d", code)
	}
}

func TestMembershipRefusesOwnerFeatureOffAndBadInput(t *testing.T) {
	c, _ := membershipFixture(t)
	if code, _, _ := memberCall(t, c, "POST", control("invite", "github:42", "Owner")); code != 409 {
		t.Fatalf("the owner invited themself: %d", code)
	}
	for _, bad := range []any{
		control("invite", ville.Subject, ""),
		control("invite", ville.Subject, "two\nlines"),
		control("invite", "alice", "Alice"),
		control("full_rights", ville.Subject, "Named"),
		control("owner", ville.Subject, ""),
		map[string]string{"action": "invite", "subject": ville.Subject, "display_name": "A", "role": "full_rights"},
	} {
		if code, _, raw := memberCall(t, c, "POST", bad); code != 400 {
			t.Fatalf("%v: %d %s", bad, code, raw)
		}
	}
	if err := savePreferences(c.cfg.Home, accountPreferences{Engine: "codemirror6", Experimental: map[string]bool{}}); err != nil {
		t.Fatal(err)
	}
	if code, _, _ := memberCall(t, c, "GET", nil); code != 404 {
		t.Fatalf("feature off: %d", code)
	}
	if code, _, _ := memberCall(t, c, "POST", control("invite", ville.Subject, "Example Participant")); code != 404 {
		t.Fatalf("feature off invite: %d", code)
	}
}

func TestDamagedRecordAdmitsNobody(t *testing.T) {
	c, _ := membershipFixture(t)
	memberCall(t, c, "POST", control("invite", ville.Subject, "Example Participant"))
	if _, ok := c.joinMember(memberConv, ville); !ok {
		t.Fatal("join failed")
	}
	path := filepath.Join(c.home, ".local", "state", "open-habitat", membershipFile)
	good, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	// Readable by others: not the owner's private record.
	if err := os.Chmod(path, 0644); err != nil {
		t.Fatal(err)
	}
	if _, ok := c.authorizeGuest(memberConv, ville, false); ok {
		t.Fatal("a group-readable record admitted a guest")
	}
	if err := os.Chmod(path, 0600); err != nil {
		t.Fatal(err)
	}
	// A record that names a role the daemon does not know is not read.
	if err := os.WriteFile(path, bytes.Replace(good, []byte(`"role":"participant"`), []byte(`"role":"owner"`), 1), 0600); err != nil {
		t.Fatal(err)
	}
	if _, ok := c.authorizeGuest(memberConv, ville, false); ok {
		t.Fatal("a damaged record admitted a guest")
	}
	// Nor is a file that states nothing: it is damage, not an empty record.
	for _, empty := range []string{"{}", "null", `{"schema_version":1}`} {
		if err := os.WriteFile(path, []byte(empty), 0600); err != nil {
			t.Fatal(err)
		}
		if code, _, _ := memberCall(t, c, "POST", control("invite", "github:1002", "Other")); code != 503 {
			t.Fatalf("%s read as an empty record: %d", empty, code)
		}
	}
	if err := os.WriteFile(path, bytes.Replace(good, []byte(`"role":"participant"`), []byte(`"role":"owner"`), 1), 0600); err != nil {
		t.Fatal(err)
	}
	if code, _, _ := memberCall(t, c, "POST", control("invite", "github:1002", "Other")); code != 503 {
		t.Fatalf("a damaged record was overwritten: %d", code)
	}
	if after, _ := os.ReadFile(path); bytes.Contains(after, []byte("github:1002")) {
		t.Fatal("the damaged record was replaced")
	}
}

func TestArchiveEndsMembershipsForGood(t *testing.T) {
	c, archive := membershipFixture(t)
	memberCall(t, c, "POST", control("invite", ville.Subject, "Example Participant"))
	if _, ok := c.joinMember(memberConv, ville); !ok {
		t.Fatal("join failed")
	}
	ctx, release, ok := c.admitGuestStream(context.Background(), memberConv, ville)
	if !ok {
		t.Fatal("stream refused")
	}
	defer release()
	if code, why := archive(memberConv, true); code != 200 {
		t.Fatalf("archive: %d %s", code, why)
	}
	if ctx.Err() == nil {
		t.Fatal("archiving left a participant's stream open")
	}
	if _, ok := c.authorizeGuest(memberConv, ville, true); ok {
		t.Fatal("a participant reached an archived conversation")
	}
	if code, body, raw := memberCall(t, c, "POST", control("invite", ville.Subject, "Example Participant")); code != 409 || body.Error.Code != "conversation_archived" {
		t.Fatalf("invite into an archived conversation: %d %s", code, raw)
	}
	if code, why := archive(memberConv, false); code != 200 {
		t.Fatalf("restore: %d %s", code, why)
	}
	// Restoring brings back the conversation, not who was in it.
	if _, ok := c.authorizeGuest(memberConv, ville, true); ok {
		t.Fatal("restore brought a membership back")
	}
	if _, body, _ := memberCall(t, c, "GET", nil); len(body.Members) != 0 {
		t.Fatalf("members after restore: %v", body.Members)
	}
}

func TestMovedOrDeletedWorkspaceAdmitsNobody(t *testing.T) {
	c, _ := membershipFixture(t)
	memberCall(t, c, "POST", control("invite", ville.Subject, "Example Participant"))
	if _, ok := c.joinMember(memberConv, ville); !ok {
		t.Fatal("join failed")
	}
	cwd := filepath.Join(c.home, "src", "project")
	if err := os.Rename(cwd, cwd+"-gone"); err != nil {
		t.Fatal(err)
	}
	if _, ok := c.authorizeGuest(memberConv, ville, false); ok {
		t.Fatal("a guest reached a conversation whose workspace is gone")
	}
	// The owner can still take everyone out.
	if code, _, raw := memberCall(t, c, "POST", control("remove", ville.Subject, "")); code != 200 {
		t.Fatalf("remove after the workspace went: %d %s", code, raw)
	}
	if err := os.Rename(cwd+"-gone", cwd); err != nil {
		t.Fatal(err)
	}
	memberCall(t, c, "POST", control("invite", ville.Subject, "Example Participant"))
	if err := c.endMemberships(func(_ string, conv *membershipSettings) bool { return conv.Cwd == cwd }); err != nil {
		t.Fatal(err)
	}
	if _, body, _ := memberCall(t, c, "GET", nil); len(body.Members) != 0 {
		t.Fatalf("deleting the workspace kept memberships: %v", body.Members)
	}
}

// A running Pi is told of a revoked grant before the owner's reply, and
// pending lines reach it only while it is idle, each once.
func TestMembershipTellsRunningPi(t *testing.T) {
	c, _ := membershipFixture(t)
	var mu sync.Mutex
	var grants []map[string]any
	var lines []string
	busy, failGrant := true, false
	p := testProcessPeer(t, os.Getpid(), func(conn net.Conn) {
		var q map[string]any
		if json.NewDecoder(conn).Decode(&q) != nil {
			return
		}
		mu.Lock()
		defer mu.Unlock()
		reply := map[string]any{"ok": true}
		switch q["op"] {
		case "grant":
			if failGrant {
				reply = map[string]any{"ok": false, "error": "invalid_request"}
				break
			}
			grants = append(grants, q["grant"].(map[string]any))
			reply["data"] = map[string]any{"told": true}
		case "conversation_line":
			if busy {
				reply["data"] = map[string]any{"written": false, "reason": "busy"}
				break
			}
			lines = append(lines, q["line"].(map[string]any)["event"].(string))
			reply["data"] = map[string]any{"written": true}
		}
		_ = json.NewEncoder(conn).Encode(reply)
	})
	s := &conversation{id: memberConv, rpc: p, state: "idle"}
	c.sessions[memberConv] = s
	memberCall(t, c, "POST", control("invite", ville.Subject, "Example Participant"))
	if _, ok := c.joinMember(memberConv, ville); !ok {
		t.Fatal("join failed")
	}
	memberCall(t, c, "POST", control("full_rights", ville.Subject, ""))
	code, reply, raw := memberCall(t, c, "POST", control("take_back", ville.Subject, ""))
	if code != 200 || reply.Revocation != "delivered" {
		t.Fatalf("take back: %d %s", code, raw)
	}
	mu.Lock()
	if len(grants) != 1 || grants[0]["subject"] != ville.Subject || grants[0]["role"] != roleParticipant || grants[0]["removed"] != false || uint64(grants[0]["generation"].(float64)) != reply.Generation {
		t.Fatalf("grant told: %v", grants)
	}
	failGrant = true
	mu.Unlock()
	if code, reply, raw := memberCall(t, c, "POST", control("remove", ville.Subject, "")); code != 200 || reply.Revocation != "failed" {
		t.Fatalf("remove with an unreachable companion: %d %s", code, raw)
	}
	// A busy Pi keeps every line in the record.
	c.deliverMemberLines(s)
	record, _ := loadMembership(c.home)
	if n := len(record.Conversations["pi:"+memberConv].Lines); n != 4 {
		t.Fatalf("pending lines while busy: %d", n)
	}
	mu.Lock()
	busy = false
	mu.Unlock()
	c.deliverMemberLines(s)
	c.deliverMemberLines(s)
	mu.Lock()
	defer mu.Unlock()
	if want := []string{"joined", "full_rights_given", "full_rights_taken", "removed"}; len(lines) != 4 || lines[0] != want[0] || lines[3] != want[3] {
		t.Fatalf("lines written: %v", lines)
	}
	record, _ = loadMembership(c.home)
	if record.Conversations["pi:"+memberConv] != nil {
		t.Fatalf("delivered lines stayed: %+v", record.Conversations["pi:"+memberConv])
	}
}

// An archive whose memberships cannot be ended does not commit, so a later
// restore cannot bring them back.
func TestArchiveRefusedWhenMembershipsCannotEnd(t *testing.T) {
	c, archive := membershipFixture(t)
	memberCall(t, c, "POST", control("invite", ville.Subject, "Example Participant"))
	if _, ok := c.joinMember(memberConv, ville); !ok {
		t.Fatal("join failed")
	}
	writeMembership = func(string, string, []byte) error { return os.ErrPermission }
	defer func() { writeMembership = writeStateFile }()
	if code, _ := archive(memberConv, true); code == 200 {
		t.Fatal("archive committed although its memberships could not end")
	}
	writeMembership = writeStateFile
	visibility, err := loadVisibility(c.home)
	if err != nil || archiveFact(visibility, nil, "pi:"+memberConv) != "active" {
		t.Fatalf("archive state after refusal: %v %v", archiveFact(visibility, nil, "pi:"+memberConv), err)
	}
}

// The take-back card's stop names the participant whose request started the
// process; the daemon writes the Habitat line from its own inventory and
// record, and only for someone the record still names.
func TestProcessStopForParticipantWritesTheLine(t *testing.T) {
	c, _ := membershipFixture(t)
	var mu sync.Mutex
	var lines []map[string]any
	stops := 0
	p := testProcessPeer(t, os.Getpid(), func(conn net.Conn) {
		var q map[string]any
		if json.NewDecoder(conn).Decode(&q) != nil {
			return
		}
		mu.Lock()
		defer mu.Unlock()
		reply := map[string]any{"ok": true}
		switch q["op"] {
		case "grant":
			reply["data"] = map[string]any{"told": true}
		case "list":
			reply["data"] = map[string]any{"protocol": 1, "records": []any{
				map[string]any{"id": "proc_abcd", "name": "preview", "command": "TOKEN=secret npm run preview", "startTime": 1000, "endTime": nil, "status": "running", "exitCode": nil, "signal": nil, "endReason": nil, "wakes_agent": false, "run_ids": []string{}, "last_output_at": 1500},
				map[string]any{"id": "proc_beef", "name": "w", "command": "w", "startTime": 2000, "endTime": nil, "status": "running", "exitCode": nil, "signal": nil, "endReason": nil, "wakes_agent": false, "run_ids": []string{}, "last_output_at": 10},
			}}
		case "stop":
			stops++
			reply["data"] = map[string]any{"result": "killed"}
		case "conversation_line":
			lines = append(lines, q["line"].(map[string]any))
			reply["data"] = map[string]any{"written": true}
		}
		_ = json.NewEncoder(conn).Encode(reply)
	})
	c.sessions[memberConv] = &conversation{id: memberConv, rpc: p, state: "idle"}
	memberCall(t, c, "POST", control("invite", ville.Subject, "Example Participant"))
	if _, ok := c.joinMember(memberConv, ville); !ok {
		t.Fatal("join failed")
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	inv := p.inventory(ctx)
	if inv.Processes[0].LastOutput == nil || *inv.Processes[0].LastOutput != 1500 || inv.Processes[1].LastOutput != nil {
		t.Fatalf("last output: %+v", inv.Processes)
	}

	stop := func(path, body string) int {
		req := httptest.NewRequest("POST", "http://unix/api/v1/conversations/"+memberConv+"/processes/"+path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.RequestURI = req.URL.RequestURI()
		w := httptest.NewRecorder()
		c.processRoutes(w, req, append([]string{memberConv, "processes"}, strings.Split(path, "/")...))
		return w.Code
	}
	body := func(who string) string {
		return fmt.Sprintf(`{"owner_generation":%q,"process_token":"pt_1000","force":false,"for_participant":%q}`, p.processGeneration, who)
	}
	if code := stop("proc_abcd/stop", body("someone")); code != 400 {
		t.Fatalf("malformed participant: %d", code)
	}
	if code := stop("clear-finished", fmt.Sprintf(`{"owner_generation":%q,"for_participant":%q}`, p.processGeneration, ville.Subject)); code != 400 {
		t.Fatalf("clearing names nobody: %d", code)
	}
	// Someone the record does not name: the stop happens, no line.
	if code := stop("proc_abcd/stop", body("github:9999")); code != 200 {
		t.Fatalf("stop for a stranger: %d", code)
	}
	if code := stop("proc_abcd/stop", body(ville.Subject)); code != 200 {
		t.Fatalf("stop: %d", code)
	}
	var got map[string]any
	deadline := time.Now().Add(3 * time.Second)
	for got == nil && time.Now().Before(deadline) {
		mu.Lock()
		for _, l := range lines {
			if l["kind"] == "process_stopped" {
				got = l
			}
		}
		mu.Unlock()
		time.Sleep(10 * time.Millisecond)
	}
	mu.Lock()
	defer mu.Unlock()
	if stops != 2 || got == nil {
		t.Fatalf("stops %d, lines %v", stops, lines)
	}
	// The command is the daemon's redacted preview, the name the record's.
	if got["command"] != "TOKEN=••• npm run preview" || got["display_name"] != "Example Participant" || got["subject"] != ville.Subject || got["event"] != nil {
		t.Fatalf("line: %v", got)
	}
	n := 0
	for _, l := range lines {
		if l["kind"] == "process_stopped" {
			n++
		}
	}
	if n != 1 {
		t.Fatalf("lines for the stranger too: %v", lines)
	}
}
