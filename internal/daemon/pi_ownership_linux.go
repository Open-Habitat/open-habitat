//go:build linux

package daemon

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"syscall"
)

// piOwnership is a private per-UID/session advisory writer fence. The lock FD
// must be inherited by the direct child: daemon death must not free the fence
// while Pi is still running. It is NOT a census of terminal Pi or detached tools.
type piOwnership struct {
	file *os.File
	id   string
}

func acquirePiOwnership(runtime, id string) (*piOwnership, error) {
	if !sessionIDPattern.MatchString(id) || !filepath.IsAbs(runtime) || os.Geteuid() == 0 {
		return nil, errors.New("invalid Pi ownership context")
	}
	dir := filepath.Join(runtime, "pi-owners")
	// Never create or repair the service runtime here. A root-owned runtime
	// contract is established by systemd; this code only makes its private leaf.
	parent, err := os.Lstat(runtime)
	if err != nil || !parent.IsDir() || parent.Mode()&os.ModeSymlink != 0 || parent.Mode().Perm()&0077 != 0 {
		return nil, errors.New("Pi runtime unavailable")
	}
	if uid, ok := fileOwner(parent); !ok || uid != os.Geteuid() {
		return nil, errors.New("Pi runtime owner mismatch")
	}
	if err := os.Mkdir(dir, 0700); err != nil && !os.IsExist(err) {
		return nil, err
	}
	info, err := os.Lstat(dir)
	if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 || info.Mode().Perm() != 0700 {
		return nil, errors.New("Pi owner directory unavailable")
	}
	if uid, ok := fileOwner(info); !ok || uid != os.Geteuid() {
		return nil, errors.New("Pi owner directory mismatch")
	}
	path := filepath.Join(dir, id+".lock")
	// O_NOFOLLOW prevents substituting an arbitrary native file. Never unlink:
	// unlinking permits a second inode/lock while the old owner is alive.
	fd, err := syscall.Open(path, syscall.O_CREAT|syscall.O_RDWR|syscall.O_NOFOLLOW|syscall.O_CLOEXEC, 0600)
	if err != nil {
		return nil, fmt.Errorf("Pi owner lock unavailable: %w", err)
	}
	f := os.NewFile(uintptr(fd), path)
	fi, err := f.Stat()
	if err != nil || !fi.Mode().IsRegular() || fi.Mode().Perm() != 0600 {
		f.Close()
		return nil, errors.New("Pi owner lock not private regular file")
	}
	if uid, ok := fileOwner(fi); !ok || uid != os.Geteuid() {
		f.Close()
		return nil, errors.New("Pi owner lock UID mismatch")
	}
	if err := syscall.Flock(fd, syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		f.Close()
		return nil, errors.New("Pi writer present or ownership unknown")
	}
	// Do not trust an inode swapped between open and flock.
	current, err := os.Lstat(path)
	if err != nil || !os.SameFile(fi, current) {
		f.Close()
		return nil, errors.New("Pi owner lock changed")
	}
	return &piOwnership{file: f, id: id}, nil
}

func (o *piOwnership) release() error { return o.file.Close() }

// reconciledNativeHistory re-reads the native source, without caching it.
// A stable read is necessary but NOT sufficient for restart resume: the
// previous child's exit, terminal owners, and detached tools remain unknown.
func reconciledNativeHistory(path string, uid int, id, cwd string) (string, error) {
	a := readNativeSettled(path, uid)
	b := readNativeSettled(path, uid)
	if a.state != "readable" || b.state != "readable" || a.id != id || b.id != id || a.cwd != cwd || b.cwd != cwd || a.revision == "" || a.revision != b.revision {
		return "", errors.New("native Pi history unsettled or unavailable")
	}
	return a.revision, nil
}

// The lock inode also carries the minimal browser-origin proof needed after a
// daemon restart. It is not a history index: native JSONL remains authoritative.
type browserOrigin struct {
	Workspace string `json:"workspace"`
	Cwd       string `json:"cwd"`
}

func (o *piOwnership) markBrowser(workspace, cwd string) error {
	if !idPattern.MatchString(workspace) || !filepath.IsAbs(cwd) {
		return errors.New("invalid browser origin")
	}
	b, _ := json.Marshal(browserOrigin{workspace, cwd})
	if err := o.file.Truncate(0); err != nil {
		return err
	}
	if _, err := o.file.WriteAt(append(b, '\n'), 0); err != nil {
		return err
	}
	return o.file.Sync()
}
func (o *piOwnership) browserOrigin() (browserOrigin, error) {
	var origin browserOrigin
	if _, err := o.file.Seek(0, 0); err != nil {
		return origin, err
	}
	b, err := io.ReadAll(io.LimitReader(o.file, 1025))
	if err != nil || len(b) > 1024 || json.Unmarshal(b, &origin) != nil || !idPattern.MatchString(origin.Workspace) || !filepath.IsAbs(origin.Cwd) {
		return origin, errors.New("browser origin unavailable")
	}
	return origin, nil
}
