//go:build linux

package daemon

import (
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
)

// snapshotPiWriters takes one per-request census for the whole native catalog.
// No process or history facts survive this snapshot request.
func snapshotPiWriters(sessions []nativeSession, uid int, ownPIDs map[int]bool) map[string]string {
	return scanSnapshotPiWriters("/proc", sessions, uid, ownPIDs)
}

func scanSnapshotPiWriters(proc string, sessions []nativeSession, uid int, ownPIDs map[int]bool) map[string]string {
	result := make(map[string]string, len(sessions))
	if uid != os.Geteuid() || uid == 0 {
		return result
	}
	byInode := make(map[[2]uint64][]nativeSession)
	for _, s := range sessions {
		if s.state != "readable" {
			continue
		}
		result[s.path] = "not_observed"
		fi, err := os.Stat(s.path)
		if err != nil || !fi.Mode().IsRegular() {
			result[s.path] = "unknown"
			continue
		}
		st, ok := fi.Sys().(*syscall.Stat_t)
		if !ok {
			result[s.path] = "unknown"
			continue
		}
		byInode[[2]uint64{uint64(st.Dev), st.Ino}] = append(byInode[[2]uint64{uint64(st.Dev), st.Ino}], s)
	}
	uncertainAll := false
	entries, err := os.ReadDir(proc)
	if err != nil {
		uncertainAll = true
	}
	for _, entry := range entries {
		pid, err := strconv.Atoi(entry.Name())
		if err != nil || pid <= 0 || pid == os.Getpid() || ownPIDs[pid] {
			continue
		}
		base := filepath.Join(proc, entry.Name())
		info, err := os.Stat(base)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			uncertainAll = true
			continue
		}
		owner, ok := fileOwner(info)
		if !ok {
			uncertainAll = true
			continue
		}
		if owner != uid {
			continue
		}
		pinned, err := os.Open(base)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			uncertainAll = true
			continue
		}
		pinnedInfo, statErr := pinned.Stat()
		if statErr != nil || !os.SameFile(info, pinnedInfo) {
			_ = pinned.Close()
			uncertainAll = true
			continue
		}
		pinnedOwner, owned := fileOwner(pinnedInfo)
		if !owned || pinnedOwner != uid {
			_ = pinned.Close()
			uncertainAll = true
			continue
		}
		procBase := filepath.Join("/proc/self/fd", strconv.Itoa(int(pinned.Fd())))
		raw, err := os.ReadFile(filepath.Join(procBase, "cmdline"))
		if errors.Is(err, os.ErrNotExist) {
			_ = pinned.Close()
			continue
		}
		if err != nil {
			uncertainAll = true
			_ = pinned.Close()
			continue
		}
		if len(raw) == 0 {
			_ = pinned.Close()
			continue
		} // exited / zombie
		knownService := knownNonPiSystemProcess(raw)
		pi := !knownService && isPiCommand(raw)
		dir, err := os.Readlink(filepath.Join(procBase, "cwd"))
		if err != nil && !errors.Is(err, os.ErrNotExist) && !knownService {
			uncertainAll = true
		}
		if pi {
			for _, s := range sessions {
				if result[s.path] == "not_observed" && strings.Contains(string(raw), s.path) {
					result[s.path] = "writer_present"
				}
			}
		}
		fds, err := os.ReadDir(filepath.Join(procBase, "fd"))
		if err != nil && !errors.Is(err, os.ErrNotExist) && !knownService {
			uncertainAll = true
		}
		for _, fd := range fds {
			fi, err := os.Stat(filepath.Join(procBase, "fd", fd.Name()))
			if err != nil {
				if !errors.Is(err, os.ErrNotExist) && !knownService {
					uncertainAll = true
				}
				continue
			}
			st, ok := fi.Sys().(*syscall.Stat_t)
			if !ok {
				uncertainAll = true
				continue
			}
			for _, s := range byInode[[2]uint64{uint64(st.Dev), st.Ino}] {
				result[s.path] = "writer_present"
			}
		}
		if pi && dir != "" {
			for _, s := range sessions {
				if s.cwd == dir && result[s.path] == "not_observed" {
					result[s.path] = "unknown"
				}
			}
		}
		_ = pinned.Close()
	}
	if uncertainAll {
		for path, state := range result {
			if state != "writer_present" {
				result[path] = "unknown"
			}
		}
	}
	return result
}
