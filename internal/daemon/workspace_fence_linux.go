//go:build linux

package daemon

import (
	"context"
	"os"

	"golang.org/x/sys/unix"
)

// workspaceInode names a workspace directory by device and inode, which
// follow the directory into the Trash; its ~/src path does not.
type workspaceInode struct{ dev, ino uint64 }

func inodeOf(s unix.Stat_t) workspaceInode {
	return workspaceInode{uint64(s.Dev), s.Ino}
}

// fenceWorkspace is deletion's admission against managed sessions (ADR 0019
// check 1). It is refused while a conversation in cwd or below it is busy
// (pi_activity_linux.go), and the busy ones are returned. Otherwise it takes
// the fence and stops the idle Pi children there: their histories stay, and
// a later send resumes them wherever the workspace then is. Until release,
// workspaceFD and every Pi launch refuse this inode. After the move they
// refuse it anyway, because admits requires the descriptor still to be the
// directory named cwd, so a start that resolved the workspace before the
// move cannot launch inside the Trash afterwards.
func (c *ConversationController) fenceWorkspace(ctx context.Context, cwd string, inode workspaceInode) ([]busyConversation, func()) {
	inside := func(s *conversation) bool { return insidePath(s.cwd, cwd) }
	busy, idle := c.classify(ctx, inside)
	if len(busy) > 0 {
		return busy, nil
	}
	c.mu.Lock()
	// A child that started or turned busy since classify was not asked about
	// background processes; it blocks like any busy one.
	probed := map[*conversation]bool{}
	for _, s := range idle {
		probed[s] = true
	}
	for id, s := range c.sessions {
		if !inside(s) || !liveChild(s) {
			continue
		}
		if activity := heldActivity(s); activity != "" || !probed[s] {
			if activity == "" {
				activity = "turn"
			}
			busy = append(busy, busyConversation{"pi:" + id, activity})
		}
	}
	if len(busy) > 0 {
		c.mu.Unlock()
		return busy, nil
	}
	// A deletion also fences enclosing/contained file-operation roots. Pin the
	// named target and verify deletion's already-held identity before using it.
	fd, err := unix.Open(cwd, unix.O_PATH|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		c.mu.Unlock()
		return []busyConversation{{"", "file_operation"}}, nil
	}
	target := os.NewFile(uintptr(fd), "deletion-fence")
	s, err := stat(fd)
	if err != nil || inodeOf(s) != inode {
		target.Close()
		c.mu.Unlock()
		return []busyConversation{{"", "file_operation"}}, nil
	}
	for held := range c.fileOperations {
		if editorOverlap(held, target) {
			target.Close()
			c.mu.Unlock()
			return []busyConversation{{"", "file_operation"}}, nil
		}
	}
	if c.fileFences == nil {
		c.fileFences = map[workspaceInode]*os.File{}
	}
	if c.fileFences[inode] == nil {
		c.fileFences[inode] = target
	} else {
		target.Close()
	}
	if c.fences == nil {
		c.fences = map[workspaceInode]int{}
	}
	c.fences[inode]++
	release := func() {
		c.mu.Lock()
		defer c.mu.Unlock()
		if c.fences[inode]--; c.fences[inode] <= 0 {
			delete(c.fences, inode)
			c.fileFences[inode].Close()
			delete(c.fileFences, inode)
		}
	}
	marked := c.stopIdleLocked(idle)
	c.mu.Unlock()
	c.closeStopping(marked)
	for _, s := range marked {
		if liveChild(s) { // a Pi whose end is unknown may still write there
			busy = append(busy, busyConversation{"pi:" + s.id, "unknown"})
		}
	}
	if len(busy) > 0 {
		release()
		return busy, nil
	}
	return nil, release
}

// busySessions reports the busy conversations in cwd or in a directory below
// it, for a check that changes nothing; idle ones would be stopped.
func (c *ConversationController) busySessions(ctx context.Context, cwd string) []busyConversation {
	busy, _ := c.classify(ctx, func(s *conversation) bool { return insidePath(s.cwd, cwd) })
	c.mu.Lock()
	defer c.mu.Unlock()
	fd, err := unix.Open(cwd, unix.O_PATH|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err == nil {
		target := os.NewFile(uintptr(fd), "deletion-preview")
		defer target.Close()
		for held := range c.fileOperations {
			if editorOverlap(held, target) {
				busy = append(busy, busyConversation{"", "file_operation"})
				break
			}
		}
	}
	return busy
}

// admits reports whether a workspace descriptor may host a new Pi child: no
// deletion holds a fence on it, and cwd still names this very directory (it
// has not moved into the Trash). Caller holds c.mu across this check and the
// launch it guards; deletion's fence is taken under the same lock.
func (c *ConversationController) admits(ws *os.File, cwd string) bool {
	s, err := stat(int(ws.Fd()))
	if err != nil || c.fences[inodeOf(s)] > 0 {
		return false
	}
	var named unix.Stat_t
	return unix.Lstat(cwd, &named) == nil && same(s, named)
}

func busyDeletionBlocker(b busyConversation) deletionBlocker {
	if b.activity == "file_operation" {
		return deletionBlocker{Kind: "file_operation"}
	}
	return deletionBlocker{Kind: "pi_session", AgentID: b.agentID, Activity: b.activity}
}
