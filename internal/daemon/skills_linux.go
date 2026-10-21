//go:build linux

package daemon

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"go.yaml.in/yaml/v3"
)

// Presentation is optional and never makes a file invocable. Only paths from
// Pi's effective, trust-filtered get_commands response enter this read.
type skillDiscovery struct {
	Title      string         `json:"title,omitempty"`
	Topic      string         `json:"topic,omitempty"`
	When       string         `json:"when,omitempty"`
	Example    string         `json:"example,omitempty"`
	Start      *int           `json:"start,omitempty"`
	Repository bool           `json:"repository"`
	Added      *skillAddition `json:"added,omitempty"`
}
type skillAddition struct {
	Author string `json:"author"`
	At     string `json:"at"`
	Commit string `json:"commit"`
}

// Browser input never names a path. OpenRoot confines metadata reads (including
// symlinks) to this person's home. Package skills outside it remain discoverable
// with their native description, without reading their presentation metadata.
func (c *ConversationController) describeSkills(parent context.Context, workspace string, commands []piCommand) string {
	ws, _, err := c.workspaceFD(workspace)
	if err != nil {
		return ""
	}
	defer ws.Close()
	home, err := os.OpenRoot(c.home)
	if err != nil {
		return ""
	}
	defer home.Close()
	ctx, cancel := context.WithTimeout(parent, 3*time.Second)
	defer cancel()
	git := func(args ...string) string { return skillGit(ctx, ws, c.home, args...) }
	repo := strings.TrimSpace(git("rev-parse", "--show-toplevel"))
	common := strings.TrimSpace(git("rev-parse", "--path-format=absolute", "--git-common-dir"))
	shallow := strings.TrimSpace(git("rev-parse", "--is-shallow-repository")) != "false"
	for i := range commands {
		command := &commands[i]
		if command.Source != "skill" || !strings.HasPrefix(command.Name, "skill:") {
			continue
		}
		d := &skillDiscovery{}
		command.Discovery = d
		rel, err := filepath.Rel(c.home, command.Path)
		if err != nil || !filepath.IsAbs(command.Path) || rel == ".." || strings.HasPrefix(rel, "../") {
			continue
		}
		f, err := home.OpenFile(rel, os.O_RDONLY|syscall.O_NONBLOCK, 0)
		if err != nil {
			continue
		}
		info, err := f.Stat()
		if err != nil || !info.Mode().IsRegular() || info.Size() > 128*1024 {
			f.Close()
			continue
		}
		st, ok := info.Sys().(*syscall.Stat_t)
		if !ok || st.Uid != uint32(c.cfg.UID) {
			f.Close()
			continue
		}
		data, err := io.ReadAll(io.LimitReader(f, 128*1024+1))
		f.Close()
		if err != nil || len(data) > 128*1024 {
			continue
		}
		meta, valid := skillMetadata(data)
		if !valid {
			continue
		}
		d.Title = skillText(meta, "open-habitat-title", 256)
		d.Topic = skillText(meta, "open-habitat-topic", 128)
		d.When = skillText(meta, "open-habitat-when", 1024)
		d.Example = skillText(meta, "open-habitat-example", 2048)
		// Resolve provenance only for repository-owned skill locations, not packages
		// or a user's global skill whose name happens to match one in the repo.
		physical, err := filepath.EvalSymlinks(command.Path)
		if err != nil || repo == "" || !filepath.IsAbs(repo) {
			continue
		}
		path, err := filepath.Rel(repo, physical)
		if err != nil || !(strings.HasPrefix(path, ".pi/skills/") || strings.HasPrefix(path, ".agents/skills/")) {
			continue
		}
		d.Repository = true
		if raw := meta["open-habitat-start"]; raw != nil && raw.Kind == yaml.ScalarNode {
			if order, err := strconv.Atoi(raw.Value); err == nil && order >= 0 && order <= 10000 {
				d.Start = &order
			}
		}
		if !shallow {
			// --follow handles renames; multiple additions are ambiguous. Never infer
			// addition time from mtime or from the latest metadata-only modification.
			lines := strings.Split(strings.TrimSpace(git("log", "--follow", "--diff-filter=A", "--format=%H%x00%aI%x00%an", "--", path)), "\n")
			if len(lines) == 1 {
				fields := strings.Split(lines[0], "\x00")
				if len(fields) == 3 && len(fields[0]) == 40 && len(fields[2]) <= 256 {
					if at, err := time.Parse(time.RFC3339, fields[1]); err == nil {
						d.Added = &skillAddition{Author: strings.ToValidUTF8(fields[2], ""), At: at.Format(time.RFC3339), Commit: fields[0]}
					}
				}
			}
		}
	}
	if repo != "" && common != "" {
		return opaque("sk_", common)
	}
	return ""
}

func skillGit(ctx context.Context, ws *os.File, home string, args ...string) string {
	cmd := exec.CommandContext(ctx, "git", append([]string{"--no-pager"}, args...)...)
	cmd.ExtraFiles = []*os.File{ws}
	cmd.Dir = fmt.Sprintf("/proc/%d/fd/%d", os.Getpid(), ws.Fd())
	cmd.Env = []string{agentPath(home), "HOME=" + home, "GIT_OPTIONAL_LOCKS=0", "GIT_TERMINAL_PROMPT=0"}
	// Output is small for rev-parse and one addition record. Bound malicious
	// history without collecting an unbounded CombinedOutput buffer.
	out, err := cmd.StdoutPipe()
	if err != nil || cmd.Start() != nil {
		return ""
	}
	b, readErr := io.ReadAll(io.LimitReader(out, 8193))
	if len(b) > 8192 {
		_ = cmd.Process.Kill()
	}
	err = cmd.Wait()
	if err != nil || readErr != nil || len(b) > 8192 {
		return ""
	}
	return string(b)
}

func skillMetadata(data []byte) (map[string]*yaml.Node, bool) {
	text := strings.ReplaceAll(string(data), "\r\n", "\n")
	if !strings.HasPrefix(text, "---\n") {
		return nil, false
	}
	end := strings.Index(text[4:], "\n---")
	if end < 0 {
		return nil, false
	}
	var doc yaml.Node
	if yaml.Unmarshal([]byte(text[4:4+end]), &doc) != nil || len(doc.Content) != 1 {
		return nil, false
	}
	root := doc.Content[0]
	if root.Kind != yaml.MappingNode {
		return nil, false
	}
	out := map[string]*yaml.Node{}
	for i := 0; i+1 < len(root.Content); i += 2 {
		if root.Content[i].Value != "metadata" {
			continue
		}
		meta := root.Content[i+1]
		if meta.Kind != yaml.MappingNode {
			return nil, true
		}
		for j := 0; j+1 < len(meta.Content); j += 2 {
			out[meta.Content[j].Value] = meta.Content[j+1]
		}
	}
	return out, true
}
func skillText(meta map[string]*yaml.Node, key string, max int) string {
	n := meta[key]
	if n == nil || n.Kind != yaml.ScalarNode || n.Tag != "!!str" || len(n.Value) > max {
		return ""
	}
	return strings.ToValidUTF8(strings.TrimSpace(n.Value), "")
}
