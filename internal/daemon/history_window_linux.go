//go:build linux

package daemon

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"os"
	"strings"
	"unicode/utf8"
)

// readNativeWindow hashes the native bytes for revision binding, but decodes
// only the active tail needed by the requested page. No cross-request index is
// kept. A before page includes its boundary as a shared-key witness.
func readNativeWindow(path string, uid int, beforeKey string, limit int) nativeSession {
	return readNativeWindowFor(path, uid, beforeKey, limit, "")
}

// Content selection follows the same active branch, hash and file stability
// checks as paging; it retains only the selected native entry for block reads.
func readNativeWindowFor(path string, uid int, beforeKey string, limit int, contentKey string) nativeSession {
	return readNativeWindowBounded(path, uid, beforeKey, limit, 0, contentKey)
}

// conversational is what a person counts as a message when scrolling back: their
// own prompts and the agent's visible replies. Tool calls, results, thinking-only
// steps and markers ride along without counting, so a page bounded by messages
// covers the same stretch of conversation however tool-heavy it is.
func conversational(e historyEntry) bool {
	if e.Kind == "user" {
		return true
	}
	// full is the reply's whole text; a block preview can be empty when long
	// thinking used up the preview budget.
	return e.Kind == "assistant" && strings.TrimSpace(e.full) != ""
}

// readNativeWindowBounded stops a page at whichever comes first: limit entries
// or, when messages > 0, the messages-th conversational entry. The before
// boundary is a witness and counts toward neither bound.
func readNativeWindowBounded(path string, uid int, beforeKey string, limit, messages int, contentKey string) nativeSession {
	return nativeWindow(path, uid, beforeKey, limit, messages, contentKey, true)
}

// readNativeTail reads the newest limit visible entries of the active branch
// without hashing the file: a reader that answers from the tail and binds no
// revision reads only the tail.
func readNativeTail(path string, uid int, limit int) nativeSession {
	return settleNativeWindow(func() nativeSession { return nativeWindow(path, uid, "", limit, 0, "", false) })
}

// nativeWindowReadHook runs after a window read has taken its bytes and before
// it checks the file again; tests append to the file there.
var nativeWindowReadHook func()

func nativeWindow(path string, uid int, beforeKey string, limit, messages int, contentKey string, hashed bool) nativeSession {
	var result nativeSession
	gone := func(reason string) nativeSession { return nativeSession{refusal: reason} }
	refuse := func(reason string) nativeSession {
		result.state, result.refusal = "corrupt", reason
		return result
	}
	info, err := os.Lstat(path)
	if err != nil || !info.Mode().IsRegular() || info.Size() < 1 {
		return gone("source_missing")
	}
	if uid >= 0 {
		owner, ok := fileOwner(info)
		if !ok || owner != uid {
			return gone("source_not_owned")
		}
	}
	f, err := os.Open(path)
	if err != nil {
		return gone("source_open_failed")
	}
	defer f.Close()
	opened, err := f.Stat()
	if err != nil || !os.SameFile(info, opened) {
		return gone("source_replaced")
	}
	// Pi only appends to a live session, one whole record per write, so the
	// bytes up to the size seen here are a complete history even while Pi
	// writes on: the read takes exactly them and later growth is the next
	// read's. Refusing growth made a long conversation unreadable whenever Pi
	// appended a tool step during the read (12.11.2026, 5 MiB, 30 of 30 reads
	// in a busy tool loop). Pi rewrites a file in place only when it loads
	// one, never while a turn appends; a shrunk or replaced file still fails.
	size := info.Size()
	if hashed {
		hash := sha256.New()
		if _, err = io.CopyN(hash, f, size); err != nil {
			return gone("source_shrank")
		}
		result.revision = base64.RawURLEncoding.EncodeToString(hash.Sum(nil)[:18])
	}
	result.path, result.state = path, "readable"
	header := readNativeHeader(path, uid)
	if header.id == "" {
		return refuse("header_unreadable")
	}
	result.id, result.cwd = header.id, header.cwd
	result.boundaryFound = beforeKey == ""
	result.entries = []historyEntry{}
	var target string
	var chain bool
	var leaf bool
	var broken bool
	var cut bool
	var stopped bool
	counted := 0
	seen := map[string]bool{}
	// Locate a bounded incomplete final record without loading the full history.
	// It is either a record Pi is still writing, which the file grows past
	// before this read ends, or one a full quota cut (decided below).
	var last [1]byte
	if _, err := f.ReadAt(last[:], size-1); err != nil {
		return gone("source_read_failed")
	}
	fragmentBad := false
	if last[0] != '\n' {
		end, err := lastNativeNewline(f, size)
		if err != nil {
			return gone("source_read_failed")
		}
		if end == 0 {
			return refuse("record_over_bound")
		}
		fragment := make([]byte, size-end)
		if _, err := f.ReadAt(fragment, end); err != nil {
			return gone("source_read_failed")
		}
		var value any
		err = json.Unmarshal(fragment, &value)
		fragmentBad = err == nil || err.Error() != "unexpected end of JSON input"
		size = end
		result.cutOff = true
	}
	err = reverseLines(f, size, func(line []byte) bool {
		var e struct {
			ID   string `json:"id"`
			Type string `json:"type"`
			// Present, even as null, it makes a tree entry: a leaf at the
			// root (Palaa tähän before the first message) is a chain of one.
			ParentID json.RawMessage `json:"parentId"`
		}
		if json.Unmarshal(line, &e) != nil || !entryIDPattern.MatchString(e.ID) {
			broken = true
			cut = quotaCutRecord(line)
			return false
		}
		if seen[e.ID] {
			broken = true
			return false
		}
		seen[e.ID] = true
		if e.Type == "session" {
			return false
		}
		if !leaf {
			leaf = true
			chain = len(e.ParentID) > 0
			target = e.ID
		}
		if chain && e.ID != target {
			return true
		}
		if chain {
			// An absent parent ends the chain, as a null one does and as
			// the whole-file reader (decodeNativeStream) reads it.
			var parent *string
			if len(e.ParentID) > 0 && json.Unmarshal(e.ParentID, &parent) != nil {
				broken = true
				return false
			}
			if parent == nil {
				target = ""
			} else {
				target = *parent
			}
		}
		if !result.boundaryFound {
			if e.ID != beforeKey {
				return true
			}
			result.boundaryFound = true
		}
		if contentKey != "" && e.ID != contentKey {
			return true
		}
		var full nativeEntry
		if json.Unmarshal(line, &full) != nil {
			broken = true
			return false
		}
		full.Raw = line
		entry := nativeBlocks(full)
		if contentKey != "" {
			entry.raw = append([]byte(nil), line...)
			if entry.Kind != "" {
				result.entries = append(result.entries, entry)
			}
			stopped = true
			return false
		}
		if entry.Kind == "" {
			return true
		}
		// A further visible entry proves older history exists; it is not kept.
		if len(result.entries) >= limit+boolInt(beforeKey != "") || messages > 0 && counted >= messages {
			stopped = true
			return false
		}
		result.entries = append(result.entries, entry)
		if e.ID != beforeKey && conversational(entry) {
			counted++
		}
		return true
	})
	switch {
	case errors.Is(err, errNativeLine):
		return refuse("record_over_bound")
	case errors.Is(err, errQuotaCutLine):
		return refuse("quota_cut_record")
	case err != nil:
		return refuse("record_unreadable")
	case cut:
		return refuse("quota_cut_record")
	case broken:
		return refuse("broken_record")
	case chain && !stopped && target != "":
		return refuse("broken_chain")
	}
	if nativeWindowReadHook != nil {
		nativeWindowReadHook()
	}
	after, err := os.Lstat(path)
	if err != nil || !os.SameFile(info, after) || after.Size() < info.Size() || after.Size() == info.Size() && !info.ModTime().Equal(after.ModTime()) {
		return refuse("source_changed")
	}
	if after.Size() > info.Size() {
		// The unterminated record was being written: the file grew past it.
		result.cutOff = false
	} else if fragmentBad {
		return refuse("broken_tail")
	}
	result.olderComplete = !stopped
	for i, j := 0, len(result.entries)-1; i < j; i, j = i+1, j-1 {
		result.entries[i], result.entries[j] = result.entries[j], result.entries[i]
	}
	return result
}

// errQuotaCutLine is reverseLines' refusal of an invalid-UTF-8 line that
// quotaCutRecord recognizes.
var errQuotaCutLine = errors.New("native record cut by a full quota")

// quotaCutRecord tells whether line is what a full storage quota leaves
// behind once Pi writes again: a record cut short (a write that ran out of
// room) with the next whole record appended right after it on the same line.
// The history is not repaired or read past it; the refusal only names the
// cause, so the person learns that storage ran out rather than that something
// unknown broke (12.11.2026).
func quotaCutRecord(line []byte) bool {
	// The appended record is the line's end, so candidates are tried from
	// the end; its own content blocks also start like a record, hence the
	// generous bound. Only a line that already failed to parse comes here.
	start := []byte(`{"type":"`)
	end := len(line)
	for tries := 0; tries < 256; tries++ {
		at := bytes.LastIndex(line[:end], start)
		if at < 1 {
			return false
		}
		end = at
		var next struct {
			ID string `json:"id"`
		}
		if !json.Valid(line[at:]) || json.Unmarshal(line[at:], &next) != nil || !entryIDPattern.MatchString(next.ID) {
			continue
		}
		var value any
		err := json.Unmarshal(line[:at], &value)
		// A cut that fell just before the newline leaves a whole record.
		return err == nil || err.Error() == "unexpected end of JSON input"
	}
	return false
}

// reverseLines reads newline-delimited records from the end without allocating
// the whole file. The per-record bound rejects pathological native records.
func reverseLines(f *os.File, size int64, visit func([]byte) bool) error {
	const block = 64 << 10
	const maxLine = maxNativeLine
	if size == 0 {
		return io.ErrUnexpectedEOF
	}
	last := make([]byte, 1)
	if _, err := f.ReadAt(last, size-1); err != nil {
		return err
	}
	if last[0] != '\n' {
		return io.ErrUnexpectedEOF
	}
	emit := func(start, end int64) (bool, error) {
		if end-start > maxLine {
			return false, nativeRecordOverBound(end - start)
		}
		if end == start {
			return true, nil
		}
		line := make([]byte, end-start)
		if _, err := f.ReadAt(line, start); err != nil {
			return false, err
		}
		if !utf8.Valid(line) {
			// A quota cut can fall inside a multibyte rune; say so, so the
			// window reader can name it. Either way the line is refused.
			if quotaCutRecord(line) {
				return false, errQuotaCutLine
			}
			return false, io.ErrUnexpectedEOF
		}
		return visit(line), nil
	}
	buf := make([]byte, block)
	lineEnd := size - 1
	for pos := size - 1; pos > 0; {
		start := pos - block
		if start < 0 {
			start = 0
		}
		chunk := buf[:pos-start]
		if _, err := f.ReadAt(chunk, start); err != nil {
			return err
		}
		for i := len(chunk) - 1; i >= 0; i-- {
			if chunk[i] != '\n' {
				continue
			}
			more, err := emit(start+int64(i)+1, lineEnd)
			if err != nil || !more {
				return err
			}
			lineEnd = start + int64(i)
		}
		if lineEnd-start > maxLine {
			return nativeRecordOverBound(lineEnd - start)
		}
		pos = start
	}
	_, err := emit(0, lineEnd)
	return err
}

// Pi can append between the hash and the reverse scan. The same one-retry
// policy as native continuation avoids treating a transient append as loss.
func readNativeWindowSettled(path string, uid int, beforeKey string, limit int, contentKey string) nativeSession {
	return settleNativeWindow(func() nativeSession { return readNativeWindowFor(path, uid, beforeKey, limit, contentKey) })
}

func readNativePageSettled(path string, uid int, beforeKey string, limit, messages int) nativeSession {
	return settleNativeWindow(func() nativeSession { return readNativeWindowBounded(path, uid, beforeKey, limit, messages, "") })
}

func settleNativeWindow(read func() nativeSession) nativeSession {
	s := read()
	if s.id == "" || s.state == "corrupt" {
		return read()
	}
	return s
}

func boolInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
