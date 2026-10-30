//go:build linux

package daemon

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"go.yaml.in/yaml/v3"
	"golang.org/x/sys/unix"
)

// A workspace's icon comes from the repository itself, so every clone shows
// the same one and nothing is stored beside it: the `icon` field of the
// committed `.open-habitat.yaml` at the root (an emoji or a repo-relative
// image), else the first logo file found on a fixed list, else nothing and
// the browser derives a glyph from the name. Every read goes through the
// workspace's pinned directory with openat2 (beneath it, no symlinks, no
// mounts) and is size-bounded; the browser never names a path.
const (
	WorkspaceIconPath   = "/api/v1/workspaces/icon"
	workspaceConfigName = ".open-habitat.yaml"
	maxWorkspaceConfig  = 16 << 10
	maxWorkspaceIcon    = 256 << 10
	maxIconPath         = 255
)

type workspaceIcon struct {
	Kind    string // "", emoji, image
	Value   string // the emoji
	Path    string // the image, relative to the workspace root
	Source  string // config, logo
	Version string // changes when the image file does; a cache key only
}

// Where a repository usually keeps its logo, in the order they are tried.
var logoDirs = []string{"", "public", "static", "assets", "design-system", "docs", "web/public", "web/static"}
var logoNames = []string{"logo.svg", "favicon.svg", "logo.png", "favicon.png"}

var iconTypes = map[string]string{".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}

func readWorkspaceIcon(op openFunction, root int) workspaceIcon {
	if b, state := readSmall(op, root, workspaceConfigName, maxWorkspaceConfig); state == "valid" {
		emoji, path := configIcon(b)
		if emoji != "" {
			return workspaceIcon{Kind: "emoji", Value: emoji, Source: "config"}
		}
		if path != "" {
			if v, ok := iconFile(op, root, path); ok {
				return workspaceIcon{Kind: "image", Path: path, Source: "config", Version: v}
			}
		}
	}
	for _, d := range logoDirs {
		for _, n := range logoNames {
			path := n
			if d != "" {
				path = d + "/" + n
			}
			if v, ok := iconFile(op, root, path); ok {
				return workspaceIcon{Kind: "image", Path: path, Source: "logo", Version: v}
			}
		}
	}
	return workspaceIcon{}
}

// configIcon reads the config's `icon`. Other fields belong to other
// features and are ignored; a file that is not a YAML mapping, or an icon
// that is neither a short emoji nor an image path, has no icon.
func configIcon(b []byte) (emoji, path string) {
	var doc struct {
		Icon yaml.Node `yaml:"icon"`
	}
	if !utf8.Valid(b) || yaml.Unmarshal(b, &doc) != nil || doc.Icon.Kind != yaml.ScalarNode || doc.Icon.Tag != "!!str" {
		return "", ""
	}
	v := strings.TrimSpace(doc.Icon.Value)
	if p, ok := strings.CutPrefix(v, "./"); ok {
		v = p
	}
	if iconTypes[strings.ToLower(extension(v))] != "" {
		if validComposerPath(v) && len(v) <= maxIconPath && !strings.ContainsAny(v, "\\") {
			return "", v
		}
		return "", ""
	}
	if validIconEmoji(v) {
		return v, ""
	}
	return "", ""
}

// validIconEmoji admits a short glyph: at most 32 bytes and 8 code points,
// at least one outside ASCII, no space or control characters other than the
// joiners and selectors emoji sequences are built from.
func validIconEmoji(v string) bool {
	if v == "" || len(v) > 32 || utf8.RuneCountInString(v) > 8 {
		return false
	}
	wide := false
	for _, r := range v {
		switch {
		case r == 0x200d, r >= 0xfe00 && r <= 0xfe0f, r >= 0xe0020 && r <= 0xe007f:
		case unicode.IsSpace(r), unicode.IsControl(r), unicode.Is(unicode.Cf, r):
			return false
		case r >= 0x80:
			wide = true
		}
	}
	return wide
}

func extension(path string) string {
	i := strings.LastIndexByte(path, '.')
	if i < 0 || strings.Contains(path[i:], "/") {
		return ""
	}
	return path[i:]
}

// iconFile admits a non-empty regular file within the size bound, and
// returns a version that changes when the file does.
func iconFile(op openFunction, root int, path string) (string, bool) {
	fd, err := open(op, root, path, unix.O_PATH, true)
	if err != nil {
		return "", false
	}
	defer unix.Close(fd)
	s, err := stat(fd)
	if err != nil || s.Mode&unix.S_IFMT != unix.S_IFREG || s.Size <= 0 || s.Size > maxWorkspaceIcon {
		return "", false
	}
	sum := sha256.Sum256([]byte(path + ":" + strconv.FormatUint(uint64(s.Dev), 10) + ":" + strconv.FormatUint(s.Ino, 10) + ":" + strconv.FormatInt(s.Size, 10) + ":" + strconv.FormatInt(s.Mtim.Nano(), 10) + ":" + strconv.FormatInt(s.Ctim.Nano(), 10)))
	return hex.EncodeToString(sum[:8]), true
}

// iconContent reports the content type of an icon's bytes, which must agree
// with its extension: the browser gets nothing the name does not promise.
func iconContent(path string, b []byte) string {
	typ := iconTypes[strings.ToLower(extension(path))]
	switch typ {
	case "image/png":
		if bytes.HasPrefix(b, []byte("\x89PNG\r\n\x1a\n")) {
			return typ
		}
	case "image/jpeg":
		if bytes.HasPrefix(b, []byte{0xff, 0xd8, 0xff}) {
			return typ
		}
	case "image/webp":
		if len(b) >= 12 && string(b[:4]) == "RIFF" && string(b[8:12]) == "WEBP" {
			return typ
		}
	case "image/svg+xml":
		if utf8.Valid(b) && bytes.Contains(b, []byte("<svg")) {
			return typ
		}
	}
	return ""
}

func iconView(icon workspaceIcon) map[string]any {
	if icon.Kind == "emoji" {
		return map[string]any{"kind": "emoji", "source": icon.Source, "value": icon.Value}
	}
	return map[string]any{"kind": "image", "source": icon.Source, "path": icon.Path, "version": icon.Version}
}

// WorkspaceIconHandler answers `?workspace_id=…[&v=…]` with the workspace's
// current icon image, chosen again from the repository; `v` is the snapshot's
// version, a cache key the daemon does not read. The bytes are served as an
// image only (nosniff); the gateway adds the sandbox policy that keeps an SVG
// opened on its own from running anything.
func WorkspaceIconHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		q, err := url.ParseQuery(r.URL.RawQuery)
		id := q.Get("workspace_id")
		version := len(q) == 2 && len(q["v"]) == 1 && len(q.Get("v")) <= 64
		if err != nil || r.Method != http.MethodGet || r.URL.Path != WorkspaceIconPath || r.URL.EscapedPath() != WorkspaceIconPath || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || len(q["workspace_id"]) != 1 || !idPattern.MatchString(id) || len(q) != 1 && !version {
			snapshotError(w, 400, "invalid_request")
			return
		}
		target, _, status, code := composerTarget(cfg, id)
		if target == nil {
			snapshotError(w, status, code)
			return
		}
		data, typ, err := readIconImage(r.Context(), *target)
		if err != nil {
			if errors.Is(err, errPreviewMissing) {
				snapshotError(w, 404, "resource_not_found")
			} else {
				snapshotError(w, 503, "native_source_unavailable")
			}
			return
		}
		w.Header().Set("Content-Type", typ)
		w.Header().Set("Content-Disposition", "inline")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write(data)
	})
}

func readIconImage(ctx context.Context, target gitTarget) ([]byte, string, error) {
	root, still, done, err := target.open()
	if err != nil {
		return nil, "", err
	}
	defer done()
	icon := readWorkspaceIcon(unix.Openat2, root)
	if icon.Kind != "image" {
		return nil, "", errPreviewMissing
	}
	// Pin the image's directory beneath the workspace, then read it by name.
	parent, name := root, icon.Path
	if i := strings.LastIndexByte(icon.Path, '/'); i >= 0 {
		d, err := dir(unix.Openat2, root, icon.Path[:i], true)
		if err != nil {
			return nil, "", errPreviewMissing
		}
		defer unix.Close(d)
		parent, name = d, icon.Path[i+1:]
	}
	b, state := readSmall(unix.Openat2, parent, name, maxWorkspaceIcon)
	if state != "valid" {
		return nil, "", errPreviewMissing
	}
	typ := iconContent(icon.Path, b)
	if typ == "" {
		return nil, "", errPreviewMissing
	}
	if ctx.Err() != nil || !still() {
		return nil, "", errors.New("workspace changed")
	}
	return b, typ, nil
}
