//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
)

// Palaa tähän (experimental). The daemon's own Pi extension does the work in
// the person's Pi (rewind-extension.mjs): it copies the files the agent's
// edit and write tools touch before they are changed, moves the conversation
// in place with Pi's tree navigation, restores files and records what it did
// as a custom entry in the same session. The daemon only reads that native
// record (the preview, the history row, the replaced continuation) and asks
// the extension to act; it writes neither the session nor the files.
//
//go:embed rewind-extension.mjs
var rewindExtension []byte

func installRewindExtension(dir string) (string, error) {
	path := filepath.Join(dir, "rewind-extension.mjs")
	return path, os.WriteFile(path, rewindExtension, 0600)
}

const (
	rewindCheckpointType = "oh-rewind-checkpoint"
	rewindMarkerType     = "oh-rewind"
	rewindOutcomePrefix  = "oh-rewind:"
	// What a preview names: the files a restore would change and the
	// commands whose effects it cannot undo.
	maxRewindFiles    = 50
	maxRewindCommands = 5
	// A line count is shown only for text files this small; larger or
	// binary ones are named without one.
	maxRewindDiffBytes = 1 << 20
	maxRewindDiffLines = 20000
	maxRewindDiffEdits = 4000
	// The replaced continuation shown under its row, newest last.
	maxRewindBranchEntries = 200
)

// A copy's name and store as the extension writes them (better-pi-rewind's
// safe storage components).
var rewindSafeName = regexp.MustCompile(`^[A-Za-z0-9._@-]{1,200}$`)

type rewindVersion struct {
	BackupFileName *string `json:"backupFileName"`
	Mode           *int64  `json:"mode"`
	StoreID        string  `json:"storeId"`
}

func (v rewindVersion) valid() bool {
	safe := func(s string) bool { return s != "." && s != ".." && rewindSafeName.MatchString(s) }
	return safe(v.StoreID) && (v.BackupFileName == nil || safe(*v.BackupFileName))
}

type rewindRecord struct {
	Version     int                      `json:"version"`
	Kind        string                   `json:"kind"`
	UserEntryID string                   `json:"userEntryId"`
	Cwd         string                   `json:"cwd"`
	Files       map[string]rewindVersion `json:"files"`
	// Paths this checkpoint could not copy: no version there.
	Unavailable []string `json:"unavailable"`
}

// rewindMarkerData is the extension's own record of one Palaa tähän.
type rewindMarkerData struct {
	Version int    `json:"version"`
	Action  string `json:"action"`
	At      string `json:"at"`
	Left    string `json:"left"`
	Of      string `json:"of"`
	Own     int    `json:"own"`
	Replies int    `json:"replies"`
	Files   *struct {
		Restored int `json:"restored"`
		Errors   int `json:"errors"`
	} `json:"files"`
	Before map[string]rewindVersion `json:"before"`
}

// rewindMarker is the history row's projection of a marker: what happened,
// never the copies' names or paths.
type rewindMarker struct {
	Action        string `json:"action"`
	At            string `json:"at,omitempty"`
	Of            string `json:"of,omitempty"`
	Own           int    `json:"own"`
	Replies       int    `json:"replies"`
	FilesRestored *int   `json:"files_restored,omitempty"`
	FileErrors    int    `json:"file_errors,omitempty"`
	// The replaced continuation can be continued again (switch), and its
	// files come back with it or the restore can be undone.
	Switchable  bool `json:"switchable"`
	FilesReturn bool `json:"files_return"`
}

func nativeRewindMarker(raw json.RawMessage) (*rewindMarker, bool) {
	var custom struct {
		CustomType string           `json:"customType"`
		Data       rewindMarkerData `json:"data"`
	}
	if json.Unmarshal(raw, &custom) != nil || custom.CustomType != rewindMarkerType || custom.Data.Version != 1 {
		return nil, false
	}
	d := custom.Data
	bounded := func(n int) bool { return n >= 0 && n <= 1_000_000 }
	if !bounded(d.Own) || !bounded(d.Replies) {
		return nil, false
	}
	m := &rewindMarker{Action: d.Action, Own: d.Own, Replies: d.Replies}
	switch d.Action {
	case "rewind", "switch":
		if !entryIDPattern.MatchString(d.At) || !entryIDPattern.MatchString(d.Left) {
			return nil, false
		}
		m.At, m.Switchable = d.At, true
	case "files":
		if !entryIDPattern.MatchString(d.At) || d.Files == nil {
			return nil, false
		}
		m.At = d.At
	case "undo":
		if !entryIDPattern.MatchString(d.Of) || d.Files == nil {
			return nil, false
		}
		m.Of = d.Of
	default:
		return nil, false
	}
	if d.Files != nil {
		if !bounded(d.Files.Restored) || !bounded(d.Files.Errors) {
			return nil, false
		}
		restored := d.Files.Restored
		m.FilesRestored, m.FileErrors = &restored, d.Files.Errors
	}
	if d.Before != nil && d.Action != "undo" {
		m.FilesReturn = true
		for path, v := range d.Before {
			if path == "" || !v.valid() {
				m.FilesReturn = false
			}
		}
	}
	return m, true
}

// rewindLine is what the daemon reads of one native entry for a preview or
// a replaced continuation.
type rewindLine struct {
	id, parent, kind, customType string
	root                         bool
	text                         bool // a person's message, or a reply with text
	commands                     []string
	record                       *rewindRecord
	marker                       *rewindMarkerData
	offset                       int64
}

type rewindSession struct {
	path, cwd string
	lines     []rewindLine
	index     map[string]int
	leaf      string
}

// readRewindSession reads the whole native file forward once, keeping only
// structure: parents, message kinds, bash commands and the extension's
// records. The file is the person's own; the same owner and stability checks
// as a history read apply.
func readRewindSession(path string, uid int) (*rewindSession, bool) {
	info, err := os.Lstat(path)
	if err != nil || !info.Mode().IsRegular() || info.Size() < 1 || info.Size() > maxHistoryFile {
		return nil, false
	}
	if uid >= 0 {
		if owner, ok := fileOwner(info); !ok || owner != uid {
			return nil, false
		}
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, false
	}
	defer f.Close()
	if opened, err := f.Stat(); err != nil || !os.SameFile(info, opened) {
		return nil, false
	}
	header := readNativeHeader(path, uid)
	if header.id == "" {
		return nil, false
	}
	s := &rewindSession{path: path, cwd: header.cwd, index: map[string]int{}}
	reader := bufio.NewReaderSize(io.LimitReader(f, info.Size()), 64<<10)
	var offset int64
	for {
		line, err := reader.ReadBytes('\n')
		start := offset
		offset += int64(len(line))
		if len(line) > 64<<20 {
			return nil, false
		}
		if err == io.EOF && len(line) > 0 && line[len(line)-1] != '\n' {
			break // Pi is writing this record; it is not part of the tree yet
		}
		if len(bytes.TrimSpace(line)) > 0 {
			var e struct {
				ID         string           `json:"id"`
				Type       string           `json:"type"`
				ParentID   *json.RawMessage `json:"parentId"`
				CustomType string           `json:"customType"`
				Data       json.RawMessage  `json:"data"`
				Message    *struct {
					Role    string          `json:"role"`
					Content json.RawMessage `json:"content"`
				} `json:"message"`
			}
			if json.Unmarshal(line, &e) != nil {
				return nil, false
			}
			if e.Type != "session" {
				if !entryIDPattern.MatchString(e.ID) {
					return nil, false
				}
				if _, dup := s.index[e.ID]; dup {
					return nil, false
				}
				l := rewindLine{id: e.ID, kind: e.Type, customType: e.CustomType, offset: start}
				var parent *string
				if e.ParentID != nil {
					_ = json.Unmarshal(*e.ParentID, &parent)
				}
				if parent == nil {
					l.root = true
				} else {
					l.parent = *parent
				}
				if e.Type == "message" && e.Message != nil {
					l.kind = e.Message.Role
					text, commands := rewindContent(e.Message.Content)
					l.text = e.Message.Role == "user" || (e.Message.Role == "assistant" && text)
					if e.Message.Role == "assistant" {
						l.commands = commands
					}
				}
				if e.Type == "custom" && e.CustomType == rewindCheckpointType {
					var r rewindRecord
					if json.Unmarshal(e.Data, &r) == nil && r.Version == 1 && (r.Kind == "snapshot" || r.Kind == "update") && entryIDPattern.MatchString(r.UserEntryID) && (r.Kind == "update" || filepath.IsAbs(r.Cwd)) {
						valid := r.Files != nil
						for path, v := range r.Files {
							if path == "" || strings.ContainsRune(path, 0) || !v.valid() {
								valid = false
							}
						}
						if valid {
							l.record = &r
						}
					}
				}
				if e.Type == "custom" && e.CustomType == rewindMarkerType {
					var d rewindMarkerData
					if json.Unmarshal(e.Data, &d) == nil {
						l.marker = &d
					}
				}
				s.index[e.ID] = len(s.lines)
				s.lines = append(s.lines, l)
				s.leaf = e.ID
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, false
		}
	}
	after, err := os.Lstat(path)
	if err != nil || !os.SameFile(info, after) || after.Size() < info.Size() {
		return nil, false
	}
	return s, true
}

// rewindContent says whether a reply has text and which bash commands it ran.
func rewindContent(raw json.RawMessage) (bool, []string) {
	var text string
	if json.Unmarshal(raw, &text) == nil {
		return strings.TrimSpace(text) != "", nil
	}
	var blocks []struct {
		Type      string `json:"type"`
		Text      string `json:"text"`
		Name      string `json:"name"`
		Arguments struct {
			Command string `json:"command"`
		} `json:"arguments"`
	}
	if json.Unmarshal(raw, &blocks) != nil {
		return false, nil
	}
	hasText := false
	var commands []string
	for _, b := range blocks {
		if b.Type == "text" && strings.TrimSpace(b.Text) != "" {
			hasText = true
		}
		if b.Type == "toolCall" && b.Name == "bash" && strings.TrimSpace(b.Arguments.Command) != "" {
			commands = append(commands, b.Arguments.Command)
		}
	}
	return hasText, commands
}

// branch is the path from leaf to the root, oldest first. A missing parent
// or a cycle is a damaged tree.
func (s *rewindSession) branch(leaf string) ([]rewindLine, bool) {
	var path []rewindLine
	seen := map[string]bool{}
	for id := leaf; id != ""; {
		i, ok := s.index[id]
		if !ok || seen[id] {
			return nil, false
		}
		seen[id] = true
		path = append(path, s.lines[i])
		if s.lines[i].root {
			break
		}
		id = s.lines[i].parent
	}
	for i, j := 0, len(path)-1; i < j; i, j = i+1, j-1 {
		path[i], path[j] = path[j], path[i]
	}
	return path, true
}

type rewindCheckpoint struct {
	cwd         string
	files       map[string]rewindVersion
	unavailable map[string]bool
}

// checkpoints mirrors the extension's History: one checkpoint per person's
// message from every branch, and each path's first copy.
func (s *rewindSession) checkpoints() (map[string]*rewindCheckpoint, map[string]rewindVersion) {
	checkpoints, first := map[string]*rewindCheckpoint{}, map[string]rewindVersion{}
	for _, l := range s.lines {
		r := l.record
		if r == nil {
			continue
		}
		if r.Kind == "snapshot" {
			c := &rewindCheckpoint{cwd: r.Cwd, files: map[string]rewindVersion{}, unavailable: map[string]bool{}}
			for p, v := range r.Files {
				c.files[p] = v
			}
			for _, p := range r.Unavailable {
				c.unavailable[p] = true
			}
			checkpoints[r.UserEntryID] = c
		} else if c := checkpoints[r.UserEntryID]; c != nil {
			for p, v := range r.Files {
				c.files[p] = v
			}
			for _, p := range r.Unavailable {
				if _, ok := r.Files[p]; !ok {
					c.unavailable[p] = true
				}
			}
		} else {
			continue
		}
		for p, v := range r.Files {
			if _, ok := first[p]; !ok {
				first[p] = v
			}
		}
	}
	return checkpoints, first
}

type rewindFile struct {
	Path      string `json:"path"`
	Change    string `json:"change"`
	Additions *int   `json:"additions,omitempty"`
	Deletions *int   `json:"deletions,omitempty"`
}

type rewindPreview struct {
	SchemaVersion int          `json:"schema_version"`
	AgentID       string       `json:"agent_id"`
	EntryKey      string       `json:"entry_key"`
	Own           int          `json:"own"`
	Replies       int          `json:"replies"`
	Checkpoint    bool         `json:"checkpoint"`
	Files         []rewindFile `json:"files"`
	FilesMore     int          `json:"files_more"`
	FileErrors    int          `json:"file_errors"`
	Commands      []string     `json:"commands"`
	CommandsMore  int          `json:"commands_more"`
}

// preview says what going back before entry leaves behind and what a file
// restore changes, compared with the files as they are now.
func (s *rewindSession) preview(home, entry string) (rewindPreview, bool) {
	out := rewindPreview{SchemaVersion: 1, EntryKey: entry, Files: []rewindFile{}, Commands: []string{}}
	branch, ok := s.branch(s.leaf)
	if !ok {
		return out, false
	}
	at := -1
	for i, l := range branch {
		if l.id == entry && l.kind == "user" {
			at = i
		}
	}
	if at < 0 {
		return out, false
	}
	seen := map[string]bool{}
	waiting := false
	for _, l := range branch[at:] {
		// A reply per answered message, as the extension counts and the
		// timeline shows one turn.
		if l.text && l.kind == "user" {
			out.Own++
			waiting = true
		} else if l.text && l.kind == "assistant" && waiting {
			out.Replies++
			waiting = false
		}
		for _, c := range l.commands {
			c = prefixBytes(strings.ToValidUTF8(strings.Join(strings.Fields(c), " "), ""), 160)
			if seen[c] {
				continue
			}
			seen[c] = true
			if len(out.Commands) < maxRewindCommands {
				out.Commands = append(out.Commands, c)
			} else {
				out.CommandsMore++
			}
		}
	}
	checkpoints, first := s.checkpoints()
	checkpoint := checkpoints[entry]
	if checkpoint == nil {
		return out, true
	}
	out.Checkpoint = true
	paths := make([]string, 0, len(first))
	for p := range first {
		paths = append(paths, p)
	}
	sort.Strings(paths)
	store := filepath.Join(home, ".pi", "agent", "file-history")
	for _, p := range paths {
		v, ok := checkpoint.files[p]
		if !ok && checkpoint.unavailable[p] {
			// Not copied then: a restore leaves it, so it is no change.
			out.FileErrors++
			continue
		}
		if !ok {
			v = first[p]
		}
		file := p
		if !filepath.IsAbs(file) {
			file = filepath.Join(checkpoint.cwd, p)
		}
		change, added, deleted, err := rewindCompare(file, v, store)
		if err != nil {
			out.FileErrors++
			continue
		}
		if change == "" {
			continue
		}
		if len(out.Files) >= maxRewindFiles {
			out.FilesMore++
			continue
		}
		out.Files = append(out.Files, rewindFile{Path: rewindDisplayPath(home, checkpoint.cwd, p), Change: change, Additions: added, Deletions: deleted})
	}
	return out, true
}

// rewindDisplayPath names a file as the person knows it: relative to the
// workspace, or under ~ for the rest of the home. The wire carries no home
// path.
func rewindDisplayPath(home, cwd, path string) string {
	if !filepath.IsAbs(path) {
		return path
	}
	if rel, err := filepath.Rel(home, path); err == nil && rel != ".." && !strings.HasPrefix(rel, "../") {
		return "~/" + rel
	}
	return path
}

// rewindCompare says how a restore would change file: "" when it already
// matches its copy, "modified", "created" (the agent created it; a restore
// removes it) or "deleted" (it is gone; a restore brings it back). The line
// counts are what the agent's continuation added and removed.
func rewindCompare(file string, v rewindVersion, store string) (string, *int, *int, error) {
	if !v.valid() {
		return "", nil, nil, errors.New("invalid copy")
	}
	info, err := os.Lstat(file)
	missing := errors.Is(err, os.ErrNotExist)
	if err != nil && !missing {
		return "", nil, nil, err
	}
	if !missing && !info.Mode().IsRegular() {
		return "", nil, nil, errors.New("not a regular file")
	}
	if v.BackupFileName == nil {
		if missing {
			return "", nil, nil, nil
		}
		now, ok := readRewindText(file, info.Size())
		if !ok {
			return "created", nil, nil, nil
		}
		added, deleted := countLineChanges("", now)
		return "created", added, deleted, nil
	}
	copyPath := filepath.Join(store, v.StoreID, *v.BackupFileName)
	copyInfo, err := os.Lstat(copyPath)
	if err != nil || !copyInfo.Mode().IsRegular() {
		return "", nil, nil, errors.New("copy missing")
	}
	if missing {
		was, ok := readRewindText(copyPath, copyInfo.Size())
		if !ok {
			return "deleted", nil, nil, nil
		}
		added, deleted := countLineChanges(was, "")
		return "deleted", added, deleted, nil
	}
	if info.Size() == copyInfo.Size() && (v.Mode == nil || int64(unixMode(info)) == *v.Mode&0o7777) {
		a, errA := hashRewindFile(file)
		b, errB := hashRewindFile(copyPath)
		if errA != nil || errB != nil {
			return "", nil, nil, errors.New("unreadable")
		}
		if a == b {
			return "", nil, nil, nil
		}
	}
	was, okWas := readRewindText(copyPath, copyInfo.Size())
	now, okNow := readRewindText(file, info.Size())
	if !okWas || !okNow {
		return "modified", nil, nil, nil
	}
	added, deleted := countLineChanges(was, now)
	return "modified", added, deleted, nil
}

func unixMode(info os.FileInfo) uint32 {
	mode := uint32(info.Mode().Perm())
	if info.Mode()&os.ModeSetuid != 0 {
		mode |= 0o4000
	}
	if info.Mode()&os.ModeSetgid != 0 {
		mode |= 0o2000
	}
	if info.Mode()&os.ModeSticky != 0 {
		mode |= 0o1000
	}
	return mode
}

func hashRewindFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func readRewindText(path string, size int64) (string, bool) {
	if size > maxRewindDiffBytes {
		return "", false
	}
	f, err := os.Open(path)
	if err != nil {
		return "", false
	}
	defer f.Close()
	b, err := io.ReadAll(io.LimitReader(f, maxRewindDiffBytes+1))
	if err != nil || len(b) > maxRewindDiffBytes || !utf8.Valid(b) || bytes.IndexByte(b, 0) >= 0 {
		return "", false
	}
	return string(b), true
}

// countLineChanges is better-pi-rewind's Myers line count (MIT, see
// rewind-extension.mjs), bounded: a file with too many lines or edits gets
// no count rather than a long computation.
func countLineChanges(before, after string) (*int, *int) {
	lines := func(s string) []string {
		if s == "" {
			return nil
		}
		l := strings.Split(strings.ReplaceAll(s, "\r\n", "\n"), "\n")
		if l[len(l)-1] == "" {
			l = l[:len(l)-1]
		}
		return l
	}
	a, b := lines(before), lines(after)
	if len(a) > maxRewindDiffLines || len(b) > maxRewindDiffLines {
		return nil, nil
	}
	n, m := len(a), len(b)
	if n == 0 && m == 0 {
		zero := 0
		return &zero, &zero
	}
	max := n + m
	if max > maxRewindDiffEdits {
		max = maxRewindDiffEdits
	}
	v := make([]int, 2*max+2)
	off := max + 1
	for d := 0; d <= max; d++ {
		for k := -d; k <= d; k += 2 {
			var x int
			if k == -d || (k != d && v[off+k-1] < v[off+k+1]) {
				x = v[off+k+1]
			} else {
				x = v[off+k-1] + 1
			}
			y := x - k
			for x < n && y < m && a[x] == b[y] {
				x++
				y++
			}
			v[off+k] = x
			if x >= n && y >= m {
				added, deleted := (d+m-n)/2, (d+n-m)/2
				return &added, &deleted
			}
		}
	}
	return nil, nil
}

// replaced returns the entries of the continuation a marker on the active
// branch left behind, oldest first: from its first own entry to its leaf.
func (s *rewindSession) replaced(marker string) ([]rewindLine, bool, bool) {
	active, ok := s.branch(s.leaf)
	if !ok {
		return nil, false, false
	}
	onActive := map[string]bool{}
	var data *rewindMarkerData
	for _, l := range active {
		onActive[l.id] = true
		if l.id == marker && l.marker != nil {
			data = l.marker
		}
	}
	if data == nil || (data.Action != "rewind" && data.Action != "switch") || !entryIDPattern.MatchString(data.Left) {
		return nil, false, true
	}
	left, ok := s.branch(data.Left)
	if !ok {
		return nil, false, false
	}
	// The continuation is what the active branch does not share; the
	// marker itself sits after the branch point on the active side.
	start := 0
	for start < len(left) && onActive[left[start].id] {
		start++
	}
	return left[start:], true, true
}

// readReplacedEntries projects the replaced continuation through the same
// bounded projection as history pages. Only the lines on it are decoded.
func readReplacedEntries(s *rewindSession, uid int, lines []rewindLine) ([]historyEntry, bool, bool) {
	complete := true
	if len(lines) > maxRewindBranchEntries*4 {
		lines, complete = lines[len(lines)-maxRewindBranchEntries*4:], false
	}
	f, err := os.Open(s.path)
	if err != nil {
		return nil, false, false
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || (uid >= 0 && func() bool { owner, ok := fileOwner(info); return !ok || owner != uid }()) {
		return nil, false, false
	}
	entries := []historyEntry{}
	for _, l := range lines {
		if _, err := f.Seek(l.offset, io.SeekStart); err != nil {
			return nil, false, false
		}
		line, err := bufio.NewReaderSize(io.LimitReader(f, 64<<20+1), 64<<10).ReadBytes('\n')
		if err != nil || len(line) > 64<<20 {
			return nil, false, false
		}
		var full nativeEntry
		if json.Unmarshal(line, &full) != nil || full.ID != l.id {
			return nil, false, false
		}
		full.Raw = bytes.TrimSuffix(line, []byte{'\n'})
		entry := nativeBlocks(full)
		if entry.Kind == "" || entry.Kind == "rewind" {
			continue
		}
		inline(nil, &entry)
		entries = append(entries, entry)
	}
	if len(entries) > maxRewindBranchEntries {
		entries, complete = entries[len(entries)-maxRewindBranchEntries:], false
	}
	return entries, complete, true
}

func (c *ConversationController) rewindSource(id string) (*rewindSession, bool) {
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		return nil, false
	}
	var selected *nativeSession
	for i := range sessions {
		if sessions[i].id != id {
			continue
		}
		if selected != nil || sessions[i].state != "readable" {
			return nil, false
		}
		selected = &sessions[i]
	}
	if selected == nil {
		return nil, false
	}
	s, ok := readRewindSession(selected.path, c.cfg.UID)
	if !ok {
		// Pi can append between the stat and the read; one retry.
		s, ok = readRewindSession(selected.path, c.cfg.UID)
	}
	return s, ok
}

// rewindRead answers the two reads: ?entry= is a preview before the
// confirmation, ?branch= the continuation a marker replaced. Neither starts
// Pi or writes anything.
func (c *ConversationController) rewindRead(w http.ResponseWriter, r *http.Request, id string) {
	q := r.URL.Query()
	if r.ContentLength > 0 || len(r.TransferEncoding) != 0 || len(q) != 1 {
		snapshotError(w, 400, "invalid_request")
		return
	}
	s, ok := c.rewindSource(id)
	if !ok {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	if entry := q.Get("entry"); entry != "" {
		preview, ok := s.preview(c.home, entry)
		if !ok {
			snapshotError(w, 404, "resource_not_found")
			return
		}
		preview.AgentID = "pi:" + id
		historyJSON(w, preview)
		return
	}
	lines, ok, readable := s.replaced(q.Get("branch"))
	if !readable {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	if !ok {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	entries, complete, ok := readReplacedEntries(s, c.cfg.UID, lines)
	if !ok {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	historyJSON(w, map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "marker_key": q.Get("branch"), "entries": entries, "complete": complete})
}

// The extension's answer to one /oh-rewind, kept out of the live stream like
// the recap's.
type rewindOutcome struct {
	Outcome  string `json:"outcome"`
	Restored int    `json:"restored"`
	Errors   int    `json:"errors"`
	Detail   string `json:"detail"`
}

var rewindRefusals = map[string]int{
	"turn_running":   409,
	"queued":         409,
	"busy":           409,
	"not_found":      404,
	"no_checkpoint":  409,
	"not_switchable": 409,
	"already_undone": 409,
	"cancelled":      409,
}

func (p *piRPC) noteRewindOutcome(frame json.RawMessage) bool {
	var request struct {
		Method  string `json:"method"`
		Message string `json:"message"`
	}
	if json.Unmarshal(frame, &request) != nil || request.Method != "notify" || !strings.HasPrefix(request.Message, rewindOutcomePrefix) {
		return false
	}
	var note rewindOutcome
	if len(request.Message) > 4096 || json.Unmarshal([]byte(strings.TrimPrefix(request.Message, rewindOutcomePrefix)), &note) != nil {
		note = rewindOutcome{Outcome: "outcome_unknown"}
	}
	if _, refused := rewindRefusals[note.Outcome]; !refused && note.Outcome != "done" && note.Outcome != "failed" && note.Outcome != "invalid" {
		note.Outcome = "outcome_unknown"
	}
	note.Detail = prefixBytes(strings.ToValidUTF8(note.Detail, ""), 200)
	p.recapMu.Lock()
	p.rewindNote = &note
	p.recapMu.Unlock()
	return true
}

func (p *piRPC) takeRewindOutcome() *rewindOutcome {
	p.recapMu.Lock()
	defer p.recapMu.Unlock()
	note := p.rewindNote
	p.rewindNote = nil
	return note
}

// rewind asks the conversation's running Pi to go back. The person chose
// what: the conversation, the files or both before one of their messages,
// the continuation a rewind replaced, or undoing a files-only restore. A
// stopped conversation is woken by the browser first, as a send would be.
func (c *ConversationController) rewind(w http.ResponseWriter, r *http.Request, id string) {
	var body struct {
		Action       string `json:"action"`
		EntryKey     string `json:"entry_key"`
		MarkerKey    string `json:"marker_key"`
		Conversation bool   `json:"conversation"`
		Files        bool   `json:"files"`
		Stop         bool   `json:"stop"`
	}
	if decodeControl(r, &body, 1024) != nil {
		snapshotError(w, 400, "invalid_request")
		return
	}
	command := map[string]any{"action": body.Action, "stop": body.Stop}
	switch body.Action {
	case "rewind":
		if !entryIDPattern.MatchString(body.EntryKey) || body.MarkerKey != "" || (!body.Conversation && !body.Files) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		command["entry"], command["conversation"], command["files"] = body.EntryKey, body.Conversation, body.Files
	case "switch", "undo":
		if !entryIDPattern.MatchString(body.MarkerKey) || body.EntryKey != "" || body.Conversation || (body.Action == "undo" && body.Files) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		command["marker"] = body.MarkerKey
		if body.Action == "switch" {
			command["files"] = body.Files
		}
	default:
		snapshotError(w, 400, "invalid_request")
		return
	}
	c.mu.Lock()
	s := c.sessions[id]
	if s == nil {
		c.mu.Unlock()
		snapshotError(w, 404, "resource_not_found")
		return
	}
	if c.closed || s.dead || s.state == "stopping" || s.state == "uncertain" || s.rewinding || s.recapping || s.rpc.overflow.Load() {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	if !recapIdle(s) && !body.Stop {
		c.mu.Unlock()
		snapshotError(w, 409, "turn_running")
		return
	}
	s.rewinding = true
	c.mu.Unlock()
	defer func() {
		c.mu.Lock()
		s.rewinding = false
		if c.journal != nil {
			c.journal.appendInvalidation("pi:" + id)
		}
		c.mu.Unlock()
	}()
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(45 * time.Second))
	commands, err := s.rpc.requestQueue("get_commands", "", 4*time.Second)
	if err != nil || !commands.Accepted || !hasExtensionCommand(commands.Commands, "oh-rewind") {
		snapshotError(w, 503, "command_unavailable")
		return
	}
	args, _ := json.Marshal(command)
	_ = s.rpc.takeRewindOutcome()
	// The longest request the RPC channel takes. A lost answer is
	// uncertain, never repeated.
	accepted, err := s.rpc.request("prompt", "/oh-rewind "+string(args), 30*time.Second)
	log := diagnostic.New(os.Stderr, "daemon")
	if err != nil || !accepted {
		log.Warn("conversation_rewind", "outcome", "uncertain", "action", body.Action, "agent_id", "pi:"+id)
		snapshotError(w, 503, "control_uncertain")
		return
	}
	note := s.rpc.takeRewindOutcome()
	if note == nil {
		note = &rewindOutcome{Outcome: "outcome_unknown"}
	}
	if status, refused := rewindRefusals[note.Outcome]; refused {
		snapshotError(w, status, note.Outcome)
		return
	}
	if note.Outcome != "done" {
		log.Warn("conversation_rewind", "outcome", "failed", "reason", note.Outcome, "detail", note.Detail, "action", body.Action, "agent_id", "pi:"+id)
		snapshotError(w, 503, "control_uncertain")
		return
	}
	log.Info("conversation_rewind", "outcome", "done", "action", body.Action, "agent_id", "pi:"+id)
	historyJSON(w, map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "action": body.Action, "state": "done", "restored": note.Restored, "file_errors": note.Errors})
}

func hasExtensionCommand(commands []piCommand, name string) bool {
	for _, command := range commands {
		if command.Name == name && command.Source == "extension" {
			return true
		}
	}
	return false
}

// rewindQuery is the reads' exact query grammar: one entry or one branch key.
func rewindQuery(q map[string][]string) bool {
	if len(q) != 1 {
		return false
	}
	for key, values := range q {
		return (key == "entry" || key == "branch") && len(values) == 1 && entryIDPattern.MatchString(values[0])
	}
	return false
}
