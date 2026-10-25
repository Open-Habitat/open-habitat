//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"golang.org/x/sys/unix"
)

// An agent offers to show a workspace file at a line in the person's Habitat
// editor; the person's press opens it through the browser's own file-link
// path. The agent gets no editor grant and cannot open, focus or learn
// anything: the reply says the offer was published, never that it was seen.
// A conversation offer is a native notice carrying the offer; an account
// offer is a transient editor.offered event that only open browsers see. No
// store of offers exists beyond the idempotency memory below.

const (
	AgentEditorOffersPath = "/agent/v1/editor/offers"

	maxEditorOfferPath  = 1024
	maxEditorOfferLine  = 10_000_000
	maxEditorOfferMemos = 256
)

type editorOffer struct {
	ID             string `json:"offer_id"`
	WorkspaceID    string `json:"workspace_id"`
	Path           string `json:"path"`
	Line           int    `json:"line,omitempty"`
	CreatedAt      string `json:"created_at"`
	ConversationID string `json:"conversation_id,omitempty"`
}

// sameEditorOffer compares what an offer asks to show, not when it was made.
func sameEditorOffer(a, b *editorOffer) bool {
	if a == nil || b == nil {
		return a == b
	}
	return a.ID == b.ID && a.WorkspaceID == b.WorkspaceID && a.Path == b.Path && a.Line == b.Line && a.ConversationID == b.ConversationID
}

// validEditorOfferPath accepts only the canonical workspace-relative form, so
// the path the person is shown is the path the editor opens.
func validEditorOfferPath(p string) bool {
	if p == "" || len(p) > maxEditorOfferPath || !utf8.ValidString(p) || strings.ContainsAny(p, "\x00\\") || strings.HasPrefix(p, "/") {
		return false
	}
	for _, r := range p {
		if r < 0x20 || r == 0x7f {
			return false
		}
	}
	// The browser editor's own path rule refuses .git and .agent-host too.
	return path.Clean(p) == p && p != "." && p != ".." && !strings.HasPrefix(p, "../") && validEditorPath(p, false)
}

func validEditorOffer(o editorOffer) bool {
	t, err := time.Parse(time.RFC3339Nano, o.CreatedAt)
	return sessionIDPattern.MatchString(o.ID) && idPattern.MatchString(o.WorkspaceID) && validEditorOfferPath(o.Path) && o.Line >= 0 && o.Line <= maxEditorOfferLine && err == nil && !t.IsZero() && (o.ConversationID == "" || viewConversationPattern.MatchString(o.ConversationID))
}

func editorOfferFile(root, p string, uid uint32) bool {
	dir, err := unix.Open(root, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return false
	}
	defer unix.Close(dir)
	f, err := editorOpen(dir, p, uid, unix.O_PATH)
	if err != nil {
		return false
	}
	defer f.Close()
	st, err := stat(int(f.Fd()))
	return err == nil && st.Mode&unix.S_IFMT == unix.S_IFREG
}

// editorOfferText is the notice's plain text: what a reader of the native
// history sees where no card is drawn.
func editorOfferText(o editorOffer) string {
	if o.Line > 0 {
		return o.Path + ":" + strconv.Itoa(o.Line)
	}
	return o.Path
}

// editorOfferable says whether the person's chosen editor exists here. The
// browser editor always does; VS Code needs the operator's code-server. The
// daemon cannot see whether the installation also has an editor origin.
func (c *ConversationController) editorOfferable() (string, int, string) {
	pref, err := readEditorPreference(c.viewCfg().Home)
	if err != nil {
		return "", 503, "editor_preference_unavailable"
	}
	if pref.Engine == "vscode" {
		available := c.codeServerOffered
		if available == nil {
			available = func() bool {
				cfg, err := LoadEditorConfig()
				return err == nil && cfg.CodeServer != "" && trustedOperatorExecutable(cfg.CodeServer)
			}
		}
		if !available() {
			return pref.Engine, 409, "editor_unavailable"
		}
	}
	return pref.Engine, 0, ""
}

// agentEditorOffers is the agent listener's editor offer. Like a view offer it
// names its conversation (explicit pi:UUID or the checked launch context) or
// none, which makes it an account offer.
func (c *ConversationController) agentEditorOffers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		snapshotError(w, 404, "route_not_found")
		return
	}
	var q agentConversationQuery
	if r.URL.RawQuery != "" {
		var bad bool
		if q, bad = parseAgentConversation(r); bad {
			snapshotError(w, 400, "invalid_arguments")
			return
		}
	}
	var req struct {
		Key         string `json:"idempotency_key"`
		WorkspaceID string `json:"workspace_id"`
		Path        string `json:"path"`
		Line        int    `json:"line,omitempty"`
		DryRun      bool   `json:"dry_run"`
	}
	if !strictViewBody(w, r, &req) || !sessionIDPattern.MatchString(req.Key) || !idPattern.MatchString(req.WorkspaceID) || !validEditorOfferPath(req.Path) || req.Line < 0 || req.Line > maxEditorOfferLine {
		snapshotError(w, 400, "invalid_arguments")
		return
	}
	if q.current && q.workspace != req.WorkspaceID {
		snapshotError(w, 409, "workspace_mismatch")
		return
	}
	// The browser editor's confinement, the stricter of the two editors': a
	// regular file of the person's beneath the workspace, reached without any
	// symlink, so whichever editor the person uses can open it.
	root, ok := editorWorkspaceDir(c.viewCfg(), req.WorkspaceID)
	if !ok {
		snapshotError(w, 404, "workspace_unavailable")
		return
	}
	if !editorOfferFile(root, req.Path, uint32(c.cfg.UID)) {
		snapshotError(w, 404, "file_unavailable")
		return
	}
	engine, status, code := c.editorOfferable()
	if status != 0 {
		snapshotError(w, status, code)
		return
	}
	offer := editorOffer{ID: req.Key, WorkspaceID: req.WorkspaceID, Path: req.Path, Line: req.Line, CreatedAt: time.Now().UTC().Format(time.RFC3339Nano), ConversationID: q.id}
	reply := map[string]any{"schema_version": 1, "dry_run": req.DryRun, "editor": map[string]any{"engine": engine}}
	if q.id != "" {
		c.noticeMu.Lock()
		s, live, source, _, status, code := c.noticeTarget(q)
		c.noticeMu.Unlock()
		if source == nil {
			snapshotError(w, status, code)
			return
		}
		// The card opens in the conversation's own workspace editor.
		if live && s.workspace != req.WorkspaceID {
			snapshotError(w, 409, "workspace_mismatch")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		n, status, code := c.createNotice(ctx, q, req.Key, editorOfferText(offer), noticeOffer{editor: &offer}, req.DryRun)
		if status != 0 {
			snapshotError(w, status, code)
			return
		}
		reply["offer"] = n.Editor
		reply["delivery"] = map[string]any{"target": "conversation", "agent_id": q.id, "persistence": n.Persistence}
		historyJSON(w, reply)
		return
	}
	c.editorOfferMu.Lock()
	defer c.editorOfferMu.Unlock()
	reused := false
	for _, seen := range c.editorOfferMemo {
		if seen.ID == offer.ID {
			if !sameEditorOffer(&seen, &offer) {
				snapshotError(w, 409, "idempotency_conflict")
				return
			}
			offer, reused = seen, true
			break
		}
	}
	if !req.DryRun && !reused {
		c.editorOfferMemo = append(c.editorOfferMemo, offer)
		if len(c.editorOfferMemo) > maxEditorOfferMemos {
			c.editorOfferMemo = c.editorOfferMemo[len(c.editorOfferMemo)-maxEditorOfferMemos:]
		}
		if c.journal != nil {
			c.journal.appendEvent("editor.offered", "", map[string]any{"offer": offer})
		}
	}
	reply["offer"] = offer
	reply["reused"] = reused
	reply["delivery"] = map[string]any{"target": "account", "persistence": "transient"}
	historyJSON(w, reply)
}

// FixtureEditorOffer offers a workspace file to the account through the real
// agent route, or to a conversation as a transient notice (the synthetic host
// has no native Pi writer). It is not mounted by the product and is
// unavailable outside the browser-host controller.
func (c *ConversationController) FixtureEditorOffer(target, workspace, file string, line int) (string, bool) {
	if !c.fixture || c.journal == nil || target != "account" && !viewConversationPattern.MatchString(target) {
		return "", false
	}
	key, _ := uuid()
	if target == "account" {
		body, _ := json.Marshal(map[string]any{"idempotency_key": key, "workspace_id": workspace, "path": file, "line": line})
		r := httptest.NewRequest(http.MethodPost, "http://unix"+AgentEditorOffersPath, bytes.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		c.agentEditorOffers(w, r)
		return key, w.Code == http.StatusOK
	}
	offer := editorOffer{ID: key, WorkspaceID: workspace, Path: file, Line: line, CreatedAt: time.Now().UTC().Format(time.RFC3339Nano), ConversationID: target}
	if !validEditorOffer(offer) {
		return "", false
	}
	n := agentNotice{ID: key, Origin: "agent", Timestamp: offer.CreatedAt, Text: editorOfferText(offer), Persistence: "not_persisted", Editor: &offer}
	c.journal.appendEvent("notice.created", target, map[string]any{"notice": n})
	return key, true
}
