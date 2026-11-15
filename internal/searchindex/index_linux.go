//go:build linux

// Package searchindex is the person's conversation search index (ADR 0036):
// a derived SQLite FTS5 file over the words the person and their agent said
// in Pi's native histories. It is a cache of those files and nothing else.
// Deleting it loses nothing, and any doubt about it (an unknown schema, a
// failed read) is answered by deleting it and building it again. The package
// holds no authority: its caller, the person's daemon, decides which session
// files exist and opens them as the person.
package searchindex

import (
	"bufio"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"

	_ "modernc.org/sqlite"
)

// schemaVersion is PRAGMA user_version. A file with another version is
// deleted and rebuilt, never migrated: it is a cache.
const schemaVersion = 1

const schema = `
CREATE TABLE files (
  session TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  dev INTEGER NOT NULL,
  ino INTEGER NOT NULL,
  size INTEGER NOT NULL,
  mtime INTEGER NOT NULL,
  offset INTEGER NOT NULL,
  leaf TEXT NOT NULL
);
CREATE VIRTUAL TABLE messages USING fts5(
  text,
  session UNINDEXED,
  entry UNINDEXED,
  role UNINDEXED,
  at UNINDEXED,
  tokenize = 'trigram'
);
`

// Session is one native session file the caller found for the person.
type Session struct {
	// ID is the native session id (the agent id without "pi:").
	ID   string
	Path string
	// Changed orders the first build: the newest conversation is indexed
	// first, so a search answers from recent work while the rest builds.
	Changed time.Time
}

// Opener opens one session file as the person, refusing anything the
// person's daemon would not read as their history (another owner, a link).
type Opener func(path string) (*os.File, os.FileInfo, bool)

// Index is one person's open index. Its methods are safe for concurrent use;
// the build releases the lock between conversations so searches interleave.
type Index struct {
	mu      sync.Mutex
	db      *sql.DB
	open    Opener
	maxLine int

	progress sync.Mutex
	indexed  int
	total    int
	building bool
}

// Open opens or creates the index file at path with mode 0600. A file it
// cannot use is removed and created again.
func Open(path string, open Opener, maxLine int) (*Index, error) {
	x, err := openFile(path, open, maxLine)
	if err == nil {
		return x, nil
	}
	if rmErr := Remove(path); rmErr != nil {
		return nil, err
	}
	return openFile(path, open, maxLine)
}

// Remove deletes the index file and SQLite's companions beside it.
func Remove(path string) error {
	var first error
	for _, p := range []string{path, path + "-journal", path + "-wal", path + "-shm"} {
		if err := os.Remove(p); err != nil && !errors.Is(err, os.ErrNotExist) && first == nil {
			first = err
		}
	}
	return first
}

func openFile(path string, open Opener, maxLine int) (*Index, error) {
	// Create the file ourselves so it is 0600 from its first byte; SQLite
	// gives its journal the database file's mode.
	f, err := os.OpenFile(path, os.O_RDWR|os.O_CREATE|syscall.O_NOFOLLOW, 0o600)
	if err != nil {
		return nil, err
	}
	info, err := f.Stat()
	f.Close()
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() || info.Mode().Perm()&0o077 != 0 {
		return nil, errors.New("index file not private")
	}
	db, err := sql.Open("sqlite", "file:"+path+"?_pragma=busy_timeout(5000)&_pragma=journal_mode(DELETE)&_pragma=synchronous(OFF)")
	if err != nil {
		return nil, err
	}
	// One connection: the index has one writer and its readers share it
	// under the lock, which keeps SQLite's own locking out of the picture.
	db.SetMaxOpenConns(1)
	var version int
	if err := db.QueryRow("PRAGMA user_version").Scan(&version); err != nil {
		db.Close()
		return nil, err
	}
	if version != schemaVersion {
		var tables int
		if err := db.QueryRow("SELECT count(*) FROM sqlite_master").Scan(&tables); err != nil {
			db.Close()
			return nil, err
		}
		if tables != 0 {
			db.Close()
			return nil, errors.New("index schema differs")
		}
		if _, err := db.Exec(schema + fmt.Sprintf("PRAGMA user_version = %d;", schemaVersion)); err != nil {
			db.Close()
			return nil, err
		}
	}
	return &Index{db: db, open: open, maxLine: maxLine}, nil
}

// Close closes the database.
func (x *Index) Close() error { return x.db.Close() }

// Progress says how many of the conversations seen by the latest sync are
// indexed, and whether a sync is still running.
func (x *Index) Progress() (indexed, total int, building bool) {
	x.progress.Lock()
	defer x.progress.Unlock()
	return x.indexed, x.total, x.building
}

type fileRow struct {
	path               string
	dev, ino           uint64
	size, mtime, start int64
	leaf               string
}

// Sync brings the index in line with sessions: files no longer listed are
// forgotten, new and grown files are read from where the index stopped, and a
// file that was replaced, shrank or branched is read again whole. Sessions
// are taken newest first, one transaction each.
func (x *Index) Sync(ctx context.Context, sessions []Session) error {
	ordered := append([]Session(nil), sessions...)
	sort.SliceStable(ordered, func(i, j int) bool { return ordered[i].Changed.After(ordered[j].Changed) })
	x.progress.Lock()
	x.indexed, x.total, x.building = 0, len(ordered), true
	x.progress.Unlock()
	defer func() {
		x.progress.Lock()
		x.building = false
		x.progress.Unlock()
	}()
	if err := x.forget(ordered); err != nil {
		return err
	}
	for _, s := range ordered {
		if err := ctx.Err(); err != nil {
			return err
		}
		if err := x.syncOne(s); err != nil {
			return err
		}
		x.progress.Lock()
		x.indexed++
		x.progress.Unlock()
	}
	return nil
}

func (x *Index) forget(sessions []Session) error {
	x.mu.Lock()
	defer x.mu.Unlock()
	listed := make(map[string]bool, len(sessions))
	for _, s := range sessions {
		listed[s.ID] = true
	}
	rows, err := x.db.Query("SELECT session FROM files")
	if err != nil {
		return err
	}
	var gone []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		if !listed[id] {
			gone = append(gone, id)
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	for _, id := range gone {
		if err := x.dropSession(x.db, id); err != nil {
			return err
		}
	}
	return nil
}

type execer interface {
	Exec(query string, args ...any) (sql.Result, error)
}

func (x *Index) dropSession(db execer, id string) error {
	if _, err := db.Exec("DELETE FROM messages WHERE session = ?", id); err != nil {
		return err
	}
	_, err := db.Exec("DELETE FROM files WHERE session = ?", id)
	return err
}

func (x *Index) syncOne(s Session) error {
	f, info, ok := x.open(s.Path)
	if !ok {
		// Unreadable now: keep what was indexed. Discovery decides when a
		// conversation is gone; a passing failure must not empty search.
		return nil
	}
	defer f.Close()
	st, _ := info.Sys().(*syscall.Stat_t)
	if st == nil {
		return nil
	}
	cur := fileRow{path: s.Path, dev: uint64(st.Dev), ino: st.Ino, size: info.Size(), mtime: info.ModTime().UnixNano()}
	x.mu.Lock()
	defer x.mu.Unlock()
	var old fileRow
	err := x.db.QueryRow("SELECT path, dev, ino, size, mtime, offset, leaf FROM files WHERE session = ?", s.ID).Scan(&old.path, &old.dev, &old.ino, &old.size, &old.mtime, &old.start, &old.leaf)
	known := err == nil
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if known && old.path == cur.path && old.dev == cur.dev && old.ino == cur.ino && old.size == cur.size && old.mtime == cur.mtime {
		return nil
	}
	if known && old.path == cur.path && old.dev == cur.dev && old.ino == cur.ino && cur.size >= old.start && old.start > 0 {
		ok, err := x.appendFrom(f, s.ID, old, cur)
		if err != nil || ok {
			return err
		}
	}
	return x.reindex(f, s.ID, cur)
}

// entryLine is the part of a native record the index reads.
type entryLine struct {
	Type      string          `json:"type"`
	ID        string          `json:"id"`
	ParentID  *string         `json:"parentId"`
	Timestamp string          `json:"timestamp"`
	Message   json.RawMessage `json:"message"`
}

type message struct {
	entry, role, text string
	at                int64
}

// readMessage returns the searchable text of one record: the person's
// message or the agent's text answer, never tool output, tool calls or
// thinking.
func readMessage(e entryLine) (message, bool) {
	if e.Type != "message" || len(e.Message) == 0 {
		return message{}, false
	}
	var m struct {
		Role    string          `json:"role"`
		Content json.RawMessage `json:"content"`
	}
	if json.Unmarshal(e.Message, &m) != nil || (m.Role != "user" && m.Role != "assistant") {
		return message{}, false
	}
	var text string
	if json.Unmarshal(m.Content, &text) != nil {
		var blocks []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		}
		if json.Unmarshal(m.Content, &blocks) != nil {
			return message{}, false
		}
		parts := []string{}
		for _, b := range blocks {
			if b.Type == "text" && strings.TrimSpace(b.Text) != "" {
				parts = append(parts, b.Text)
			}
		}
		text = strings.Join(parts, "\n\n")
	}
	if strings.TrimSpace(text) == "" {
		return message{}, false
	}
	var at int64
	if t, err := time.Parse(time.RFC3339Nano, e.Timestamp); err == nil {
		at = t.UnixMilli()
	}
	return message{entry: e.ID, role: m.Role, text: text, at: at}, true
}

// lines calls visit with each complete record of r and returns how many
// bytes the complete records took. An unterminated tail is left for the next
// sync, when Pi has finished writing it.
func (x *Index) lines(r io.Reader, visit func([]byte) bool) (int64, error) {
	br := bufio.NewReaderSize(r, 64<<10)
	var used int64
	var long []byte
	for {
		chunk, err := br.ReadSlice('\n')
		if len(long)+len(chunk) > x.maxLine {
			return used, errors.New("record over bound")
		}
		if err == bufio.ErrBufferFull {
			long = append(long, chunk...)
			continue
		}
		if err == io.EOF {
			return used, nil
		}
		if err != nil {
			return used, err
		}
		line := chunk
		if len(long) > 0 {
			long = append(long, chunk...)
			line = long
		}
		used += int64(len(line))
		if !visit(line[:len(line)-1]) {
			return used, nil
		}
		long = long[:0]
	}
}

// appendFrom indexes the records Pi appended after old's offset. It reports
// false when they do not continue the indexed branch, and the file must be
// read again whole.
func (x *Index) appendFrom(f *os.File, id string, old, cur fileRow) (bool, error) {
	if _, err := f.Seek(old.start, io.SeekStart); err != nil {
		return false, nil
	}
	leaf := old.leaf
	var found []message
	branched := false
	used, err := x.lines(f, func(line []byte) bool {
		var e entryLine
		if json.Unmarshal(line, &e) != nil || e.ID == "" {
			return true
		}
		if e.ParentID == nil || *e.ParentID != leaf {
			branched = true
			return false
		}
		leaf = e.ID
		if m, ok := readMessage(e); ok {
			found = append(found, m)
		}
		return true
	})
	if err != nil || branched {
		return false, nil
	}
	cur.start, cur.leaf = old.start+used, leaf
	return true, x.store(id, cur, found, false)
}

// reindex reads the whole file and indexes the messages on its active
// branch: the ancestry of its last entry, as the conversation shows it.
func (x *Index) reindex(f *os.File, id string, cur fileRow) error {
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		return nil
	}
	parents := map[string]*string{}
	var found []message
	var leaf string
	header := true
	valid := true
	used, err := x.lines(f, func(line []byte) bool {
		if header {
			header = false
			var h struct {
				Type string `json:"type"`
				ID   string `json:"id"`
			}
			if json.Unmarshal(line, &h) != nil || h.Type != "session" || h.ID != id {
				valid = false
				return false
			}
			return true
		}
		var e entryLine
		if json.Unmarshal(line, &e) != nil || e.ID == "" {
			return true
		}
		parents[e.ID] = e.ParentID
		leaf = e.ID
		if m, ok := readMessage(e); ok {
			found = append(found, m)
		}
		return true
	})
	if err != nil || !valid {
		// Not a history this index can read now: forget its words rather
		// than show hits the conversation cannot open.
		return x.dropSession(x.db, id)
	}
	if leaf != "" && parents[leaf] != nil {
		active := map[string]bool{}
		for node := leaf; node != "" && !active[node]; {
			active[node] = true
			p, ok := parents[node]
			if !ok || p == nil {
				break
			}
			node = *p
		}
		kept := found[:0]
		for _, m := range found {
			if active[m.entry] {
				kept = append(kept, m)
			}
		}
		found = kept
	}
	cur.start, cur.leaf = used, leaf
	return x.store(id, cur, found, true)
}

func (x *Index) store(id string, cur fileRow, found []message, replace bool) error {
	tx, err := x.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if replace {
		if _, err := tx.Exec("DELETE FROM messages WHERE session = ?", id); err != nil {
			return err
		}
	}
	if len(found) > 0 {
		stmt, err := tx.Prepare("INSERT INTO messages(text, session, entry, role, at) VALUES (?, ?, ?, ?, ?)")
		if err != nil {
			return err
		}
		for _, m := range found {
			if _, err := stmt.Exec(m.text, id, m.entry, m.role, m.at); err != nil {
				stmt.Close()
				return err
			}
		}
		stmt.Close()
	}
	if _, err := tx.Exec(`INSERT INTO files(session, path, dev, ino, size, mtime, offset, leaf) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(session) DO UPDATE SET path = excluded.path, dev = excluded.dev, ino = excluded.ino, size = excluded.size, mtime = excluded.mtime, offset = excluded.offset, leaf = excluded.leaf`,
		id, cur.path, int64(cur.dev), int64(cur.ino), cur.size, cur.mtime, cur.start, cur.leaf); err != nil {
		return err
	}
	return tx.Commit()
}
