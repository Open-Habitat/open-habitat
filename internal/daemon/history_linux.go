//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/maintainer/native-agent-host/internal/transport"
)

const historyRoot = ".pi/agent/sessions"
const maxHistoryFile = 32 << 20

var sessionIDPattern = regexp.MustCompile(`^[0-9a-fA-F-]{36}$`)
var entryIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,128}$`)

type nativeEntry struct {
	ID       string          `json:"id"`
	Type     string          `json:"type"`
	Message  json.RawMessage `json:"message"`
	Provider string          `json:"provider"`
	ModelID  string          `json:"modelId"`
	ParentID *string         `json:"parentId"`
	Raw      json.RawMessage `json:"-"`
}
type nativeHeader struct {
	Type    string `json:"type"`
	ID      string `json:"id"`
	Cwd     string `json:"cwd"`
	Version int    `json:"version"`
}
type nativeSession struct {
	id, cwd, path, revision, state string
	entries                        []historyEntry
}
type historyEntry struct {
	Key     string         `json:"entry_key"`
	Kind    string         `json:"kind"`
	Content historyContent `json:"content"`
	full    string
}
type historyContent struct {
	MediaType  string `json:"media_type"`
	Text       string `json:"text"`
	Complete   bool   `json:"complete"`
	ContentID  string `json:"content_id,omitempty"`
	NextOffset int    `json:"next_offset,omitempty"`
}

// Native files remain authoritative. The scanner holds no index or copy between requests.
// Each file is bounded and opened without following symlinks; invalid sessions never
// grant an agent identity from a filename alone.
func nativeSessions(cfg transport.Config) ([]nativeSession, error) {
	root := filepath.Join(cfg.Home, historyRoot)
	// An intermediate symlink would cross the mapped user's native source root.
	for _, parent := range []string{filepath.Join(cfg.Home, ".pi"), filepath.Join(cfg.Home, ".pi/agent")} {
		info, err := os.Lstat(parent)
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
			return nil, fmt.Errorf("history parent unavailable")
		}
	}
	info, err := os.Lstat(root)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return nil, fmt.Errorf("history root unavailable")
	}
	sessions := []nativeSession{}
	seenIDs := map[string]int{}
	dirs, files := 0, 0
	err = filepath.WalkDir(root, func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if path == root {
			return nil
		}
		if d.Type()&os.ModeSymlink != 0 {
			return nil
		}
		if d.IsDir() {
			dirs++
			if dirs > 512 {
				return fmt.Errorf("history directory bound")
			}
			return nil
		}
		if filepath.Ext(path) != ".jsonl" || !d.Type().IsRegular() {
			return nil
		}
		files++
		if files > 4096 {
			return fmt.Errorf("history file bound")
		}
		s := readNativeHeader(path, cfg.UID)
		if s.id != "" {
			if index, found := seenIDs[s.id]; found {
				// Neither file can be routed by a shared native identity. Leave
				// unrelated conversations readable, and refuse this ID.
				sessions[index].cwd = ""
				sessions[index].state = "unavailable"
			} else {
				seenIDs[s.id] = len(sessions)
				sessions = append(sessions, s)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return sessions, nil
}

// Read only the bounded header during discovery. Full parsing belongs solely
// to the selected history/content read; a user's history tree is not a cache.
func readNativeHeader(path string, uid int) nativeSession {
	info, err := os.Lstat(path)
	if err != nil || !info.Mode().IsRegular() {
		return nativeSession{}
	}
	if uid >= 0 {
		owner, ok := fileOwner(info)
		if !ok || owner != uid {
			return nativeSession{}
		}
	}
	f, err := os.Open(path)
	if err != nil {
		return nativeSession{}
	}
	defer f.Close()
	opened, err := f.Stat()
	if err != nil || !os.SameFile(info, opened) {
		return nativeSession{}
	}
	line, err := bufio.NewReader(io.LimitReader(f, 16385)).ReadBytes('\n')
	if err != nil || len(line) > 16384 {
		return nativeSession{}
	}
	var h nativeHeader
	if json.Unmarshal(line, &h) != nil || h.Type != "session" || h.Version != 3 || !sessionIDPattern.MatchString(h.ID) || !filepath.IsAbs(h.Cwd) {
		return nativeSession{}
	}
	state := "readable"
	if info.Size() > maxHistoryFile {
		state = "unavailable"
	}
	return nativeSession{id: h.ID, cwd: h.Cwd, path: path, state: state, revision: opaque("rev_", fmt.Sprintf("%d:%d:%d", info.Size(), info.ModTime().UnixNano(), info.Mode()))}
}

// A concurrent append can change size/mtime during one read. Retry once;
// repeated instability is unavailable, never proof of a missing history.
func readNativeSettled(path string, uid int) nativeSession {
	s := readNative(path, uid)
	if s.id == "" || s.state == "corrupt" {
		return readNative(path, uid)
	}
	return s
}
func readNative(path string, uid int) nativeSession {
	var result nativeSession
	before, err := os.Lstat(path)
	if err != nil || !before.Mode().IsRegular() || before.Size() > maxHistoryFile || before.Size() < 1 {
		return result
	}
	if uid >= 0 {
		if owner, ok := fileOwner(before); !ok || owner != uid {
			return result
		}
	}
	f, err := os.Open(path)
	if err != nil {
		return result
	}
	defer f.Close()
	opened, err := f.Stat()
	if err != nil || !os.SameFile(before, opened) {
		return result
	}
	b, err := io.ReadAll(io.LimitReader(f, maxHistoryFile+1))
	if err != nil || len(b) > maxHistoryFile || !utf8.Valid(b) {
		return result
	}
	after, err := os.Lstat(path)
	if err != nil || !os.SameFile(before, after) || opened.Size() != after.Size() || !opened.ModTime().Equal(after.ModTime()) || int64(len(b)) != after.Size() {
		return result
	}
	sum := sha256.Sum256(b)
	result.revision = base64.RawURLEncoding.EncodeToString(sum[:18])
	result.path = path
	result.state = "readable"
	result.entries = []historyEntry{}
	scanner := bufio.NewScanner(bytes.NewReader(b))
	scanner.Buffer(make([]byte, 4096), maxHistoryFile+1)
	if !scanner.Scan() {
		return nativeSession{}
	}
	var h nativeHeader
	if json.Unmarshal(scanner.Bytes(), &h) != nil || h.Type != "session" || h.Version != 3 || !sessionIDPattern.MatchString(h.ID) || !filepath.IsAbs(h.Cwd) {
		return nativeSession{}
	}
	result.id, result.cwd = h.ID, h.Cwd
	seen := map[string]bool{}
	parents := map[string]*string{}
	var leaf string
	for scanner.Scan() {
		var e nativeEntry
		if json.Unmarshal(scanner.Bytes(), &e) != nil || !entryIDPattern.MatchString(e.ID) || seen[e.ID] {
			result.state = "corrupt"
			break
		}
		e.Raw = append([]byte(nil), scanner.Bytes()...)
		seen[e.ID] = true
		parents[e.ID] = e.ParentID
		leaf = e.ID
		kind, text := nativeText(e)
		if kind == "" {
			continue
		}
		result.entries = append(result.entries, historyEntry{Key: e.ID, Kind: kind, full: text})
	}
	if scanner.Err() != nil || len(b) == 0 || b[len(b)-1] != '\n' {
		result.state = "corrupt"
	}
	// Pi's append-only JSONL is a tree. Only the current leaf ancestry is
	// the active conversation; old branches remain in Pi but not this view.
	if leaf != "" && parents[leaf] != nil {
		active := map[string]bool{}
		for node := leaf; node != ""; {
			if active[node] {
				result.state = "corrupt"
				break
			}
			active[node] = true
			parent, ok := parents[node]
			if !ok {
				result.state = "corrupt"
				break
			}
			if parent == nil {
				break
			}
			node = *parent
		}
		filtered := make([]historyEntry, 0, len(result.entries))
		for _, e := range result.entries {
			if active[e.Key] {
				filtered = append(filtered, e)
			}
		}
		result.entries = filtered
	}
	return result
}
func nativeText(e nativeEntry) (string, string) {
	switch e.Type {
	case "model_change":
		return "model_change", strings.TrimPrefix(e.Provider+"/"+e.ModelID, "/")
	case "message":
		var m struct {
			Role     string          `json:"role"`
			Content  json.RawMessage `json:"content"`
			ToolName string          `json:"toolName"`
		}
		if json.Unmarshal(e.Message, &m) != nil {
			return "unknown", "Tuntematon viesti: " + string(e.Message)
		}
		kind := m.Role
		if kind == "toolResult" {
			kind = "tool"
		}
		if kind != "user" && kind != "assistant" && kind != "tool" {
			kind = "unknown"
		}
		var plain string
		if json.Unmarshal(m.Content, &plain) == nil {
			return kind, plain
		}
		var blocks []struct {
			Type string `json:"type"`
			Text string `json:"text"`
			Name string `json:"name"`
		}
		if json.Unmarshal(m.Content, &blocks) != nil {
			return "unknown", "Sisältömuotoa ei tueta: " + string(m.Content)
		}
		parts := []string{}
		if kind == "tool" && m.ToolName != "" {
			parts = append(parts, m.ToolName)
		}
		for i, b := range blocks {
			if b.Type == "text" {
				parts = append(parts, b.Text)
			} else if b.Type == "toolCall" {
				parts = append(parts, "Työkalu: "+b.Name)
			} else {
				// Keep the complete unknown block, not just its type. Rendered as
				// text by the browser; no native content is interpreted as markup.
				var raw []json.RawMessage
				_ = json.Unmarshal(m.Content, &raw)
				parts = append(parts, "[Sisältöä ei tueta: "+b.Type+"] "+string(raw[i]))
			}
		}
		return kind, strings.Join(parts, "\n")
	default:
		return "unknown", "Tuntematon Pi-tapahtuma: " + e.Type + "\n" + string(e.Raw)
	}
}
func contentID(s *nativeSession, key string) string {
	return opaque("ct_", s.id)[:15] + "_" + opaque("ct_", s.id+":"+s.revision+":"+key)[3:]
}
func inline(s *nativeSession, e *historyEntry) {
	b := []byte(e.full)
	n := len(b)
	if n > 65536 {
		n = 65536
		for n > 0 && !utf8.Valid(b[:n]) {
			n--
		}
	}
	e.Content = historyContent{MediaType: "text/plain", Text: string(b[:n]), Complete: n == len(b)}
	if n < len(b) {
		e.Content.ContentID = contentID(s, e.Key)
		e.Content.NextOffset = n
	}
}
func historyAuthorized(cfg transport.Config, trusted func(*http.Request) bool, r *http.Request) bool {
	return trusted != nil && trusted(r) && r.ProtoMajor == 1 && r.ProtoMinor == 1 && r.Host == "unix"
}
func historyJSON(w http.ResponseWriter, body any) {
	b, err := json.Marshal(body)
	if err != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Length", strconv.Itoa(len(b)))
	w.WriteHeader(200)
	_, _ = w.Write(b)
}
func HistoryHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return historyHandlerWithReader(cfg, trusted, nativeSessions)
}

// HistoryHandlerWithNativeRoot confines a browser-host fixture to a disposable root.
func HistoryHandlerWithNativeRoot(cfg transport.Config, trusted func(*http.Request) bool, root string) http.Handler {
	return historyHandlerWithReader(cfg, trusted, func(c transport.Config) ([]nativeSession, error) { c.Home = root; return nativeSessions(c) })
}
func historyHandlerWithReader(cfg transport.Config, trusted func(*http.Request) bool, sessionsReader func(transport.Config) ([]nativeSession, error)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) || r.Method != "GET" || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		path := r.URL.EscapedPath()
		sessions, err := sessionsReader(cfg)
		if err != nil {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		if strings.HasPrefix(path, "/api/v1/agents/") && strings.HasSuffix(path, "/history") {
			id := strings.TrimSuffix(strings.TrimPrefix(path, "/api/v1/agents/"), "/history")
			if !strings.HasPrefix(id, "pi:") || !sessionIDPattern.MatchString(strings.TrimPrefix(id, "pi:")) || len(r.URL.Query()) != len(strings.FieldsFunc(r.URL.RawQuery, func(c rune) bool { return c == '&' })) {
				snapshotError(w, 400, "invalid_request")
				return
			}
			q := r.URL.Query()
			for k := range q {
				if k != "after" && k != "limit" {
					snapshotError(w, 400, "invalid_request")
					return
				}
			}
			limit := 200
			if q.Has("limit") {
				v, e := strconv.Atoi(q.Get("limit"))
				if e != nil || v < 1 || v > 200 || len(q["limit"]) != 1 {
					snapshotError(w, 400, "invalid_request")
					return
				}
				limit = v
			}
			var s *nativeSession
			for i := range sessions {
				if "pi:"+sessions[i].id == id {
					if s != nil {
						snapshotError(w, 503, "native_source_unavailable")
						return
					}
					s = &sessions[i]
				}
			}
			if s == nil {
				snapshotError(w, 404, "resource_not_found")
				return
			}
			if s.state != "readable" {
				snapshotError(w, 503, "native_source_unavailable")
				return
			}
			loaded := readNativeSettled(s.path, cfg.UID)
			if loaded.id != s.id || loaded.cwd != s.cwd || loaded.state != "readable" {
				snapshotError(w, 503, "native_source_unavailable")
				return
			}
			s = &loaded
			start := 0
			if q.Has("after") {
				if len(q["after"]) != 1 {
					snapshotError(w, 400, "invalid_request")
					return
				}
				found := false
				for i, e := range s.entries {
					if e.Key == q.Get("after") {
						start = i + 1
						found = true
						break
					}
				}
				if !found {
					snapshotError(w, 409, "stale_precondition")
					return
				}
			}
			end := start + limit
			if end > len(s.entries) {
				end = len(s.entries)
			}
			entries := make([]historyEntry, 0, end-start)
			inlineBytes := 0
			for _, e := range s.entries[start:end] {
				inline(s, &e)
				if len(entries) > 0 && inlineBytes+len(e.Content.Text) > 256*1024 {
					break
				}
				inlineBytes += len(e.Content.Text)
				e.full = ""
				entries = append(entries, e)
			}
			end = start + len(entries)
			body := map[string]any{"schema_version": 1, "agent_id": id, "native_revision": s.revision, "entries": entries, "complete": end == len(s.entries)}
			if end < len(s.entries) {
				body["next_after"] = s.entries[end-1].Key
			}
			historyJSON(w, body)
			return
		}
		if strings.HasPrefix(path, "/api/v1/content/") {
			id := strings.TrimPrefix(path, "/api/v1/content/")
			if !strings.HasPrefix(id, "ct_") || strings.Contains(id, "/") {
				snapshotError(w, 400, "invalid_request")
				return
			}
			q := r.URL.Query()
			if len(q) != 2 || len(q["offset"]) != 1 || len(q["limit_bytes"]) != 1 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			offset, e1 := strconv.Atoi(q.Get("offset"))
			limit, e2 := strconv.Atoi(q.Get("limit_bytes"))
			if e1 != nil || e2 != nil || offset < 0 || limit < 1 || limit > 65536 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			for i := range sessions {
				s := &sessions[i]
				if s.state != "readable" || !strings.HasPrefix(id, opaque("ct_", s.id)[:15]+"_") {
					continue
				}
				loaded := readNativeSettled(s.path, cfg.UID)
				if loaded.id != s.id || loaded.cwd != s.cwd || loaded.state != "readable" {
					snapshotError(w, 404, "content_revision_gone")
					return
				}
				s = &loaded
				for _, e := range s.entries {
					if contentID(s, e.Key) != id {
						continue
					}
					b := []byte(e.full)
					if offset > len(b) || !utf8.Valid(b[:offset]) {
						snapshotError(w, 400, "invalid_request")
						return
					}
					end := offset + limit
					if end > len(b) {
						end = len(b)
					}
					for end > offset && !utf8.Valid(b[offset:end]) {
						end--
					}
					if end == offset && offset < len(b) {
						snapshotError(w, 400, "invalid_request")
						return
					}
					c := historyContent{MediaType: "text/plain", Text: string(b[offset:end]), Complete: end == len(b)}
					if end < len(b) {
						c.ContentID = id
						c.NextOffset = end
					}
					historyJSON(w, map[string]any{"schema_version": 1, "content_id": id, "offset": offset, "content": c})
					return
				}
			}
			snapshotError(w, 404, "content_revision_gone")
			return
		}
		snapshotError(w, 404, "resource_not_found")
	})
}

// Snapshot discovery reads headers only. Read a bounded prefix for the first
// prompt so navigation does not label every untitled native session alike.
func firstPrompt(s nativeSession, uid int) string {
	if s.state != "readable" {
		return ""
	}
	before, err := os.Lstat(s.path)
	if err != nil || !before.Mode().IsRegular() || before.Size() > maxHistoryFile {
		return ""
	}
	if uid >= 0 {
		owner, ok := fileOwner(before)
		if !ok || owner != uid {
			return ""
		}
	}
	f, err := os.Open(s.path)
	if err != nil {
		return ""
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || !os.SameFile(before, info) {
		return ""
	}
	scanner := bufio.NewScanner(io.LimitReader(f, 128<<10))
	scanner.Buffer(make([]byte, 4096), 128<<10)
	if !scanner.Scan() {
		return ""
	} // header
	for scanner.Scan() {
		var entry nativeEntry
		if json.Unmarshal(scanner.Bytes(), &entry) != nil {
			return ""
		}
		kind, text := nativeText(entry)
		if kind == "user" && strings.TrimSpace(text) != "" {
			runes := []rune(strings.TrimSpace(text))
			if len(runes) > 80 {
				runes = runes[:80]
			}
			return string(runes)
		}
	}
	return ""
}
func sessionFact(s nativeSession, wsid string, uid int) map[string]any {
	title := "Uusi keskustelu"
	source := "new_conversation"
	if prompt := firstPrompt(s, uid); prompt != "" {
		title = prompt
		source = "first_message_fallback"
	}
	return map[string]any{"agent_id": "pi:" + s.id, "workspace_id": wsid, "observation_token": opaque("obs_", s.id+":"+s.revision), "presence": "present", "history": s.state, "process": "unknown", "control": "read_only", "activity": "unknown", "capabilities": map[string]any{"agent_resume": map[string]string{"state": "unsupported", "reason_code": "read_only_slice"}}, "title": map[string]any{"display": title, "source": source, "generation_state": "not_requested", "replaceable": true}, "queue": map[string]any{"revision": opaque("qr_", s.id), "steering": []string{}, "follow_up": []string{}}, "live_tail": []any{}, "history_query": "/api/v1/agents/pi:" + s.id + "/history"}
}
