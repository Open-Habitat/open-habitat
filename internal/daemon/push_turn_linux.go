//go:build linux

package daemon

import (
	"context"
	"time"
)

// SetPushNotifier connects the person's sender to this controller. The
// sender outlives controllers; a fixture's restarted daemon connects it again.
func (c *ConversationController) SetPushNotifier(p *PushNotifier) {
	c.mu.Lock()
	c.push = p
	c.mu.Unlock()
}

// pushTurn notes that a conversation became the person's turn: Pi settled
// a turn (kind "turn", key its native entry) or asked something (kind
// "question", key the request). After the notifier's short delay it checks
// that the turn is still theirs and hands it on. Caller holds c.mu.
func (c *ConversationController) pushTurn(s *conversation, kind, key string) {
	if c.push == nil || c.closed || s.recapOnly {
		return
	}
	p := c.push
	gen := s.turnGeneration
	time.AfterFunc(p.delay, func() {
		c.mu.Lock()
		still := c.sessions[s.id] == s && !c.closed && !s.dead && s.turnGeneration == gen
		switch kind {
		case "turn":
			still = still && !s.runActive && s.state == "idle" && len(s.held) == 0 && s.questionID == ""
		case "question":
			still = still && s.questionID == key
		}
		workspace, title, history := s.workspace, s.givenName, s.historyPath
		if title == "" {
			title = s.automaticName
		}
		c.mu.Unlock()
		if !still {
			return
		}
		turn := pushTurn{agent: "pi:" + s.id, kind: kind, key: kind + ":" + key}
		if history != "" {
			if name := nativeNameDisplay(nativeSession{path: history, state: "readable"}, c.cfg.UID); name != "" {
				title = name
			}
		}
		turn.title = title
		turn.url = "/agents/" + turn.agent
		if name := c.workspaceName(workspace); name != "" {
			turn.workspace = name
			turn.url = "/workspaces/" + workspace + "?conversation=" + turn.agent
		}
		p.notify(context.Background(), turn)
	})
}

// workspaceName is the display name of a top-level workspace, or empty for
// a worktree place or one no longer there.
func (c *ConversationController) workspaceName(id string) string {
	observation := c.discover(c.cfg)
	for _, w := range observation.Entries {
		wid := w.WorkspaceID
		if wid == "" {
			wid = opaque("ws_", c.cfg.Provider+":"+c.cfg.Subject+":"+w.Name)
		}
		if wid == id && w.Error == "" {
			if w.DisplayName != "" {
				return w.DisplayName
			}
			return w.Name
		}
	}
	return ""
}
