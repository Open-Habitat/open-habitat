//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
	"unicode/utf8"
)

const AgentNoticesPath = "/agent/v1/notices"
const noticeType = "oh-agent-notice"

type agentNotice struct {
	ID          string `json:"notice_id"`
	Origin      string `json:"origin"`
	Timestamp   string `json:"timestamp"`
	Text        string `json:"text"`
	Persistence string `json:"persistence"`
	// View is set when the notice offers an HTML view (ADR 0032).
	View *viewSummary `json:"view,omitempty"`
	// Files is set when the notice offers files to download.
	Files *fileOfferSummary `json:"file_offer,omitempty"`
}

// noticeOffer is what a notice may carry besides its text: at most one of an
// HTML view and a file offer.
type noticeOffer struct {
	view  *viewSummary
	files *fileOfferSummary
}

func sameOffer(n agentNotice, o noticeOffer) bool {
	return sameView(n.View, o.view) && sameFileOffer(n.Files, o.files)
}

func validNotice(n agentNotice) bool {
	t, e := time.Parse(time.RFC3339Nano, n.Timestamp)
	return sessionIDPattern.MatchString(n.ID) && n.Origin == "agent" && e == nil && !t.IsZero() && utf8.ValidString(n.Text) && strings.TrimSpace(n.Text) != "" && len(n.Text) <= 4096 && (n.View == nil || validViewSummary(*n.View)) && (n.Files == nil || validFileOfferSummary(*n.Files)) && (n.View == nil || n.Files == nil) && (n.Persistence == "persisted" || n.Persistence == "not_persisted" || n.Persistence == "unknown")
}
func nativeNotice(e nativeEntry) (agentNotice, bool) {
	var v struct {
		CustomType string      `json:"customType"`
		Data       agentNotice `json:"data"`
	}
	if e.Type != "custom" || json.Unmarshal(e.Raw, &v) != nil || v.CustomType != noticeType || !validNotice(v.Data) {
		return agentNotice{}, false
	}
	v.Data.Persistence = "persisted" // only a verified native read establishes this
	return v.Data, true
}

// Read the current branch, not abandoned branches or another session with the
// same display ID. The open-file identity/size fence refuses a moving target.
func readNativeNotices(path string, uid int, id, cwd string) ([]agentNotice, error) {
	h := readNativeHeader(path, uid)
	if h.state != "readable" || h.id != id || h.cwd != cwd {
		return nil, errors.New("native unavailable")
	}
	before, err := os.Lstat(path)
	if err != nil || !before.Mode().IsRegular() || before.Size() > maxHistoryFile {
		return nil, errors.New("native unavailable")
	}
	if uid >= 0 {
		owner, ok := fileOwner(before)
		if !ok || owner != uid {
			return nil, errors.New("native unavailable")
		}
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	opened, err := f.Stat()
	if err != nil || !os.SameFile(before, opened) {
		return nil, errors.New("native changed")
	}
	notices := make([]agentNotice, 0)
	target := ""
	first := true
	broken := false
	err = reverseLines(f, before.Size(), func(line []byte) bool {
		var e nativeEntry
		if json.Unmarshal(line, &e) != nil {
			broken = true
			return false
		}
		if e.Type == "session" {
			return false
		}
		if !entryIDPattern.MatchString(e.ID) {
			broken = true
			return false
		}
		if first {
			first = false
			target = e.ID
		}
		if e.ID != target {
			return true
		}
		e.Raw = line
		if n, ok := nativeNotice(e); ok {
			notices = append(notices, n)
		}
		if e.ParentID == nil {
			target = ""
			return false
		}
		target = *e.ParentID
		return true
	})
	after, statErr := os.Lstat(path)
	if err != nil || broken || target != "" || statErr != nil || !os.SameFile(before, after) || before.Size() != after.Size() || !before.ModTime().Equal(after.ModTime()) {
		return nil, errors.New("native changed")
	}
	// Native chronological order; the list adapter bounds the wire response.

	for i, j := 0, len(notices)-1; i < j; i, j = i+1, j-1 {
		notices[i], notices[j] = notices[j], notices[i]
	}
	return notices, nil
}
func (c *ConversationController) noticeSource(id string) (*nativeSession, error) {
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		return nil, err
	}
	var match *nativeSession
	for i := range sessions {
		if sessions[i].id == id {
			if match != nil || sessions[i].state != "readable" {
				return nil, errors.New("ambiguous native source")
			}
			match = &sessions[i]
		}
	}
	return match, nil
}
func (c *ConversationController) agentNotices(w http.ResponseWriter, r *http.Request) {
	q, bad := parseAgentConversation(r)
	if bad {
		snapshotError(w, 400, "invalid_arguments")
		return
	}
	if c.staleLaunch(q) {
		snapshotError(w, 409, "current_context_stale")
		return
	}
	if r.Method == "GET" {
		if r.ContentLength > 0 || len(r.TransferEncoding) > 0 {
			snapshotError(w, 400, "invalid_arguments")
			return
		}
		c.noticeMu.Lock()
		defer c.noticeMu.Unlock()
		_, _, source, notices, status, code := c.noticeTarget(q)
		if source == nil {
			snapshotError(w, status, code)
			return
		}
		hasMore := len(notices) > 200
		if hasMore {
			notices = notices[len(notices)-200:]
		}
		historyJSON(w, map[string]any{"schema_version": 1, "agent_id": q.id, "notices": notices, "has_more": hasMore})
		return
	}
	var req struct {
		ID     string `json:"idempotency_key"`
		Text   string `json:"text"`
		DryRun bool   `json:"dry_run"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 32768))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&req) != nil || decoder.Decode(new(any)) != io.EOF || !sessionIDPattern.MatchString(req.ID) || !utf8.ValidString(req.Text) || strings.TrimSpace(req.Text) == "" || len(req.Text) > 4096 {
		snapshotError(w, 400, "invalid_arguments")
		return
	}
	n, status, code := c.createNotice(r.Context(), q, req.ID, req.Text, noticeOffer{}, req.DryRun)
	if status != 0 {
		snapshotError(w, status, code)
		return
	}
	historyJSON(w, map[string]any{"schema_version": 1, "agent_id": q.id, "notice": n, "dry_run": req.DryRun})
}

// staleLaunch reports a --current context that no longer names this
// daemon's live launch; it is decided before any native read or body.
func (c *ConversationController) staleLaunch(q agentConversationQuery) bool {
	if !q.current {
		return false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	s := c.sessions[strings.TrimPrefix(q.id, "pi:")]
	return s == nil || s.dead || s.rpc == nil || s.workspace != q.workspace || s.rpc.processGeneration != q.generation || s.rpc.closing.Load() || channelClosed(s.rpc.exited)
}

// noticeTarget observes the conversation a notice names: its live session,
// whether it runs, and its native source and notices. A nil source comes with
// the refusal's status and code. Call under noticeMu.
func (c *ConversationController) noticeTarget(q agentConversationQuery) (*conversation, bool, *nativeSession, []agentNotice, int, string) {
	if c.staleLaunch(q) {
		return nil, false, nil, nil, 409, "current_context_stale"
	}
	id := strings.TrimPrefix(q.id, "pi:")
	c.mu.Lock()
	s := c.sessions[id]
	live := s != nil && !s.dead && s.rpc != nil && !s.rpc.closing.Load() && !channelClosed(s.rpc.exited)
	c.mu.Unlock()
	source, err := c.noticeSource(id)
	if err != nil {
		return nil, false, nil, nil, 503, "native_source_unavailable"
	}
	if source == nil {
		return nil, false, nil, nil, 404, "conversation_not_found"
	}
	notices, err := readNativeNotices(source.path, c.cfg.UID, id, source.cwd)
	if err != nil {
		return nil, false, nil, nil, 503, "native_source_unavailable"
	}
	return s, live, source, notices, 0, ""
}

// createNotice appends one notice, optionally offering a view, through
// Pi's native writer. A nonzero status is a refusal with its code; nothing was
// written then.
func (c *ConversationController) createNotice(parent context.Context, q agentConversationQuery, key, text string, offer noticeOffer, dry bool) (agentNotice, int, string) {
	c.noticeMu.Lock()
	defer c.noticeMu.Unlock()
	s, live, source, notices, status, code := c.noticeTarget(q)
	if source == nil {
		return agentNotice{}, status, code
	}
	id := strings.TrimPrefix(q.id, "pi:")
	for _, n := range notices {
		if n.ID == key {
			if n.Text != text || !sameOffer(n, offer) {
				return agentNotice{}, 409, "idempotency_conflict"
			}
			return n, 0, ""
		}
	}
	if !live || s.cwd != source.cwd {
		return agentNotice{}, 409, "conversation_not_running"
	}
	n := agentNotice{ID: key, Origin: "agent", Timestamp: time.Now().UTC().Format(time.RFC3339Nano), Text: text, Persistence: "unknown", View: offer.view, Files: offer.files}
	if dry {
		return n, 0, ""
	}
	// The Pi bridge never prompts the model. It calls Pi's own native writer,
	// even during a tool call. Neither an RPC acknowledgement nor Pi's in-memory
	// branch proves that quota allowed the append to reach the native file.
	ctx, cancel := context.WithTimeout(parent, 3*time.Second)
	defer cancel()
	var outcome struct {
		Written bool   `json:"written"`
		Reason  string `json:"reason"`
	}
	err := s.rpc.processRequest(ctx, map[string]any{"op": "notice", "notice": n, "session_id": id, "generation": s.rpc.processGeneration}, &outcome)
	if err == nil && outcome.Reason == "conversation_mismatch" {
		return agentNotice{}, 409, "current_context_stale"
	}
	after, readErr := readNativeNotices(source.path, c.cfg.UID, id, source.cwd)
	// A concurrent native append can move the file under the first observation.
	// Retry only the read, never the write, as the other native settlement readers do.
	if readErr != nil {
		after, readErr = readNativeNotices(source.path, c.cfg.UID, id, source.cwd)
	}
	if readErr == nil {
		for _, found := range after {
			if found.ID == n.ID && found.Text == n.Text && sameOffer(found, noticeOffer{n.View, n.Files}) {
				n = found
				break
			}
		}
	}
	if n.Persistence != "persisted" && err == nil && !outcome.Written && readErr == nil {
		n.Persistence = "not_persisted"
	}
	c.mu.Lock()
	valid := !c.closed && c.sessions[id] == s && !s.dead
	c.mu.Unlock()
	if valid && c.journal != nil {
		c.journal.appendEvent("notice.created", q.id, map[string]any{"notice": n})
		if n.Persistence == "persisted" {
			c.journal.appendInvalidation(q.id)
		}
	}
	return n, 0, ""
}

// FixtureNotice publishes an explicitly synthetic transient notice. It is not
// mounted by the product and is unavailable outside the browser-host controller.
func (c *ConversationController) FixtureNotice(id, text string) bool {
	if !c.fixture || c.journal == nil || !strings.HasPrefix(id, "pi:") || !sessionIDPattern.MatchString(strings.TrimPrefix(id, "pi:")) {
		return false
	}
	key, _ := uuid()
	n := agentNotice{ID: key, Origin: "agent", Timestamp: time.Now().UTC().Format(time.RFC3339Nano), Text: text, Persistence: "not_persisted"}
	if !validNotice(n) {
		return false
	}
	c.journal.appendEvent("notice.created", id, map[string]any{"notice": n})
	return true
}
