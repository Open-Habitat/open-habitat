//go:build linux

package daemon

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"

	"golang.org/x/sys/unix"
)

// turnMark is the person's own word on a conversation's place in Sinun
// vuorosi: raised (Nosta) or not_now (Ei nyt) for the reply ReplyID. It is
// Habitat's view state, not conversation content, so it lives beside the
// account preferences in ~/.config/open-habitat/turn-marks.json rather than
// in Pi's session file, whose mtime orders Hiljaiset, or in user-state.json,
// whose writer a running clone holds for minutes. One mark per conversation:
// raising replaces Ei nyt and Ei nyt replaces a raise.
type turnMark struct {
	State   string `json:"state"`
	At      string `json:"at"`
	ReplyID string `json:"reply_id,omitempty"`
}

type turnMarks struct {
	SchemaVersion int                 `json:"schema_version"`
	Marks         map[string]turnMark `json:"marks"`
}

// maxTurnMarks bounds the file. Marks of conversations that are gone are
// never read again, so the oldest give way to a new one.
const (
	maxTurnMarks     = 512
	maxTurnMarksSize = 128 << 10
)

// turnMarksLock serializes the read-change-replace of the file in the
// person's daemon, so a raise on one device and a send on another both land.
var turnMarksLock sync.Mutex

func validReplyID(id string) bool {
	return len(id) > 0 && len(id) <= 200 && !strings.ContainsAny(id, "\x00\n\r")
}

func (m turnMark) valid() bool {
	if _, err := time.Parse(time.RFC3339Nano, m.At); err != nil {
		return false
	}
	switch m.State {
	case "raised":
		return m.ReplyID == ""
	case "not_now":
		return m.ReplyID == "" || validReplyID(m.ReplyID)
	}
	return false
}

func validTurnMarkKey(key string) bool {
	return strings.HasPrefix(key, "pi:") && sessionIDPattern.MatchString(key[3:])
}

// readTurnMarks returns the person's marks. A missing file is no marks; an
// unsafe or unreadable one is an error, never silently empty, so a write
// does not replace marks it could not read.
func readTurnMarks(home string) (turnMarks, error) {
	result := turnMarks{SchemaVersion: 1, Marks: map[string]turnMark{}}
	dir, err := preferencesDir(home, false)
	if errors.Is(err, os.ErrNotExist) {
		return result, nil
	}
	if err != nil {
		return result, err
	}
	defer dir.Close()
	fd, err := unix.Openat(int(dir.Fd()), "turn-marks.json", unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if errors.Is(err, os.ErrNotExist) {
		return result, nil
	}
	if err != nil {
		return result, err
	}
	f := os.NewFile(uintptr(fd), "turn-marks")
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return result, err
	}
	if !st.Mode().IsRegular() || st.Size() > maxTurnMarksSize || st.Mode().Perm()&0022 != 0 || st.Sys().(*syscall.Stat_t).Uid != uint32(os.Geteuid()) {
		return result, errors.New("unsafe turn marks file")
	}
	var value turnMarks
	dec := json.NewDecoder(io.LimitReader(f, maxTurnMarksSize+1))
	dec.DisallowUnknownFields()
	if err = dec.Decode(&value); err != nil || dec.Decode(new(any)) != io.EOF || value.SchemaVersion != 1 || len(value.Marks) > maxTurnMarks {
		return result, errors.New("invalid turn marks")
	}
	for key, mark := range value.Marks {
		if !validTurnMarkKey(key) || !mark.valid() {
			return result, errors.New("invalid turn marks")
		}
	}
	if value.Marks == nil {
		value.Marks = map[string]turnMark{}
	}
	return value, nil
}

func encodeTurnMarks(value turnMarks) []byte {
	var b bytes.Buffer
	enc := json.NewEncoder(&b)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(value)
	return b.Bytes()
}

func saveTurnMarks(home string, value turnMarks) error {
	encoded := encodeTurnMarks(value)
	if len(encoded) > maxTurnMarksSize {
		return errors.New("turn marks exceed readable bound")
	}
	dir, err := preferencesDir(home, true)
	if err != nil {
		return err
	}
	defer dir.Close()
	var random [16]byte
	if _, err = rand.Read(random[:]); err != nil {
		return err
	}
	name := ".turn-marks-" + hex.EncodeToString(random[:])
	fd, err := unix.Openat(int(dir.Fd()), name, unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0600)
	if err != nil {
		return err
	}
	defer unix.Unlinkat(int(dir.Fd()), name, 0)
	f := os.NewFile(uintptr(fd), "turn-marks")
	defer f.Close()
	if _, err = f.Write(encoded); err != nil {
		return err
	}
	if err = f.Sync(); err != nil {
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	if err = unix.Renameat(int(dir.Fd()), name, int(dir.Fd()), "turn-marks.json"); err != nil {
		return err
	}
	return dir.Sync()
}

// setTurnMark stores the conversation's mark, or removes it when mark is
// nil, and says whether anything changed.
func setTurnMark(home, key string, mark *turnMark) (bool, error) {
	turnMarksLock.Lock()
	defer turnMarksLock.Unlock()
	value, err := readTurnMarks(home)
	if err != nil {
		return false, err
	}
	old, had := value.Marks[key]
	if mark == nil {
		if !had {
			return false, nil
		}
		delete(value.Marks, key)
	} else {
		if had && old == *mark {
			return false, nil
		}
		value.Marks[key] = *mark
		// Keep within both bounds the reader checks, so a write never leaves
		// a file the next read refuses.
		keys := make([]string, 0, len(value.Marks))
		for k := range value.Marks {
			if k != key {
				keys = append(keys, k)
			}
		}
		at := func(k string) time.Time { t, _ := time.Parse(time.RFC3339Nano, value.Marks[k].At); return t }
		sort.Slice(keys, func(i, j int) bool { return at(keys[i]).Before(at(keys[j])) })
		for len(keys) > 0 && (len(value.Marks) > maxTurnMarks || len(encodeTurnMarks(value)) > maxTurnMarksSize) {
			delete(value.Marks, keys[0])
			keys = keys[1:]
		}
	}
	return true, saveTurnMarks(home, value)
}

// clearTurnMark removes the conversation's mark after the person replied or
// archived it. The caller publishes the change. A failed write leaves the
// mark, which the person can still take down by hand.
func (c *ConversationController) clearTurnMark(id string) bool {
	if c.home == "" {
		return false
	}
	changed, err := setTurnMark(c.home, "pi:"+id, nil)
	return err == nil && changed
}

// markTurn is POST /api/v1/conversations/<id>/turn: Nosta or Ei nyt. The
// reply ID comes from the person's browser and is only compared with the
// conversation's later replies; it grants nothing.
func (c *ConversationController) markTurn(w http.ResponseWriter, r *http.Request, id string) {
	var body struct {
		Mark    string  `json:"mark"`
		ReplyID *string `json:"reply_id"`
	}
	if decodeControl(r, &body, 512) != nil || (body.Mark != "raised" && body.Mark != "not_now") || (body.ReplyID != nil && (body.Mark == "raised" || !validReplyID(*body.ReplyID))) {
		snapshotError(w, 400, "invalid_request")
		return
	}
	replyID := ""
	if body.ReplyID != nil {
		replyID = *body.ReplyID
	}
	if c.home == "" {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	c.mu.Lock()
	known := c.sessions[id] != nil
	c.mu.Unlock()
	if !known {
		histories, err := nativeSessions(c.nativeCfg())
		if err != nil {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		for _, h := range histories {
			if h.id == id {
				known = true
				break
			}
		}
	}
	if !known {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	mark := turnMark{State: body.Mark, At: time.Now().UTC().Format(time.RFC3339Nano), ReplyID: replyID}
	key := "pi:" + id
	if _, err := setTurnMark(c.home, key, &mark); err != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	reply := map[string]any{"schema_version": 1, "agent_id": key, "turn_mark": mark}
	if c.journal != nil {
		if cursor := c.journal.appendInvalidation(key); cursor != "" {
			reply["event_cursor"] = cursor
		}
	}
	historyJSON(w, reply)
}
