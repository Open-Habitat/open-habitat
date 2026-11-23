//go:build linux

// Package upgradenotice is the one signal from host maintenance to the
// daemons: root's `host upgrade` publishes when it will begin stopping them,
// and each daemon reads it to tell its own conversations' agents and its
// person's browser. The record is advisory and world-readable. It names no
// account, conversation, operator text or command, and nothing in it grants
// anything: a daemon never writes it, never acts on another person's behalf
// because of it, and a record it cannot trust reads as no schedule at all.
package upgradenotice

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

// Path sits beside the agent upgrade fence, under the installed product's
// root-owned directory that every mapped user can already search.
const Path = "/opt/open-habitat/upgrade-notice.json"

const (
	// DefaultLead is Jari's "a couple of minutes" (2026-11-23).
	DefaultLead = 2 * time.Minute
	MinLead     = time.Minute
	MaxLead     = time.Hour
	// The owner rewrites renewed_at this often while it lives; a record not
	// renewed for LivenessWindow has lost its owner.
	RenewInterval  = 10 * time.Second
	LivenessWindow = 45 * time.Second
	// A withdrawn record, or one whose owner vanished, is shown this long
	// and then read as no schedule.
	Linger   = 15 * time.Minute
	maxBytes = 4096
)

// States of the record as root wrote it.
const (
	Announced = "announced"
	Withdrawn = "withdrawn"
)

// Statuses a reader derives from the record and its own clock.
const (
	StatusCountdown = "countdown" // announced, the deadline is ahead
	StatusStarting  = "starting"  // announced, the deadline has passed
	StatusWithdrawn = "withdrawn" // the operator cancelled or the attempt failed before the stop
	StatusUnknown   = "unknown"   // the owner stopped renewing: never "restart now"
)

var (
	scheduleRE = regexp.MustCompile(`^[0-9a-f]{32}$`)
	versionRE  = regexp.MustCompile(`^[0-9A-Za-z][0-9A-Za-z.+~-]{0,63}$`)
	// ErrUntrusted is a record the reader must ignore.
	ErrUntrusted = errors.New("upgrade notice untrusted")
)

// Record is the file's whole content.
type Record struct {
	SchemaVersion int       `json:"schema_version"`
	ScheduleID    string    `json:"schedule_id"`
	Revision      int       `json:"revision"`
	TargetVersion string    `json:"target_version"`
	AnnouncedAt   time.Time `json:"announced_at"`
	Deadline      time.Time `json:"deadline"`
	State         string    `json:"state"`
	RenewedAt     time.Time `json:"renewed_at"`
}

// Key identifies what an agent was told: a new revision is told again.
func (r Record) Key() string { return r.ScheduleID + ":" + itoa(r.Revision) }

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [20]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}

// Valid checks the record's own consistency.
func (r Record) Valid() bool {
	lead := r.Deadline.Sub(r.AnnouncedAt)
	return r.SchemaVersion == 1 && scheduleRE.MatchString(r.ScheduleID) && r.Revision >= 1 && r.Revision <= 1000000 &&
		versionRE.MatchString(r.TargetVersion) && (r.State == Announced || r.State == Withdrawn) &&
		!r.AnnouncedAt.IsZero() && !r.RenewedAt.IsZero() && lead >= 0 && lead <= MaxLead &&
		!r.RenewedAt.Before(r.AnnouncedAt.Add(-time.Minute))
}

// Status is what the record means now. "" means no schedule: the record has
// lingered past its use.
func (r Record) Status(now time.Time) string {
	quiet := now.Sub(r.RenewedAt)
	if quiet > Linger {
		return ""
	}
	if r.State == Withdrawn {
		return StatusWithdrawn
	}
	if quiet > LivenessWindow {
		return StatusUnknown
	}
	if now.Before(r.Deadline) {
		return StatusCountdown
	}
	return StatusStarting
}

// Encode is the writer's canonical form, in UTC.
func Encode(r Record) ([]byte, error) {
	r.AnnouncedAt, r.Deadline, r.RenewedAt = r.AnnouncedAt.UTC().Truncate(time.Millisecond), r.Deadline.UTC().Truncate(time.Millisecond), r.RenewedAt.UTC().Truncate(time.Millisecond)
	if !r.Valid() {
		return nil, ErrUntrusted
	}
	b, err := json.Marshal(r)
	if err != nil {
		return nil, err
	}
	return append(b, '\n'), nil
}

// Parse accepts exactly the record and nothing else.
func Parse(b []byte) (Record, error) {
	var r Record
	if len(b) == 0 || len(b) > maxBytes {
		return r, ErrUntrusted
	}
	d := json.NewDecoder(bytes.NewReader(b))
	d.DisallowUnknownFields()
	if d.Decode(&r) != nil || d.Decode(&struct{}{}) != io.EOF || !r.Valid() {
		return Record{}, ErrUntrusted
	}
	return r, nil
}

// Read loads the record at path only when root owns it and every directory
// above it, and no one else can write any of them. A missing record is
// os.ErrNotExist; anything else unusable is ErrUntrusted.
func Read(path string) (Record, error) {
	return read(path, 0, "/")
}

// read checks the directories from base down; tests start below a scratch
// directory whose own ancestry they do not control.
func read(path string, owner uint32, base string) (Record, error) {
	if !filepath.IsAbs(path) || filepath.Clean(path) != path || !strings.HasPrefix(path, strings.TrimSuffix(base, "/")+"/") {
		return Record{}, ErrUntrusted
	}
	dir, err := openTrustedDir(base, strings.TrimPrefix(filepath.Dir(path), strings.TrimSuffix(base, "/")), owner)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return Record{}, os.ErrNotExist
		}
		return Record{}, ErrUntrusted
	}
	defer unix.Close(dir)
	fd, err := unix.Openat(dir, filepath.Base(path), unix.O_RDONLY|unix.O_CLOEXEC|unix.O_NOFOLLOW|unix.O_NONBLOCK, 0)
	if err == unix.ENOENT {
		return Record{}, os.ErrNotExist
	}
	if err != nil {
		return Record{}, ErrUntrusted
	}
	f := os.NewFile(uintptr(fd), path)
	defer f.Close()
	var st unix.Stat_t
	if unix.Fstat(fd, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Uid != owner || st.Mode&0022 != 0 || st.Nlink != 1 || st.Size < 1 || st.Size > maxBytes {
		return Record{}, ErrUntrusted
	}
	b, err := io.ReadAll(io.LimitReader(f, maxBytes+1))
	if err != nil {
		return Record{}, ErrUntrusted
	}
	return Parse(b)
}

func openTrustedDir(base, path string, owner uint32) (int, error) {
	fd, err := unix.Open(base, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if err != nil {
		return -1, err
	}
	check := func() bool {
		var st unix.Stat_t
		return unix.Fstat(fd, &st) == nil && (st.Uid == 0 || st.Uid == owner) && st.Mode&0022 == 0
	}
	if !check() {
		unix.Close(fd)
		return -1, ErrUntrusted
	}
	for _, part := range strings.Split(strings.TrimPrefix(path, "/"), "/") {
		if part == "" {
			continue
		}
		next, err := unix.Openat(fd, part, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
		unix.Close(fd)
		if err == unix.ENOENT {
			return -1, os.ErrNotExist
		}
		if err != nil {
			return -1, ErrUntrusted
		}
		fd = next
		if !check() {
			unix.Close(fd)
			return -1, ErrUntrusted
		}
	}
	return fd, nil
}
