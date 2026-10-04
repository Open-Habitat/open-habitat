//go:build linux

package daemon

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"unsafe"

	"github.com/maintainer/native-agent-host/internal/transport"
	"golang.org/x/sys/unix"
)

// watchNativeHistory publishes invalidations, not file contents. The existing
// history reader remains the only path that validates and projects Pi entries.
// Watching the ancestors also handles a sessions directory created after login.
func watchNativeHistory(ctx context.Context, cfg transport.Config, journal *eventJournal, ready chan<- bool) {
	started := func(ok bool) {
		if ready != nil {
			ready <- ok
		}
	}
	fd, err := unix.InotifyInit1(unix.IN_NONBLOCK | unix.IN_CLOEXEC)
	if err != nil {
		started(false)
		journal.appendInvalidation("")
		return
	}
	defer unix.Close(fd)
	root := filepath.Join(cfg.Home, historyRoot)
	watched := map[string]int{}
	byWD := map[int]string{}
	// Rebuild watch registrations after directory changes. IN_DONT_FOLLOW and
	// ownership checks prevent redirecting the watcher into another user's tree.
	register := func() bool {
		paths := []string{cfg.Home, filepath.Join(cfg.Home, ".pi"), filepath.Join(cfg.Home, ".pi/agent")}
		for _, path := range paths {
			info, err := os.Lstat(path)
			if os.IsNotExist(err) {
				break
			}
			if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
				return false
			}
			if owner, ok := fileOwner(info); !ok || owner != cfg.UID {
				return false
			}
		}
		if info, e := os.Lstat(root); e == nil && info.IsDir() && info.Mode()&os.ModeSymlink == 0 {
			e = filepath.WalkDir(root, func(path string, d os.DirEntry, walkErr error) error {
				if walkErr != nil {
					return walkErr
				}
				if d.IsDir() && d.Type()&os.ModeSymlink == 0 {
					paths = append(paths, path)
				}
				if len(paths) > 515 {
					return unix.ENOSPC
				}
				return nil
			})
			if e != nil {
				return false
			}
		} else if e != nil && !os.IsNotExist(e) || e == nil && (!info.IsDir() || info.Mode()&os.ModeSymlink != 0) {
			return false
		}
		for _, path := range paths {
			if _, exists := watched[path]; exists {
				continue
			}
			info, e := os.Lstat(path)
			if os.IsNotExist(e) {
				break
			}
			if e != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
				return false
			}
			if owner, ok := fileOwner(info); !ok || owner != cfg.UID {
				return false
			}
			mask := uint32(unix.IN_CREATE | unix.IN_MOVED_TO | unix.IN_DELETE | unix.IN_MOVED_FROM | unix.IN_DELETE_SELF | unix.IN_MOVE_SELF | unix.IN_ONLYDIR | unix.IN_DONT_FOLLOW)
			if path == root || strings.HasPrefix(path, root+string(filepath.Separator)) {
				mask |= unix.IN_MODIFY | unix.IN_CLOSE_WRITE | unix.IN_ATTRIB
			}
			wd, err := unix.InotifyAddWatch(fd, path, mask)
			if err != nil {
				return false
			}
			watched[path] = wd
			byWD[wd] = path
		}
		return true
	}
	if !register() {
		started(false)
		journal.appendInvalidation("")
		return
	}
	started(true)
	var buf [64 << 10]byte
	for ctx.Err() == nil {
		poll := []unix.PollFd{{Fd: int32(fd), Events: unix.POLLIN}}
		n, e := unix.Poll(poll, 1000)
		if ctx.Err() != nil {
			return
		}
		if e == unix.EINTR {
			continue
		}
		if e != nil || n > 0 && poll[0].Revents&(unix.POLLERR|unix.POLLHUP|unix.POLLNVAL) != 0 {
			journal.appendInvalidation("")
			return
		}
		if n == 0 {
			continue
		}
		size, e := unix.Read(fd, buf[:])
		if e == unix.EAGAIN {
			continue
		}
		if e != nil || size == 0 {
			journal.appendInvalidation("")
			return
		}
		changed, dirs := false, false
		agents := map[string]bool{}
		global := false
		for offset := 0; offset+unix.SizeofInotifyEvent <= size; {
			event := (*unix.InotifyEvent)(unsafe.Pointer(&buf[offset]))
			offset += unix.SizeofInotifyEvent + int(event.Len)
			if offset > size {
				journal.appendInvalidation("")
				return
			}
			if event.Mask&unix.IN_Q_OVERFLOW != 0 {
				// Queue overflow loses filenames, not the watch registrations.
				// Rebuild and invalidate everything, then continue observing.
				dirs, global, changed = true, true, true
				break
			}
			if event.Mask&(unix.IN_DELETE_SELF|unix.IN_MOVE_SELF) != 0 {
				dirs = true
			}
			parent := byWD[int(event.Wd)]
			name := string(bytes.TrimRight(buf[offset-int(event.Len):offset], "\x00"))
			// Ancestor watches only track creation of the native session tree,
			// never unrelated writes in the user's home or Pi configuration.
			if parent == cfg.Home && name != ".pi" || parent == filepath.Join(cfg.Home, ".pi") && name != "agent" || parent == filepath.Join(cfg.Home, ".pi/agent") && name != "sessions" {
				continue
			}
			if event.Mask&unix.IN_ISDIR != 0 {
				dirs = true
			}
			if event.Mask&(unix.IN_CREATE|unix.IN_MODIFY|unix.IN_CLOSE_WRITE|unix.IN_MOVED_TO|unix.IN_DELETE|unix.IN_MOVED_FROM|unix.IN_ATTRIB) != 0 {
				changed = true
				if event.Mask&unix.IN_ISDIR == 0 && filepath.Ext(name) == ".jsonl" && parent != "" && parent != cfg.Home && parent != filepath.Join(cfg.Home, ".pi") && parent != filepath.Join(cfg.Home, ".pi/agent") {
					session := readNativeHeader(filepath.Join(parent, name), cfg.UID)
					if session.id != "" {
						agents["pi:"+session.id] = true
					} else {
						global = true
					}
				} else if event.Mask&unix.IN_ISDIR != 0 || parent == cfg.Home || parent == filepath.Join(cfg.Home, ".pi") || parent == filepath.Join(cfg.Home, ".pi/agent") {
					global = true
				}
			}
		}
		if dirs {
			// A removed watch descriptor can be reused by inotify; rebuild the set
			// rather than assuming old path registrations still cover the new tree.
			for _, wd := range watched {
				_, _ = unix.InotifyRmWatch(fd, uint32(wd))
			}
			clear(watched)
			clear(byWD)
			if !register() {
				journal.appendInvalidation("")
				return
			}
		}
		if dirs || global {
			journal.invalidateNative()
		} else if changed {
			for agent := range agents {
				journal.invalidateNativeAgent(agent)
			}
		}
	}
}
