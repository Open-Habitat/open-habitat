//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Taskfleet calls a run working for as long as its supervisor lives, and an
// interactive run lives until someone merges or cancels it. Whether the
// worker's agent is at work is Pi's own word, in the session Taskfleet keeps
// for it: the newest message there says whether a turn is under way.
const (
	// workerIdle: the worker's last turn ended and Pi waits at its prompt
	// for someone to type (Jari 29.10.2026: an --interactive spinoff that
	// committed and stopped still pulsed as working).
	workerIdle = "idle"
	// workerActivityTail is how much of the session's end is read: enough
	// for the last entries, never the whole history.
	workerActivityTail = 256 << 10
)

// workerActivity reads where a live Pi worker's own session stands:
// workerIdle, or "" when it is at work or cannot be read.
// Only the run's newest node counts, and only its live session in
// Taskfleet's state root, read as the daemon UID.
func workerActivity(home *os.File, uid int, r nativeSpinoff, now time.Time) string {
	if home == nil || len(r.Nodes) == 0 {
		return ""
	}
	n := r.Nodes[len(r.Nodes)-1]
	p := n.Live
	if n.Harness != "pi" || n.Support != "supported" || p.Anchor != "state-root" || p.Availability != "available" || p.Path == nil || !safeRelative(*p.Path) {
		return ""
	}
	b, _, ok := readHomeFile(int(home.Fd()), filepath.Join(".taskfleet", *p.Path), uid, workerActivityTail, true, true)
	if !ok {
		return ""
	}
	lines := bytes.Split(bytes.TrimRight(b, "\n"), []byte("\n"))
	for i := len(lines) - 1; i >= 0; i-- {
		var e struct {
			Type    string `json:"type"`
			Message struct {
				Role       string `json:"role"`
				StopReason string `json:"stopReason"`
			} `json:"message"`
		}
		if json.Unmarshal(lines[i], &e) != nil {
			continue
		}
		switch e.Type {
		case "message":
			// A finished reply is the end of a turn; a prompt, a tool call
			// or its result is a turn under way.
			if e.Message.Role == "assistant" && e.Message.StopReason != "" && e.Message.StopReason != "toolUse" {
				return workerIdle
			}
			return ""
		case "custom_message", "context_edit":
			// An extension's message after the reply starts the next turn;
			// Pi edits its own context before retrying a failed reply.
			return ""
		}
	}
	return ""
}

func safeRelative(p string) bool {
	c := filepath.Clean(p)
	return p != "" && !filepath.IsAbs(p) && c != ".." && !strings.HasPrefix(c, "../")
}

// liveWorkerState is spinoffState with the worker's own word: a run Taskfleet
// calls working whose Pi waits at its prompt is idle.
func liveWorkerState(home *os.File, uid int, r nativeSpinoff, now time.Time) (state string, awaitingInput bool) {
	state = spinoffState(r)
	if state == "working" && workerActivity(home, uid, r, now) == workerIdle {
		state = "idle"
	}
	return state, r.AwaitingInput
}
