//go:build linux

package daemon

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

const maxIconCandidate = 512

// References are selectors, never authority. Every preview and selection resolves
// them again inside the authenticated person's discovered workspace or upload store.
func isIconCandidate(value string) bool {
	return strings.HasPrefix(value, "workspace:") || strings.HasPrefix(value, "attachment:")
}

type iconImage struct {
	path string
	data []byte
}

func readIconCandidate(ctx context.Context, cfg transport.Config, value string) (iconImage, string, error) {
	if len(value) > maxIconCandidate {
		return iconImage{}, "", errIconInvalid
	}
	var data []byte
	var path string
	if id, ok := strings.CutPrefix(value, "attachment:"); ok {
		root, err := attachmentRoot(cfg.Home)
		if err != nil {
			return iconImage{}, "", errIconInvalid
		}
		defer root.Close()
		d, err := root.Open(".")
		if err != nil {
			return iconImage{}, "", errIconInvalid
		}
		ds, statErr := stat(int(d.Fd()))
		d.Close()
		if statErr != nil || ds.Uid != uint32(cfg.UID) {
			return iconImage{}, "", errIconInvalid
		}
		f, err := attachmentFile(root, id)
		if err != nil {
			return iconImage{}, "", errIconInvalid
		}
		defer f.Close()
		fs, err := stat(int(f.Fd()))
		if err != nil || fs.Uid != uint32(cfg.UID) {
			return iconImage{}, "", errIconInvalid
		}
		data, err = io.ReadAll(io.LimitReader(f, maxWorkspaceIcon+1))
		if err != nil {
			return iconImage{}, "", errIconInvalid
		}
		switch attachmentType(data) {
		case "image/png":
			path = "image.png"
		case "image/jpeg":
			path = "image.jpg"
		case "image/webp":
			path = "image.webp"
		default:
			// SVG uploads are text to the model, but still usable as inert icons.
			if !isSVGDocument(data) {
				return iconImage{}, "", errIconInvalid
			}
			path = "image.svg"
		}
	} else if rest, ok := strings.CutPrefix(value, "workspace:"); ok {
		id, p, ok := strings.Cut(rest, ":")
		if !ok || !idPattern.MatchString(id) || parseIconValue(p).Kind != "image" || parseIconValue(p).Value != p {
			return iconImage{}, "", errIconInvalid
		}
		target, _, _, _ := composerTarget(cfg, id)
		if target == nil {
			return iconImage{}, "", errIconInvalid
		}
		root, still, done, err := target.open()
		if err != nil {
			return iconImage{}, "", errIconInvalid
		}
		defer done()
		f, err := editorOpenStrict(root, p, uint32(cfg.UID), unix.O_RDONLY)
		if err != nil {
			return iconImage{}, "", errIconInvalid
		}
		defer f.Close()
		s, err := f.Stat()
		if err != nil || !s.Mode().IsRegular() || s.Size() <= 0 || s.Size() > maxWorkspaceIcon {
			return iconImage{}, "", errIconInvalid
		}
		data, err = io.ReadAll(io.LimitReader(f, maxWorkspaceIcon+1))
		if err != nil || !still() {
			return iconImage{}, "", errIconInvalid
		}
		path = p
	} else {
		return iconImage{}, "", errIconInvalid
	}
	typ := iconContent(path, data)
	if ctx.Err() != nil || len(data) == 0 || len(data) > maxWorkspaceIcon || typ == "" {
		return iconImage{}, "", errIconInvalid
	}
	// A content-addressed repository file survives source removal and travels with
	// the config's commit. No suggestion writes a file; only selection does.
	path = fmt.Sprintf(".open-habitat-icon-%x%s", sha256.Sum256(data), strings.ToLower(extension(path)))
	return iconImage{path, data}, typ, nil
}

func storeIconImage(root int, image iconImage) error {
	// Stage under the pinned directory and publish only complete bytes. A failed
	// write cannot poison the content-addressed name for every subsequent retry.
	f, err := os.CreateTemp(fmt.Sprintf("/proc/self/fd/%d", root), ".oh-icon-*")
	if err != nil {
		return errIconUnavailable
	}
	tmp := filepath.Base(f.Name())
	defer unix.Unlinkat(root, tmp, 0)
	_, err = f.Write(image.data)
	if err == nil {
		err = f.Sync()
	}
	if closeErr := f.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return errIconUnavailable
	}
	if err := unix.Renameat2(root, tmp, root, image.path, unix.RENAME_NOREPLACE); err != nil {
		if err == unix.EEXIST {
			old, state := readSmall(unix.Openat2, root, image.path, maxWorkspaceIcon)
			if state == "valid" && bytes.Equal(old, image.data) {
				return nil
			}
		}
		return errIconUnavailable
	}
	if unix.Fsync(root) != nil {
		return errIconUnavailable
	}
	return nil
}

// An upload has no trusted extension. Text mentioning SVG is not an SVG image.
func isSVGDocument(data []byte) bool {
	d := xml.NewDecoder(bytes.NewReader(bytes.TrimPrefix(data, []byte{0xef, 0xbb, 0xbf})))
	rootSeen, depth := false, 0
	for {
		token, err := d.Token()
		if err == io.EOF {
			return rootSeen && depth == 0
		}
		if err != nil {
			return false
		}
		switch t := token.(type) {
		case xml.StartElement:
			if depth == 0 {
				if rootSeen || t.Name.Local != "svg" || (t.Name.Space != "" && t.Name.Space != "http://www.w3.org/2000/svg") {
					return false
				}
				rootSeen = true
			}
			depth++
		case xml.EndElement:
			depth--
		case xml.CharData:
			if depth == 0 && len(bytes.TrimSpace(t)) != 0 {
				return false
			}
		}
	}
}

// Names and IDs let the model resolve a named workspace without tools or a home
// scan. Only the selected, validated image is read; the catalogue holds no bytes.
func (c *ConversationController) iconWorkspaces() []map[string]string {
	cfg := c.cfg
	cfg.Home = c.home
	var out []map[string]string
	for _, e := range DiscoverListing(cfg).Entries {
		if e.Error != "" {
			continue
		}
		id := workspaceIDOf(cfg, e)
		item := map[string]string{"id": id, "name": e.Name}
		if e.DisplayName != "" {
			item["display_name"] = e.DisplayName
		}
		if e.Icon.LogoPath != "" {
			item["logo"] = "workspace:" + id + ":" + e.Icon.LogoPath
		}
		out = append(out, item)
		if len(out) == 128 {
			break
		}
	}
	return out
}
