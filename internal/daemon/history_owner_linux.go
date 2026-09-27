//go:build linux

package daemon

import (
	"os"
	"syscall"
)

func fileOwner(info os.FileInfo) (int, bool) {
	s, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		return 0, false
	}
	return int(s.Uid), true
}
