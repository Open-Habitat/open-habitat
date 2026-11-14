//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"
)

const fixtureStartPage = "---\ntitle: A repository title\ngoals:\n  - title: Investigate\n    what: A concrete result.\n    steps: [Read the context., Check the result.]\n    when: A test fails\n    prompt: Measure the failure.\n    skill: tests\n  - title: Explore\n    what: A concrete result.\n    steps: [Read the context., Check the result.]\n    when: New here\n    prompt: Explain this repository.\n---\nFree Markdown body.\n"

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
	if page == nil || page.Title != "A repository title" || page.Body != "Free Markdown body.\n" || len(page.Goals) != 2 || page.Goals[0].What != "A concrete result." || len(page.Goals[0].Steps) != 2 || page.Goals[0].Skill != "tests" || page.Goals[1].Skill != "" {
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
	assertStartPageNeedsUpdate(t, c.readStartPage(h.workspace, commands))
	os.Remove(path)
	if err := syscall.Mkfifo(path, 0600); err != nil {
		t.Fatal(err)
	}
	assertStartPageNeedsUpdate(t, c.readStartPage(h.workspace, commands))
	os.Remove(path)
	if err := os.WriteFile(path, bytes.Repeat([]byte("x"), 32*1024+1), 0600); err != nil {
		t.Fatal(err)
	}
	assertStartPageNeedsUpdate(t, c.readStartPage(h.workspace, commands))
}

func TestStartPageRejectsInvalidDocuments(t *testing.T) {
	for _, text := range []string{
		strings.Replace(fixtureStartPage, "skill: tests", "skill: tests\n    start: automatic", 1),
		strings.Replace(fixtureStartPage, "skill: tests", "skill: tests\n    start: true", 1),
		"no frontmatter", "---\ntitle: only\nunknown: field\n---\n", strings.Replace(fixtureStartPage, "title:", "unknown:", 1),
		strings.Replace(fixtureStartPage, "skill: tests", "skill: tests/../../secret", 1),
		strings.Replace(fixtureStartPage, "skill: tests", "skill: _bad", 1),
		strings.Replace(fixtureStartPage, "Measure the failure.", strings.Repeat("x", 2049), 1),
		strings.Replace(fixtureStartPage, "    what: A concrete result.\n", "", 1),
		strings.Replace(fixtureStartPage, "steps: [Read the context., Check the result.]", "steps: []", 1),
		strings.Replace(fixtureStartPage, "steps: [Read the context., Check the result.]", "steps: ['   ']", 1),
		strings.Replace(fixtureStartPage, "steps: [Read the context., Check the result.]", "steps: ["+strings.Repeat("step,", 8)+"step]", 1),
		strings.Replace(fixtureStartPage, "steps: [Read the context., Check the result.]", "steps: ["+strings.Repeat("x", 1025)+"]", 1),
		strings.Replace(fixtureStartPage, "what: A concrete result.", "what: "+strings.Repeat("x", 2049), 1),
		strings.Replace(fixtureStartPage, "title: Investigate", "title: ''", 1),
		strings.Replace(fixtureStartPage, "skill: tests", "skill: tests\n    name: \"Two\\nlines\"", 1),
		strings.Replace(fixtureStartPage, "skill: tests", "skill: tests\n    name: ' Padded'", 1),
		strings.Replace(fixtureStartPage, "skill: tests", "skill: tests\n    name: "+strings.Repeat("x", 161), 1),
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
	immediate := parseStartPage([]byte(strings.Replace(fixtureStartPage, "skill: tests", "skill: tests\n    start: immediate", 1)))
	if immediate == nil || immediate.Goals[0].Start != "immediate" || immediate.Goals[1].Start != "" {
		t.Fatalf("goal start: %+v", immediate)
	}
	// A goal may name the conversation it starts.
	named := parseStartPage([]byte(strings.Replace(fixtureStartPage, "skill: tests", "skill: tests\n    name: Viikkoraportti", 1)))
	if named == nil || named.Goals[0].Name != "Viikkoraportti" || named.Goals[1].Name != "" {
		t.Fatalf("goal name: %+v", named)
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

func assertStartPageNeedsUpdate(t *testing.T, page *startPageRead) {
	t.Helper()
	data, err := json.Marshal(page)
	if err != nil || string(data) != `{"state":"needs_update"}` {
		t.Fatalf("unavailable page leaked content or became absent: %s, %v", data, err)
	}
}

// The observed monorepo has its page at the discovered workspace root, with
// several independently instructed subdirectories. Only its obsolete goal
// shape matters here; all names and content below are synthetic.
func TestStartPageOldMonorepoNeedsUpdateAndRegeneratedPageWorks(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	root := filepath.Join(h.root, "src", "project")
	for _, dir := range []string{".agents", "planning", "reports", "archive"} {
		if err := os.MkdirAll(filepath.Join(root, dir), 0700); err != nil {
			t.Fatal(err)
		}
	}
	for _, dir := range []string{"planning", "reports", "archive"} {
		if err := os.WriteFile(filepath.Join(root, dir, "AGENTS.md"), []byte("Synthetic instructions."), 0600); err != nil {
			t.Fatal(err)
		}
	}
	path := filepath.Join(root, ".agents", "start-page.md")
	old := "---\ntitle: Synthetic monorepo\ngoals:\n  - title: Explore\n    when: New here\n    prompt: Explain this project.\n---\nSynthetic body.\n"
	if err := os.WriteFile(path, []byte(old), 0600); err != nil {
		t.Fatal(err)
	}
	_, reason := parseStartPageDocument([]byte(old))
	if reason != "invalid_goal_fields" {
		t.Fatalf("reason: %s", reason)
	}
	assertStartPageNeedsUpdate(t, c.readStartPage(h.workspace, nil))
	if err := os.WriteFile(path, []byte(fixtureStartPage), 0600); err != nil {
		t.Fatal(err)
	}
	page := c.readStartPage(h.workspace, nil)
	if page == nil || page.State != "" || page.startPage == nil || len(page.Goals) != 2 {
		t.Fatalf("regenerated page: %+v", page)
	}
	os.Remove(path)
	if err := os.Symlink("missing.md", path); err != nil {
		t.Fatal(err)
	}
	assertStartPageNeedsUpdate(t, c.readStartPage(h.workspace, nil))
}

// File-only reads do not need a runtime, helper slot, or native command list.
func TestStartPageFileReadIndependentOfPi(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	c.runtime = nil
	path := filepath.Join(h.root, "src", "project", ".agents", "start-page.md")
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(fixtureStartPage), 0600); err != nil {
		t.Fatal(err)
	}
	for _, target := range []struct {
		query string
		code  int
	}{
		{"?workspace_id=" + h.workspace, 200},
		{"?workspace_id=" + h.workspace + "&path=x", 400},
		{"?workspace_id=" + h.workspace + "&workspace_id=" + h.workspace, 400},
		{"?workspace_id=../../other", 400},
		{"?workspace_id=ws_example123", 404},
	} {
		r := httptest.NewRequest("GET", WorkspaceStartPagePath+target.query, nil)
		r.Host = "unix"
		w := httptest.NewRecorder()
		started := time.Now()
		c.WorkspaceStartPage().ServeHTTP(w, r)
		if target.code == 200 {
			t.Logf("file-only read + parse + JSON: %s", time.Since(started))
		}
		if w.Code != target.code {
			t.Fatalf("file-only read %s: %d", target.query, w.Code)
		}
		if w.Code == 200 {
			var reply struct {
				Page *startPage `json:"start_page"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &reply); err != nil {
				t.Fatal(err)
			}
			if reply.Page == nil || reply.Page.Goals[0].Skill != "tests" {
				t.Fatalf("authored reference lost: %s", w.Body.String())
			}
		}
	}
	if len(h.lines("launches.log")) != 0 {
		t.Fatal("file read launched Pi")
	}
}
