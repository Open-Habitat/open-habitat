//go:build linux

package daemon

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base32"
	"encoding/binary"
	"encoding/json"
	"errors"
	"image"
	"image/color"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// Agent file offers: the agent hands files it produced to the person in a
// conversation. Like an HTML view (ADR 0032) an offer freezes a copy of the
// named workspace files under the person's own home, so a later rewrite of the
// workspace never changes what the card offers, and its manifest is the
// export's own description, not a record about it. The browser reads an offer
// only through the fixed routes below, which return files of that one export
// and nothing else; who may read is the gateway's decision (the owner's own
// session only), what bytes exist is this daemon's, and how the bytes are
// presented (type, inline or attachment) is again the gateway's: the daemon
// sends opaque octets.

const (
	AgentFileOffersPath      = "/agent/v1/file-offers"
	AgentFileOfferRemovePath = "/agent/v1/file-offers/remove"
	FileOffersPath           = "/api/v1/file-offers"

	maxOfferFiles   = 200
	maxOfferBytes   = 512 << 20
	maxOfferSources = 20
	// The manifest also carries zip listings; past this they are left out.
	maxOfferManifest = 2 << 20
	maxArchiveNames  = 100
	// Lines are counted for text kinds up to this size.
	maxCountedText = 16 << 20
)

var fileOffersDirParts = []string{".local", "state", "open-habitat", "files"}
var fileOfferIDPattern = regexp.MustCompile(`^f[a-z2-7]{26}$`)

type fileOfferSummary struct {
	ID    string `json:"offer_id"`
	Title string `json:"title"`
	// Folder is the offered directory's name when one directory was offered.
	Folder         string `json:"folder,omitempty"`
	Files          int    `json:"files"`
	Bytes          int64  `json:"bytes"`
	CreatedAt      string `json:"created_at"`
	ConversationID string `json:"conversation_id"`
}

type archiveName struct {
	Path  string `json:"path"`
	Bytes int64  `json:"bytes"`
}

type fileArchive struct {
	Entries int           `json:"entries"`
	Bytes   int64         `json:"bytes"`
	Names   []archiveName `json:"names"`
}

// fileOfferItem is one frozen file and the facts read from it once, when the
// offer was frozen: its kind, and what the card's facts line says about it.
type fileOfferItem struct {
	Path    string       `json:"path"`
	Bytes   int64        `json:"bytes"`
	Kind    string       `json:"kind"`
	Width   int          `json:"width,omitempty"`
	Height  int          `json:"height,omitempty"`
	Lines   int          `json:"lines,omitempty"`
	Columns int          `json:"columns,omitempty"`
	Archive *fileArchive `json:"archive,omitempty"`
}

type fileOfferManifest struct {
	SchemaVersion int `json:"schema_version"`
	fileOfferSummary
	IdempotencyKey string          `json:"idempotency_key"`
	WorkspaceID    string          `json:"workspace_id"`
	Paths          []string        `json:"paths"`
	SkippedHidden  int             `json:"skipped_hidden"`
	Items          []fileOfferItem `json:"items"`
}

type fileOfferRequest struct {
	Key         string   `json:"idempotency_key"`
	WorkspaceID string   `json:"workspace_id"`
	Paths       []string `json:"paths"`
	Title       string   `json:"title,omitempty"`
	DryRun      bool     `json:"dry_run"`
}

var fileKinds = map[string]bool{"image": true, "svg": true, "video": true, "audio": true, "markdown": true, "pdf": true, "docx": true, "xlsx": true, "pptx": true, "csv": true, "code": true, "text": true, "zip": true, "file": true}

func sameFileOffer(a, b *fileOfferSummary) bool {
	return a == nil && b == nil || a != nil && b != nil && *a == *b
}

func validFileOfferSummary(v fileOfferSummary) bool {
	t, err := time.Parse(time.RFC3339Nano, v.CreatedAt)
	return fileOfferIDPattern.MatchString(v.ID) && validViewTitle(v.Title) && (v.Folder == "" || validViewPath(v.Folder) && !strings.Contains(v.Folder, "/")) &&
		v.Files >= 1 && v.Files <= maxOfferFiles && v.Bytes >= 0 && v.Bytes <= maxOfferBytes && err == nil && !t.IsZero() &&
		viewConversationPattern.MatchString(v.ConversationID)
}

func validFileOfferItem(i fileOfferItem) bool {
	if !validViewPath(i.Path) || i.Bytes < 0 || i.Bytes > maxOfferBytes || !fileKinds[i.Kind] || i.Width < 0 || i.Height < 0 || i.Lines < 0 || i.Columns < 0 {
		return false
	}
	if a := i.Archive; a != nil {
		if a.Entries < 0 || a.Bytes < 0 || len(a.Names) > maxArchiveNames {
			return false
		}
		for _, n := range a.Names {
			if !validArchiveName(n.Path) || n.Bytes < 0 {
				return false
			}
		}
	}
	return true
}

func validArchiveName(p string) bool {
	if p == "" || len(p) > maxViewPath || !utf8.ValidString(p) {
		return false
	}
	for _, r := range p {
		if unicode.IsControl(r) {
			return false
		}
	}
	return true
}

func newFileOfferID() (string, error) {
	b := make([]byte, 17)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "f" + strings.ToLower(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b))[:26], nil
}

// fileOfferCodes renames the shared freezing errors for the agent: the view
// and the file offer copy files by the same rules, but an agent offering
// files should not read about views.
var fileOfferCodes = map[string]string{
	"view_source_not_found":     "file_source_not_found",
	"unsafe_view_source":        "unsafe_file_source",
	"view_too_deep":             "file_offer_too_deep",
	"view_too_many_files":       "file_offer_too_many_files",
	"view_too_large":            "file_offer_too_large",
	"view_source_symlink":       "file_source_symlink",
	"unsupported_view_source":   "unsupported_file_source",
	"unsupported_view_name":     "unsupported_file_name",
	"view_source_changed":       "file_source_changed",
	"view_store_unavailable":    "file_store_unavailable",
	"native_source_unavailable": "native_source_unavailable",
}

func fileOfferError(err error) error {
	var v viewError
	if errors.As(err, &v) {
		if code, ok := fileOfferCodes[v.code]; ok {
			return viewFail(v.status, code)
		}
		return v
	}
	return viewFail(503, "native_source_unavailable")
}

type offerFile struct {
	source   string // workspace-relative path to copy from
	viewFile        // rel: the path inside the offer
}

type offerPlan struct {
	folder  string
	files   []offerFile
	bytes   int64
	skipped int
}

// planFileOffer observes what an offer would freeze without copying: each
// named regular file under its own name, each named directory's regular files
// under the directory's name. One directory alone is the offer itself, its
// files at the top. Symlinks and special files refuse the offer; hidden
// entries inside a directory are skipped and counted.
func planFileOffer(root int, paths []string) (offerPlan, error) {
	plan := offerPlan{}
	seen := map[string]bool{}
	for _, p := range paths {
		fd, err := open(unix.Openat2, root, p, unix.O_RDONLY|unix.O_NONBLOCK, true)
		if err != nil {
			return offerPlan{}, fileOfferError(viewOpenError(err))
		}
		st, err := stat(fd)
		if err != nil {
			unix.Close(fd)
			return offerPlan{}, viewFail(503, "native_source_unavailable")
		}
		name := path.Base(p)
		if p == "." {
			name = ""
		}
		switch st.Mode & unix.S_IFMT {
		case unix.S_IFREG:
			unix.Close(fd)
			if !validViewPath(name) {
				return offerPlan{}, viewFail(400, "unsupported_file_name")
			}
			plan.files = append(plan.files, offerFile{p, viewFile{name, st.Size}})
			plan.bytes += st.Size
		case unix.S_IFDIR:
			alone := len(paths) == 1
			if !alone && !validViewPath(name) {
				unix.Close(fd)
				return offerPlan{}, viewFail(400, "unsupported_file_name")
			}
			walk := viewPlan{}
			err := walkView(fd, "", 0, &walk, viewLimits{maxOfferFiles, maxOfferBytes})
			unix.Close(fd)
			if err != nil {
				return offerPlan{}, fileOfferError(err)
			}
			plan.skipped += walk.skipped
			for _, f := range walk.files {
				rel := f.rel
				if !alone {
					rel = name + "/" + f.rel
				}
				plan.files = append(plan.files, offerFile{path.Join(p, f.rel), viewFile{rel, f.size}})
				plan.bytes += f.size
			}
			if alone && validViewPath(name) {
				plan.folder = name
			}
		default:
			unix.Close(fd)
			return offerPlan{}, viewFail(400, "unsupported_file_source")
		}
		if len(plan.files) > maxOfferFiles {
			return offerPlan{}, viewFail(413, "file_offer_too_many_files")
		}
		if plan.bytes > maxOfferBytes {
			return offerPlan{}, viewFail(413, "file_offer_too_large")
		}
	}
	if len(plan.files) == 0 {
		return offerPlan{}, viewFail(400, "file_offer_empty")
	}
	for _, f := range plan.files {
		if len(f.rel) > maxViewPath || seen[f.rel] {
			return offerPlan{}, viewFail(400, "duplicate_file_name")
		}
		seen[f.rel] = true
	}
	sort.Slice(plan.files, func(i, j int) bool { return plan.files[i].rel < plan.files[j].rel })
	return plan, nil
}

// exportFileOffer copies the planned files into a staging directory, reads
// each copy's facts and publishes the offer under its ID with one rename, so a
// reader sees a whole offer or none.
func exportFileOffer(home string, root int, req fileOfferRequest, plan offerPlan, summary fileOfferSummary) error {
	store, err := personalDir(home, true, fileOffersDirParts...)
	if err != nil {
		return viewFail(503, "file_store_unavailable")
	}
	defer store.Close()
	staging := ".staging-" + summary.ID
	if err := unix.Mkdirat(int(store.Fd()), staging, 0700); err != nil {
		return viewFail(503, "file_store_unavailable")
	}
	published := false
	defer func() {
		if !published {
			_ = os.RemoveAll(filepath.Join(append(append([]string{home}, fileOffersDirParts...), staging)...))
		}
	}()
	stage, err := dir(unix.Openat2, int(store.Fd()), staging, true)
	if err != nil {
		return viewFail(503, "file_store_unavailable")
	}
	defer unix.Close(stage)
	if err := unix.Mkdirat(stage, "files", 0700); err != nil {
		return viewFail(503, "file_store_unavailable")
	}
	files, err := dir(unix.Openat2, stage, "files", true)
	if err != nil {
		return viewFail(503, "file_store_unavailable")
	}
	defer unix.Close(files)
	items := make([]fileOfferItem, 0, len(plan.files))
	for _, f := range plan.files {
		if err := copyViewFile(root, f.source, files, f.viewFile); err != nil {
			return fileOfferError(err)
		}
		items = append(items, frozenFacts(files, f.rel, f.size))
	}
	m := fileOfferManifest{SchemaVersion: 1, fileOfferSummary: summary, IdempotencyKey: req.Key, WorkspaceID: req.WorkspaceID, Paths: req.Paths, SkippedHidden: plan.skipped, Items: items}
	b, _ := json.Marshal(m)
	if len(b) > maxOfferManifest {
		for i := range m.Items {
			if m.Items[i].Archive != nil {
				m.Items[i].Archive.Names = []archiveName{}
			}
		}
		b, _ = json.Marshal(m)
	}
	if len(b) > maxOfferManifest {
		return viewFail(413, "file_offer_too_many_files")
	}
	if err := writeViewFile(stage, "manifest.json", b); err != nil {
		return fileOfferError(err)
	}
	if err := unix.Renameat(int(store.Fd()), staging, int(store.Fd()), summary.ID); err != nil {
		return viewFail(503, "file_store_unavailable")
	}
	published = true
	_ = store.Sync()
	return nil
}

var codeExtensions = map[string]bool{
	"py": true, "js": true, "mjs": true, "ts": true, "tsx": true, "jsx": true, "go": true, "rs": true, "java": true, "kt": true, "c": true, "h": true, "cpp": true, "hpp": true, "cs": true,
	"rb": true, "php": true, "sh": true, "bash": true, "zsh": true, "sql": true, "r": true, "swift": true, "lua": true, "pl": true, "scala": true, "css": true, "scss": true, "html": true, "htm": true,
}
var textExtensions = map[string]bool{"txt": true, "log": true, "json": true, "jsonl": true, "yaml": true, "yml": true, "toml": true, "ini": true, "xml": true, "gpx": true, "tex": true, "rst": true}

// fileKind is what the person gets from a file: the name's extension says what
// the agent meant, and where the bytes can be checked cheaply they must agree,
// so a misnamed file is offered as a plain file instead of a broken preview.
func fileKind(name string, head []byte) string {
	ext := strings.ToLower(strings.TrimPrefix(path.Ext(name), "."))
	zipHead := bytes.HasPrefix(head, []byte("PK\x03\x04"))
	switch ext {
	case "png", "jpg", "jpeg", "gif", "webp", "avif":
		return "image"
	case "svg":
		return "svg"
	case "mp4", "m4v", "webm", "mov":
		return "video"
	case "mp3", "m4a", "ogg", "oga", "opus", "wav", "flac", "aac":
		return "audio"
	case "md", "markdown":
		return "markdown"
	case "pdf":
		if bytes.HasPrefix(head, []byte("%PDF-")) {
			return "pdf"
		}
	case "docx", "xlsx", "pptx":
		if zipHead {
			return ext
		}
	case "csv", "tsv":
		return "csv"
	case "zip":
		if zipHead || bytes.HasPrefix(head, []byte("PK\x05\x06")) {
			return "zip"
		}
	default:
		if codeExtensions[ext] {
			return "code"
		}
		if textExtensions[ext] {
			return "text"
		}
	}
	return "file"
}

// frozenFacts reads a frozen copy's kind and the facts its card shows. A fact
// that cannot be read is left out; it never refuses the offer.
func frozenFacts(files int, rel string, size int64) fileOfferItem {
	item := fileOfferItem{Path: rel, Bytes: size, Kind: "file"}
	fd, err := open(unix.Openat2, files, rel, unix.O_RDONLY|unix.O_NONBLOCK, true)
	if err != nil {
		return item
	}
	f := os.NewFile(uintptr(fd), "offered file")
	defer f.Close()
	head := make([]byte, 512)
	n, _ := io.ReadFull(f, head)
	item.Kind = fileKind(rel, head[:n])
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		return item
	}
	switch item.Kind {
	case "image":
		if cfg, _, err := image.DecodeConfig(io.LimitReader(f, 1<<20)); err == nil {
			item.Width, item.Height = cfg.Width, cfg.Height
		}
	case "markdown", "csv", "code", "text":
		if size <= maxCountedText {
			item.Lines, item.Columns = countText(f, item.Kind == "csv", strings.HasSuffix(strings.ToLower(rel), ".tsv"))
		}
	case "zip":
		item.Archive = readArchive(f, size)
	}
	return item
}

// countText counts lines and, for a table, the first row's columns (a quoted
// separator does not split a column).
func countText(r io.Reader, table, tabs bool) (int, int) {
	data, err := io.ReadAll(io.LimitReader(r, maxCountedText))
	if err != nil || len(data) == 0 {
		return 0, 0
	}
	lines := bytes.Count(data, []byte{'\n'})
	if data[len(data)-1] != '\n' {
		lines++
	}
	columns := 0
	if table {
		sep := byte(',')
		if tabs {
			sep = '\t'
		}
		first, _, _ := bytes.Cut(data, []byte{'\n'})
		columns = 1
		quoted := false
		for _, c := range first {
			switch {
			case c == '"':
				quoted = !quoted
			case c == sep && !quoted:
				columns++
			}
		}
	}
	return lines, columns
}

// maxArchiveDirectory bounds the central directory read for a zip's listing:
// the reader holds every entry in memory, and a small archive can name
// millions of empty ones.
const maxArchiveDirectory = 1 << 20

// readArchive lists a zip from its central directory without extracting it.
// A ZIP64 or commented archive, or one whose directory is larger than the
// bound, is offered without a listing.
func readArchive(f *os.File, size int64) *fileArchive {
	var end [22]byte
	if size < int64(len(end)) {
		return nil
	}
	if _, err := f.ReadAt(end[:], size-int64(len(end))); err != nil || string(end[:4]) != "PK\x05\x06" {
		return nil
	}
	if binary.LittleEndian.Uint16(end[10:]) == 0xFFFF || binary.LittleEndian.Uint32(end[12:]) > maxArchiveDirectory {
		return nil
	}
	z, err := zip.NewReader(f, size)
	if err != nil {
		return nil
	}
	a := &fileArchive{Names: []archiveName{}}
	for _, e := range z.File {
		if strings.HasSuffix(e.Name, "/") {
			continue
		}
		a.Entries++
		a.Bytes += int64(e.UncompressedSize64)
		if len(a.Names) < maxArchiveNames && validArchiveName(e.Name) {
			a.Names = append(a.Names, archiveName{e.Name, int64(e.UncompressedSize64)})
		}
	}
	if a.Bytes < 0 {
		a.Bytes = 0
	}
	return a
}

func openFileOffers(home string) (*os.File, error) {
	return personalDir(home, false, fileOffersDirParts...)
}

func readFileOfferManifest(store int, id string) (fileOfferManifest, error) {
	fd, err := open(unix.Openat2, store, id+"/manifest.json", unix.O_RDONLY|unix.O_NONBLOCK, true)
	if err != nil {
		return fileOfferManifest{}, err
	}
	f := os.NewFile(uintptr(fd), "file offer manifest")
	defer f.Close()
	st, err := stat(fd)
	if err != nil || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Size > maxOfferManifest {
		return fileOfferManifest{}, errors.New("invalid file offer manifest")
	}
	var m fileOfferManifest
	d := json.NewDecoder(io.LimitReader(f, maxOfferManifest))
	d.DisallowUnknownFields()
	if d.Decode(&m) != nil || m.SchemaVersion != 1 || m.ID != id || !validFileOfferSummary(m.fileOfferSummary) || len(m.Items) != m.Files {
		return fileOfferManifest{}, errors.New("invalid file offer manifest")
	}
	for _, i := range m.Items {
		if !validFileOfferItem(i) {
			return fileOfferManifest{}, errors.New("invalid file offer manifest")
		}
	}
	return m, nil
}

// fileOfferHead is what a list and the idempotency lookup need of a
// manifest: never its items, which can be large.
type fileOfferHead struct {
	SchemaVersion int `json:"schema_version"`
	fileOfferSummary
	IdempotencyKey string   `json:"idempotency_key"`
	WorkspaceID    string   `json:"workspace_id"`
	Paths          []string `json:"paths"`
	SkippedHidden  int      `json:"skipped_hidden"`
}

func readFileOfferHead(store int, id string) (fileOfferHead, error) {
	fd, err := open(unix.Openat2, store, id+"/manifest.json", unix.O_RDONLY|unix.O_NONBLOCK, true)
	if err != nil {
		return fileOfferHead{}, err
	}
	f := os.NewFile(uintptr(fd), "file offer manifest")
	defer f.Close()
	st, err := stat(fd)
	if err != nil || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Size > maxOfferManifest {
		return fileOfferHead{}, errors.New("invalid file offer manifest")
	}
	var h fileOfferHead
	// The items are skipped here; the offer's own read validates them.
	if json.NewDecoder(io.LimitReader(f, maxOfferManifest)).Decode(&h) != nil || h.SchemaVersion != 1 || h.ID != id || !validFileOfferSummary(h.fileOfferSummary) {
		return fileOfferHead{}, errors.New("invalid file offer manifest")
	}
	return h, nil
}

// listFileOffers reads every valid offer, or one conversation's, newest
// first. An unreadable manifest is left out, not repaired.
func listFileOffers(home, conversation string) ([]fileOfferHead, error) {
	store, err := openFileOffers(home)
	if errors.Is(err, os.ErrNotExist) {
		return []fileOfferHead{}, nil
	}
	if err != nil {
		return nil, err
	}
	defer store.Close()
	names, err := store.Readdirnames(-1)
	if err != nil {
		return nil, err
	}
	out := []fileOfferHead{}
	for _, name := range names {
		if !fileOfferIDPattern.MatchString(name) {
			continue
		}
		if h, err := readFileOfferHead(int(store.Fd()), name); err == nil && (conversation == "" || h.ConversationID == conversation) {
			out = append(out, h)
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

// removeFileOffer renames the offer out of the readable namespace before
// removing it, so the read routes never serve a half-removed offer.
func removeFileOffer(home, id string) error {
	store, err := openFileOffers(home)
	if err != nil {
		return err
	}
	defer store.Close()
	if _, err := readFileOfferManifest(int(store.Fd()), id); err != nil {
		return os.ErrNotExist
	}
	gone := ".removing-" + id
	if err := unix.Renameat(int(store.Fd()), id, int(store.Fd()), gone); err != nil {
		return err
	}
	return os.RemoveAll(filepath.Join(append(append([]string{home}, fileOffersDirParts...), gone)...))
}

func findFileOfferByKey(home, key string) (*fileOfferHead, error) {
	list, err := listFileOffers(home, "")
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

// FileOffersHandler is the browser's read of the person's own offers:
//
//	GET /api/v1/file-offers[?conversation_id=pi:UUID]
//	                                          the offers (one conversation's), newest first
//	GET /api/v1/file-offers/<id>              one offer and its files' facts
//	GET /api/v1/file-offers/<id>/files/<path> one frozen file, Range-capable
//	GET /api/v1/file-offers/<id>/zip          the whole offer as one zip
//
// A file is opened beneath its offer without following any symlink.
func FileOffersHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		// Only the list takes a query: one conversation's offers.
		conversation := ""
		if r.URL.RawQuery != "" {
			q, err := url.ParseQuery(r.URL.RawQuery)
			conversation = q.Get("conversation_id")
			if err != nil || r.URL.Path != FileOffersPath || len(q) != 1 || len(q["conversation_id"]) != 1 || !viewConversationPattern.MatchString(conversation) {
				snapshotError(w, 400, "invalid_request")
				return
			}
		}
		if r.URL.Path == FileOffersPath {
			list, err := listFileOffers(cfg.Home, conversation)
			if err != nil {
				snapshotError(w, 503, "file_store_unavailable")
				return
			}
			offers := make([]fileOfferSummary, 0, len(list))
			for _, m := range list {
				if len(offers) == maxViewList {
					break
				}
				offers = append(offers, m.fileOfferSummary)
			}
			historyJSON(w, map[string]any{"schema_version": 1, "offers": offers})
			return
		}
		rest, ok := strings.CutPrefix(r.URL.Path, FileOffersPath+"/")
		// An escaped slash would make one name two path segments.
		if !ok || strings.Count(r.URL.EscapedPath(), "/") != strings.Count(r.URL.Path, "/") {
			snapshotError(w, 404, "file_not_found")
			return
		}
		id, sub, _ := strings.Cut(rest, "/")
		if !fileOfferIDPattern.MatchString(id) {
			snapshotError(w, 404, "file_offer_not_found")
			return
		}
		store, err := openFileOffers(cfg.Home)
		if errors.Is(err, os.ErrNotExist) {
			snapshotError(w, 404, "file_offer_not_found")
			return
		}
		if err != nil {
			snapshotError(w, 503, "file_store_unavailable")
			return
		}
		defer store.Close()
		m, err := readFileOfferManifest(int(store.Fd()), id)
		if err != nil {
			if errors.Is(err, unix.ENOENT) {
				snapshotError(w, 404, "file_offer_not_found")
			} else {
				snapshotError(w, 503, "file_store_unavailable")
			}
			return
		}
		switch {
		case sub == "" && !strings.HasSuffix(rest, "/"):
			historyJSON(w, map[string]any{"schema_version": 1, "offer": m.fileOfferSummary, "items": m.Items})
		case sub == "zip":
			serveOfferZip(w, r, int(store.Fd()), m)
		case strings.HasPrefix(sub, "files/") && validViewPath(strings.TrimPrefix(sub, "files/")):
			serveOfferFile(w, r, int(store.Fd()), id, strings.TrimPrefix(sub, "files/"))
		default:
			snapshotError(w, 404, "file_not_found")
		}
	})
}

func serveOfferFile(w http.ResponseWriter, r *http.Request, store int, id, rel string) {
	fd, err := open(unix.Openat2, store, id+"/files/"+rel, unix.O_RDONLY|unix.O_NONBLOCK, true)
	if err != nil {
		snapshotError(w, 404, "file_not_found")
		return
	}
	f := os.NewFile(uintptr(fd), "offered file")
	defer f.Close()
	st, err := stat(fd)
	if err != nil || st.Mode&unix.S_IFMT != unix.S_IFREG {
		snapshotError(w, 404, "file_not_found")
		return
	}
	// A large file to a slow phone outlasts the socket's default deadline.
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(time.Hour))
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "no-store")
	// No modification time or ETag: the copy is frozen, and Range needs none.
	http.ServeContent(w, r, "", time.Time{}, io.NewSectionReader(f, 0, st.Size))
}

// serveOfferZip streams the offer's files into one stored zip; nothing is
// written to disk. A file that cannot be read aborts the response, so
// the browser sees a failed download rather than a quietly shorter archive.
func serveOfferZip(w http.ResponseWriter, r *http.Request, store int, m fileOfferManifest) {
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(time.Hour))
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(200)
	if r.Method == http.MethodHead {
		return
	}
	created, _ := time.Parse(time.RFC3339Nano, m.CreatedAt)
	z := zip.NewWriter(w)
	for _, item := range m.Items {
		fd, err := open(unix.Openat2, store, m.ID+"/files/"+item.Path, unix.O_RDONLY|unix.O_NONBLOCK, true)
		if err != nil {
			panic(http.ErrAbortHandler)
		}
		f := os.NewFile(uintptr(fd), "offered file")
		out, err := z.CreateHeader(&zip.FileHeader{Name: item.Path, Method: zip.Store, Modified: created})
		if err == nil {
			var n int64
			n, err = io.Copy(out, io.LimitReader(f, item.Bytes+1))
			if err == nil && n != item.Bytes {
				err = errors.New("offered file changed")
			}
		}
		f.Close()
		if err != nil {
			// Abort the response, so the archive is a failed download.
			panic(http.ErrAbortHandler)
		}
	}
	_ = z.Close()
}

// agentFileOffers is the agent listener's offer, list and remove. An offer
// names its conversation like a notice does (explicit pi:UUID or the checked
// launch context) and arrives there as a notice; there is no offer without a
// conversation. The reply says the offer was published to the person's open
// browsers, never that anyone downloaded it.
func (c *ConversationController) agentFileOffers(w http.ResponseWriter, r *http.Request) {
	home := c.viewCfg().Home
	if r.URL.Path == AgentFileOfferRemovePath {
		var req struct {
			ID     string `json:"offer_id"`
			DryRun bool   `json:"dry_run"`
		}
		if r.Method != http.MethodPost || r.URL.RawQuery != "" || !strictViewBody(w, r, &req) || !fileOfferIDPattern.MatchString(req.ID) {
			snapshotError(w, 400, "invalid_arguments")
			return
		}
		if req.DryRun {
			store, err := openFileOffers(home)
			if err == nil {
				_, err = readFileOfferManifest(int(store.Fd()), req.ID)
				store.Close()
			}
			if err != nil {
				snapshotError(w, 404, "file_offer_not_found")
				return
			}
			historyJSON(w, map[string]any{"schema_version": 1, "offer_id": req.ID, "removed": false, "dry_run": true})
			return
		}
		if err := removeFileOffer(home, req.ID); err != nil {
			if errors.Is(err, os.ErrNotExist) {
				snapshotError(w, 404, "file_offer_not_found")
			} else {
				snapshotError(w, 503, "file_store_unavailable")
			}
			return
		}
		historyJSON(w, map[string]any{"schema_version": 1, "offer_id": req.ID, "removed": true, "dry_run": false})
		return
	}
	if r.Method == http.MethodGet {
		if r.URL.RawQuery != "" || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_arguments")
			return
		}
		list, err := listFileOffers(home, "")
		if err != nil {
			snapshotError(w, 503, "file_store_unavailable")
			return
		}
		if len(list) > maxViewList {
			list = list[:maxViewList]
		}
		offers := make([]map[string]any, 0, len(list))
		for _, m := range list {
			offers = append(offers, map[string]any{"offer_id": m.ID, "title": m.Title, "files": m.Files, "bytes": m.Bytes, "created_at": m.CreatedAt, "conversation_id": m.ConversationID, "workspace_id": m.WorkspaceID, "paths": m.Paths})
		}
		historyJSON(w, map[string]any{"schema_version": 1, "offers": offers})
		return
	}
	if r.Method != http.MethodPost {
		snapshotError(w, 404, "route_not_found")
		return
	}
	q, bad := parseAgentConversation(r)
	if bad {
		snapshotError(w, 400, "invalid_arguments")
		return
	}
	var req fileOfferRequest
	if !strictViewBody(w, r, &req) || !sessionIDPattern.MatchString(req.Key) || !idPattern.MatchString(req.WorkspaceID) || len(req.Paths) == 0 || len(req.Paths) > maxOfferSources || req.Title != "" && !validViewTitle(req.Title) || len(req.Paths) > 1 && req.Title == "" {
		snapshotError(w, 400, "invalid_arguments")
		return
	}
	for _, p := range req.Paths {
		if !validViewSource(p) || p == "." && len(req.Paths) > 1 {
			snapshotError(w, 400, "invalid_arguments")
			return
		}
	}
	// Copying a large offer outlasts the listener's default deadline.
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(4 * time.Minute))
	c.viewMu.Lock()
	defer c.viewMu.Unlock()
	existing, err := findFileOfferByKey(home, req.Key)
	if err != nil {
		snapshotError(w, 503, "file_store_unavailable")
		return
	}
	if existing != nil && (existing.WorkspaceID != req.WorkspaceID || strings.Join(existing.Paths, "\x00") != strings.Join(req.Paths, "\x00") || req.Title != "" && existing.Title != req.Title || existing.ConversationID != q.id) {
		snapshotError(w, 409, "idempotency_conflict")
		return
	}
	dryReply := func(s fileOfferSummary, skipped int, names []string) {
		historyJSON(w, map[string]any{"schema_version": 1, "dry_run": true, "plan": map[string]any{"title": s.Title, "files": s.Files, "bytes": s.Bytes, "names": names, "skipped_hidden": skipped, "conversation_id": q.id}})
	}
	var summary fileOfferSummary
	skipped := 0
	if existing != nil {
		summary, skipped = existing.fileOfferSummary, existing.SkippedHidden
		if req.DryRun {
			names := []string{}
			if store, err := openFileOffers(home); err == nil {
				if m, err := readFileOfferManifest(int(store.Fd()), existing.ID); err == nil {
					for _, i := range m.Items {
						names = append(names, i.Path)
					}
				}
				store.Close()
			}
			dryReply(summary, skipped, names)
			return
		}
	} else {
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
		plan, err := planFileOffer(root, req.Paths)
		if err != nil {
			viewErrorReply(w, err)
			return
		}
		title := req.Title
		if title == "" {
			title = plan.files[0].rel
			if plan.folder != "" {
				title = plan.folder
			}
			if len(plan.files) == 1 {
				title = path.Base(plan.files[0].rel)
			}
			for len(title) > maxViewTitle {
				_, size := utf8.DecodeLastRuneInString(title)
				title = title[:len(title)-size]
			}
		}
		summary = fileOfferSummary{Title: title, Folder: plan.folder, Files: len(plan.files), Bytes: plan.bytes, CreatedAt: time.Now().UTC().Format(time.RFC3339Nano), ConversationID: q.id}
		skipped = plan.skipped
		if req.DryRun {
			names := make([]string, 0, len(plan.files))
			for _, f := range plan.files {
				names = append(names, f.rel)
			}
			dryReply(summary, skipped, names)
			return
		}
		if summary.ID, err = newFileOfferID(); err != nil {
			snapshotError(w, 503, "file_store_unavailable")
			return
		}
		if !validFileOfferSummary(summary) {
			snapshotError(w, 400, "invalid_file_offer_title")
			return
		}
		if err := exportFileOffer(home, root, req, plan, summary); err != nil {
			viewErrorReply(w, err)
			return
		}
		if !still() {
			_ = removeFileOffer(home, summary.ID)
			snapshotError(w, 409, "file_source_changed")
			return
		}
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	n, status, code := c.createNotice(ctx, q, req.Key, summary.Title, noticeOffer{files: &summary}, false)
	if status != 0 {
		if existing == nil {
			_ = removeFileOffer(home, summary.ID)
		}
		snapshotError(w, status, code)
		return
	}
	historyJSON(w, map[string]any{"schema_version": 1, "dry_run": false, "reused": existing != nil, "offer": summary, "skipped_hidden": skipped, "notice": map[string]any{"agent_id": q.id, "persistence": n.Persistence}})
}

// FixtureFiles freezes synthetic files from the controller's home through
// the real plan and export and offers them to a conversation as a transient
// notice. `set` is "single" (one PNG), "types" (one file of each kind in
// separate offers), "folder" (a directory) or "removed" (one PNG whose copy
// is removed before the notice). It is not mounted by the
// product and is unavailable outside the browser-host controller.
func (c *ConversationController) FixtureFiles(target, set string) ([]string, bool) {
	if !c.fixture || c.journal == nil || !viewConversationPattern.MatchString(target) {
		return nil, false
	}
	home := c.viewCfg().Home
	base := filepath.Join(home, "src", "file-fixture")
	png := fixturePNG(480, 300)
	var zipBuf bytes.Buffer
	zw := zip.NewWriter(&zipBuf)
	for _, name := range []string{"reitti/etappi-1.gpx", "reitti/etappi-2.gpx", "LUE-MINUT.txt"} {
		f, _ := zw.Create(name)
		_, _ = f.Write([]byte("synthetic " + name + "\n"))
	}
	_ = zw.Close()
	contents := map[string][]byte{
		"kaavio.png":              png,
		"logo.svg":                []byte(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><script>document.title="svg-script-ran"</script><circle cx="20" cy="20" r="18" fill="teal"/></svg>`),
		"tiedote.md":              []byte("# Tiedote\n\nSynteettinen *teksti*.\n"),
		"ilmoittautuneet.csv":     []byte("nimi,kaupunki,etappi\nA,Turku,1\nB,Nauvo,2\n"),
		"muistutukset.py":         []byte("print('synthetic')\n"),
		"reittikuvat.zip":         zipBuf.Bytes(),
		"osallistujat.parquet":    []byte("PAR1 synthetic"),
		"paketti/etappi-1/a.png":  png,
		"paketti/etappi-1/b.png":  png,
		"paketti/etappi-2/c.png":  png,
		"paketti/logot/logo.svg":  []byte(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="teal"/></svg>`),
		"paketti/LUE MINUT ä.txt": []byte("synteettinen\n"),
		"paketti/.salainen":       []byte("hidden"),
	}
	for name, data := range contents {
		if os.MkdirAll(filepath.Dir(filepath.Join(base, name)), 0700) != nil || os.WriteFile(filepath.Join(base, name), data, 0600) != nil {
			return nil, false
		}
	}
	root, err := unix.Open(base, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, false
	}
	defer unix.Close(root)
	var groups [][]string
	switch set {
	case "single", "removed":
		groups = [][]string{{"kaavio.png"}}
	case "folder":
		groups = [][]string{{"paketti"}}
	case "types":
		for _, name := range []string{"kaavio.png", "logo.svg", "tiedote.md", "ilmoittautuneet.csv", "muistutukset.py", "reittikuvat.zip", "osallistujat.parquet"} {
			groups = append(groups, []string{name})
		}
	default:
		return nil, false
	}
	ids := []string{}
	for _, paths := range groups {
		key, _ := uuid()
		req := fileOfferRequest{Key: key, WorkspaceID: "ws_filefixture", Paths: paths}
		plan, err := planFileOffer(root, paths)
		if err != nil {
			return nil, false
		}
		title := path.Base(plan.files[0].rel)
		if plan.folder != "" {
			title = "Kumppanipaketti"
		}
		summary := fileOfferSummary{Title: title, Folder: plan.folder, Files: len(plan.files), Bytes: plan.bytes, CreatedAt: time.Now().UTC().Format(time.RFC3339Nano), ConversationID: target}
		if summary.ID, err = newFileOfferID(); err != nil || exportFileOffer(home, root, req, plan, summary) != nil {
			return nil, false
		}
		// "removed" publishes an offer whose copy is already gone.
		if set == "removed" && removeFileOffer(home, summary.ID) != nil {
			return nil, false
		}
		n := agentNotice{ID: key, Origin: "agent", Timestamp: time.Now().UTC().Format(time.RFC3339Nano), Text: summary.Title, Persistence: "not_persisted", Files: &summary}
		c.journal.appendEvent("notice.created", target, map[string]any{"notice": n})
		ids = append(ids, summary.ID)
	}
	return ids, true
}

// FixtureRemoveFiles removes one fixture offer through the real removal.
func (c *ConversationController) FixtureRemoveFiles(id string) bool {
	return c.fixture && fileOfferIDPattern.MatchString(id) && removeFileOffer(c.viewCfg().Home, id) == nil
}

// fixturePNG is a small synthetic chart-coloured image.
func fixturePNG(w, h int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{uint8(40 + x*180/w), uint8(120 + y*100/h), 140, 255})
		}
	}
	var b bytes.Buffer
	_ = png.Encode(&b, img)
	return b.Bytes()
}
