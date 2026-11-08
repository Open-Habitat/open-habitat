//go:build linux

package daemon

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
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

func nativeWindow(path string, uid int, beforeKey string, limit, messages int, contentKey string, hashed bool) nativeSession {
	var result nativeSession
	info, err := os.Lstat(path)
	if err != nil || !info.Mode().IsRegular() || info.Size() < 1 {
		return result
	}
	if uid >= 0 {
		owner, ok := fileOwner(info)
		if !ok || owner != uid {
			return result
		}
	}
	f, err := os.Open(path)
	if err != nil {
		return result
	}
	defer f.Close()
	opened, err := f.Stat()
	if err != nil || !os.SameFile(info, opened) {
		return result
	}
	if hashed {
		hash := sha256.New()
		if _, err = io.Copy(hash, f); err != nil {
			return result
		}
		if end, e := f.Seek(0, io.SeekCurrent); e != nil || end != info.Size() {
			return result
		}
		result.revision = base64.RawURLEncoding.EncodeToString(hash.Sum(nil)[:18])
	}
	result.path, result.state = path, "readable"
	header := readNativeHeader(path, uid)
	if header.id == "" {
		result.state = "corrupt"
		return result
	}
	result.id, result.cwd = header.id, header.cwd
	result.boundaryFound = beforeKey == ""
	result.entries = []historyEntry{}
	var target string
	var chain bool
	var leaf bool
	var broken bool
	var stopped bool
	counted := 0
	seen := map[string]bool{}
	// ReadAt preserves native order independently of the forward hash pass.
	size := info.Size()
	// Locate a bounded incomplete final record without loading the full history.
	var last [1]byte
	if _, err := f.ReadAt(last[:], size-1); err != nil {
		return nativeSession{}
	}
	if last[0] != '\n' {
		end, err := lastNativeNewline(f, size)
		if err != nil {
			return nativeSession{}
		}
		if end == 0 {
			result.state = "corrupt"
			return result
		}
		fragment := make([]byte, size-end)
		if _, err := f.ReadAt(fragment, end); err != nil {
			return nativeSession{}
		}
		var value any
		err = json.Unmarshal(fragment, &value)
		if err == nil || err.Error() != "unexpected end of JSON input" {
			result.state = "corrupt"
			return result
		}
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
	if err != nil || broken || (chain && !stopped && target != "") {
		result.state = "corrupt"
		return result
	}
	after, err := os.Lstat(path)
	if err != nil || !os.SameFile(info, after) || info.Size() != after.Size() || !info.ModTime().Equal(after.ModTime()) {
		result.state = "corrupt"
		return result
	}
	result.olderComplete = !stopped
	for i, j := 0, len(result.entries)-1; i < j; i, j = i+1, j-1 {
		result.entries[i], result.entries[j] = result.entries[j], result.entries[i]
	}
	return result
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
