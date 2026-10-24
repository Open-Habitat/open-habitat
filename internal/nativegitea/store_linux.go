//go:build linux

package nativegitea

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"golang.org/x/sys/unix"
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
	home       string
	components []string // configHome below home

	// Test seams. uid is the owner every checked file must have; fault
	// injects a failure at a named write step.
	uid         int
	lockTimeout time.Duration
	fault       func(step string) error

	mu       sync.Mutex
	holds    map[string]int
	removing map[string]bool
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
	return &Store{home: home, components: comps, uid: os.Geteuid(), lockTimeout: lockTimeout, holds: map[string]int{}, removing: map[string]bool{}}, nil
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

var errMissing = errors.New("missing")

// openDir opens home/<dir...> without following a symlink at any level.
// home and every level below it must belong to the person and not be
// writable by group or others. With create, missing levels are made 0700.
func (s *Store) openDir(dir []string, create bool) (int, error) {
	fd, err := unix.Open(s.home, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return -1, ErrUnavailable
	}
	if !s.safeDir(fd) {
		unix.Close(fd)
		return -1, ErrUnavailable
	}
	for _, name := range dir {
		if name == "" || name == "." || name == ".." || strings.Contains(name, "/") {
			unix.Close(fd)
			return -1, ErrUnavailable
		}
		next, err := unix.Openat(fd, name, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
		if errors.Is(err, unix.ENOENT) && create {
			if err = unix.Mkdirat(fd, name, 0o700); err == nil || errors.Is(err, unix.EEXIST) {
				next, err = unix.Openat(fd, name, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
			}
		}
		unix.Close(fd)
		if errors.Is(err, unix.ENOENT) {
			return -1, errMissing
		}
		if err != nil {
			return -1, ErrUnavailable
		}
		if !s.safeDir(next) {
			unix.Close(next)
			return -1, ErrUnavailable
		}
		fd = next
	}
	return fd, nil
}

func (s *Store) safeDir(fd int) bool {
	var st unix.Stat_t
	return unix.Fstat(fd, &st) == nil && st.Mode&unix.S_IFMT == unix.S_IFDIR && int(st.Uid) == s.uid && st.Mode&0o022 == 0
}

// present reports whether name exists in dir in any form; a symlink counts,
// and is refused later rather than followed.
func present(dir int, name string) (bool, error) {
	var st unix.Stat_t
	err := unix.Fstatat(dir, name, &st, unix.AT_SYMLINK_NOFOLLOW)
	if errors.Is(err, unix.ENOENT) {
		return false, nil
	}
	return err == nil, err
}

// selectFile follows tea's GetConfigPath: the XDG file when it exists, else
// the legacy ~/.tea/tea.yml when that exists, else the XDG file. It returns
// an open directory, or -1 when nothing exists and create is false.
func (s *Store) selectFile(create bool) (int, location, bool, error) {
	x := s.xdg()
	xfd, err := s.openDir(x.dir, false)
	if err != nil && !errors.Is(err, errMissing) {
		return -1, x, false, ErrUnavailable
	}
	if xfd >= 0 {
		ok, err := present(xfd, x.file)
		if err != nil {
			unix.Close(xfd)
			return -1, x, false, ErrUnavailable
		}
		if ok {
			return xfd, x, true, nil
		}
	}
	lfd, err := s.openDir(legacy.dir, false)
	if err != nil && !errors.Is(err, errMissing) {
		closeFD(xfd)
		return -1, x, false, ErrUnavailable
	}
	if lfd >= 0 {
		ok, err := present(lfd, legacy.file)
		if err != nil || ok {
			closeFD(xfd)
			if err != nil {
				unix.Close(lfd)
				return -1, x, false, ErrUnavailable
			}
			return lfd, legacy, true, nil
		}
		unix.Close(lfd)
	}
	if !create {
		closeFD(xfd)
		return -1, x, false, nil
	}
	if xfd < 0 {
		if xfd, err = s.openDir(x.dir, true); err != nil {
			return -1, x, false, ErrUnavailable
		}
	}
	return xfd, x, false, nil
}

func closeFD(fd int) {
	if fd >= 0 {
		unix.Close(fd)
	}
}

// session is one locked observation of tea's file.
type session struct {
	dir    int
	lock   int
	loc    location
	exists bool
	st     unix.Stat_t
	doc    *document
}

func (ss *session) close() {
	if ss.lock >= 0 {
		_ = unix.Flock(ss.lock, unix.LOCK_UN)
		unix.Close(ss.lock)
	}
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
	if ss.lock, err = s.acquire(dir, loc.file+".lock", exclusive); err != nil {
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
	data, err := s.readFile(ss)
	if err != nil {
		ss.close()
		return nil, err
	}
	if !ss.exists {
		if exists {
			// Removed between selection and lock: not something to recreate
			// silently.
			ss.close()
			return nil, ErrBusy
		}
		ss.doc = newDocument()
		return ss, nil
	}
	defer wipe(data)
	if ss.doc, err = parseDocument(data); err != nil {
		ss.close()
		return nil, err
	}
	return ss, nil
}

func wipe(b []byte) {
	for i := range b {
		b[i] = 0
	}
}

func (s *Store) acquire(dir int, name string, exclusive bool) (int, error) {
	fd, err := unix.Openat(dir, name, unix.O_RDWR|unix.O_CREAT|unix.O_NOFOLLOW|unix.O_CLOEXEC|unix.O_NONBLOCK, 0o600)
	if err != nil {
		return -1, ErrUnavailable
	}
	var st unix.Stat_t
	if unix.Fstat(fd, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFREG || int(st.Uid) != s.uid {
		unix.Close(fd)
		return -1, ErrUnavailable
	}
	how := unix.LOCK_SH
	if exclusive {
		how = unix.LOCK_EX
	}
	deadline := time.Now().Add(s.lockTimeout)
	for {
		err := unix.Flock(fd, how|unix.LOCK_NB)
		if err == nil {
			return fd, nil
		}
		if !errors.Is(err, unix.EWOULDBLOCK) || time.Now().After(deadline) {
			unix.Close(fd)
			if errors.Is(err, unix.EWOULDBLOCK) {
				return -1, ErrBusy
			}
			return -1, ErrUnavailable
		}
		time.Sleep(lockPoll)
	}
}

// readFile reads the selected file through a descriptor: a regular file of
// the person's own, one link, private mode and bounded size.
func (s *Store) readFile(ss *session) ([]byte, error) {
	fd, err := unix.Openat(ss.dir, ss.loc.file, unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if errors.Is(err, unix.ENOENT) {
		return nil, nil
	}
	if err != nil {
		return nil, ErrUnavailable
	}
	f := os.NewFile(uintptr(fd), ss.loc.file)
	defer f.Close()
	if unix.Fstat(fd, &ss.st) != nil || ss.st.Mode&unix.S_IFMT != unix.S_IFREG || int(ss.st.Uid) != s.uid ||
		ss.st.Nlink != 1 || ss.st.Mode&0o077 != 0 || ss.st.Size > maxConfig {
		return nil, ErrUnavailable
	}
	data, err := io.ReadAll(io.LimitReader(f, maxConfig+1))
	if err != nil || len(data) > maxConfig {
		wipe(data)
		return nil, ErrUnavailable
	}
	ss.exists = true
	return data, nil
}

func (s *Store) step(name string) error {
	if s.fault != nil {
		return s.fault(name)
	}
	return nil
}

// commit atomically replaces the observed file with data. Every failure
// before the rename leaves the previous bytes in place (ErrWriteFailed, or
// ErrChanged when the file is no longer the one read under the lock). A
// failure after it is ErrUncertain: reread, never replay.
func (s *Store) commit(ss *session, data []byte) error {
	defer wipe(data)
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return ErrWriteFailed
	}
	tmp := "." + ss.loc.file + "." + hex.EncodeToString(b[:]) + ".tmp"
	fd, err := unix.Openat(ss.dir, tmp, unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0o600)
	if err != nil {
		return ErrWriteFailed
	}
	f := os.NewFile(uintptr(fd), tmp)
	err = s.step("write")
	if err == nil {
		_, err = f.Write(data)
	}
	if err == nil {
		if err = s.step("sync"); err == nil {
			err = f.Sync()
		}
	}
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		_ = unix.Unlinkat(ss.dir, tmp, 0)
		return ErrWriteFailed
	}
	// Same-UID editors that ignore tea's lock can still change the file; only
	// replace the exact inode and contents observed under the lock.
	var now unix.Stat_t
	statErr := unix.Fstatat(ss.dir, ss.loc.file, &now, unix.AT_SYMLINK_NOFOLLOW)
	switch {
	case ss.exists && (statErr != nil || now.Dev != ss.st.Dev || now.Ino != ss.st.Ino || now.Size != ss.st.Size || now.Mtim != ss.st.Mtim || now.Ctim != ss.st.Ctim):
		_ = unix.Unlinkat(ss.dir, tmp, 0)
		return ErrChanged
	case !ss.exists && !errors.Is(statErr, unix.ENOENT):
		_ = unix.Unlinkat(ss.dir, tmp, 0)
		return ErrChanged
	}
	if err = s.step("rename"); err == nil {
		if ss.exists {
			err = unix.Renameat(ss.dir, tmp, ss.dir, ss.loc.file)
		} else {
			err = unix.Renameat2(ss.dir, tmp, ss.dir, ss.loc.file, unix.RENAME_NOREPLACE)
		}
	}
	if err != nil {
		_ = unix.Unlinkat(ss.dir, tmp, 0)
		if errors.Is(err, unix.EEXIST) {
			return ErrChanged
		}
		return ErrWriteFailed
	}
	if err = s.step("dirsync"); err == nil {
		err = unix.Fsync(ss.dir)
	}
	if err != nil {
		return ErrUncertain
	}
	return nil
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
