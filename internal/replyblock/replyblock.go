// Package replyblock is the text a person's reply to one agent message
// carries in the native session (reply-to-message, experimental): a leading
// `<reply-to entry="…">` block with a short excerpt of the message, then the
// person's own text. The block lives only in that text, so a terminal, the
// Claude bridge and a compacted context read the same reference; the daemon
// builds it and history and search take it back off for the view.
package replyblock

import (
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

// MaxExcerpt is the excerpt's length in characters, the " …" included
// (Jari 23.11.2026: short).
const MaxExcerpt = 160

// maxParsedExcerpt bounds what Parse accepts as an excerpt. A block the
// daemon wrote is far shorter; anything longer is ordinary text.
const maxParsedExcerpt = 2048

const (
	openTag  = `<reply-to entry="`
	closeTag = "\n</reply-to>"
)

var (
	keyPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,128}$`)
	fence      = regexp.MustCompile("^\\s*(```+|~~~+)")
	listItem   = regexp.MustCompile(`^\s*(?:[-*+]|\d{1,9}[.)])\s+\S`)
	// The daemon expands these in a prompt into attached files; an excerpt
	// quoting one must not attach anything.
	attachmentRef = regexp.MustCompile(`/api/v1/attachments/[0-9a-f-]{36}`)
)

// ValidKey reports a native entry id the block can carry.
func ValidKey(key string) bool { return keyPattern.MatchString(key) }

// Build prepends the block to the person's message.
func Build(key, excerpt, message string) string {
	return openTag + key + "\">\n" + excerpt + closeTag + "\n\n" + message
}

// Parse reads a leading block the daemon wrote: the entry, the excerpt and
// the person's text after it. Anything else, including a block that is not
// at the very start or is not closed, is ordinary text.
func Parse(text string) (key, excerpt, rest string, ok bool) {
	if !strings.HasPrefix(text, openTag) {
		return "", "", "", false
	}
	head := text[len(openTag):]
	end := strings.Index(head, "\">\n")
	if end < 0 || !keyPattern.MatchString(head[:end]) {
		return "", "", "", false
	}
	key, body := head[:end], head[end+3:]
	stop := strings.Index(body, closeTag)
	if stop < 0 || stop > maxParsedExcerpt {
		return "", "", "", false
	}
	excerpt, rest = body[:stop], body[stop+len(closeTag):]
	if rest != "" && !strings.HasPrefix(rest, "\n\n") {
		return "", "", "", false
	}
	return key, excerpt, strings.TrimPrefix(rest, "\n\n"), true
}

// Strip returns the person's text without a leading block.
func Strip(text string) string {
	if _, _, rest, ok := Parse(text); ok {
		return rest
	}
	return text
}

// Excerpt is the short excerpt of an agent message's text (its text blocks
// only): the first sentence of the first line, at most MaxExcerpt
// characters, cut at a word with " …". A message that starts with a list
// keeps that first item with its marker; one that starts with a code block
// keeps the fence and its first code line, closed again. " …" says the
// message goes on. Empty text has no excerpt.
func Excerpt(text string) string {
	text = sanitize(strings.ReplaceAll(strings.ReplaceAll(text, "\r\n", "\n"), "\r", "\n"))
	text = strings.TrimSpace(text)
	if text == "" {
		return ""
	}
	lines := strings.Split(text, "\n")
	first := strings.TrimRight(lines[0], " \t")
	if m := fence.FindStringSubmatch(first); m != nil {
		head := strings.TrimSpace(first)
		code, consumed := "", 1
		for i, line := range lines[1:] {
			if fence.MatchString(line) {
				consumed = i + 2
				break
			}
			if strings.TrimSpace(line) != "" {
				code, consumed = strings.TrimRight(line, " \t"), i+2
				break
			}
		}
		after := lines[consumed:]
		if len(after) > 0 && fence.MatchString(after[0]) {
			after = after[1:] // this block's own closing fence
		}
		more := strings.TrimSpace(strings.Join(after, "\n")) != ""
		budget := MaxExcerpt - runes(head) - runes(m[1]) - 2
		if budget < 8 {
			// A fence line that long carries no code worth quoting.
			return cut(head, MaxExcerpt, true)
		}
		return head + "\n" + cut(code, budget, more) + "\n" + m[1]
	}
	sentence := first
	if !listItem.MatchString(first) {
		sentence = firstSentence(strings.TrimLeft(first, " \t"))
	}
	more := len(lines) > 1 || strings.TrimSpace(sentence) != strings.TrimSpace(first)
	return cut(strings.TrimSpace(sentence), MaxExcerpt, more)
}

// sanitize removes what would end the block early or attach a file. Removal
// repeats, so a split marker cannot reassemble.
func sanitize(text string) string {
	for strings.Contains(text, "</reply-to") {
		text = strings.ReplaceAll(text, "</reply-to", "")
	}
	return attachmentRef.ReplaceAllString(text, "[attachment]")
}

// firstSentence ends at ., ! or ? followed by the end of the line, or by
// space and something that starts a sentence. A lowercase word after the
// stop (esim. tämä, e.g. this) keeps the sentence going.
func firstSentence(line string) string {
	r := []rune(line)
	for i, c := range r {
		if c != '.' && c != '!' && c != '?' {
			continue
		}
		j := i + 1
		for j < len(r) && (r[j] == '.' || r[j] == '!' || r[j] == '?' || r[j] == ')' || r[j] == '"' || r[j] == '\'' || r[j] == '”' || r[j] == '*' || r[j] == '_') {
			j++
		}
		if j == len(r) {
			return line
		}
		if !unicode.IsSpace(r[j]) {
			continue
		}
		k := j
		for k < len(r) && unicode.IsSpace(r[k]) {
			k++
		}
		if k == len(r) || unicode.IsUpper(r[k]) || strings.ContainsRune("\"“'(«*_[`#", r[k]) {
			return string(r[:j])
		}
	}
	return line
}

// cut bounds s to max characters at a word; " …" marks a cut or, with more,
// that the message continues.
func cut(s string, max int, more bool) string {
	r := []rune(s)
	if len(r) <= max {
		if more {
			if len(r)+2 <= max {
				return s + " …"
			}
		} else {
			return s
		}
	}
	r = r[:max-2]
	if i := lastSpace(r); i >= (max-2)/2 {
		r = r[:i]
	}
	return strings.TrimRight(string(r), " \t") + " …"
}

func lastSpace(r []rune) int {
	for i := len(r) - 1; i >= 0; i-- {
		if unicode.IsSpace(r[i]) {
			return i
		}
	}
	return -1
}

func runes(s string) int { return utf8.RuneCountInString(s) }
