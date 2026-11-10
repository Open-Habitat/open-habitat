//go:build linux

package daemon

import (
	"context"
	"os"
	"strings"

	"github.com/open-habitat/open-habitat/internal/transport"
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
	return gitSummaryAt(ctx, home, fd, nil)
}

// gitSummaryAt reads the summary of the checkout open at fd.
// A place passes its main checkout's branch for the base fallback.
func gitSummaryAt(ctx context.Context, home string, fd int, place *worktreePlace) (map[string]any, bool) {
	read := func(args ...string) ([]byte, error) {
		return inspectGit(ctx, home, fd, args...)
	}
	// One status call gives the branch, Git's own ahead/behind against the
	// upstream and the changed paths (a rename's second path is not another
	// changed file); the base comparison needs at most three more.
	status, err := readGitStatus(read, 0)
	if err != nil {
		return nil, false
	}
	summary := map[string]any{"branch": status.Branch, "dirty_count": status.DirtyCount}
	if status.Upstream != "" {
		summary["upstream"] = status.Upstream
		if status.Ahead != nil {
			summary["ahead"], summary["behind"] = *status.Ahead, *status.Behind
		}
	}
	base := readGitBase(read, status)
	if place != nil {
		base = readPlaceBase(read, status, place.MainBranch)
	}
	if base != nil {
		summary["base"] = base
	}
	origin, err := read("remote", "get-url", "origin")
	if err == nil {
		if name, ok := githubRepoName(string(origin)); ok {
			summary["github_repo"] = name
		}
	}
	return summary, true
}

// githubRepoName is owner/repo of a github.com origin, never the URL itself:
// it can hold a credential.
func githubRepoName(origin string) (string, bool) {
	value := strings.TrimSpace(origin)
	name := strings.TrimPrefix(strings.TrimPrefix(value, "https://github.com/"), "git@github.com:")
	name = strings.TrimSuffix(name, ".git")
	parts := strings.Split(name, "/")
	if (strings.HasPrefix(value, "https://github.com/") || strings.HasPrefix(value, "git@github.com:")) && len(parts) == 2 && gitHubSegment(parts[0]) && gitHubSegment(parts[1]) {
		return name, true
	}
	return "", false
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
