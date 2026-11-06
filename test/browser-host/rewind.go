package main

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

// Palaa tähän in the synthetic host (scenario pi-rewind). The fake stands in
// for the daemon's rewind extension: a turn records a checkpoint as the
// extension does, a turn whose message says "tiedosto" creates a file the
// agent "wrote", and /oh-rewind moves the leaf and writes the extension's
// marker in the same session file, so the real daemon reads, projects and
// previews them. The extension itself is proven against the pinned Pi in
// internal/daemon/rewind_native_linux_test.go.

func rewindScenario(home string) bool {
	mode, _ := os.ReadFile(filepath.Join(filepath.Dir(home), "fakepi-scenario"))
	return strings.TrimSpace(string(mode)) == "pi-rewind"
}

const rewindDemoFile = "palautettava.txt"

// rewindCheckpoint is what the extension records as the agent starts
// answering the person's message just appended.
func (s *fakeSession) rewindCheckpoint(prompt string) {
	user := s.lastMessage
	s.append(map[string]any{"type": "custom", "customType": "oh-rewind-checkpoint", "data": map[string]any{"version": 1, "kind": "snapshot", "userEntryId": user, "cwd": s.cwd, "timestamp": "2026-11-06T09:20:00Z", "files": map[string]any{}}})
	if !strings.Contains(prompt, "tiedosto") {
		return
	}
	s.append(map[string]any{"type": "custom", "customType": "oh-rewind-checkpoint", "data": map[string]any{"version": 1, "kind": "update", "userEntryId": user, "files": map[string]any{rewindDemoFile: map[string]any{"backupFileName": nil, "storeId": s.id}}}})
	_ = os.WriteFile(filepath.Join(s.cwd, rewindDemoFile), []byte("agentin kirjoittama\n"), 0600)
}

type rewindNode struct {
	parent, kind, role, customType string
	data                           map[string]any
	text                           bool
}

func (s *fakeSession) rewindTree() map[string]rewindNode {
	nodes := map[string]rewindNode{}
	f, err := os.Open(s.path)
	if err != nil {
		return nodes
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 64<<10), 64<<20)
	for scanner.Scan() {
		var e struct {
			ID         string         `json:"id"`
			ParentID   *string        `json:"parentId"`
			Type       string         `json:"type"`
			CustomType string         `json:"customType"`
			Data       map[string]any `json:"data"`
			Message    struct {
				Role    string          `json:"role"`
				Content json.RawMessage `json:"content"`
			} `json:"message"`
		}
		if json.Unmarshal(scanner.Bytes(), &e) != nil || e.ID == "" {
			continue
		}
		n := rewindNode{kind: e.Type, role: e.Message.Role, customType: e.CustomType, data: e.Data}
		if e.ParentID != nil {
			n.parent = *e.ParentID
		}
		n.text = e.Type == "message" && (e.Message.Role == "user" || (e.Message.Role == "assistant" && strings.Contains(string(e.Message.Content), `"type":"text"`)))
		nodes[e.ID] = n
	}
	return nodes
}

func rewindBranch(nodes map[string]rewindNode, leaf string) []string {
	var path []string
	for id := leaf; id != ""; id = nodes[id].parent {
		path = append([]string{id}, path...)
		if len(path) > len(nodes) {
			break
		}
	}
	return path
}

func rewindCounts(nodes map[string]rewindNode, ids []string) (own, replies int) {
	waiting := false
	for _, id := range ids {
		if n := nodes[id]; n.text && n.role == "user" {
			own++
			waiting = true
		} else if n.text && waiting {
			replies++
			waiting = false
		}
	}
	return
}

// rewind answers one /oh-rewind as the extension would; the outcome goes
// to the daemon as the extension's notify.
func (s *fakeSession) rewind(raw string) string {
	var args struct {
		Action       string `json:"action"`
		Entry        string `json:"entry"`
		Marker       string `json:"marker"`
		Conversation bool   `json:"conversation"`
		Files        bool   `json:"files"`
	}
	if json.Unmarshal([]byte(raw), &args) != nil {
		return `{"outcome":"invalid"}`
	}
	nodes := s.rewindTree()
	s.appendMu.Lock()
	leaf := s.parent
	s.appendMu.Unlock()
	branch := rewindBranch(nodes, leaf)
	at := -1
	for i, id := range branch {
		if id == args.Entry || id == args.Marker {
			at = i
		}
	}
	if at < 0 {
		return `{"outcome":"not_found"}`
	}
	restored := 0
	if args.Files {
		if err := os.Remove(filepath.Join(s.cwd, rewindDemoFile)); err == nil {
			restored = 1
		}
	}
	files := map[string]any{"restored": restored, "errors": 0, "paths": []string{}}
	switch args.Action {
	case "rewind":
		own, replies := rewindCounts(nodes, branch[at:])
		data := map[string]any{"version": 1, "action": "files", "at": args.Entry, "own": own, "replies": replies, "cwd": s.cwd, "files": nil}
		if args.Files {
			data["files"], data["before"] = files, map[string]any{}
		}
		if args.Conversation {
			data["action"], data["left"] = "rewind", leaf
			s.appendMu.Lock()
			s.parent = nodes[args.Entry].parent
			s.appendMu.Unlock()
		}
		s.append(map[string]any{"type": "custom", "customType": "oh-rewind", "data": data})
		if !args.Conversation && restored > 0 {
			s.append(map[string]any{"type": "custom_message", "customType": "oh-rewind-note", "content": "The person restored one file you changed.", "display": false})
		}
	case "switch":
		marker := nodes[args.Marker]
		left, _ := marker.data["left"].(string)
		if marker.customType != "oh-rewind" || left == "" {
			return `{"outcome":"not_switchable"}`
		}
		other := map[string]bool{}
		for _, id := range rewindBranch(nodes, left) {
			other[id] = true
		}
		var mine []string
		for _, id := range branch {
			if !other[id] {
				mine = append(mine, id)
			}
		}
		own, replies := rewindCounts(nodes, mine)
		s.appendMu.Lock()
		s.parent = left
		s.appendMu.Unlock()
		s.append(map[string]any{"type": "custom", "customType": "oh-rewind", "data": map[string]any{"version": 1, "action": "switch", "at": mine[0], "left": leaf, "own": own, "replies": replies, "cwd": s.cwd, "files": nil}})
	case "undo":
		s.append(map[string]any{"type": "custom", "customType": "oh-rewind", "data": map[string]any{"version": 1, "action": "undo", "of": args.Marker, "own": 0, "replies": 0, "cwd": s.cwd, "files": files}})
	default:
		return `{"outcome":"invalid"}`
	}
	b, _ := json.Marshal(map[string]any{"outcome": "done", "restored": restored, "errors": 0})
	return string(b)
}
