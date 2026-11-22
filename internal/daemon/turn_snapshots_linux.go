//go:build linux

package daemon

import (
	"bytes"
	"context"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"hash"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Turn snapshots, read side. The recorder (turn-snapshots/extensions/
// snapshots.ts, loaded into the person's Pi) records the working tree at the
// start and settle of every run in the conversation's private Git store and
// appends a turn-snapshot entry per boundary. The daemon reads those entries
// and asks Git to compare the recorded trees, as the person and only in the
// store; it never writes the store, the session or workspace files. A turn
// without entries (recorded before the recorder, or with the switch off) is
// answered "no snapshot" and the browser keeps its tool-call reading.

const (
	turnSnapshotType = "turn-snapshot"
	// How much one read may return and spend.
	maxTurnFiles      = 300
	maxTurnSkipped    = 50
	maxTurnDiffBytes  = 256 << 10
	turnSnapshotLimit = 5 * time.Second
)

var gitObjectID = regexp.MustCompile(`^(?:[0-9a-f]{40}|[0-9a-f]{64})$`)

// turnSnapshotRecord is the recorder's v1 entry as better-pi-rewind's
// isTurnSnapshotRecord accepts it.
type turnSnapshotRecord struct {
	Version     int     `json:"version"`
	UserEntryID string  `json:"userEntryId"`
	Phase       string  `json:"phase"`
	Tree        *string `json:"tree"`
	Store       string  `json:"store"`
	Root        *string `json:"root"`
	Cwd         string  `json:"cwd"`
	Timestamp   string  `json:"timestamp"`
	Skipped     *struct {
		Count int `json:"count"`
		Paths []struct {
			Path   string `json:"path"`
			Reason string `json:"reason"`
		} `json:"paths"`
		Truncated bool `json:"truncated"`
	} `json:"skipped"`
}

func (r *turnSnapshotRecord) valid() bool {
	safe := func(s string) bool { return s != "." && s != ".." && rewindSafeName.MatchString(s) }
	if r.Version != 1 || !entryIDPattern.MatchString(r.UserEntryID) || (r.Phase != "start" && r.Phase != "end") || !safe(r.Store) || !filepath.IsAbs(r.Cwd) || r.Skipped == nil || r.Skipped.Count < 0 {
		return false
	}
	if r.Tree != nil && (!gitObjectID.MatchString(*r.Tree) || r.Root == nil) {
		return false
	}
	return r.Root == nil || filepath.IsAbs(*r.Root)
}

func (r *turnSnapshotRecord) tree() string {
	if r == nil || r.Tree == nil {
		return ""
	}
	return *r.Tree
}

func decodeTurnSnapshot(data json.RawMessage) *turnSnapshotRecord {
	var r turnSnapshotRecord
	if json.Unmarshal(data, &r) != nil || !r.valid() {
		return nil
	}
	return &r
}

// snapshotTurn is one run's agent window: its start, and its end or, when
// the run was steered or never settled, the next run's start (better-pi-
// rewind's listTurns).
type snapshotTurn struct {
	start, end *turnSnapshotRecord
	settled    bool
}

func listSnapshotTurns(records []*turnSnapshotRecord) []*snapshotTurn {
	var turns []*snapshotTurn
	var open *snapshotTurn
	for _, r := range records {
		if r.Phase == "start" {
			if open != nil && open.end == nil {
				open.end = r
			}
			open = &snapshotTurn{start: r}
			turns = append(turns, open)
		} else if open != nil && !open.settled && r.UserEntryID == open.start.UserEntryID {
			open.end, open.settled = r, true
		}
	}
	return turns
}

// comparable says the window's two trees are in one store and describe one
// root, so Git can compare them.
func (t *snapshotTurn) comparable() bool {
	return t.end != nil && t.start.tree() != "" && t.end.tree() != "" && t.start.Store == t.end.Store && *t.start.Root == *t.end.Root
}

// readTurnSnapshots reads only the turn-snapshot entries of a native file, in
// file order: a cheap pass for the turn-changes read, which is asked once per
// turn the person scrolls to.
func readTurnSnapshots(path string, uid int) ([]*turnSnapshotRecord, bool) {
	info, err := os.Lstat(path)
	if err != nil || !info.Mode().IsRegular() {
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
	marker := []byte(`"` + turnSnapshotType + `"`)
	var records []*turnSnapshotRecord
	_, err = eachNativeLine(io.LimitReader(f, info.Size()), func(line []byte) bool {
		if !bytes.Contains(line, marker) {
			return true
		}
		var e struct {
			Type       string          `json:"type"`
			CustomType string          `json:"customType"`
			Data       json.RawMessage `json:"data"`
		}
		if json.Unmarshal(line, &e) == nil && e.Type == "custom" && e.CustomType == turnSnapshotType {
			if r := decodeTurnSnapshot(e.Data); r != nil {
				records = append(records, r)
			}
		}
		return true
	})
	return records, err == nil
}

// snapshotStore is the store directory of a record, checked to be the
// person's own directory and not a link.
func snapshotStore(home string, uid int, store string) (string, bool) {
	dir := filepath.Join(home, ".pi", "agent", "file-history", store, "tree.git")
	info, err := os.Lstat(dir)
	if err != nil || !info.IsDir() {
		return "", false
	}
	if uid >= 0 {
		if owner, ok := fileOwner(info); !ok || owner != uid {
			return "", false
		}
	}
	return dir, true
}

// storeGit runs a read-only Git command in a snapshot store, as the person,
// with no system, global or workspace configuration and literal pathspecs.
func storeGit(ctx context.Context, store, input string, args ...string) ([]byte, error) {
	base := []string{"--git-dir=" + store, "--no-replace-objects", "--literal-pathspecs", "-c", "core.fsmonitor=false", "-c", "core.quotePath=false", "-c", "core.attributesFile=/dev/null"}
	var stderr bytes.Buffer
	out, err := nativeCommandEnv(ctx, turnSnapshotLimit, &stderr, input, []string{"GIT_NO_LAZY_FETCH=1", "GIT_ATTR_NOSYSTEM=1"}, "/usr/bin/git", store, "", append(base, args...)...)
	if err != nil {
		return out, fmt.Errorf("git %s: %w", args[0], err)
	}
	return out, nil
}

type snapshotChange struct {
	Path, OldPath, Status string
	Additions, Deletions  *int
}

func splitNUL(out []byte) []string {
	fields := strings.Split(string(out), "\x00")
	if len(fields) > 0 && fields[len(fields)-1] == "" {
		fields = fields[:len(fields)-1]
	}
	return fields
}

var snapshotStatus = map[byte]string{'A': "added", 'M': "modified", 'D': "deleted", 'R': "renamed", 'C': "copied", 'T': "type_changed"}

// compareSnapshotTrees lists what changed between two trees of a store, with
// rename detection and line counts (null for binary files).
func compareSnapshotTrees(ctx context.Context, store, from, to string) ([]snapshotChange, error) {
	names, err := storeGit(ctx, store, "", "diff-tree", "-r", "-M", "-z", "--no-ext-diff", "--name-status", from, to)
	if err != nil {
		return nil, err
	}
	counts, err := storeGit(ctx, store, "", "diff-tree", "-r", "-M", "-z", "--no-ext-diff", "--numstat", from, to)
	if err != nil {
		return nil, err
	}
	byPath := map[string][2]*int{}
	fields := splitNUL(counts)
	for i := 0; i < len(fields); i++ {
		parts := strings.SplitN(fields[i], "\t", 3)
		if len(parts) != 3 {
			continue
		}
		path := parts[2]
		if path == "" && i+2 < len(fields) {
			// A rename: the old and the new path follow.
			path = fields[i+2]
			i += 2
		}
		var pair [2]*int
		if a, err := strconv.Atoi(parts[0]); err == nil {
			if d, err := strconv.Atoi(parts[1]); err == nil {
				pair = [2]*int{&a, &d}
			}
		}
		byPath[path] = pair
	}
	var changes []snapshotChange
	fields = splitNUL(names)
	for i := 0; i < len(fields); {
		letter := fields[i]
		i++
		status := ""
		if letter != "" {
			status = snapshotStatus[letter[0]]
		}
		c := snapshotChange{Status: status}
		if status == "renamed" || status == "copied" {
			if i+1 >= len(fields) {
				break
			}
			c.OldPath, c.Path = fields[i], fields[i+1]
			i += 2
		} else {
			if i >= len(fields) {
				break
			}
			c.Path = fields[i]
			i++
		}
		if status == "" {
			continue
		}
		pair := byPath[c.Path]
		c.Additions, c.Deletions = pair[0], pair[1]
		changes = append(changes, c)
	}
	return changes, nil
}

// workspacePath names a root-relative snapshot path as the browser names
// files: relative to the conversation's working directory when inside it,
// else under ~ or absolute.
func snapshotDisplayPath(home, root, cwd, path string) string {
	absolute := filepath.Join(root, filepath.FromSlash(path))
	if rel, err := filepath.Rel(cwd, absolute); err == nil && rel != ".." && !strings.HasPrefix(rel, "../") {
		return filepath.ToSlash(rel)
	}
	return rewindDisplayPath(home, cwd, absolute)
}

type turnChangeFile struct {
	Path      string `json:"path"`
	OldPath   string `json:"old_path,omitempty"`
	Change    string `json:"change"`
	Additions *int   `json:"additions,omitempty"`
	Deletions *int   `json:"deletions,omitempty"`
	Binary    bool   `json:"binary,omitempty"`
}

type turnChangesReply struct {
	SchemaVersion int              `json:"schema_version"`
	AgentID       string           `json:"agent_id"`
	EntryKey      string           `json:"entry_key"`
	Snapshot      bool             `json:"snapshot"`
	Settled       bool             `json:"settled"`
	Files         []turnChangeFile `json:"files"`
	FilesMore     int              `json:"files_more"`
	Skipped       []string         `json:"skipped"`
	SkippedMore   int              `json:"skipped_more"`
}

// snapshotTurnFor finds the agent window of the person's message entry.
func snapshotTurnFor(records []*turnSnapshotRecord, entry string) *snapshotTurn {
	for _, t := range listSnapshotTurns(records) {
		if t.start.UserEntryID == entry {
			return t
		}
	}
	return nil
}

// turnChanges answers ?turn=: the files the run of one message changed, from
// its two snapshots. snapshot is false when there is nothing to compare.
func (c *ConversationController) turnChanges(w http.ResponseWriter, path, id, entry, file string) {
	records, ok := readTurnSnapshots(path, c.cfg.UID)
	if !ok {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	reply := turnChangesReply{SchemaVersion: 1, AgentID: "pi:" + id, EntryKey: entry, Files: []turnChangeFile{}, Skipped: []string{}}
	t := snapshotTurnFor(records, entry)
	store := ""
	if t != nil && t.comparable() {
		store, ok = snapshotStore(c.home, c.cfg.UID, t.start.Store)
	}
	if store == "" || !ok {
		if file != "" {
			snapshotError(w, 404, "resource_not_found")
			return
		}
		historyJSON(w, reply)
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), turnSnapshotLimit)
	defer cancel()
	changes, err := compareSnapshotTrees(ctx, store, t.start.tree(), t.end.tree())
	if err != nil {
		// A store the sweep removed, or a tree Git cannot read: the turn has
		// no snapshot to show.
		if file != "" {
			snapshotError(w, 404, "resource_not_found")
			return
		}
		historyJSON(w, reply)
		return
	}
	root, cwd := *t.start.Root, t.start.Cwd
	if file != "" {
		for _, ch := range changes {
			if snapshotDisplayPath(c.home, root, cwd, ch.Path) != file {
				continue
			}
			paths := []string{ch.Path}
			if ch.OldPath != "" {
				paths = append(paths, ch.OldPath)
			}
			args := append([]string{"diff-tree", "-p", "-r", "-M", "--no-ext-diff", "--no-textconv", "--no-color", t.start.tree(), t.end.tree(), "--"}, paths...)
			out, err := storeGit(ctx, store, "", args...)
			truncated := false
			if err != nil {
				snapshotError(w, 503, "native_source_unavailable")
				return
			}
			if len(out) > maxTurnDiffBytes {
				out, truncated = out[:maxTurnDiffBytes], true
			}
			historyJSON(w, map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "entry_key": entry, "path": file, "diff": strings.ToValidUTF8(string(out), "�"), "truncated": truncated})
			return
		}
		snapshotError(w, 404, "resource_not_found")
		return
	}
	reply.Snapshot, reply.Settled = true, t.settled
	for _, ch := range changes {
		if len(reply.Files) >= maxTurnFiles {
			reply.FilesMore++
			continue
		}
		f := turnChangeFile{Path: snapshotDisplayPath(c.home, root, cwd, ch.Path), Change: ch.Status, Additions: ch.Additions, Deletions: ch.Deletions, Binary: ch.Additions == nil && ch.Status != "type_changed"}
		if ch.OldPath != "" {
			f.OldPath = snapshotDisplayPath(c.home, root, cwd, ch.OldPath)
		}
		reply.Files = append(reply.Files, f)
	}
	// What the snapshots could not record, by name: from either end.
	seen := map[string]bool{}
	for _, r := range []*turnSnapshotRecord{t.start, t.end} {
		for _, p := range r.Skipped.Paths {
			name := snapshotDisplayPath(c.home, root, cwd, p.Path)
			if p.Path == "" || seen[name] {
				continue
			}
			seen[name] = true
			if len(reply.Skipped) < maxTurnSkipped {
				reply.Skipped = append(reply.Skipped, name)
			} else {
				reply.SkippedMore++
			}
		}
		if extra := r.Skipped.Count - len(r.Skipped.Paths); extra > 0 {
			reply.SkippedMore += extra
		}
	}
	historyJSON(w, reply)
}

// snapshotPathsSince is better-pi-rewind's pathsChangedSince for the
// preview: the root-relative paths that changed in any agent window from the
// message's run onward, along the active branch. ok is false when the
// message has no start snapshot; complete is false when a window could not
// be compared (a run still open, a missing tree).
func snapshotPathsSince(ctx context.Context, home string, uid int, records []*turnSnapshotRecord, entry string) (start *turnSnapshotRecord, paths []string, complete, ok bool) {
	turns := listSnapshotTurns(records)
	first := -1
	for i, t := range turns {
		if t.start.UserEntryID == entry {
			first = i
			break
		}
	}
	if first < 0 || turns[first].start.tree() == "" {
		return nil, nil, false, false
	}
	start = turns[first].start
	set := map[string]bool{}
	complete = true
	for i, t := range turns[first:] {
		if t.end == nil && i == len(turns[first:])-1 && t.start.tree() != "" && *t.start.Root == *start.Root {
			// The last run is still open (running, or Pi stopped before it
			// settled): its window reaches the files as they are now.
			if store, ok := snapshotStore(home, uid, t.start.Store); ok {
				if changed, err := snapshotChangedNow(ctx, store, *t.start.Root, t.start.tree()); err == nil {
					for _, p := range changed {
						set[p] = true
					}
					// Files created in it that no snapshot has seen are not
					// listed (Git cannot name them without the workspace's
					// exclude rules); the restore removes them.
					complete = false
					continue
				}
			}
		}
		if !t.comparable() || *t.start.Root != *start.Root {
			complete = false
			continue
		}
		store, ok := snapshotStore(home, uid, t.start.Store)
		if !ok {
			complete = false
			continue
		}
		changes, err := compareSnapshotTrees(ctx, store, t.start.tree(), t.end.tree())
		if err != nil {
			complete = false
			continue
		}
		for _, ch := range changes {
			set[ch.Path] = true
			if ch.OldPath != "" {
				set[ch.OldPath] = true
			}
		}
	}
	for p := range set {
		paths = append(paths, p)
	}
	sort.Strings(paths)
	return start, paths, complete, true
}

type snapshotEntry struct {
	mode, kind, object string
}

// lsSnapshotTree reads the tree entries of paths (root-relative).
func lsSnapshotTree(ctx context.Context, store, tree string, paths []string) (map[string]snapshotEntry, error) {
	entries := map[string]snapshotEntry{}
	for i := 0; i < len(paths); i += 200 {
		chunk := paths[i:min(i+200, len(paths))]
		out, err := storeGit(ctx, store, "", append([]string{"ls-tree", "-z", "--full-tree", tree, "--"}, chunk...)...)
		if err != nil {
			return nil, err
		}
		for _, rec := range splitNUL(out) {
			tab := strings.IndexByte(rec, '\t')
			if tab < 0 {
				continue
			}
			parts := strings.Fields(rec[:tab])
			if len(parts) == 3 {
				entries[rec[tab+1:]] = snapshotEntry{mode: parts[0], kind: parts[1], object: parts[2]}
			}
		}
	}
	return entries, nil
}

// gitBlobID is the object id Git gives a file's raw bytes, so a file is
// compared with a recorded blob without reading the blob.
func gitBlobID(path string, size int64, sha256Format bool) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	var h hash.Hash
	if sha256Format {
		h = sha256.New()
	} else {
		h = sha1.New()
	}
	fmt.Fprintf(h, "blob %d\x00", size)
	if _, err := io.Copy(h, io.LimitReader(f, size)); err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", h.Sum(nil)), nil
}

func snapshotBlob(ctx context.Context, store, object string, size int64) (string, bool) {
	if size > maxRewindDiffBytes {
		return "", false
	}
	out, err := storeGit(ctx, store, "", "cat-file", "blob", object)
	if err != nil || !utf8Text(out) {
		return "", false
	}
	return string(out), true
}

func utf8Text(b []byte) bool {
	return len(b) <= maxRewindDiffBytes && bytes.IndexByte(b, 0) < 0 && strings.ToValidUTF8(string(b), "") == string(b)
}

// compareSnapshotFile says how restoring a path to its entry in the start
// tree would change the file as it is now, as rewindCompare does for a copy.
// Bytes are compared raw: a repository whose checkout converts line endings
// can show a file the restore then leaves unchanged.
func compareSnapshotFile(ctx context.Context, store, absolute string, entry *snapshotEntry, sha256Format bool) (string, *int, *int, error) {
	info, err := os.Lstat(absolute)
	missing := errors.Is(err, os.ErrNotExist)
	if err != nil && !missing {
		return "", nil, nil, err
	}
	if entry == nil {
		if missing {
			return "", nil, nil, nil
		}
		if !info.Mode().IsRegular() {
			return "created", nil, nil, nil
		}
		now, ok := readRewindText(absolute, info.Size())
		if !ok {
			return "created", nil, nil, nil
		}
		added, deleted := countLineChanges("", now)
		return "created", added, deleted, nil
	}
	regular := entry.kind == "blob" && (entry.mode == "100644" || entry.mode == "100755")
	if missing {
		if !regular {
			return "deleted", nil, nil, nil
		}
		size, _ := blobSize(ctx, store, entry.object)
		was, ok := snapshotBlob(ctx, store, entry.object, size)
		if !ok {
			return "deleted", nil, nil, nil
		}
		added, deleted := countLineChanges(was, "")
		return "deleted", added, deleted, nil
	}
	if !regular || !info.Mode().IsRegular() {
		if entry.kind == "blob" && entry.mode == "120000" && info.Mode()&os.ModeSymlink != 0 {
			target, err := os.Readlink(absolute)
			if err == nil {
				if id, err := gitBlobBytes([]byte(target), sha256Format); err == nil && id == entry.object {
					return "", nil, nil, nil
				}
			}
		}
		return "modified", nil, nil, nil
	}
	id, err := gitBlobID(absolute, info.Size(), sha256Format)
	if err != nil {
		return "", nil, nil, err
	}
	executable := info.Mode().Perm()&0o100 != 0
	if id == entry.object && executable == (entry.mode == "100755") {
		return "", nil, nil, nil
	}
	size, _ := blobSize(ctx, store, entry.object)
	was, okWas := snapshotBlob(ctx, store, entry.object, size)
	now, okNow := readRewindText(absolute, info.Size())
	if !okWas || !okNow {
		return "modified", nil, nil, nil
	}
	added, deleted := countLineChanges(was, now)
	return "modified", added, deleted, nil
}

func gitBlobBytes(b []byte, sha256Format bool) (string, error) {
	var h hash.Hash
	if sha256Format {
		h = sha256.New()
	} else {
		h = sha1.New()
	}
	fmt.Fprintf(h, "blob %d\x00", len(b))
	h.Write(b)
	return fmt.Sprintf("%x", h.Sum(nil)), nil
}

func blobSize(ctx context.Context, store, object string) (int64, error) {
	out, err := storeGit(ctx, store, "", "cat-file", "-s", object)
	if err != nil {
		return 0, err
	}
	return strconv.ParseInt(strings.TrimSpace(string(out)), 10, 64)
}

// snapshotChangedNow names the root-relative paths that differ between a
// recorded tree and the files now, as far as the store's index knows them:
// changed and removed files, and files a later snapshot added. Git only reads
// here: the index is used as its stat cache and, with optional locks off,
// never refreshed.
func snapshotChangedNow(ctx context.Context, store, root, tree string) ([]string, error) {
	out, err := storeGit(ctx, store, "", "--work-tree="+root, "diff-index", "-z", "--name-only", "--no-renames", "--ignore-submodules=all", tree, "--")
	if err != nil {
		return nil, err
	}
	return splitNUL(out), nil
}
