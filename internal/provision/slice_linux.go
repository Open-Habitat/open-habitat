//go:build linux

package provision

import (
	"context"
	"os"
	"strconv"
	"strings"

	"golang.org/x/sys/unix"
)

// A person's daemon, and with it every Pi conversation and tool it starts,
// runs in that person's user-<uid>.slice (Jari, 2026-11-23). One operator
// limit per person (a user-.slice.d drop-in) then bounds everything the
// person runs, over SSH or through the browser, and the product has no
// resource setting of its own. systemd cannot derive the UID from the
// instance name, so the broker writes one drop-in per committed binding and
// the product's verifiers accept exactly that file and nothing else on a
// product unit. Without an operator limit the slice changes nothing.

const (
	unitBase = "/etc/systemd/system"
	// DaemonSliceFile is the drop-in's name inside DaemonSliceDir.
	DaemonSliceFile = "open-habitat-slice.conf"
)

// DaemonSliceDir is the drop-in directory of name's daemon instance,
// relative to /etc/systemd/system.
func DaemonSliceDir(name string) string { return "open-habitat-daemon@" + name + ".service.d" }

func daemonSlicePath(name string) string {
	return unitBase + "/" + DaemonSliceDir(name) + "/" + DaemonSliceFile
}

func daemonSlice(uid uint32) string { return "user-" + number(uid) + ".slice" }

// DaemonSliceContent is the drop-in's exact text for name's binding.
func DaemonSliceContent(name string, uid uint32) string {
	return "# Written by Open Habitat for " + name + ". The daemon and the Pi\n" +
		"# conversations it starts count against the person's own user slice,\n" +
		"# so a limit in user-.slice.d covers them. Removed with the person.\n" +
		"[Service]\nSlice=" + daemonSlice(uid) + "\n"
}

// ParseDaemonSlice returns the UID of a drop-in whose text is exactly what
// the broker writes for name, and false for anything else.
func ParseDaemonSlice(name string, b []byte) (uint32, bool) {
	if !username(name) || len(b) > 1024 {
		return 0, false
	}
	s := string(b)
	i := strings.LastIndex(s, "\nSlice=user-")
	if i < 0 {
		return 0, false
	}
	digits := strings.TrimSuffix(s[i+len("\nSlice=user-"):], ".slice\n")
	n, err := strconv.ParseUint(digits, 10, 32)
	if err != nil || n < 1000 || n > 60000 || strconv.FormatUint(n, 10) != digits {
		return 0, false
	}
	if s != DaemonSliceContent(name, uint32(n)) {
		return 0, false
	}
	return uint32(n), true
}

// openUnitBase opens base without following links. Every component must
// belong to root (or owner, for tests) and be writable by nobody else, so
// nothing but root could have placed what is found below it.
func openUnitBase(base string, owner uint32) (int, error) {
	if !strings.HasPrefix(base, "/") || strings.Contains(base, "//") || strings.HasSuffix(base, "/") {
		return -1, ErrInvalid
	}
	fd, err := unix.Open("/", unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if err != nil {
		return -1, err
	}
	for _, p := range strings.Split(strings.TrimPrefix(base, "/"), "/") {
		if p == "." || p == ".." {
			unix.Close(fd)
			return -1, ErrInvalid
		}
		next, err := unix.Openat(fd, p, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
		unix.Close(fd)
		if err != nil {
			return -1, err
		}
		fd = next
		var st unix.Stat_t
		if unix.Fstat(fd, &st) != nil || st.Uid != 0 && st.Uid != owner || st.Mode&0022 != 0 {
			unix.Close(fd)
			return -1, ErrInvalid
		}
	}
	return fd, nil
}

// ensureDaemonSliceAt makes base/DaemonSliceDir(name)/DaemonSliceFile hold
// exactly the binding's drop-in. It creates what is absent and accepts what
// is already exact; anything else in the directory that systemd would load,
// or a different file under the product's name, is refused, never repaired.
// changed reports a write, after which systemd needs a daemon-reload.
func ensureDaemonSliceAt(base string, owner uint32, name string, uid uint32) (changed bool, err error) {
	if !username(name) || uid < 1000 || uid > 60000 {
		return false, ErrInvalid
	}
	want := DaemonSliceContent(name, uid)
	parent, err := openUnitBase(base, owner)
	if err != nil {
		return false, ErrInvalid
	}
	defer unix.Close(parent)
	dirName := DaemonSliceDir(name)
	if err := unix.Mkdirat(parent, dirName, 0755); err == nil {
		changed = true
		if unix.Fsync(parent) != nil {
			return false, ErrInvalid
		}
	} else if err != unix.EEXIST {
		return false, ErrInvalid
	}
	dir, err := unix.Openat(parent, dirName, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return false, ErrInvalid
	}
	defer unix.Close(dir)
	var st unix.Stat_t
	if unix.Fstat(dir, &st) != nil || st.Uid != owner || st.Mode&0022 != 0 {
		return false, ErrInvalid
	}
	if changed && unix.Fchmod(dir, 0755) != nil { // independent of the broker's umask
		return false, ErrInvalid
	}
	dup, err := unix.Dup(dir)
	if err != nil {
		return false, ErrInvalid
	}
	f := os.NewFile(uintptr(dup), dirName)
	names, err := f.Readdirnames(-1)
	f.Close()
	if err != nil {
		return false, ErrInvalid
	}
	next := "." + DaemonSliceFile + ".next"
	present := false
	for _, n := range names {
		switch {
		case n == DaemonSliceFile:
			present = true
		case n == next:
			// An interrupted write of our own: a root-owned regular file
			// under a name systemd never loads.
			var nst unix.Stat_t
			if unix.Fstatat(dir, n, &nst, unix.AT_SYMLINK_NOFOLLOW) != nil || nst.Mode&unix.S_IFMT != unix.S_IFREG || nst.Uid != owner || unix.Unlinkat(dir, n, 0) != nil {
				return false, ErrInvalid
			}
		case strings.HasSuffix(n, ".conf"):
			return false, ErrInvalid
		}
	}
	if present {
		if !daemonSliceExact(dir, want, owner) {
			return false, ErrInvalid
		}
		return changed, nil
	}
	fd, err := unix.Openat(dir, next, unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0644)
	if err != nil {
		return false, ErrInvalid
	}
	file := os.NewFile(uintptr(fd), next)
	_, err = file.Write([]byte(want))
	if err == nil {
		err = file.Chmod(0644) // independent of the broker's umask
	}
	if err == nil {
		err = file.Sync()
	}
	if closeErr := file.Close(); err == nil {
		err = closeErr
	}
	if err != nil || unix.Renameat(dir, next, dir, DaemonSliceFile) != nil || unix.Fsync(dir) != nil {
		return false, ErrInvalid
	}
	return true, nil
}

func daemonSliceExact(dir int, want string, owner uint32) bool {
	fd, err := unix.Openat(dir, DaemonSliceFile, unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if err != nil {
		return false
	}
	f := os.NewFile(uintptr(fd), DaemonSliceFile)
	defer f.Close()
	var st unix.Stat_t
	if unix.Fstat(fd, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Uid != owner || st.Mode&07777 != 0644 || st.Nlink != 1 || st.Size != int64(len(want)) {
		return false
	}
	b := make([]byte, len(want)+1)
	n, _ := f.Read(b)
	return string(b[:n]) == want
}

// removeDaemonSliceAt deletes the binding's drop-in and its directory. Only
// the product's own file goes; a directory holding anything else stays and
// fails the removal for the operator to look at. An absent one is done.
func removeDaemonSliceAt(base string, owner uint32, name string) error {
	if !username(name) {
		return ErrInvalid
	}
	parent, err := openUnitBase(base, owner)
	if err != nil {
		return ErrInvalid
	}
	defer unix.Close(parent)
	dirName := DaemonSliceDir(name)
	dir, err := unix.Openat(parent, dirName, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err == unix.ENOENT {
		return nil
	}
	if err != nil {
		return ErrInvalid
	}
	for _, n := range []string{DaemonSliceFile, "." + DaemonSliceFile + ".next"} {
		var st unix.Stat_t
		if err := unix.Fstatat(dir, n, &st, unix.AT_SYMLINK_NOFOLLOW); err == unix.ENOENT {
			continue
		} else if err != nil || st.Mode&unix.S_IFMT != unix.S_IFREG {
			unix.Close(dir)
			return ErrInvalid
		}
		if err := unix.Unlinkat(dir, n, 0); err != nil && err != unix.ENOENT {
			unix.Close(dir)
			return ErrInvalid
		}
	}
	unix.Close(dir)
	if err := unix.Unlinkat(parent, dirName, unix.AT_REMOVEDIR); err != nil && err != unix.ENOENT {
		return ErrInvalid
	}
	return unix.Fsync(parent)
}

// daemonSliceWriter is the native executor's drop-in write, which broker
// startup also runs for every binding it verifies.
type daemonSliceWriter interface {
	ensureDaemonSlice(context.Context, ExecutorIdentity) error
}

// ensureDaemonSlice is the unit step's write: the binding's drop-in, then a
// reload so systemd sees it before the unit is verified.
func (e *LinuxHostExecutor) ensureDaemonSlice(ctx context.Context, i ExecutorIdentity) error {
	changed, err := ensureDaemonSliceAt(unitBase, 0, i.username, i.uid)
	if err != nil {
		return err
	}
	// An exact file the manager has not loaded is a write whose reload was
	// cut short; without this check no later start would ever reload it.
	if !changed {
		b, err := e.command(ctx, systemctl, "show", "open-habitat-daemon@"+i.username+".service", "--property=Slice,DropInPaths", "--no-pager")
		changed = err != nil || !daemonSliceShown(b, i)
	}
	if changed {
		if _, err := e.command(ctx, systemctl, "daemon-reload"); err != nil {
			return ErrInvalid
		}
	}
	return ctx.Err()
}

// daemonSliceShown checks the daemon instance's effective slice and that
// the product's drop-in is its only one.
func daemonSliceShown(b []byte, i ExecutorIdentity) bool {
	return properties(b, map[string]string{"Slice": daemonSlice(i.uid), "DropInPaths": daemonSlicePath(i.username)})
}

// EnsureDaemonSlices writes the drop-in of every committed binding that has
// none, for an installation that predates them. Host maintenance calls it
// under its operation lock, after the broker is initialized and before its
// own daemon-reload and verification; the daemons it restarts afterwards
// start in their user slices. It holds the ledger lock, so it reads the
// same committed bindings the broker and the activation gate do. A binding
// under removal is skipped: the removal deletes its drop-in.
func EnsureDaemonSlices(ctx context.Context) error {
	if os.Geteuid() != 0 || ctx == nil || ctx.Err() != nil {
		return ErrInvalid
	}
	fd, err := lockedDir(ctx, brokerState, 0)
	if err != nil {
		return ErrInvalid
	}
	defer unix.Close(fd)
	defer unix.Flock(fd, unix.LOCK_UN)
	return ensureDaemonSlicesAt(ctx, fd, 0, unitBase)
}

func ensureDaemonSlicesAt(ctx context.Context, fd int, owner uint32, base string) error {
	for _, n := range []string{"pending.json", "pending.json.next", "bindings.json.next", "head.json.next", "allowlist.json.next"} {
		if !absent(fd, n) {
			return ErrInvalid
		}
	}
	cb, err := readAt(fd, "broker.json", owner)
	if err != nil {
		return ErrInvalid
	}
	cfg, err := parseBrokerConfig(cb)
	if err != nil {
		return ErrInvalid
	}
	a, l, _, _, err := stateAt(ctx, fd, owner)
	if err != nil {
		return ErrInvalid
	}
	for _, b := range l.Bindings {
		if ctx.Err() != nil || b.UID < cfg.UIDMin || b.UID > cfg.UIDMax {
			return ErrInvalid
		}
		if r := a.removal(b.ID); r != nil && r.UID == b.UID && r.Username == b.Username {
			continue
		}
		if _, err := ensureDaemonSliceAt(base, owner, b.Username, b.UID); err != nil {
			return err
		}
	}
	return ctx.Err()
}
