//go:build linux

package daemon

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
)

// A pinned /proc directory survives its process. Linux reports ESRCH, not
// only ENOENT, when a field is read after that process has exited. Permission
// and other failures still leave the census uncertain.
func procEntryGone(err error) bool {
	return errors.Is(err, os.ErrNotExist) || errors.Is(err, syscall.ESRCH)
}

// A successful empty cmdline read is not exit proof: a live process can
// protect its argument pages. Use kernel task state, as workspace deletion does.
func procTaskExited(base string) bool {
	raw, err := os.ReadFile(filepath.Join(base, "stat"))
	if err != nil {
		return false
	}
	end := bytes.LastIndexByte(raw, ')')
	return end >= 0 && end+2 < len(raw) && (raw[end+2] == 'Z' || raw[end+2] == 'X')
}

// piWriter observes only processes of the daemon's own kernel UID. A Pi process
// with the session file open is a writer; a Pi in the same workspace whose
// session cannot be identified makes the answer unknown, not absent. This is a
// per-request observation, never an ownership lease or a process registry.
func piWriter(path, cwd string, uid int) string {
	return scanPiWriter("/proc", path, cwd, uid)
}

func scanPiWriter(proc, path, cwd string, uid int) string {
	return scanPiWriterExcept(proc, path, cwd, uid, nil)
}

func scanPiWriterExcept(proc, path, cwd string, uid int, ownPIDs map[int]bool) string {
	if uid != os.Geteuid() || uid == 0 || !filepath.IsAbs(path) || !filepath.IsAbs(cwd) {
		return "unknown"
	}
	target, err := os.Stat(path)
	if err != nil || !target.Mode().IsRegular() {
		return "unknown"
	}
	entries, err := os.ReadDir(proc)
	if err != nil {
		return "unknown"
	}
	unknown := false
	for _, entry := range entries {
		pid, err := strconv.Atoi(entry.Name())
		if err != nil || pid <= 0 || pid == os.Getpid() || ownPIDs[pid] {
			continue
		}
		base := filepath.Join(proc, entry.Name())
		info, err := os.Stat(base)
		if procEntryGone(err) {
			continue // exited during enumeration
		}
		if err != nil {
			unknown = true
			continue
		}
		owner, ok := fileOwner(info)
		if !ok {
			unknown = true
			continue
		}
		if owner != uid {
			continue // Never read the process details of another UID.
		}
		// Pin the directory before opening its fields. The PID could be
		// recycled between the ownership check and a pathname-based read.
		pinned, err := os.Open(base)
		if procEntryGone(err) {
			continue
		}
		if err != nil {
			unknown = true
			continue
		}
		pinnedInfo, err := pinned.Stat()
		if err != nil || !os.SameFile(info, pinnedInfo) {
			_ = pinned.Close()
			unknown = true
			continue
		}
		pinnedOwner, ok := fileOwner(pinnedInfo)
		if !ok || pinnedOwner != uid {
			_ = pinned.Close()
			unknown = true
			continue
		}
		result := inspectOwnedPi(filepath.Join("/proc/self/fd", strconv.Itoa(int(pinned.Fd()))), path, cwd, target)
		_ = pinned.Close()
		if result == "writer_present" {
			return result
		}
		if result == "unknown" {
			unknown = true
		}
	}
	if unknown {
		return "unknown"
	}
	return "not_observed"
}

// base is a pinned process directory descriptor, not a recycled PID pathname.
func inspectOwnedPi(base, path, cwd string, target os.FileInfo) string {
	raw, err := os.ReadFile(filepath.Join(base, "cmdline"))
	if procEntryGone(err) {
		return "not_observed"
	}
	if err != nil {
		return "unknown"
	}
	if procTaskExited(base) {
		return "not_observed"
	}
	knownService := knownNonPiSystemProcess(raw)
	pi := !knownService && isPiCommand(raw)
	// Pi can reopen a session from another working directory with --session.
	if pi && strings.Contains(string(raw), path) {
		return "writer_present"
	}
	dir, err := os.Readlink(filepath.Join(base, "cwd"))
	if procEntryGone(err) && !knownService {
		return "not_observed"
	}
	if err != nil && !knownService {
		return "unknown"
	}
	fds, err := os.ReadDir(filepath.Join(base, "fd"))
	if procEntryGone(err) {
		return "not_observed"
	}
	if err != nil {
		if knownService {
			return "not_observed"
		}
		return "unknown"
	}
	for _, fd := range fds {
		fi, err := os.Stat(filepath.Join(base, "fd", fd.Name()))
		if err == nil && os.SameFile(fi, target) {
			return "writer_present"
		}
		if err != nil && !procEntryGone(err) && !knownService {
			return "unknown"
		}
	}
	// Pi can close its JSONL descriptor between writes. A same-workspace
	// process without a matching fd cannot establish that this file is free.
	if pi && dir == cwd {
		return "unknown"
	}
	return "not_observed"
}

// Recognize Pi's installed launcher and the bundled Node entrypoint without
// mistaking an arbitrary prompt fragment for a command. Unrecognised launchers
// are still caught when they actually have the native file descriptor open.
// These service entrypoints cannot load Pi sessions. Some same-UID system
// processes deliberately deny ptrace reads of cwd/fd; do not turn their
// permanent presence into a permanent unknown for every conversation.
func knownNonPiSystemProcess(raw []byte) bool {
	// GnuPG cannot load Pi sessions, but --homedir can put it inside a
	// workspace. Only the Pi census, not deletion, may tolerate its denied fds.
	return bytes.HasPrefix(raw, []byte("gpg-agent\x00")) || bytes.HasPrefix(raw, []byte("/usr/bin/gpg-agent\x00")) || knownNonWorkspaceSystemProcess(raw)
}

func knownNonWorkspaceSystemProcess(raw []byte) bool {
	args := bytes.SplitN(raw, []byte{0}, 2)
	if len(args) == 0 {
		return false
	}
	name := string(args[0])
	return name == "/usr/lib/systemd/systemd" || name == "(sd-pam)" || strings.HasPrefix(name, "sshd-session:") || strings.HasPrefix(name, "sshd: ") || name == "/usr/bin/ssh-agent"
}

func isPiCommand(raw []byte) bool {
	for _, arg := range bytes.Split(raw, []byte{0}) {
		name := filepath.Base(string(arg))
		if name == "pi" || name == "cli.js" && (bytes.Contains(arg, []byte("pi-coding-agent")) || bytes.Contains(arg, []byte("/pi/"))) {
			return true
		}
	}
	return false
}
