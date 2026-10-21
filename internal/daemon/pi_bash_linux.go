//go:build linux

package daemon

import (
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

// Pi's RPC `bash` is the TUI's `!` and `!!`: Pi runs the command in its
// session's working directory, streams `bash_execution_update` events and
// records a `bashExecution` message in its own history. The daemon only relays
// it, so the native session stays the one record of the command.

const (
	maxBashCommand = 8192
	maxPiCommands  = 512
)

// piCommand is one entry of Pi's `get_commands`, reduced to what the browser
// may see: no source paths.
type piCommand struct {
	Name        string
	Description string
	Source      string // extension, prompt, skill
	Scope       string // user, project, temporary, builtin
}

var piCommandName = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$`)

// parsePiCommands validates a `get_commands` result. An entry that does not
// fit the browser's command grammar is left out rather than repaired.
func parsePiCommands(data json.RawMessage) ([]piCommand, bool) {
	var reply struct {
		Commands []struct {
			Name        string `json:"name"`
			Description string `json:"description"`
			Source      string `json:"source"`
			SourceInfo  struct {
				Source string `json:"source"`
				Scope  string `json:"scope"`
			} `json:"sourceInfo"`
		} `json:"commands"`
	}
	if json.Unmarshal(data, &reply) != nil || reply.Commands == nil || len(reply.Commands) > 1024 {
		return nil, false
	}
	out := make([]piCommand, 0, len(reply.Commands))
	for _, c := range reply.Commands {
		if !piCommandName.MatchString(c.Name) || (c.Source != "extension" && c.Source != "prompt" && c.Source != "skill") {
			continue
		}
		scope := c.SourceInfo.Scope
		if c.SourceInfo.Source == "builtin" {
			scope = "builtin"
		}
		if scope != "user" && scope != "project" && scope != "temporary" && scope != "builtin" {
			scope = "temporary"
		}
		description := strings.ToValidUTF8(strings.Join(strings.Fields(c.Description), " "), "")
		if len(description) > 1024 {
			description = prefixBytes(description, 1024)
		}
		out = append(out, piCommand{Name: c.Name, Description: description, Source: c.Source, Scope: scope})
	}
	return out, true
}

// validBashCommand admits one line of shell text as Pi's TUI would take it
// after the `!`. Pi itself runs it; the daemon never parses it.
func validBashCommand(command string) bool {
	return strings.TrimSpace(command) != "" && len(command) <= maxBashCommand && utf8.ValidString(command) && !strings.ContainsRune(command, 0)
}

// isBashReply identifies a registered invocation by native RPC ID, never
// by command text: identical commands still have distinct completions.
func (p *piRPC) isBashReply(frame json.RawMessage) bool {
	p.bashMu.Lock()
	defer p.bashMu.Unlock()
	var head struct {
		ID      string `json:"id"`
		Command string `json:"command"`
	}
	return json.Unmarshal(frame, &head) == nil && head.Command == "bash" && p.bashReplies[head.ID] != nil
}

// takeBashReply removes and returns the waiter of a registered `bash` ID, or
// nil when the frame answers anything else.
func (p *piRPC) takeBashReply(frame json.RawMessage) chan json.RawMessage {
	p.bashMu.Lock()
	defer p.bashMu.Unlock()
	if len(p.bashReplies) == 0 {
		return nil
	}
	var head struct {
		ID      string `json:"id"`
		Command string `json:"command"`
	}
	if json.Unmarshal(frame, &head) != nil || head.Command != "bash" {
		return nil
	}
	reply := p.bashReplies[head.ID]
	delete(p.bashReplies, head.ID)
	return reply
}

// startBash writes one `bash` request and returns at once: Pi answers it only
// when the command ends. The reply channel receives that one response frame;
// it stays empty if Pi's output ends first (p.done). A failed or partial write
// is uncertain: Pi may have started the command. Never retry it.
func (p *piRPC) startBash(command string, excludeFromContext bool) (<-chan json.RawMessage, error) {
	if !validBashCommand(command) {
		return nil, errors.New("invalid command")
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.poisoned || p.closing.Load() || p.overflow.Load() {
		return nil, errors.New("Pi command uncertain: channel closed")
	}
	id, ok := uuid()
	if !ok {
		return nil, errors.New("request ID unavailable")
	}
	reply := make(chan json.RawMessage, 1)
	p.bashMu.Lock()
	if p.bashReplies == nil {
		p.bashReplies = make(map[string]chan json.RawMessage)
	}
	p.bashReplies[id] = reply
	p.bashMu.Unlock()
	b, _ := json.Marshal(map[string]any{"id": id, "type": "bash", "command": command, "excludeFromContext": excludeFromContext})
	b = append(b, '\n')
	if err := p.in.SetWriteDeadline(time.Now().Add(4 * time.Second)); err != nil {
		p.poisoned = true
		return nil, errors.New("Pi command uncertain: write deadline unavailable")
	}
	n, err := p.in.Write(b)
	if err != nil || n != len(b) || p.closing.Load() {
		p.poisoned = true
		_ = p.in.Close()
		return nil, errors.New("Pi command uncertain: incomplete write")
	}
	return reply, nil
}

// bashOutcome is what Pi's `bash` reply says about the ended command. The
// output itself stays in Pi's history; only the outcome crosses.
type bashOutcome struct {
	State     string // finished, cancelled, failed
	ExitCode  *int
	Truncated bool
}

func parseBashReply(frame json.RawMessage) (bashOutcome, bool) {
	var response struct {
		Type    string `json:"type"`
		Command string `json:"command"`
		Success *bool  `json:"success"`
		Data    *struct {
			ExitCode  *int `json:"exitCode"`
			Cancelled bool `json:"cancelled"`
			Truncated bool `json:"truncated"`
		} `json:"data"`
	}
	if json.Unmarshal(frame, &response) != nil || response.Type != "response" || response.Command != "bash" || response.Success == nil {
		return bashOutcome{}, false
	}
	if !*response.Success || response.Data == nil {
		return bashOutcome{State: "failed"}, true
	}
	out := bashOutcome{State: "finished", Truncated: response.Data.Truncated}
	if response.Data.Cancelled {
		out.State = "cancelled"
	} else if code := response.Data.ExitCode; code != nil && *code >= -1 && *code <= 255 {
		out.ExitCode = code
	}
	return out, true
}
