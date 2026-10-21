//go:build linux

package daemon

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"golang.org/x/sys/unix"
)

const EditorFilesPrefix = "/api/v1/workspaces/editor/"
const editorTextLimit = 1 << 20
const editorWireLimit = 8 << 20

// Synthetic fault/race seams are nil in production. No request can set them.
type editorFileTestHooks struct {
	write       func(*os.File, []byte) (int, error)
	syncFile    func(*os.File) error
	syncDir     func(int) error
	beforeCheck func()
}

type editorFileRequest struct {
	Workspace string `json:"workspace_id"`
	Path      string `json:"path"`
	Base      string `json:"base_version"`
	Content   string `json:"content"`
	BOM       bool   `json:"bom"`
	Newline   string `json:"newline"`
}
type editorFileError struct {
	status int
	code   string
}

func (e *editorFileError) Error() string      { return e.code }
func fileError(status int, code string) error { return &editorFileError{status, code} }

func validEditorPath(p string, root bool) bool {
	if p == "" {
		return root
	}
	if len(p) > 1024 || !utf8.ValidString(p) || strings.Contains(p, "\\") {
		return false
	}
	parts := strings.Split(p, "/")
	if len(parts) > 64 {
		return false
	}
	for _, part := range parts {
		if part == "" || part == "." || part == ".." || part == ".git" || part == ".agent-host" || len(part) > 255 {
			return false
		}
		for _, r := range part {
			if unicode.IsControl(r) {
				return false
			}
		}
	}
	return true
}

// encoding/json repairs invalid Unicode. Check the original wire representation
// first so a successful save can never acknowledge a lossy replacement.
func editorJSONUnicode(b []byte) bool {
	if !utf8.Valid(b) {
		return false
	}
	for i := 0; i < len(b); i++ {
		if b[i] != '"' {
			continue
		}
		for i++; i < len(b) && b[i] != '"'; i++ {
			if b[i] != '\\' {
				continue
			}
			i++
			if i >= len(b) {
				return false
			}
			if b[i] != 'u' {
				continue
			}
			if i+4 >= len(b) {
				return false
			}
			v, e := strconv.ParseUint(string(b[i+1:i+5]), 16, 16)
			if e != nil {
				return false
			}
			i += 4
			if v >= 0xdc00 && v <= 0xdfff {
				return false
			}
			if v >= 0xd800 && v <= 0xdbff {
				if i+6 >= len(b) || b[i+1] != '\\' || b[i+2] != 'u' {
					return false
				}
				low, e := strconv.ParseUint(string(b[i+3:i+7]), 16, 16)
				if e != nil || low < 0xdc00 || low > 0xdfff {
					return false
				}
				i += 6
			}
		}
	}
	return true
}

// Open each component with the same kernel resolver, including intermediate
// directories: a foreign-owned directory is not an inherited-access shortcut.
func editorOpen(root int, p string, uid uint32, flags int) (*os.File, error) {
	base, e := unix.Dup(root)
	if e != nil {
		return nil, e
	}
	defer func() { unix.Close(base) }()
	parts := strings.Split(p, "/")
	if p == "" {
		parts = []string{"."}
	}
	for i, part := range parts {
		f := unix.O_RDONLY | unix.O_DIRECTORY
		if i == len(parts)-1 {
			f = flags
		}
		// openat2 rejects flags irrelevant to O_PATH; O_PATH never opens content
		// or waits on a special file. Content opens must remain nonblocking.
		if f&unix.O_PATH == 0 {
			f |= unix.O_NONBLOCK
		}
		fd, e := unix.Openat2(base, part, &unix.OpenHow{Flags: uint64(f | unix.O_CLOEXEC | unix.O_NOFOLLOW), Resolve: unix.RESOLVE_BENEATH | unix.RESOLVE_NO_MAGICLINKS | unix.RESOLVE_NO_SYMLINKS | unix.RESOLVE_NO_XDEV})
		if e != nil {
			return nil, fileError(404, "file_unavailable")
		}
		s, e := stat(fd)
		if e != nil || s.Uid != uid || (s.Mode&unix.S_IFMT != unix.S_IFREG && s.Mode&unix.S_IFMT != unix.S_IFDIR) {
			unix.Close(fd)
			return nil, fileError(404, "file_unavailable")
		}
		if i == len(parts)-1 {
			return os.NewFile(uintptr(fd), "editor"), nil
		}
		unix.Close(base)
		base = fd
	}
	return nil, fileError(404, "file_unavailable")
}

type editorObservation struct {
	raw     []byte
	content string
	bom     bool
	newline string
	stat    unix.Stat_t
	version string
}

func editorVersion(ws unix.Stat_t, p string, s unix.Stat_t, raw []byte) string {
	h := sha256.New()
	// Every field is length-delimited, including the domain and content hash.
	sum := sha256.Sum256(raw)
	fields := []string{"open-habitat-editor-v1", fmt.Sprint(ws.Dev), fmt.Sprint(ws.Ino), p, fmt.Sprint(s.Dev), fmt.Sprint(s.Ino), fmt.Sprint(s.Size), fmt.Sprint(s.Mode), fmt.Sprint(s.Mtim.Sec), fmt.Sprint(s.Mtim.Nsec), fmt.Sprint(s.Ctim.Sec), fmt.Sprint(s.Ctim.Nsec), hex.EncodeToString(sum[:])}
	for _, f := range fields {
		fmt.Fprintf(h, "%d:%s", len(f), f)
	}
	return "sha256:v1:" + hex.EncodeToString(h.Sum(nil))
}
func editorMetadata(fd int, s unix.Stat_t) bool {
	if s.Nlink != 1 || s.Mode&07000 != 0 || s.Mode&0200 == 0 {
		return false
	}
	n, e := unix.Flistxattr(fd, nil)
	return e == nil && n == 0 && unix.Faccessat(fd, "", unix.W_OK, unix.AT_EMPTY_PATH|unix.AT_EACCESS) == nil
}
func editorDecode(raw []byte) (string, bool, string, error) {
	if !utf8.Valid(raw) {
		return "", false, "", fileError(415, "file_unsupported")
	}
	bom := bytes.HasPrefix(raw, []byte{0xef, 0xbb, 0xbf})
	if bom {
		raw = raw[3:]
	}
	if bytes.IndexByte(raw, 0) >= 0 {
		return "", false, "", fileError(415, "file_unsupported")
	}
	crlf := bytes.Count(raw, []byte("\r\n"))
	lf := bytes.Count(raw, []byte("\n"))
	cr := bytes.Count(raw, []byte("\r"))
	if cr != crlf || crlf != 0 && crlf != lf {
		return "", false, "", fileError(415, "file_unsupported")
	}
	newline := "none"
	if lf > 0 {
		newline = "lf"
	}
	if crlf > 0 {
		newline = "crlf"
	}
	return strings.ReplaceAll(string(raw), "\r\n", "\n"), bom, newline, nil
}
func editorRead(root int, p string, uid uint32, ws unix.Stat_t, forSave bool) (*editorObservation, error) {
	f, e := editorOpen(root, p, uid, unix.O_RDONLY)
	if e != nil {
		return nil, e
	}
	defer f.Close()
	s, e := stat(int(f.Fd()))
	if e != nil {
		return nil, e
	}
	if s.Mode&unix.S_IFMT != unix.S_IFREG {
		return nil, fileError(415, "file_unsupported")
	}
	if s.Size > editorTextLimit {
		return nil, fileError(413, "file_too_large")
	}
	raw, e := io.ReadAll(io.LimitReader(f, editorTextLimit+1))
	if e != nil {
		return nil, e
	}
	if len(raw) > editorTextLimit {
		return nil, fileError(413, "file_too_large")
	}
	after, e := stat(int(f.Fd()))
	if e != nil {
		return nil, e
	}
	after.Atim = s.Atim
	if s != after {
		return nil, fileError(409, "file_changed")
	}
	content, bom, newline, e := editorDecode(raw)
	if e != nil {
		return nil, e
	}
	if forSave && !editorMetadata(int(f.Fd()), s) {
		return nil, fileError(415, "file_unsupported")
	}
	return &editorObservation{raw, content, bom, newline, s, editorVersion(ws, p, s, raw)}, nil
}
func editorEncode(in editorFileRequest) ([]byte, error) {
	if !utf8.ValidString(in.Content) || strings.ContainsAny(in.Content, "\r\x00") || in.Newline != "lf" && in.Newline != "crlf" && in.Newline != "none" || in.Newline == "none" && strings.Contains(in.Content, "\n") {
		return nil, fileError(400, "invalid_request")
	}
	text := in.Content
	if in.Newline == "crlf" {
		text = strings.ReplaceAll(text, "\n", "\r\n")
	}
	if in.BOM {
		text = "\ufeff" + text
	}
	if len(text) > editorTextLimit {
		return nil, fileError(413, "file_too_large")
	}
	return []byte(text), nil
}

// A file lease participates in deletion admission under the same mutex. Retain
// descriptors, not path prefixes, to cover enclosing workspaces and place aliases.
func (c *ConversationController) editorLease(ws *os.File, cwd string) (func(), bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.admits(ws, cwd) {
		return nil, false
	}
	for _, f := range c.fileFences {
		if editorOverlap(ws, f) {
			return nil, false
		}
	}
	if c.fileOperations == nil {
		c.fileOperations = map[*os.File]bool{}
	}
	c.fileOperations[ws] = true
	return func() { c.mu.Lock(); delete(c.fileOperations, ws); c.mu.Unlock() }, true
}
func editorAncestor(child, parent *os.File) bool {
	want, e := stat(int(parent.Fd()))
	if e != nil {
		return true
	}
	fd, e := unix.Dup(int(child.Fd()))
	if e != nil {
		return true
	}
	defer func() { unix.Close(fd) }()
	for i := 0; i < 1024; i++ {
		s, e := stat(fd)
		if e != nil {
			return true
		}
		if same(s, want) {
			return true
		}
		next, e := unix.Openat(fd, "..", unix.O_PATH|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
		if e != nil {
			return true
		}
		n, e := stat(next)
		if e != nil {
			unix.Close(next)
			return true
		}
		if same(n, s) {
			unix.Close(next)
			return false
		}
		unix.Close(fd)
		fd = next
	}
	return true // an unprovable ancestry refuses admission
}
func editorOverlap(a, b *os.File) bool { return editorAncestor(a, b) || editorAncestor(b, a) }
func (c *ConversationController) editorAdmitted(ws *os.File, cwd string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.admits(ws, cwd) {
		return false
	}
	for _, f := range c.fileFences {
		if editorOverlap(ws, f) {
			return false
		}
	}
	return true
}

// EditorFiles is mounted only on the trusted browser-peer listener. It creates
// no process and never accepts an account, home or absolute filesystem target.
func (c *ConversationController) EditorFiles() http.Handler {
	c.mu.Lock()
	if c.editorSlots == nil {
		c.editorSlots = make(chan struct{}, 4)
		c.editorSaves = make(chan struct{}, 1)
	}
	slots, saves := c.editorSlots, c.editorSaves
	c.mu.Unlock()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		fail := func(e error) {
			var typed *editorFileError
			if errors.As(e, &typed) {
				snapshotError(w, typed.status, typed.code)
			} else {
				snapshotError(w, 503, "file_io_failed")
			}
		}
		if !historyAuthorized(c.cfg, c.trusted, r) {
			fail(fileError(403, "cross_user_denied"))
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		deadline, _ := ctx.Deadline()
		_ = http.NewResponseController(w).SetReadDeadline(deadline)
		select {
		case slots <- struct{}{}:
			defer func() { <-slots }()
		case <-ctx.Done():
			fail(fileError(503, "file_busy"))
			return
		}
		op := strings.TrimPrefix(r.URL.Path, EditorFilesPrefix)
		if r.URL.Path != EditorFilesPrefix+op || r.URL.EscapedPath() != r.URL.Path || op != "file" && op != "list" && op != "stat" {
			fail(fileError(400, "invalid_request"))
			return
		}
		var in editorFileRequest
		save := r.Method == http.MethodPut && op == "file"
		if save {
			if r.URL.RawQuery != "" || r.ContentLength < 2 || r.ContentLength > editorWireLimit || len(r.TransferEncoding) != 0 || r.Header.Get("Content-Type") != "application/json" {
				fail(fileError(400, "invalid_request"))
				return
			}
			b, e := io.ReadAll(io.LimitReader(r.Body, editorWireLimit+1))
			if e != nil {
				fail(e)
				return
			}
			d := json.NewDecoder(bytes.NewReader(b))
			d.DisallowUnknownFields()
			var fields map[string]json.RawMessage
			if int64(len(b)) != r.ContentLength || !editorJSONUnicode(b) || !catalogNoDuplicates(b) || json.Unmarshal(b, &fields) != nil || len(fields) != 6 || d.Decode(&in) != nil || d.Decode(new(any)) != io.EOF || len(in.Base) != 74 || !strings.HasPrefix(in.Base, "sha256:v1:") {
				fail(fileError(400, "invalid_request"))
				return
			}
			for _, key := range []string{"workspace_id", "path", "base_version", "content", "bom", "newline"} {
				if v, ok := fields[key]; !ok || bytes.Equal(bytes.TrimSpace(v), []byte("null")) {
					fail(fileError(400, "invalid_request"))
					return
				}
			}
			if _, e := hex.DecodeString(in.Base[10:]); e != nil || strings.ToLower(in.Base) != in.Base {
				fail(fileError(400, "invalid_request"))
				return
			}
		} else {
			q, e := url.ParseQuery(r.URL.RawQuery)
			if e != nil || r.Method != http.MethodGet || len(q) != 2 || len(q["workspace_id"]) != 1 || len(q["path"]) != 1 || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
				fail(fileError(400, "invalid_request"))
				return
			}
			in.Workspace = q.Get("workspace_id")
			in.Path = q.Get("path")
		}
		if !idPattern.MatchString(in.Workspace) || !validEditorPath(in.Path, op != "file") {
			fail(fileError(400, "invalid_request"))
			return
		}
		if save {
			select {
			case saves <- struct{}{}:
				defer func() { <-saves }()
			case <-ctx.Done():
				fail(fileError(503, "file_busy"))
				return
			}
		}
		ws, cwd, e := c.workspaceFD(in.Workspace)
		if e != nil {
			fail(fileError(404, "workspace_unavailable"))
			return
		}
		defer ws.Close()
		release, ok := c.editorLease(ws, cwd)
		if !ok {
			fail(fileError(503, "file_busy"))
			return
		}
		defer release()
		root, e := os.OpenRoot(filepath.Join("/proc/self/fd", strconv.Itoa(int(ws.Fd()))))
		if e != nil {
			fail(e)
			return
		}
		defer root.Close()
		// os.Root pins the held root's lifetime. All content resolution below uses
		// openat2, never Root.Open's less restrictive symlink/mount resolver.
		wsstat, e := stat(int(ws.Fd()))
		if e != nil || wsstat.Uid != uint32(c.cfg.UID) {
			fail(fileError(404, "workspace_unavailable"))
			return
		}
		result := map[string]any{"schema_version": 1, "workspace_id": in.Workspace, "path": in.Path}
		switch op {
		case "file":
			var o *editorObservation
			if save {
				o, e = c.editorSave(ctx, ws, cwd, wsstat, in)
			} else {
				o, e = editorRead(int(ws.Fd()), in.Path, uint32(c.cfg.UID), wsstat, false)
			}
			if e == nil {
				result["version"] = o.version
				result["size_bytes"] = len(o.raw)
				result["mode"] = o.stat.Mode & 0777
				if !save {
					result["content"] = o.content
					result["bom"] = o.bom
					result["newline"] = o.newline
					result["encoding"] = "utf-8"
				}
			}
		case "list":
			e = c.editorList(ctx, ws, in.Path, result)
		case "stat":
			e = c.editorStat(ws, wsstat, in.Path, result)
		}
		if e != nil {
			fail(e)
			return
		}
		if !save && (ctx.Err() != nil || !c.editorAdmitted(ws, cwd)) {
			fail(fileError(404, "workspace_unavailable"))
			return
		}
		historyJSON(w, result)
	})
}

func (c *ConversationController) editorSave(ctx context.Context, ws *os.File, cwd string, wsstat unix.Stat_t, in editorFileRequest) (*editorObservation, error) {
	raw, e := editorEncode(in)
	if e != nil {
		return nil, e
	}
	o, e := editorRead(int(ws.Fd()), in.Path, uint32(c.cfg.UID), wsstat, true)
	if e != nil {
		return nil, e
	}
	if o.version != in.Base {
		return nil, fileError(409, "file_changed")
	}
	parentPath, name := path.Split(in.Path)
	parentPath = strings.TrimSuffix(parentPath, "/")
	parent, e := editorOpen(int(ws.Fd()), parentPath, uint32(c.cfg.UID), unix.O_RDONLY|unix.O_DIRECTORY)
	if e != nil {
		return nil, e
	}
	defer parent.Close()
	var nonce [18]byte
	if _, e = rand.Read(nonce[:]); e != nil {
		return nil, e
	}
	tmp := ".oh-save-" + hex.EncodeToString(nonce[:]) + ".tmp"
	fd, e := unix.Openat(int(parent.Fd()), tmp, unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_CLOEXEC|unix.O_NOFOLLOW, 0600)
	if e != nil {
		return nil, e
	}
	staged := os.NewFile(uintptr(fd), "editor-save")
	defer staged.Close()
	stagedNamed := true
	defer func() {
		if stagedNamed {
			_ = unix.Unlinkat(int(parent.Fd()), tmp, 0)
		}
	}()
	write := (*os.File).Write
	if c.editorFileTest != nil && c.editorFileTest.write != nil {
		write = c.editorFileTest.write
	}
	if n, err := write(staged, raw); err != nil {
		return nil, err
	} else if n != len(raw) {
		return nil, io.ErrShortWrite
	}
	if e = unix.Fchown(fd, -1, int(o.stat.Gid)); e != nil {
		return nil, fileError(415, "file_unsupported")
	}
	if e = unix.Fchmod(fd, o.stat.Mode&0777); e != nil {
		return nil, e
	}
	ss, e := stat(fd)
	if e != nil || ss.Uid != uint32(c.cfg.UID) || ss.Gid != o.stat.Gid || !editorMetadata(fd, ss) {
		return nil, fileError(415, "file_unsupported")
	}
	syncFile := (*os.File).Sync
	if c.editorFileTest != nil && c.editorFileTest.syncFile != nil {
		syncFile = c.editorFileTest.syncFile
	}
	if e = syncFile(staged); e != nil {
		return nil, e
	}
	if c.editorFileTest != nil && c.editorFileTest.beforeCheck != nil {
		c.editorFileTest.beforeCheck()
	}
	fresh, e := editorRead(int(ws.Fd()), in.Path, uint32(c.cfg.UID), wsstat, true)
	if e != nil {
		return nil, e
	}
	if fresh.version != in.Base {
		return nil, fileError(409, "file_changed")
	}
	namedParent, e := editorOpen(int(ws.Fd()), parentPath, uint32(c.cfg.UID), unix.O_RDONLY|unix.O_DIRECTORY)
	if e != nil {
		return nil, e
	}
	a, ea := stat(int(parent.Fd()))
	b, eb := stat(int(namedParent.Fd()))
	namedParent.Close()
	if ea != nil || eb != nil || !same(a, b) || !c.editorAdmitted(ws, cwd) {
		return nil, fileError(409, "file_changed")
	}
	if ctx.Err() != nil {
		return nil, fileError(503, "file_busy")
	}
	// Cancellation after this point cannot undo the rename. Finish durability
	// handling and return uncertainty on any failure, never retry or roll back.
	if e = unix.Renameat(int(parent.Fd()), tmp, int(parent.Fd()), name); e != nil {
		return nil, e
	}
	// The temporary name no longer belongs to this request after rename.
	stagedNamed = false
	syncDir := unix.Fsync
	if c.editorFileTest != nil && c.editorFileTest.syncDir != nil {
		syncDir = c.editorFileTest.syncDir
	}
	if e = syncDir(int(parent.Fd())); e != nil {
		return nil, e
	}
	committed, e := stat(fd)
	if e != nil {
		return nil, e
	}
	return &editorObservation{raw: raw, stat: committed, version: editorVersion(wsstat, in.Path, committed, raw)}, nil
}

type editorEntry struct {
	Name string `json:"name"`
	Kind string `json:"kind"`
}

func (c *ConversationController) editorList(ctx context.Context, ws *os.File, p string, out map[string]any) error {
	f, e := editorOpen(int(ws.Fd()), p, uint32(c.cfg.UID), unix.O_RDONLY|unix.O_DIRECTORY)
	if e != nil {
		return e
	}
	defer f.Close()
	entries, e := f.ReadDir(2001)
	if e != nil && e != io.EOF {
		return e
	}
	truncated := len(entries) > 2000
	if truncated {
		entries = entries[:2000]
	}
	result := []editorEntry{}
	for _, entry := range entries {
		if ctx.Err() != nil {
			return fileError(503, "file_busy")
		}
		child := entry.Name()
		if p != "" {
			child = p + "/" + child
		}
		if !validEditorPath(child, false) {
			continue
		}
		kind := "unsupported"
		opened, e := editorOpen(int(ws.Fd()), child, uint32(c.cfg.UID), unix.O_PATH)
		if e == nil {
			s, err := stat(int(opened.Fd()))
			opened.Close()
			if err == nil {
				if s.Mode&unix.S_IFMT == unix.S_IFDIR {
					kind = "directory"
				} else if s.Mode&unix.S_IFMT == unix.S_IFREG {
					kind = "file"
				}
			}
		}
		result = append(result, editorEntry{entry.Name(), kind})
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Name < result[j].Name })
	if len(result) > 500 {
		result = result[:500]
		truncated = true
	}
	out["entries"] = result
	out["truncated"] = truncated
	return nil
}
func (c *ConversationController) editorStat(ws *os.File, wsstat unix.Stat_t, p string, out map[string]any) error {
	f, e := editorOpen(int(ws.Fd()), p, uint32(c.cfg.UID), unix.O_PATH)
	if e != nil {
		return e
	}
	defer f.Close()
	s, e := stat(int(f.Fd()))
	if e != nil {
		return e
	}
	out["kind"] = "directory"
	out["size_bytes"] = 0
	out["mode"] = s.Mode & 0777
	out["editable"] = false
	if s.Mode&unix.S_IFMT == unix.S_IFDIR {
		return nil
	}
	out["kind"] = "file"
	out["size_bytes"] = s.Size
	_, e = editorRead(int(ws.Fd()), p, uint32(c.cfg.UID), wsstat, true)
	out["editable"] = e == nil
	if e != nil {
		var typed *editorFileError
		if !errors.As(e, &typed) || typed.status != 415 && typed.status != 413 {
			return e
		}
		reason := "metadata_unsupported"
		if s.Size > editorTextLimit {
			reason = "too_large"
		} else {
			content, err := editorOpen(int(ws.Fd()), p, uint32(c.cfg.UID), unix.O_RDONLY)
			if err != nil {
				return err
			}
			if err == nil {
				raw, err := io.ReadAll(io.LimitReader(content, editorTextLimit+1))
				content.Close()
				if err != nil {
					return err
				}
				if !utf8.Valid(raw) {
					reason = "encoding"
				} else if bytes.IndexByte(raw, 0) >= 0 {
					reason = "binary"
				} else if _, _, _, err := editorDecode(raw); err != nil {
					reason = "mixed_newlines"
				}
			}
		}
		out["reason"] = reason
	}
	return nil
}
