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
	result.boundaryFound = beforeKey == ""
	result.entries = []historyEntry{}
	var target string
	var chain bool
	var leaf bool
	var broken bool
	var stopped bool
	// ReadAt preserves native order independently of the forward hash pass.
	err = reverseLines(f, info.Size(), func(line []byte) bool {
		var e nativeEntry
		if json.Unmarshal(line, &e) != nil || !entryIDPattern.MatchString(e.ID) {
			broken = true
			return false
		}
		if e.Type == "session" {
			return false
		}
		e.Raw = line
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
		kind, text := nativeText(e)
		if kind != "" {
			result.entries = append(result.entries, historyEntry{Key: e.ID, Kind: kind, full: text})
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
	// A limited reverse scan need not reach the header. Check its identity using
	// the same bounded, ownership-checked native header path as discovery.
	header := readNativeHeader(path, uid)
	if header.id == "" {
		result.state = "corrupt"
		return result
	}
	result.id, result.cwd = header.id, header.cwd
	after, err := os.Lstat(path)
	if err != nil || !os.SameFile(info, after) || info.Size() != after.Size() || !info.ModTime().Equal(after.ModTime()) {
		result.state = "corrupt"
		return result
	}
	result.olderComplete = !stopped
	if stopped {
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
	var pending []byte
	for pos := size; pos > 0; {
		start := pos - block
		if start < 0 {
			start = 0
		}
		buf := make([]byte, pos-start)
		if _, err := f.ReadAt(buf, start); err != nil {
			return err
		}
		end := len(buf)
		for i := len(buf) - 1; i >= 0; i-- {
			if buf[i] != '\n' {
				continue
			}
			line := make([]byte, 0, end-i-1+len(pending))
			line = append(line, buf[i+1:end]...)
			line = append(line, pending...)
			if len(line) > maxLine || !utf8.Valid(line) {
				return io.ErrUnexpectedEOF
			}
			if len(line) > 0 && !visit(line) {
				return nil
			}
			pending = nil
			end = i
		}
		if end+len(pending) > maxLine {
			return io.ErrUnexpectedEOF
		}
		pending = append(append([]byte(nil), buf[:end]...), pending...)
		pos = start
	}
	if len(pending) > 0 {
		if !utf8.Valid(pending) {
			return io.ErrUnexpectedEOF
		}
		_ = visit(pending)
	}
	return nil
}

func boolInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
