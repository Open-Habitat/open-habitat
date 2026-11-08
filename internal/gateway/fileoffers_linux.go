//go:build linux

package gateway

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/udssecure"
)

// Agent file offers are agent-written bytes served on the app's own origin,
// so this gateway, not the daemon, decides how they are presented. Only
// images, audio and video are ever announced with their own type, and only
// for the inline route the app's <img>, <video> and <audio> elements read;
// everything else, and every download, is opaque octets as an attachment.
// Every response also carries a sandbox CSP and nosniff, so opening an
// offered file directly, an SVG included, runs nothing on the app's origin.
// The daemon decides only which bytes exist; the owner's own session is the
// only reader.

const fileOffersPath = "/api/v1/file-offers"

var fileOfferIDPattern = regexp.MustCompile(`^f[a-z2-7]{26}$`)
var contentRangePattern = regexp.MustCompile(`^bytes (\*|[0-9]{1,15}-[0-9]{1,15})/[0-9]{1,15}$`)
var digitsPattern = regexp.MustCompile(`^[0-9]{1,15}$`)
var singleRangePattern = regexp.MustCompile(`^bytes=([0-9]{1,15}-[0-9]{0,15}|-[0-9]{1,15})$`)

// fileInlineTypes are the only types an offered file is announced as.
var fileInlineTypes = map[string]string{
	".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif",
	".svg": "image/svg+xml",
	".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
	".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".ogg": "audio/ogg", ".oga": "audio/ogg", ".opus": "audio/ogg", ".wav": "audio/wav", ".flac": "audio/flac", ".aac": "audio/aac",
}

const fileOfferCSP = "sandbox; default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'"

// fileOffers routes the app origin's offer reads: the list and one offer's
// facts go through the ordinary bounded proxy, file bytes and the zip through
// fileRelay.
func (a *Auth) fileOffers(w http.ResponseWriter, r *http.Request) {
	// Only the list takes one query: the conversation whose offers it lists.
	list := r.URL.Path == fileOffersPath && a.exact(r, fileOffersPath, "conversation_id")
	if r.Method != http.MethodGet && r.Method != http.MethodHead || !list && !a.exact(r, r.URL.Path) || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if r.URL.Path == fileOffersPath {
		if r.Method != http.MethodGet {
			safe(w, 400, "invalid_request")
			return
		}
		a.proxy(w, r, s, false)
		return
	}
	rest := strings.TrimPrefix(r.URL.Path, fileOffersPath+"/")
	// An escaped slash would turn one name into two path segments.
	if strings.Count(r.URL.EscapedPath(), "/") != strings.Count(r.URL.Path, "/") {
		safe(w, 404, "file_not_found")
		return
	}
	id, sub, _ := strings.Cut(rest, "/")
	if !fileOfferIDPattern.MatchString(id) {
		safe(w, 404, "file_offer_not_found")
		return
	}
	if sub == "" && !strings.HasSuffix(rest, "/") {
		if r.Method != http.MethodGet {
			safe(w, 400, "invalid_request")
			return
		}
		a.proxy(w, r, s, false)
		return
	}
	if sub == "zip" {
		a.fileRelay(w, r, s, id, "", "zip")
		return
	}
	mode, rel, _ := strings.Cut(sub, "/")
	if mode != "inline" && mode != "download" && mode != "thumbnail" || !validOfferPath(rel) {
		safe(w, 404, "file_not_found")
		return
	}
	a.fileRelay(w, r, s, id, rel, mode)
}

// validOfferPath is a path inside an offer as the daemon writes them:
// relative, clean, without dot components or control characters.
func validOfferPath(p string) bool {
	if p == "" || len(p) > 1024 || !utf8.ValidString(p) || path.Clean(p) != p || strings.HasPrefix(p, "/") || strings.Contains(p, "\\") {
		return false
	}
	for _, part := range strings.Split(p, "/") {
		if part == "" || strings.HasPrefix(part, ".") || len(part) > 255 {
			return false
		}
	}
	for _, c := range p {
		if unicode.IsControl(c) {
			return false
		}
	}
	return true
}

// attachmentDisposition names the download: an ASCII fallback and the exact
// UTF-8 name (RFC 6266, RFC 8187).
func attachmentDisposition(name string) string {
	fallback := strings.Map(func(c rune) rune {
		if c < 0x20 || c > 0x7e || c == '"' || c == '\\' || c == ';' || c == '%' {
			return '_'
		}
		return c
	}, name)
	var exact strings.Builder
	for _, b := range []byte(name) {
		// RFC 8187 attr-char; every other byte is percent-encoded.
		if b >= 'A' && b <= 'Z' || b >= 'a' && b <= 'z' || b >= '0' && b <= '9' || strings.IndexByte("!#$&+-.^_`|~", b) >= 0 {
			exact.WriteByte(b)
		} else {
			exact.WriteString(fmt.Sprintf("%%%02X", b))
		}
	}
	return `attachment; filename="` + fallback + `"; filename*=UTF-8''` + exact.String()
}

func (a *Auth) fileRelay(w http.ResponseWriter, r *http.Request, s session, id, rel, mode string) {
	target := s.identity
	if a.snapshotDial == nil && udssecure.Mapped(target.Socket, target.UID) != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	transport := &http.Transport{
		DisableKeepAlives:      true,
		MaxResponseHeaderBytes: 16 << 10,
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return a.dialDaemon(ctx, target)
		},
	}
	defer transport.CloseIdleConnections()
	out := &url.URL{Scheme: "http", Host: "unix", Path: fileOffersPath + "/" + id + "/zip"}
	switch mode {
	case "zip":
	case "view-zip":
		out.Path = viewsPath + "/" + id + "/zip"
	case "thumbnail":
		out.Path = fileOffersPath + "/" + id + "/thumbnail/" + rel
	default:
		out.Path = fileOffersPath + "/" + id + "/files/" + rel
	}
	// A large file to a slow phone takes long; each write is bounded below.
	ctx, cancel := context.WithTimeout(r.Context(), time.Hour)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, r.Method, out.String(), http.NoBody)
	if err != nil {
		safe(w, 404, "file_not_found")
		return
	}
	// Only one byte range crosses, for media seeking and resumed downloads:
	// several would come back as a multipart body this relay does not frame.
	if v := r.Header.Get("Range"); mode != "zip" && mode != "view-zip" && singleRangePattern.MatchString(v) {
		req.Header.Set("Range", v)
		if v := r.Header.Get("If-Range"); v != "" && len(v) <= 200 {
			req.Header.Set("If-Range", v)
		}
	}
	res, err := transport.RoundTrip(req)
	if err != nil {
		if a.log != nil && r.Context().Err() == nil {
			a.log.Warn("file_relay", "outcome", "failed", "reason", "daemon_exchange_failed", "user", target.Username)
		}
		safe(w, 503, "daemon_unavailable")
		return
	}
	defer res.Body.Close()
	switch res.StatusCode {
	case 200, 206, 416:
	case 404:
		safe(w, 404, "file_not_found")
		return
	default:
		safe(w, 503, "daemon_unavailable")
		return
	}
	h := w.Header()
	h.Set("Content-Security-Policy", fileOfferCSP)
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Cache-Control", "no-store")
	h.Set("Referrer-Policy", "no-referrer")
	h.Set("Cross-Origin-Resource-Policy", "same-origin")
	kind, inline := fileInlineTypes[strings.ToLower(path.Ext(rel))]
	switch {
	case mode == "zip" || mode == "view-zip":
		h.Set("Content-Type", "application/zip")
		// No file name: the page's download attribute names the archive.
		h.Set("Content-Disposition", "attachment")
	case mode == "thumbnail":
		h.Set("Content-Type", "image/jpeg")
		h.Set("Content-Disposition", "inline")
	case mode == "inline" && inline:
		h.Set("Content-Type", kind)
		h.Set("Content-Disposition", "inline")
	default:
		h.Set("Content-Type", "application/octet-stream")
		h.Set("Content-Disposition", attachmentDisposition(path.Base(rel)))
	}
	if v := res.Header.Get("Content-Length"); digitsPattern.MatchString(v) {
		h.Set("Content-Length", v)
	}
	if v := res.Header.Get("Content-Range"); contentRangePattern.MatchString(v) {
		h.Set("Content-Range", v)
	}
	if res.Header.Get("Accept-Ranges") == "bytes" {
		h.Set("Accept-Ranges", "bytes")
	}
	w.WriteHeader(res.StatusCode)
	if r.Method == http.MethodHead || res.StatusCode == 416 {
		return
	}
	controller := http.NewResponseController(w)
	buf := make([]byte, 64<<10)
	for {
		n, readErr := res.Body.Read(buf)
		if n > 0 {
			if err := controller.SetWriteDeadline(time.Now().Add(30 * time.Second)); err != nil && !errors.Is(err, http.ErrNotSupported) {
				return
			}
			if _, err := w.Write(buf[:n]); err != nil {
				return
			}
		}
		if readErr != nil {
			if !errors.Is(readErr, io.EOF) {
				// A cut stream must not look complete: abort the response.
				panic(http.ErrAbortHandler)
			}
			return
		}
	}
}
