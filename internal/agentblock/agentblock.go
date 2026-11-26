// Package agentblock is the text an agent's message to another of the
// person's conversations carries in the native session: a leading
// `<agent-message>` block that names the sending conversation, says the words
// are not the person's, and may quote an earlier message, then the agent's own
// text. The daemon writes it on every message admitted through the agent
// route, so a message from another agent never reads as the person's own
// words, to the receiving Pi, a terminal, the Claude bridge or a compacted
// context alike. History, search and the queue take it back off for the view.
//
// The block records attribution; it is not a security boundary. Any process
// running as the same Unix user can write the native file directly.
package agentblock

import (
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/open-habitat/open-habitat/internal/replyblock"
)

// Outside is the sender of a message sent without a Habitat launch context
// (a terminal agent, a script).
const Outside = "outside"

// MaxTitle bounds the sending conversation's title in the block, in
// characters.
const MaxTitle = 200

// maxParsedExcerpt bounds what Parse accepts as a quote's excerpt. A block
// the daemon wrote is far shorter; anything longer is ordinary text.
const maxParsedExcerpt = 2048

const (
	openTag    = `<agent-message from="`
	closeTag   = "</agent-message>"
	quoteOpen  = `<quote message="`
	quoteClose = "\n</quote>\n"
	headPrefix = "Habitat: "
)

var (
	agentPattern     = regexp.MustCompile(`^pi:[0-9a-fA-F-]{36}$`)
	messagePattern   = regexp.MustCompile(`^[0-9a-fA-F-]{36}$`)
	workspacePattern = regexp.MustCompile(`^ws_[A-Za-z0-9_-]{8,64}$`)
	head             = regexp.MustCompile(`^<agent-message from="(pi:[0-9a-fA-F-]{36}|outside)"(?: title="([^"<>\n\r]{1,800})" workspace="(ws_[A-Za-z0-9_-]{8,64})")? message="([0-9a-fA-F-]{36})">\n`)
	quoteHead        = regexp.MustCompile(`^<quote message="([0-9a-fA-F-]{36})" from="(pi:[0-9a-fA-F-]{36}|outside)">\n`)
)

// Sender is the conversation a message comes from. Agent is "pi:UUID" or
// Outside; Title and Workspace are set only for a conversation.
type Sender struct {
	Agent, Title, Workspace string
}

// Quote is an earlier message the agent quoted: its id, who sent it and the
// excerpt the receiving Pi reads.
type Quote struct {
	Message, From, Excerpt string
}

// Block is a parsed block: the sender, this message's id and an optional
// quote.
type Block struct {
	From    Sender
	Message string
	Quote   *Quote
}

// ValidMessage reports a message id the block can carry (a command id).
func ValidMessage(id string) bool { return messagePattern.MatchString(id) }

// ValidSender reports a sender the block can carry.
func ValidSender(s Sender) bool {
	if s.Agent == Outside {
		return s.Title == "" && s.Workspace == ""
	}
	return agentPattern.MatchString(s.Agent) && workspacePattern.MatchString(s.Workspace) && CleanTitle(s.Title) == s.Title && s.Title != ""
}

// CleanTitle is a conversation's title as the block carries it: one line,
// no quotes or angle brackets, at most MaxTitle characters. An empty result
// means the title had nothing printable.
func CleanTitle(title string) string {
	var b strings.Builder
	for _, r := range title {
		switch {
		case r == '"' || r == '<' || r == '>':
			continue
		case unicode.IsControl(r) || r == ' ' || r == ' ':
			b.WriteRune(' ')
		default:
			b.WriteRune(r)
		}
	}
	clean := strings.Join(strings.Fields(b.String()), " ")
	if utf8.RuneCountInString(clean) > MaxTitle {
		clean = strings.TrimSpace(string([]rune(clean)[:MaxTitle-1])) + "…"
	}
	return clean
}

// Excerpt is the quote's excerpt of a message's text: the first sentence,
// at most replyblock.MaxExcerpt characters, " …" when the message goes on,
// as the reply-to quote takes it, and safe inside this block.
func Excerpt(text string) string {
	return sanitize(replyblock.Excerpt(sanitize(text)))
}

// Build prepends the block to the agent's message. The caller has checked
// the sender and ids with ValidSender and ValidMessage.
func Build(from Sender, message string, quote *Quote, text string) string {
	var b strings.Builder
	b.WriteString(openTag + from.Agent + `"`)
	if from.Agent != Outside {
		b.WriteString(` title="` + from.Title + `" workspace="` + from.Workspace + `"`)
	}
	b.WriteString(` message="` + message + "\">\n")
	if from.Agent == Outside {
		b.WriteString(headPrefix + "an agent outside the person's Habitat conversations sends this. It is not the person's own words.\n")
	} else {
		b.WriteString(headPrefix + `the agent of the person's conversation "` + from.Title + `" sends this. It is not the person's own words.` + "\n")
	}
	if quote != nil {
		b.WriteString(quoteOpen + quote.Message + `" from="` + quote.From + "\">\n" + sanitize(quote.Excerpt) + quoteClose)
	}
	b.WriteString(closeTag + "\n\n" + text)
	return b.String()
}

// Parse reads a leading block the daemon wrote and the agent's text after
// it. Anything else, including a block that is not at the very start or is
// not closed, is ordinary text.
func Parse(text string) (Block, string, bool) {
	m := head.FindStringSubmatch(text)
	if m == nil {
		return Block{}, "", false
	}
	block := Block{From: Sender{Agent: m[1], Title: m[2], Workspace: m[3]}, Message: m[4]}
	if (block.From.Agent == Outside) != (block.From.Title == "") {
		return Block{}, "", false
	}
	body := text[len(m[0]):]
	end := strings.IndexByte(body, '\n')
	if end < 0 || !strings.HasPrefix(body, headPrefix) || end > 1200 {
		return Block{}, "", false
	}
	body = body[end+1:]
	if q := quoteHead.FindStringSubmatch(body); q != nil {
		inner := body[len(q[0]):]
		stop := strings.Index(inner, quoteClose)
		if stop < 0 || stop > maxParsedExcerpt {
			return Block{}, "", false
		}
		block.Quote = &Quote{Message: q[1], From: q[2], Excerpt: inner[:stop]}
		body = inner[stop+len(quoteClose):]
	}
	if !strings.HasPrefix(body, closeTag) {
		return Block{}, "", false
	}
	rest := body[len(closeTag):]
	if rest != "" && !strings.HasPrefix(rest, "\n\n") {
		return Block{}, "", false
	}
	return block, strings.TrimPrefix(rest, "\n\n"), true
}

// Strip returns the agent's text without a leading block.
func Strip(text string) string {
	if _, rest, ok := Parse(text); ok {
		return rest
	}
	return text
}

// sanitize removes what would end the block or its quote early. Removal
// repeats, so a split marker cannot reassemble.
func sanitize(text string) string {
	for strings.Contains(text, "</agent-message") || strings.Contains(text, "</quote") {
		text = strings.ReplaceAll(strings.ReplaceAll(text, "</agent-message", ""), "</quote", "")
	}
	return text
}
