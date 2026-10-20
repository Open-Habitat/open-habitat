//go:build linux

package daemon

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// The composer's `@` completion and Ctrl/⌘+P picker read the workspace's
// file names as the person, on demand: Git's own view (tracked files plus
// untracked ones that are not ignored) for a Git checkout, otherwise a bounded
// walk that never follows a symlink and skips dot directories. The daemon
// matches the query so a large tree is not shipped whole, keeps no cache, and
// returns no contents except the picker's bounded preview of one file.

const (
	WorkspaceFilesPath       = "/api/v1/workspaces/files"
	WorkspaceFilePreviewPath = "/api/v1/workspaces/file_preview"

	maxComposerPathsRead = 20000
	maxComposerPaths     = 200
	maxComposerPath      = 1024
	maxComposerQuery     = 200
	maxPreviewBytes      = 8192
	maxPreviewLines      = 40
	composerFilesTimeout = 2 * time.Second
)

type composerFile struct {
	Path string `json:"path"`
	Git  string `json:"git,omitempty"` // modified, added, deleted, renamed, untracked, conflict
}

// composerTarget opens the checkout or plain directory a workspace ID names.
func composerTarget(cfg transport.Config, id string) (*gitTarget, bool, int, string) {
	if target, _, _ := gitWorkspace(cfg, id); target != nil {
		return target, true, 0, ""
	}
	discovery := Discover(cfg)
	var found *Workspace
	for i := range discovery.Entries {
		entry := &discovery.Entries[i]
		if workspaceIDOf(cfg, *entry) == id && entry.Error == "" && entry.Metadata != "error" && entry.Kind == "directory" {
			if found != nil {
				return nil, false, 503, "native_source_unavailable"
			}
			found = entry
		}
	}
	if found == nil {
		return nil, false, 404, "workspace_unavailable"
	}
	t := workspaceGitTarget(cfg, *found)
	return &t, false, 0, ""
}

// WorkspaceFilesHandler answers `?workspace_id=…&query=…` (query optional)
// with at most maxComposerPaths matches, changed files first without a query.
func WorkspaceFilesHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		q, err := url.ParseQuery(r.URL.RawQuery)
		id, query := q.Get("workspace_id"), q.Get("query")
		if err != nil || r.Method != http.MethodGet || r.URL.Path != WorkspaceFilesPath || r.URL.EscapedPath() != WorkspaceFilesPath || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || len(q["workspace_id"]) != 1 || !idPattern.MatchString(id) || len(q) > 2 || (len(q) == 2 && len(q["query"]) != 1) || len(query) > maxComposerQuery || !utf8.ValidString(query) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		target, git, status, code := composerTarget(cfg, id)
		if target == nil {
			snapshotError(w, status, code)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), composerFilesTimeout)
		defer cancel()
		files, truncated, err := readComposerFiles(ctx, cfg, *target, git)
		if err != nil {
			// Not an empty list: the browser says the list is unavailable.
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		matches := matchComposerFiles(files, query)
		if len(matches) > maxComposerPaths {
			matches, truncated = matches[:maxComposerPaths], true
		}
		historyJSON(w, map[string]any{"schema_version": 1, "workspace_id": id, "files": matches, "truncated": truncated})
	})
}

func readComposerFiles(ctx context.Context, cfg transport.Config, target gitTarget, git bool) ([]composerFile, bool, error) {
	fd, still, done, err := target.open()
	if err != nil {
		return nil, false, err
	}
	defer done()
	var files []composerFile
	truncated := false
	if git {
		read := func(args ...string) ([]byte, error) {
			return cloneCommandWithTimeout(ctx, composerFilesTimeout, "/usr/bin/git", cfg.Home, strconv.Itoa(fd), append([]string{"-c", "core.fsmonitor=false", "-c", "core.quotepath=false"}, args...)...)
		}
		raw, err := read("ls-files", "-z", "--cached", "--others", "--exclude-standard", "--deduplicate")
		if err != nil {
			return nil, false, err
		}
		marks := map[string]string{}
		if status, err := readGitStatus(read, maxComposerPathsRead); err == nil {
			for _, f := range status.Files {
				marks[f.Path] = gitMark(f.Status)
			}
		}
		for _, path := range strings.Split(strings.TrimSuffix(string(raw), "\x00"), "\x00") {
			if path == "" || len(path) > maxComposerPath || !utf8.ValidString(path) {
				continue
			}
			if len(files) >= maxComposerPathsRead {
				truncated = true
				break
			}
			files = append(files, composerFile{Path: path, Git: marks[path]})
		}
	} else {
		files, truncated, err = walkComposerFiles(ctx, fd)
		if err != nil {
			return nil, false, err
		}
	}
	if ctx.Err() != nil {
		return nil, false, ctx.Err()
	}
	if !still() {
		return nil, false, errors.New("workspace changed")
	}
	return files, truncated, nil
}

func gitMark(status string) string {
	switch {
	case status == "??":
		return "untracked"
	case strings.ContainsRune(status, 'U') || status == "AA" || status == "DD":
		return "conflict"
	case strings.ContainsRune(status, 'R') || strings.ContainsRune(status, 'C'):
		return "renamed"
	case strings.ContainsRune(status, 'D'):
		return "deleted"
	case strings.ContainsRune(status, 'A'):
		return "added"
	}
	return "modified"
}

// walkComposerFiles lists regular files beneath a plain directory. It opens
// each directory beneath its parent without following symlinks or crossing
// mounts, skips dot entries, and stops at the read bound.
func walkComposerFiles(ctx context.Context, root int) ([]composerFile, bool, error) {
	var files []composerFile
	type pending struct {
		fd     int
		prefix string
		depth  int
	}
	first, err := unix.Dup(root)
	if err != nil {
		return nil, false, err
	}
	queue := []pending{{first, "", 0}}
	defer func() {
		for _, p := range queue {
			unix.Close(p.fd)
		}
	}()
	buf := make([]byte, 32<<10)
	skipped := false // a subtree left out at a bound: the list is not complete
	for len(queue) > 0 {
		if ctx.Err() != nil {
			return nil, false, ctx.Err()
		}
		cur := queue[0]
		queue = queue[1:]
		var names []string
		for {
			n, err := unix.Getdents(cur.fd, buf)
			if err != nil {
				unix.Close(cur.fd)
				return nil, false, err
			}
			if n == 0 {
				break
			}
			_, _, names = unix.ParseDirent(buf[:n], -1, names)
		}
		sort.Strings(names)
		for _, name := range names {
			if strings.HasPrefix(name, ".") {
				continue
			}
			path := cur.prefix + name
			if len(path) > maxComposerPath || !utf8.ValidString(path) {
				continue
			}
			var st unix.Stat_t
			if unix.Fstatat(cur.fd, name, &st, unix.AT_SYMLINK_NOFOLLOW) != nil {
				continue
			}
			switch st.Mode & unix.S_IFMT {
			case unix.S_IFREG:
				if len(files) >= maxComposerPathsRead {
					unix.Close(cur.fd)
					return files, true, nil
				}
				files = append(files, composerFile{Path: path})
			case unix.S_IFDIR:
				if cur.depth >= 16 || len(queue) >= 4096 {
					skipped = true
					continue
				}
				child, err := dir(unix.Openat2, cur.fd, name, true)
				if err == nil {
					queue = append(queue, pending{child, path + "/", cur.depth + 1})
				}
			}
		}
		unix.Close(cur.fd)
	}
	return files, skipped, nil
}

// matchComposerFiles orders files for the list: without a query changed
// files first, then the rest in Git's order; with one, by a fuzzy score of the
// query's characters in order, as Pi's own `@` completion scores.
func matchComposerFiles(files []composerFile, query string) []composerFile {
	out := make([]composerFile, 0, min(len(files), maxComposerPaths+1))
	if query == "" {
		for _, f := range files {
			if f.Git != "" {
				out = append(out, f)
			}
		}
		for _, f := range files {
			if f.Git == "" {
				out = append(out, f)
			}
		}
		return out
	}
	type scored struct {
		file  composerFile
		score float64
		index int
	}
	var hits []scored
	for i, f := range files {
		if s := fuzzyScore(f.Path, query); s > 0 {
			hits = append(hits, scored{f, s, i})
		}
	}
	sort.SliceStable(hits, func(i, j int) bool { return hits[i].score > hits[j].score })
	for _, h := range hits {
		out = append(out, h.file)
	}
	return out
}

// fuzzyScore is zero when the query's characters do not occur in order.
// Consecutive characters, word starts and a whole-substring match score more;
// a longer path a little less.
func fuzzyScore(text, query string) float64 {
	s, q := strings.ToLower(text), strings.ToLower(query)
	score, last, at := 0.0, -2, 0
	for _, ch := range q {
		j := strings.IndexRune(s[at:], ch)
		if j < 0 {
			return 0
		}
		j += at
		if j == last+1 {
			score += 3
		} else {
			score++
		}
		if j == 0 || strings.ContainsRune("/._-", rune(s[j-1])) {
			score += 2
		}
		last = j
		at = j + utf8.RuneLen(ch)
	}
	if strings.Contains(s, q) {
		score += 6
	}
	return score - float64(len(s))*0.01
}

// WorkspaceFilePreviewHandler answers `?workspace_id=…&path=…` with Git's
// diff of a changed file or the first lines of an unchanged one, bounded. The
// path names a regular file beneath the workspace; it is opened without
// following any symlink or crossing a mount.
func WorkspaceFilePreviewHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		q, err := url.ParseQuery(r.URL.RawQuery)
		id, path := q.Get("workspace_id"), q.Get("path")
		if err != nil || r.Method != http.MethodGet || r.URL.Path != WorkspaceFilePreviewPath || r.URL.EscapedPath() != WorkspaceFilePreviewPath || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || len(q) != 2 || len(q["workspace_id"]) != 1 || len(q["path"]) != 1 || !idPattern.MatchString(id) || !validComposerPath(path) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		target, git, status, code := composerTarget(cfg, id)
		if target == nil {
			snapshotError(w, status, code)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), composerFilesTimeout)
		defer cancel()
		preview, err := readComposerPreview(ctx, cfg, *target, git, path)
		if err != nil {
			if errors.Is(err, errPreviewMissing) {
				snapshotError(w, 404, "resource_not_found")
			} else {
				snapshotError(w, 503, "native_source_unavailable")
			}
			return
		}
		preview["schema_version"], preview["workspace_id"], preview["path"] = 1, id, path
		historyJSON(w, preview)
	})
}

var errPreviewMissing = errors.New("no such file")

// validComposerPath is a relative path without empty, dot or dot-dot parts.
func validComposerPath(path string) bool {
	if path == "" || len(path) > maxComposerPath || !utf8.ValidString(path) || strings.HasPrefix(path, "/") || strings.ContainsRune(path, 0) {
		return false
	}
	for _, part := range strings.Split(path, "/") {
		if part == "" || part == "." || part == ".." {
			return false
		}
	}
	return true
}

func readComposerPreview(ctx context.Context, cfg transport.Config, target gitTarget, git bool, path string) (map[string]any, error) {
	root, still, done, err := target.open()
	if err != nil {
		return nil, err
	}
	defer done()
	if git {
		read := func(args ...string) ([]byte, error) {
			return cloneCommandWithTimeout(ctx, composerFilesTimeout, "/usr/bin/git", cfg.Home, strconv.Itoa(root), append([]string{"-c", "core.fsmonitor=false", "-c", "core.quotepath=false"}, args...)...)
		}
		// --literal-pathspecs and `--` keep the path one literal path (no
		// pathspec magic such as ":(glob)**"); --no-ext-diff and --no-textconv keep
		// the person's configured diff programs from running here.
		if diff, err := read("--literal-pathspecs", "diff", "--no-color", "--no-ext-diff", "--no-textconv", "HEAD", "--", path); err == nil && len(bytes.TrimSpace(diff)) > 0 {
			text, truncated := boundedPreview(diff)
			if !still() {
				return nil, errors.New("workspace changed")
			}
			return map[string]any{"kind": "diff", "text": text, "truncated": truncated}, nil
		}
	}
	fd, err := open(unix.Openat2, root, path, unix.O_RDONLY|unix.O_NONBLOCK, true)
	if err != nil {
		if errors.Is(err, unix.ENOENT) {
			return nil, errPreviewMissing
		}
		return nil, err
	}
	defer unix.Close(fd)
	st, err := stat(fd)
	if err != nil || st.Mode&unix.S_IFMT != unix.S_IFREG {
		return nil, errPreviewMissing
	}
	buf := make([]byte, maxPreviewBytes+1)
	n, err := unix.Read(fd, buf)
	if err != nil {
		return nil, err
	}
	head := buf[:max(n, 0)]
	if bytes.IndexByte(head, 0) >= 0 {
		if !still() {
			return nil, errors.New("workspace changed")
		}
		return map[string]any{"kind": "binary", "text": "", "truncated": false}, nil
	}
	text, truncated := boundedPreview(head)
	if !still() {
		return nil, errors.New("workspace changed")
	}
	return map[string]any{"kind": "text", "text": text, "truncated": truncated}, nil
}

// boundedPreview keeps whole lines within the byte and line bounds.
func boundedPreview(raw []byte) (string, bool) {
	truncated := len(raw) > maxPreviewBytes
	if truncated {
		raw = raw[:maxPreviewBytes]
	}
	lines := strings.SplitAfter(string(raw), "\n")
	if len(lines) > maxPreviewLines {
		lines, truncated = lines[:maxPreviewLines], true
	}
	text := strings.Join(lines, "")
	if truncated {
		if cut := strings.LastIndexByte(text, '\n'); cut >= 0 {
			text = text[:cut+1]
		}
	}
	return strings.ToValidUTF8(text, "�"), truncated
}
