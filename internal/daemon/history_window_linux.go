//go:build linux

package daemon

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"os"
	"unicode/utf8"
)

// readNativeWindow hashes the native bytes for content identity, but decodes
// only the active tail needed by the requested page. No cross-request index is
// kept. A before page includes its boundary as a shared-key witness.
func readNativeWindow(path string, uid int, beforeKey string, limit int) nativeSession {
	return readNativeWindowFor(path, uid, beforeKey, limit, "")
}

// Content selection follows the same active branch, hash and file stability
// checks as paging; it retains only the requested entry's rendered text.
func readNativeWindowFor(path string, uid int, beforeKey string, limit int, contentKey string) nativeSession {
	var result nativeSession
	info, err := os.Lstat(path)
	if err != nil || !info.Mode().IsRegular() || info.Size() < 1 || info.Size() > maxHistoryFile {
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
	hash := sha256.New()
	if _, err = io.Copy(hash, io.LimitReader(f, maxHistoryFile+1)); err != nil {
		return result
	}
	if end, e := f.Seek(0, io.SeekCurrent); e != nil || end != info.Size() {
		return result
	}
	result.revision = base64.RawURLEncoding.EncodeToString(hash.Sum(nil)[:18])
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
	// ReadAt preserves native order independently of the forward hash pass.
	err = reverseLines(f, info.Size(), func(line []byte) bool {
		var e struct {
			ID       string  `json:"id"`
			Type     string  `json:"type"`
			ParentID *string `json:"parentId"`
		}
		if json.Unmarshal(line, &e) != nil || !entryIDPattern.MatchString(e.ID) {
			broken = true
			return false
		}
		if e.Type == "session" {
			return false
		}
		if !leaf {
			leaf = true
			chain = e.ParentID != nil
			target = e.ID
		}
		if chain && e.ID != target {
			return true
		}
		if chain {
			if e.ParentID == nil {
				target = ""
			} else {
				target = *e.ParentID
			}
		}
		if !result.boundaryFound {
			if e.ID != beforeKey {
				return true
			}
			result.boundaryFound = true
		}
		if contentKey != "" && contentID(&result, e.ID) != contentKey {
			return true
		}
		var full nativeEntry
		if json.Unmarshal(line, &full) != nil {
			broken = true
			return false
		}
		full.Raw = line
		kind, text := nativeText(full)
		if kind != "" {
			result.entries = append(result.entries, historyEntry{Key: e.ID, Kind: kind, full: text})
		}
		if contentKey != "" {
			stopped = true
			return false
		}
		if len(result.entries) > limit+boolInt(beforeKey != "") {
			stopped = true
			return false
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
	if stopped && contentKey == "" {
		result.entries = result.entries[:limit+boolInt(beforeKey != "")]
	}
	for i, j := 0, len(result.entries)-1; i < j; i, j = i+1, j-1 {
		result.entries[i], result.entries[j] = result.entries[j], result.entries[i]
	}
	return result
}

// reverseLines reads newline-delimited records from the end without allocating
// the whole file. The per-record bound rejects pathological native records.
func reverseLines(f *os.File, size int64, visit func([]byte) bool) error {
	const block = 64 << 10
	const maxLine = 64 << 20
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
			return false, io.ErrUnexpectedEOF
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
			return io.ErrUnexpectedEOF
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
