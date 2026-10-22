//go:build linux

package daemon

import (
	"bytes"
	_ "embed"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
	"go.yaml.in/yaml/v3"
)

//go:embed start-page-skill/SKILL.md
var startPageSkill []byte

type startPageRead struct {
	*startPage
	State string `json:"state,omitempty"`
}

func startPageUnavailable(workspace, reason string) *startPageRead {
	diagnostic.New(os.Stderr, "daemon").Warn("start_page_read", "outcome", "needs_update", "workspace_id", workspace, "reason", reason)
	return &startPageRead{State: "needs_update"}
}

type startPage struct {
	Title string      `json:"title" yaml:"title"`
	Body  string      `json:"body" yaml:"-"`
	Goals []startGoal `json:"goals" yaml:"goals"`
}
type startGoal struct {
	Title  string   `json:"title" yaml:"title"`
	When   string   `json:"when" yaml:"when"`
	What   string   `json:"what" yaml:"what"`
	Steps  []string `json:"steps" yaml:"steps"`
	Prompt string   `json:"prompt" yaml:"prompt"`
	Skill  string   `json:"skill,omitempty" yaml:"skill,omitempty"`
}

// The workspace is held by the existing admission proof. OpenRoot confines
// symlinks to it, not merely to the home: a repository cannot borrow a page
// from another workspace. Reads never accept a browser-supplied path.
func (c *ConversationController) readStartPage(workspace string, commands []piCommand) *startPageRead {
	ws, _, err := c.workspaceFD(workspace)
	if err != nil {
		return startPageUnavailable(workspace, "workspace_unavailable")
	}
	defer ws.Close()
	root, err := os.OpenRoot(filepath.Join("/proc/self/fd", strconv.Itoa(int(ws.Fd()))))
	if err != nil {
		return startPageUnavailable(workspace, "workspace_unavailable")
	}
	defer root.Close()
	f, err := root.OpenFile(".agents/start-page.md", os.O_RDONLY|syscall.O_NONBLOCK, 0)
	if err != nil {
		if os.IsNotExist(err) {
			// A dangling page symlink exists but cannot be read.
			if _, statErr := root.Lstat(".agents/start-page.md"); os.IsNotExist(statErr) {
				return nil
			}
		}
		return startPageUnavailable(workspace, "open_failed")
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		return startPageUnavailable(workspace, "stat_failed")
	}
	if !info.Mode().IsRegular() {
		return startPageUnavailable(workspace, "not_regular")
	}
	if info.Size() > 32*1024 {
		return startPageUnavailable(workspace, "too_large")
	}
	st, ok := info.Sys().(*syscall.Stat_t)
	if !ok || st.Uid != uint32(c.cfg.UID) {
		return startPageUnavailable(workspace, "owner_mismatch")
	}
	data, err := io.ReadAll(io.LimitReader(f, 32*1024+1))
	if err != nil {
		return startPageUnavailable(workspace, "read_failed")
	}
	if len(data) > 32*1024 {
		return startPageUnavailable(workspace, "too_large")
	}
	page, reason := parseStartPageDocument(data)
	if page == nil {
		return startPageUnavailable(workspace, reason)
	}
	for i := range page.Goals {
		goal := &page.Goals[i]
		if goal.Skill == "" {
			continue
		}
		found := false
		for _, command := range commands {
			if command.Source == "skill" && command.Name == "skill:"+goal.Skill {
				found = true
				break
			}
		}
		// A stale reference remains useful prose, but never a made-up invocation.
		if !found {
			goal.Skill = ""
		}
	}
	return &startPageRead{startPage: page}
}

func parseStartPage(data []byte) *startPage {
	page, _ := parseStartPageDocument(data)
	return page
}

func parseStartPageDocument(data []byte) (*startPage, string) {
	if !utf8.Valid(data) {
		return nil, "invalid_utf8"
	}
	text := strings.ReplaceAll(string(data), "\r\n", "\n")
	if !strings.HasPrefix(text, "---\n") {
		return nil, "missing_frontmatter"
	}
	// A closing delimiter at EOF is valid too. Search with a virtual LF,
	// but preserve the authored Markdown body exactly.
	end := strings.Index(text[4:]+"\n", "\n---\n")
	if end < 0 {
		return nil, "missing_frontmatter_end"
	}
	var page startPage
	decoder := yaml.NewDecoder(bytes.NewBufferString(text[4 : 4+end]))
	decoder.KnownFields(true)
	if decoder.Decode(&page) != nil || decoder.Decode(new(any)) != io.EOF {
		return nil, "invalid_frontmatter"
	}
	valid := func(s string, max int, required bool) bool {
		return len(s) <= max && (!required || strings.TrimSpace(s) != "")
	}
	if bodyOffset := 4 + end + 5; bodyOffset < len(text) {
		page.Body = text[bodyOffset:]
	}
	if page.Goals == nil {
		page.Goals = []startGoal{}
	}
	if !valid(page.Title, 256, true) || !valid(page.Body, 16384, false) || len(page.Goals) > 8 {
		return nil, "invalid_page_fields"
	}
	for _, goal := range page.Goals {
		if !valid(goal.Title, 256, true) || !valid(goal.When, 1024, true) || !valid(goal.What, 2048, true) || len(goal.Steps) < 1 || len(goal.Steps) > 8 || !valid(goal.Prompt, 2048, true) {
			return nil, "invalid_goal_fields"
		}
		for _, step := range goal.Steps {
			if !valid(step, 1024, true) {
				return nil, "invalid_step"
			}
		}
		if goal.Skill != "" && (!piCommandName.MatchString(goal.Skill) || len(goal.Skill) > 122 || strings.Contains(goal.Skill, ":")) {
			return nil, "invalid_skill"
		}
	}
	return &page, ""
}

func installStartPageSkill(dir string) (string, error) {
	path := filepath.Join(dir, "open-habitat-start-page", "SKILL.md")
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return "", err
	}
	return path, os.WriteFile(path, startPageSkill, 0600)
}
