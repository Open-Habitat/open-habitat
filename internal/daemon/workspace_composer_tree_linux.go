//go:build linux

package daemon

import (
	"context"
	"net/http"
	"net/url"
	"sort"
	"strings"

	"github.com/open-habitat/open-habitat/internal/transport"
)

// The composer's in-field file list browses the workspace as a folder tree.
// Its folders come from the same file names the `@` search reads (Git's view,
// or the bounded walk), so the tree and the search never disagree, and each
// folder carries how many changed files lie beneath it. The whole list is read
// once per request and nothing is kept: a folder opened later is read again.

const (
	// Folders listed in one reply: the folders that hold changes start open,
	// and the browser reads one it still lacks when it shows.
	maxTreeFolders = 32
	// Entries of one folder, and of the whole reply.
	maxTreeFolderEntries = 500
	maxTreeEntries       = 4000
)

type treeEntry struct {
	Kind    string `json:"kind"` // file or folder
	Path    string `json:"path"` // a folder's ends with a slash
	Git     string `json:"git,omitempty"`
	Changed int    `json:"changed,omitempty"`
}

type treeFolder struct {
	Path      string      `json:"path"` // "" is the workspace itself
	Entries   []treeEntry `json:"entries"`
	Truncated bool        `json:"truncated"`
}

// WorkspaceFileTreeHandler answers `?workspace_id=…` with the workspace's top
// folder and every folder that holds a change (the tree as it opens), and
// `?workspace_id=…&folder=a/b/` with that folder and the folders above it.
func WorkspaceFileTreeHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		q, err := url.ParseQuery(r.URL.RawQuery)
		id, folder := q.Get("workspace_id"), q.Get("folder")
		_, named := q["folder"]
		want := 1
		if named {
			want = 2
		}
		if err != nil || r.Method != http.MethodGet || r.URL.Path != WorkspaceFileTreePath || r.URL.EscapedPath() != WorkspaceFileTreePath || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || len(q) != want || len(q["workspace_id"]) != 1 || !idPattern.MatchString(id) || (named && (len(q["folder"]) != 1 || !strings.HasSuffix(folder, "/") || !validComposerPath(strings.TrimSuffix(folder, "/")))) {
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
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		folders, changed, more := composerTree(files, folder)
		historyJSON(w, map[string]any{"schema_version": 1, "workspace_id": id, "folders": folders, "changed": changed, "truncated": truncated || more})
	})
}

// composerTree lists the requested folders' direct children: subfolders first
// with their change counts, then files with their Git marks, each by name.
// With no folder named it lists the top folder and every folder that holds a
// change, shallowest first; with one, that folder first (so the bounds never
// leave it out) and then the folders above it.
// It returns the listings, the workspace's changed files and whether a
// listing was left out at a bound.
func composerTree(files []composerFile, folder string) ([]treeFolder, int, bool) {
	changedUnder := map[string]int{}
	children := map[string]map[string]treeEntry{}
	add := func(dir string, e treeEntry) {
		if children[dir] == nil {
			children[dir] = map[string]treeEntry{}
		}
		if _, ok := children[dir][e.Path]; !ok {
			children[dir][e.Path] = e
		}
	}
	total := 0
	for _, f := range files {
		changed := f.Git != ""
		if changed {
			total++
			changedUnder[""]++
		}
		dir := ""
		for {
			cut := strings.IndexByte(f.Path[len(dir):], '/')
			if cut < 0 {
				break
			}
			sub := f.Path[:len(dir)+cut+1]
			add(dir, treeEntry{Kind: "folder", Path: sub})
			if changed {
				changedUnder[sub]++
			}
			dir = sub
		}
		add(dir, treeEntry{Kind: "file", Path: f.Path, Git: f.Git})
	}

	var want []string
	if folder != "" {
		want = append(want, folder, "")
		for i := 0; i < len(folder)-1; i++ {
			if folder[i] == '/' {
				want = append(want, folder[:i+1])
			}
		}
	} else {
		want = append(want, "")
		for dir, n := range changedUnder {
			if dir != "" && n > 0 {
				want = append(want, dir)
			}
		}
		sort.Slice(want, func(i, j int) bool {
			a, b := strings.Count(want[i], "/"), strings.Count(want[j], "/")
			if a != b {
				return a < b
			}
			return want[i] < want[j]
		})
	}

	out := []treeFolder{}
	listed, more := 0, false
	for _, dir := range want {
		if len(out) >= maxTreeFolders || listed >= maxTreeEntries {
			more = true
			break
		}
		entries := make([]treeEntry, 0, len(children[dir]))
		for _, e := range children[dir] {
			if e.Kind == "folder" {
				e.Changed = changedUnder[e.Path]
			}
			entries = append(entries, e)
		}
		byName := func(i, j int) bool {
			a, b := entries[i], entries[j]
			if a.Kind != b.Kind {
				return a.Kind == "folder"
			}
			return a.Path < b.Path
		}
		sort.Slice(entries, byName)
		// A folder past its bound keeps its subfolders and changed files, the
		// rows the person is most likely after, then the first names.
		limit := min(maxTreeFolderEntries, maxTreeEntries-listed)
		cut := len(entries) > limit
		if cut {
			sort.SliceStable(entries, func(i, j int) bool { return treeKeep(entries[i]) && !treeKeep(entries[j]) })
			entries = entries[:limit]
			sort.Slice(entries, byName)
		}
		listed += len(entries)
		out = append(out, treeFolder{Path: dir, Entries: entries, Truncated: cut})
	}
	return out, total, more
}

func treeKeep(e treeEntry) bool { return e.Kind == "folder" || e.Git != "" }
