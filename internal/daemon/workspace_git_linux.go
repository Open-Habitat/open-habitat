//go:build linux

package daemon

import (
	"context"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// workspaceGitSummary is an observation for this snapshot only. Never return
// raw remote URLs: they can contain credentials.
func workspaceGitSummary(ctx context.Context, home string, entry Workspace) (map[string]any, bool) {
	cfg := transport.Config{Home: home, UID: os.Geteuid()}
	src, _, err := workspaceSource(cfg)
	if err != nil {
		return nil, false
	}
	defer unix.Close(src)
	fd, opened, err := openWorkspace(src, entry.Name)
	if err != nil {
		return nil, false
	}
	defer unix.Close(fd)
	if uint64(opened.Dev) != entry.dev || opened.Ino != entry.ino {
		return nil, false
	}
	read := func(args ...string) ([]byte, error) {
		return cloneCommandWithTimeout(ctx, 2*time.Second, "/usr/bin/git", home, strconv.Itoa(fd), append([]string{"-c", "core.fsmonitor=false", "-c", "core.quotepath=false"}, args...)...)
	}
	branch, err := read("symbolic-ref", "--quiet", "--short", "HEAD")
	if err != nil {
		branch, err = read("rev-parse", "--short", "HEAD")
	}
	if err != nil || len(branch) > 256 {
		return nil, false
	}
	// -z avoids interpreting filenames; a rename/copy has a second NUL
	// terminated path which is not another changed file.
	status, err := read("status", "--porcelain=v1", "-z", "--untracked-files=all")
	if err != nil || len(status) > 1<<20 {
		return nil, false
	}
	count := 0
	records := strings.Split(strings.TrimSuffix(string(status), "\x00"), "\x00")
	for i := 0; i < len(records); i++ {
		record := records[i]
		if record == "" {
			continue
		}
		if len(record) < 4 || record[2] != ' ' {
			return nil, false
		}
		count++
		if strings.ContainsAny(record[:2], "RC") {
			i++
		}
	}
	summary := map[string]any{"branch": strings.TrimSpace(string(branch)), "dirty_count": count}
	origin, err := read("remote", "get-url", "origin")
	if err == nil {
		value := strings.TrimSpace(string(origin))
		name := strings.TrimPrefix(strings.TrimPrefix(value, "https://github.com/"), "git@github.com:")
		name = strings.TrimSuffix(name, ".git")
		parts := strings.Split(name, "/")
		if (strings.HasPrefix(value, "https://github.com/") || strings.HasPrefix(value, "git@github.com:")) && len(parts) == 2 && gitHubSegment(parts[0]) && gitHubSegment(parts[1]) {
			summary["github_repo"] = name
		}
	}
	return summary, true
}

func gitHubSegment(s string) bool {
	if len(s) == 0 || len(s) > 100 || s == "." || s == ".." {
		return false
	}
	for _, c := range s {
		if c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '-' || c == '_' || c == '.' {
			continue
		}
		return false
	}
	return true
}
