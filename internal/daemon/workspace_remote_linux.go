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

// workspaceRemote reports only a classification, never a native URL (which can
// contain credentials). A missing origin is not proof that there are no remotes.
// Continuation is a hint for the presentation, not authority to push: the
// publish handler rechecks the remote, GitHub owner, visibility and challenge.
func workspaceRemote(ctx context.Context, home string, entry Workspace) (string, bool) {
	cfg := transport.Config{Home: home, UID: os.Geteuid()}
	src, _, err := workspaceSource(cfg)
	if err != nil {
		return "unknown", false
	}
	defer unix.Close(src)
	fd, opened, err := openWorkspace(src, entry.Name)
	if err != nil {
		return "unknown", false
	}
	defer unix.Close(fd)
	if uint64(opened.Dev) != entry.dev || opened.Ino != entry.ino {
		return "unknown", false
	}
	read := func(args ...string) ([]byte, error) {
		return cloneCommandWithTimeout(ctx, 2*time.Second, "/usr/bin/git", home, strconv.Itoa(fd), args...)
	}
	origin, err := read("-c", "core.fsmonitor=false", "remote", "get-url", "origin")
	if err == nil {
		if strings.HasPrefix(string(origin), "https://github.com/") || strings.HasPrefix(string(origin), "git@github.com:") {
			// A main checkout with a local commit but no origin tracking refs
			// may be between publication's origin and push stages. A normal
			// nonempty clone has refs, and an empty clone has no local HEAD.
			head, headErr := read("-c", "core.fsmonitor=false", "rev-parse", "--verify", "HEAD^{commit}")
			refs, refsErr := read("-c", "core.fsmonitor=false", "for-each-ref", "--format=%(refname)", "refs/remotes/origin")
			return "github", headErr == nil && validCloneCommit(head) && refsErr == nil && len(strings.TrimSpace(string(refs))) == 0
		}
		return "other", false
	}
	remotes, err := read("-c", "core.fsmonitor=false", "remote")
	if err != nil {
		return "unknown", false
	}
	if len(strings.TrimSpace(string(remotes))) != 0 {
		return "other", false
	}
	return "none", false
}
