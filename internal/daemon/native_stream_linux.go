//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"os"

	"golang.org/x/sys/unix"
)

// A Pi session grows with every turn, and an image is one record of several
// MiB, so a long conversation with pictures passes tens of MiB in a week
// (7.11.2026: a 35 MiB conversation could not be continued, named or
// archived). Whole-history readers therefore stream the file one record at a
// time and never hold it whole. maxHistoryFile is the only bound on the file,
// and maxNativeLine bounds the one record held at a time.
//
// The largest record is a person's message: Pi writes every admitted
// attachment into it as base64, the same payload it echoes on its RPC frame.
// A bound below that admits a send whose conversation can then no longer be
// read (8.11.2026: twenty screenshots, one 80 MB record over a 64 MiB bound).
const maxNativeLine = piFrameLimit

var errNativeLine = errors.New("native record over bound")

// eachNativeLine calls visit with every newline-terminated record of r, without
// its newline, until visit returns false. The record is only valid during the
// call. What follows the last newline is returned as the unterminated tail; a
// stopped walk returns no tail.
func eachNativeLine(r io.Reader, visit func([]byte) bool) (tail []byte, err error) {
	reader := bufio.NewReaderSize(r, 64<<10)
	var long []byte
	for {
		chunk, readErr := reader.ReadSlice('\n')
		if readErr != nil && readErr != bufio.ErrBufferFull && readErr != io.EOF {
			return nil, readErr
		}
		if len(long)+len(chunk) > maxNativeLine {
			return nil, errNativeLine
		}
		switch readErr {
		case bufio.ErrBufferFull:
			long = append(long, chunk...)
			continue
		case io.EOF:
			if len(long)+len(chunk) == 0 {
				return nil, nil
			}
			return append(long, chunk...), nil
		}
		line := chunk[:len(chunk)-1]
		if len(long) > 0 {
			long = append(long, line...)
			line = long
		}
		if !visit(line) {
			return nil, nil
		}
		// The buffer of a long record is reused: each record is valid only
		// during its visit, and pictures come in runs.
		long = long[:0]
	}
}

// openNative opens one owned, regular, bounded native session file without
// trusting a path swapped between the check and the open.
func openNative(path string, uid int) (*os.File, os.FileInfo, bool) {
	before, err := os.Lstat(path)
	if err != nil || !before.Mode().IsRegular() || before.Size() > maxHistoryFile || before.Size() < 1 {
		return nil, nil, false
	}
	if uid >= 0 {
		if owner, ok := fileOwner(before); !ok || owner != uid {
			return nil, nil, false
		}
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, nil, false
	}
	opened, err := f.Stat()
	if err != nil || !os.SameFile(before, opened) {
		f.Close()
		return nil, nil, false
	}
	return f, opened, true
}

type countingReader struct {
	r io.Reader
	n int64
}

func (c *countingReader) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	c.n += int64(n)
	return n, err
}

// readNativeStream gives read one stable pass over a native session file. The
// pass counts only if read consumed every byte and the file did not change
// while it ran; what read leaves unread is consumed here. The stamp it returns
// changes with any later write, which makes it a cheap revision for a caller
// that only needs to know the file stood still.
func readNativeStream(path string, uid int, read func(io.Reader)) (fileStamp, bool) {
	f, _, ok := openNative(path, uid)
	if !ok {
		return fileStamp{}, false
	}
	defer f.Close()
	before, err := stampOfFile(f)
	if err != nil {
		return fileStamp{}, false
	}
	counter := &countingReader{r: io.LimitReader(f, maxHistoryFile+1)}
	read(counter)
	if _, err := io.Copy(io.Discard, counter); err != nil {
		return fileStamp{}, false
	}
	after, err := stampOf(path)
	if err != nil || after != before || counter.n != int64(before.size) {
		return fileStamp{}, false
	}
	return before, true
}

func stampOfFile(f *os.File) (fileStamp, error) {
	var st unix.Stat_t
	if err := unix.Fstat(int(f.Fd()), &st); err != nil {
		return fileStamp{}, err
	}
	return fileStamp{dev: st.Dev, ino: st.Ino, size: uint64(st.Size), mode: st.Mode, uid: st.Uid, mtime: st.Mtim, ctime: st.Ctim}, nil
}

// lastNativeNewline is the offset just past the file's last newline, found by
// reading back at most one record; 0 when none is within the bound.
func lastNativeNewline(f *os.File, size int64) (int64, error) {
	const block = 64 << 10
	buf := make([]byte, block)
	for end := size; end > 0 && size-end <= maxNativeLine; {
		start := max(end-block, 0)
		chunk := buf[:end-start]
		if _, err := f.ReadAt(chunk, start); err != nil {
			return 0, err
		}
		if i := bytes.LastIndexByte(chunk, '\n'); i >= 0 {
			return start + int64(i) + 1, nil
		}
		end = start
	}
	return 0, nil
}

// nativeStill says the file is still exactly the one a stable pass stamped.
func nativeStill(path string, stamp fileStamp) bool {
	now, err := stampOf(path)
	return err == nil && stamp != (fileStamp{}) && now == stamp
}

// nativeTailProof is a precondition that reads only both ends of a native
// session: the header names this conversation, the final record is complete
// (or a cut-off fragment Pi's own continuation repairs), and the file stood
// still meanwhile. Its stamp is the cheap revision a caller compares again
// later: Pi only appends, and any write changes size or times. Presentation
// and naming need no more; continuation, which hands the whole file to Pi,
// proves every record (reconciledNativeTail).
func nativeTailProof(path string, uid int, id, cwd string) (stamp fileStamp, cutOff bool, ok bool) {
	f, _, ok := openNative(path, uid)
	if !ok {
		return fileStamp{}, false, false
	}
	defer f.Close()
	// Both ends are read at the stamped size, so an append after the open
	// can only make the final stamp differ, never go unexamined.
	stamp, err := stampOfFile(f)
	if err != nil {
		return fileStamp{}, false, false
	}
	line, err := bufio.NewReader(io.NewSectionReader(f, 0, 16385)).ReadBytes('\n')
	var h nativeHeader
	if err != nil || len(line) > 16384 || json.Unmarshal(line, &h) != nil || h.Type != "session" || h.Version != 3 || h.ID != id || h.Cwd != cwd {
		return fileStamp{}, false, false
	}
	size := int64(stamp.size)
	end, err := lastNativeNewline(f, size)
	if err != nil || end == 0 {
		return fileStamp{}, false, false
	}
	if end < size {
		fragment := make([]byte, size-end)
		if _, err := f.ReadAt(fragment, end); err != nil {
			return fileStamp{}, false, false
		}
		var value any
		if err := json.Unmarshal(fragment, &value); err == nil || err.Error() != "unexpected end of JSON input" {
			return fileStamp{}, false, false
		}
		cutOff = true
	}
	valid := false
	if err := reverseLines(f, end, func(line []byte) bool {
		var e struct {
			ID   string `json:"id"`
			Type string `json:"type"`
		}
		valid = json.Unmarshal(line, &e) == nil && (e.Type == "session" && e.ID == id || e.Type != "session" && entryIDPattern.MatchString(e.ID))
		return false
	}); err != nil || !valid {
		return fileStamp{}, false, false
	}
	if !nativeStill(path, stamp) {
		return fileStamp{}, false, false
	}
	return stamp, cutOff, true
}
