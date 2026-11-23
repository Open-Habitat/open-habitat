//go:build linux

package provision

import (
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

// The host side of a person's removal (ADR 0037). Every method takes the
// committed identity only, observes before it acts and is safe to repeat.
// Errors carry a fixed reason (removalHold); host errors, paths and command
// output never leave this file.

const (
	userdel  = "/usr/sbin/userdel"
	groupdel = "/usr/sbin/groupdel"
)

func (e *LinuxHostExecutor) removalIdentity(i ExecutorIdentity) bool {
	return os.Geteuid() == 0 && e != nil && e.GatewayUID != 0 && e.GatewayGID != 0 && i.provider == "github" && numericID(i.id) && username(i.username) && i.uid >= 1000 && i.uid <= 60000 && i.uid != e.GatewayUID && i.uid != e.GatewayGID
}

// accountPresent reports whether the committed account still has its passwd
// entry. An entry for the name or the UID that is not exactly the committed
// pair is drift, never something to expire or delete.
func (e *LinuxHostExecutor) accountPresent(ctx context.Context, i ExecutorIdentity) (bool, error) {
	byName, nameFound, err := e.lookup(ctx, "passwd", i.username)
	if err != nil {
		return false, err
	}
	byID, idFound, err := e.lookup(ctx, "passwd", number(i.uid))
	if err != nil {
		return false, err
	}
	if !nameFound && !idFound {
		return false, nil
	}
	if !nameFound || !idFound || byName != byID {
		return false, ErrInvalid
	}
	parts := strings.Split(byName, ":")
	if len(parts) != 7 || parts[0] != i.username || parts[2] != number(i.uid) || parts[3] != number(i.uid) || parts[5] != filepath.Join(homeBase, i.username) {
		return false, ErrInvalid
	}
	return true, nil
}

// expiry reads the account's shadow expiry field.
func (e *LinuxHostExecutor) expiry(ctx context.Context, i ExecutorIdentity) (string, error) {
	s, ok, err := e.lookup(ctx, "shadow", i.username)
	if err != nil || !ok {
		return "", ErrInvalid
	}
	parts := strings.Split(s, ":")
	if len(parts) != 9 || parts[0] != i.username {
		return "", ErrInvalid
	}
	return parts[7], nil
}

// CloseOut is stage 1. The account is expired first, which also refuses SSH
// key logins through PAM's account check, so nothing new starts while the
// rest ends.
func (e *LinuxHostExecutor) CloseOut(ctx context.Context, i ExecutorIdentity) error {
	if ctx == nil || ctx.Err() != nil || !e.removalIdentity(i) {
		return removalHold(RemovalCloseFailed)
	}
	present, err := e.accountPresent(ctx, i)
	if err != nil {
		return removalHold(RemovalCloseFailed)
	}
	if present {
		if x, err := e.expiry(ctx, i); err != nil || x != "1" {
			if _, err := e.command(ctx, usermod, "--expiredate", "1", "--", i.username); err != nil {
				return removalHold(RemovalCloseFailed)
			}
			if x, err := e.expiry(ctx, i); err != nil || x != "1" {
				return removalHold(RemovalCloseFailed)
			}
		}
		// logind owns the flag; its file is only observed.
		if gone, err := missing(filepath.Join("/var/lib/systemd/linger", i.username)); err != nil || !gone {
			_, _ = e.command(ctx, loginctl, "disable-linger", i.username)
			if gone, err := missing(filepath.Join("/var/lib/systemd/linger", i.username)); err != nil || !gone {
				return removalHold(RemovalCloseFailed)
			}
		}
	}
	manager := "user@" + number(i.uid) + ".service"
	_, _ = e.command(ctx, systemctl, "stop", manager)
	_, _ = e.command(ctx, systemctl, "reset-failed", manager)
	// Both answer with an error when nothing is left to end.
	_, _ = e.command(ctx, loginctl, "terminate-user", number(i.uid))
	_, _ = e.command(ctx, systemctl, "kill", "--signal=SIGKILL", "user-"+number(i.uid)+".slice")
	if e.endProcesses(ctx, i.uid) != nil {
		return removalHold(RemovalCloseFailed)
	}
	b, err := e.command(ctx, systemctl, "show", manager, "--property=ActiveState", "--no-pager")
	if err != nil || string(b) != "ActiveState=inactive\n" && string(b) != "ActiveState=failed\n" {
		return removalHold(RemovalCloseFailed)
	}
	return ctx.Err()
}

// Reopen unexpires the account. It is the cancel's only host step: access
// stays withdrawn, and lingering returns with the next admitted sign-in.
func (e *LinuxHostExecutor) Reopen(ctx context.Context, i ExecutorIdentity) error {
	if ctx == nil || ctx.Err() != nil || !e.removalIdentity(i) {
		return ErrInvalid
	}
	present, err := e.accountPresent(ctx, i)
	if err != nil || !present {
		return ErrInvalid
	}
	if x, err := e.expiry(ctx, i); err == nil && x == "" {
		return nil
	}
	if _, err := e.command(ctx, usermod, "--expiredate", "", "--", i.username); err != nil {
		return ErrInvalid
	}
	if x, err := e.expiry(ctx, i); err != nil || x != "" {
		return ErrInvalid
	}
	return nil
}

// uidProcesses lists the processes whose real, effective, saved or file
// system UID is uid. /proc is read as root, which hidepid does not hide.
func uidProcesses(ctx context.Context, uid uint32) ([]int, error) {
	entries, err := os.ReadDir("/proc")
	if err != nil || len(entries) > 1<<20 {
		return nil, ErrInvalid
	}
	want := number(uid)
	var pids []int
	for _, entry := range entries {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		pid, err := strconv.Atoi(entry.Name())
		if err != nil || pid <= 1 {
			continue
		}
		b, err := os.ReadFile(filepath.Join("/proc", entry.Name(), "status"))
		if errors.Is(err, os.ErrNotExist) || errors.Is(err, unix.ESRCH) {
			continue
		}
		if err != nil || len(b) > 1<<16 {
			return nil, ErrInvalid
		}
		for _, line := range strings.Split(string(b), "\n") {
			f := strings.Fields(line)
			if len(f) < 2 || f[0] != "Uid:" {
				continue
			}
			for _, v := range f[1:] {
				if v == want {
					pids = append(pids, pid)
					break
				}
			}
			break
		}
	}
	return pids, nil
}

// endProcesses kills whatever still runs as uid outside the user slice and
// confirms that nothing does. The account is expired and the user manager
// stopped, so nothing of the person can start again meanwhile.
func (e *LinuxHostExecutor) endProcesses(ctx context.Context, uid uint32) error {
	for round := 0; round < 20; round++ {
		pids, err := uidProcesses(ctx, uid)
		if err != nil {
			return err
		}
		if len(pids) == 0 {
			return nil
		}
		for _, pid := range pids {
			_ = unix.Kill(pid, unix.SIGKILL)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(250 * time.Millisecond):
		}
	}
	return ErrInvalid
}

// openDir opens name below dirfd as a directory without following a link.
func openDir(dirfd int, name string) (int, error) {
	return unix.Openat(dirfd, name, unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_RDONLY|unix.O_CLOEXEC, 0)
}

var errMountInside = errors.New("mount inside a removed tree")

// removeContents deletes everything below the open directory fd,
// descriptor-relative, never following a link and never entering another
// file system. Entries are reread after each pass, because deleting while
// reading a directory may skip names.
func removeContents(ctx context.Context, fd int, dev uint64) error {
	dup, err := unix.Dup(fd)
	if err != nil {
		return err
	}
	f := os.NewFile(uintptr(dup), "")
	defer f.Close()
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if _, err := f.Seek(0, io.SeekStart); err != nil {
			return err
		}
		names, err := f.Readdirnames(4096)
		if errors.Is(err, io.EOF) || err == nil && len(names) == 0 {
			return nil
		}
		if err != nil {
			return err
		}
		for _, name := range names {
			if err := removeEntry(ctx, fd, name, dev); err != nil {
				return err
			}
		}
	}
}

// removeEntry deletes one entry of the open directory dirfd, a directory
// with everything below it.
func removeEntry(ctx context.Context, dirfd int, name string, dev uint64) error {
	var st unix.Stat_t
	if err := unix.Fstatat(dirfd, name, &st, unix.AT_SYMLINK_NOFOLLOW); err != nil {
		if err == unix.ENOENT {
			return nil
		}
		return err
	}
	if st.Dev != dev {
		return errMountInside
	}
	if st.Mode&unix.S_IFMT != unix.S_IFDIR {
		if err := unix.Unlinkat(dirfd, name, 0); err != nil && err != unix.ENOENT {
			return err
		}
		return nil
	}
	child, err := openDir(dirfd, name)
	if err != nil {
		return err
	}
	var cst unix.Stat_t
	if err := unix.Fstat(child, &cst); err != nil || cst.Dev != st.Dev || cst.Ino != st.Ino {
		unix.Close(child)
		if err != nil {
			return err
		}
		// Replaced between the look and the open; the next pass sees it.
		return nil
	}
	err = removeContents(ctx, child, dev)
	unix.Close(child)
	if err != nil {
		return err
	}
	if err := unix.Unlinkat(dirfd, name, unix.AT_REMOVEDIR); err != nil && err != unix.ENOENT {
		return err
	}
	return nil
}

// RemoveHome deletes /home/<name>. The home is checked to be a directory of
// the committed UID and GID on /home's own file system, renamed inside /home
// to a name the broker reserves, and deleted below that name; a later run
// finds the reserved name and continues it.
func (e *LinuxHostExecutor) RemoveHome(ctx context.Context, i ExecutorIdentity) error {
	if ctx == nil || ctx.Err() != nil || !e.removalIdentity(i) {
		return removalHold(RemovalStepFailed)
	}
	return removeHomeAt(ctx, homeBase, i)
}

func removalReserved(uid uint32) string { return ".open-habitat-removing-" + number(uid) }

func removeHomeAt(ctx context.Context, base string, i ExecutorIdentity) error {
	home, err := unix.Open(base, unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_RDONLY|unix.O_CLOEXEC, 0)
	if err != nil {
		return removalHold(RemovalStepFailed)
	}
	defer unix.Close(home)
	var hst unix.Stat_t
	if unix.Fstat(home, &hst) != nil || hst.Mode&0022 != 0 || hst.Uid != uint32(os.Geteuid()) {
		return removalHold(RemovalHomeUnsafe)
	}
	reserved := removalReserved(i.uid)
	owned := func(st unix.Stat_t) bool {
		return st.Mode&unix.S_IFMT == unix.S_IFDIR && st.Uid == i.uid && st.Gid == i.uid && st.Dev == hst.Dev
	}
	var st, rst unix.Stat_t
	nameErr := unix.Fstatat(home, i.username, &st, unix.AT_SYMLINK_NOFOLLOW)
	reservedErr := unix.Fstatat(home, reserved, &rst, unix.AT_SYMLINK_NOFOLLOW)
	if nameErr != nil && nameErr != unix.ENOENT || reservedErr != nil && reservedErr != unix.ENOENT {
		return removalHold(RemovalStepFailed)
	}
	if nameErr == nil {
		if reservedErr == nil || !owned(st) {
			return removalHold(RemovalHomeUnsafe)
		}
		if unix.Renameat2(home, i.username, home, reserved, unix.RENAME_NOREPLACE) != nil {
			return removalHold(RemovalStepFailed)
		}
		if unix.Fsync(home) != nil {
			return removalHold(RemovalStepFailed)
		}
	} else if reservedErr == unix.ENOENT {
		return nil
	}
	fd, err := openDir(home, reserved)
	if err != nil {
		return removalHold(RemovalStepFailed)
	}
	var fst unix.Stat_t
	if unix.Fstat(fd, &fst) != nil || !owned(fst) {
		unix.Close(fd)
		return removalHold(RemovalHomeUnsafe)
	}
	err = removeContents(ctx, fd, hst.Dev)
	unix.Close(fd)
	if errors.Is(err, errMountInside) {
		return removalHold(RemovalHomeUnsafe)
	}
	if err != nil {
		return removalHold(RemovalStepFailed)
	}
	if unix.Unlinkat(home, reserved, unix.AT_REMOVEDIR) != nil || unix.Fsync(home) != nil {
		return removalHold(RemovalStepFailed)
	}
	return nil
}

// Paths outside the home where a person's own processes leave files.
const (
	crontabs   = "/var/spool/cron/crontabs"
	atjobs     = "/var/spool/cron/atjobs"
	mailSpool  = "/var/mail"
	journalDir = "/var/log/journal"
	runJournal = "/run/log/journal"
)

// RemoveOutside deletes the person's files outside the home: the crontab,
// at jobs, mail spool, files the UID owns on /tmp and /var/tmp, and the
// user journal files. /dev/shm is logind's: it removes a user's IPC objects
// when their last session ends, which the close-out brought about.
func (e *LinuxHostExecutor) RemoveOutside(ctx context.Context, i ExecutorIdentity) error {
	if ctx == nil || ctx.Err() != nil || !e.removalIdentity(i) {
		return removalHold(RemovalStepFailed)
	}
	for _, f := range [][2]string{{crontabs, i.username}, {mailSpool, i.username}} {
		if removeFileIn(f[0], func(name string, st unix.Stat_t) bool { return name == f[1] }) != nil {
			return removalHold(RemovalStepFailed)
		}
	}
	if removeFileIn(atjobs, func(_ string, st unix.Stat_t) bool { return st.Uid == i.uid }) != nil {
		return removalHold(RemovalStepFailed)
	}
	journal := func(name string, _ unix.Stat_t) bool {
		prefix := "user-" + number(i.uid)
		return name == prefix+".journal" || strings.HasPrefix(name, prefix+"@") && (strings.HasSuffix(name, ".journal") || strings.HasSuffix(name, ".journal~"))
	}
	for _, base := range []string{journalDir, runJournal} {
		if eachSubdir(base, func(dir string) error { return removeFileIn(dir, journal) }) != nil {
			return removalHold(RemovalStepFailed)
		}
	}
	for _, base := range []string{"/tmp", "/var/tmp"} {
		err := removeOwnedBelow(ctx, base, i.uid)
		if errors.Is(err, errMountInside) {
			return removalHold(RemovalFilesRemain)
		}
		if err != nil {
			return removalHold(RemovalStepFailed)
		}
	}
	return nil
}

// removeFileIn unlinks the regular files of dir that match, without
// following links. A missing dir has nothing to remove.
func removeFileIn(dir string, match func(string, unix.Stat_t) bool) error {
	fd, err := unix.Open(dir, unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_RDONLY|unix.O_CLOEXEC, 0)
	if err == unix.ENOENT {
		return nil
	}
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	dup, err := unix.Dup(fd)
	if err != nil {
		return err
	}
	f := os.NewFile(uintptr(dup), dir)
	defer f.Close()
	names, err := f.Readdirnames(-1)
	if err != nil {
		return err
	}
	for _, name := range names {
		var st unix.Stat_t
		if err := unix.Fstatat(fd, name, &st, unix.AT_SYMLINK_NOFOLLOW); err != nil {
			if err == unix.ENOENT {
				continue
			}
			return err
		}
		if st.Mode&unix.S_IFMT != unix.S_IFREG || !match(name, st) {
			continue
		}
		if err := unix.Unlinkat(fd, name, 0); err != nil && err != unix.ENOENT {
			return err
		}
	}
	return nil
}

// eachSubdir calls fn for each directory directly below base.
func eachSubdir(base string, fn func(string) error) error {
	entries, err := os.ReadDir(base)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if entry.Type()&os.ModeType == os.ModeDir {
			if err := fn(filepath.Join(base, entry.Name())); err != nil {
				return err
			}
		}
	}
	return nil
}

// removeOwnedBelow walks base on its own file system and deletes every entry
// uid owns, a directory with everything below it. Links are removed as
// themselves and never followed.
func removeOwnedBelow(ctx context.Context, base string, uid uint32) error {
	fd, err := unix.Open(base, unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_RDONLY|unix.O_CLOEXEC, 0)
	if err == unix.ENOENT {
		return nil
	}
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	var st unix.Stat_t
	if err := unix.Fstat(fd, &st); err != nil {
		return err
	}
	return removeOwnedIn(ctx, fd, st.Dev, uid, 0)
}

func removeOwnedIn(ctx context.Context, fd int, dev uint64, uid uint32, depth int) error {
	if depth > 64 {
		return nil
	}
	dup, err := unix.Dup(fd)
	if err != nil {
		return err
	}
	f := os.NewFile(uintptr(dup), "")
	names, err := f.Readdirnames(-1)
	f.Close()
	if err != nil {
		return err
	}
	for _, name := range names {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		var st unix.Stat_t
		if err := unix.Fstatat(fd, name, &st, unix.AT_SYMLINK_NOFOLLOW); err != nil {
			if err == unix.ENOENT {
				continue
			}
			return err
		}
		if st.Dev != dev {
			// Another file system below /tmp (-xdev): not walked.
			continue
		}
		if st.Uid == uid {
			if err := removeEntry(ctx, fd, name, dev); err != nil {
				return err
			}
			continue
		}
		if st.Mode&unix.S_IFMT != unix.S_IFDIR {
			continue
		}
		child, err := openDir(fd, name)
		if err != nil {
			continue
		}
		var cst unix.Stat_t
		if unix.Fstat(child, &cst) == nil && cst.Dev == st.Dev && cst.Ino == st.Ino {
			err = removeOwnedIn(ctx, child, dev, uid, depth+1)
		}
		unix.Close(child)
		if err != nil {
			return err
		}
	}
	return nil
}

// RemoveArtifacts removes what the broker created for the binding, then the
// account itself (userdel without -r: the home is already gone, and nothing
// else may be deleted by name).
func (e *LinuxHostExecutor) RemoveArtifacts(ctx context.Context, i ExecutorIdentity) error {
	if ctx == nil || ctx.Err() != nil || !e.removalIdentity(i) || !username(i.username) {
		return removalHold(RemovalStepFailed)
	}
	if e.StopListeners(ctx, i) != nil {
		return removalHold(RemovalCloseFailed)
	}
	if removeSocketDir(i.username) != nil {
		return removalHold(RemovalStepFailed)
	}
	for _, p := range []string{"/run/open-habitat", socketBase} {
		if e.dropNamedACL(ctx, p, i.uid) != nil {
			return removalHold(RemovalStepFailed)
		}
	}
	if removeFileIn(configBase, func(name string, _ unix.Stat_t) bool { return name == "daemon-"+i.username+".json" }) != nil {
		return removalHold(RemovalStepFailed)
	}
	present, err := e.accountPresent(ctx, i)
	if err != nil {
		return removalHold(RemovalStepFailed)
	}
	if present {
		if _, err := e.command(ctx, userdel, "--", i.username); err != nil {
			return removalHold(RemovalStepFailed)
		}
	}
	// userdel removes a user private group itself on most systems; one left
	// behind is removed only when it is exactly the committed GID.
	g, found, err := e.lookup(ctx, "group", i.username)
	if err != nil {
		return removalHold(RemovalStepFailed)
	}
	if found {
		fields := strings.Split(g, ":")
		if len(fields) != 4 || fields[0] != i.username || fields[2] != number(i.uid) || fields[3] != "" {
			return removalHold(RemovalStepFailed)
		}
		if _, err := e.command(ctx, groupdel, "--", i.username); err != nil {
			return removalHold(RemovalStepFailed)
		}
	}
	for _, pair := range [][2]string{{"passwd", i.username}, {"passwd", number(i.uid)}, {"group", i.username}, {"group", number(i.uid)}} {
		if ok, err := e.vacant(ctx, pair[0], pair[1]); err != nil || !ok {
			return removalHold(RemovalStepFailed)
		}
	}
	return ctx.Err()
}

// removeSocketDir deletes /run/open-habitat/users/<name>, a root-owned
// directory holding at most the three stopped sockets.
func removeSocketDir(name string) error {
	base, err := unix.Open(socketBase, unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_RDONLY|unix.O_CLOEXEC, 0)
	if err != nil {
		return err
	}
	defer unix.Close(base)
	var st unix.Stat_t
	if err := unix.Fstatat(base, name, &st, unix.AT_SYMLINK_NOFOLLOW); err == unix.ENOENT {
		return nil
	} else if err != nil {
		return err
	}
	if st.Mode&unix.S_IFMT != unix.S_IFDIR || st.Uid != 0 {
		return ErrInvalid
	}
	fd, err := openDir(base, name)
	if err != nil {
		return err
	}
	err = removeContents(context.Background(), fd, st.Dev)
	unix.Close(fd)
	if err != nil {
		return err
	}
	return unix.Unlinkat(base, name, unix.AT_REMOVEDIR)
}

// dropNamedACL removes uid's named entry from path's access ACL, keeping
// the mask as it is.
func (e *LinuxHostExecutor) dropNamedACL(ctx context.Context, path string, uid uint32) error {
	b, err := e.command(ctx, getfacl, "-cpn", path)
	if err != nil {
		return ErrInvalid
	}
	entry := "user:" + number(uid) + ":"
	if !strings.Contains("\n"+string(b), "\n"+entry) {
		return nil
	}
	if _, err := e.command(ctx, setfacl, "-n", "-x", "u:"+number(uid), path); err != nil {
		return ErrInvalid
	}
	b, err = e.command(ctx, getfacl, "-cpn", path)
	if err != nil || strings.Contains("\n"+string(b), "\n"+entry) {
		return ErrInvalid
	}
	return nil
}
