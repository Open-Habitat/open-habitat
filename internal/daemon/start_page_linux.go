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

	"go.yaml.in/yaml/v3"
)

//go:embed start-page-skill/SKILL.md
var startPageSkill []byte

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
func (c *ConversationController) readStartPage(workspace string, commands []piCommand) *startPage {
	ws, _, err := c.workspaceFD(workspace)
	if err != nil {
		return nil
	}
	defer ws.Close()
	root, err := os.OpenRoot(filepath.Join("/proc/self/fd", strconv.Itoa(int(ws.Fd()))))
	if err != nil {
		return nil
	}
	defer root.Close()
	f, err := root.OpenFile(".agents/start-page.md", os.O_RDONLY|syscall.O_NONBLOCK, 0)
	if err != nil {
		return nil
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() || info.Size() > 32*1024 {
		return nil
	}
	st, ok := info.Sys().(*syscall.Stat_t)
	if !ok || st.Uid != uint32(c.cfg.UID) {
		return nil
	}
	data, err := io.ReadAll(io.LimitReader(f, 32*1024+1))
	if err != nil || len(data) > 32*1024 {
		return nil
	}
	page := parseStartPage(data)
	if page == nil {
		return nil
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
	return page
}

func parseStartPage(data []byte) *startPage {
	if !utf8.Valid(data) {
		return nil
	}
	text := strings.ReplaceAll(string(data), "\r\n", "\n")
	if !strings.HasPrefix(text, "---\n") {
		return nil
	}
	// A closing delimiter at EOF is valid too. Search with a virtual LF,
	// but preserve the authored Markdown body exactly.
	end := strings.Index(text[4:]+"\n", "\n---\n")
	if end < 0 {
		return nil
	}
	var page startPage
	decoder := yaml.NewDecoder(bytes.NewBufferString(text[4 : 4+end]))
	decoder.KnownFields(true)
	if decoder.Decode(&page) != nil || decoder.Decode(new(any)) != io.EOF {
		return nil
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
		return nil
	}
	for _, goal := range page.Goals {
		if !valid(goal.Title, 256, true) || !valid(goal.When, 1024, true) || !valid(goal.What, 2048, true) || len(goal.Steps) < 1 || len(goal.Steps) > 8 || !valid(goal.Prompt, 2048, true) {
			return nil
		}
		for _, step := range goal.Steps {
			if !valid(step, 1024, true) {
				return nil
			}
		}
		if goal.Skill != "" && (!piCommandName.MatchString(goal.Skill) || len(goal.Skill) > 122 || strings.Contains(goal.Skill, ":")) {
			return nil
		}
	}
	return &page
}

func installStartPageSkill(dir string) (string, error) {
	path := filepath.Join(dir, "open-habitat-start-page", "SKILL.md")
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return "", err
	}
	return path, os.WriteFile(path, startPageSkill, 0600)
}
