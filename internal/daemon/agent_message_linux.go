//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/open-habitat/open-habitat/internal/agentblock"
)

// AgentMessagesFeature is the experimental switch for agent messages between
// the person's conversations (agent-agent-messages). It governs only how the
// browser draws them. The daemon marks every message admitted through the
// agent route with its sender whether the switch is on or not, so a message
// from another agent never reads as the person's own words.
const AgentMessagesFeature = "agent-agent-messages"

// agentFrom is the sending conversation's launch context, as the CLI read it
// from its environment. It names the sender only if it matches the live
// launch, the same proof `--current` uses.
type agentFrom struct {
	AgentID     string `json:"agent_id"`
	WorkspaceID string `json:"workspace_id"`
	Generation  string `json:"generation"`
}

// agentMessage is what the agent route adds to one message. admitMessage
// fills it when it writes the block; sendKind reads it for the typed reply.
type agentMessage struct {
	delivery string
	from     agentblock.Sender
	quote    *agentblock.Quote
	text     string // the agent's own text, without the block
	marked   bool
}

// sentAgentMessage is the typed result of `agent message create`
// (agent-message-sent.schema.json): the agent route's reply and, read back
// from the sender's tool result, the history fact sent_agent_message.
type sentAgentMessage struct {
	Kind            string          `json:"kind,omitempty"`
	MessageID       string          `json:"message_id"`
	To              string          `json:"to,omitempty"`
	Title           string          `json:"title,omitempty"`
	WorkspaceID     string          `json:"workspace_id,omitempty"`
	ConversationURL string          `json:"conversation_url,omitempty"`
	MessageURL      string          `json:"message_url,omitempty"`
	Delivery        string          `json:"delivery"`
	State           string          `json:"state"`
	Text            string          `json:"text"`
	TextTruncated   bool            `json:"text_truncated,omitempty"`
	Quote           *agentQuoteFact `json:"quote,omitempty"`
	CommandID       string          `json:"command_id,omitempty"`
	SchemaVersion   int             `json:"schema_version,omitempty"`
}

// agentQuoteFact is a quote as history and the typed result carry it.
// FromAgentID is null for a message sent from outside a conversation.
type agentQuoteFact struct {
	MessageID   string  `json:"message_id"`
	FromAgentID *string `json:"from_agent_id"`
	Excerpt     string  `json:"excerpt"`
}

// agentMessageFact is the history fact of a received message
// (agent_message). FromAgentID is null for a message sent from outside a
// conversation; title and workspace are then absent.
type agentMessageFact struct {
	MessageID   string          `json:"message_id"`
	FromAgentID *string         `json:"from_agent_id"`
	Title       string          `json:"title,omitempty"`
	WorkspaceID string          `json:"workspace_id,omitempty"`
	Quote       *agentQuoteFact `json:"quote,omitempty"`
}

// maxFactText bounds a sent message's echoed text in a history fact, as a
// participant message's text is bounded.
const maxFactText = 16000

func agentIDOrNull(agent string) *string {
	if agent == agentblock.Outside || agent == "" {
		return nil
	}
	return &agent
}

func quoteFact(q *agentblock.Quote) *agentQuoteFact {
	if q == nil {
		return nil
	}
	return &agentQuoteFact{MessageID: q.Message, FromAgentID: agentIDOrNull(q.From), Excerpt: q.Excerpt}
}

// conversationURL is the browser route that opens a conversation.
func conversationURL(workspace, agentID string) string {
	return "/workspaces/" + workspace + "?conversation=" + agentID
}

// agentSender resolves who sends: the launch context when the CLI sent one
// and it is still the live launch, otherwise outside. A context that no
// longer matches is refused rather than downgraded, so a message never
// claims less than its sender is.
func (c *ConversationController) agentSender(from *agentFrom) (agentblock.Sender, int, string) {
	if from == nil {
		return agentblock.Sender{Agent: agentblock.Outside}, 0, ""
	}
	q := agentConversationQuery{id: from.AgentID, workspace: from.WorkspaceID, generation: from.Generation, current: true}
	if c.staleLaunch(q) {
		return agentblock.Sender{}, 409, "current_context_stale"
	}
	title := agentblock.CleanTitle(c.conversationTitle(strings.TrimPrefix(from.AgentID, "pi:")))
	if title == "" {
		title, _ = sessionTitle("", "")
	}
	return agentblock.Sender{Agent: from.AgentID, Title: title, Workspace: from.WorkspaceID}, 0, ""
}

// conversationTitle is the conversation's title as the rail shows it.
func (c *ConversationController) conversationTitle(id string) string {
	read := nativeSessions
	title := func(s nativeSession) (string, string) {
		return firstPrompt(s, c.cfg.UID), nativeNameDisplay(s, c.cfg.UID)
	}
	if c.facts != nil {
		read = c.facts.sessions.read
		title = func(s nativeSession) (string, string) { return c.facts.sessions.title(s, c.cfg.UID) }
	}
	if sessions, err := read(c.nativeCfg()); err == nil {
		for _, s := range sessions {
			if s.id == id {
				name, _ := sessionTitle(title(s))
				return name
			}
		}
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	given := ""
	if s := c.sessions[id]; s != nil {
		given = s.givenName
	}
	name, _ := sessionTitle("", given)
	return name
}

// agentQuote finds message id in the sender's own conversation: a message it
// received (its block) or one it sent (its tool result), on the current
// branch. The excerpt is that message's text as the reply-to quote takes it.
// A message that never passed through the sender's conversation is not
// found, so an agent cannot attribute words to a message that does not
// exist there.
func (c *ConversationController) agentQuote(sender, id string) (*agentblock.Quote, bool) {
	s, ok := c.rewindSource(strings.TrimPrefix(sender, "pi:"))
	if !ok {
		return nil, false
	}
	path, ok := s.branch(s.leaf)
	if !ok {
		return nil, false
	}
	offsets := make([]int64, 0, len(path))
	for i := len(path) - 1; i >= 0; i-- {
		if path[i].kind == "user" || path[i].kind == "toolResult" {
			offsets = append(offsets, path[i].offset)
		}
	}
	var found *agentblock.Quote
	readNativeRecords(s.path, s.uid, offsets, []byte(id), func(record []byte) bool {
		var e struct {
			Message json.RawMessage `json:"message"`
		}
		if json.Unmarshal(record, &e) != nil {
			return true
		}
		if block, rest, ok := receivedAgentMessage(e.Message); ok && block.Message == id {
			found = &agentblock.Quote{Message: id, From: block.From.Agent, Excerpt: agentblock.Excerpt(rest)}
			return false
		}
		if sent, ok := sentAgentMessageResult(e.Message); ok && sent.MessageID == id {
			found = &agentblock.Quote{Message: id, From: sender, Excerpt: agentblock.Excerpt(sent.Text)}
			return false
		}
		return true
	})
	return found, found != nil && found.Excerpt != ""
}

// readNativeRecords visits the records at offsets in one open file, with
// the same owner check as the session read that found them. A record that
// does not contain needle is skipped unparsed.
func readNativeRecords(path string, uid int, offsets []int64, needle []byte, visit func([]byte) bool) {
	info, err := os.Lstat(path)
	if err != nil || !info.Mode().IsRegular() {
		return
	}
	if uid >= 0 {
		if owner, ok := fileOwner(info); !ok || owner != uid {
			return
		}
	}
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	if opened, err := f.Stat(); err != nil || !os.SameFile(info, opened) {
		return
	}
	for _, offset := range offsets {
		if offset < 0 || offset >= info.Size() {
			continue
		}
		if _, err := f.Seek(offset, io.SeekStart); err != nil {
			return
		}
		var record []byte
		if _, err := eachNativeLine(io.LimitReader(bufio.NewReader(f), info.Size()-offset), func(line []byte) bool {
			record = append([]byte(nil), line...)
			return false
		}); err != nil || record == nil {
			continue
		}
		if !bytes.Contains(record, needle) {
			continue
		}
		if !visit(record) {
			return
		}
	}
}

// receivedAgentMessage reads the block from a user message: a plain string
// content or a first text block.
func receivedAgentMessage(message json.RawMessage) (agentblock.Block, string, bool) {
	var m struct {
		Role    string          `json:"role"`
		Content json.RawMessage `json:"content"`
	}
	if json.Unmarshal(message, &m) != nil || m.Role != "user" {
		return agentblock.Block{}, "", false
	}
	var text string
	if json.Unmarshal(m.Content, &text) != nil {
		var blocks []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		}
		if json.Unmarshal(m.Content, &blocks) != nil || len(blocks) == 0 || blocks[0].Type != "text" {
			return agentblock.Block{}, "", false
		}
		text = blocks[0].Text
	}
	return agentblock.Parse(text)
}

// sentAgentMessageResult recognises a bash tool result that printed the
// typed result of `agent message create`. History reads the result, never
// the command line: the text arrived on stdin, and a command can be written
// in many ways. The CLI prints its warnings on stderr before the JSON, so the
// result starts at the first line that opens an object.
func sentAgentMessageResult(message json.RawMessage) (*sentAgentMessage, bool) {
	var m struct {
		Role     string          `json:"role"`
		ToolName string          `json:"toolName"`
		IsError  bool            `json:"isError"`
		Content  json.RawMessage `json:"content"`
	}
	if json.Unmarshal(message, &m) != nil || m.Role != "toolResult" || m.ToolName != "bash" || m.IsError {
		return nil, false
	}
	var text string
	if json.Unmarshal(m.Content, &text) != nil {
		var blocks []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		}
		if json.Unmarshal(m.Content, &blocks) != nil {
			return nil, false
		}
		for _, b := range blocks {
			if b.Type == "text" {
				text += b.Text
			}
		}
	}
	if !strings.Contains(text, `"agent_message_sent"`) {
		return nil, false
	}
	start := strings.Index(text, "\n{")
	if strings.HasPrefix(text, "{") {
		start = 0
	} else if start >= 0 {
		start++
	} else {
		return nil, false
	}
	var out struct {
		SchemaVersion int `json:"schema_version"`
		Data          struct {
			Result sentAgentMessage `json:"result"`
		} `json:"data"`
	}
	if json.NewDecoder(strings.NewReader(text[start:])).Decode(&out) != nil || out.SchemaVersion != 1 {
		return nil, false
	}
	sent := out.Data.Result
	if sent.Kind != "agent_message_sent" || !agentblock.ValidMessage(sent.MessageID) || !strings.HasPrefix(sent.To, "pi:") || !sessionIDPattern.MatchString(strings.TrimPrefix(sent.To, "pi:")) || !idPattern.MatchString(sent.WorkspaceID) || sent.Text == "" {
		return nil, false
	}
	switch sent.Delivery {
	case "send", "steer", "follow-up":
	default:
		return nil, false
	}
	switch sent.State {
	case "pending", "held":
	default:
		return nil, false
	}
	sent.Title = agentblock.CleanTitle(sent.Title)
	if sent.Title == "" {
		return nil, false
	}
	if q := sent.Quote; q != nil && (!agentblock.ValidMessage(q.MessageID) || q.Excerpt == "" || utf8.RuneCountInString(q.Excerpt) > 2048 || (q.FromAgentID != nil && (!strings.HasPrefix(*q.FromAgentID, "pi:") || !sessionIDPattern.MatchString(strings.TrimPrefix(*q.FromAgentID, "pi:"))))) {
		return nil, false
	}
	return &sent, true
}

// sentAgentMessageFact is the history fact for a sender's tool result: the
// typed result without its routes and bookkeeping, its text bounded.
func sentAgentMessageFact(sent *sentAgentMessage) *sentAgentMessage {
	fact := &sentAgentMessage{MessageID: sent.MessageID, To: sent.To, Title: sent.Title, WorkspaceID: sent.WorkspaceID, Delivery: sent.Delivery, State: sent.State, Text: sent.Text, Quote: sent.Quote}
	if len(fact.Text) > maxFactText {
		fact.Text, fact.TextTruncated = prefixBytes(fact.Text, maxFactText), true
	}
	return fact
}

// agentMessageFactOf projects a received block into its history fact.
func agentMessageFactOf(block agentblock.Block) *agentMessageFact {
	return &agentMessageFact{MessageID: block.Message, FromAgentID: agentIDOrNull(block.From.Agent), Title: block.From.Title, WorkspaceID: block.From.Workspace, Quote: quoteFact(block.Quote)}
}

// heldHasAgentMessage reports a held message an agent sent. Held messages
// reach Pi joined as one prompt, and the block names the sender of the
// whole text after it: an agent's message never joins with another one, so
// the person's words are never drawn as the agent's or the other way round.
func heldHasAgentMessage(held []heldMessage) bool {
	for _, h := range held {
		if _, _, ok := agentblock.Parse(h.text); ok {
			return true
		}
	}
	return false
}

// agentQueueText is how a waiting agent message reads in the composer's
// queue: the sending conversation's name, then the text ("{nimi}: {teksti}",
// the same in both languages). Text without a block is returned unchanged.
func agentQueueText(text string) (string, bool) {
	block, rest, ok := agentblock.Parse(text)
	if !ok {
		return text, false
	}
	name := block.From.Title
	if name == "" {
		name = "open-habitat agent"
	}
	return name + ": " + rest, true
}

// agentReply records an admitMessage reply so the agent route can add the
// typed result to a successful one.
type agentReply struct {
	header http.Header
	status int
	body   bytes.Buffer
}

func (r *agentReply) Header() http.Header         { return r.header }
func (r *agentReply) Write(b []byte) (int, error) { return r.body.Write(b) }
func (r *agentReply) WriteHeader(status int) {
	if r.status == 0 {
		r.status = status
	}
}

// sendAgentMessage is the agent route's send, steer or follow-up: the same
// admission as the browser's, with the daemon's block in front of the text
// and the typed result in the reply.
func (c *ConversationController) sendAgentMessage(w http.ResponseWriter, r *http.Request, id, kind string) {
	delivery := map[string]string{"send": "send", "steer": "steer", "follow_up": "follow-up"}[kind]
	mark := &agentMessage{delivery: delivery}
	rec := &agentReply{header: http.Header{}}
	c.admitMessage(rec, r, id, kind, false, mark)
	status := rec.status
	if status == 0 {
		status = 200
	}
	body := rec.body.Bytes()
	if status == 200 && mark.marked {
		var reply struct {
			CommandID string `json:"command_id"`
			State     string `json:"state"`
		}
		if json.Unmarshal(body, &reply) == nil && reply.CommandID != "" {
			workspace := ""
			c.mu.Lock()
			if s := c.sessions[id]; s != nil {
				workspace = s.workspace
			}
			c.mu.Unlock()
			title := agentblock.CleanTitle(c.conversationTitle(id))
			if title == "" {
				title, _ = sessionTitle("", "")
			}
			sent := sentAgentMessage{SchemaVersion: 1, CommandID: reply.CommandID, Kind: "agent_message_sent", MessageID: reply.CommandID, To: "pi:" + id, Title: title, WorkspaceID: workspace, Delivery: delivery, State: reply.State, Text: mark.text, Quote: quoteFact(mark.quote)}
			if idPattern.MatchString(workspace) {
				sent.ConversationURL = conversationURL(workspace, "pi:"+id)
				sent.MessageURL = sent.ConversationURL + "&message=" + reply.CommandID
			}
			if b, err := json.Marshal(sent); err == nil {
				body = b
			}
		}
	}
	for k, v := range rec.header {
		w.Header()[k] = v
	}
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

// guestAgentMessage is an agent message as a participant of the owner's
// shared conversation reads it: from or to "the owner's other conversation",
// without its title, workspace or id, which are the owner's private rail and
// a link the participant could not open. A sent message's tool result
// carries the same names, so its blocks are left out too.
func guestAgentMessage(e *historyEntry) {
	if m := e.AgentMessage; m != nil {
		redacted := &agentMessageFact{MessageID: m.MessageID}
		if m.Quote != nil {
			redacted.Quote = &agentQuoteFact{MessageID: m.Quote.MessageID, Excerpt: m.Quote.Excerpt}
		}
		e.AgentMessage = redacted
	}
	if m := e.SentAgentMessage; m != nil {
		redacted := &sentAgentMessage{MessageID: m.MessageID, Delivery: m.Delivery, State: m.State, Text: m.Text, TextTruncated: m.TextTruncated}
		if m.Quote != nil {
			redacted.Quote = &agentQuoteFact{MessageID: m.Quote.MessageID, Excerpt: m.Quote.Excerpt}
		}
		e.SentAgentMessage = redacted
		e.Blocks = nil
		e.TruncatedBlocks = false
		e.Content = historyContent{MediaType: "text/plain", Text: "", Complete: true}
	}
}

// guestAgentMessagePayload applies guestAgentMessage to a live history.entry
// payload; it reports whether it changed anything.
func guestAgentMessagePayload(payload map[string]any) bool {
	_, received := payload["agent_message"]
	_, sent := payload["sent_agent_message"]
	if !received && !sent {
		return false
	}
	var e historyEntry
	if raw, err := json.Marshal(map[string]any{"agent_message": payload["agent_message"], "sent_agent_message": payload["sent_agent_message"]}); err != nil || json.Unmarshal(raw, &e) != nil {
		delete(payload, "agent_message")
		delete(payload, "sent_agent_message")
		return true
	}
	guestAgentMessage(&e)
	if e.AgentMessage != nil {
		payload["agent_message"] = e.AgentMessage
	}
	if e.SentAgentMessage != nil {
		payload["sent_agent_message"] = e.SentAgentMessage
		delete(payload, "blocks")
		payload["content"] = e.Content
	}
	return true
}

// FixtureAgentMessage sends text to conversation target through the agent
// route, as `open-habitat agent message create` run by the Pi of from
// would: with from's live launch context, or from outside when from is
// empty. Only the synthetic browser host may call it.
func (c *ConversationController) FixtureAgentMessage(target, from, kind, text, quote string) (int, []byte) {
	if !c.fixture || !strings.HasPrefix(target, "pi:") {
		return 400, nil
	}
	var id [16]byte
	if _, err := rand.Read(id[:]); err != nil {
		return 503, nil
	}
	id[6], id[8] = id[6]&0x0f|0x40, id[8]&0x3f|0x80
	commandID := fmt.Sprintf("%x-%x-%x-%x-%x", id[0:4], id[4:6], id[6:8], id[8:10], id[10:])
	body := map[string]any{"message": text, "command_id": commandID}
	if from != "" {
		c.mu.Lock()
		s := c.sessions[strings.TrimPrefix(from, "pi:")]
		if s != nil && s.rpc != nil {
			body["from"] = agentFrom{AgentID: from, WorkspaceID: s.workspace, Generation: s.rpc.processGeneration}
		}
		c.mu.Unlock()
	}
	if quote != "" {
		body["quote"] = quote
	}
	raw, _ := json.Marshal(body)
	req, err := http.NewRequest("POST", "http://unix"+AgentConversationsPath+"/"+strings.TrimPrefix(target, "pi:")+"/"+kind, bytes.NewReader(raw))
	if err != nil {
		return 400, nil
	}
	req.Header.Set("Content-Type", "application/json")
	rec := &agentReply{header: http.Header{}}
	c.sendAgentMessage(rec, req, strings.TrimPrefix(target, "pi:"), kind)
	if rec.status == 0 {
		rec.status = 200
	}
	return rec.status, rec.body.Bytes()
}
