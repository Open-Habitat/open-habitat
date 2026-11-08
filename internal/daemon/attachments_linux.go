//go:build linux

package daemon

import (
	"encoding/base64"
	"errors"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

const AttachmentsPath = "/api/v1/attachments"
const attachmentLimit int64 = 20 << 20
const promptAttachmentLimit = 100 << 20
const attachmentQuota int64 = 1 << 30

// Browser and agent adapters share the same native quota recount/write fence.
var attachmentWrites sync.Mutex

var attachmentID = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
var attachmentRef = regexp.MustCompile(`/api/v1/attachments/([0-9a-f-]{36})`)

// Files themselves are the record: no metadata database or conversation binding.
func attachmentRoot(home string) (*os.Root, error) {
	root, err := os.OpenRoot(home)
	if err != nil {
		return nil, err
	}
	defer root.Close()
	if err = root.Mkdir("attachments", 0700); err != nil && !os.IsExist(err) {
		return nil, err
	}
	st, err := root.Lstat("attachments")
	if err != nil || !st.IsDir() || st.Mode()&os.ModeSymlink != 0 || st.Mode().Perm()&0022 != 0 {
		return nil, errors.New("unsafe attachments directory")
	}
	return root.OpenRoot("attachments")
}

func attachmentFile(root *os.Root, id string) (*os.File, error) {
	if !attachmentID.MatchString(id) {
		return nil, errors.New("invalid attachment")
	}
	f, err := root.OpenFile(id, os.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK, 0)
	if err != nil {
		return nil, err
	}
	st, err := f.Stat()
	if err != nil || !st.Mode().IsRegular() || st.Size() > attachmentLimit {
		f.Close()
		return nil, errors.New("invalid attachment")
	}
	return f, nil
}

func attachmentType(data []byte) string { return http.DetectContentType(data) }
func attachmentImage(typ string) bool {
	return typ == "image/png" || typ == "image/jpeg" || typ == "image/gif" || typ == "image/webp"
}

func AttachmentsHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return attachmentsHandlerAt(cfg, trusted, AttachmentsPath)
}

func attachmentsHandlerAt(cfg transport.Config, trusted func(*http.Request) bool, base string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		path := r.URL.Path
		upload := path == base && r.Method == http.MethodPost
		id := strings.TrimPrefix(path, base+"/")
		id, thumb := strings.CutSuffix(id, "/thumbnail")
		if (!upload && (r.ContentLength > 0 || len(r.TransferEncoding) != 0)) || r.URL.RawQuery != "" || r.URL.EscapedPath() != path || (!upload && (r.Method != http.MethodGet || !attachmentID.MatchString(id))) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(60 * time.Second))
		_ = http.NewResponseController(w).SetReadDeadline(time.Now().Add(60 * time.Second))
		root, err := attachmentRoot(cfg.Home)
		if err != nil {
			snapshotError(w, 503, "attachments_unavailable")
			return
		}
		defer root.Close()
		if !upload {
			f, err := attachmentFile(root, id)
			if err != nil {
				snapshotError(w, 404, "resource_not_found")
				return
			}
			defer f.Close()
			if thumb {
				serveThumbnail(w, r, f)
				return
			}
			data, err := io.ReadAll(io.LimitReader(f, attachmentLimit+1))
			if err != nil || int64(len(data)) > attachmentLimit {
				snapshotError(w, 503, "attachments_unavailable")
				return
			}
			typ := attachmentType(data)
			w.Header().Set("Content-Type", "application/octet-stream")
			w.Header().Set("Content-Disposition", "attachment")
			if attachmentImage(typ) {
				w.Header().Set("Content-Type", typ)
				w.Header().Set("Content-Disposition", "inline")
			}
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("Cache-Control", "no-store")
			_, _ = w.Write(data)
			return
		}
		if r.ContentLength <= 0 || r.ContentLength > attachmentLimit {
			snapshotError(w, 413, "attachment_too_large")
			return
		}
		// Serialize uploads, recount disk truth and leave filesystem quotas in force.
		attachmentWrites.Lock()
		defer attachmentWrites.Unlock()
		var used int64
		err = fs.WalkDir(root.FS(), ".", func(path string, entry fs.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			// Do not follow symlinks; moved files still count toward the budget.
			if entry.IsDir() || entry.Type()&os.ModeSymlink != 0 {
				return nil
			}
			st, err := entry.Info()
			if err != nil {
				return err
			}
			if st.Mode().IsRegular() {
				used += st.Size()
			}
			return nil
		})
		if err != nil {
			snapshotError(w, 503, "attachments_unavailable")
			return
		}
		if used+r.ContentLength > attachmentQuota {
			snapshotError(w, 413, "attachment_quota_exceeded")
			return
		}
		id, ok := uuid()
		if !ok {
			snapshotError(w, 503, "attachments_unavailable")
			return
		}
		f, err := root.OpenFile(id, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
		if err != nil {
			logStorageFailure("attachment_create", err)
			snapshotError(w, 503, "attachments_unavailable")
			return
		}
		complete := false
		defer func() {
			f.Close()
			if !complete {
				_ = root.Remove(id)
			}
		}()
		data, err := io.ReadAll(http.MaxBytesReader(w, r.Body, attachmentLimit))
		if err != nil || int64(len(data)) != r.ContentLength {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if _, err = f.Write(data); err != nil {
			logStorageFailure("attachment_write", err)
			snapshotError(w, 507, "attachment_storage_full")
			return
		}
		if err = f.Close(); err != nil {
			logStorageFailure("attachment_close", err)
			snapshotError(w, 507, "attachment_storage_full")
			return
		}
		complete = true
		historyJSON(w, map[string]any{"schema_version": 1, "id": id, "path": filepath.Join(cfg.Home, "attachments", id), "content_type": attachmentType(data), "size": len(data)})
	})
}

type piAttachmentImage struct {
	Type     string `json:"type"`
	Data     string `json:"data"`
	MimeType string `json:"mimeType"`
}

// Attachment references survive held messages and native history without a
// parallel message store. Resolve only generated IDs within this person's root.
// writtenText undoes promptAttachments' path lines on a text Pi gives back, so
// the person gets the message as written, its attachment references intact; a
// new send expands them again.
func writtenText(home, text string) string {
	suffix := ""
	seen := make(map[string]bool)
	for _, match := range attachmentRef.FindAllStringSubmatch(text, -1) {
		if !seen[match[1]] {
			seen[match[1]] = true
			suffix += "\nAttachment path: " + filepath.Join(home, "attachments", match[1])
		}
	}
	if suffix == "" {
		return text
	}
	return strings.TrimSuffix(text, suffix)
}

// writtenTexts is writtenText over Pi's queue. Pi queues the expanded text; the
// page matches its own queued messages to the queue by the text the person
// wrote, and an attachment's path line would make one message look like two.
func writtenTexts(home string, texts []string) []string {
	out := make([]string, len(texts))
	for i, text := range texts {
		out[i] = writtenText(home, text)
	}
	return out
}

// The two per-message limits each have their own refusal, so the person
// reads which one the message crossed; any other failure is an attachment
// that is no longer there or changed after it was saved.
var (
	errTooManyAttachments  = errors.New("too many attachments")
	errAttachmentsTooLarge = errors.New("attachments too large")
)

// promptAttachmentRefusal is the code of a refused message's attachments.
func promptAttachmentRefusal(err error) string {
	switch {
	case errors.Is(err, errTooManyAttachments):
		return "attachments_too_many"
	case errors.Is(err, errAttachmentsTooLarge):
		return "attachments_too_large"
	}
	return "invalid_attachments"
}

func promptAttachments(home, message string, includeImages bool) (string, []piAttachmentImage, error) {
	matches := attachmentRef.FindAllStringSubmatch(message, -1)
	refs := make([]string, 0, len(matches))
	seen := make(map[string]bool)
	for _, match := range matches {
		if !seen[match[1]] {
			seen[match[1]] = true
			refs = append(refs, match[1])
		}
	}
	if len(refs) == 0 {
		return message, nil, nil
	}
	if len(refs) > 30 {
		return "", nil, errTooManyAttachments
	}
	root, err := attachmentRoot(home)
	if err != nil {
		return "", nil, err
	}
	defer root.Close()
	var images []piAttachmentImage
	var total int64
	for _, ref := range refs {
		f, err := attachmentFile(root, ref)
		if err != nil {
			return "", nil, err
		}
		st, err := f.Stat()
		if err != nil {
			f.Close()
			return "", nil, err
		}
		total += st.Size()
		if total > promptAttachmentLimit {
			f.Close()
			return "", nil, errAttachmentsTooLarge
		}
		if includeImages {
			data, err := io.ReadAll(io.LimitReader(f, attachmentLimit+1))
			if err != nil || int64(len(data)) != st.Size() {
				f.Close()
				return "", nil, errors.New("attachment changed")
			}
			typ := attachmentType(data)
			if attachmentImage(typ) {
				images = append(images, piAttachmentImage{"image", base64.StdEncoding.EncodeToString(data), typ})
			}
		}
		f.Close()
		message += "\nAttachment path: " + filepath.Join(home, "attachments", ref)
	}
	return message, images, nil
}
