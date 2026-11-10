//go:build linux

package nativegitea

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/open-habitat/open-habitat/internal/nativeforge"
)

const (
	maxConfig = 1 << 20
	// tea v0.16.0 waits five seconds for its lock and polls every 50 ms.
	lockTimeout = 5 * time.Second
	lockPoll    = 50 * time.Millisecond
)

// Store reads and edits tea's native configuration in one person's home. It
// holds no logins in memory between calls.
type Store struct {
	files      nativeforge.Files
	components []string // configHome below home
	holds      nativeforge.Holds
}

// NewStore uses tea's selection for home and an XDG config home, which must
// lie inside home. The daemon passes the mapped account's home and
// home/.config; it never uses another person's or the operator's.
func NewStore(home, configHome string) (*Store, error) {
	if !filepath.IsAbs(home) || !filepath.IsAbs(configHome) || filepath.Clean(home) != home || filepath.Clean(configHome) != configHome {
		return nil, ErrUnavailable
	}
	rel, err := filepath.Rel(home, configHome)
	if err != nil || rel == ".." || strings.HasPrefix(rel, "../") {
		return nil, ErrUnavailable
	}
	var comps []string
	if rel != "." {
		comps = strings.Split(rel, "/")
	}
	return &Store{files: nativeforge.Files{Home: home, UID: os.Geteuid(), LockTimeout: lockTimeout, LockPoll: lockPoll}, components: comps}, nil
}

// StoreFromEnvironment resolves the paths as tea does in the calling
// process: $HOME, and $XDG_CONFIG_HOME when it is absolute (after "~"
// expansion), else $HOME/.config. Git runs the credential helper with the
// same environment it used to find the helper in $HOME's Git config.
func StoreFromEnvironment() (*Store, error) {
	home := os.Getenv("HOME")
	if !filepath.IsAbs(home) {
		return nil, ErrUnavailable
	}
	home = filepath.Clean(home)
	config := filepath.Join(home, ".config")
	if x := os.Getenv("XDG_CONFIG_HOME"); x != "" {
		if x == "~" {
			x = home
		} else if strings.HasPrefix(x, "~/") {
			x = filepath.Join(home, x[2:])
		}
		if filepath.IsAbs(x) {
			config = filepath.Clean(x)
		}
	}
	return NewStore(home, config)
}

type location struct {
	dir  []string
	file string
}

func (s *Store) xdg() location {
	return location{dir: append(append([]string{}, s.components...), "tea"), file: "config.yml"}
}

var legacy = location{dir: []string{".tea"}, file: "tea.yml"}

func (l location) same(o location) bool {
	return l.file == o.file && strings.Join(l.dir, "/") == strings.Join(o.dir, "/")
}

// selectFile follows tea's GetConfigPath: the XDG file when it exists, else
// the legacy ~/.tea/tea.yml when that exists, else the XDG file. It returns
// an open directory, or -1 when nothing exists and create is false.
func (s *Store) selectFile(create bool) (int, location, bool, error) {
	x := s.xdg()
	xfd, err := s.files.OpenDir(x.dir, false)
	if err != nil && !errors.Is(err, nativeforge.ErrMissing) {
		return -1, x, false, ErrUnavailable
	}
	if xfd >= 0 {
		ok, err := nativeforge.Present(xfd, x.file)
		if err != nil {
			closeFD(xfd)
			return -1, x, false, ErrUnavailable
		}
		if ok {
			return xfd, x, true, nil
		}
	}
	lfd, err := s.files.OpenDir(legacy.dir, false)
	if err != nil && !errors.Is(err, nativeforge.ErrMissing) {
		closeFD(xfd)
		return -1, x, false, ErrUnavailable
	}
	if lfd >= 0 {
		ok, err := nativeforge.Present(lfd, legacy.file)
		if err != nil || ok {
			closeFD(xfd)
			if err != nil {
				closeFD(lfd)
				return -1, x, false, ErrUnavailable
			}
			return lfd, legacy, true, nil
		}
		closeFD(lfd)
	}
	if !create {
		closeFD(xfd)
		return -1, x, false, nil
	}
	if xfd < 0 {
		if xfd, err = s.files.OpenDir(x.dir, true); err != nil {
			return -1, x, false, ErrUnavailable
		}
	}
	return xfd, x, false, nil
}

func closeFD(fd int) { nativeforge.CloseFD(fd) }

// session is one locked observation of tea's file.
type session struct {
	dir  int
	lock int
	loc  location
	obs  nativeforge.Observed
	doc  *document
}

func (ss *session) close() {
	nativeforge.Release(ss.lock)
	closeFD(ss.dir)
}

// open locks tea's file (shared for reads, exclusive for edits) using tea's
// own lock protocol, configPath+".lock" with flock, and reads it under that
// lock. Without create, a configuration that does not exist yields a nil
// session: a genuinely empty native state.
func (s *Store) open(exclusive bool) (*session, error) {
	dir, loc, exists, err := s.selectFile(exclusive)
	if err != nil {
		return nil, err
	}
	if dir < 0 {
		return nil, nil
	}
	ss := &session{dir: dir, lock: -1, loc: loc}
	if ss.lock, err = s.files.Acquire(dir, loc.file+".lock", exclusive); err != nil {
		ss.close()
		return nil, err
	}
	// tea may have created a file while we waited; its lock follows its own
	// selection, so ours must still be the file tea would select.
	again, loc2, _, err := s.selectFile(false)
	closeFD(again)
	if err != nil || (again >= 0 && !loc2.same(loc)) {
		ss.close()
		if err != nil {
			return nil, err
		}
		return nil, ErrBusy
	}
	data, obs, err := s.files.Read(dir, loc.file, maxConfig)
	if err != nil {
		ss.close()
		return nil, err
	}
	ss.obs = obs
	if !obs.Exists {
		if exists {
			// Removed between selection and lock: not something to recreate
			// silently.
			ss.close()
			return nil, ErrBusy
		}
		ss.doc = newDocument()
		return ss, nil
	}
	defer nativeforge.Wipe(data)
	if ss.doc, err = parseDocument(data); err != nil {
		ss.close()
		return nil, err
	}
	return ss, nil
}

// commit atomically replaces the observed file with data; see
// nativeforge.Files.Commit.
func (s *Store) commit(ss *session, data []byte) error {
	return s.files.Commit(ss.dir, ss.loc.file, ss.obs, data)
}

// Logins lists tea's entries without tokens. A missing configuration is an
// empty list; an unsafe, malformed or unreadable one is ErrUnavailable.
func (s *Store) Logins() ([]Login, error) {
	ss, err := s.open(false)
	if err != nil {
		return nil, err
	}
	if ss == nil {
		return []Login{}, nil
	}
	defer ss.close()
	return ss.doc.projection(), nil
}

// Token returns the PAT of the targeted login for one of the fixed API reads.
// The entry must still have the observed name, base and user and be a usable
// PAT login. The token is the caller's to use once and drop; nothing here
// keeps it.
func (s *Store) Token(t Target) (string, error) {
	ss, err := s.open(false)
	if err != nil {
		return "", err
	}
	if ss == nil {
		return "", ErrNotFound
	}
	defer ss.close()
	e, err := ss.doc.byName(t.Name)
	if err != nil {
		return "", err
	}
	if e.Base != t.Base || !strings.EqualFold(e.User, t.User) {
		return "", ErrChanged
	}
	if e.Ambiguous {
		return "", ErrAmbiguous
	}
	if !e.Usable() || !validToken(e.token) {
		return "", ErrUnsupported
	}
	return e.token, nil
}

// Credential returns the PAT for a Git request that matches exactly one
// usable login; see match. explicit, when set, narrows to that login name
// and never widens what matches.
func (s *Store) Credential(req CredentialRequest, explicit string) (Credential, error) {
	ss, err := s.open(false)
	if err != nil {
		return Credential{}, err
	}
	if ss == nil {
		return Credential{}, ErrNoMatch
	}
	defer ss.close()
	return match(ss.doc.entries, req, explicit)
}
