//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// A worker's view is its own native conversation, decoded into the history
// contract's entries so the browser draws it with the conversation's own
// components. There is no block-read route for a worker, so tool arguments
// travel inline as a bounded preview; the live event stream already carries
// them the same way. Everything is read fresh from native files per request.
const (
	workerEntryLimit   = 200
	workerWireBudget   = 2 << 20
	workerArgumentText = 8 * 1024
	workerResultText   = 8 * 1024
	workerFileLimit    = 8 << 20
)

var claudeSessionFile = regexp.MustCompile(`^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$`)
var claudeRecordID = regexp.MustCompile(`^[0-9a-f-]{36}$`)
var taskfleetWindowID = regexp.MustCompile(`^@([0-9]{1,6})$`)
var taskfleetPaneID = regexp.MustCompile(`^%([0-9]{1,6})$`)

// readHomeFile reads a regular file of the daemon's own UID beneath home,
// without following any symlink. With lines, only complete lines are
// returned, and a file larger than max yields its last max bytes from a
// line start (tail); otherwise a larger file yields nothing.
func readHomeFile(parent int, name string, uid int, max int64, lines, tail bool) ([]byte, bool, bool) {
	fd, err := open(unix.Openat2, parent, name, unix.O_RDONLY|unix.O_NONBLOCK, false)
	if err != nil {
		return nil, false, false
	}
	f := os.NewFile(uintptr(fd), "worker")
	defer f.Close()
	st, err := f.Stat()
	if err != nil || !st.Mode().IsRegular() {
		return nil, false, false
	}
	if owner, ok := fileOwner(st); !ok || owner != uid {
		return nil, false, false
	}
	cut := false
	if st.Size() > max {
		if !tail {
			return nil, false, false
		}
		if _, err := f.Seek(st.Size()-max, io.SeekStart); err != nil {
			return nil, false, false
		}
		cut = true
	}
	b, err := io.ReadAll(io.LimitReader(f, max))
	if err != nil {
		return nil, false, false
	}
	if cut {
		at := bytes.IndexByte(b, '\n')
		if at < 0 {
			return nil, false, false
		}
		b = b[at+1:]
	}
	// A live append can end mid-record: only complete lines are displayable.
	if lines && len(b) > 0 && b[len(b)-1] != '\n' {
		at := bytes.LastIndexByte(b, '\n')
		b = b[:at+1]
	}
	if !utf8.Valid(b) {
		return nil, false, false
	}
	return b, cut, true
}

// boundWorkerEntries keeps the newest entries within the count and the
// encoded-size budget: the end of a worker's work is what its view is for.
// The budget counts each entry as it goes on the wire, escaping included, so
// the whole reply stays well within the browser's read cap.
func boundWorkerEntries(entries []historyEntry) ([]historyEntry, bool) {
	budget := workerWireBudget
	start := len(entries)
	for start > 0 && len(entries)-start < workerEntryLimit {
		b, err := json.Marshal(entries[start-1])
		size := len(b)
		if err != nil || size > budget {
			break
		}
		budget -= size
		start--
	}
	return entries[start:], start > 0
}

// piWorkerEntries projects a decoded Pi worker session as history entries,
// with each tool call's arguments inline instead of behind a block read.
func piWorkerEntries(b []byte, s nativeSession) []historyEntry {
	arguments := map[string][]json.RawMessage{}
	scanner := bufio.NewScanner(bytes.NewReader(b))
	scanner.Buffer(make([]byte, 4096), workerFileLimit+1)
	for scanner.Scan() {
		var e struct {
			ID      string `json:"id"`
			Type    string `json:"type"`
			Message struct {
				Role    string            `json:"role"`
				Content []json.RawMessage `json:"content"`
			} `json:"message"`
		}
		if json.Unmarshal(scanner.Bytes(), &e) != nil || e.Type != "message" || e.Message.Role != "assistant" {
			continue
		}
		args := make([]json.RawMessage, len(e.Message.Content))
		for i, raw := range e.Message.Content {
			var block struct {
				Type      string          `json:"type"`
				Arguments json.RawMessage `json:"arguments"`
			}
			if json.Unmarshal(raw, &block) == nil && block.Type == "toolCall" {
				args[i] = block.Arguments
			}
		}
		arguments[e.ID] = args
	}
	out := make([]historyEntry, 0, len(s.entries))
	for _, e := range s.entries {
		// A recorded skill's current description would be read from a path
		// the transcript names; a worker's view shows the recorded call only.
		e.skillLocation = ""
		inline(&s, &e)
		blocks := make([]historyBlock, len(e.Blocks))
		copy(blocks, e.Blocks)
		for i := range blocks {
			// Nothing in a worker's view reads a block on demand.
			blocks[i].Readable = false
			if blocks[i].Type != "toolCall" {
				continue
			}
			var raw json.RawMessage
			if args := arguments[e.Key]; i < len(args) {
				raw = args[i]
			}
			if len(raw) == 0 || !json.Valid(raw) {
				continue
			}
			text := string(raw)
			if blocks[i].ToolName == "process" {
				text = processToolArguments(raw)
			}
			blocks[i].Text = prefixBytes(text, workerArgumentText)
			if len(blocks[i].Text) < len(text) {
				e.TruncatedBlocks = true
			}
		}
		e.Blocks = blocks
		out = append(out, e)
	}
	return out
}

// claudeProjectDir is Claude Code's directory name for a working directory:
// every character but an ASCII letter or digit becomes '-'. Longer names get
// a hash suffix this reader does not reproduce, so they are not found.
func claudeProjectDir(cwd string) (string, bool) {
	if !filepath.IsAbs(cwd) || filepath.Clean(cwd) != cwd {
		return "", false
	}
	name := []byte(cwd)
	for i, c := range name {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9') {
			name[i] = '-'
		}
	}
	return string(name), len(name) <= 200
}

// readClaudeWorker finds a Claude Code worker's native session. Taskfleet
// records none for Claude, but the worktree is the run's own, and Claude Code
// files its sessions under a directory named after it. A restarted worker can
// leave several sessions there; the most recently written one is its current
// conversation. Each record must name the file's session and the worktree.
func readClaudeWorker(cfg transport.Config, n spinoffNode, home int) spinoffView {
	v := spinoffView{NodeID: prefixBytes(n.NodeID, 128), Harness: "claude", Availability: "unavailable", Entries: []historyEntry{}}
	name, ok := claudeProjectDir(n.Worktree)
	if !ok {
		return v
	}
	fd, err := dir(unix.Openat2, home, filepath.Join(".claude", "projects", name), false)
	if err != nil {
		return v
	}
	d := os.NewFile(uintptr(fd), "claude-project")
	defer d.Close()
	if st, err := d.Stat(); err != nil {
		return v
	} else if owner, ok := fileOwner(st); !ok || owner != cfg.UID {
		return v
	}
	names, err := d.ReadDir(256)
	if err != nil && len(names) == 0 {
		return v
	}
	type candidate struct {
		id   string
		name string
		at   int64
	}
	found := []candidate{}
	for _, e := range names {
		m := claudeSessionFile.FindStringSubmatch(e.Name())
		if m == nil || !e.Type().IsRegular() {
			continue
		}
		// The directory was opened by descriptor: stat beside it, not by path.
		var st unix.Stat_t
		if unix.Fstatat(int(d.Fd()), e.Name(), &st, unix.AT_SYMLINK_NOFOLLOW) != nil {
			continue
		}
		found = append(found, candidate{m[1], e.Name(), st.Mtim.Nano()})
	}
	sort.Slice(found, func(i, j int) bool { return found[i].at > found[j].at })
	for i, c := range found {
		if i == 4 {
			break
		}
		b, cut, ok := readHomeFile(int(d.Fd()), c.name, cfg.UID, workerFileLimit, true, true)
		if !ok {
			continue
		}
		entries, ok := decodeClaudeWorker(b, c.id, n.Worktree)
		if !ok {
			continue
		}
		v.Entries, v.Truncated = boundWorkerEntries(entries)
		v.Truncated = v.Truncated || cut
		v.Availability = "available"
		return v
	}
	return v
}

type claudeBlock struct {
	Type      string          `json:"type"`
	Text      string          `json:"text"`
	Thinking  string          `json:"thinking"`
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Input     json.RawMessage `json:"input"`
	ToolUseID string          `json:"tool_use_id"`
	Content   json.RawMessage `json:"content"`
	IsError   bool            `json:"is_error"`
	Source    struct {
		MediaType string `json:"media_type"`
	} `json:"source"`
}

// Claude Code's file tools under the names and argument keys the
// conversation's tool cards know from Pi.
var claudeToolNames = map[string]string{"Bash": "bash", "Read": "read", "Write": "write", "Edit": "edit"}
var claudeArgumentKeys = map[string]string{"file_path": "path", "old_string": "oldText", "new_string": "newText"}

func claudeArguments(name string, input json.RawMessage) string {
	if _, known := claudeToolNames[name]; known {
		var args map[string]json.RawMessage
		if json.Unmarshal(input, &args) == nil {
			renamed := make(map[string]json.RawMessage, len(args))
			for k, v := range args {
				if to, ok := claudeArgumentKeys[k]; ok {
					k = to
				}
				renamed[k] = v
			}
			if b, err := json.Marshal(renamed); err == nil {
				return string(b)
			}
		}
	}
	return string(input)
}

func claudeResultText(raw json.RawMessage) string {
	var plain string
	if json.Unmarshal(raw, &plain) == nil {
		return plain
	}
	var blocks []claudeBlock
	if json.Unmarshal(raw, &blocks) != nil {
		return ""
	}
	parts := []string{}
	for _, b := range blocks {
		if b.Type == "text" {
			parts = append(parts, b.Text)
		} else if b.Type == "image" {
			parts = append(parts, "[Kuva]")
		}
	}
	return strings.Join(parts, "\n")
}

func textEntry(key, kind, timestamp, text string, limit int) historyEntry {
	shown := prefixBytes(text, limit)
	e := historyEntry{Key: key, Kind: kind, Timestamp: timestamp, Content: historyContent{MediaType: "text/plain", Text: shown, Complete: len(shown) == len(text), Truncated: len(shown) < len(text)}}
	e.Blocks = []historyBlock{{Type: "text", Text: shown}}
	e.TruncatedBlocks = len(shown) < len(text)
	return e
}

// decodeClaudeWorker maps Claude Code's JSONL records to history entries:
// a person's or parent's text as user, each assistant content block as an
// assistant entry, and each tool result as a tool entry under its call.
// Sidechains (Claude's own sub-agents), meta records and every other record
// type are not the worker's conversation. A record that names another
// session, or a first working directory outside the worktree, refuses the
// whole file.
func decodeClaudeWorker(b []byte, session, worktree string) ([]historyEntry, bool) {
	entries := []historyEntry{}
	scanner := bufio.NewScanner(bytes.NewReader(b))
	scanner.Buffer(make([]byte, 4096), workerFileLimit+1)
	placed := false
	reply := ""
	for scanner.Scan() {
		var r struct {
			Type      string `json:"type"`
			UUID      string `json:"uuid"`
			SessionID string `json:"sessionId"`
			Cwd       string `json:"cwd"`
			Timestamp string `json:"timestamp"`
			Sidechain bool   `json:"isSidechain"`
			Meta      bool   `json:"isMeta"`
			Message   struct {
				ID      string          `json:"id"`
				Model   string          `json:"model"`
				Content json.RawMessage `json:"content"`
			} `json:"message"`
		}
		if json.Unmarshal(scanner.Bytes(), &r) != nil {
			return nil, false
		}
		if r.SessionID != "" && r.SessionID != session {
			return nil, false
		}
		if r.Cwd != "" && !placed {
			if r.Cwd != worktree && !strings.HasPrefix(r.Cwd, worktree+"/") {
				return nil, false
			}
			placed = true
		}
		if r.Type != "user" && r.Type != "assistant" || r.Sidechain || r.Meta || !claudeRecordID.MatchString(r.UUID) {
			continue
		}
		at := nativeTimestamp(r.Timestamp)
		if r.Type == "user" {
			reply = ""
		}
		var plain string
		if json.Unmarshal(r.Message.Content, &plain) == nil {
			if r.Type == "user" {
				entries = append(entries, textEntry(r.UUID, "user", at, plain, 16384))
			} else {
				entries = append(entries, textEntry(r.UUID, "assistant", at, plain, 16384))
			}
			continue
		}
		var blocks []claudeBlock
		if json.Unmarshal(r.Message.Content, &blocks) != nil {
			continue
		}
		if r.Type == "user" {
			texts := []string{}
			for i, block := range blocks {
				switch block.Type {
				case "text":
					texts = append(texts, block.Text)
				case "tool_result":
					if len(block.ToolUseID) > 200 {
						continue
					}
					e := textEntry(r.UUID+":"+strconv.Itoa(i), "tool", at, claudeResultText(block.Content), workerResultText)
					e.ToolCallID = block.ToolUseID
					failed := block.IsError
					e.IsError = &failed
					entries = append(entries, e)
				}
			}
			if len(texts) > 0 {
				entries = append(entries, textEntry(r.UUID, "user", at, strings.Join(texts, "\n"), 16384))
			}
			continue
		}
		// Claude Code writes each content block of one reply as its own
		// record; the reply is one entry, as Pi stores it.
		e := historyEntry{Key: r.UUID, Kind: "assistant", Timestamp: at, Content: historyContent{MediaType: "text/plain", Complete: true}}
		if len(r.Message.Model) <= 200 {
			e.Model = r.Message.Model
		}
		merged := r.Message.ID != "" && r.Message.ID == reply && len(entries) > 0 && entries[len(entries)-1].Kind == "assistant"
		if merged {
			e = entries[len(entries)-1]
			entries = entries[:len(entries)-1]
		}
		reply = r.Message.ID
		for _, block := range blocks {
			if len(e.Blocks) == 128 {
				e.TruncatedBlocks = true
				break
			}
			out := historyBlock{Type: "unknown"}
			switch block.Type {
			case "text":
				out = historyBlock{Type: "text", Text: prefixBytes(block.Text, 16384)}
				e.TruncatedBlocks = e.TruncatedBlocks || len(out.Text) < len(block.Text)
			case "thinking", "redacted_thinking":
				// Claude may keep only a signature: the thinking itself is withheld.
				out = historyBlock{Type: "thinking", Text: prefixBytes(block.Thinking, 16384), Redacted: block.Thinking == ""}
			case "tool_use":
				if len(block.ID) > 200 || len(block.Name) > 200 {
					break
				}
				name := block.Name
				if to, ok := claudeToolNames[name]; ok {
					name = to
				}
				args := claudeArguments(block.Name, block.Input)
				out = historyBlock{Type: "toolCall", ToolCallID: block.ID, ToolName: name, Text: prefixBytes(args, workerArgumentText)}
				e.TruncatedBlocks = e.TruncatedBlocks || len(out.Text) < len(args)
			case "image":
				out = historyBlock{Type: "image", MimeType: prefixBytes(block.Source.MediaType, 100)}
			}
			e.Blocks = append(e.Blocks, out)
		}
		if len(e.Blocks) > 0 {
			entries = append(entries, e)
		}
	}
	if scanner.Err() != nil || !placed {
		return nil, false
	}
	return entries, true
}

// readRunBrief is the task Taskfleet gave the worker, kept in the run's own
// directory. It is the conversation's first message before the worker's
// history can be read, and the part a tail read of a long history omits.
func readRunBrief(cfg transport.Config, runID string) string {
	if !taskfleetIDPattern.MatchString(runID) {
		return ""
	}
	home, err := os.Open(cfg.Home)
	if err != nil {
		return ""
	}
	defer home.Close()
	b, _, ok := readHomeFile(int(home.Fd()), filepath.Join(".taskfleet", "runs", runID, "prompt.md"), cfg.UID, 64*1024, false, false)
	if !ok {
		return ""
	}
	return prefixBytes(string(b), 16000)
}

// workerTerminal names the Taskfleet window and pane a live run recorded for
// its worker, in the browser shell's token form. It is only a pointer: the
// terminal route admits it only if its own listing finds that window.
func workerTerminal(r nativeSpinoff) string {
	if r.Status != "pending" && r.Status != "running" || r.Attach.State != "recorded" {
		return ""
	}
	socket := r.Attach.Identity.Socket
	m := taskfleetSocketName.FindStringSubmatch(filepath.Base(socket))
	w := taskfleetWindowID.FindStringSubmatch(r.Attach.Identity.WindowID)
	if m == nil || w == nil || !filepath.IsAbs(socket) || filepath.Base(filepath.Dir(socket)) != "taskfleet" {
		return ""
	}
	token := m[1] + "-" + w[1]
	// The agent's own pane: the window's active pane may be another.
	if p := taskfleetPaneID.FindStringSubmatch(r.Attach.Identity.PaneID); p != nil {
		token += "-" + p[1]
	}
	return token
}

// workerTerminalWorkspace is the workspace whose terminal route lists the
// worker's window: the one whose checkout or worktree container holds the
// run's worktree. A worker may work in another repository than its parent.
func workerTerminalWorkspace(cfg transport.Config, worktree string) string {
	return workerTerminalWorkspaceIn(cfg, Discover(cfg), worktree)
}

func workerTerminalWorkspaceIn(cfg transport.Config, discovery Discovery, worktree string) string {
	if !filepath.IsAbs(worktree) {
		return ""
	}
	worktree = filepath.Clean(worktree)
	for _, entry := range discovery.Entries {
		if entry.Error != "" || entry.Kind == "unknown" || entry.Metadata == "error" {
			continue
		}
		dir := filepath.Join(cfg.Home, "src", entry.Name)
		if worktree == dir || strings.HasPrefix(worktree, dir+"/") || strings.HasPrefix(worktree, dir+"__worktrees/") {
			return workspaceIDOf(cfg, entry)
		}
	}
	return ""
}

// workerGitWorkspace is the opaque ID under which the workspace Git route
// reads the worker's worktree: a Git workspace of its own, or a worktree
// place of a discovered checkout (ADR 0025) as Git's own registry names it.
// The route resolves the ID again on every read and never takes a path, so
// a worktree that is neither has no ID and the view shows its counts only.
func workerGitWorkspace(cfg transport.Config, discovery Discovery, worktree string) string {
	if !filepath.IsAbs(worktree) || !worktreeOnDisk(worktree) {
		return ""
	}
	worktree = filepath.Clean(worktree)
	usable := func(e Workspace) bool {
		return e.Error == "" && e.Metadata != "error" && (e.Kind == "git_main_worktree" || e.Kind == "git_linked_worktree")
	}
	var likely, rest []Workspace
	for _, entry := range discovery.Entries {
		if !usable(entry) {
			continue
		}
		dir := filepath.Join(cfg.Home, "src", entry.Name)
		if worktree == dir {
			return workspaceIDOf(cfg, entry)
		}
		// Taskfleet's worktrees sit in the checkout's sibling container;
		// look there first, then in every other registry.
		if strings.HasPrefix(worktree, dir+"__worktrees/") || strings.HasPrefix(worktree, dir+"/") {
			likely = append(likely, entry)
		} else {
			rest = append(rest, entry)
		}
	}
	for _, entry := range append(likely, rest...) {
		if entry.Kind != "git_main_worktree" {
			continue
		}
		places, _ := readWorktreePlaces(cfg.Home, entry, workspaceIDOf(cfg, entry))
		for _, p := range places {
			if filepath.Clean(p.Path) == worktree {
				return p.ID
			}
		}
	}
	return ""
}

func workerHarness(h string) string {
	if h == "pi" || h == "claude" {
		return h
	}
	return "unknown"
}
