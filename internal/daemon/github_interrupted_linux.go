//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

// An interrupted clone is recognised from the filesystem alone, so that it
// survives a daemon restart without a store: ~/src/<name> holds nothing but a
// .git directory whose origin is https://github.com/<owner>/<name>.git, which
// has no index and no ref at all, and whose HEAD names a branch. This is what
// `git clone` leaves before it writes its first ref and checks files out, so
// removing it can lose only an unfinished download. Anything the reader cannot
// establish (reftable, a detached HEAD, an unreadable file, a file beside
// .git) is not an interrupted clone: such a directory stays a workspace.

var interruptedBranch = regexp.MustCompile(`^[A-Za-z0-9._/-]{1,200}$`)
var interruptedOrigin = regexp.MustCompile(`^https://github\.com/([A-Za-z0-9][A-Za-z0-9-]{0,38})/([A-Za-z0-9_.-]{1,100})\.git$`)

// interruptedCloneOwner returns the GitHub owner when the open child
// directory named name looks like an interrupted clone. It reads only small
// files and runs no process, so workspace discovery can afford it.
func interruptedCloneOwner(op openFunction, child int, name string) (string, bool) {
	names, e := readDirNames(child, 2)
	if e != nil || len(names) != 1 || names[0] != ".git" {
		return "", false
	}
	gd, e := dir(op, child, ".git", true)
	if e != nil {
		return "", false
	}
	defer unix.Close(gd)
	head, state := readSmall(op, gd, "HEAD", 512)
	if state != "valid" || !bytes.HasPrefix(head, []byte("ref: refs/heads/")) || head[len(head)-1] != '\n' {
		return "", false
	}
	branch := string(head[len("ref: refs/heads/") : len(head)-1])
	if !interruptedBranch.MatchString(branch) || strings.Contains(branch, "..") {
		return "", false
	}
	var st unix.Stat_t
	for _, absent := range []string{"reftable", "index"} {
		if e := unix.Fstatat(gd, absent, &st, unix.AT_SYMLINK_NOFOLLOW); !errors.Is(e, unix.ENOENT) {
			return "", false
		}
	}
	packed, state := readSmall(op, gd, "packed-refs", 64<<10)
	if state == "valid" {
		for _, line := range bytes.Split(packed, []byte("\n")) {
			if len(line) > 0 && line[0] != '#' {
				return "", false
			}
		}
	} else if state != "missing" {
		return "", false
	}
	refs, e := dir(op, gd, "refs", true)
	if errors.Is(e, unix.ENOENT) {
		refs = -1
	} else if e != nil {
		return "", false
	}
	if refs >= 0 {
		budget := 256
		empty := noRefFiles(refs, 0, &budget)
		unix.Close(refs)
		if !empty {
			return "", false
		}
	}
	config, state := readSmall(op, gd, "config", 64<<10)
	if state != "valid" {
		return "", false
	}
	owner, ok := originOwner(config, name)
	return owner, ok
}

// noRefFiles is true when the refs tree holds only (nested) empty directories.
func noRefFiles(fd, depth int, budget *int) bool {
	if depth > 8 {
		return false
	}
	names, e := readDirNames(fd, 64)
	if e != nil {
		return false
	}
	for _, name := range names {
		if *budget--; *budget < 0 {
			return false
		}
		var st unix.Stat_t
		if unix.Fstatat(fd, name, &st, unix.AT_SYMLINK_NOFOLLOW) != nil || st.Mode&unix.S_IFMT != unix.S_IFDIR {
			return false
		}
		child, e := dir(unix.Openat2, fd, name, true)
		if e != nil {
			return false
		}
		ok := noRefFiles(child, depth+1, budget)
		unix.Close(child)
		if !ok {
			return false
		}
	}
	return true
}

// originOwner reads the one url of [remote "origin"] from a Git config file
// as `git clone` writes it. Several urls, includes or anything unexpected in
// that section make the answer unknown.
func originOwner(config []byte, name string) (string, bool) {
	inOrigin, urls, owner := false, 0, ""
	scanner := bufio.NewScanner(bytes.NewReader(config))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "[") {
			inOrigin = line == `[remote "origin"]`
			if strings.HasPrefix(strings.ToLower(line), "[include") {
				return "", false
			}
			continue
		}
		if !inOrigin {
			continue
		}
		key, value, found := strings.Cut(line, "=")
		if !found || strings.TrimSpace(strings.ToLower(key)) != "url" {
			continue
		}
		m := interruptedOrigin.FindStringSubmatch(strings.TrimSpace(value))
		if m == nil || m[2] != name {
			return "", false
		}
		urls++
		owner = m[1]
	}
	if scanner.Err() != nil || urls != 1 {
		return "", false
	}
	return owner, true
}

// interruptedClone is the full recognition used before a clone is acted on:
// the cheap reading above, then Git itself agreeing that HEAD has
// no commit, no ref and the canonical origin, and no process of this user
// inside. Callers hold cloneWriter or skip the running job's directory, which
// is never interrupted.
func interruptedClone(ctx context.Context, home, git string, run cloneRunner, uid int, child int, name, fullName string) (int64, bool) {
	return interruptedCloneWithScan(ctx, home, git, run, uid, child, name, fullName, settledProcessScan)
}

type cloneProcessScan func(string, string, int, map[int]bool) ([]workspaceProcess, []workspaceProcess, bool)

// The list may report a filesystem/Git-confirmed candidate even when process
// activity prevents proving it idle. Writes always use interruptedClone instead.
func interruptedCloneWithScan(ctx context.Context, home, git string, run cloneRunner, uid int, child int, name, fullName string, scan cloneProcessScan) (int64, bool) {
	owner, ok := interruptedCloneOwner(unix.Openat2, child, name)
	if !ok || owner+"/"+name != fullName {
		return 0, false
	}
	readCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	fd := strconv.Itoa(child)
	_, e := run(readCtx, git, home, fd, "-c", "core.fsmonitor=false", "rev-parse", "--verify", "-q", "HEAD^{commit}")
	var exit *nativeCommandExit
	if !errors.As(e, &exit) || exit.Code != 1 || readCtx.Err() != nil {
		return 0, false
	}
	remote, e := run(readCtx, git, home, fd, "-c", "core.fsmonitor=false", "config", "--local", "--get-all", "remote.origin.url")
	if e != nil || string(remote) != "https://github.com/"+fullName+".git\n" {
		return 0, false
	}
	refs, e := run(readCtx, git, home, fd, "-c", "core.fsmonitor=false", "for-each-ref", "--count=1", "--format=%(refname)")
	if e != nil || len(refs) != 0 {
		return 0, false
	}
	inside, unreadable, complete := scan(deletionProcRoot, filepath.Join(home, "src", name), uid, nil)
	if len(inside) > 0 || len(unreadable) > 0 || !complete {
		return 0, false
	}
	size, _ := treeSize(readCtx, child)
	return size, true
}

// removeCreated removes the directory src/name only while it is still the
// pinned inode the caller created or recognised. It never follows a symlink
// or enters another filesystem; what it cannot remove stays.
func removeCreated(ctx context.Context, src, child int, name string) bool {
	cs, e := stat(child)
	if e != nil {
		return false
	}
	var named unix.Stat_t
	if unix.Fstatat(src, name, &named, unix.AT_SYMLINK_NOFOLLOW) != nil || !same(cs, named) {
		return false
	}
	walkCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	if walkRemove(walkCtx, child, uint64(cs.Dev), 0) > 0 {
		return false
	}
	if unix.Fstatat(src, name, &named, unix.AT_SYMLINK_NOFOLLOW) != nil || !same(cs, named) {
		return false
	}
	if e := unix.Unlinkat(src, name, unix.AT_REMOVEDIR); e != nil {
		return false
	}
	_ = unix.Fsync(src)
	return true
}
