//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"os"
	"regexp"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/maintainer/native-agent-host/internal/transport"
	"golang.org/x/sys/unix"
)

// Discovery is a bounded, fresh internal observation, not a browser contract.
// No filesystem paths, file contents, or descriptors survive the scan.
type Discovery struct {
	State   string // present, missing, empty, error, partial
	Entries []Workspace
	Error   string // generic reason only
}
type Workspace struct {
	Name        string
	Kind        string // directory, git_main_worktree, git_linked_worktree, unknown
	Metadata    string // absent, valid, error
	WorkspaceID string
	DisplayName string
	Error       string // generic reason only
	dev, ino    uint64 // private observation, never serialized as a browser identity
}

const maxEntries = 512
const maxMetadata = 4096
const maxGitfile = 1024

var idPattern = regexp.MustCompile(`^ws_[A-Za-z0-9_-]{8,64}$`)

// Discover accepts only trusted local daemon configuration, never an HTTP field.
func Discover(cfg transport.Config) Discovery {
	return scan(cfg.Home, cfg.UID, unix.Openat2)
}

// DiscoverFixtureRoot is only for test/browser-host: it scans a synthetic
// native root that is not the account's passwd home.
func DiscoverFixtureRoot(root string, uid int) Discovery { return scan(root, uid, unix.Openat2) }

type openFunction func(int, string, *unix.OpenHow) (int, error)

const resolve = unix.RESOLVE_BENEATH | unix.RESOLVE_NO_SYMLINKS | unix.RESOLVE_NO_MAGICLINKS | unix.RESOLVE_NO_XDEV

func open(op openFunction, parent int, name string, flags uint64, noMount bool) (int, error) {
	r := uint64(unix.RESOLVE_BENEATH | unix.RESOLVE_NO_SYMLINKS | unix.RESOLVE_NO_MAGICLINKS)
	if noMount {
		r = resolve
	}
	return op(parent, name, &unix.OpenHow{Flags: flags | unix.O_CLOEXEC | unix.O_NOFOLLOW, Resolve: r})
}
func dir(op openFunction, parent int, name string, noMount bool) (int, error) {
	return open(op, parent, name, unix.O_DIRECTORY|unix.O_RDONLY, noMount)
}
func reason(err error) string {
	switch {
	case errors.Is(err, unix.ENOENT):
		return "missing"
	case errors.Is(err, unix.ELOOP), errors.Is(err, unix.EXDEV):
		return "unsafe_path"
	case errors.Is(err, unix.EACCES), errors.Is(err, unix.EPERM):
		return "inaccessible"
	default:
		return "io_error"
	}
}
func stat(fd int) (unix.Stat_t, error) { var s unix.Stat_t; e := unix.Fstat(fd, &s); return s, e }
func same(a, b unix.Stat_t) bool {
	return a.Dev == b.Dev && a.Ino == b.Ino && a.Mode&unix.S_IFMT == b.Mode&unix.S_IFMT
}
func scan(home string, uid int, op openFunction) Discovery {
	result := Discovery{State: "error", Entries: []Workspace{}}
	// Home is trusted configuration. Open from / without crossing symlinks; home
	// itself may legitimately be on a separate filesystem. Below home, no mounts.
	root, e := unix.Open("/", unix.O_PATH|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if e != nil {
		result.Error = reason(e)
		return result
	}
	defer unix.Close(root)
	if !strings.HasPrefix(home, "/") || home == "/" || strings.ContainsRune(home, 0) || strings.Contains(home, "..") {
		result.Error = "invalid_identity"
		return result
	}
	h, e := dir(op, root, strings.TrimPrefix(home, "/"), false)
	if e != nil {
		result.Error = reason(e)
		return result
	}
	defer unix.Close(h)
	owner, e := stat(h)
	if e != nil || (uid >= 0 && owner.Uid != uint32(uid)) {
		result.Error = "invalid_identity"
		return result
	}
	src, e := dir(op, h, "src", true)
	if e != nil {
		if errors.Is(e, unix.ENOENT) {
			result.State = "missing"
		}
		result.Error = reason(e)
		return result
	}
	defer unix.Close(src)
	sourceID, e := stat(src)
	if e != nil {
		result.Error = reason(e)
		return result
	}
	copyFD, e := unix.Dup(src)
	if e != nil {
		result.Error = reason(e)
		return result
	}
	f := os.NewFile(uintptr(copyFD), "source")
	entries, e := f.ReadDir(maxEntries + 1)
	f.Close()
	if e != nil && e != io.EOF {
		result.Error = reason(e)
		return result
	}
	if len(entries) > maxEntries {
		result.State = "partial"
		result.Error = "entry_limit"
		return result
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Name() < entries[j].Name() })
	partial := false
	for _, ent := range entries {
		name := ent.Name()
		if name == "." || name == ".." || strings.ContainsAny(name, "/\x00") || len(name) > 255 || !utf8.ValidString(name) {
			partial = true
			continue
		}
		// Do not trust d_type: some filesystems return DT_UNKNOWN. A failed
		// stat is a partial observation, not evidence that an entry is absent.
		var before unix.Stat_t
		statErr := unix.Fstatat(src, name, &before, unix.AT_SYMLINK_NOFOLLOW)
		if statErr == nil && before.Mode&unix.S_IFMT != unix.S_IFDIR {
			continue
		}
		w := Workspace{Name: name, Kind: "unknown", Metadata: "error"}
		if statErr != nil {
			w.Error = reason(statErr)
			partial = true
			result.Entries = append(result.Entries, w)
			continue
		}
		child, err := dir(op, src, name, true)
		if err != nil {
			w.Error = reason(err)
			partial = true
			result.Entries = append(result.Entries, w)
			continue
		}
		initial, err2 := stat(child)
		if statErr != nil || err2 != nil || !same(before, initial) {
			w.Error = "raced_entry"
			partial = true
			unix.Close(child)
			result.Entries = append(result.Entries, w)
			continue
		}
		w.dev, w.ino = uint64(initial.Dev), initial.Ino
		w.Metadata, w.WorkspaceID, w.DisplayName = metadata(op, child)
		w.Kind = gitKind(op, src, child, home, name)
		after, err := dir(op, src, name, true)
		if err != nil {
			w.Error = "raced_entry"
		} else {
			now, err := stat(after)
			unix.Close(after)
			if err != nil || !same(initial, now) {
				w.Error = "raced_entry"
			}
		}
		unix.Close(child)
		if w.Metadata == "error" || w.Kind == "unknown" || w.Error != "" {
			partial = true
		}
		result.Entries = append(result.Entries, w)
	}
	again, err := dir(op, h, "src", true)
	if err != nil {
		result.State = "partial"
		result.Error = "raced_source"
		return result
	}
	now, err := stat(again)
	unix.Close(again)
	if err != nil || !same(sourceID, now) {
		result.State = "partial"
		result.Error = "raced_source"
		return result
	}
	if partial {
		result.State = "partial"
	} else if len(result.Entries) == 0 {
		result.State = "empty"
	} else {
		result.State = "present"
	}
	return result
}

func readSmall(op openFunction, parent int, name string, limit int) ([]byte, string) {
	var before unix.Stat_t
	firstErr := unix.Fstatat(parent, name, &before, unix.AT_SYMLINK_NOFOLLOW)
	fd, e := open(op, parent, name, unix.O_RDONLY|unix.O_NONBLOCK, true)
	if e != nil {
		if firstErr == nil || !errors.Is(e, unix.ENOENT) && errors.Is(firstErr, unix.ENOENT) {
			return nil, "invalid_file"
		}
		return nil, reason(e)
	}
	defer unix.Close(fd)
	s, e := stat(fd)
	if firstErr != nil || e != nil || !same(before, s) || s.Mode&unix.S_IFMT != unix.S_IFREG || s.Size > int64(limit) {
		return nil, "invalid_file"
	}
	copyFD, e := unix.Dup(fd)
	if e != nil {
		return nil, "io_error"
	}
	f := os.NewFile(uintptr(copyFD), "bounded")
	b, e := io.ReadAll(io.LimitReader(f, int64(limit+1)))
	f.Close()
	if e != nil || len(b) > limit {
		return nil, "invalid_file"
	}
	after, e := stat(fd)
	var named unix.Stat_t
	namedErr := unix.Fstatat(parent, name, &named, unix.AT_SYMLINK_NOFOLLOW)
	if e != nil || namedErr != nil || !same(s, named) || !same(s, after) || s.Size != after.Size || s.Mtim != after.Mtim || s.Ctim != after.Ctim || int64(len(b)) != after.Size {
		return nil, "invalid_file"
	}
	return b, "valid"
}
func metadata(op openFunction, child int) (string, string, string) {
	d, e := dir(op, child, ".agent-host", true)
	if errors.Is(e, unix.ENOENT) {
		return "absent", "", ""
	}
	if e != nil {
		return "error", "", ""
	}
	defer unix.Close(d)
	b, state := readSmall(op, d, "workspace.json", maxMetadata)
	if state == "missing" {
		return "absent", "", ""
	}
	if state != "valid" {
		return "error", "", ""
	}
	id, display, ok := parseMetadata(b)
	if !ok {
		return "error", "", ""
	}
	return "valid", id, display
}
func parseMetadata(b []byte) (string, string, bool) {
	if !utf8.Valid(b) {
		return "", "", false
	}
	dec := json.NewDecoder(bytes.NewReader(b))
	t, e := dec.Token()
	if e != nil || t != json.Delim('{') {
		return "", "", false
	}
	seen := map[string]bool{}
	var id, display string
	version := false
	for dec.More() {
		t, e = dec.Token()
		if e != nil {
			return "", "", false
		}
		key, ok := t.(string)
		if !ok || seen[key] {
			return "", "", false
		}
		seen[key] = true
		switch key {
		case "schema_version":
			var n json.Number
			dec.UseNumber()
			if dec.Decode(&n) != nil || string(n) != "1" {
				return "", "", false
			}
			version = true
		case "workspace_id":
			if dec.Decode(&id) != nil || !idPattern.MatchString(id) {
				return "", "", false
			}
		case "display_name":
			if dec.Decode(&display) != nil || display == "" || len(display) > 255 || !utf8.ValidString(display) {
				return "", "", false
			}
		default:
			return "", "", false
		}
	}
	t, e = dec.Token()
	if e != nil || t != json.Delim('}') {
		return "", "", false
	}
	if _, e = dec.Token(); e != io.EOF || !version || id == "" {
		return "", "", false
	}
	return id, display, true
}
func gitKind(op openFunction, src, child int, home, name string) string {
	fd, e := dir(op, child, ".git", true)
	if e == nil {
		unix.Close(fd)
		return "git_main_worktree"
	}
	b, state := readSmall(op, child, ".git", maxGitfile)
	if state == "missing" {
		return "directory"
	}
	if state != "valid" {
		return "unknown"
	}
	// The file is a hint, never a path authority. Admit only a syntactically
	// strict target inside this open source root, or a contained target in the
	// child. Real linked worktrees outside src are unknown, not followed.
	if !bytes.HasPrefix(b, []byte("gitdir: ")) || len(b) < 10 || b[len(b)-1] != '\n' {
		return "unknown"
	}
	target := string(b[8 : len(b)-1])
	parent := child
	prefix := home + "/src/"
	if strings.HasPrefix(target, prefix) {
		target = strings.TrimPrefix(target, prefix)
		parent = src
	} else if strings.HasPrefix(target, "../") {
		target = strings.TrimPrefix(target, "../")
		parent = src
	} else if strings.HasPrefix(target, "/") {
		return "unknown"
	}
	if target == "" || strings.ContainsAny(target, "\x00\r\n\\") {
		return "unknown"
	}
	parts := strings.Split(target, "/")
	for _, p := range parts {
		if p == "" || p == "." || p == ".." {
			return "unknown"
		}
	}
	if parent == src && (len(parts) < 4 || parts[0] == name || parts[1] != ".git" || parts[2] != "worktrees") {
		return "unknown"
	}
	fd, e = dir(op, parent, target, true)
	if e != nil {
		return "unknown"
	}
	unix.Close(fd)
	return "git_linked_worktree"
}
