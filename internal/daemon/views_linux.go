//go:build linux

package daemon

import (
	"context"
	"crypto/rand"
	"encoding/base32"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// Agent HTML views (ADR 0032). An offer freezes the files the agent names
// into an export under the person's own home: the export is the content, not
// a record about it, and its manifest says what the export holds. The gateway
// reads an export only through the fixed export-read route, which returns
// files of that one export and nothing else; who may read is the gateway's
// decision (the owner's own session only), what bytes exist is this daemon's.

const (
	AgentViewsPath      = "/agent/v1/views"
	AgentViewRemovePath = "/agent/v1/views/remove"
	ViewsPath           = "/api/v1/views"
	ViewExportPrefix    = "/view-export/"

	maxViewFiles = 500
	maxViewBytes = 50 << 20
	maxViewDepth = 16
	maxViewTitle = 200
	maxViewPath  = 1024
	maxViewList  = 200
)

var viewsDirParts = []string{".local", "state", "open-habitat", "views"}
var viewIDPattern = regexp.MustCompile(`^v[a-z2-7]{26}$`)
var viewConversationPattern = regexp.MustCompile(`^pi:[0-9a-fA-F-]{36}$`)

type viewSummary struct {
	ID             string `json:"view_id"`
	Title          string `json:"title"`
	Entry          string `json:"entry"`
	Files          int    `json:"files"`
	Bytes          int64  `json:"bytes"`
	CreatedAt      string `json:"created_at"`
	ConversationID string `json:"conversation_id,omitempty"`
}

type viewManifest struct {
	SchemaVersion int `json:"schema_version"`
	viewSummary
	IdempotencyKey string `json:"idempotency_key"`
	WorkspaceID    string `json:"workspace_id"`
	Path           string `json:"path"`
	SkippedHidden  int    `json:"skipped_hidden"`
}

type viewRequest struct {
	Key         string `json:"idempotency_key"`
	WorkspaceID string `json:"workspace_id"`
	Path        string `json:"path"`
	Entry       string `json:"entry,omitempty"`
	Title       string `json:"title,omitempty"`
	DryRun      bool   `json:"dry_run"`
}

func sameView(a, b *viewSummary) bool {
	return a == nil && b == nil || a != nil && b != nil && *a == *b
}

func validViewTitle(t string) bool {
	if !utf8.ValidString(t) || strings.TrimSpace(t) == "" || len(t) > maxViewTitle {
		return false
	}
	for _, r := range t {
		if unicode.IsControl(r) {
			return false
		}
	}
	return true
}

// validViewPath is a path inside an export: relative, clean, no dot
// components (hidden entries are never exported) and no control characters.
func validViewPath(p string) bool {
	if p == "" || len(p) > maxViewPath || !utf8.ValidString(p) || path.Clean(p) != p || strings.HasPrefix(p, "/") || strings.Contains(p, "\\") {
		return false
	}
	for _, part := range strings.Split(p, "/") {
		if part == "" || strings.HasPrefix(part, ".") || !validViewName(part) {
			return false
		}
	}
	return true
}

func validViewName(name string) bool {
	for _, r := range name {
		if unicode.IsControl(r) || r == '\\' {
			return false
		}
	}
	return utf8.ValidString(name) && name != "" && len(name) <= 255
}

// validViewSource is the workspace-relative path the agent names. "." is the
// workspace itself; an explicitly named dot path is allowed, since the agent
// chose it.
func validViewSource(p string) bool {
	if p == "." {
		return true
	}
	if p == "" || len(p) > maxViewPath || !utf8.ValidString(p) || path.Clean(p) != p || strings.HasPrefix(p, "/") {
		return false
	}
	for _, part := range strings.Split(p, "/") {
		if part == ".." || !validViewName(part) {
			return false
		}
	}
	return true
}

func viewEntryHTML(p string) bool {
	ext := strings.ToLower(path.Ext(p))
	return ext == ".html" || ext == ".htm"
}

func validViewSummary(v viewSummary) bool {
	t, err := time.Parse(time.RFC3339Nano, v.CreatedAt)
	return viewIDPattern.MatchString(v.ID) && validViewTitle(v.Title) && validViewPath(v.Entry) && viewEntryHTML(v.Entry) &&
		v.Files >= 1 && v.Files <= maxViewFiles && v.Bytes >= 0 && v.Bytes <= maxViewBytes && err == nil && !t.IsZero() &&
		(v.ConversationID == "" || viewConversationPattern.MatchString(v.ConversationID))
}

func newViewID() (string, error) {
	b := make([]byte, 17)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "v" + strings.ToLower(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b))[:26], nil
}

type viewFile struct {
	rel  string
	size int64
}

type viewPlan struct {
	single  bool
	entry   string
	files   []viewFile
	bytes   int64
	skipped int
}

type viewError struct {
	status int
	code   string
}

func (e viewError) Error() string { return e.code }

func viewFail(status int, code string) error { return viewError{status, code} }

func viewOpenError(err error) error {
	switch {
	case errors.Is(err, unix.ENOENT), errors.Is(err, unix.ENOTDIR):
		return viewFail(404, "view_source_not_found")
	case errors.Is(err, unix.ELOOP), errors.Is(err, unix.EXDEV):
		return viewFail(400, "unsafe_view_source")
	default:
		return viewFail(503, "native_source_unavailable")
	}
}

// planView observes what an offer would export without copying anything:
// a regular HTML file, or a directory's regular files below it. Symlinks and
// special files refuse the offer; hidden entries are skipped and counted.
func planView(root int, req viewRequest) (viewPlan, error) {
	fd, err := open(unix.Openat2, root, req.Path, unix.O_RDONLY|unix.O_NONBLOCK, true)
	if err != nil {
		return viewPlan{}, viewOpenError(err)
	}
	defer unix.Close(fd)
	st, err := stat(fd)
	if err != nil {
		return viewPlan{}, viewFail(503, "native_source_unavailable")
	}
	switch st.Mode & unix.S_IFMT {
	case unix.S_IFREG:
		name := path.Base(req.Path)
		if req.Entry != "" && req.Entry != name || !validViewPath(name) {
			return viewPlan{}, viewFail(400, "invalid_view_entry")
		}
		if !viewEntryHTML(name) {
			return viewPlan{}, viewFail(400, "view_entry_not_html")
		}
		if st.Size > maxViewBytes {
			return viewPlan{}, viewFail(413, "view_too_large")
		}
		return viewPlan{single: true, entry: name, files: []viewFile{{name, st.Size}}, bytes: st.Size}, nil
	case unix.S_IFDIR:
		if req.Entry == "" {
			return viewPlan{}, viewFail(400, "view_entry_required")
		}
		if !validViewPath(req.Entry) {
			return viewPlan{}, viewFail(400, "invalid_view_entry")
		}
		if !viewEntryHTML(req.Entry) {
			return viewPlan{}, viewFail(400, "view_entry_not_html")
		}
		plan := viewPlan{entry: req.Entry}
		if err := walkView(fd, "", 0, &plan); err != nil {
			return viewPlan{}, err
		}
		for _, f := range plan.files {
			if f.rel == req.Entry {
				return plan, nil
			}
		}
		return viewPlan{}, viewFail(404, "view_entry_not_found")
	default:
		return viewPlan{}, viewFail(400, "unsupported_view_source")
	}
}

func walkView(dirfd int, prefix string, depth int, plan *viewPlan) error {
	if depth > maxViewDepth {
		return viewFail(413, "view_too_deep")
	}
	copyFD, err := unix.Dup(dirfd)
	if err != nil {
		return viewFail(503, "native_source_unavailable")
	}
	d := os.NewFile(uintptr(copyFD), "view source")
	defer d.Close()
	var names []string
	for {
		batch, err := d.ReadDir(256)
		for _, e := range batch {
			names = append(names, e.Name())
		}
		if len(names) > 4*maxViewFiles {
			return viewFail(413, "view_too_many_files")
		}
		if errors.Is(err, io.EOF) || err == nil && len(batch) == 0 {
			break
		}
		if err != nil {
			return viewFail(503, "native_source_unavailable")
		}
	}
	sort.Strings(names)
	for _, name := range names {
		if strings.HasPrefix(name, ".") {
			plan.skipped++
			continue
		}
		if !validViewName(name) {
			return viewFail(400, "unsupported_view_name")
		}
		rel := name
		if prefix != "" {
			rel = prefix + "/" + name
		}
		if len(rel) > maxViewPath {
			return viewFail(400, "unsupported_view_name")
		}
		var st unix.Stat_t
		if err := unix.Fstatat(dirfd, name, &st, unix.AT_SYMLINK_NOFOLLOW); err != nil {
			return viewFail(503, "native_source_unavailable")
		}
		switch st.Mode & unix.S_IFMT {
		case unix.S_IFREG:
			plan.files = append(plan.files, viewFile{rel, st.Size})
			plan.bytes += st.Size
			if len(plan.files) > maxViewFiles {
				return viewFail(413, "view_too_many_files")
			}
			if plan.bytes > maxViewBytes {
				return viewFail(413, "view_too_large")
			}
		case unix.S_IFDIR:
			child, err := dir(unix.Openat2, dirfd, name, true)
			if err != nil {
				return viewOpenError(err)
			}
			err = walkView(child, rel, depth+1, plan)
			unix.Close(child)
			if err != nil {
				return err
			}
		case unix.S_IFLNK:
			return viewFail(400, "view_source_symlink")
		default:
			return viewFail(400, "unsupported_view_source")
		}
	}
	return nil
}

// exportView copies the planned files into a staging directory and publishes
// it under its ID with one rename, so a reader sees a whole export or none.
// A source file that changes size meanwhile refuses the offer.
func exportView(home string, root int, req viewRequest, plan viewPlan, summary viewSummary) error {
	views, err := personalDir(home, true, viewsDirParts...)
	if err != nil {
		return viewFail(503, "view_store_unavailable")
	}
	defer views.Close()
	staging := ".staging-" + summary.ID
	if err := unix.Mkdirat(int(views.Fd()), staging, 0700); err != nil {
		return viewFail(503, "view_store_unavailable")
	}
	published := false
	defer func() {
		if !published {
			_ = os.RemoveAll(filepath.Join(append(append([]string{home}, viewsDirParts...), staging)...))
		}
	}()
	stage, err := dir(unix.Openat2, int(views.Fd()), staging, true)
	if err != nil {
		return viewFail(503, "view_store_unavailable")
	}
	defer unix.Close(stage)
	if err := unix.Mkdirat(stage, "files", 0700); err != nil {
		return viewFail(503, "view_store_unavailable")
	}
	files, err := dir(unix.Openat2, stage, "files", true)
	if err != nil {
		return viewFail(503, "view_store_unavailable")
	}
	defer unix.Close(files)
	for _, f := range plan.files {
		source := req.Path
		if !plan.single {
			source = path.Join(req.Path, f.rel)
		}
		if err := copyViewFile(root, source, files, f); err != nil {
			return err
		}
	}
	m := viewManifest{SchemaVersion: 1, viewSummary: summary, IdempotencyKey: req.Key, WorkspaceID: req.WorkspaceID, Path: req.Path, SkippedHidden: plan.skipped}
	b, _ := json.Marshal(m)
	if err := writeViewFile(stage, "manifest.json", b); err != nil {
		return err
	}
	if err := unix.Renameat(int(views.Fd()), staging, int(views.Fd()), summary.ID); err != nil {
		return viewFail(503, "view_store_unavailable")
	}
	published = true
	_ = views.Sync()
	return nil
}

func writeViewFile(parent int, name string, b []byte) error {
	fd, err := unix.Openat(parent, name, unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0600)
	if err != nil {
		return viewFail(503, "view_store_unavailable")
	}
	f := os.NewFile(uintptr(fd), name)
	_, err = f.Write(b)
	if err == nil {
		err = f.Sync()
	}
	if e := f.Close(); err == nil {
		err = e
	}
	if err != nil {
		return viewFail(503, "view_store_unavailable")
	}
	return nil
}

func copyViewFile(root int, source string, files int, f viewFile) error {
	in, err := open(unix.Openat2, root, source, unix.O_RDONLY|unix.O_NONBLOCK, true)
	if err != nil {
		return viewOpenError(err)
	}
	src := os.NewFile(uintptr(in), "view source")
	defer src.Close()
	st, err := stat(in)
	if err != nil || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Size != f.size {
		return viewFail(409, "view_source_changed")
	}
	parent := files
	parts := strings.Split(f.rel, "/")
	for _, part := range parts[:len(parts)-1] {
		if err := unix.Mkdirat(parent, part, 0700); err != nil && !errors.Is(err, unix.EEXIST) {
			return viewFail(503, "view_store_unavailable")
		}
		next, err := dir(unix.Openat2, parent, part, true)
		if parent != files {
			unix.Close(parent)
		}
		if err != nil {
			return viewFail(503, "view_store_unavailable")
		}
		parent = next
	}
	if parent != files {
		defer unix.Close(parent)
	}
	out, err := unix.Openat(parent, parts[len(parts)-1], unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0600)
	if err != nil {
		return viewFail(503, "view_store_unavailable")
	}
	dst := os.NewFile(uintptr(out), "view file")
	n, err := io.Copy(dst, io.LimitReader(src, f.size+1))
	if err == nil {
		err = dst.Sync()
	}
	if e := dst.Close(); err == nil {
		err = e
	}
	if err != nil {
		return viewFail(503, "view_store_unavailable")
	}
	if n != f.size {
		return viewFail(409, "view_source_changed")
	}
	return nil
}

// openViews opens the person's export directory; absent means no views.
func openViews(home string) (*os.File, error) {
	return personalDir(home, false, viewsDirParts...)
}

func readViewManifest(views int, id string) (viewManifest, error) {
	fd, err := open(unix.Openat2, views, id+"/manifest.json", unix.O_RDONLY|unix.O_NONBLOCK, true)
	if err != nil {
		return viewManifest{}, err
	}
	f := os.NewFile(uintptr(fd), "view manifest")
	defer f.Close()
	st, err := stat(fd)
	if err != nil || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Size > 64<<10 {
		return viewManifest{}, errors.New("invalid view manifest")
	}
	var m viewManifest
	d := json.NewDecoder(io.LimitReader(f, 64<<10))
	d.DisallowUnknownFields()
	if d.Decode(&m) != nil || m.SchemaVersion != 1 || m.ID != id || !validViewSummary(m.viewSummary) {
		return viewManifest{}, errors.New("invalid view manifest")
	}
	return m, nil
}

// listViews reads every valid export, newest first. An unreadable manifest is
// left out, not repaired.
func listViews(home string) ([]viewManifest, error) {
	views, err := openViews(home)
	if errors.Is(err, os.ErrNotExist) {
		return []viewManifest{}, nil
	}
	if err != nil {
		return nil, err
	}
	defer views.Close()
	names, err := views.Readdirnames(-1)
	if err != nil {
		return nil, err
	}
	out := []viewManifest{}
	for _, name := range names {
		if !viewIDPattern.MatchString(name) {
			continue
		}
		if m, err := readViewManifest(int(views.Fd()), name); err == nil {
			out = append(out, m)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].CreatedAt != out[j].CreatedAt {
			return out[i].CreatedAt > out[j].CreatedAt
		}
		return out[i].ID < out[j].ID
	})
	return out, nil
}

// removeView renames the export out of the readable namespace before removing
// it, so the export-read route never serves a half-removed view.
func removeView(home, id string) error {
	views, err := openViews(home)
	if err != nil {
		return err
	}
	defer views.Close()
	if _, err := readViewManifest(int(views.Fd()), id); err != nil {
		return os.ErrNotExist
	}
	gone := ".removing-" + id
	if err := unix.Renameat(int(views.Fd()), id, int(views.Fd()), gone); err != nil {
		return err
	}
	return os.RemoveAll(filepath.Join(append(append([]string{home}, viewsDirParts...), gone)...))
}

// ViewsHandler is the browser's list of the person's views.
func ViewsHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.Method != http.MethodGet || r.URL.Path != ViewsPath || r.URL.EscapedPath() != ViewsPath || r.URL.RawQuery != "" || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		list, err := listViews(cfg.Home)
		if err != nil {
			snapshotError(w, 503, "view_store_unavailable")
			return
		}
		views := make([]viewSummary, 0, len(list))
		for _, m := range list {
			if len(views) == maxViewList {
				break
			}
			views = append(views, m.viewSummary)
		}
		historyJSON(w, map[string]any{"schema_version": 1, "views": views})
	})
}

// ViewExportHandler is the fixed export-read route, for the gateway's view
// origin only (the app origin has no route to it). `/view-export/<id>/` is
// the export's summary; `/view-export/<id>/<path>` is one regular file of
// that export, opened beneath it without following any symlink. The bytes go
// out as opaque octets: the gateway alone decides how a view host presents
// them.
func ViewExportHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead || r.URL.RawPath != "" || r.URL.RawQuery != "" || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || !strings.HasPrefix(r.URL.Path, ViewExportPrefix) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		id, rel, ok := strings.Cut(strings.TrimPrefix(r.URL.Path, ViewExportPrefix), "/")
		if !ok || !viewIDPattern.MatchString(id) || rel != "" && !validViewPath(rel) {
			snapshotError(w, 404, "view_file_not_found")
			return
		}
		views, err := openViews(cfg.Home)
		if errors.Is(err, os.ErrNotExist) {
			snapshotError(w, 404, "view_not_found")
			return
		}
		if err != nil {
			snapshotError(w, 503, "view_store_unavailable")
			return
		}
		defer views.Close()
		m, err := readViewManifest(int(views.Fd()), id)
		if err != nil {
			if errors.Is(err, unix.ENOENT) {
				snapshotError(w, 404, "view_not_found")
			} else {
				snapshotError(w, 503, "view_store_unavailable")
			}
			return
		}
		if rel == "" {
			historyJSON(w, map[string]any{"schema_version": 1, "view": m.viewSummary})
			return
		}
		fd, err := open(unix.Openat2, int(views.Fd()), id+"/files/"+rel, unix.O_RDONLY|unix.O_NONBLOCK, true)
		if err != nil {
			snapshotError(w, 404, "view_file_not_found")
			return
		}
		f := os.NewFile(uintptr(fd), "view file")
		defer f.Close()
		st, err := stat(fd)
		if err != nil || st.Mode&unix.S_IFMT != unix.S_IFREG {
			snapshotError(w, 404, "view_file_not_found")
			return
		}
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Length", strconv.FormatInt(st.Size, 10))
		w.WriteHeader(200)
		if r.Method == http.MethodGet {
			_, _ = io.Copy(w, io.LimitReader(f, st.Size))
		}
	})
}

// agentViews is the agent listener's offer, list and remove. An offer names
// its conversation like a notice does (explicit pi:UUID or the checked launch
// context) and arrives there as a notice; there is no offer without a
// conversation. The reply says the offer was published to the person's open
// browsers, never that anyone saw it.
func (c *ConversationController) agentViews(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == AgentViewRemovePath {
		var req struct {
			ID     string `json:"view_id"`
			DryRun bool   `json:"dry_run"`
		}
		if r.Method != http.MethodPost || r.URL.RawQuery != "" || !strictViewBody(w, r, &req) || !viewIDPattern.MatchString(req.ID) {
			snapshotError(w, 400, "invalid_arguments")
			return
		}
		if req.DryRun {
			views, err := openViews(c.viewCfg().Home)
			if err == nil {
				_, err = readViewManifest(int(views.Fd()), req.ID)
				views.Close()
			}
			if err != nil {
				snapshotError(w, 404, "view_not_found")
				return
			}
			historyJSON(w, map[string]any{"schema_version": 1, "view_id": req.ID, "removed": false, "dry_run": true})
			return
		}
		if err := removeView(c.viewCfg().Home, req.ID); err != nil {
			if errors.Is(err, os.ErrNotExist) {
				snapshotError(w, 404, "view_not_found")
			} else {
				snapshotError(w, 503, "view_store_unavailable")
			}
			return
		}
		historyJSON(w, map[string]any{"schema_version": 1, "view_id": req.ID, "removed": true, "dry_run": false})
		return
	}
	if r.Method == http.MethodGet {
		if r.URL.RawQuery != "" || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_arguments")
			return
		}
		list, err := listViews(c.viewCfg().Home)
		if err != nil {
			snapshotError(w, 503, "view_store_unavailable")
			return
		}
		if len(list) > maxViewList {
			list = list[:maxViewList]
		}
		historyJSON(w, map[string]any{"schema_version": 1, "views": list})
		return
	}
	if r.Method != http.MethodPost {
		snapshotError(w, 404, "route_not_found")
		return
	}
	// An offer without its conversation is refused: its card has no place.
	q, bad := parseAgentConversation(r)
	if bad {
		snapshotError(w, 400, "invalid_arguments")
		return
	}
	var req viewRequest
	if !strictViewBody(w, r, &req) || !sessionIDPattern.MatchString(req.Key) || !idPattern.MatchString(req.WorkspaceID) || !validViewSource(req.Path) || req.Entry != "" && !validViewPath(req.Entry) || req.Title != "" && !validViewTitle(req.Title) {
		snapshotError(w, 400, "invalid_arguments")
		return
	}
	c.viewMu.Lock()
	defer c.viewMu.Unlock()
	existing, err := findViewByKey(c.viewCfg().Home, req.Key)
	if err != nil {
		snapshotError(w, 503, "view_store_unavailable")
		return
	}
	if existing != nil && (existing.WorkspaceID != req.WorkspaceID || existing.Path != req.Path || req.Entry != "" && existing.Entry != req.Entry || req.Title != "" && existing.Title != req.Title || existing.ConversationID != q.id) {
		snapshotError(w, 409, "idempotency_conflict")
		return
	}
	if existing == nil {
		// Refuse before copying when the offer could not reach its conversation.
		c.noticeMu.Lock()
		s, live, source, _, status, code := c.noticeTarget(q)
		c.noticeMu.Unlock()
		if source == nil {
			snapshotError(w, status, code)
			return
		}
		if !live || s.cwd != source.cwd {
			snapshotError(w, 409, "conversation_not_running")
			return
		}
	}
	var summary viewSummary
	skipped := 0
	if existing != nil {
		summary, skipped = existing.viewSummary, existing.SkippedHidden
	} else {
		target, _, status, code := composerTarget(c.viewCfg(), req.WorkspaceID)
		if target == nil {
			snapshotError(w, status, code)
			return
		}
		root, still, done, err := target.open()
		if err != nil {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		defer done()
		plan, err := planView(root, req)
		if err != nil {
			viewErrorReply(w, err)
			return
		}
		title := req.Title
		if title == "" {
			title = path.Base(req.Path)
			if req.Path == "." || !validViewTitle(title) {
				title = path.Base(plan.entry)
			}
			// A file name may be longer than a title; keep whole characters.
			for len(title) > maxViewTitle {
				_, size := utf8.DecodeLastRuneInString(title)
				title = title[:len(title)-size]
			}
		}
		summary = viewSummary{Title: title, Entry: plan.entry, Files: len(plan.files), Bytes: plan.bytes, CreatedAt: time.Now().UTC().Format(time.RFC3339Nano), ConversationID: q.id}
		skipped = plan.skipped
		if req.DryRun {
			historyJSON(w, map[string]any{"schema_version": 1, "dry_run": true, "plan": map[string]any{"title": summary.Title, "entry": summary.Entry, "files": summary.Files, "bytes": summary.Bytes, "skipped_hidden": skipped, "conversation_id": q.id}})
			return
		}
		if summary.ID, err = newViewID(); err != nil {
			snapshotError(w, 503, "view_store_unavailable")
			return
		}
		// Publish only what the reader will accept back.
		if !validViewSummary(summary) {
			snapshotError(w, 400, "invalid_view_title")
			return
		}
		if err := exportView(c.viewCfg().Home, root, req, plan, summary); err != nil {
			viewErrorReply(w, err)
			return
		}
		if !still() {
			_ = removeView(c.viewCfg().Home, summary.ID)
			snapshotError(w, 409, "view_source_changed")
			return
		}
	}
	if req.DryRun {
		historyJSON(w, map[string]any{"schema_version": 1, "dry_run": true, "plan": map[string]any{"title": summary.Title, "entry": summary.Entry, "files": summary.Files, "bytes": summary.Bytes, "skipped_hidden": skipped, "conversation_id": q.id}})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	n, status, code := c.createNotice(ctx, q, req.Key, summary.Title, &summary, false)
	if status != 0 {
		if existing == nil {
			_ = removeView(c.viewCfg().Home, summary.ID)
		}
		snapshotError(w, status, code)
		return
	}
	offer := map[string]any{"agent_id": q.id, "persistence": n.Persistence}
	historyJSON(w, map[string]any{"schema_version": 1, "dry_run": false, "reused": existing != nil, "view": summary, "skipped_hidden": skipped, "offer": offer})
}

// viewCfg is the person's configuration with the home the controller reads;
// the browser host gives its controller a disposable home.
func (c *ConversationController) viewCfg() transport.Config {
	cfg := c.cfg
	if c.home != "" {
		cfg.Home = c.home
	}
	return cfg
}

// FixtureView exports a synthetic multi-file site from the controller's home
// through the real plan and export, and offers it to a conversation as a
// transient notice. It is not mounted by the product and is unavailable
// outside the browser-host controller.
func (c *ConversationController) FixtureView(target string) (string, bool) {
	if !c.fixture || c.journal == nil || !viewConversationPattern.MatchString(target) {
		return "", false
	}
	home := c.viewCfg().Home
	site := filepath.Join(home, "src", "view-fixture", "site")
	if os.MkdirAll(filepath.Join(site, "assets"), 0700) != nil {
		return "", false
	}
	for name, text := range map[string]string{
		"index.html":       viewFixturePage,
		"assets/app.js":    viewFixtureScript,
		"assets/style.css": "body{color:rgb(1, 2, 3)}\n",
		".secret":          "hidden",
	} {
		if os.WriteFile(filepath.Join(site, name), []byte(text), 0600) != nil {
			return "", false
		}
	}
	root, err := unix.Open(filepath.Join(home, "src", "view-fixture"), unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if err != nil {
		return "", false
	}
	defer unix.Close(root)
	key, _ := uuid()
	req := viewRequest{Key: key, WorkspaceID: "ws_viewfixture", Path: "site", Entry: "index.html"}
	plan, err := planView(root, req)
	if err != nil {
		return "", false
	}
	summary := viewSummary{Title: "Synteettinen näkymä", Entry: plan.entry, Files: len(plan.files), Bytes: plan.bytes, CreatedAt: time.Now().UTC().Format(time.RFC3339Nano), ConversationID: target}
	if summary.ID, err = newViewID(); err != nil || exportView(home, root, req, plan, summary) != nil {
		return "", false
	}
	n := agentNotice{ID: key, Origin: "agent", Timestamp: time.Now().UTC().Format(time.RFC3339Nano), Text: summary.Title, Persistence: "not_persisted", View: &summary}
	c.journal.appendEvent("notice.created", target, map[string]any{"notice": n})
	return summary.ID, true
}

// The fixture page reports what its sandbox allowed as data attributes.
const viewFixturePage = `<!doctype html><html><head><meta charset="utf-8"><title>Fixture</title><link rel="stylesheet" href="assets/style.css"></head><body data-script="no"><h1 id="heading">Synteettinen näkymä</h1><script src="assets/app.js"></script></body></html>
`

const viewFixtureScript = `document.body.dataset.script = "yes";
try { document.body.dataset.cookie = "readable:" + document.cookie; } catch (e) { document.body.dataset.cookie = "denied"; }
try { document.body.dataset.parent = String(window.parent.location.href); } catch (e) { document.body.dataset.parent = "denied"; }
try { localStorage.setItem("x", "1"); document.body.dataset.storage = "yes"; } catch (e) { document.body.dataset.storage = "denied"; }
document.body.dataset.style = getComputedStyle(document.body).color;
fetch("assets/style.css").then(function () { document.body.dataset.fetch = "allowed"; }, function () { document.body.dataset.fetch = "denied"; });
`

func viewErrorReply(w http.ResponseWriter, err error) {
	var v viewError
	if errors.As(err, &v) {
		snapshotError(w, v.status, v.code)
		return
	}
	snapshotError(w, 503, "native_source_unavailable")
}

func strictViewBody(w http.ResponseWriter, r *http.Request, v any) bool {
	if r.Header.Get("Content-Type") != "application/json" || r.ContentLength < 2 || r.ContentLength > 8192 {
		return false
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
	d.DisallowUnknownFields()
	return d.Decode(v) == nil && d.Decode(new(any)) == io.EOF
}

func findViewByKey(home, key string) (*viewManifest, error) {
	list, err := listViews(home)
	if err != nil {
		return nil, err
	}
	for i := range list {
		if list[i].IdempotencyKey == key {
			return &list[i], nil
		}
	}
	return nil, nil
}

// ViewExportPath is the export-read path of one file of an export.
func ViewExportPath(id, rel string) string {
	return ViewExportPrefix + id + "/" + (&url.URL{Path: rel}).EscapedPath()
}
