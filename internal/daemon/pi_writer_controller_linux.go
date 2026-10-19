//go:build linux

package daemon

// The current daemon knows which of its own Pi children are pinned to other
// sessions. They cannot switch sessions through our RPC whitelist; skipping
// them avoids treating every conversation in one workspace as ambiguous.
// Children of an earlier daemon incarnation are not in this set and must still
// be observed or fenced by their inherited ownership lock.
func (c *ConversationController) ownPiPIDs() map[int]bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make(map[int]bool)
	for _, s := range c.sessions {
		if s.rpc == nil || s.rpc.cmd == nil || s.rpc.cmd.Process == nil {
			continue
		}
		select {
		case <-s.rpc.exited:
		default:
			out[s.rpc.cmd.Process.Pid] = true
		}
	}
	return out
}

func (c *ConversationController) piWriter(path, cwd string) string {
	proc := c.writerProc
	if proc == "" {
		proc = "/proc"
	}
	return scanPiWriterExcept(proc, path, cwd, c.cfg.UID, c.ownPiPIDs())
}
