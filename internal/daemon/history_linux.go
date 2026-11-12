//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"context"
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
	"time"
	"unicode/utf8"

	"github.com/open-habitat/open-habitat/internal/diagnostic"
	"github.com/open-habitat/open-habitat/internal/transport"
)

const historyRoot = ".pi/agent/sessions"

var sessionIDPattern = regexp.MustCompile(`^[0-9a-fA-F-]{36}$`)
var entryIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,128}$`)
var blockReadPath = regexp.MustCompile(`^/api/v1/agents/(pi:[0-9a-fA-F-]{36})/entries/([A-Za-z0-9_-]{1,128})/blocks/([0-9]{1,3})$`)

type nativeEntry struct {
	ID        string          `json:"id"`
	Type      string          `json:"type"`
	Message   json.RawMessage `json:"message"`
	Provider  string          `json:"provider"`
	ModelID   string          `json:"modelId"`
	ParentID  *string         `json:"parentId"`
	Raw       json.RawMessage `json:"-"`
	Timestamp string          `json:"timestamp"`
}
type nativeHeader struct {
	Type      string `json:"type"`
	ID        string `json:"id"`
	Cwd       string `json:"cwd"`
	Version   int    `json:"version"`
	Timestamp string `json:"timestamp"`
}
type nativeSession struct {
	id, cwd, path, revision, state, startedAt string
	// changedAt is the session file's modification time: Pi appends every
	// entry to it, so it is when the conversation last changed. Only
	// discovery's header read sets it.
	changedAt string
	// bytes is the session file's size from the same read: the browser warns
	// once as a conversation grows heavy and offers a new one past it.
	bytes int64
	// stamp is the file's identity, size and times when a whole-file read
	// proved it stable; a later equal stamp means the bytes stood still.
	stamp                        fileStamp
	entries                      []historyEntry
	boundaryFound, olderComplete bool
	cutOff                       bool
	// refusal names, as a fixed code, which check made a read unreadable;
	// the request record carries it (never content).
	refusal string
	// active is the active branch of a whole-file read of a branched file;
	// nil when every entry is on it.
	active map[string]bool
}
type recapData struct {
	Recap       string `json:"recap"`
	Next        string `json:"next"`
	Through     string `json:"through"`
	GeneratedAt int64  `json:"generated_at"`
	Trigger     string `json:"trigger,omitempty"`
}

type historyEntry struct {
	Skill              *recordedSkill `json:"skill,omitempty"`
	Notice             *agentNotice   `json:"notice,omitempty"`
	FailureCause       *bashFailure   `json:"failure_cause,omitempty"`
	Recap              *recapData     `json:"recap,omitempty"`
	Rewind             *rewindMarker  `json:"rewind,omitempty"`
	Restart            *restartNotice `json:"restart,omitempty"`
	WaitReminder       *waitReminder  `json:"wait_reminder,omitempty"`
	Key                string         `json:"entry_key"`
	Kind               string         `json:"kind"`
	Content            historyContent `json:"content"`
	Blocks             []historyBlock `json:"blocks,omitempty"`
	ToolCallID         string         `json:"tool_call_id,omitempty"`
	IsError            *bool          `json:"is_error,omitempty"`
	StopReason         string         `json:"stop_reason,omitempty"`
	RefusedBy          string         `json:"refused_by,omitempty"`
	Model              string         `json:"model,omitempty"`
	ContextTokens      int64          `json:"context_tokens,omitempty"`
	EntryType          string         `json:"entry_type,omitempty"`
	ExitCode           *int           `json:"exit_code,omitempty"`
	Cancelled          bool           `json:"cancelled,omitempty"`
	OutputTruncated    bool           `json:"output_truncated,omitempty"`
	ExcludeFromContext bool           `json:"exclude_from_context,omitempty"`
	TruncatedBlocks    bool           `json:"truncated_blocks,omitempty"`
	NativeRevision     string         `json:"native_revision,omitempty"`
	Timestamp          string         `json:"timestamp,omitempty"`
	full               string
	skillLocation      string
	raw                json.RawMessage
}
type historyBlock struct {
	ProcessEvent *processEvent `json:"process_event,omitempty"`
	Type         string        `json:"type"`
	Text         string        `json:"text,omitempty"`
	Redacted     bool          `json:"redacted,omitempty"`
	MimeType     string        `json:"mime_type,omitempty"`
	ToolCallID   string        `json:"tool_call_id,omitempty"`
	ToolName     string        `json:"tool_name,omitempty"`
	Readable     bool          `json:"readable,omitempty"`
	// Bytes is an image's decoded size.
	Bytes int64 `json:"bytes,omitempty"`
}
type historyContent struct {
	MediaType string `json:"media_type"`
	Text      string `json:"text"`
	Complete  bool   `json:"complete"`
	Truncated bool   `json:"truncated,omitempty"`
}

// Native files remain authoritative. The scanner holds no index or copy between
// requests; the snapshot alone remembers headers by file stamp (sessionFileFacts).
// Each file is bounded and opened without following symlinks; invalid sessions never
// grant an agent identity from a filename alone.
func nativeSessions(cfg transport.Config) ([]nativeSession, error) {
	return nativeSessionsWith(cfg, readNativeHeader)
}

// nativeSessionsWith lets the snapshot answer an unchanged file's header from
// its stamp (sessionFileFacts); every other reader reads each header.
func nativeSessionsWith(cfg transport.Config, readHeader func(string, int) nativeSession) ([]nativeSession, error) {
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
		s := readHeader(path, cfg.UID)
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
	return nativeSession{id: h.ID, cwd: h.Cwd, path: path, state: "readable", startedAt: nativeTimestamp(h.Timestamp), changedAt: info.ModTime().UTC().Format(time.RFC3339Nano), bytes: info.Size(), revision: opaque("rev_", fmt.Sprintf("%d:%d:%d", info.Size(), info.ModTime().UnixNano(), info.Mode()))}
}

// A concurrent append can change size/mtime during one read. Retry once;
// repeated instability is unavailable, never proof of a missing history.
func settleNative(read func() nativeSession) nativeSession {
	s := read()
	if s.id == "" || s.state == "corrupt" {
		return read()
	}
	return s
}

// readNativeRetaining proves the whole file stable and intact and keeps only
// what retain selects of the active branch, so a reader that needs a few
// entries of a long history does not hold a projection of all of it.
func readNativeRetaining(path string, uid int, retain retainEntry) nativeSession {
	return settleNative(func() nativeSession { return readNativeActive(path, uid, retain) })
}

// proveNativeSettled checks the whole file as readNativeRetaining does but
// keeps no entries: a precondition that only asks whether the history is intact
// does not hold a projection of it. Its stamp says whether the file stands
// still later.
func proveNativeSettled(path string, uid int) nativeSession {
	return settleNative(func() nativeSession { return readNativeKept(path, uid, nil) })
}

// readNativeActive is one stable pass of readNativeKept in which retain sees
// only entries on the active branch, so an abandoned branch, however large,
// is never projected. The branch is only known at the end of the file, so a
// first pass proves the file and finds it; both passes must see the same
// bytes.
func readNativeActive(path string, uid int, retain retainEntry) nativeSession {
	tree := readNativeKept(path, uid, nil)
	if tree.id == "" || tree.state != "readable" {
		return tree
	}
	s := readNativeKept(path, uid, func(id string, project func() historyEntry) (historyEntry, bool) {
		if tree.active != nil && !tree.active[id] {
			return historyEntry{}, false
		}
		return retain(id, project)
	})
	if s.stamp != tree.stamp {
		return nativeSession{}
	}
	return s
}

// readNativeForward reads the active branch's entries after the after key, or
// from the start when it is empty, keeping at most limit+1 of them: the extra
// one says more follow. found says the after key was a visible entry on the
// branch.
func readNativeForward(path string, uid int, after string, limit int) (page nativeSession, found bool) {
	page = settleNative(func() nativeSession {
		found = after == ""
		kept := 0
		return readNativeActive(path, uid, func(id string, project func() historyEntry) (historyEntry, bool) {
			if found && kept > limit || !found && id != after {
				return historyEntry{}, false
			}
			e := project()
			if e.Kind == "" {
				return e, false
			}
			if !found {
				found = true
				return e, false
			}
			kept++
			return e, true
		})
	})
	return page, found
}

// retainEntry decides what a whole-file read keeps of each entry of the file,
// in file order: the entry's projection, a smaller stand-in, or nothing. The
// file has no size bound, so a projection of all its entries would grow with
// it; a reader keeps what it uses. Projecting is most of a read's cost (a
// picture record is decoded whole), so project is called only for an entry
// the reader wants; its Kind is empty for an entry the browser never shows.
// readNativeKept drops entries off the active branch only afterwards, so its
// retain also sees them; readNativeActive does not.
type retainEntry func(id string, project func() historyEntry) (historyEntry, bool)

func retainAll(_ string, project func() historyEntry) (historyEntry, bool) {
	e := project()
	return e, e.Kind != ""
}

func readNativeKept(path string, uid int, keep retainEntry) nativeSession {
	var result nativeSession
	stamp, ok := readNativeStream(path, uid, func(r io.Reader) { result = decodeNativeStream(r, path, keep) })
	if !ok {
		return nativeSession{}
	}
	result.stamp = stamp
	return result
}

func decodeNative(b []byte, path string) nativeSession {
	return decodeNativeStream(bytes.NewReader(b), path, retainAll)
}

// decodeNativeStream projects the active branch of one native session read
// once from r, holding a single record at a time. The revision hashes every
// byte of r, so it equals the history window's revision of the same file.
// A nil keep proves the file and projects nothing.
func decodeNativeStream(r io.Reader, path string, keep retainEntry) (result nativeSession) {
	hash := sha256.New()
	r = io.TeeReader(r, hash)
	// The revision must cover every byte, also after a walk that stopped.
	defer func() {
		_, _ = io.Copy(io.Discard, r)
		if result.id != "" || result.state == "corrupt" {
			result.revision = base64.RawURLEncoding.EncodeToString(hash.Sum(nil)[:18])
		}
	}()
	result.path = path
	result.state = "readable"
	result.entries = []historyEntry{}
	header := true
	invalid := false
	seen := map[string]bool{}
	parents := map[string]*string{}
	var leaf string
	tail, err := eachNativeLine(r, func(line []byte) bool {
		if !utf8.Valid(line) {
			invalid = true
			return false
		}
		if header {
			header = false
			var h nativeHeader
			if json.Unmarshal(line, &h) != nil || h.Type != "session" || h.Version != 3 || !sessionIDPattern.MatchString(h.ID) || !filepath.IsAbs(h.Cwd) {
				invalid = true
				return false
			}
			result.id, result.cwd, result.startedAt = h.ID, h.Cwd, nativeTimestamp(h.Timestamp)
			return true
		}
		if result.state == "corrupt" {
			// Later records only still decide whether the file is valid UTF-8.
			return true
		}
		// The tree's fields are every typed field of nativeEntry; the message
		// may be any JSON value and is the bulk of a picture record, so only
		// an entry the reader keeps is decoded whole and projected.
		var tree struct {
			ID        string  `json:"id"`
			Type      string  `json:"type"`
			Provider  string  `json:"provider"`
			ModelID   string  `json:"modelId"`
			ParentID  *string `json:"parentId"`
			Timestamp string  `json:"timestamp"`
		}
		if json.Unmarshal(line, &tree) != nil || !entryIDPattern.MatchString(tree.ID) || seen[tree.ID] {
			result.state = "corrupt"
			return true
		}
		seen[tree.ID] = true
		parents[tree.ID] = tree.ParentID
		leaf = tree.ID
		if keep != nil {
			broken := false
			project := func() historyEntry {
				var e nativeEntry
				if json.Unmarshal(line, &e) != nil {
					broken = true
					return historyEntry{}
				}
				e.Raw = line
				return nativeBlocks(e)
			}
			kept, ok := keep(tree.ID, project)
			if broken {
				result.state = "corrupt"
				return true
			}
			if ok {
				result.entries = append(result.entries, kept)
			}
		}
		return true
	})
	if invalid {
		result = nativeSession{}
		return result
	}
	if err != nil {
		if result.id == "" {
			result = nativeSession{}
			return result
		}
		result.state = "corrupt"
		return result
	}
	// A quota failure may cut the final record, even inside a UTF-8 rune.
	// Never repair the file: decode only the complete prefix, hash all bytes.
	if len(tail) > 0 {
		var value any
		err := json.Unmarshal(tail, &value)
		if header || err == nil || err.Error() != "unexpected end of JSON input" {
			if header {
				result = nativeSession{}
			} else {
				result.state = "corrupt"
			}
			return result
		}
		result.cutOff = true
	}
	if header {
		result = nativeSession{}
		return result
	}
	if result.state == "corrupt" {
		return result
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
		result.active = active
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
func nativeTimestamp(raw string) string {
	if raw == "" {
		return ""
	}
	if _, err := time.Parse(time.RFC3339Nano, raw); err != nil {
		return ""
	}
	return raw
}
func nativeText(e nativeEntry) (string, string) {
	switch e.Type {
	case "model_change":
		return "model_change", strings.TrimPrefix(e.Provider+"/"+e.ModelID, "/")
	case "message":
		var bash struct {
			Role string `json:"role"`
		}
		if json.Unmarshal(e.Message, &bash) == nil && bash.Role == "bashExecution" {
			return "bash", "Local command"
		}
		var m struct {
			Role     string          `json:"role"`
			Content  json.RawMessage `json:"content"`
			ToolName string          `json:"toolName"`
		}
		if json.Unmarshal(e.Message, &m) != nil {
			return "unknown", ""
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
			return "unknown", ""
		}
		parts := []string{}
		if kind == "tool" && m.ToolName != "" {
			parts = append(parts, m.ToolName)
		}
		// Only text is flattened. Tool calls and other blocks are words the
		// browser supplies in the person's language from the blocks, and an
		// unknown field is never shown, even if its type is a string.
		for _, b := range blocks {
			if b.Type == "text" {
				parts = append(parts, b.Text)
			}
		}
		return kind, strings.Join(parts, "\n")
	default:
		// The browser names an unknown entry itself.
		return "unknown", ""
	}
}
func inline(_ *nativeSession, e *historyEntry) {
	// Resolve optional current metadata only for entries being delivered. Native
	// ancestry/ownership scans must not open every archived skill file.
	if e.Skill != nil && e.skillLocation != "" {
		e.Skill.Description = skillDescription(e.skillLocation, e.Skill.Name)
	}
	// Ancillary entry text is only a bounded label. Message blocks, not this
	// flattened label, are the source of readable conversation content.
	text := prefixBytes(e.full, 16384)
	e.Content = historyContent{MediaType: "text/plain", Text: text, Complete: len(text) == len(e.full)}
	if len(text) < len(e.full) {
		e.Content.Truncated = true
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
	cfg.Home = root
	return historyHandlerWithReader(cfg, trusted, func(c transport.Config) ([]nativeSession, error) { c.Home = root; return nativeSessions(c) })
}

// A browser page is bounded three ways. The browser asks for a number of
// conversational messages (historyPageMessages caps the ask); the entry and byte
// bounds stop pathological pages. Measured on long tool-heavy Pi sessions
// (2026-11): 100 messages were 590–650 entries and 0.87–1.02 MB on the wire, so
// the message ask is the bound that normally applies and the others leave room
// for twice heavier tool output. The browser rejects a history body over
// 2 MiB, so the entry budget leaves room for the envelope and separators.
const historyPageMessages = 200
const historyPageEntries = 1000
const historyPageBudget = 2<<20 - 128<<10
const historyBlockBudget = 1 << 20

// refuseHistory answers a history read the native source cannot serve now.
// The wire code is the same for every such refusal; the request record names
// which check refused (12.11.2026: three 503s in the journal and no way to
// tell why).
func refuseHistory(w http.ResponseWriter, r *http.Request, reason string) {
	diagnostic.Reason(r.Context(), reason)
	if reason == "quota_cut_record" {
		// The one refusal the person can understand and act on: storage ran
		// out while Pi wrote, and the browser says so.
		snapshotError(w, 503, "native_history_cut")
		return
	}
	snapshotError(w, 503, "native_source_unavailable")
}

// pageRefusal names why a page read of s did not give s's history.
func pageRefusal(loaded nativeSession, s *nativeSession) string {
	switch {
	case loaded.refusal != "":
		return loaded.refusal
	case loaded.id == "":
		return "source_unstable"
	case loaded.id != s.id || loaded.cwd != s.cwd:
		return "identity_changed"
	case loaded.state == "corrupt":
		return "corrupt"
	}
	return "not_readable"
}

// historyReadWait is how long one history read may take before its reply.
const historyReadWait = 60 * time.Second

func historyHandlerWithReader(cfg transport.Config, trusted func(*http.Request) bool, sessionsReader func(transport.Config) ([]nativeSession, error)) http.Handler {
	return historyHandlerWithBudget(cfg, trusted, sessionsReader, historyPageBudget, historyBlockBudget)
}

// historyHandlerWithBudget is an unexported test seam; runtime callers always use production budgets.
func historyHandlerWithBudget(cfg transport.Config, trusted func(*http.Request) bool, sessionsReader func(transport.Config) ([]nativeSession, error), pageBudget, blockBudget int) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) || r.Method != "GET" || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		// A page reads back from the tail and a block read finds its record,
		// both in time that grows with the conversation: past a few hundred
		// MiB of pictures one read takes longer than the socket's five-second
		// write deadline, and the conversation read as unavailable
		// (8.11.2026, 530 MiB). The read is still bounded by the record bound
		// and the page budget; only its wait is not.
		_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(historyReadWait))
		processProjectionCtx, stopProjection := context.WithTimeout(r.Context(), 500*time.Millisecond)
		defer stopProjection()
		path := r.URL.EscapedPath()
		sessions, err := sessionsReader(cfg)
		if err != nil {
			refuseHistory(w, r, "discovery_failed")
			return
		}
		if serveSpinoffs(w, r, cfg, sessions) || serveSpinoffWork(w, r, cfg, sessions) {
			return
		}
		if strings.HasPrefix(path, "/api/v1/agents/") && strings.HasSuffix(path, "/recap") {
			id := strings.TrimSuffix(strings.TrimPrefix(path, "/api/v1/agents/"), "/recap")
			if !strings.HasPrefix(id, "pi:") || !sessionIDPattern.MatchString(strings.TrimPrefix(id, "pi:")) || r.URL.RawQuery != "" || r.URL.Path != path {
				snapshotError(w, 400, "invalid_request")
				return
			}
			serveNativeRecap(w, cfg, sessions, id)
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
				if k != "after" && k != "before" && k != "limit" && k != "messages" {
					snapshotError(w, 400, "invalid_request")
					return
				}
			}
			limit := historyPageEntries
			if q.Has("limit") {
				v, e := strconv.Atoi(q.Get("limit"))
				if e != nil || v < 1 || v > historyPageEntries || len(q["limit"]) != 1 {
					snapshotError(w, 400, "invalid_request")
					return
				}
				limit = v
			}
			// Forward pages continue a held window entry by entry; only pages
			// read back from the tail count messages.
			messages := 0
			if q.Has("messages") {
				v, e := strconv.Atoi(q.Get("messages"))
				if e != nil || v < 1 || v > historyPageMessages || len(q["messages"]) != 1 || q.Has("after") {
					snapshotError(w, 400, "invalid_request")
					return
				}
				messages = v
			}
			var s *nativeSession
			for i := range sessions {
				if "pi:"+sessions[i].id == id {
					if s != nil {
						refuseHistory(w, r, "duplicate_session_id")
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
				refuseHistory(w, r, "session_unavailable")
				return
			}
			if q.Has("after") && len(q["after"]) != 1 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			if q.Has("before") && q.Has("after") {
				snapshotError(w, 400, "invalid_request")
				return
			}
			if q.Has("before") || !q.Has("after") {
				if q.Has("before") && (len(q["before"]) != 1 || !entryIDPattern.MatchString(q.Get("before"))) {
					snapshotError(w, 400, "invalid_request")
					return
				}
				loaded := readNativePageSettled(s.path, cfg.UID, q.Get("before"), limit, messages)
				if loaded.id != s.id || loaded.cwd != s.cwd || loaded.state != "readable" {
					refuseHistory(w, r, pageRefusal(loaded, s))
					return
				}
				if !loaded.boundaryFound {
					historyJSON(w, map[string]any{"schema_version": 1, "agent_id": id, "native_revision": loaded.revision, "entries": []historyEntry{}, "older_complete": false, "boundary_found": false, "cut_off": loaded.cutOff})
					return
				}
				entries := loaded.entries
				pageBytes := 0
				start := len(entries)
				for i := len(entries) - 1; i >= 0; i-- {
					inline(&loaded, &entries[i])
					enrichProcessEntry(processProjectionCtx, cfg.Home, *s, &entries[i])
					wire, err := json.Marshal(entries[i])
					if err != nil {
						refuseHistory(w, r, "encode_failed")
						return
					}
					if start < len(entries) && pageBytes+len(wire) > pageBudget {
						break
					}
					pageBytes += len(wire)
					entries[i].full = ""
					start = i
				}
				entries = entries[start:]
				body := map[string]any{"schema_version": 1, "agent_id": id, "native_revision": loaded.revision, "entries": entries, "older_complete": loaded.olderComplete && start == 0, "boundary_found": true, "cut_off": loaded.cutOff}
				if len(entries) > 0 && body["older_complete"] == false {
					body["next_before"] = entries[0].Key
				}
				historyJSON(w, body)
				return
			}
			loaded, found := readNativeForward(s.path, cfg.UID, q.Get("after"), limit)
			if loaded.id != s.id || loaded.cwd != s.cwd || loaded.state != "readable" {
				refuseHistory(w, r, pageRefusal(loaded, s))
				return
			}
			if !found {
				snapshotError(w, 409, "stale_precondition")
				return
			}
			s = &loaded
			more := len(s.entries) > limit
			if more {
				s.entries = s.entries[:limit]
			}
			entries := make([]historyEntry, 0, len(s.entries))
			pageBytes := 0
			for _, e := range s.entries {
				inline(s, &e)
				enrichProcessEntry(processProjectionCtx, cfg.Home, *s, &e)
				wire, err := json.Marshal(e)
				if err != nil {
					refuseHistory(w, r, "encode_failed")
					return
				}
				if len(entries) > 0 && pageBytes+len(wire) > pageBudget {
					break
				}
				pageBytes += len(wire)
				e.full = ""
				entries = append(entries, e)
			}
			complete := !more && len(entries) == len(s.entries)
			body := map[string]any{"schema_version": 1, "agent_id": id, "native_revision": s.revision, "entries": entries, "complete": complete, "cut_off": s.cutOff}
			if !complete {
				body["next_after"] = entries[len(entries)-1].Key
			}
			historyJSON(w, body)
			return
		}
		if match := blockReadPath.FindStringSubmatch(path); match != nil {
			id := match[1]
			key := match[2]
			index, _ := strconv.Atoi(match[3])
			q := r.URL.Query()
			part := q.Get("part")
			argumentPart := part == "skill_arguments"
			expectedQueries := 3
			if argumentPart {
				expectedQueries++
			}
			if (q.Has("part") && (!argumentPart || len(q["part"]) != 1)) || len(q) != expectedQueries || len(q["revision"]) != 1 || len(q["offset"]) != 1 || len(q["limit_bytes"]) != 1 || len(q.Get("revision")) > 200 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			offset, e1 := strconv.Atoi(q.Get("offset"))
			limit, e2 := strconv.Atoi(q.Get("limit_bytes"))
			if e1 != nil || e2 != nil || offset < 0 || limit < 1 || limit > blockBudget || index < 0 || index >= 128 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			for i := range sessions {
				s := &sessions[i]
				if "pi:"+s.id != id {
					continue
				}
				if s.state != "readable" {
					refuseHistory(w, r, "session_unavailable")
					return
				}
				loaded := readNativeWindowSettled(s.path, cfg.UID, "", 1, key)
				if loaded.id != s.id || loaded.cwd != s.cwd || loaded.state != "readable" || loaded.revision != q.Get("revision") {
					snapshotError(w, 404, "content_revision_gone")
					return
				}
				for _, entry := range loaded.entries {
					if entry.Key != key {
						continue
					}
					var chunk map[string]any
					var ok bool
					if argumentPart {
						chunk, ok = nativeSkillArgumentsChunk(entry.raw, index, offset, limit)
					} else {
						chunk, ok = nativeBlockChunk(entry.raw, index, offset, limit)
					}
					if !ok {
						snapshotError(w, 404, "resource_not_found")
						return
					}
					response := map[string]any{"schema_version": 1, "agent_id": id, "native_revision": loaded.revision, "entry_key": key, "block_index": index, "offset": offset, "chunk": chunk}
					if argumentPart {
						response["part"] = part
					}
					historyJSON(w, response)
					return
				}
				snapshotError(w, 404, "resource_not_found")
				return
			}
			snapshotError(w, 404, "resource_not_found")
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
	if err != nil || !before.Mode().IsRegular() {
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
			if skill, ok := projectUserSkill(entry.Message); ok {
				text = skill.name
				if skill.arguments != "" {
					text += " · " + skill.arguments
				}
			}
			return fallbackTitle(text)
		}
	}
	return ""
}

// nativeName reads Pi's latest session_info, including explicit empty names.
// A changing file is not evidence of a name for a conditional write.
func nativeName(s nativeSession, uid int) string {
	name, ok := readNativeName(s, uid, true)
	if !ok {
		return ""
	}
	name = prefixBytes(name, 160)
	if !validTitle(name) {
		return ""
	}
	return name
}

// A write must distinguish an empty native name from an unreadable one, and
// compare the full value rather than the display prefix.
func nativeNameExact(s nativeSession, uid int) (string, bool) {
	return readNativeName(s, uid, true)
}

// An already complete name remains safe to display when Pi appends a later
// entry during a snapshot read. Writes use the stricter nativeName precondition.
func nativeNameDisplay(s nativeSession, uid int) string {
	name, ok := readNativeName(s, uid, false)
	if !ok {
		return ""
	}
	name = prefixBytes(name, 160)
	if !validTitle(name) {
		return ""
	}
	return name
}

func readNativeName(s nativeSession, uid int, strict bool) (string, bool) {
	if s.state != "readable" {
		return "", false
	}
	before, err := os.Lstat(s.path)
	if err != nil || !before.Mode().IsRegular() {
		return "", false
	}
	if uid >= 0 {
		owner, ok := fileOwner(before)
		if !ok || owner != uid {
			return "", false
		}
	}
	f, err := os.Open(s.path)
	if err != nil {
		return "", false
	}
	defer f.Close()
	opened, err := f.Stat()
	if err != nil || !os.SameFile(before, opened) {
		return "", false
	}
	// Most names are near the tail. Inspect its complete lines backward before
	// walking older history; the fallback remains necessary for early names.
	var name string
	known := false
	const tailSize = 64 << 10
	if before.Size() > tailSize {
		tail := make([]byte, tailSize)
		if n, err := f.ReadAt(tail, before.Size()-tailSize); err == nil && n == len(tail) {
			if first := bytes.IndexByte(tail, '\n'); first >= 0 {
				lines := bytes.Split(tail[first+1:], []byte{'\n'})
				for i := len(lines) - 2; i >= 0; i-- {
					if !bytes.Contains(lines[i], []byte(`"session_info"`)) {
						continue
					}
					var entry struct {
						Type string `json:"type"`
						Name string `json:"name"`
					}
					if json.Unmarshal(lines[i], &entry) != nil {
						return "", false
					}
					if entry.Type == "session_info" {
						name = strings.TrimSpace(entry.Name)
						known = true
						break
					}
				}
			}
		}
	}
	if name == "" {
		if _, err := f.Seek(0, io.SeekStart); err != nil {
			return "", false
		}
		name, known = scanNativeNames(f)
	}
	after, err := os.Lstat(s.path)
	if err != nil || !os.SameFile(before, after) || after.Size() < before.Size() || (strict && (before.Size() != after.Size() || !before.ModTime().Equal(after.ModTime()))) {
		return "", false
	}
	return name, known
}

func scanNativeNames(f *os.File) (string, bool) {
	reader := bufio.NewReaderSize(f, 16<<10)
	var name string
	for {
		line, readErr := reader.ReadSlice('\n')
		// Pi tool output and the stored system prompt can be much larger than a
		// title entry. Discard their fragments rather than allocating the whole
		// line or losing later names. Pi writes an entry's type first, so an
		// overlong line of another type is skipped; an overlong session_info,
		// or a line of unseen type that might be one, makes the name unknowable.
		if readErr == bufio.ErrBufferFull {
			typed := bytes.HasPrefix(line, []byte(`{"type":"`))
			if bytes.HasPrefix(line, []byte(`{"type":"session_info"`)) || !typed && (bytes.Contains(line, []byte(`"session_info"`)) || bytes.Contains(line, []byte(`"name":`))) {
				return "", false
			}
			for readErr == bufio.ErrBufferFull {
				_, readErr = reader.ReadSlice('\n')
			}
			if readErr == io.EOF {
				break
			}
			if readErr != nil {
				return "", false
			}
			continue
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return "", false
		}
		if !bytes.Contains(line, []byte(`"session_info"`)) {
			continue
		}
		var entry struct {
			Type string `json:"type"`
			Name string `json:"name"`
		}
		if json.Unmarshal(line, &entry) != nil {
			return "", false
		}
		if entry.Type == "session_info" {
			name = strings.TrimSpace(entry.Name)
		}
	}
	return name, true
}

func sessionFact(s nativeSession, wsid string, uid int) map[string]any {
	return sessionFactTitled(s, wsid, firstPrompt(s, uid), nativeNameDisplay(s, uid))
}

func sessionFactTitled(s nativeSession, wsid, prompt, name string) map[string]any {
	title := "Uusi keskustelu"
	source := "new_conversation"
	if prompt != "" {
		title = prompt
		source = "first_message_fallback"
	}
	if name != "" {
		title = name
		source = "native_session"
	}
	fact := map[string]any{"agent_id": "pi:" + s.id, "workspace_id": wsid, "observation_token": archiveObservation(s), "presence": "present", "history": s.state, "process": "unknown", "control": "read_only", "activity": "unknown", "capabilities": map[string]any{"agent_resume": map[string]string{"state": "unsupported", "reason_code": "read_only_slice"}}, "title": map[string]any{"display": title, "source": source, "generation_state": "not_requested", "replaceable": true}, "queue": map[string]any{"revision": opaque("qr_", s.id), "steering": []string{}, "follow_up": []string{}}, "live_tail": []any{}, "history_query": "/api/v1/agents/pi:" + s.id + "/history"}
	if s.startedAt != "" {
		fact["started_at"] = s.startedAt
	}
	if s.changedAt != "" {
		fact["changed_at"] = s.changedAt
	}
	if s.bytes > 0 {
		fact["native_bytes"] = s.bytes
	}
	return fact
}

// Both personal adapters use the same native recap reader.
func serveNativeRecap(w http.ResponseWriter, cfg transport.Config, sessions []nativeSession, id string) {
	var match *nativeSession
	for i := range sessions {
		if "pi:"+sessions[i].id == id {
			if match != nil {
				snapshotError(w, 503, "native_source_unavailable")
				return
			}
			match = &sessions[i]
		}
	}
	if match == nil {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	if match.state != "readable" {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	value, latest, ok := latestNativeRecap(match.path, cfg.UID, match.id, match.cwd)
	if !ok {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	var recap *recapData
	if value.Through != "" {
		recap = &value
	}
	var latestAt any
	if latest.At != "" {
		latestAt = latest.At
	}
	historyJSON(w, map[string]any{"schema_version": 1, "recap": recap, "latest_message": latest.ID, "latest_message_at": latestAt})
}
