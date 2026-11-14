// Package livelimits is the one definition of the administrator's limit on
// conversations working at once (live-conversation-limit-admin): the
// installation's limit and per-person exceptions in root's
// /opt/open-habitat/live-limits.json. The root broker writes the file on the
// gateway's request after the gateway's current administrator check, the
// pattern of the integrations file's application sections; every person's
// daemon reads only its own number from it. It holds no authority and reads
// no file; the daemon and the broker do.
//
// The limit shares the host politely; it is not a security boundary. A person
// can start Pi in a terminal outside the daemon, and only a memory limit on
// the person's slice would truly protect the host.
package livelimits

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"sort"
	"strconv"
)

// Path is the installation-wide file. It names Unix UIDs and numbers, never
// a name or a credential, so every mapped user may read it; only root may
// write it.
const Path = "/opt/open-habitat/live-limits.json"

// HostDefault is the daemon's own limit when the administrator has set
// none: some 7 GiB of Pi children per person (about 210 MiB each).
const HostDefault = 32

// Max bounds every limit. The daemon keeps one conversation record more than
// this in memory, for its reserved background place, so a larger number of
// live children could never happen.
const Max = 128

// MaxPeople bounds the exceptions so that the file and the broker's reply
// stay small; an installation needing more wants a different default.
const MaxPeople = 100

// MaxFile is the most a reader reads of the file.
const MaxFile = 4096

// ChildBytes is the measured size of one Pi child, for the administrator's
// memory estimate only.
const ChildBytes = 210 << 20

// Sources of a person's effective limit.
const (
	SourceDefault      = "default"      // nothing set: HostDefault
	SourceInstallation = "installation" // the administrator's limit for everyone
	SourceOwn          = "own"          // the administrator's exception for this person
)

// File is the decoded file. Default 0 means the administrator has set no
// installation limit.
type File struct {
	Default int
	People  map[uint32]int
}

var ErrFile = errors.New("live limits file is invalid")

// Valid reports whether n may be a limit.
func Valid(n int) bool { return n >= 1 && n <= Max }

// Parse decodes the file strictly: one object with version 1, an optional
// default and an optional map of decimal UID to limit, nothing else.
func Parse(b []byte) (File, error) {
	if len(b) > MaxFile {
		return File{}, ErrFile
	}
	var raw struct {
		Version int             `json:"version"`
		Default *int            `json:"default"`
		People  map[string]*int `json:"people"`
	}
	dec := json.NewDecoder(bytes.NewReader(b))
	dec.DisallowUnknownFields()
	if dec.Decode(&raw) != nil || dec.Decode(new(any)) != io.EOF || raw.Version != 1 || len(raw.People) > MaxPeople {
		return File{}, ErrFile
	}
	f := File{People: map[uint32]int{}}
	if raw.Default != nil {
		if !Valid(*raw.Default) {
			return File{}, ErrFile
		}
		f.Default = *raw.Default
	}
	for k, v := range raw.People {
		uid, err := strconv.ParseUint(k, 10, 32)
		if err != nil || uid == 0 || strconv.FormatUint(uid, 10) != k || v == nil || !Valid(*v) {
			return File{}, ErrFile
		}
		f.People[uint32(uid)] = *v
	}
	return f, nil
}

// Encode is the canonical file for f, which must be valid.
func Encode(f File) ([]byte, error) {
	if f.Default != 0 && !Valid(f.Default) || len(f.People) > MaxPeople {
		return nil, ErrFile
	}
	var b bytes.Buffer
	b.WriteString(`{"version":1`)
	if f.Default != 0 {
		b.WriteString(`,"default":` + strconv.Itoa(f.Default))
	}
	if len(f.People) > 0 {
		uids := make([]uint32, 0, len(f.People))
		for uid, n := range f.People {
			if uid == 0 || !Valid(n) {
				return nil, ErrFile
			}
			uids = append(uids, uid)
		}
		sort.Slice(uids, func(i, j int) bool { return uids[i] < uids[j] })
		b.WriteString(`,"people":{`)
		for i, uid := range uids {
			if i > 0 {
				b.WriteByte(',')
			}
			b.WriteString(`"` + strconv.FormatUint(uint64(uid), 10) + `":` + strconv.Itoa(f.People[uid]))
		}
		b.WriteByte('}')
	}
	b.WriteString("}\n")
	if b.Len() > MaxFile {
		return nil, ErrFile
	}
	return b.Bytes(), nil
}

// For is uid's effective limit and where it comes from.
func (f File) For(uid uint32) (int, string) {
	if n, ok := f.People[uid]; ok {
		return n, SourceOwn
	}
	if f.Default != 0 {
		return f.Default, SourceInstallation
	}
	return HostDefault, SourceDefault
}
