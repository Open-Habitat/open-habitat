//go:build linux

package integrations

import (
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"golang.org/x/sys/unix"
)

// Agentin käytössä › Tiedostot lets the person look into the folders their
// agents reach: the synced folders under ~/cloud that the connected
// accounts' sync clients keep. The daemon reads them as the person, on
// demand, one folder at a time, and keeps nothing. It is not a home file
// server: a directory is browsable only while it is one of a connected
// account's own sync directories as the tool's files name it now, every
// level is opened beneath the one above without following a symlink or
// crossing a mount, and no file content is ever read.

const (
	FilesPath = "/api/v1/integrations/files"

	// Names read from one folder, and entries returned of them.
	maxFolderNames   = 5000
	maxFolderEntries = 500
	maxFolderPath    = 1024
	maxFolderDepth   = 64
	maxFolderName    = 255
	// Roots in one reply; a person with more has more than any page shows.
	maxRoots = 256
)

type fileRoot struct {
	Provider  Provider `json:"provider"`
	Address   string   `json:"address"`
	Service   string   `json:"service"`
	Directory string   `json:"directory"`
}

type folderEntry struct {
	Name       string `json:"name"`
	Kind       string `json:"kind"` // file or folder
	Bytes      int64  `json:"bytes,omitempty"`
	ModifiedAt string `json:"modified_at"`
}

// fileRoots lists the connected accounts' sync directories that exist now.
// A directory that is missing, a link, or not the person's own is left out:
// it is nothing the page can show safely.
func (c *Catalog) fileRoots() []fileRoot {
	accounts, _ := c.accounts()
	roots := []fileRoot{}
	seen := map[string]bool{}
	for _, a := range accounts {
		s, ok := a.entry.(SyncEntry)
		if !ok {
			continue
		}
		for _, d := range s.Directories(c.env, a.address) {
			if !cloudDirectory(d.Path) || seen[d.Path] {
				continue
			}
			fd, err := openHomeDir(c.env.Home, false, splitPath(d.Path)...)
			if err != nil {
				continue
			}
			unix.Close(fd)
			seen[d.Path] = true
			roots = append(roots, fileRoot{Provider: a.entry.Provider(), Address: a.address, Service: d.Service, Directory: "~/" + d.Path})
		}
	}
	return roots
}

// cloudDirectory is a clean home-relative path below cloud/ that the
// contract's home_directory can carry.
func cloudDirectory(rel string) bool {
	parts := strings.Split(rel, "/")
	if len(parts) < 3 || parts[0] != "cloud" || len("~/"+rel) > 512 {
		return false
	}
	return validFolder(strings.Join(parts[1:], "/"))
}

// validFolder is a relative path of plain names: no empty, dot or dot-dot
// component, valid UTF-8 without control characters, within the bounds.
func validFolder(path string) bool {
	if path == "" || len(path) > maxFolderPath || !utf8.ValidString(path) {
		return false
	}
	parts := strings.Split(path, "/")
	if len(parts) > maxFolderDepth {
		return false
	}
	for _, p := range parts {
		if p == "" || p == "." || p == ".." || len(p) > maxFolderName || !plainName(p) {
			return false
		}
	}
	return true
}

func plainName(name string) bool {
	if name == "" || len(name) > maxFolderName || !utf8.ValidString(name) || strings.ContainsRune(name, '/') {
		return false
	}
	for _, r := range name {
		if r < 0x20 || r == 0x7f || r == '\u2028' || r == '\u2029' {
			return false
		}
	}
	return true
}

var errOutside = errors.New("outside the sync directory")

// openFolder opens folder beneath the root directory fd in one resolution
// that stays below the root, follows no symlink at any level and crosses no
// mount, bind mounts included. It takes ownership of root.
func openFolder(root int, folder string) (int, error) {
	if folder == "" {
		return root, nil
	}
	defer unix.Close(root)
	fd, err := unix.Openat2(root, folder, &unix.OpenHow{
		Flags:   unix.O_RDONLY | unix.O_DIRECTORY | unix.O_CLOEXEC,
		Resolve: unix.RESOLVE_BENEATH | unix.RESOLVE_NO_SYMLINKS | unix.RESOLVE_NO_XDEV | unix.RESOLVE_NO_MAGICLINKS,
	})
	if errors.Is(err, unix.ENOENT) || errors.Is(err, unix.ENOTDIR) {
		return -1, os.ErrNotExist
	}
	if err != nil {
		return -1, errOutside
	}
	return fd, nil
}

// listFolder reads one open folder's entries: subfolders and regular files
// by name, folders first. Symlinks, special files and names the contract
// cannot carry are counted as unlisted, never followed.
func listFolder(dir int) (entries []folderEntry, truncated bool, unlisted int, err error) {
	dup, err := unix.Dup(dir)
	if err != nil {
		return nil, false, 0, err
	}
	f := os.NewFile(uintptr(dup), "folder")
	defer f.Close()
	names, err := f.Readdirnames(maxFolderNames + 1)
	if err != nil && !errors.Is(err, io.EOF) {
		return nil, false, 0, err
	}
	if len(names) > maxFolderNames {
		names, truncated = names[:maxFolderNames], true
	}
	entries = []folderEntry{}
	for _, name := range names {
		// A mount point inside the folder is someone else's tree: it is
		// counted, never described.
		var st unix.Statx_t
		if !plainName(name) || unix.Statx(dir, name, unix.AT_SYMLINK_NOFOLLOW|unix.AT_NO_AUTOMOUNT, unix.STATX_TYPE|unix.STATX_SIZE|unix.STATX_MTIME, &st) != nil ||
			st.Attributes_mask&unix.STATX_ATTR_MOUNT_ROOT != 0 && st.Attributes&unix.STATX_ATTR_MOUNT_ROOT != 0 {
			unlisted++
			continue
		}
		e := folderEntry{Name: name, ModifiedAt: time.Unix(st.Mtime.Sec, int64(st.Mtime.Nsec)).UTC().Format(time.RFC3339)}
		switch uint32(st.Mode) & unix.S_IFMT {
		case unix.S_IFDIR:
			e.Kind = "folder"
		case unix.S_IFREG:
			e.Kind, e.Bytes = "file", int64(st.Size)
		default:
			unlisted++
			continue
		}
		entries = append(entries, e)
	}
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Kind != entries[j].Kind {
			return entries[i].Kind == "folder"
		}
		return entries[i].Name < entries[j].Name
	})
	if len(entries) > maxFolderEntries {
		entries, truncated = entries[:maxFolderEntries], true
	}
	return entries, truncated, unlisted, nil
}

// files answers with the browsable roots, or with `?directory=~/cloud/…`
// (and `&folder=a/b`) one folder of a root.
func (c *Catalog) files(w http.ResponseWriter, r *http.Request) {
	q, err := url.ParseQuery(r.URL.RawQuery)
	_, named := q["folder"]
	want := 0
	if _, ok := q["directory"]; ok {
		want = 1
		if named {
			want = 2
		}
	}
	if err != nil || r.Method != http.MethodGet || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || r.URL.RawPath != "" || len(q) != want ||
		(want > 0 && len(q["directory"]) != 1) || (named && (len(q["folder"]) != 1 || !validFolder(q.Get("folder")))) {
		fail(w, 400, "invalid_request")
		return
	}
	roots := c.fileRoots()
	if want == 0 {
		// The cap is the reply's only: a folder read below still finds a
		// root past it.
		reply(w, map[string]any{"schema_version": 1, "roots": roots[:min(len(roots), maxRoots)]})
		return
	}
	directory, folder := q.Get("directory"), q.Get("folder")
	var root *fileRoot
	for i := range roots {
		if roots[i].Directory == directory {
			root = &roots[i]
		}
	}
	if root == nil {
		fail(w, 404, "directory_unavailable")
		return
	}
	top, err := openHomeDir(c.env.Home, false, splitPath(strings.TrimPrefix(directory, "~/"))...)
	if err != nil {
		fail(w, 404, "directory_unavailable")
		return
	}
	dir, err := openFolder(top, folder)
	if errors.Is(err, os.ErrNotExist) {
		fail(w, 404, "folder_missing")
		return
	}
	if err != nil {
		fail(w, 404, "directory_unavailable")
		return
	}
	defer unix.Close(dir)
	entries, truncated, unlisted, err := listFolder(dir)
	if err != nil {
		fail(w, 503, "native_unavailable")
		return
	}
	body := map[string]any{"schema_version": 1, "directory": directory, "entries": entries, "truncated": truncated}
	if folder != "" {
		body["folder"] = folder
	}
	if unlisted > 0 {
		body["unlisted"] = unlisted
	}
	reply(w, body)
}
