//go:build linux

package daemon

import (
	"encoding/json"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"
)

// AgentSectionPath is where an agent places its own conversation in the
// rail: open-habitat agent section update --current.
const AgentSectionPath = "/agent/v1/section"

// maxAgentSections bounds the choices well inside the shared file's size
// bound, so choices never crowd out the person's own marks.
const maxAgentSections = 256

// agentSection is the agent's own word on where its conversation sits after
// its turn: yours (Sinun vuorosi, as without a choice), running (Käynnissä
// while Habitat sees its work going on) or quiet (Hiljaiset). It belongs to
// the turn it was said in: the next turn, the person's next message and an
// archive remove it, and the person's own turn mark wins over it in the rail.
// It is a section and a time and nothing more, so that a later transition
// (a scheduled wake, say) can replace it like any other choice.
type agentSection struct {
	Section string `json:"section"`
	At      string `json:"at"`
}

func validSection(section string) bool {
	return section == "yours" || section == "running" || section == "quiet"
}

func (s agentSection) valid() bool {
	_, err := time.Parse(time.RFC3339Nano, s.At)
	return err == nil && validSection(s.Section)
}

// setAgentSection stores the conversation's choice and returns the choice
// that now stands and whether anything changed. Choosing the section that
// already stands keeps its time, so a repeated command is a no-op.
func setAgentSection(home, key, section string, now time.Time) (agentSection, bool, error) {
	turnMarksLock.Lock()
	defer turnMarksLock.Unlock()
	value, err := readTurnMarks(home)
	if err != nil {
		return agentSection{}, false, err
	}
	if old, had := value.Sections[key]; had && old.Section == section {
		return old, false, nil
	}
	choice := agentSection{Section: section, At: now.UTC().Format(time.RFC3339Nano)}
	if value.Sections == nil {
		value.Sections = map[string]agentSection{}
	}
	value.Sections[key] = choice
	// The oldest choices of other conversations give way first, so a write
	// never leaves a file the next read refuses.
	keys := make([]string, 0, len(value.Sections))
	for k := range value.Sections {
		if k != key {
			keys = append(keys, k)
		}
	}
	at := func(k string) time.Time { t, _ := time.Parse(time.RFC3339Nano, value.Sections[k].At); return t }
	sort.Slice(keys, func(i, j int) bool { return at(keys[i]).Before(at(keys[j])) })
	for len(keys) > 0 && (len(value.Sections) > maxAgentSections || len(encodeTurnMarks(value)) > maxTurnMarksSize) {
		delete(value.Sections, keys[0])
		keys = keys[1:]
	}
	return choice, true, saveTurnMarks(home, value)
}

// clearAgentSection removes the conversation's choice when it was made
// before `before`: a turn that started, or a message Pi accepted, at that
// moment supersedes it, while a choice the agent makes in the new turn stands.
func clearAgentSection(home, key string, before time.Time) (bool, error) {
	turnMarksLock.Lock()
	defer turnMarksLock.Unlock()
	value, err := readTurnMarks(home)
	if err != nil {
		return false, err
	}
	old, had := value.Sections[key]
	if !had {
		return false, nil
	}
	if at, e := time.Parse(time.RFC3339Nano, old.At); e == nil && !at.Before(before) {
		return false, nil
	}
	delete(value.Sections, key)
	if len(value.Sections) == 0 {
		value.Sections = nil
	}
	return true, saveTurnMarks(home, value)
}

// supersedeAgentSection clears the choice in the background and publishes
// the change. A failed write leaves the choice; the next turn tries again.
func (c *ConversationController) supersedeAgentSection(id string, before time.Time) {
	if c.home == "" {
		return
	}
	go func() {
		if changed, err := clearAgentSection(c.home, "pi:"+id, before); err == nil && changed && c.journal != nil {
			c.journal.appendInvalidation("pi:" + id)
		}
	}()
}

// agentSectionUpdate is POST /agent/v1/section?<current context>. Only the
// conversation's own daemon-launched Pi may choose, and only while its turn
// runs: a worker or leftover script that inherited the context cannot re-place
// a conversation that has moved on, and the choice always follows a turn
// whose reply it describes.
func (c *ConversationController) agentSectionUpdate(w http.ResponseWriter, r *http.Request) {
	q, bad := parseAgentConversation(r)
	if bad || !q.current {
		snapshotError(w, 400, "invalid_arguments")
		return
	}
	if c.staleLaunch(q) {
		snapshotError(w, 409, "current_context_stale")
		return
	}
	var body struct {
		Section string `json:"section"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 512))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF || !validSection(body.Section) {
		snapshotError(w, 400, "invalid_arguments")
		return
	}
	reply, status, code := c.chooseSection(q, body.Section)
	if status != 0 {
		snapshotError(w, status, code)
		return
	}
	historyJSON(w, reply)
}

// chooseSection stores the choice of the verified current launch q. A nonzero
// status is a refusal with its code; nothing was stored then.
func (c *ConversationController) chooseSection(q agentConversationQuery, section string) (map[string]any, int, string) {
	if c.home == "" {
		return nil, 503, "native_source_unavailable"
	}
	if c.staleLaunch(q) {
		return nil, 409, "current_context_stale"
	}
	id := strings.TrimPrefix(q.id, "pi:")
	c.mu.Lock()
	s := c.sessions[id]
	running := s != nil && s.runActive
	c.mu.Unlock()
	if !running {
		return nil, 409, "conversation_not_running"
	}
	choice, changed, err := setAgentSection(c.home, q.id, section, time.Now())
	if err != nil {
		return nil, 503, "native_source_unavailable"
	}
	reply := map[string]any{"schema_version": 1, "agent_id": q.id, "agent_section": choice, "changed": changed}
	if changed && c.journal != nil {
		if cursor := c.journal.appendInvalidation(q.id); cursor != "" {
			reply["event_cursor"] = cursor
		}
	}
	return reply, 0, ""
}

// FixtureAgentSection makes the conversation's live launch choose its
// section, as open-habitat agent section update --current run by its Pi
// would. It is not mounted by the product and refuses outside the
// browser-host controller.
func (c *ConversationController) FixtureAgentSection(id, section string) int {
	if !c.fixture || !validSection(section) || !strings.HasPrefix(id, "pi:") {
		return 400
	}
	c.mu.Lock()
	s := c.sessions[strings.TrimPrefix(id, "pi:")]
	q := agentConversationQuery{id: id, current: true}
	if s != nil && s.rpc != nil {
		q.workspace, q.generation = s.workspace, s.rpc.processGeneration
	}
	c.mu.Unlock()
	_, status, _ := c.chooseSection(q, section)
	if status == 0 {
		return 204
	}
	return status
}
