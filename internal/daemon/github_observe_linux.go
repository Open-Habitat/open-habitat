//go:build linux

package daemon

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

const RepoObservePath = "/api/v1/onboarding/github/checkout"

// observeName accepts only one canonical wire representation, with no aliases.
func observeName(r *http.Request, host string) (string, bool) {
	if r.Method != "GET" || r.URL.Path != RepoObservePath || r.URL.EscapedPath() != RepoObservePath || r.Host != host || r.ProtoMajor != 1 || r.ProtoMinor != 1 || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
		return "", false
	}
	q, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil || len(q) != 1 || len(q["full_name"]) != 1 {
		return "", false
	}
	name := q.Get("full_name")
	return name, validCloneName(name) && r.RequestURI == RepoObservePath+"?full_name="+url.QueryEscape(name)
}

// RepoObserveHandler reads the jobs only to say that one is writing the
// destination now; everything else comes from the filesystem and Git.
func RepoObserveHandler(cfg transport.Config, trusted func(*http.Request) bool, jobs *CloneJobs) http.Handler {
	return repoObserveHandler(cfg, trusted, cfg.Home, "/usr/bin/git", cloneCommand, jobs)
}

// RepoObserveHandlerWithFixtureGit is restricted to synthetic homes and programs.
func RepoObserveHandlerWithFixtureGit(cfg transport.Config, trusted func(*http.Request) bool, home, git string, jobs *CloneJobs) http.Handler {
	return repoObserveHandler(cfg, trusted, home, git, cloneCommand, jobs)
}
func repoObserveHandler(cfg transport.Config, trusted func(*http.Request) bool, home, git string, run cloneRunner, jobs *CloneJobs) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name, ok := observeName(r, "unix")
		if !ok {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		extendReply(w, 20*time.Second)
		if !cloneWriter.TryLock() {
			state := "unavailable"
			if jobs != nil && jobs.observeRunning(name) {
				state = "cloning"
			}
			historyJSON(w, map[string]any{"schema_version": 1, "full_name": name, "state": state})
			return
		}
		defer cloneWriter.Unlock()
		state, size := observeCheckout(r.Context(), cfg, home, git, run, name)
		reply := map[string]any{"schema_version": 1, "full_name": name, "state": state}
		if state == "interrupted" {
			reply["size_bytes"] = size
		}
		historyJSON(w, reply)
	})
}
func observeCheckout(parent context.Context, cfg transport.Config, home, git string, run cloneRunner, name string) (string, int64) {
	unavailable := "unavailable"
	if cfg.UID != os.Geteuid() || !filepath.IsAbs(home) || filepath.Clean(home) != home || home == "/" {
		return unavailable, 0
	}
	root, e := unix.Open("/", unix.O_PATH|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if e != nil {
		return unavailable, 0
	}
	defer unix.Close(root)
	h, e := dir(unix.Openat2, root, strings.TrimPrefix(home, "/"), false)
	if e != nil {
		return unavailable, 0
	}
	defer unix.Close(h)
	hs, e := stat(h)
	if e != nil || hs.Uid != uint32(cfg.UID) || hs.Mode&0022 != 0 {
		return unavailable, 0
	}
	src, e := dir(unix.Openat2, h, "src", false)
	if errors.Is(e, unix.ENOENT) {
		return "absent", 0
	}
	if e != nil {
		return unavailable, 0
	}
	defer unix.Close(src)
	ss, e := stat(src)
	if e != nil || ss.Uid != uint32(cfg.UID) || ss.Mode&0022 != 0 {
		return unavailable, 0
	}
	target := strings.Split(name, "/")[1]
	matches := []string{}
	e = eachSourceEntry(src, func(entry os.DirEntry) {
		if strings.EqualFold(entry.Name(), target) {
			matches = append(matches, entry.Name())
		}
	})
	if e != nil {
		return unavailable, 0
	}
	if len(matches) == 0 {
		if !cloneSourceStillNamed(home, ss) {
			return unavailable, 0
		}
		return "absent", 0
	}
	if len(matches) != 1 || matches[0] != target {
		return "conflict", 0
	}
	child, e := dir(unix.Openat2, src, target, true)
	if e != nil {
		if errors.Is(e, unix.EACCES) || errors.Is(e, unix.EPERM) {
			return unavailable, 0
		}
		return "conflict", 0
	}
	defer unix.Close(child)
	cs, e := stat(child)
	if e != nil || cs.Uid != uint32(cfg.UID) {
		return "conflict", 0
	}
	if size, ok := interruptedClone(parent, home, git, run, cfg.UID, child, target, name); ok {
		if !cloneSourceStillNamed(home, ss) {
			return unavailable, 0
		}
		return "interrupted", size
	}
	gd, e := dir(unix.Openat2, child, ".git", true)
	if e != nil {
		if errors.Is(e, unix.EACCES) || errors.Is(e, unix.EPERM) {
			return unavailable, 0
		}
		return "conflict", 0
	}
	unix.Close(gd)
	ctx, cancel := context.WithTimeout(parent, 8*time.Second)
	defer cancel()
	// Git read commands do not acquire optional locks or write index metadata.
	read := func(args ...string) ([]byte, error) { return run(ctx, git, home, strconv.Itoa(child), args...) }
	top, e1 := read("-c", "core.fsmonitor=false", "rev-parse", "--is-inside-work-tree")
	remote, e2 := read("-c", "core.fsmonitor=false", "config", "--local", "--get-all", "remote.origin.url")
	clean, e4 := read("-c", "core.fsmonitor=false", "status", "--porcelain")
	head, e5 := read("-c", "core.fsmonitor=false", "rev-parse", "--verify", "HEAD^{commit}")
	named, e3 := dir(unix.Openat2, src, target, true)
	var now unix.Stat_t
	if e3 == nil {
		now, e3 = stat(named)
		unix.Close(named)
	}
	if ctx.Err() != nil || !cloneSourceStillNamed(home, ss) || e3 != nil || !same(cs, now) {
		return unavailable, 0
	}
	if e1 != nil || e2 != nil || e4 != nil || e5 != nil || !validCloneCommit(head) || len(clean) != 0 || string(top) != "true\n" || string(remote) != "https://github.com/"+name+".git\n" {
		return "conflict", 0
	}
	return "confirmed", 0
}
