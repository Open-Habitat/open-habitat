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
// release, workspaceFD and every Pi launch refuse this inode. A released
// fence whose directory moved keeps refusing it until it is restored, so a
// start that resolved the workspace before the move cannot launch inside the
// Trash afterwards.
func (c *ConversationController) fenceWorkspace(cwd string, inode workspaceInode) ([]string, func(moved bool)) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if live := c.liveIn(cwd); len(live) > 0 {
		return live, nil
	}
	if c.fences == nil {
		c.fences = map[workspaceInode]int{}
	}
	c.fences[inode]++
	return nil, func(moved bool) {
		c.mu.Lock()
		defer c.mu.Unlock()
		if c.fences[inode]--; c.fences[inode] <= 0 {
			delete(c.fences, inode)
		}
		if moved {
			if c.departed == nil {
				c.departed = map[workspaceInode]bool{}
			}
			c.departed[inode] = true
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

// workspaceRestored lets starts use a directory again once it is back in ~/src.
func (c *ConversationController) workspaceRestored(inode workspaceInode) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.departed, inode)
}

// admits reports whether a workspace descriptor may host a new Pi child.
// Caller holds c.mu across this check and the launch it guards.
func (c *ConversationController) admits(ws *os.File) bool {
	s, err := stat(int(ws.Fd()))
	if err != nil {
		return false
	}
	inode := inodeOf(s)
	return c.fences[inode] == 0 && !c.departed[inode]
}
