package replyblock

import (
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"
)

// A reply to a view or file the agent offered (reply-view-file, Jari
// 27.11.2026) carries the same block, with a body that names the offer
// instead of quoting a message. The offer's native entry is outside the
// model's context: the agent knows the offer only from the id and the
// sources its own `oh agent view|file offer` call printed, so the body names
// those. It is the host's line to the agent and stays in English whatever
// the person's language; the title and paths are agent data.
//
// The first line is also what the history projection reads back for the
// person's view (ParseOffer), so a reply read from a terminal, the Claude
// bridge or a compacted context still names the same offer.

// Offer kinds: one HTML view, one offered file, several files offered
// together. A file inside a several-file offer is OfferFiles with Path.
const (
	OfferView  = "view"
	OfferFile  = "file"
	OfferFiles = "files"
)

// Offer is what a reply to an offer card points at.
type Offer struct {
	Kind  string
	ID    string // view_id or offer_id
	Title string
	// Path is a file inside a several-file offer.
	Path string
}

// Bounds that keep the whole body under Parse's limit: an offer title is at
// most 200 bytes and a path inside an offer 1024. ParseOffer bounds what it
// gives back the same way, so a block typed by hand cannot project fields
// the history contract refuses.
const (
	maxOfferLine  = 1400
	maxSourceLine = 512
	maxOfferField = 1024
)

var (
	offerIDPattern = regexp.MustCompile(`^[a-z][a-z2-7]{26}$`)
	offerSuffix    = regexp.MustCompile(`^ \((view_id|offer_id) ([a-z][a-z2-7]{26})\)$`)
)

var offerHeads = []struct{ prefix, kind string }{
	{"View you offered: ", OfferView},
	{"File you offered: ", OfferFile},
	{"Files you offered: ", OfferFiles},
}

const fileHead, fileMiddle = "File ", " in the files you offered as "

// OfferBody is the block's body for a reply to an offer: the line that
// names it and a line of facts (where it came from, kind, size). The title
// and the path are quoted as Go strings, so a quote or a phrase of the line
// inside either cannot change what the line names, and the path is kept
// exactly as the offer holds it (one line: offer paths have no control
// characters).
func OfferBody(o Offer, facts string) (string, bool) {
	title, path := clean(o.Title), o.Path
	if !offerIDPattern.MatchString(o.ID) || title == "" || strings.ContainsAny(path, "\r\n") {
		return "", false
	}
	id := " (offer_id " + o.ID + ")"
	var head string
	switch {
	case o.Kind == OfferView && path == "":
		head = offerHeads[0].prefix + strconv.Quote(title) + " (view_id " + o.ID + ")"
	case o.Kind == OfferFile && path == "":
		head = offerHeads[1].prefix + strconv.Quote(title) + id
	case o.Kind == OfferFiles && path == "":
		head = offerHeads[2].prefix + strconv.Quote(title) + id
	case o.Kind == OfferFiles:
		head = fileHead + strconv.Quote(path) + fileMiddle + strconv.Quote(title) + id
	default:
		return "", false
	}
	if len(head) > maxOfferLine {
		return "", false
	}
	body := head
	if facts = clean(facts); facts != "" {
		body += "\n" + cutBytes(facts, maxSourceLine)
	}
	return body, true
}

// ParseOffer reads the offer back from a block's body the daemon wrote.
// Anything else (a message excerpt) is not an offer.
func ParseOffer(body string) (Offer, bool) {
	head, _, _ := strings.Cut(body, "\n")
	var o Offer
	rest := ""
	if after, ok := strings.CutPrefix(head, fileHead+`"`); ok {
		path, after, ok := quoted(`"` + after)
		if !ok {
			return Offer{}, false
		}
		if after, ok = strings.CutPrefix(after, fileMiddle); !ok {
			return Offer{}, false
		}
		title, after, ok := quoted(after)
		if !ok || path == "" {
			return Offer{}, false
		}
		o, rest = Offer{Kind: OfferFiles, Title: title, Path: path}, after
	} else {
		for _, h := range offerHeads {
			if after, ok := strings.CutPrefix(head, h.prefix); ok {
				title, after, ok := quoted(after)
				if !ok {
					return Offer{}, false
				}
				o, rest = Offer{Kind: h.kind, Title: title}, after
				break
			}
		}
	}
	m := offerSuffix.FindStringSubmatch(rest)
	if o.Kind == "" || m == nil || (o.Kind == OfferView) != (m[1] == "view_id") ||
		strings.TrimSpace(o.Title) == "" || len(o.Title) > maxOfferField || len(o.Path) > maxOfferField {
		return Offer{}, false
	}
	o.ID = m[2]
	return o, true
}

// quoted reads one Go-quoted string at the start of s.
func quoted(s string) (value, rest string, ok bool) {
	q, err := strconv.QuotedPrefix(s)
	if err != nil || !strings.HasPrefix(q, `"`) {
		return "", "", false
	}
	value, err = strconv.Unquote(q)
	return value, s[len(q):], err == nil && utf8.ValidString(value)
}

// clean keeps display text (a title, the facts) on its one line and out of
// the block's end.
func clean(s string) string {
	s = strings.Map(func(r rune) rune {
		if r == '\n' || r == '\r' || r < 0x20 || r == 0x7f {
			return ' '
		}
		return r
	}, s)
	return strings.TrimSpace(sanitize(s))
}

// cutBytes bounds s to max bytes at a character, ending with " …" when cut.
func cutBytes(s string, max int) string {
	if len(s) <= max {
		return s
	}
	s = s[:max-len(" …")]
	for !utf8.ValidString(s) {
		s = s[:len(s)-1]
	}
	return strings.TrimRight(s, " ") + " …"
}
