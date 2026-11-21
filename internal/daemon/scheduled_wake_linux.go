//go:build linux

package daemon

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/open-habitat/open-habitat/internal/diagnostic"
	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// Scheduled wake: the agent asks to be woken at a time, the
// conversation waits in Hiljaiset meanwhile, and at that time Habitat starts
// its Pi if it has stopped and gives the agent a turn with the wake's note.
// The reply then rises to Sinun vuorosi like any reply. The person never sets
// a wake directly; they ask the agent, which runs
// `open-habitat agent wake create --current`. The person can move or cancel a
// pending wake from the conversation.
//
// A wake is Habitat's own commitment, not Pi history, so it lives in the
// person's state directory (~/.local/state/open-habitat/wakes.json, 0600),
// written by this daemon only. What the agent is told (the wake turn itself,
// a cancellation) goes into the native branch through the companion, where
// the conversation shows it as Habitat's line.
//
// The daemon is socket-activated and may not run at the wake time. While it
// runs, an in-process timer fires the next wake; for the rest, one timer in
// the person's own systemd user manager (lingering, which the broker enables
// for every admitted account) runs `open-habitat agent wake due` at the next
// wake and after the manager starts at boot. That only connects to the
// person's own agent socket, which starts the daemon, and asks it to fire
// what is due. Every daemon start also fires what is overdue. A wake that
// fires later than set says so in the agent's message and the person's line.
// No authority moves: the daemon already runs as the person and already
// writes their user units (Omat koneet).
const (
	AgentWakesPath = "/agent/v1/wakes"
	// One generous guard against a runaway agent (Jari 21.11.2026).
	maxPendingWakes = 100
	maxWakeNote     = 1000
	// Fired and cancelled wakes are kept a while for `wake list` and the
	// archive undo; the oldest give way first.
	maxWakeRecords   = 400
	wakeRecordMaxAge = 30 * 24 * time.Hour
	maxWakesFileSize = 1 << 20
	// A wake that fires more than this after its time is late, and both the
	// agent and the person are told so.
	wakeLateAfter = 2 * time.Minute
	// A wake that cannot be delivered (Pi will not start, the conversation
	// is busy starting) is tried again each minute for this long.
	wakeRetryEvery  = time.Minute
	wakeMaxAttempts = 60
	wakeTimerUnit   = "open-habitat-wake.timer"
	wakeServiceUnit = "open-habitat-wake.service"
)

var wakeIDPattern = regexp.MustCompile(`^wk_[0-9a-f]{16}$`)

type scheduledWake struct {
	ID      string `json:"id"`
	AgentID string `json:"agent_id"`
	At      string `json:"at"`
	Note    string `json:"note"`
	SetBy   string `json:"set_by"`
	SetAt   string `json:"set_at"`
	// pending, fired, cancelled or failed.
	Status string `json:"status"`
	// MovedFrom is the time the agent set, once the person has moved it.
	MovedFrom      string `json:"moved_from,omitempty"`
	IdempotencyKey string `json:"idempotency_key,omitempty"`
	// CancelReason is agent, person or archived.
	CancelReason string `json:"cancel_reason,omitempty"`
	CancelledAt  string `json:"cancelled_at,omitempty"`
	// ArchivedAt names the archive that cancelled this wake, so that the
	// archive notice's undo restores exactly those.
	ArchivedAt string `json:"archived_at,omitempty"`
	// Tell: the cancellation is told to the agent with the person's next
	// message; cleared once Pi accepted that message.
	Tell        bool   `json:"tell,omitempty"`
	FiredAt     string `json:"fired_at,omitempty"`
	LateSeconds int64  `json:"late_seconds,omitempty"`
	Attempts    int    `json:"attempts,omitempty"`
	LastAttempt string `json:"last_attempt,omitempty"`
}

type wakesFile struct {
	SchemaVersion int             `json:"schema_version"`
	Wakes         []scheduledWake `json:"wakes"`
}

func (w scheduledWake) at() time.Time {
	t, _ := time.Parse(time.RFC3339Nano, w.At)
	return t
}

func stamp(t time.Time) string { return t.UTC().Format(time.RFC3339Nano) }

func validStamp(s string) bool {
	_, err := time.Parse(time.RFC3339Nano, s)
	return err == nil
}

func validWakeNote(note string) bool {
	return strings.TrimSpace(note) != "" && len(note) <= maxWakeNote && !strings.ContainsRune(note, 0)
}

func (w scheduledWake) valid() bool {
	if !wakeIDPattern.MatchString(w.ID) || !validTurnMarkKey(w.AgentID) || !validStamp(w.At) || !validStamp(w.SetAt) || !validWakeNote(w.Note) || w.SetBy != "agent" || w.Attempts < 0 || w.LateSeconds < 0 {
		return false
	}
	for _, s := range []string{w.MovedFrom, w.CancelledAt, w.ArchivedAt, w.FiredAt, w.LastAttempt} {
		if s != "" && !validStamp(s) {
			return false
		}
	}
	if w.IdempotencyKey != "" && !sessionIDPattern.MatchString(w.IdempotencyKey) {
		return false
	}
	switch w.Status {
	case "pending", "fired", "failed":
		return w.CancelReason == ""
	case "cancelled":
		return w.CancelReason == "agent" || w.CancelReason == "person" || w.CancelReason == "archived"
	}
	return false
}

// errWakesUnreadable: the wakes file could not be read, so nothing in it was
// changed. An archive goes ahead then; there is no wake it could cancel.
var errWakesUnreadable = errors.New("wakes unreadable")

// wakesLock serializes every read-change-replace of the file in the daemon.
var wakesLock sync.Mutex

// readWakes returns the person's wakes. A missing file is none; an unsafe or
// unreadable one is an error, never silently empty, so a write does not
// replace wakes it could not read.
func readWakes(home string) (wakesFile, error) {
	result := wakesFile{SchemaVersion: 1}
	dir, err := personalDir(home, false, ".local", "state", "open-habitat")
	if errors.Is(err, os.ErrNotExist) {
		return result, nil
	}
	if err != nil {
		return result, err
	}
	defer dir.Close()
	b, err := readOwnedFile(dir, "wakes.json", maxWakesFileSize)
	if errors.Is(err, os.ErrNotExist) {
		return result, nil
	}
	if err != nil {
		return result, err
	}
	var value wakesFile
	dec := json.NewDecoder(bytes.NewReader(b))
	dec.DisallowUnknownFields()
	if dec.Decode(&value) != nil || dec.Decode(new(any)) != io.EOF || value.SchemaVersion != 1 || len(value.Wakes) > maxWakeRecords+2*maxPendingWakes {
		return result, errors.New("invalid wakes file")
	}
	seen := map[string]bool{}
	for _, w := range value.Wakes {
		if !w.valid() || seen[w.ID] {
			return result, errors.New("invalid wakes file")
		}
		seen[w.ID] = true
	}
	return value, nil
}

// readOwnedFile reads a regular file the person owns and nobody else can
// write.
func readOwnedFile(dir *os.File, name string, limit int64) ([]byte, error) {
	fd, err := unix.Openat(int(dir.Fd()), name, unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, err
	}
	f := os.NewFile(uintptr(fd), name)
	defer f.Close()
	var st unix.Stat_t
	if err = unix.Fstat(fd, &st); err != nil {
		return nil, err
	}
	if st.Mode&unix.S_IFMT != unix.S_IFREG || st.Size > limit || st.Mode&0022 != 0 || st.Uid != uint32(os.Geteuid()) {
		return nil, errors.New("unsafe file")
	}
	b, err := io.ReadAll(io.LimitReader(f, limit+1))
	if err != nil || int64(len(b)) > limit {
		return nil, errors.New("unsafe file")
	}
	return b, nil
}

// saveWakes prunes old records and replaces the file atomically.
func saveWakes(home string, value wakesFile, now time.Time) error {
	var pending, tell, done []scheduledWake
	for _, w := range value.Wakes {
		if w.Status == "pending" {
			pending = append(pending, w)
			continue
		}
		if w.Tell {
			tell = append(tell, w)
			continue
		}
		ended := w.FiredAt
		if ended == "" {
			ended = w.CancelledAt
		}
		if ended == "" {
			ended = w.LastAttempt
		}
		if t, err := time.Parse(time.RFC3339Nano, ended); err == nil && now.Sub(t) > wakeRecordMaxAge {
			continue
		}
		done = append(done, w)
	}
	// Every saved file must be one readWakes accepts: pending wakes are
	// capped at creation, the cancellations still to tell at 100 (the
	// oldest are no longer told), and the history gets what is left.
	if len(tell) > maxPendingWakes {
		for i := range tell[:len(tell)-maxPendingWakes] {
			tell[i].Tell = false
		}
		done = append(done, tell[:len(tell)-maxPendingWakes]...)
		tell = tell[len(tell)-maxPendingWakes:]
	}
	room := max(0, maxWakeRecords+maxPendingWakes-len(pending)-len(tell))
	room = min(room, maxWakeRecords)
	if len(done) > room {
		done = done[len(done)-room:]
	}
	pending = append(pending, tell...)
	value.Wakes = append(pending, done...)
	sort.SliceStable(value.Wakes, func(i, j int) bool { return value.Wakes[i].SetAt < value.Wakes[j].SetAt })
	value.SchemaVersion = 1
	if value.Wakes == nil {
		value.Wakes = []scheduledWake{}
	}
	var b bytes.Buffer
	enc := json.NewEncoder(&b)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(value)
	if b.Len() > maxWakesFileSize {
		return errors.New("wakes exceed readable bound")
	}
	dir, err := personalDir(home, true, ".local", "state", "open-habitat")
	if err != nil {
		return err
	}
	defer dir.Close()
	return writePersonalFile(dir, "wakes.json", b.Bytes())
}

func newWakeID() (string, error) {
	var random [8]byte
	if _, err := rand.Read(random[:]); err != nil {
		return "", err
	}
	return "wk_" + hex.EncodeToString(random[:]), nil
}

// changeWakes runs change on the person's wakes under the lock and saves
// them when it says so.
func changeWakes(home string, now time.Time, change func(*wakesFile) (bool, error)) error {
	wakesLock.Lock()
	defer wakesLock.Unlock()
	value, err := readWakes(home)
	if err != nil {
		return errWakesUnreadable
	}
	save, err := change(&value)
	if err != nil || !save {
		return err
	}
	return saveWakes(home, value, now)
}

func pendingWakes(value wakesFile) []scheduledWake {
	var out []scheduledWake
	for _, w := range value.Wakes {
		if w.Status == "pending" {
			out = append(out, w)
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].at().Before(out[j].at()) })
	return out
}

// wakeView is a wake on the wire (agent-wake.schema.json#/$defs/wake).
func wakeView(w scheduledWake) map[string]any {
	v := map[string]any{"id": w.ID, "agent_id": w.AgentID, "at": w.At, "note": w.Note, "set_by": w.SetBy, "set_at": w.SetAt, "status": w.Status}
	if w.MovedFrom != "" {
		v["moved_from"] = w.MovedFrom
	}
	if w.CancelReason != "" {
		v["cancel_reason"] = w.CancelReason
		v["cancelled_at"] = w.CancelledAt
	}
	if w.FiredAt != "" {
		v["fired_at"] = w.FiredAt
		if w.LateSeconds > 0 {
			v["late_seconds"] = w.LateSeconds
		}
	}
	return v
}

// snapshotWakes is what the snapshot shows of one conversation's wakes: the
// pending ones in time order, and the latest that fired.
func snapshotWakes(value wakesFile, agentID string) ([]map[string]any, map[string]any) {
	var pending []map[string]any
	var last *scheduledWake
	for _, w := range pendingWakes(value) {
		if w.AgentID == agentID {
			v := map[string]any{"id": w.ID, "at": w.At, "note": w.Note, "set_by": w.SetBy, "set_at": w.SetAt}
			if w.MovedFrom != "" {
				v["moved_from"] = w.MovedFrom
			}
			pending = append(pending, v)
		}
	}
	for i := range value.Wakes {
		w := value.Wakes[i]
		if w.AgentID == agentID && w.Status == "fired" && (last == nil || w.FiredAt > last.FiredAt) {
			last = &value.Wakes[i]
		}
	}
	if last == nil {
		return pending, nil
	}
	fired := map[string]any{"at": last.At, "fired_at": last.FiredAt}
	if last.LateSeconds > 0 {
		fired["late_seconds"] = last.LateSeconds
	}
	return pending, fired
}

// ---- The agent's commands ----

// wakeQuery is the agent's target: its own live launch (--current), or the
// person's every wake for `wake list --all`.
type wakeQuery struct {
	agentConversationQuery
	all bool
}

func parseWakeQuery(r *http.Request) (wakeQuery, bool) {
	q, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		return wakeQuery{}, true
	}
	if len(q) == 1 && len(q["all"]) == 1 && q.Get("all") == "true" {
		return wakeQuery{all: true}, false
	}
	conv, bad := parseAgentConversation(r)
	if bad || !conv.current {
		return wakeQuery{}, true
	}
	return wakeQuery{agentConversationQuery: conv}, false
}

func (c *ConversationController) wakeNow() time.Time {
	if c.wakeClock != nil {
		return c.wakeClock()
	}
	return time.Now()
}

// agentWakes serves /agent/v1/wakes and /agent/v1/wakes/<id>|due. The socket
// admits only the person's own Unix user. Creating, changing and deleting
// need the conversation's live launch context, so an agent touches only its
// own conversation's wakes; `due` needs nothing, because all it can do is
// fire what is due, which the person's own timer does anyway.
func (c *ConversationController) agentWakes(w http.ResponseWriter, r *http.Request) {
	if c == nil || c.home == "" {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	rest := strings.TrimPrefix(r.URL.Path, AgentWakesPath)
	if rest == "/due" {
		if r.Method != http.MethodPost || r.URL.RawQuery != "" {
			snapshotError(w, 400, "invalid_arguments")
			return
		}
		// Firing can start several Pi processes; the timer's oneshot only
		// needs to know the daemon took the work, so it runs on here.
		value, err := readWakes(c.home)
		if err != nil {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		due, now := 0, c.wakeNow()
		var next time.Time
		for _, wk := range pendingWakes(value) {
			if !wk.at().After(now) {
				due++
			} else if next.IsZero() {
				next = wk.at()
			}
		}
		go c.processDueWakes(context.Background())
		reply := map[string]any{"schema_version": 1, "due": due}
		if !next.IsZero() {
			reply["next_at"] = stamp(next)
		}
		historyJSON(w, reply)
		return
	}
	id := ""
	if rest != "" {
		id = strings.TrimPrefix(rest, "/")
		if !strings.HasPrefix(rest, "/") || !wakeIDPattern.MatchString(id) {
			snapshotError(w, 404, "route_not_found")
			return
		}
	}
	q, bad := parseWakeQuery(r)
	if bad || q.all && (id != "" || r.Method != http.MethodGet) {
		snapshotError(w, 400, "invalid_arguments")
		return
	}
	if !q.all && c.staleLaunch(q.agentConversationQuery) {
		snapshotError(w, 409, "current_context_stale")
		return
	}
	switch {
	case r.Method == http.MethodGet && id == "":
		value, err := readWakes(c.home)
		if err != nil {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		list := []map[string]any{}
		for _, wk := range value.Wakes {
			if q.all && wk.Status == "pending" || !q.all && wk.AgentID == q.id {
				list = append(list, wakeView(wk))
			}
		}
		historyJSON(w, map[string]any{"schema_version": 1, "wakes": list, "pending_limit": maxPendingWakes})
	case r.Method == http.MethodPost && id == "":
		var body struct {
			At             string `json:"at"`
			Note           string `json:"note"`
			IdempotencyKey string `json:"idempotency_key"`
		}
		if !decodeAgentBody(w, r, 4096, &body) {
			return
		}
		reply, status, code := c.createWake(q.agentConversationQuery, body.At, body.Note, body.IdempotencyKey)
		if status != 0 {
			snapshotError(w, status, code)
			return
		}
		historyJSON(w, reply)
	case r.Method == http.MethodPatch && id != "":
		var body struct {
			At   *string `json:"at"`
			Note *string `json:"note"`
		}
		if !decodeAgentBody(w, r, 4096, &body) {
			return
		}
		if body.At == nil && body.Note == nil {
			snapshotError(w, 400, "invalid_arguments")
			return
		}
		wk, status, code := c.changeWake(q.id, id, body.At, body.Note, false)
		if status != 0 {
			snapshotError(w, status, code)
			return
		}
		historyJSON(w, map[string]any{"schema_version": 1, "wake": wakeView(wk)})
	case r.Method == http.MethodDelete && id != "":
		if r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_arguments")
			return
		}
		wk, status, code := c.cancelWake(q.id, id, "agent")
		if status != 0 {
			snapshotError(w, status, code)
			return
		}
		historyJSON(w, map[string]any{"schema_version": 1, "wake": wakeView(wk)})
	default:
		snapshotError(w, 404, "route_not_found")
	}
}

func decodeAgentBody(w http.ResponseWriter, r *http.Request, limit int64, target any) bool {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, limit))
	decoder.DisallowUnknownFields()
	if decoder.Decode(target) != nil || decoder.Decode(new(any)) != io.EOF {
		snapshotError(w, 400, "invalid_arguments")
		return false
	}
	return true
}

// parseWakeTime accepts RFC 3339 with an explicit offset or Z only, so the
// agent never relies on a zone Habitat would have to guess.
func parseWakeTime(at string) (time.Time, bool) {
	t, err := time.Parse(time.RFC3339, at)
	if err != nil || t.Year() > 9999 {
		return time.Time{}, false
	}
	return t, true
}

// createWake stores a new wake for the verified current launch q and places
// the conversation in Hiljaiset while the turn runs. A repeat with the same
// idempotency key returns the stored wake (replayed) when its time and note
// agree and is refused when they do not.
func (c *ConversationController) createWake(q agentConversationQuery, at, note, key string) (map[string]any, int, string) {
	when, ok := parseWakeTime(at)
	if !ok || !validWakeNote(note) || key != "" && !sessionIDPattern.MatchString(key) {
		return nil, 400, "invalid_arguments"
	}
	now := c.wakeNow()
	if !when.After(now) {
		return nil, 409, "wake_time_past"
	}
	visibility, err := loadVisibility(c.home)
	if archiveFact(visibility, err, q.id) != "active" {
		return nil, 409, "conversation_archived"
	}
	var made scheduledWake
	replayed := false
	status, code := 0, ""
	err = changeWakes(c.home, now, func(value *wakesFile) (bool, error) {
		if key != "" {
			for _, w := range value.Wakes {
				if w.IdempotencyKey == key && w.AgentID == q.id {
					if !w.at().Equal(when) || w.Note != note {
						status, code = 409, "idempotency_conflict"
						return false, nil
					}
					made, replayed = w, true
					return false, nil
				}
			}
		}
		if len(pendingWakes(*value)) >= maxPendingWakes {
			status, code = 409, "wake_limit_reached"
			return false, nil
		}
		id, err := newWakeID()
		if err != nil {
			return false, err
		}
		made = scheduledWake{ID: id, AgentID: q.id, At: stamp(when), Note: note, SetBy: "agent", SetAt: stamp(now), Status: "pending", IdempotencyKey: key}
		value.Wakes = append(value.Wakes, made)
		return true, nil
	})
	if err != nil {
		return nil, 503, "native_source_unavailable"
	}
	if status != 0 {
		return nil, status, code
	}
	reply := map[string]any{"schema_version": 1, "wake": wakeView(made), "replayed": replayed}
	if !replayed {
		diagnostic.New(os.Stderr, "daemon").Info("scheduled_wake", "outcome", "created", "agent_id", q.id, "wake_id", made.ID)
		// Waiting for a wake is the reason Hiljaiset needs; one command, so
		// the agent cannot leave a waiting conversation in Sinun vuorosi.
		if section, s, _ := c.chooseSection(q, "quiet"); s == 0 {
			reply["agent_section"] = section["agent_section"]
		}
		c.wakesChanged(q.id)
	}
	return reply, 0, ""
}

// changeWake moves a pending wake or changes its note. The person can only
// move it (byPerson); the first time the agent set is kept as moved_from, and
// the wake message tells the agent of the move.
func (c *ConversationController) changeWake(agentID, id string, at, note *string, byPerson bool) (scheduledWake, int, string) {
	var when time.Time
	if at != nil {
		t, ok := parseWakeTime(*at)
		if !ok {
			return scheduledWake{}, 400, "invalid_arguments"
		}
		when = t
	}
	if note != nil && (byPerson || !validWakeNote(*note)) {
		return scheduledWake{}, 400, "invalid_arguments"
	}
	now := c.wakeNow()
	if at != nil && !when.After(now) {
		return scheduledWake{}, 409, "wake_time_past"
	}
	var out scheduledWake
	status, code := 0, ""
	err := changeWakes(c.home, now, func(value *wakesFile) (bool, error) {
		for i := range value.Wakes {
			w := &value.Wakes[i]
			if w.ID != id || w.AgentID != agentID {
				continue
			}
			if w.Status != "pending" {
				status, code, out = 409, "wake_not_pending", *w
				return false, nil
			}
			if at != nil && !w.at().Equal(when) {
				if byPerson && w.MovedFrom == "" {
					w.MovedFrom = w.At
				}
				w.At = stamp(when)
				w.Attempts, w.LastAttempt = 0, ""
			}
			if note != nil {
				w.Note = *note
			}
			out = *w
			return true, nil
		}
		status, code = 404, "wake_not_found"
		return false, nil
	})
	if err != nil {
		return scheduledWake{}, 503, "native_source_unavailable"
	}
	if status != 0 {
		return out, status, code
	}
	c.wakesChanged(agentID)
	return out, 0, ""
}

// cancelWake cancels one pending wake. A cancellation the agent did not make
// itself is told to it with the person's next message, not as a turn of its
// own: a turn just to say "cancelled" would spend a model call and raise the
// conversation for nothing.
func (c *ConversationController) cancelWake(agentID, id, reason string) (scheduledWake, int, string) {
	now := c.wakeNow()
	var out scheduledWake
	status, code := 0, ""
	err := changeWakes(c.home, now, func(value *wakesFile) (bool, error) {
		for i := range value.Wakes {
			w := &value.Wakes[i]
			if w.ID != id || w.AgentID != agentID {
				continue
			}
			if w.Status != "pending" {
				status, code, out = 409, "wake_not_pending", *w
				return false, nil
			}
			w.Status, w.CancelReason, w.CancelledAt = "cancelled", reason, stamp(now)
			w.Tell = reason != "agent"
			out = *w
			return true, nil
		}
		status, code = 404, "wake_not_found"
		return false, nil
	})
	if err != nil {
		return scheduledWake{}, 503, "native_source_unavailable"
	}
	if status != 0 {
		return out, status, code
	}
	c.wakesChanged(agentID)
	return out, 0, ""
}

// personWake is POST /api/v1/conversations/<id>/wake: the person's Muuta
// aikaa… (move) or Peru herätys (cancel) on a pending wake.
func (c *ConversationController) personWake(w http.ResponseWriter, r *http.Request, id string) {
	var body struct {
		Action string `json:"action"`
		WakeID string `json:"wake_id"`
		At     string `json:"at,omitempty"`
	}
	if decodeControl(r, &body, 1024) != nil || !wakeIDPattern.MatchString(body.WakeID) || (body.Action == "move") == (body.At == "") || body.Action != "move" && body.Action != "cancel" {
		snapshotError(w, 400, "invalid_request")
		return
	}
	if c.home == "" {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	var wk scheduledWake
	var status int
	var code string
	if body.Action == "move" {
		wk, status, code = c.changeWake("pi:"+id, body.WakeID, &body.At, nil, true)
	} else {
		wk, status, code = c.cancelWake("pi:"+id, body.WakeID, "person")
	}
	if status != 0 {
		snapshotError(w, status, code)
		return
	}
	reply := map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "wake": wakeView(wk)}
	if c.journal != nil {
		if cursor := c.journal.appendInvalidation("pi:" + id); cursor != "" {
			reply["event_cursor"] = cursor
		}
	}
	historyJSON(w, reply)
}

// wakesChanged republishes the conversation and moves both timers to the
// next pending wake.
func (c *ConversationController) wakesChanged(agentID string) {
	if c.journal != nil && agentID != "" {
		c.journal.appendInvalidation(agentID)
	}
	c.scheduleWakes()
}

// ---- Archive ----

// archiveCancelsWakes cancels the conversation's pending wakes in the same
// operation as its archive, stamped archivedAt; it runs before the archive is
// committed, which fails if this does. Nothing is sent to an archived agent.
func (c *ConversationController) archiveCancelsWakes(agentID, archivedAt string) error {
	if c.home == "" {
		return nil
	}
	changed := false
	now := c.wakeNow()
	err := changeWakes(c.home, now, func(value *wakesFile) (bool, error) {
		for i := range value.Wakes {
			w := &value.Wakes[i]
			if w.AgentID == agentID && w.Status == "pending" {
				w.Status, w.CancelReason, w.CancelledAt, w.ArchivedAt = "cancelled", "archived", stamp(now), archivedAt
				changed = true
			}
		}
		return changed, nil
	})
	if err == nil && changed {
		c.scheduleWakes()
	}
	return err
}

// restoreWakes runs when the archived conversation is restored from the
// archive stamped archivedAt, before the restore is committed. The archive
// notice's undo (restoreArchived) brings back the wakes that archive
// cancelled, as they were; a later restore does not, and the agent hears of
// the cancellation with the person's next message. undo reverses it, for a
// restore whose commit then failed.
func (c *ConversationController) restoreWakes(agentID, archivedAt string, restoreArchived bool) (undo func(), err error) {
	undo = func() {}
	if c.home == "" || archivedAt == "" {
		return undo, nil
	}
	var touched []string
	err = changeWakes(c.home, c.wakeNow(), func(value *wakesFile) (bool, error) {
		for i := range value.Wakes {
			w := &value.Wakes[i]
			if w.AgentID != agentID || w.Status != "cancelled" || w.CancelReason != "archived" || w.ArchivedAt != archivedAt || w.Tell {
				continue
			}
			if restoreArchived {
				w.Status, w.CancelReason, w.CancelledAt, w.ArchivedAt = "pending", "", "", ""
				w.Attempts, w.LastAttempt = 0, ""
			} else {
				w.Tell = true
			}
			touched = append(touched, w.ID)
		}
		return len(touched) > 0, nil
	})
	if err != nil || len(touched) == 0 {
		return undo, err
	}
	// The undo puts the conversation back as it was: waiting for its wake in
	// Hiljaiset, until the next turn or the person's message.
	if restoreArchived {
		_, _, _ = setAgentSection(c.home, agentID, "quiet", c.wakeNow())
	}
	c.scheduleWakes()
	undo = func() {
		if restoreArchived {
			_ = c.archiveCancelsWakes(agentID, archivedAt)
			return
		}
		set := map[string]bool{}
		for _, id := range touched {
			set[id] = true
		}
		_ = changeWakes(c.home, c.wakeNow(), func(value *wakesFile) (bool, error) {
			for i := range value.Wakes {
				if set[value.Wakes[i].ID] {
					value.Wakes[i].Tell = false
				}
			}
			return true, nil
		})
	}
	return undo, nil
}

// ---- Telling the agent of a cancellation ----

// wakesToTell lists the conversation's cancellations the agent has not heard
// of yet.
func (c *ConversationController) wakesToTell(agentID string) []scheduledWake {
	if c.home == "" {
		return nil
	}
	value, err := readWakes(c.home)
	if err != nil {
		return nil
	}
	var out []scheduledWake
	for _, w := range value.Wakes {
		if w.AgentID == agentID && w.Tell {
			out = append(out, w)
		}
	}
	return out
}

// tellCancelledWakes queues the cancellations for Pi's next prompt through
// the companion (deliverAs nextTurn) just before the person's message is
// written, and returns those it queued. A companion that cannot be reached
// leaves them to be told with a later message.
func (c *ConversationController) tellCancelledWakes(s *conversation) []string {
	tell := c.wakesToTell("pi:" + s.id)
	if len(tell) == 0 || s.rpc == nil || s.rpc.processGeneration == "" {
		return nil
	}
	// One batch within the bridge's frame (32 KiB) and the companion's 100
	// items; the rest go with the next message.
	items := make([]map[string]any, 0, len(tell))
	ids := make([]string, 0, len(tell))
	size := 512
	for _, w := range tell {
		item := map[string]any{"id": w.ID, "at": w.At, "note": w.Note, "reason": w.CancelReason, "cancelled_at": w.CancelledAt}
		b, _ := json.Marshal(item)
		if len(items) == maxPendingWakes || size+len(b)+1 > 24<<10 {
			break
		}
		size += len(b) + 1
		items = append(items, item)
		ids = append(ids, w.ID)
	}
	var outcome struct {
		Told bool `json:"told"`
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if s.rpc.processRequest(ctx, map[string]any{"op": "wake_tell", "session_id": s.id, "generation": s.rpc.processGeneration, "cancelled": items}, &outcome) != nil || !outcome.Told {
		return nil
	}
	return ids
}

// wakesTold clears the cancellations Pi accepted with the person's message.
func (c *ConversationController) wakesTold(ids []string) {
	if len(ids) == 0 || c.home == "" {
		return
	}
	set := map[string]bool{}
	for _, id := range ids {
		set[id] = true
	}
	_ = changeWakes(c.home, c.wakeNow(), func(value *wakesFile) (bool, error) {
		changed := false
		for i := range value.Wakes {
			if set[value.Wakes[i].ID] && value.Wakes[i].Tell {
				value.Wakes[i].Tell = false
				changed = true
			}
		}
		return changed, nil
	})
}

// ---- Firing ----

// wakeTimerEnv writes and drives the person's user timer. Tests and the
// browser host replace the user manager.
type wakeTimerEnv struct {
	home string
	// exe is the stable launch path of this binary
	// (/opt/open-habitat/current/open-habitat), which survives upgrades.
	exe          string
	userManager  func(ctx context.Context, args ...string) error
	managerReady func() bool
	// applied is the next wake the user manager last accepted completely;
	// matching unit files alone do not prove the timer runs. Guarded by
	// the controller's wakeSync.
	applied   time.Time
	appliedOK bool
}

func wakeServiceText(exe string) string {
	return "# Written by Open Habitat: fires this account's scheduled conversation\n" +
		"# wakes. It only asks the account's own Open Habitat daemon to wake what is\n" +
		"# due; the daemon removes it when no wake is pending.\n" +
		"[Unit]\nDescription=Open Habitat: wake scheduled conversations\n\n" +
		"[Service]\nType=oneshot\nExecStart=" + exe + " agent wake due --json\n" +
		"UMask=0077\nNoNewPrivileges=yes\n"
}

// wakeTimerText fires at the next wake, and after the user manager starts at
// boot so a wake missed while the host was off fires late rather than never.
func wakeTimerText(next time.Time) string {
	return "# Written by Open Habitat: the next scheduled conversation wake. The\n" +
		"# daemon rewrites it after every change and removes it when none is pending.\n" +
		"[Unit]\nDescription=Open Habitat: next scheduled conversation wake\n\n" +
		"[Timer]\nOnCalendar=" + next.UTC().Format("2006-01-02 15:04:05") + " UTC\n" +
		"OnStartupSec=30s\nPersistent=true\nAccuracySec=1s\n\n" +
		"[Install]\nWantedBy=timers.target\n"
}

// sync makes the user timer match next; zero next removes it. It reports
// whether the units are as wanted.
func (e *wakeTimerEnv) sync(ctx context.Context, next time.Time) error {
	unitDir, err := personalDir(e.home, !next.IsZero(), ".config", "systemd", "user")
	if errors.Is(err, os.ErrNotExist) && next.IsZero() {
		return nil
	}
	if err != nil {
		return err
	}
	defer unitDir.Close()
	if next.IsZero() {
		e.appliedOK = false
		_, timerErr := readOwnedFile(unitDir, wakeTimerUnit, 65536)
		if errors.Is(timerErr, os.ErrNotExist) {
			return nil
		}
		if e.managerReady() {
			_ = e.userManager(ctx, "disable", "--now", wakeTimerUnit)
		}
		_ = unix.Unlinkat(int(unitDir.Fd()), wakeTimerUnit, 0)
		_ = unix.Unlinkat(int(unitDir.Fd()), wakeServiceUnit, 0)
		if e.managerReady() {
			_ = e.userManager(ctx, "daemon-reload")
		}
		return nil
	}
	if !e.managerReady() {
		return errUserManager
	}
	service := writeIfChanged(unitDir, wakeServiceUnit, []byte(wakeServiceText(e.exe)))
	timer := writeIfChanged(unitDir, wakeTimerUnit, []byte(wakeTimerText(next)))
	if service == nil || timer == nil {
		e.appliedOK = false
		return errors.New("wake units not written")
	}
	if !*service && !*timer && e.appliedOK && e.applied.Equal(next) {
		return nil
	}
	e.appliedOK = false
	for _, args := range [][]string{{"daemon-reload"}, {"enable", wakeTimerUnit}, {"restart", wakeTimerUnit}} {
		if err = e.userManager(ctx, args...); err != nil {
			return errUserManager
		}
	}
	e.applied, e.appliedOK = next, true
	return nil
}

// watchScheduledWakes fires what is overdue when the daemon starts, then
// keeps the in-process timer on the next wake until the daemon stops.
func (c *ConversationController) watchScheduledWakes(ctx context.Context) {
	c.wakeMu.Lock()
	c.wakeKick = make(chan struct{}, 1)
	c.wakeMu.Unlock()
	c.processDueWakes(ctx)
	for {
		c.wakeMu.Lock()
		next := c.wakeNext
		kick := c.wakeKick
		c.wakeMu.Unlock()
		var fire <-chan time.Time
		if !next.IsZero() {
			wait := time.Until(next)
			if c.wakeClock != nil {
				wait = next.Sub(c.wakeClock())
			}
			timer := time.NewTimer(max(wait, 0))
			fire = timer.C
			select {
			case <-ctx.Done():
				timer.Stop()
				return
			case <-kick:
				timer.Stop()
				continue
			case <-fire:
			}
		} else {
			select {
			case <-ctx.Done():
				return
			case <-kick:
				continue
			}
		}
		c.processDueWakes(ctx)
	}
}

// scheduleWakes moves both timers to the next wake after a change.
func (c *ConversationController) scheduleWakes() {
	go c.reconcileWakes()
}

// nextWake is when the next pending wake is due, or a retry of an overdue
// one.
func (c *ConversationController) nextWake() time.Time {
	value, err := readWakes(c.home)
	if err != nil {
		return time.Time{}
	}
	var next time.Time
	for _, w := range pendingWakes(value) {
		due := w.at()
		if w.LastAttempt != "" {
			if t, err := time.Parse(time.RFC3339Nano, w.LastAttempt); err == nil && t.Add(wakeRetryEvery).After(due) {
				due = t.Add(wakeRetryEvery)
			}
		}
		if next.IsZero() || due.Before(next) {
			next = due
		}
	}
	return next
}

// reconcileWakes reads the stored wakes and applies the next one to both
// timers, under one lock from the read to the last user-manager call, so
// a reconcile that read older state can never apply after a newer one.
func (c *ConversationController) reconcileWakes() time.Time {
	c.wakeSync.Lock()
	defer c.wakeSync.Unlock()
	next := c.nextWake()
	c.wakeMu.Lock()
	c.wakeNext = next
	kick := c.wakeKick
	timer := c.wakeTimer
	c.wakeMu.Unlock()
	if kick != nil {
		select {
		case kick <- struct{}{}:
		default:
		}
	}
	if timer != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
		defer cancel()
		if err := timer.sync(ctx, next); err != nil {
			diagnostic.New(os.Stderr, "daemon").Warn("scheduled_wake_timer", "outcome", "failed", "reason", err.Error())
		}
	}
	return next
}

// processDueWakes fires every pending wake whose time has come, one at a
// time, and returns how many fired and when the next one is due.
func (c *ConversationController) processDueWakes(ctx context.Context) (int, time.Time) {
	if c.home == "" {
		return 0, time.Time{}
	}
	c.wakeFire.Lock()
	fired := 0
	now := c.wakeNow()
	value, err := readWakes(c.home)
	if err == nil {
		for _, w := range pendingWakes(value) {
			if ctx.Err() != nil || w.at().After(now) {
				break
			}
			if w.LastAttempt != "" {
				if t, e := time.Parse(time.RFC3339Nano, w.LastAttempt); e == nil && now.Sub(t) < wakeRetryEvery {
					continue
				}
			}
			if c.fireWake(ctx, w, now) {
				fired++
			}
		}
	}
	c.wakeFire.Unlock()
	return fired, c.reconcileWakes()
}

// fireWake delivers one due wake and records the outcome.
func (c *ConversationController) fireWake(ctx context.Context, w scheduledWake, now time.Time) bool {
	log := diagnostic.New(os.Stderr, "daemon")
	late := int64(0)
	if d := now.Sub(w.at()); d > wakeLateAfter {
		late = int64(d / time.Second)
	}
	// The person may move or cancel the wake while an earlier one fires or
	// this conversation's Pi starts: it is read again right before it is
	// sent, and a changed wake is not sent.
	current := func() bool {
		value, err := readWakes(c.home)
		if err != nil {
			return false
		}
		for _, x := range value.Wakes {
			if x.ID == w.ID {
				return x.Status == "pending" && x.At == w.At
			}
		}
		return false
	}
	if !current() {
		return false
	}
	problem, retry := c.deliverWake(ctx, w, now, late, current)
	if problem == "superseded" {
		return false
	}
	outcome := "fired"
	err := changeWakes(c.home, now, func(value *wakesFile) (bool, error) {
		for i := range value.Wakes {
			x := &value.Wakes[i]
			// A wake moved after it was sent keeps its new time.
			if x.ID != w.ID || x.Status != "pending" || problem == "" && x.At != w.At {
				continue
			}
			switch {
			case problem == "":
				x.Status, x.FiredAt, x.LateSeconds = "fired", stamp(now), late
			case problem == "not_active":
				// Archived meanwhile: the archive cancels; nothing is sent.
				x.Status, x.CancelReason, x.CancelledAt = "cancelled", "archived", stamp(now)
				outcome = "cancelled"
			case problem == "busy":
				// A turn runs: the wake waits for it to end, without
				// counting against the retries.
				x.LastAttempt = stamp(now)
				outcome = "waiting"
			case retry && x.Attempts+1 < wakeMaxAttempts:
				x.Attempts++
				x.LastAttempt = stamp(now)
				outcome = "retry"
			default:
				x.Status, x.LastAttempt = "failed", stamp(now)
				x.Attempts++
				outcome = "failed"
			}
			return true, nil
		}
		return false, nil
	})
	if err != nil {
		// A delivered wake still recorded pending is sent again; the
		// companion recognises its id in the branch and starts no second turn.
		outcome = outcome + "_unrecorded"
	}
	log.Info("scheduled_wake", "outcome", outcome, "reason", problem, "agent_id", w.AgentID, "wake_id", w.ID, "late_seconds", late)
	if c.journal != nil {
		c.journal.appendInvalidation(w.AgentID)
	}
	return problem == ""
}

// deliverWake gives the agent its wake turn: as a person's message would, it
// starts a stopped Pi, then asks the companion to send Habitat's wake message
// (process-extension.mjs, op "scheduled_wake"). A Pi in a turn is left to
// finish it ("busy"): Pi would queue the message only in memory, where a stop
// before the turn ends would lose a wake already recorded as fired. still
// says whether the wake is unchanged; "superseded" is a wake moved or
// cancelled meanwhile. "" is delivered; otherwise the problem, and whether to
// try again later.
func (c *ConversationController) deliverWake(ctx context.Context, w scheduledWake, now time.Time, late int64, still func() bool) (string, bool) {
	id := strings.TrimPrefix(w.AgentID, "pi:")
	if c.wakeDeliver != nil {
		return c.wakeDeliver(w, late)
	}
	active := func() bool {
		visibility, err := loadVisibility(c.home)
		return archiveFact(visibility, err, w.AgentID) == "active"
	}
	c.mu.Lock()
	s := c.sessions[id]
	live := s != nil && liveChild(s) && !s.dead
	c.mu.Unlock()
	if !live {
		origin, err := c.resumableOrigin(id)
		if err != nil {
			if !active() {
				return "not_active", false
			}
			return "read_only_history", false
		}
		release, ok := c.proofPermit(ctx)
		if !ok {
			return "source_unavailable", true
		}
		if !active() {
			release()
			return "not_active", false
		}
		c.mu.Lock()
		old := c.sessions[id]
		if c.closed || old != nil && (liveChild(old) || old.state != "stopped" && old.state != "start_failed" || len(old.held) > 0) {
			c.mu.Unlock()
			release()
			return "busy", true
		}
		if old == nil {
			if !c.makeRecordRoom() {
				c.mu.Unlock()
				release()
				return "session_records_exhausted", true
			}
			old = &conversation{id: id, workspace: origin.Workspace, cwd: origin.Cwd, rpc: stoppedRPC(), state: "stopped", dead: true, events: make([]json.RawMessage, 0, 64), commands: make(map[string]bool)}
			c.sessions[id] = old
		}
		c.mu.Unlock()
		started, problem := c.resume(id, old, startAutoWake)
		release()
		if problem != "" {
			return problem, true
		}
		deadline := time.Now().Add(piReadyTimeout + 15*time.Second)
		for {
			c.mu.Lock()
			starting := c.sessions[id] == started && started.state == "starting"
			c.mu.Unlock()
			if !starting || time.Now().After(deadline) || ctx.Err() != nil {
				break
			}
			time.Sleep(100 * time.Millisecond)
		}
		s = started
	}
	// While the wake's turn begins, a message the person sends is held for
	// after it (sendKind), so the two never race into Pi.
	c.mu.Lock()
	if c.closed || c.sessions[id] != s || s.dead || !liveChild(s) || s.state == "starting" || s.state == "stopping" || s.waking || len(s.held) > 0 || s.compacting || s.rewinding {
		c.mu.Unlock()
		return "not_ready", true
	}
	if heldActivity(s) != "" {
		// A turn, a question or a held message: the wake waits its turn.
		c.mu.Unlock()
		return "busy", true
	}
	s.waking = true
	generation := s.rpc.processGeneration
	c.mu.Unlock()
	release := func() {
		c.mu.Lock()
		s.waking = false
		c.mu.Unlock()
		c.deliverHeld(s)
	}
	if !active() {
		release()
		return "not_active", false
	}
	if !still() {
		release()
		return "superseded", false
	}
	details := map[string]any{"id": w.ID, "at": w.At, "set_at": w.SetAt, "fired_at": stamp(now), "note": w.Note}
	if late > 0 {
		details["late_seconds"] = late
	}
	if w.MovedFrom != "" {
		details["moved_from"] = w.MovedFrom
	}
	var outcome struct {
		Woken  bool   `json:"woken"`
		Reason string `json:"reason"`
	}
	askCtx, cancel := context.WithTimeout(ctx, 6*time.Second)
	err := s.rpc.processRequest(askCtx, map[string]any{"op": "scheduled_wake", "session_id": id, "generation": generation, "wake": details}, &outcome)
	cancel()
	if err != nil || !outcome.Woken {
		release()
		if outcome.Reason == "" {
			outcome.Reason = "bridge_unavailable"
		}
		return outcome.Reason, true
	}
	c.mu.Lock()
	s.lastUsed = time.Now()
	c.mu.Unlock()
	{
		// The turn begins at Pi's agent_start, which ends the hold; should it
		// never come, the person's messages must not wait for it.
		turnDeadline := time.Now().Add(10 * time.Second)
		for {
			c.mu.Lock()
			waiting := c.sessions[id] == s && s.waking
			c.mu.Unlock()
			if !waiting || time.Now().After(turnDeadline) || ctx.Err() != nil {
				break
			}
			time.Sleep(100 * time.Millisecond)
		}
		release()
	}
	return "", false
}

// FixtureWake creates a wake for the conversation's live launch, as
// open-habitat agent wake create --current run by its Pi would. It is not
// mounted by the product and refuses outside the browser-host controller.
func (c *ConversationController) FixtureWake(id, at, note string) int {
	if !c.fixture || !strings.HasPrefix(id, "pi:") {
		return 400
	}
	c.mu.Lock()
	s := c.sessions[strings.TrimPrefix(id, "pi:")]
	q := agentConversationQuery{id: id, current: true}
	if s != nil && s.rpc != nil {
		q.workspace, q.generation = s.workspace, s.rpc.processGeneration
	}
	c.mu.Unlock()
	if c.staleLaunch(q) {
		return 409
	}
	_, status, _ := c.createWake(q, at, note, "")
	if status == 0 {
		return 204
	}
	return status
}

// newWakeTimerEnv drives the person's own user manager as Omat koneet does.
// A daemon that cannot name its launch path writes no timer; the in-process
// timer and the overdue check at every start still fire the wakes.
func newWakeTimerEnv(cfg transport.Config) *wakeTimerEnv {
	executable, err := os.Executable()
	if err != nil {
		return nil
	}
	machines := newOwnMachineEnv(cfg)
	return &wakeTimerEnv{home: cfg.Home, exe: launchedExecutable(executable, os.Args[0]), userManager: machines.userManager, managerReady: machines.managerReady}
}
