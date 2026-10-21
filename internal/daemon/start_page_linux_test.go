//go:build linux

package daemon

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
)

const fixtureStartPage = "---\ntitle: A repository title\ngoals:\n  - title: Investigate\n    when: A test fails\n    prompt: Measure the failure.\n    skill: tests\n  - title: Explore\n    when: New here\n    prompt: Explain this repository.\n---\nFree Markdown body.\n"

func TestStartPageIsWorkspaceBoundAndNativeSkillReferencesAreOptional(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	dir := filepath.Join(h.root, "src", "project", ".agents")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "start-page.md")
	if c.readStartPage(h.workspace, nil) != nil {
		t.Fatal("missing page invented")
	}
	if err := os.WriteFile(path, []byte(fixtureStartPage), 0600); err != nil {
		t.Fatal(err)
	}
	commands := []piCommand{{Name: "skill:tests", Source: "skill"}}
	page := c.readStartPage(h.workspace, commands)
	if page == nil || page.Title != "A repository title" || page.Body != "Free Markdown body.\n" || len(page.Goals) != 2 || page.Goals[0].Skill != "tests" || page.Goals[1].Skill != "" {
		t.Fatalf("page: %+v", page)
	}
	page = c.readStartPage(h.workspace, []piCommand{{Name: "skill:tests", Source: "prompt"}})
	if page == nil || page.Goals[0].Skill != "" || page.Goals[0].Prompt != "Measure the failure." {
		t.Fatalf("stale reference: %+v", page)
	}
	os.Remove(path)
	// Even a same-owner, same-home file in another workspace is not this page.
	outside := filepath.Join(h.root, "other-page.md")
	if err := os.WriteFile(outside, []byte(fixtureStartPage), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, path); err != nil {
		t.Fatal(err)
	}
	if c.readStartPage(h.workspace, commands) != nil {
		t.Fatal("escaped workspace")
	}
	os.Remove(path)
	if err := syscall.Mkfifo(path, 0600); err != nil {
		t.Fatal(err)
	}
	if c.readStartPage(h.workspace, commands) != nil {
		t.Fatal("read special file")
	}
	os.Remove(path)
	if err := os.WriteFile(path, bytes.Repeat([]byte("x"), 32*1024+1), 0600); err != nil {
		t.Fatal(err)
	}
	if c.readStartPage(h.workspace, commands) != nil {
		t.Fatal("read oversized file")
	}
}

func TestStartPageRejectsInvalidDocuments(t *testing.T) {
	for _, text := range []string{
		"no frontmatter", "---\ntitle: only\nunknown: field\n---\n", strings.Replace(fixtureStartPage, "title:", "unknown:", 1),
		strings.Replace(fixtureStartPage, "skill: tests", "skill: tests/../../secret", 1),
		strings.Replace(fixtureStartPage, "skill: tests", "skill: _bad", 1),
		strings.Replace(fixtureStartPage, "Measure the failure.", strings.Repeat("x", 2049), 1),
		strings.Replace(fixtureStartPage, "title: Investigate", "title: ''", 1),
		strings.Replace(fixtureStartPage, "title: A repository title", "intro: [broken", 1),
		fixtureStartPage[:8] + string([]byte{0xff}) + fixtureStartPage[8:],
	} {
		if parseStartPage([]byte(text)) != nil {
			t.Fatalf("accepted invalid page %.80q", text)
		}
	}
	if parseStartPage([]byte(strings.ReplaceAll(fixtureStartPage, "\n", "\r\n"))) == nil {
		t.Fatal("rejected CRLF")
	}
	page := parseStartPage([]byte("---\ntitle: Text only\n---\nA **free text** page."))
	if page == nil || len(page.Goals) != 0 || page.Body != "A **free text** page." {
		t.Fatalf("text-only page: %+v", page)
	}
}

func TestStartPageClosingFrontmatterNeedsNoFinalNewline(t *testing.T) {
	page := parseStartPage([]byte("---\ntitle: Title only\n---"))
	if page == nil || page.Title != "Title only" || page.Body != "" || len(page.Goals) != 0 {
		t.Fatalf("valid title-only page rejected: %+v", page)
	}
}

func TestBundledStartPageSkillIsMaterialized(t *testing.T) {
	path, err := installStartPageSkill(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil || !bytes.Equal(data, startPageSkill) {
		t.Fatalf("skill materialization: %v", err)
	}
}
