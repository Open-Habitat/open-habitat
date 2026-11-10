//go:build linux

package gateway

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"html/template"
	"io"
	"net"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/open-habitat/open-habitat/internal/udssecure"
)

// A public file offer (public-file-offers) is read on its address's content
// host like a public view, under the same checks, relay slots and daily
// budgets (viewLinkServe). An offer has no HTML of its own, so the content
// root is a page this gateway writes: the offer's title, its files with
// images, video and audio shown, a table's or text's beginning for a
// one-file offer, and every file and the whole offer downloadable. The page
// runs no script. Its offered names are agent data, escaped as text. The
// daemon is asked only through its fixed routes of the one offer the
// reservation names (/api/v1/file-offers/<id>, /files/<path>, /zip), never
// with an ID or anything else the reader chose; the reader's path picks a
// file inside that offer, which the daemon opens beneath it without
// following a link. What the page shows is the frozen copy alone, never the
// offer's conversation or workspace.
//
//	/<token>/           the page
//	/<token>/f/<path>   one file: images, video and audio by type, else a download
//	/<token>/d/<path>   one file as a download
//	/<token>/zip        the whole offer as one zip

const (
	// An offer's facts carry its file list and zip listings, up to the
	// daemon's manifest bound.
	offerFactsBytes = 4 << 20
	// A one-file table's or text's beginning shown on the page.
	offerPreviewBytes   = 64 << 10
	offerPreviewRows    = 20
	offerPreviewColumns = 12
	offerPreviewCell    = 200
)

type offerFactsItem struct {
	Path  string `json:"path"`
	Bytes int64  `json:"bytes"`
	Kind  string `json:"kind"`
}

type offerFacts struct {
	Offer struct {
		Title  string `json:"title"`
		Folder string `json:"folder"`
		Files  int    `json:"files"`
		Bytes  int64  `json:"bytes"`
	} `json:"offer"`
	Items []offerFactsItem `json:"items"`
}

// daemonGet makes one GET to target's daemon. The caller closes the body.
func (a *Auth) daemonGet(ctx context.Context, target Identity, p string, header http.Header) (*http.Response, error) {
	if a.snapshotDial == nil && udssecure.Mapped(target.Socket, target.UID) != nil {
		return nil, errors.New("daemon socket not mapped")
	}
	transport := &http.Transport{
		DisableKeepAlives:      true,
		MaxResponseHeaderBytes: 16 << 10,
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return a.dialDaemon(ctx, target)
		},
	}
	out := &url.URL{Scheme: "http", Host: "unix", Path: p}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, out.String(), http.NoBody)
	if err != nil {
		return nil, err
	}
	for k, v := range header {
		req.Header[k] = v
	}
	res, err := transport.RoundTrip(req)
	if err != nil {
		transport.CloseIdleConnections()
		return nil, err
	}
	return res, nil
}

// readOfferFacts answers the offer's facts, or 404 when it is gone and 503
// otherwise.
func (a *Auth) readOfferFacts(ctx context.Context, target Identity, offerID string) (offerFacts, int) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	res, err := a.daemonGet(ctx, target, fileOffersPath+"/"+offerID, nil)
	if err != nil {
		return offerFacts{}, 503
	}
	defer res.Body.Close()
	if res.StatusCode == 404 {
		return offerFacts{}, 404
	}
	var facts offerFacts
	if res.StatusCode != 200 || json.NewDecoder(io.LimitReader(res.Body, offerFactsBytes)).Decode(&facts) != nil || !validViewTitle(facts.Offer.Title) || len(facts.Items) == 0 || len(facts.Items) > 1000 {
		return offerFacts{}, 503
	}
	for _, item := range facts.Items {
		if !validOfferPath(item.Path) || item.Bytes < 0 {
			return offerFacts{}, 503
		}
	}
	return facts, 200
}

// offerLinkServe is a public offer's content host below its token (base).
// The caller has checked the publication and holds a relay slot.
func (a *Auth) offerLinkServe(w http.ResponseWriter, r *http.Request, l viewAddress, base string) {
	rest := strings.TrimPrefix(r.URL.Path, base)
	raw := strings.ToUpper(r.URL.RawPath)
	// An encoded separator would make one name two path segments.
	if strings.Contains(raw, "%2F") || strings.Contains(raw, "%5C") {
		viewFailure(w, r, 404, viewFileMissing)
		return
	}
	pub := &publicRead{
		charge: func(n int64) bool { return a.chargeViewLink(l.ID, n) },
		fail: func(status int) {
			switch status {
			case 404:
				viewFailure(w, r, 404, viewFileMissing)
			case 429:
				viewFailure(w, r, 429, viewLinkDailyLimit)
			default:
				viewFailure(w, r, 503, viewUnavailable)
			}
		},
	}
	switch {
	case rest == "/":
		a.offerPage(w, r, l, pub)
	case rest == "/zip":
		facts, status := a.readOfferFacts(r.Context(), l.Owner, l.OfferID)
		if status != 200 {
			offerGone(w, r, status)
			return
		}
		pub.zipName = offerZipName(facts)
		// The zip is stored, not compressed: its bytes are the files' and
		// each file's headers. The daemon streams exactly the items' sizes,
		// and the relay stops at this count.
		pub.zipBytes = 22
		for _, item := range facts.Items {
			pub.zipBytes += item.Bytes + int64(2*len(item.Path)) + 128
		}
		a.fileRelay(w, r, l.Owner, l.OfferID, "", "zip", pub)
	case strings.HasPrefix(rest, "/f/") && validOfferPath(rest[3:]):
		a.fileRelay(w, r, l.Owner, l.OfferID, rest[3:], "inline", pub)
	case strings.HasPrefix(rest, "/d/") && validOfferPath(rest[3:]):
		a.fileRelay(w, r, l.Owner, l.OfferID, rest[3:], "download", pub)
	default:
		viewFailure(w, r, 404, viewFileMissing)
	}
}

func offerGone(w http.ResponseWriter, r *http.Request, status int) {
	if status == 404 {
		viewFailure(w, r, 404, viewShareGone)
	} else {
		viewFailure(w, r, 503, viewUnavailable)
	}
}

// offerZipName is the downloaded archive's name: the folder's or the
// title's, without separators.
func offerZipName(facts offerFacts) string {
	name := facts.Offer.Folder
	if name == "" {
		name = facts.Offer.Title
	}
	name = strings.TrimSpace(strings.Map(func(c rune) rune {
		if c < 0x20 || c == 0x7f || strings.ContainsRune(`/\:*?"<>|`, c) {
			return '_'
		}
		return c
	}, name))
	if name == "" {
		name = "files"
	}
	return name + ".zip"
}

// offerPageCSP: the page is plain HTML. It runs nothing, may only show the
// offer's own images and media from this host, and may start downloads,
// which a sandbox otherwise blocks.
func offerPageCSP(host string) string {
	self := "https://" + host
	return "sandbox allow-downloads; default-src 'none'; img-src " + self + "; media-src " + self + "; style-src 'unsafe-inline'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'"
}

type offerPageText struct {
	lang, files, file, download, downloadAll, beginning, empty string
	sizes                                                      [4]string
}

var offerPageTexts = map[string]offerPageText{
	"fi": {lang: "fi", files: "tiedostoa", file: "tiedosto", download: "Lataa", downloadAll: "Lataa kaikki (.zip)", beginning: "Tiedostosta näytetään vain alku.", empty: "Tiedosto on tyhjä.", sizes: [4]string{"t", "kt", "Mt", "Gt"}},
	"en": {lang: "en", files: "files", file: "file", download: "Download", downloadAll: "Download all (.zip)", beginning: "Only the beginning of the file is shown.", empty: "The file is empty.", sizes: [4]string{"B", "KB", "MB", "GB"}},
}

func (t offerPageText) size(n int64) string {
	if n < 1024 {
		return strconv.FormatInt(n, 10) + " " + t.sizes[0]
	}
	if n < 1024*1024 {
		return strconv.FormatInt((n+512)/1024, 10) + " " + t.sizes[1]
	}
	unit, d := 2, float64(1024*1024)
	if n >= 1024*1024*1024 {
		unit, d = 3, float64(1024*1024*1024)
	}
	s := strconv.FormatFloat(float64(n)/d, 'f', 1, 64)
	s = strings.TrimSuffix(s, ".0")
	if t.lang == "fi" {
		s = strings.Replace(s, ".", ",", 1)
	}
	return s + " " + t.sizes[unit]
}

type offerPageItem struct {
	Name, Facts, Kind string
	Inline, Download  string
}

type offerPage struct {
	Lang, Title, Facts, Folder string
	DownloadLabel, AllLabel    string
	Items                      []offerPageItem
	Zip                        bool
	Table                      [][]string
	Text                       string
	Note                       string
}

var offerPageTemplate = template.Must(template.New("offer").Parse(`<!doctype html>
<html lang="{{.Lang}}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>{{.Title}}</title>
<style>
:root{color-scheme:light dark;--fg:#1d1d1f;--muted:#6b6b70;--line:#d9d9de;--bg:#fbfbfc;--card:#fff;--accent:#2f5bd3}
@media (prefers-color-scheme:dark){:root{--fg:#ececf0;--muted:#a0a0a8;--line:#3a3a40;--bg:#17171a;--card:#202024;--accent:#8aa8ff}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:960px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:22px;margin:0 0 4px;overflow-wrap:anywhere}
.facts{color:var(--muted);margin:0 0 16px}
a{color:var(--accent)}
.all{display:inline-block;margin:0 0 16px}
ul{list-style:none;margin:0;padding:0;display:grid;gap:12px}
li{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}
.name{font-weight:600;overflow-wrap:anywhere}
.row{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}
.row .facts{margin:0}
img,video{display:block;max-width:100%;max-height:70vh;margin:8px 0 0;border-radius:6px}
audio{display:block;width:100%;margin:8px 0 0}
.table{overflow:auto;margin:8px 0 0;max-height:70vh}
table{border-collapse:collapse;font-size:13px}
td{border:1px solid var(--line);padding:3px 8px;white-space:pre;max-width:24em;overflow:hidden;text-overflow:ellipsis}
tr:first-child td{font-weight:600}
pre{margin:8px 0 0;overflow:auto;max-height:70vh;font:13px/1.45 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
.note{color:var(--muted);font-size:13px;margin:6px 0 0}
</style></head>
<body><main>
<h1>{{.Title}}</h1>
<p class="facts">{{.Facts}}</p>
{{if .Zip}}<a class="all" href="zip">{{.AllLabel}}</a>{{end}}
<ul>
{{- range .Items}}
<li><div class="row"><span class="name">{{.Name}}</span><span class="facts">{{.Facts}}</span><a href="{{.Download}}">{{$.DownloadLabel}}</a></div>
{{- if eq .Kind "image"}}<a href="{{.Inline}}"><img src="{{.Inline}}" alt="{{.Name}}" loading="lazy"></a>
{{- else if eq .Kind "video"}}<video controls preload="metadata" src="{{.Inline}}"></video>
{{- else if eq .Kind "audio"}}<audio controls preload="none" src="{{.Inline}}"></audio>
{{- end}}
{{- if $.Table}}<div class="table"><table>{{range $.Table}}<tr>{{range .}}<td>{{.}}</td>{{end}}</tr>{{end}}</table></div>{{end}}
{{- if $.Text}}<pre>{{$.Text}}</pre>{{end}}
{{- if $.Note}}<p class="note">{{$.Note}}</p>{{end}}
</li>
{{- end}}
</ul>
</main></body></html>
`))

func offerHref(prefix, rel string) string {
	return (&url.URL{Path: prefix + rel}).EscapedPath()
}

// offerPage writes the offer's page. Its own bytes and a preview's read
// come out of the address's daily budget like any file.
func (a *Auth) offerPage(w http.ResponseWriter, r *http.Request, l viewAddress, pub *publicRead) {
	facts, status := a.readOfferFacts(r.Context(), l.Owner, l.OfferID)
	if status != 200 {
		offerGone(w, r, status)
		return
	}
	t := offerPageTexts[viewLanguage(r)]
	count := t.files
	if len(facts.Items) == 1 {
		count = t.file
	}
	page := offerPage{Lang: t.lang, Title: facts.Offer.Title, DownloadLabel: t.download, AllLabel: t.downloadAll, Zip: len(facts.Items) > 1}
	page.Facts = strconv.Itoa(len(facts.Items)) + " " + count + " · " + t.size(facts.Offer.Bytes)
	if facts.Offer.Folder != "" {
		page.Facts = facts.Offer.Folder + "/ · " + page.Facts
	}
	for _, item := range facts.Items {
		kind := ""
		if mime, ok := fileInlineTypes[strings.ToLower(path.Ext(item.Path))]; ok {
			kind, _, _ = strings.Cut(mime, "/")
		}
		page.Items = append(page.Items, offerPageItem{Name: item.Path, Facts: t.size(item.Bytes), Kind: kind, Inline: offerHref("f/", item.Path), Download: offerHref("d/", item.Path)})
	}
	// A one-file table or text shows its beginning; anything larger is
	// one download away.
	if one := facts.Items[0]; len(facts.Items) == 1 && r.Method == http.MethodGet {
		switch one.Kind {
		case "csv", "text", "code", "markdown":
			text, more, ok := a.offerPreview(r.Context(), l, one, pub)
			switch {
			case !ok:
			case text == "":
				page.Note = t.empty
			case one.Kind == "csv":
				page.Table = previewTable(text)
			default:
				page.Text = text
			}
			if ok && more {
				page.Note = t.beginning
			}
		}
	}
	var body bytes.Buffer
	if err := offerPageTemplate.Execute(&body, page); err != nil {
		viewFailure(w, r, 503, viewUnavailable)
		return
	}
	if r.Method == http.MethodGet && !pub.charge(int64(body.Len())) {
		viewFailure(w, r, 429, viewLinkDailyLimit)
		return
	}
	h := w.Header()
	h.Set("Content-Security-Policy", offerPageCSP(r.Host))
	h.Set("Content-Type", "text/html; charset=utf-8")
	h.Set("Content-Language", t.lang)
	h.Set("Content-Length", strconv.Itoa(body.Len()))
	// A reader that stops reading must not hold the address's relay slot;
	// the server sets no write timeout.
	if err := http.NewResponseController(w).SetWriteDeadline(time.Now().Add(30 * time.Second)); err != nil && !errors.Is(err, http.ErrNotSupported) {
		viewFailure(w, r, 503, viewUnavailable)
		return
	}
	w.WriteHeader(200)
	if r.Method == http.MethodGet {
		_, _ = w.Write(body.Bytes())
	}
}

// offerPreview reads the beginning of one file as text, charged to the
// address before it is read. more is whether the file goes on.
func (a *Auth) offerPreview(ctx context.Context, l viewAddress, item offerFactsItem, pub *publicRead) (string, bool, bool) {
	n := min(item.Bytes, offerPreviewBytes)
	if n == 0 {
		return "", false, true
	}
	if !pub.charge(n) {
		return "", false, false
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	res, err := a.daemonGet(ctx, l.Owner, fileOffersPath+"/"+l.OfferID+"/files/"+item.Path, http.Header{"Range": {"bytes=0-" + strconv.FormatInt(n-1, 10)}})
	if err != nil {
		return "", false, false
	}
	defer res.Body.Close()
	if res.StatusCode != 200 && res.StatusCode != 206 {
		return "", false, false
	}
	data, err := io.ReadAll(io.LimitReader(res.Body, n))
	if err != nil {
		return "", false, false
	}
	more := int64(len(data)) == n && item.Bytes > n
	if more {
		// Cut back to whole lines and characters.
		if i := bytes.LastIndexByte(data, '\n'); i > 0 {
			data = data[:i+1]
		}
		for len(data) > 0 && !utf8.Valid(data) {
			data = data[:len(data)-1]
		}
	}
	data = bytes.TrimPrefix(data, []byte("\xef\xbb\xbf"))
	if !utf8.Valid(data) || bytes.IndexByte(data, 0) >= 0 {
		return "", false, false
	}
	return string(data), more, true
}

// csvSeparator is the comma, semicolon or tab the first row has most of
// outside quotes, a comma on a tie, as the app's table preview decides.
func csvSeparator(text string) rune {
	counts := map[rune]int{}
	quoted := false
	for _, c := range text {
		if c == '"' {
			quoted = !quoted
		} else if !quoted && (c == '\n' || c == '\r') {
			break
		} else if !quoted {
			counts[c]++
		}
	}
	switch {
	case counts[';'] > counts[','] && counts[';'] >= counts['\t']:
		return ';'
	case counts['\t'] > counts[',']:
		return '\t'
	}
	return ','
}

// previewTable is a table's first rows and columns, each cell cut short.
func previewTable(text string) [][]string {
	reader := csv.NewReader(strings.NewReader(text))
	reader.Comma = csvSeparator(text)
	reader.FieldsPerRecord = -1
	reader.LazyQuotes = true
	var rows [][]string
	for len(rows) < offerPreviewRows+1 {
		record, err := reader.Read()
		if err != nil {
			// The end, or a row a cut file left open: the rows so far.
			break
		}
		row := make([]string, 0, min(len(record), offerPreviewColumns))
		for _, cell := range record[:min(len(record), offerPreviewColumns)] {
			if utf8.RuneCountInString(cell) > offerPreviewCell {
				cell = string([]rune(cell)[:offerPreviewCell]) + "…"
			}
			row = append(row, cell)
		}
		rows = append(rows, row)
	}
	return rows
}

// viewLanguage is the content hosts' language: Finnish for a first browser
// language fi*, English otherwise. They have no session with a choice.
func viewLanguage(r *http.Request) string {
	first, _, _ := strings.Cut(r.Header.Get("Accept-Language"), ",")
	first, _, _ = strings.Cut(first, ";")
	if tag := strings.ToLower(strings.TrimSpace(first)); tag == "fi" || strings.HasPrefix(tag, "fi-") {
		return "fi"
	}
	return "en"
}
