//go:build linux

package nativegitlab

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/nativeforge"
)

const (
	maxConfig = 1 << 20
	// glab v1.124 waits three seconds for config.lock and polls every 20 ms;
	// it then proceeds unlocked, which the adapter never does.
	lockTimeout = 3 * time.Second
	lockPoll    = 20 * time.Millisecond
	lockName    = "config.lock"
	configName  = "config.yml"
)

// Store reads and edits glab's native configuration in one person's home.
// It holds no logins in memory between calls.
type Store struct {
	files      nativeforge.Files
	components []string // configHome below home
	holds      nativeforge.Holds
}

// NewStore uses glab's selection for home and an XDG config home, which must
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

// StoreFromEnvironment resolves the paths as glab does in the calling
// process: $HOME, and $XDG_CONFIG_HOME when it is absolute, else
// $HOME/.config. Git runs the credential helper with the same environment it
// used to find the helper in $HOME's Git config. GLAB_CONFIG_DIR, which
// would point glab somewhere else entirely, is not followed: the helper
// answers only from the file the daemon writes, and a person who moves
// glab's file elsewhere gets no answer rather than another file's token.
func StoreFromEnvironment() (*Store, error) {
	home := os.Getenv("HOME")
	if !filepath.IsAbs(home) {
		return nil, ErrUnavailable
	}
	home = filepath.Clean(home)
	config := filepath.Join(home, ".config")
	if x := os.Getenv("XDG_CONFIG_HOME"); filepath.IsAbs(x) {
		config = filepath.Clean(x)
	}
	return NewStore(home, config)
}

// glab v1.124's ConfigDir: ~/.config/glab-cli when its config.yml exists
// (the legacy location), else $XDG_CONFIG_HOME/glab-cli.
func (s *Store) legacy() []string { return []string{".config", "glab-cli"} }
func (s *Store) xdg() []string    { return append(append([]string{}, s.components...), "glab-cli") }

func same(a, b []string) bool { return strings.Join(a, "/") == strings.Join(b, "/") }

// selectDir follows glab's selection and returns the open directory, or -1
// when nothing exists and create is false.
func (s *Store) selectDir(create bool) (int, []string, bool, error) {
	legacy := s.legacy()
	lfd, err := s.files.OpenDir(legacy, false)
	if err != nil && !errors.Is(err, nativeforge.ErrMissing) {
		return -1, nil, false, ErrUnavailable
	}
	if lfd >= 0 {
		ok, err := nativeforge.Present(lfd, configName)
		if err != nil {
			nativeforge.CloseFD(lfd)
			return -1, nil, false, ErrUnavailable
		}
		if ok || same(legacy, s.xdg()) {
			return lfd, legacy, ok, nil
		}
		nativeforge.CloseFD(lfd)
	}
	x := s.xdg()
	xfd, err := s.files.OpenDir(x, create)
	if errors.Is(err, nativeforge.ErrMissing) {
		return -1, x, false, nil
	}
	if err != nil {
		return -1, nil, false, ErrUnavailable
	}
	ok, err := nativeforge.Present(xfd, configName)
	if err != nil {
		nativeforge.CloseFD(xfd)
		return -1, nil, false, ErrUnavailable
	}
	return xfd, x, ok, nil
}

// session is one locked observation of glab's file.
type session struct {
	dir  int
	lock int
	loc  []string
	obs  nativeforge.Observed
	doc  *document
}

func (ss *session) close() {
	nativeforge.Release(ss.lock)
	nativeforge.CloseFD(ss.dir)
}

// open locks glab's file with glab's own protocol, an flock on config.lock
// beside config.yml (shared for reads, exclusive for edits), and reads it
// under that lock. Without exclusive, a configuration that does not exist
// yields a nil session: a genuinely empty native state, and nothing is
// created.
func (s *Store) open(exclusive bool) (*session, error) {
	dir, loc, exists, err := s.selectDir(exclusive)
	if err != nil {
		return nil, err
	}
	if dir < 0 || (!exists && !exclusive) {
		nativeforge.CloseFD(dir)
		return nil, nil
	}
	ss := &session{dir: dir, lock: -1, loc: loc}
	if ss.lock, err = s.files.Acquire(dir, lockName, exclusive); err != nil {
		ss.close()
		return nil, err
	}
	// glab may have created the legacy file while we waited; its lock
	// follows its own selection, so ours must still be the directory glab
	// would select.
	again, loc2, _, err := s.selectDir(false)
	nativeforge.CloseFD(again)
	if err != nil || (again >= 0 && !same(loc2, loc)) {
		ss.close()
		if err != nil {
			return nil, err
		}
		return nil, ErrBusy
	}
	data, obs, err := s.files.Read(dir, configName, maxConfig)
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

func (s *Store) commit(ss *session, data []byte) error {
	return s.files.Commit(ss.dir, configName, ss.obs, data)
}

// Logins lists glab's signed-in host entries without tokens. A missing
// configuration is an empty list; an unsafe, malformed or unreadable one is
// ErrUnavailable.
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

// usableEntry returns the targeted entry when it still has the observed
// identity and is a usable token login.
func usableEntry(doc *document, t Target) (*entry, error) {
	e, err := doc.byKey(t.Key)
	if err != nil {
		return nil, err
	}
	if !e.signedIn {
		return nil, ErrNotFound
	}
	if e.Base != t.Base || !strings.EqualFold(e.User, t.User) {
		return nil, ErrChanged
	}
	if e.Ambiguous {
		return nil, ErrAmbiguous
	}
	if !e.Usable() {
		return nil, ErrUnsupported
	}
	return e, nil
}

// Token returns the token of the targeted login for one of the fixed API
// reads. The token is the caller's to use once and drop; nothing here keeps
// it.
func (s *Store) Token(t Target) (string, error) {
	ss, err := s.open(false)
	if err != nil {
		return "", err
	}
	if ss == nil {
		return "", ErrNotFound
	}
	defer ss.close()
	e, err := usableEntry(ss.doc, t)
	if err != nil {
		return "", err
	}
	return e.token, nil
}

// Credential returns the token for a Git request that matches exactly one
// usable login; see match.
func (s *Store) Credential(req CredentialRequest) (Credential, error) {
	ss, err := s.open(false)
	if err != nil {
		return Credential{}, err
	}
	if ss == nil {
		return Credential{}, ErrNoMatch
	}
	defer ss.close()
	return match(ss.doc.entries, req)
}

// Hold marks a login as used by an active daemon job until release is
// called; Remove is refused meanwhile. It is in-memory daemon state about
// the daemon's own jobs, not a record of connections.
func (s *Store) Hold(key string) (release func(), err error) { return s.holds.Hold(key) }
