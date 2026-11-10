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

	"github.com/open-habitat/open-habitat/internal/nativegitea"
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
//
// A Gitea or GitLab clone job writes its origin,
// https://<base>/<owner or group path>/<name>.git, and the account,
// credential.<origin>.username, into the new configuration before Git
// transfers anything; together they are what makes it one. A
// directory that holds less, because the process died before Git recorded
// them, is not recognised: it stays where it is as an existing destination,
// and nothing invents an owner for it or removes it.

var interruptedBranch = regexp.MustCompile(`^[A-Za-z0-9._/-]{1,200}$`)
var interruptedOrigin = regexp.MustCompile(`^https://github\.com/([A-Za-z0-9][A-Za-z0-9-]{0,38})/([A-Za-z0-9_.-]{1,100})\.git$`)

// cloneOrigin is what an interrupted clone's configuration says it was
// cloning.
type cloneOrigin struct {
	Owner string
	// URL is the origin exactly as written.
	URL string
	// Forge is set for a Gitea or GitLab clone job's directory, User to the
	// account its configuration names. Which of the two it is, and so the
	// project path a GitLab origin spells below its base, is known only from
	// the person's connections (cloneSourceFor); Owner is the segment before
	// the name, as a Gitea origin has it.
	Forge bool
	User  string
}

// githubOrigin is what a GitHub clone of fullName records.
func githubOrigin(fullName string) func(cloneOrigin) bool {
	return func(o cloneOrigin) bool { return !o.Forge && o.URL == "https://github.com/"+fullName+".git" }
}

// interruptedCloneOwner returns the origin when the open child directory
// named name looks like an interrupted clone. It reads only small files and
// runs no process, so workspace discovery can afford it.
func interruptedCloneOwner(op openFunction, child int, name string) (cloneOrigin, bool) {
	names, e := readDirNames(child, 2)
	if e != nil || len(names) != 1 || names[0] != ".git" {
		return cloneOrigin{}, false
	}
	gd, e := dir(op, child, ".git", true)
	if e != nil {
		return cloneOrigin{}, false
	}
	defer unix.Close(gd)
	head, state := readSmall(op, gd, "HEAD", 512)
	if state != "valid" || !bytes.HasPrefix(head, []byte("ref: refs/heads/")) || head[len(head)-1] != '\n' {
		return cloneOrigin{}, false
	}
	branch := string(head[len("ref: refs/heads/") : len(head)-1])
	if !interruptedBranch.MatchString(branch) || strings.Contains(branch, "..") {
		return cloneOrigin{}, false
	}
	var st unix.Stat_t
	for _, absent := range []string{"reftable", "index"} {
		if e := unix.Fstatat(gd, absent, &st, unix.AT_SYMLINK_NOFOLLOW); !errors.Is(e, unix.ENOENT) {
			return cloneOrigin{}, false
		}
	}
	packed, state := readSmall(op, gd, "packed-refs", 64<<10)
	if state == "valid" {
		for _, line := range bytes.Split(packed, []byte("\n")) {
			if len(line) > 0 && line[0] != '#' {
				return cloneOrigin{}, false
			}
		}
	} else if state != "missing" {
		return cloneOrigin{}, false
	}
	refs, e := dir(op, gd, "refs", true)
	if errors.Is(e, unix.ENOENT) {
		refs = -1
	} else if e != nil {
		return cloneOrigin{}, false
	}
	if refs >= 0 {
		budget := 256
		empty := noRefFiles(refs, 0, &budget)
		unix.Close(refs)
		if !empty {
			return cloneOrigin{}, false
		}
	}
	config, state := readSmall(op, gd, "config", 64<<10)
	if state != "valid" {
		return cloneOrigin{}, false
	}
	return originOf(config, name)
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

// originOf reads the one url of [remote "origin"] from a Git config file as
// `git clone` writes it, and for a forge origin the one username of
// [credential "<origin>"]. Several urls or usernames, includes or anything
// unexpected in those sections make the answer unknown.
func originOf(config []byte, name string) (cloneOrigin, bool) {
	section, urls, url := "", 0, ""
	users := map[string][]string{}
	scanner := bufio.NewScanner(bytes.NewReader(config))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "[") {
			if strings.HasPrefix(strings.ToLower(line), "[include") {
				return cloneOrigin{}, false
			}
			section = line
			continue
		}
		key, value, found := strings.Cut(line, "=")
		if !found {
			continue
		}
		key, value = strings.TrimSpace(strings.ToLower(key)), strings.TrimSpace(value)
		switch {
		case section == `[remote "origin"]` && key == "url":
			urls++
			url = value
		case strings.HasPrefix(section, `[credential "`) && strings.HasSuffix(section, `"]`) && key == "username":
			scope := section[len(`[credential "`) : len(section)-2]
			users[scope] = append(users[scope], value)
		}
	}
	if scanner.Err() != nil || urls != 1 {
		return cloneOrigin{}, false
	}
	if m := interruptedOrigin.FindStringSubmatch(url); m != nil {
		if m[2] != name {
			return cloneOrigin{}, false
		}
		return cloneOrigin{Owner: m[1], URL: url}, true
	}
	owner, ok := forgeOrigin(url, name)
	if !ok || len(users[url]) != 1 || !forgeUser.MatchString(users[url][0]) {
		return cloneOrigin{}, false
	}
	return cloneOrigin{Owner: owner, URL: url, Forge: true, User: users[url][0]}, true
}

// forgeUser is an account name a Gitea or GitLab clone job records.
var forgeUser = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,255}$`)

// forgeOrigin is the segment before the name of a canonical forge clone
// address, https://<base>/<...>/<owner>/<name>.git, as a Gitea or GitLab
// clone job derives it: everything before the name must be a canonical base
// with at least that one segment.
func forgeOrigin(url, name string) (string, bool) {
	prefix, ok := strings.CutSuffix(url, "/"+name+".git")
	i := strings.LastIndexByte(prefix, '/')
	if !ok || i < 0 {
		return "", false
	}
	base, owner := prefix[:i], prefix[i+1:]
	b, err := nativegitea.ParseBase(base)
	if err != nil || b.String() != base || !forgeUser.MatchString(owner) || owner == "." || owner == ".." {
		return "", false
	}
	return owner, true
}

// interruptedClone is the full recognition used before a clone is acted on:
// the cheap reading above, then Git itself agreeing that HEAD has no commit,
// no ref and the same origin (and, for Gitea, account), and no process of
// this user inside. expect says which origin the caller may act on. Callers
// hold cloneWriter or skip the running job's directory, which is never
// interrupted.
func interruptedClone(ctx context.Context, home, git string, run cloneRunner, uid int, child int, name string, expect func(cloneOrigin) bool) (int64, cloneOrigin, bool) {
	return interruptedCloneWithScan(ctx, home, git, run, uid, child, name, expect, settledProcessScan)
}

type cloneProcessScan func(string, string, int, map[int]bool) ([]workspaceProcess, []workspaceProcess, bool)

// The list may report a filesystem/Git-confirmed candidate even when process
// activity prevents proving it idle. Writes always use interruptedClone instead.
func interruptedCloneWithScan(ctx context.Context, home, git string, run cloneRunner, uid int, child int, name string, expect func(cloneOrigin) bool, scan cloneProcessScan) (int64, cloneOrigin, bool) {
	origin, ok := interruptedCloneOwner(unix.Openat2, child, name)
	if !ok || !expect(origin) {
		return 0, cloneOrigin{}, false
	}
	readCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	fd := strconv.Itoa(child)
	// The clone list runs these reads without cloneWriter, so a write's
	// strict scan below could otherwise find the list's Git inside the
	// directory and refuse an idle clone. The scan drains them first.
	read := func(args ...string) ([]byte, error) {
		gitInspectionScan.RLock()
		defer gitInspectionScan.RUnlock()
		return run(readCtx, git, home, fd, append([]string{"-c", "core.fsmonitor=false"}, args...)...)
	}
	_, e := read("rev-parse", "--verify", "-q", "HEAD^{commit}")
	var exit *nativeCommandExit
	if !errors.As(e, &exit) || exit.Code != 1 || readCtx.Err() != nil {
		return 0, cloneOrigin{}, false
	}
	remote, e := read("config", "--local", "--get-all", "remote.origin.url")
	if e != nil || string(remote) != origin.URL+"\n" {
		return 0, cloneOrigin{}, false
	}
	if origin.Forge {
		user, e := read("config", "--local", "--get-all", "credential."+origin.URL+".username")
		if e != nil || string(user) != origin.User+"\n" {
			return 0, cloneOrigin{}, false
		}
	}
	refs, e := read("for-each-ref", "--count=1", "--format=%(refname)")
	if e != nil || len(refs) != 0 {
		return 0, cloneOrigin{}, false
	}
	inside, unreadable, complete := scan(deletionProcRoot, filepath.Join(home, "src", name), uid, nil)
	if len(inside) > 0 || len(unreadable) > 0 || !complete {
		return 0, cloneOrigin{}, false
	}
	size, _ := treeSize(readCtx, child)
	return size, origin, true
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
