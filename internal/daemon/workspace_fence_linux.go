//go:build linux

package daemon

import (
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
// check 1). It is refused while a live Pi child runs in cwd; otherwise, until
// release, workspaceFD and every Pi launch refuse this inode. After the move
// they refuse it anyway, because admits requires the descriptor still to be
// the directory named cwd, so a start that resolved the workspace before the
// move cannot launch inside the Trash afterwards.
func (c *ConversationController) fenceWorkspace(cwd string, inode workspaceInode) ([]string, func()) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if live := c.liveIn(cwd); len(live) > 0 {
		return live, nil
	}
	if c.fences == nil {
		c.fences = map[workspaceInode]int{}
	}
	c.fences[inode]++
	return nil, func() {
		c.mu.Lock()
		defer c.mu.Unlock()
		if c.fences[inode]--; c.fences[inode] <= 0 {
			delete(c.fences, inode)
		}
	}
}

// liveSessions reports the managed conversations with a live child in cwd.
func (c *ConversationController) liveSessions(cwd string) []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.liveIn(cwd)
}

// Caller holds c.mu.
func (c *ConversationController) liveIn(cwd string) []string {
	var live []string
	for id, s := range c.sessions {
		if s.cwd != cwd || s.rpc == nil {
			continue
		}
		select {
		case <-s.rpc.exited:
		default:
			live = append(live, "pi:"+id)
		}
	}
	return live
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
