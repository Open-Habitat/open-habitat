//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/testpython"
)

const (
	guestMsgA = "aaaaaaaa-0000-4000-8000-000000000001"
	guestMsgB = "aaaaaaaa-0000-4000-8000-000000000002"
	guestLine = "aaaaaaaa-0000-4000-8000-000000000003"
)

// sharedHistory appends a shared conversation's entries to the fixture's
// native history: a thinking reply, a tool result, the owner's `!` and `!!`
// commands, two participant requests, the companion's hidden records, an
// owner message that settles the newer request and a release of the older.
func sharedHistory(t *testing.T, c *ConversationController) string {
	t.Helper()
	path := filepath.Join(c.home, ".pi", "agent", "sessions", "history-0.jsonl")
	participant := func(id, msg, role string) string {
		content, _ := json.Marshal("[Open Habitat] \"Example Participant\", a participant in the owner's conversation, writes (message " + msg + ").\nYou have no tools on this turn.\n\n" + "Please look at " + msg[len(msg)-1:])
		return `{"type":"custom_message","id":"` + id + `","customType":"oh-participant-message","display":true,"content":` + string(content) + `,"details":{"schema_version":1,"message_id":"` + msg + `","subject":"github:1001","display_name":"Example Participant","role":"` + role + `","generation":2,"at":"2026-11-21T10:00:00Z"}}`
	}
	lines := []string{
		`{"type":"message","id":"a1","message":{"role":"assistant","content":[{"type":"thinking","thinking":"private reasoning shown as to the owner"},{"type":"text","text":"done"}]}}`,
		`{"type":"message","id":"t1","message":{"role":"toolResult","toolCallId":"c1","toolName":"read","content":[{"type":"text","text":"tool output"}]}}`,
		`{"type":"message","id":"b1","message":{"role":"bashExecution","command":"ls","output":"visible-bash","exitCode":0}}`,
		`{"type":"message","id":"b2","message":{"role":"bashExecution","command":"cat secret","output":"owner-only-bash","exitCode":0,"excludeFromContext":true}}`,
		`{"type":"custom","id":"tm1","customType":"oh-turn-mode","data":{"schema_version":1,"mode":"text_only","by":"participant","covers":0,"subject":"github:1001","request":"` + guestMsgA + `"}}`,
		participant("p1", guestMsgA, "participant"),
		`{"type":"custom","id":"tm2","customType":"oh-turn-mode","data":{"schema_version":1,"mode":"text_only","by":"participant","covers":0,"subject":"github:1001","request":"` + guestMsgB + `"}}`,
		`{"type":"custom","id":"tm4","customType":"oh-turn-mode","data":{"schema_version":1,"mode":"tools","by":"owner","covers":1}}`,
		participant("p2", guestMsgB, "participant"),
		`{"type":"message","id":"u2","message":{"role":"user","content":"owner speaks"}}`,
		`{"type":"custom_message","id":"l1","customType":"oh-conversation-line","display":true,"content":"[Open Habitat] The owner let you continue.","details":{"schema_version":1,"line_id":"` + guestLine + `","kind":"continue","mode":"approve_each","request":"` + guestMsgA + `","subject":"github:1001","display_name":"Example Participant","at":"2026-11-21T10:01:00Z"}}`,
		`{"type":"custom","id":"tm3","customType":"oh-turn-mode","data":{"schema_version":1,"mode":"approve_each","by":"continue","covers":0,"request":"` + guestMsgA + `"}}`,
		`{"type":"custom","id":"ap1","customType":"oh-approval","data":{"schema_version":1,"call_id":"call-1","tool":"bash","answer":"allowed","request":"` + guestMsgA + `"}}`,
		`{"type":"custom","id":"ap2","customType":"oh-approval","data":{"schema_version":1,"call_id":"call-2","tool":"write","answer":"denied","request":"` + guestMsgA + `"}}`,
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if _, err := f.WriteString(strings.Join(lines, "\n") + "\n"); err != nil {
		t.Fatal(err)
	}
	return path
}

func guestDo(t *testing.T, h http.Handler, method, path, body string, header string) (int, string) {
	t.Helper()
	var reader io.Reader = http.NoBody
	if body != "" {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Host = "unix"
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if header != "" {
		req.Header.Set(GuestParticipantHeader, header)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	return w.Code, w.Body.String()
}

func joinedGuest(t *testing.T) (*ConversationController, http.Handler, string) {
	t.Helper()
	c, _ := membershipFixture(t)
	sharedHistory(t, c)
	if code, _, body := memberCall(t, c, "POST", control("invite", ville.Subject, ville.DisplayName)); code != 200 {
		t.Fatal("invite", code, body)
	}
	return c, guestHandlerFor(c, func(*http.Request) bool { return true }), villeHeader(t)
}

// A participant reads this one conversation as the owner's history read
// gives it, thinking and tool results included, with authors on
// participant messages and Habitat lines; the owner's `!!` command is not
// part of it. Only a joined member reads; an invited one sees the
// invitation's title and nothing else.
func TestGuestReadsTheConversationWithoutOwnerOnlyParts(t *testing.T) {
	c, h, header := joinedGuest(t)
	base := "/guest/v1/conversations/" + memberConv + "/"
	// An untitled conversation's first message is not shown before joining.
	if code, body := guestDo(t, h, "GET", base+"invite", "", header); code != 200 || !strings.Contains(body, `"title":""`) || strings.Contains(body, "saved") || !strings.Contains(body, `"state":"invited"`) {
		t.Fatal("invite card", code, body)
	} else {
		validateAgainstSchema(t, "conversation-guest.schema.json", "invite", []byte(body))
	}
	for _, op := range []string{"history?messages=50", "state"} {
		if code, _ := guestDo(t, h, "GET", base+op, "", header); code != 404 {
			t.Fatal("invited person read", op, code)
		}
	}
	if _, ok := c.joinMember(memberConv, ville); !ok {
		t.Fatal("join")
	}
	code, body := guestDo(t, h, "GET", base+"history?messages=50", "", header)
	if code != 200 {
		t.Fatal("history", code, body)
	}
	for _, want := range []string{"private reasoning shown as to the owner", "tool output", "visible-bash", `"participant_message":{"message_id":"` + guestMsgA + `","subject":"github:1001","display_name":"Example Participant","role":"participant","text":"Please look at 1"}`, `"conversation_line":{"line_id":"` + guestLine + `","kind":"continue","mode":"approve_each"`} {
		if !strings.Contains(body, want) {
			t.Fatalf("history lacks %q: %s", want, body)
		}
	}
	if strings.Contains(body, "owner-only-bash") || strings.Contains(body, `"b2"`) || strings.Contains(body, "oh-turn-mode") || strings.Contains(body, "call-1") {
		t.Fatal("history leaked the owner's !! command or hidden records:", body)
	}
	historyMatchesSchema(t, body)
	// The owner's own read keeps the !! command.
	owner := HistoryHandler(c.nativeCfg(), func(*http.Request) bool { return true })
	if _, body := guestDo(t, owner, "GET", "/api/v1/agents/pi:"+memberConv+"/history?messages=50", "", ""); !strings.Contains(body, "owner-only-bash") {
		t.Fatal("owner lost the !! command", body)
	}
	// Forward pages skip it and still say where to go on.
	code, body = guestDo(t, h, "GET", base+"history?after=b1&limit=1", "", header)
	if code != 200 || strings.Contains(body, "owner-only-bash") || !strings.Contains(body, `"entries":[]`) || !strings.Contains(body, `"next_after":"b2"`) {
		t.Fatal("forward page", code, body)
	}
	if code, body := guestDo(t, h, "GET", base+"history?after=b2&limit=1", "", header); code != 200 || !strings.Contains(body, `"entry_key":"p1"`) {
		t.Fatal("forward page after the hidden entry", code, body)
	}
	// A block read of the hidden entry looks like a missing one.
	var page struct {
		Revision string `json:"native_revision"`
	}
	_ = json.Unmarshal([]byte(body), &page)
	if code, _ := guestDo(t, h, "GET", base+"blocks/b2/1?revision="+page.Revision+"&offset=0&limit_bytes=100", "", header); code != 404 {
		t.Fatal("hidden block read", code)
	}
	if code, body := guestDo(t, h, "GET", base+"blocks/b1/1?revision="+page.Revision+"&offset=0&limit_bytes=100", "", header); code != 200 || !strings.Contains(body, "visible-bash") {
		t.Fatal("visible block read", code, body)
	}
	// Another conversation of the owner is not reachable through this one.
	if code, _ := guestDo(t, h, "GET", "/guest/v1/conversations/22222222-2222-4333-8444-555555555555/history?messages=5", "", header); code != 404 {
		t.Fatal("foreign conversation", code)
	}
	// Removed: refused again.
	memberCall(t, c, "POST", control("remove", ville.Subject, ""))
	for _, op := range []string{"history?messages=50", "state", "invite"} {
		if code, _ := guestDo(t, h, "GET", base+op, "", header); code != 404 {
			t.Fatal("removed person read", op, code)
		}
	}
}

func historyMatchesSchema(t *testing.T, body string) {
	t.Helper()
	var page struct {
		Entries []json.RawMessage `json:"entries"`
	}
	if json.Unmarshal([]byte(body), &page) != nil || len(page.Entries) == 0 {
		t.Fatal("no entries", body)
	}
	validateAgainstSchema(t, "history.schema.json", "historyPage", []byte(body))
}

// The facts follow the companion's rules: the owner's message settles the
// newest waiting request, an older one waits until released, and the
// release's per-call answers are read back.
func TestSharedFactsAndGuestState(t *testing.T) {
	c, h, header := joinedGuest(t)
	if _, ok := c.joinMember(memberConv, ville); !ok {
		t.Fatal("join")
	}
	c.journal = newEventJournal()
	base := "/guest/v1/conversations/" + memberConv + "/"
	code, body := guestDo(t, h, "GET", base+"state", "", header)
	if code != 200 {
		t.Fatal("state", code, body)
	}
	var state struct {
		Turn    sharedTurn       `json:"turn"`
		Waiting []waitingRequest `json:"waiting_requests"`
		Release sharedRelease    `json:"release"`
		Run     struct{ State string }
		Name    string `json:"workspace_name"`
		Cursor  string `json:"journal_cursor"`
	}
	if json.Unmarshal([]byte(body), &state) != nil {
		t.Fatal(body)
	}
	if len(state.Waiting) != 0 {
		// The newer request was settled by the owner, the older released.
		t.Fatalf("waiting: %+v", state.Waiting)
	}
	if state.Turn.Mode != "approve_each" || state.Turn.By != "continue" || state.Turn.Request != guestMsgA {
		t.Fatalf("turn: %+v", state.Turn)
	}
	if state.Release.Request != guestMsgA || state.Release.Mode != "approve_each" || len(state.Release.Approvals) != 2 || state.Release.Approvals[1].Answer != "denied" {
		t.Fatalf("release: %+v", state.Release)
	}
	if state.Run.State != "stopped" || state.Name != "project" || state.Cursor == "" {
		t.Fatalf("state: %s", body)
	}
	validateAgainstSchema(t, "conversation-guest.schema.json", "", []byte(body))
	for _, leak := range []string{c.home, "/src/", "ws_12345678"} {
		if strings.Contains(body, leak) {
			t.Fatalf("state leaked %q: %s", leak, body)
		}
	}
	// Without the release and the owner's message both requests wait.
	entries := []historyEntry{}
	for _, raw := range []string{
		`{"type":"custom_message","id":"p1","customType":"oh-participant-message","display":true,"content":"[Open Habitat] x\n\nfirst","details":{"message_id":"` + guestMsgA + `","subject":"github:1001","display_name":"Example Participant","role":"participant"}}`,
		`{"type":"custom_message","id":"p2","customType":"oh-participant-message","display":true,"content":"[Open Habitat] x\n\nsecond","details":{"message_id":"` + guestMsgB + `","subject":"github:1001","display_name":"Example Participant","role":"participant"}}`,
		`{"type":"custom_message","id":"p3","customType":"oh-participant-message","display":true,"content":"[Open Habitat] x\n\nwith tools","details":{"message_id":"` + guestLine + `","subject":"github:1001","display_name":"Example Participant","role":"full_rights"}}`,
	} {
		var e nativeEntry
		if json.Unmarshal([]byte(raw), &e) != nil {
			t.Fatal(raw)
		}
		e.Raw = json.RawMessage(raw)
		entries = append(entries, nativeBlocks(e))
	}
	facts := sharedFactsOf(entries)
	if len(facts.Waiting) != 2 || facts.Waiting[0].Request != guestMsgA || facts.Turn.Mode != "tools" || facts.Turn.By != "participant" || facts.Turn.DisplayName != "Example Participant" {
		t.Fatalf("facts: %+v %+v", facts.Waiting, facts.Turn)
	}
	// A participant message whose details the record could not have written
	// gets no author.
	forged := `{"type":"custom_message","id":"p4","customType":"oh-participant-message","display":true,"content":"[Open Habitat] x\n\nhi","details":{"message_id":"` + guestMsgA + `","subject":"github:1001","display_name":"Example Participant","role":"owner"}}`
	var e nativeEntry
	_ = json.Unmarshal([]byte(forged), &e)
	e.Raw = json.RawMessage(forged)
	if nativeBlocks(e).ParticipantMessage != nil {
		t.Fatal("a role outside the record's became an author")
	}
	// The owner reads the same facts on their own route.
	req := httptest.NewRequest("GET", "/api/v1/conversations/"+memberConv+"/shared", nil)
	w := httptest.NewRecorder()
	c.sharedState(w, req, memberConv)
	raw := w.Body.String()
	if w.Code != 200 || !strings.Contains(raw, `"release":{"request":"`+guestMsgA) || !strings.Contains(raw, `"waiting_requests":[]`) || !strings.Contains(raw, `"present":[]`) {
		t.Fatal("owner facts", w.Code, raw)
	}
	validateAgainstSchema(t, "conversation-guest.schema.json", "ownerShared", []byte(raw))
}

// What a participant sees of the owner's journal: this conversation's
// allowlisted kinds only. A question is a change, never its prompt; a `!!`
// command and the owner's process-run details stay out; a new kind is
// private until it is put on the list.
func TestGuestFrameAllowlist(t *testing.T) {
	j := newEventJournal()
	agent := "pi:" + memberConv
	other := "pi:22222222-2222-4333-8444-555555555555"
	j.appendEvent("assistant.delta", agent, map[string]any{"text": "hello"})
	j.appendEvent("assistant.thinking.delta", agent, map[string]any{"text": "thinking"})
	j.appendEvent("assistant.delta", other, map[string]any{"text": "other conversation"})
	j.appendEvent("queue.changed", agent, map[string]any{"revision": "queue_00000001", "steering": []string{"owner queued text"}, "follow_up": []string{}})
	j.appendEvent("command.changed", agent, map[string]any{"acceptance": "accepted"})
	j.appendEvent("question.requested", agent, map[string]any{"request_id": "q1", "question_kind": "approval", "prompt": "owner prompt", "approval": map[string]any{"arguments": "rm -rf"}})
	j.appendEvent("history.entry", agent, map[string]any{"entry_key": "b2", "entry_kind": "bash", "exclude_from_context": true, "content": map[string]any{"text": "owner-only"}})
	j.appendEvent("history.entry", agent, map[string]any{"entry_key": "n1", "entry_kind": "unknown", "content": map[string]any{"text": "x"}, "blocks": []any{map[string]any{"type": "process_event", "process_event": map[string]any{"kind": "exit", "spinoff": []any{map[string]any{"title": "owner run"}}}}}})
	j.appendEvent("process.changed", agent, map[string]any{"owner_generation": "g"})
	j.appendEvent("bash.output", agent, map[string]any{"text": "owner shell"})
	j.appendEvent("some.future.kind", agent, map[string]any{"secret": "s"})
	j.appendInvalidation("")
	j.appendEvent("presence.changed", agent, map[string]any{"present": []any{}})
	j.mu.Lock()
	frames := append([][]byte(nil), j.frames...)
	j.mu.Unlock()
	var seen []string
	var all []byte
	for _, f := range frames {
		if b := guestFrame(agent, f); b != nil {
			var e struct{ Kind string }
			_ = json.Unmarshal(b, &e)
			seen = append(seen, e.Kind)
			all = append(all, b...)
		}
	}
	want := "assistant.delta assistant.thinking.delta snapshot.invalidated history.entry snapshot.invalidated presence.changed"
	if strings.Join(seen, " ") != want {
		t.Fatalf("kinds: %v", seen)
	}
	for _, leak := range []string{"other conversation", "owner queued text", "owner prompt", "rm -rf", "owner-only", "owner run", "owner shell", "secret"} {
		if bytes.Contains(all, []byte(leak)) {
			t.Fatalf("leaked %q: %s", leak, all)
		}
	}
}

// The stream follows the owner's journal through the allowlist and ends
// when the owner removes the participant.
func TestGuestStreamFiltersAndEndsOnRemoval(t *testing.T) {
	c, h, header := joinedGuest(t)
	if _, ok := c.joinMember(memberConv, ville); !ok {
		t.Fatal("join")
	}
	c.journal = newEventJournal()
	agent := "pi:" + memberConv
	start := c.journal.position()
	srv := httptest.NewServer(h)
	defer srv.Close()
	req, _ := http.NewRequest("GET", srv.URL+"/guest/v1/conversations/"+memberConv+"/events?after="+start, nil)
	req.Host = "unix"
	req.Header.Set(GuestParticipantHeader, header)
	res, err := srv.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		b, _ := io.ReadAll(res.Body)
		t.Fatal("stream", res.StatusCode, string(b))
	}
	c.journal.appendEvent("queue.changed", agent, map[string]any{"revision": "queue_00000001", "steering": []string{"owner queued text"}, "follow_up": []string{}})
	c.journal.appendEvent("assistant.delta", agent, map[string]any{"text": "visible text"})
	reader := bufio.NewReader(res.Body)
	got := ""
	for !strings.Contains(got, "visible text") {
		line, err := reader.ReadString('\n')
		if err != nil {
			t.Fatal("stream ended", err, got)
		}
		got += line
	}
	if strings.Contains(got, "owner queued text") {
		t.Fatal("queue text reached the participant", got)
	}
	memberCall(t, c, "POST", control("remove", ville.Subject, ""))
	done := make(chan struct{})
	go func() { _, _ = io.ReadAll(reader); close(done) }()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("removal left the stream open")
	}
	// Not a member: no stream at all.
	res2, err := srv.Client().Do(req.Clone(req.Context()))
	if err != nil {
		t.Fatal(err)
	}
	res2.Body.Close()
	if res2.StatusCode != 404 {
		t.Fatal("removed person opened a stream", res2.StatusCode)
	}
}

// A participant sends, sees and cancels only their own held messages, may
// stop a running turn, and says they are present; removal forgets them.
func TestGuestSendCancelAbortAndPresence(t *testing.T) {
	f := newGuestTurnFixture(t)
	f.busy = true // Pi refuses deliveries as during a run: the message stays held
	c := f.c
	c.journal = newEventJournal()
	sharedHistory(t, c)
	h := guestHandlerFor(c, func(*http.Request) bool { return true })
	header := villeHeader(t)
	base := "/guest/v1/conversations/" + memberConv + "/"
	code, body := guestDo(t, h, "POST", base+"send", `{"text":"Could you check the tests?"}`, header)
	if code != 200 || !strings.Contains(body, `"state":"held"`) {
		t.Fatal("send", code, body)
	}
	var sent struct {
		MessageID string `json:"message_id"`
	}
	_ = json.Unmarshal([]byte(body), &sent)
	validateAgainstSchema(t, "conversation-guest.schema.json", "sendReply", []byte(body))
	// Wait for the refused delivery attempt to release the item.
	deadline := time.Now().Add(3 * time.Second)
	for {
		held := f.held()
		if len(held) == 1 && !held[0].delivering {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("held: %+v", held)
		}
		time.Sleep(20 * time.Millisecond)
	}
	if code, body := guestDo(t, h, "GET", base+"state", "", header); code != 200 || !strings.Contains(body, "Could you check the tests?") {
		t.Fatal("own held message not in state", code, body)
	}
	// Someone else in the conversation sees no held text of another person.
	other := guestParticipant{Subject: "github:1002", DisplayName: "Second Participant"}
	memberCall(t, c, "POST", control("invite", other.Subject, other.DisplayName))
	if _, ok := c.joinMember(memberConv, other); !ok {
		t.Fatal("second join")
	}
	otherHeader := participantHeader(t, map[string]string{"subject": other.Subject, "display_name": other.DisplayName, "avatar_url": ""})
	if code, body := guestDo(t, h, "GET", base+"state", "", otherHeader); code != 200 || strings.Contains(body, "Could you check the tests?") {
		t.Fatal("another person's held text shown", code, body)
	}
	if code, _ := guestDo(t, h, "POST", base+"cancel", `{"message_id":"`+sent.MessageID+`"}`, otherHeader); code != 409 {
		t.Fatal("cancelled another person's message", code)
	}
	if code, body := guestDo(t, h, "POST", base+"cancel", `{"message_id":"`+sent.MessageID+`"}`, header); code != 200 || !strings.Contains(body, `"state":"cancelled"`) {
		t.Fatal("cancel", code, body)
	}
	// No turn runs: nothing to stop. Bad input is refused.
	if code, body := guestDo(t, h, "POST", base+"abort", "", header); code != 409 || !strings.Contains(body, "not_running") {
		t.Fatal("abort while idle", code, body)
	}
	if code, _ := guestDo(t, h, "POST", base+"send", `{"text":"x","role":"full_rights"}`, header); code != 400 {
		t.Fatal("send with a role claim", code)
	}
	// Presence: told to every browser of the conversation, gone on removal.
	if code, _ := guestDo(t, h, "POST", base+"presence", `{"state":"typing"}`, header); code != 200 {
		t.Fatal("presence")
	}
	if p := c.presentIn(memberConv); len(p) != 1 || p[0]["typing"] != true || p[0]["display_name"] != ville.DisplayName {
		t.Fatalf("present: %+v", p)
	}
	c.journal.mu.Lock()
	last := string(c.journal.frames[len(c.journal.frames)-1])
	c.journal.mu.Unlock()
	if !strings.Contains(last, `"kind":"presence.changed"`) || !strings.Contains(last, `"typing":true`) {
		t.Fatal("presence not published", last)
	}
	validateAgainstSchema(t, "event.schema.json", "", []byte(last))
	memberCall(t, c, "POST", control("remove", ville.Subject, ""))
	if p := c.presentIn(memberConv); len(p) != 0 {
		t.Fatalf("removed person still present: %+v", p)
	}
	if code, _ := guestDo(t, h, "POST", base+"presence", `{"state":"present"}`, header); code != 404 {
		t.Fatal("removed person said present", code)
	}
	if code, _ := guestDo(t, h, "POST", base+"send", `{"text":"again"}`, header); code != 404 {
		t.Fatal("removed person sent", code)
	}
}

// validateAgainstSchema validates body against a contract's root, or one of
// its $defs, with the repository's own validator.
func validateAgainstSchema(t *testing.T, schema, def string, body []byte) {
	t.Helper()
	python := testpython.Validator(t)
	cmd := exec.Command(python, "-c", `import sys,runpy,json
m=runpy.run_path('../../scripts/validate-contracts.py')
s=m['schemas'][sys.argv[1]]
if sys.argv[2]: s={"$ref": s["$id"]+"#/$defs/"+sys.argv[2]}
m['Draft202012Validator'](s,registry=m['registry'],format_checker=m['format_checker']).validate(json.load(sys.stdin))`, schema, def)
	cmd.Stdin = bytes.NewReader(body)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("%s %s: %s: %v\n%s", schema, def, out, err, body)
	}
}

// A guest stream rechecks the record while it replays, not only when the
// journal goes quiet: a busy journal must not keep a refused person
// reading.
func TestGuestStreamRechecksWhileReplaying(t *testing.T) {
	j := newEventJournal()
	start := j.position()
	for i := 0; i < 200; i++ {
		j.appendEvent("assistant.delta", "pi:"+memberConv, map[string]any{"text": "frame"})
	}
	previous := eventHeartbeatInterval
	eventHeartbeatInterval = time.Millisecond
	defer func() { eventHeartbeatInterval = previous }()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Host = "unix"
		j.serve(w, r, func() bool { return true }, func(b []byte) []byte { time.Sleep(2 * time.Millisecond); return b }, func() bool { return false })
	}))
	defer srv.Close()
	res, err := srv.Client().Get(srv.URL + "/?after=" + start)
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(res.Body)
	res.Body.Close()
	if n := strings.Count(string(body), "event: assistant.delta"); n > 5 {
		t.Fatalf("a refused stream replayed %d frames", n)
	}
}
