//go:build linux

package searchindex

import (
	"regexp"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

// MaxQuery bounds the query in runes; MaxTerms the words it may hold.
const (
	MaxQuery = 200
	MaxTerms = 8
)

// Limits on what one search returns: the list shows conversations, and an
// expanded conversation shows its hits.
const (
	maxConversations = 50
	maxHitsEach      = 20
	snippetRoom      = 160
)

// Hit is one matching message.
type Hit struct {
	Entry   string
	Role    string
	At      time.Time
	Snippet string
}

// Conversation is one conversation's share of a result: the number of its
// messages that match, and its hits with the one that best stands for it
// first and the rest newest first.
type Conversation struct {
	Session  string
	HitCount int
	Newest   time.Time
	Hits     []Hit
}

// Result is a search's answer. Terms are the stems the query matched as
// substrings, case-insensitively; the browser marks words containing them.
type Result struct {
	Terms         []string
	Conversations []Conversation
}

var finnishEnding = regexp.MustCompile(`(ssa|ssä|sta|stä|lla|llä|lta|ltä|lle|ksi|na|nä|n|t)$`)
var finalVowels = regexp.MustCompile(`[aeiouyäö]+$`)

// Terms cuts a query to the stems the index matches: words of two letters
// or more, lower case, and words of five letters or more without one common
// Finnish case ending, their final vowels and a doubled final consonant
// (kartta, kartan, kartalle → kart, which also finds tilikartta). Matching
// is by substring, so an English word finds its longer forms as it is.
func Terms(q string) []string {
	words := strings.FieldsFunc(strings.ToLower(q), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	})
	seen := map[string]bool{}
	var out []string
	for _, w := range words {
		if utf8.RuneCountInString(w) < 2 {
			continue
		}
		if utf8.RuneCountInString(w) >= 5 {
			w = finnishEnding.ReplaceAllString(w, "")
			w = finalVowels.ReplaceAllString(w, "")
			if r := []rune(w); len(r) >= 2 && r[len(r)-1] == r[len(r)-2] && unicode.IsLetter(r[len(r)-1]) {
				w = string(r[:len(r)-1])
			}
		}
		if utf8.RuneCountInString(w) < 2 || seen[w] {
			continue
		}
		seen[w] = true
		out = append(out, w)
		if len(out) == MaxTerms {
			break
		}
	}
	return out
}

// Search finds the conversations whose messages contain every term.
// Conversations come newest hit first; the browser puts name matches above
// them and archived conversations last, from the snapshot it holds.
func (x *Index) Search(q string) (Result, error) {
	terms := Terms(q)
	res := Result{Terms: terms, Conversations: []Conversation{}}
	if len(terms) == 0 {
		return res, nil
	}
	where, args := condition(terms)
	x.mu.Lock()
	defer x.mu.Unlock()
	rows, err := x.db.Query("SELECT session, count(*), max(at) FROM messages WHERE "+where+" GROUP BY session ORDER BY max(at) DESC, session LIMIT ?", append(args, maxConversations)...)
	if err != nil {
		return res, err
	}
	index := map[string]int{}
	for rows.Next() {
		var c Conversation
		var newest int64
		if err := rows.Scan(&c.Session, &c.HitCount, &newest); err != nil {
			rows.Close()
			return res, err
		}
		c.Newest = time.UnixMilli(newest).UTC()
		index[c.Session] = len(res.Conversations)
		res.Conversations = append(res.Conversations, c)
	}
	rows.Close()
	if err := rows.Err(); err != nil || len(res.Conversations) == 0 {
		return res, err
	}
	sessions := make([]string, 0, len(res.Conversations))
	marks := make([]string, 0, len(res.Conversations))
	for _, c := range res.Conversations {
		sessions = append(sessions, c.Session)
		marks = append(marks, "?")
	}
	hitArgs := append(append([]any{}, args...), toAny(sessions)...)
	hitArgs = append(hitArgs, maxHitsEach)
	rows, err = x.db.Query(`SELECT session, entry, role, at, text FROM (
  SELECT rowid AS r, session, entry, role, at, text, row_number() OVER (PARTITION BY session ORDER BY at DESC, rowid DESC) AS n
  FROM messages WHERE `+where+` AND session IN (`+strings.Join(marks, ",")+`)
) WHERE n <= ? ORDER BY at DESC, r DESC`, hitArgs...)
	if err != nil {
		return res, err
	}
	defer rows.Close()
	best := map[int]int{}
	for rows.Next() {
		var session, entry, role, text string
		var at int64
		if err := rows.Scan(&session, &entry, &role, &at, &text); err != nil {
			return res, err
		}
		i, ok := index[session]
		if !ok {
			continue
		}
		res.Conversations[i].Hits = append(res.Conversations[i].Hits, Hit{Entry: entry, Role: role, At: time.UnixMilli(at).UTC(), Snippet: Sentence(text, terms, snippetRoom)})
		// The best is the newest hit where a term starts a word.
		if _, set := best[i]; !set && atWordStart(text, terms) {
			best[i] = len(res.Conversations[i].Hits) - 1
		}
	}
	if err := rows.Err(); err != nil {
		return res, err
	}
	for i, b := range best {
		hits := res.Conversations[i].Hits
		if b > 0 {
			first := hits[b]
			copy(hits[1:b+1], hits[:b])
			hits[0] = first
		}
	}
	return res, nil
}

func toAny(s []string) []any {
	out := make([]any, len(s))
	for i, v := range s {
		out[i] = v
	}
	return out
}

// condition is the WHERE clause matching every term: an FTS5 trigram phrase
// for a term of three letters or more, and a LIKE scan for a two-letter one,
// which the trigram index cannot hold.
func condition(terms []string) (string, []any) {
	var phrases []string
	var parts []string
	var args []any
	for _, t := range terms {
		if utf8.RuneCountInString(t) >= 3 {
			phrases = append(phrases, `"`+strings.ReplaceAll(t, `"`, `""`)+`"`)
			continue
		}
		parts = append(parts, `text LIKE ? ESCAPE '\'`)
		args = append(args, "%"+strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(t)+"%")
	}
	if len(phrases) > 0 {
		parts = append([]string{"messages MATCH ?"}, parts...)
		args = append([]any{strings.Join(phrases, " AND ")}, args...)
	}
	return strings.Join(parts, " AND "), args
}

// atWordStart reports whether a term starts a word of s: such a hit reads as
// a real match rather than a fragment inside a compound.
func atWordStart(s string, terms []string) bool {
	lower := strings.ToLower(s)
	for _, t := range terms {
		for from := 0; ; {
			i := strings.Index(lower[from:], t)
			if i < 0 {
				break
			}
			i += from
			if i == 0 {
				return true
			}
			r, _ := utf8.DecodeLastRuneInString(lower[:i])
			if !unicode.IsLetter(r) {
				return true
			}
			from = i + len(t)
		}
	}
	return false
}

var sentenceEnd = regexp.MustCompile(`([.!?…])\s+`)
var spaces = regexp.MustCompile(`\s+`)

// Sentence is the sentence of text that holds a term, cut to about room runes
// around the match: a row says why it is there in one line.
func Sentence(text string, terms []string, room int) string {
	s := strings.TrimSpace(spaces.ReplaceAllString(strings.ReplaceAll(text, "```", ""), " "))
	var parts []string
	last := 0
	for _, m := range sentenceEnd.FindAllStringSubmatchIndex(s, -1) {
		parts = append(parts, s[last:m[3]])
		last = m[1]
	}
	parts = append(parts, s[last:])
	one := parts[len(parts)-1]
	for _, p := range parts {
		if containsAny(p, terms) {
			one = p
			break
		}
	}
	r := []rune(one)
	if len(r) <= room {
		return one
	}
	lower := []rune(strings.ToLower(one))
	at := -1
	for _, t := range terms {
		if i := runeIndex(lower, []rune(t)); i >= 0 && (at < 0 || i < at) {
			at = i
		}
	}
	if at < 0 {
		at = 0
	}
	from := lastSpace(r, max(0, at-room/3))
	if at-from > room/2 {
		from = at
	}
	end := nextSpace(r, from+room)
	out := strings.TrimSpace(string(r[from:end]))
	if from > 0 {
		out = "…" + out
	}
	if end < len(r) {
		out += "…"
	}
	return out
}

func containsAny(s string, terms []string) bool {
	lower := strings.ToLower(s)
	for _, t := range terms {
		if strings.Contains(lower, t) {
			return true
		}
	}
	return false
}

func runeIndex(s, sub []rune) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		match := true
		for j := range sub {
			if s[i+j] != sub[j] {
				match = false
				break
			}
		}
		if match {
			return i
		}
	}
	return -1
}

func lastSpace(r []rune, before int) int {
	for i := min(before, len(r)-1); i > 0; i-- {
		if r[i] == ' ' {
			return i
		}
	}
	return 0
}

func nextSpace(r []rune, from int) int {
	for i := from; i < len(r); i++ {
		if r[i] == ' ' {
			return i
		}
	}
	return len(r)
}
