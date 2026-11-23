package replyblock

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
	"unicode/utf8"
)

// testdata/excerpts.json is shared with the browser's copy of the rule
// (web/src/app/replyExcerpt.test.ts), so the field shows what the agent gets.
func TestExcerptRules(t *testing.T) {
	raw, err := os.ReadFile("testdata/excerpts.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct{ Name, In, Want string }
	if err := json.Unmarshal(raw, &cases); err != nil || len(cases) < 10 {
		t.Fatalf("cases: %v", err)
	}
	for _, c := range cases {
		got := Excerpt(c.In)
		if got != c.Want {
			t.Errorf("%s: Excerpt(%q) = %q, want %q", c.Name, c.In, got, c.Want)
		}
		if n := utf8.RuneCountInString(got); n > MaxExcerpt {
			t.Errorf("%s: %d characters", c.Name, n)
		}
	}
}

func TestBuildParseRoundTrip(t *testing.T) {
	text := Build("b81e04d6", "Kaksi tapaa: …", "Mennään ensimmäisellä.\n\nToinen kappale.")
	want := "<reply-to entry=\"b81e04d6\">\nKaksi tapaa: …\n</reply-to>\n\nMennään ensimmäisellä.\n\nToinen kappale."
	if text != want {
		t.Fatalf("Build = %q", text)
	}
	key, excerpt, rest, ok := Parse(text)
	if !ok || key != "b81e04d6" || excerpt != "Kaksi tapaa: …" || rest != "Mennään ensimmäisellä.\n\nToinen kappale." {
		t.Fatalf("Parse = %q %q %q %v", key, excerpt, rest, ok)
	}
	// A multi-line excerpt (a code block) parses whole.
	if _, excerpt, _, ok := Parse(Build("k", "```\nls\n```", "joo")); !ok || excerpt != "```\nls\n```" {
		t.Fatalf("multi-line excerpt = %q %v", excerpt, ok)
	}
}

func TestParseRejectsOrdinaryText(t *testing.T) {
	for _, text := range []string{
		"Hei <reply-to entry=\"a\">\nx\n</reply-to>\n\nmid-text block",
		"<reply-to entry=\"bad key\">\nx\n</reply-to>\n\ntext",
		"<reply-to entry=\"a\">\nnever closed",
		"<reply-to entry=\"a\">\nx\n</reply-to>glued",
		"<reply-to entry=\"a\">\n" + strings.Repeat("z", 3000) + "\n</reply-to>\n\ntoo long",
	} {
		if _, _, _, ok := Parse(text); ok {
			t.Errorf("Parse accepted %q", text[:min(len(text), 60)])
		}
		if Strip(text) != text {
			t.Errorf("Strip changed ordinary text %q", text[:min(len(text), 60)])
		}
	}
}
