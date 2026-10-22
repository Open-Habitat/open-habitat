//go:build linux

package daemon

import (
	"encoding/json"
	"io"
	"os"
	"path"
	"regexp"
	"strings"
	"syscall"

	"go.yaml.in/yaml/v3"
)

// Pi's parseSkillBlock/_expandSkillCommand is the record, not today's skill
// installation. Project only that complete leading wrapper; ordinary mentions
// and incomplete blocks remain ordinary user text.
var nativeSkillPattern = regexp.MustCompile(`^<skill name="([^"]+)" location="([^"]+)">\n([\s\S]*?)\n</skill>(?:\n\n([\s\S]+))?$`)

type recordedSkill struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

type skillProjection struct{ name, instruction, arguments, location string }

var argumentMarker = regexp.MustCompile("(?m)^(?:Arguments?|ARGUMENTS):[ \t]*`?\\$ARGUMENTS`?[ \t]*$\\n?")
var templatePlaceholder = regexp.MustCompile(`\$[A-Z][A-Z0-9_]*|\{\{[^}]*\}\}`)

// The native wrapper has the name but Pi strips frontmatter. This is optional
// current-file metadata, never a summary inferred from the archived instruction.
// Bound the frontmatter read, not total instruction size, and refuse special
// files: history is untrusted input. Large skill bodies remain valid sources.
func skillDescription(location, name string) string {
	if path.Ext(location) != ".md" || !path.IsAbs(location) {
		return ""
	}
	fd, err := syscall.Open(location, syscall.O_RDONLY|syscall.O_NONBLOCK|syscall.O_CLOEXEC, 0)
	if err != nil {
		return ""
	}
	f := os.NewFile(uintptr(fd), location)
	defer f.Close()
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() {
		return ""
	}
	b, err := io.ReadAll(io.LimitReader(f, 65536))
	if err != nil {
		return ""
	}
	// Match Pi's extractFrontmatter: BOM, normalized newlines, and the first
	// closing fence prefix. In particular, the closing fence may end the file.
	text := strings.TrimPrefix(string(b), "\uFEFF")
	text = strings.ReplaceAll(strings.ReplaceAll(text, "\r\n", "\n"), "\r", "\n")
	if !strings.HasPrefix(text, "---") {
		return ""
	}
	end := strings.Index(text[3:], "\n---")
	if end < 1 {
		return ""
	}
	front := text[4 : end+3]
	var meta struct {
		Name        string `yaml:"name"`
		Description string `yaml:"description"`
	}
	if yaml.Unmarshal([]byte(front), &meta) != nil {
		return ""
	}
	if meta.Name == "" {
		meta.Name = path.Base(path.Dir(location))
	}
	if meta.Name != name || templatePlaceholder.MatchString(meta.Description) {
		return ""
	}
	description := strings.Join(strings.Fields(meta.Description), " ")
	description = strings.ReplaceAll(description, location, "[skill source]")
	base := path.Dir(location)
	if base != "/" {
		description = strings.ReplaceAll(description, base, "[skill directory]")
	}
	if len(description) > 1000 {
		description = prefixBytes(description, 997) + "…"
	}
	return description
}

func projectSkill(text string) (skillProjection, bool) {
	m := nativeSkillPattern.FindStringSubmatch(text)
	if m == nil {
		return skillProjection{}, false
	}
	body := m[3]
	base := path.Dir(m[2])
	// The expansion adds the source directory even when the authored skill never
	// mentions it. Neither the location nor that generated preamble is UI content.
	body = strings.TrimPrefix(body, "References are relative to "+base+".\n\n")
	body = argumentMarker.ReplaceAllString(body, "")
	// Pi does not substitute this template marker. Keep inline references
	// intelligible without presenting an unresolved variable as user content.
	body = strings.ReplaceAll(body, "$ARGUMENTS", "[kutsun lisäteksti]")
	body = strings.ReplaceAll(body, m[2], "[skill source]")
	if base != "." && base != "/" {
		body = strings.ReplaceAll(body, base, "[skill directory]")
	}
	name := m[1]
	// Pi warns about invalid/long names but still expands them. Never let a
	// presentation bound turn a recognized wrapper back into a source-path dump.
	if len(name) > 1000 {
		name = prefixBytes(name, 997) + "…"
	}
	return skillProjection{name, body, strings.TrimSpace(m[4]), m[2]}, true
}

func skillInstruction(text string) string {
	if s, ok := projectSkill(text); ok {
		return s.instruction
	}
	return text
}

func projectUserSkill(message json.RawMessage) (skillProjection, bool) {
	var m struct {
		Role    string          `json:"role"`
		Content json.RawMessage `json:"content"`
	}
	if json.Unmarshal(message, &m) != nil || m.Role != "user" {
		return skillProjection{}, false
	}
	var text string
	if json.Unmarshal(m.Content, &text) == nil {
		return projectSkill(text)
	}
	var blocks []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if json.Unmarshal(m.Content, &blocks) != nil || len(blocks) == 0 || blocks[0].Type != "text" {
		return skillProjection{}, false
	}
	return projectSkill(blocks[0].Text)
}

func nativeSkillArgumentsChunk(raw json.RawMessage, index, offset, limit int) (map[string]any, bool) {
	var entry struct {
		Type    string          `json:"type"`
		Message json.RawMessage `json:"message"`
	}
	if index != 0 || json.Unmarshal(raw, &entry) != nil || entry.Type != "message" {
		return nil, false
	}
	skill, ok := projectUserSkill(entry.Message)
	if !ok {
		return nil, false
	}
	return textChunk(skill.arguments, offset, limit)
}
