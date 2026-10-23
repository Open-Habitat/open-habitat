//go:build linux

package daemon

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"golang.org/x/sys/unix"
)

// The home Trash of the freedesktop Trash specification 1.0 (ADR 0019). Its
// info files are the only record of a deletion; the daemon keeps no journal.
// XDG_DATA_HOME is not trusted configuration, so the default location is used.
var trashPath = []string{".local", "share", "Trash"}

// trashWriter serializes the daemon's own Trash mutations. Workspace moves and
// restores also hold cloneWriter, because they change ~/src.
var trashWriter sync.Mutex

// Test seams for deterministic race and crash tests. Production never sets
// trashHook; a hook returning errTrashAbandon models a crash at that stage.
var (
	trashHook       = func(stage string) error { return nil }
	renameNoReplace = func(oldDir int, oldName string, newDir int, newName string) error {
		return unix.Renameat2(oldDir, oldName, newDir, newName, unix.RENAME_NOREPLACE)
	}
	trashIntentGrace = 2 * time.Minute
	errTrashAbandon  = errors.New("abandoned")
)

var errWorkspaceSwapped = errors.New("workspace replaced before move")

type trashDirs struct {
	files, info int
	dev         uint64
}

func (t trashDirs) close() {
	unix.Close(t.files)
	unix.Close(t.info)
}

// openTrash pins Trash/files and Trash/info below home without following
// symlinks or crossing mounts. Each level must belong to the daemon UID and
// not be writable by others, as the user-state directory must.
func openTrash(home string, create bool) (trashDirs, error) {
	root, e := unix.Open("/", unix.O_PATH|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if e != nil {
		return trashDirs{}, e
	}
	defer unix.Close(root)
	h, e := dir(unix.Openat2, root, strings.TrimPrefix(home, "/"), false)
	if e != nil {
		return trashDirs{}, e
	}
	parent := h
	closeParent := func() { unix.Close(parent) }
	for _, n := range trashPath {
		next, err := trashLevel(parent, n, create)
		closeParent()
		if err != nil {
			return trashDirs{}, err
		}
		parent = next
	}
	defer closeParent()
	files, e := trashLevel(parent, "files", create)
	if e != nil {
		return trashDirs{}, e
	}
	info, e := trashLevel(parent, "info", create)
	if e != nil {
		unix.Close(files)
		return trashDirs{}, e
	}
	fs, e1 := stat(files)
	is, e2 := stat(info)
	if e1 != nil || e2 != nil || fs.Dev != is.Dev {
		unix.Close(files)
		unix.Close(info)
		return trashDirs{}, errors.New("trash spans filesystems")
	}
	return trashDirs{files: files, info: info, dev: uint64(fs.Dev)}, nil
}

func trashLevel(parent int, name string, create bool) (int, error) {
	if create {
		if e := unix.Mkdirat(parent, name, 0700); e != nil && !errors.Is(e, unix.EEXIST) {
			return -1, e
		}
	}
	fd, e := dir(unix.Openat2, parent, name, true)
	if e != nil {
		return -1, e
	}
	s, e := stat(fd)
	if e != nil || s.Uid != uint32(os.Geteuid()) || s.Mode&0022 != 0 {
		unix.Close(fd)
		return -1, errors.New("unsafe trash directory")
	}
	return fd, nil
}

// validTrashEntry admits one ordinary path component. Entries that other
// tools named otherwise are left alone rather than guessed at.
func validTrashEntry(s string) bool { return validTrashComponent(s, 245) }

func validTrashComponent(s string, max int) bool {
	if s == "" || s == "." || s == ".." || len(s) > max || !utf8.ValidString(s) {
		return false
	}
	for _, c := range s {
		if c == '/' || c < 32 || c == 127 {
			return false
		}
	}
	return true
}

// trashURLPath encodes a path as the specification's Path key requires
// (RFC 2396 escaping, '/' kept).
func trashURLPath(p string) string {
	var b strings.Builder
	for i := 0; i < len(p); i++ {
		c := p[i]
		if c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || strings.IndexByte("/-_.!~*'()", c) >= 0 {
			b.WriteByte(c)
		} else {
			fmt.Fprintf(&b, "%%%02X", c)
		}
	}
	return b.String()
}

func trashDecodePath(s string) (string, bool) {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		if s[i] != '%' {
			b.WriteByte(s[i])
			continue
		}
		if i+2 >= len(s) {
			return "", false
		}
		n, e := strconv.ParseUint(s[i+1:i+3], 16, 8)
		if e != nil {
			return "", false
		}
		b.WriteByte(byte(n))
		i += 2
	}
	return b.String(), true
}

type trashInfo struct {
	path    string
	deleted time.Time
}

// parseTrashInfo reads an info file strictly. Other tools wrote some of
// these files, so anything unexpected makes the entry unrecognised.
func parseTrashInfo(b []byte) (trashInfo, bool) {
	if !utf8.Valid(b) {
		return trashInfo{}, false
	}
	lines := strings.Split(strings.TrimRight(string(b), "\n"), "\n")
	if len(lines) < 3 || lines[0] != "[Trash Info]" {
		return trashInfo{}, false
	}
	var out trashInfo
	seen := map[string]bool{}
	for _, line := range lines[1:] {
		key, value, ok := strings.Cut(line, "=")
		if !ok || seen[key] {
			return trashInfo{}, false
		}
		seen[key] = true
		switch key {
		case "Path":
			p, ok := trashDecodePath(value)
			if !ok || !strings.HasPrefix(p, "/") || strings.ContainsRune(p, 0) {
				return trashInfo{}, false
			}
			out.path = p
		case "DeletionDate":
			t, e := time.ParseInLocation("2006-01-02T15:04:05", value, time.Local)
			if e != nil {
				return trashInfo{}, false
			}
			out.deleted = t
		default:
			return trashInfo{}, false
		}
	}
	if out.path == "" || out.deleted.IsZero() {
		return trashInfo{}, false
	}
	return out, true
}

// trashHomePath admits a canonical home-relative destination, never the Trash
// itself. Restore opens its existing parent without following symlinks.
func trashHomePath(home string, info trashInfo) (string, bool) {
	rel, ok := strings.CutPrefix(info.path, home+"/")
	if !ok || rel == "" {
		return "", false
	}
	for _, part := range strings.Split(rel, "/") {
		if !validTrashComponent(part, 255) {
			return "", false
		}
	}
	if rel == ".local/share/Trash" || strings.HasPrefix(rel, ".local/share/Trash/") {
		return "", false
	}
	return rel, true
}

// openTrashDestination pins the existing destination parent below this home.
func openTrashDestination(home, rel string) (int, error) {
	root, e := unix.Open("/", unix.O_PATH|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if e != nil {
		return -1, e
	}
	defer unix.Close(root)
	h, e := dir(unix.Openat2, root, strings.TrimPrefix(home, "/"), false)
	if e != nil {
		return -1, e
	}
	defer unix.Close(h)
	owned := func(fd int) bool {
		st, err := stat(fd)
		return err == nil && st.Uid == uint32(os.Geteuid()) && st.Mode&0022 == 0
	}
	if !owned(h) {
		return -1, unix.EACCES
	}
	parent, e := dir(unix.Openat2, h, filepath.Dir(rel), true)
	if e != nil {
		return -1, e
	}
	if !owned(parent) {
		unix.Close(parent)
		return -1, unix.EACCES
	}
	return parent, nil
}

func readTrashInfo(t trashDirs, entry string) (trashInfo, string) {
	b, status := readSmall(unix.Openat2, t.info, entry+".trashinfo", 8192)
	if status != "valid" {
		return trashInfo{}, status
	}
	info, ok := parseTrashInfo(b)
	if !ok {
		return trashInfo{}, "invalid_file"
	}
	return info, "valid"
}

// writeTrashInfo creates the info file first, exclusively, as the
// specification requires, and makes it durable before anything moves.
func writeTrashInfo(t trashDirs, name, path string, now time.Time) (string, error) {
	body := "[Trash Info]\nPath=" + trashURLPath(path) + "\nDeletionDate=" + now.Format("2006-01-02T15:04:05") + "\n"
	// <entry>.trashinfo must fit NAME_MAX. Path keeps the full name, so a
	// long name is shortened here only, on a character boundary.
	base := name
	for len(base) > 230 {
		_, size := utf8.DecodeLastRuneInString(base)
		base = base[:len(base)-size]
	}
	for i := 1; i <= 1000; i++ {
		entry := base
		if i > 1 {
			entry = base + "." + strconv.Itoa(i)
		}
		if !validTrashEntry(entry) {
			return "", errors.New("trash name unavailable")
		}
		fd, e := unix.Openat(t.info, entry+".trashinfo", unix.O_CREAT|unix.O_EXCL|unix.O_WRONLY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0600)
		if errors.Is(e, unix.EEXIST) {
			continue
		}
		if e != nil {
			return "", e
		}
		// An entry without an info file is still someone's; never reuse it.
		var existing unix.Stat_t
		if err := unix.Fstatat(t.files, entry, &existing, unix.AT_SYMLINK_NOFOLLOW); !errors.Is(err, unix.ENOENT) {
			unix.Close(fd)
			unix.Unlinkat(t.info, entry+".trashinfo", 0)
			continue
		}
		f := os.NewFile(uintptr(fd), entry)
		_, e = f.WriteString(body)
		if e == nil {
			e = f.Sync()
		}
		if closeErr := f.Close(); e == nil {
			e = closeErr
		}
		if e == nil {
			e = unix.Fsync(t.info)
		}
		if e != nil {
			unix.Unlinkat(t.info, entry+".trashinfo", 0)
			return "", e
		}
		return entry, nil
	}
	return "", errors.New("trash name unavailable")
}

func removeTrashInfo(t trashDirs, entry string) error {
	if e := unix.Unlinkat(t.info, entry+".trashinfo", 0); e != nil && !errors.Is(e, unix.ENOENT) {
		return e
	}
	return unix.Fsync(t.info)
}

// moveToTrash renames ~/src/<name> into Trash/files and then checks that the
// moved inode is the one observed. A directory swapped in meanwhile is put
// back with RENAME_NOREPLACE; if that fails, it stays whole in the Trash.
// On success it returns the verified descriptor, which the caller closes, so
// that whatever is checked or removed afterwards is that directory.
func moveToTrash(src int, name string, expected unix.Stat_t, home string, t trashDirs) (string, int, error) {
	return moveToTrashFrom(src, name, home+"/src/"+name, expected, t)
}

// moveToTrashFrom is moveToTrash for any directory: original is the path its
// info file records, so a restore puts it back there.
func moveToTrashFrom(src int, name, original string, expected unix.Stat_t, t trashDirs) (string, int, error) {
	entry, e := writeTrashInfo(t, name, original, time.Now())
	if e != nil {
		return "", -1, e
	}
	if e = trashHook("info_written"); e != nil {
		if !errors.Is(e, errTrashAbandon) {
			removeTrashInfo(t, entry)
		}
		return "", -1, e
	}
	if e = renameNoReplace(src, name, t.files, entry); e != nil {
		removeTrashInfo(t, entry)
		return "", -1, e
	}
	unix.Fsync(src)
	unix.Fsync(t.files)
	moved, e := dir(unix.Openat2, t.files, entry, true)
	var now unix.Stat_t
	if e == nil {
		now, e = stat(moved)
		if e != nil || !same(expected, now) {
			unix.Close(moved)
		}
	}
	if e != nil || !same(expected, now) {
		if renameNoReplace(t.files, entry, src, name) == nil {
			unix.Fsync(src)
			unix.Fsync(t.files)
			removeTrashInfo(t, entry)
			return "", -1, errWorkspaceSwapped
		}
		return entry, -1, errWorkspaceSwapped
	}
	return entry, moved, nil
}

// restoreFromTrash moves an entry back to its recorded name, never over an
// existing one, and removes the info file last. A crash between the two
// leaves an info file without an entry, which listing later removes.
func restoreFromTrash(src int, t trashDirs, entry, name string) error {
	if e := renameNoReplace(t.files, entry, src, name); e != nil {
		return e
	}
	unix.Fsync(src)
	unix.Fsync(t.files)
	if e := trashHook("restored"); e != nil {
		return e
	}
	return removeTrashInfo(t, entry)
}

type trashListing struct {
	entry, name string // name is empty when the original destination is unknown
	path        string // canonical home-relative destination
	deleted     time.Time
	dev, ino    uint64 // the entry directory, so a listing names exact inodes
}

// listTrash returns the person's native Trash directories. Unknown or
// outside-home destinations remain visible but cannot be restored. With clean,
// info files whose entry is gone (an aborted move, an interrupted permanent
// deletion or restore) are removed once they are older than the grace period,
// so another tool's move in progress is not mistaken for one.
func listTrash(home string, t trashDirs, clean bool, limit int) ([]trashListing, bool, error) {
	infos, e := readDirNames(t.info, 1<<14)
	if e != nil {
		return nil, false, e
	}
	described := map[string]bool{}
	out := []trashListing{}
	truncated := false
	for _, n := range infos {
		entry, ok := strings.CutSuffix(n, ".trashinfo")
		if !ok || entry == "" {
			continue
		}
		described[entry] = true
		if !validTrashEntry(entry) {
			continue
		}
		info, status := readTrashInfo(t, entry)
		if status != "valid" {
			continue
		}
		rel, mine := trashHomePath(home, info)
		name := filepath.Base(rel)
		if !mine {
			name, rel = "", ""
		}
		var s unix.Stat_t
		err := unix.Fstatat(t.files, entry, &s, unix.AT_SYMLINK_NOFOLLOW)
		if errors.Is(err, unix.ENOENT) {
			var is unix.Stat_t
			if clean && unix.Fstatat(t.info, n, &is, unix.AT_SYMLINK_NOFOLLOW) == nil && time.Since(time.Unix(is.Mtim.Unix())) >= trashIntentGrace {
				removeTrashInfo(t, entry)
			}
			continue
		}
		if err != nil || s.Mode&unix.S_IFMT != unix.S_IFDIR {
			continue
		}
		if len(out) >= limit {
			truncated = true
			continue
		}
		out = append(out, trashListing{entry: entry, name: name, path: rel, deleted: info.deleted, dev: uint64(s.Dev), ino: s.Ino})
	}
	files, e := readDirNames(t.files, 1<<14)
	if e != nil {
		return nil, false, e
	}
	for _, entry := range files {
		if described[entry] || !validTrashEntry(entry) {
			continue
		}
		var s unix.Stat_t
		if unix.Fstatat(t.files, entry, &s, unix.AT_SYMLINK_NOFOLLOW) != nil || s.Mode&unix.S_IFMT != unix.S_IFDIR {
			continue
		}
		if len(out) >= limit {
			truncated = true
			continue
		}
		out = append(out, trashListing{entry: entry, dev: uint64(s.Dev), ino: s.Ino})
	}
	return out, truncated, nil
}

// trashEntry resolves a browser-supplied entry name to a native Trash
// directory; its metadata decides whether restoration is available.
func trashEntry(home string, t trashDirs, entry string) (trashListing, bool) {
	if !validTrashEntry(entry) {
		return trashListing{}, false
	}
	var s unix.Stat_t
	if unix.Fstatat(t.files, entry, &s, unix.AT_SYMLINK_NOFOLLOW) != nil || s.Mode&unix.S_IFMT != unix.S_IFDIR {
		return trashListing{}, false
	}
	info, status := readTrashInfo(t, entry)
	if status == "missing" {
		return trashListing{entry: entry, dev: uint64(s.Dev), ino: s.Ino}, true
	}
	if status != "valid" {
		return trashListing{}, false
	}
	rel, mine := trashHomePath(home, info)
	name := filepath.Base(rel)
	if !mine {
		name, rel = "", ""
	}
	return trashListing{entry: entry, name: name, path: rel, deleted: info.deleted, dev: uint64(s.Dev), ino: s.Ino}, true
}

func readDirNames(fd int, limit int) ([]string, error) {
	copyFD, e := unix.Dup(fd)
	if e != nil {
		return nil, e
	}
	f := os.NewFile(uintptr(copyFD), "dir")
	defer f.Close()
	if _, e = f.Seek(0, 0); e != nil {
		return nil, e
	}
	names := []string{}
	for {
		batch, err := f.Readdirnames(1024)
		names = append(names, batch...)
		if len(names) > limit {
			return nil, errors.New("directory bound")
		}
		if err != nil {
			if len(batch) == 0 {
				return names, nil
			}
			return nil, err
		}
	}
}

// removeTrashEntry permanently deletes files/<entry> by descriptor: it never
// follows a symlink, never enters a mount or a directory on another device
// than the entry, and removes the info file last. What it cannot remove is counted
// as remaining; the entry then stays listed and can be deleted again.
// The opened entry must be the inode the person was shown (ino), so a
// directory swapped in under the same name meanwhile is left alone.
func removeTrashEntry(ctx context.Context, t trashDirs, entry string, ino uint64) (int, error) {
	root, e := dir(unix.Openat2, t.files, entry, true)
	if e != nil {
		return 0, e
	}
	defer unix.Close(root)
	if rs, e := stat(root); e != nil || rs.Ino != ino {
		return 0, errWorkspaceSwapped
	}
	return removeTrashTree(ctx, t, entry, root)
}

// removeTrashTree empties the pinned root of files/<entry>, then removes the
// name only if it still is that directory, and the info file last.
func removeTrashTree(ctx context.Context, t trashDirs, entry string, root int) (int, error) {
	rs, e := stat(root)
	if e != nil || uint64(rs.Dev) != t.dev {
		return 1, nil
	}
	remaining := walkRemove(ctx, root, uint64(rs.Dev), 0)
	var named unix.Stat_t
	if unix.Fstatat(t.files, entry, &named, unix.AT_SYMLINK_NOFOLLOW) != nil || !same(rs, named) {
		remaining++
	}
	if remaining > 0 {
		return remaining, nil
	}
	if e = unix.Unlinkat(t.files, entry, unix.AT_REMOVEDIR); e != nil && !errors.Is(e, unix.ENOENT) {
		return 1, nil
	}
	unix.Fsync(t.files)
	return 0, removeTrashInfo(t, entry)
}

func walkRemove(ctx context.Context, fd int, dev uint64, depth int) int {
	return walkRemoveKeep(ctx, fd, dev, depth, "")
}

// walkRemoveKeep leaves the entry named keep directly below fd in place.
func walkRemoveKeep(ctx context.Context, fd int, dev uint64, depth int, keep string) int {
	if depth > 512 {
		return 1
	}
	// A read-only directory (such as Go's module cache) cannot be emptied
	// until it is writable again; it belongs to this person already.
	if s, e := stat(fd); e == nil && s.Uid == uint32(os.Geteuid()) && s.Mode&0700 != 0700 {
		unix.Fchmod(fd, (s.Mode&07777)|0700)
	}
	names, e := readDirNames(fd, 1<<20)
	if e != nil {
		return 1
	}
	if trashHook("walk") != nil {
		return 1
	}
	remaining := 0
	for _, name := range names {
		if ctx.Err() != nil {
			return remaining + 1
		}
		if keep != "" && name == keep {
			continue
		}
		var s unix.Stat_t
		if e := unix.Fstatat(fd, name, &s, unix.AT_SYMLINK_NOFOLLOW); e != nil {
			if !errors.Is(e, unix.ENOENT) {
				remaining++
			}
			continue
		}
		if s.Mode&unix.S_IFMT == unix.S_IFDIR {
			if uint64(s.Dev) != dev {
				remaining++
				continue
			}
			// RESOLVE_NO_XDEV refuses any mount point, including a bind
			// mount of the same filesystem, whose st_dev would match.
			child, e := dir(unix.Openat2, fd, name, true)
			if e != nil {
				remaining++
				continue
			}
			cs, e := stat(child)
			if e != nil || uint64(cs.Dev) != dev || cs.Ino != s.Ino {
				unix.Close(child)
				remaining++
				continue
			}
			remaining += walkRemove(ctx, child, dev, depth+1)
			unix.Close(child)
			if e := unix.Unlinkat(fd, name, unix.AT_REMOVEDIR); e != nil && !errors.Is(e, unix.ENOENT) {
				remaining++
			}
			continue
		}
		if e := unix.Unlinkat(fd, name, 0); e != nil && !errors.Is(e, unix.ENOENT) {
			remaining++
		}
	}
	return remaining
}

// treeSize sums allocated bytes below fd within the deadline and an entry
// bound. It does not follow symlinks or cross devices.
func treeSize(ctx context.Context, fd int) (int64, bool) {
	budget := 200000
	return treeSizeWithin(ctx, fd, &budget)
}

// treeSizeWithin draws on a budget shared by several trees, as a Trash
// listing's entries are.
func treeSizeWithin(ctx context.Context, fd int, budget *int) (int64, bool) {
	s, e := stat(fd)
	if e != nil {
		return 0, false
	}
	var total int64
	complete := sizeWalk(ctx, fd, uint64(s.Dev), 0, budget, &total)
	return total + s.Blocks*512, complete
}

func sizeWalk(ctx context.Context, fd int, dev uint64, depth int, budget *int, total *int64) bool {
	if depth > 512 {
		return false
	}
	names, e := readDirNames(fd, 1<<20)
	if e != nil {
		return false
	}
	complete := true
	for _, name := range names {
		*budget--
		if *budget < 0 || ctx.Err() != nil {
			return false
		}
		var s unix.Stat_t
		if unix.Fstatat(fd, name, &s, unix.AT_SYMLINK_NOFOLLOW) != nil {
			complete = false
			continue
		}
		*total += s.Blocks * 512
		if s.Mode&unix.S_IFMT != unix.S_IFDIR {
			continue
		}
		if uint64(s.Dev) != dev {
			complete = false
			continue
		}
		child, e := dir(unix.Openat2, fd, name, true)
		if e != nil {
			complete = false
			continue
		}
		if !sizeWalk(ctx, child, dev, depth+1, budget, total) {
			complete = false
		}
		unix.Close(child)
	}
	return complete
}
