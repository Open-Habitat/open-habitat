//go:build linux

package daemon

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/maintainer/native-agent-host/internal/transport"
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

func RepoObserveHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return repoObserveHandler(cfg, trusted, cfg.Home, "/usr/bin/git", cloneCommand)
}

// RepoObserveHandlerWithFixtureGit is restricted to synthetic homes and programs.
func RepoObserveHandlerWithFixtureGit(cfg transport.Config, trusted func(*http.Request) bool, home, git string) http.Handler {
	return repoObserveHandler(cfg, trusted, home, git, cloneCommand)
}
func repoObserveHandler(cfg transport.Config, trusted func(*http.Request) bool, home, git string, run cloneRunner) http.Handler {
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
		state := observeCheckout(r.Context(), cfg, home, git, run, name)
		historyJSON(w, map[string]any{"schema_version": 1, "full_name": name, "state": state})
	})
}
func observeCheckout(parent context.Context, cfg transport.Config, home, git string, run cloneRunner, name string) string {
	unavailable := "unavailable"
	if cfg.UID != os.Geteuid() || !filepath.IsAbs(home) || filepath.Clean(home) != home || home == "/" {
		return unavailable
	}
	root, e := unix.Open("/", unix.O_PATH|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if e != nil {
		return unavailable
	}
	defer unix.Close(root)
	h, e := dir(unix.Openat2, root, strings.TrimPrefix(home, "/"), false)
	if e != nil {
		return unavailable
	}
	defer unix.Close(h)
	hs, e := stat(h)
	if e != nil || hs.Uid != uint32(cfg.UID) || hs.Mode&0022 != 0 {
		return unavailable
	}
	src, e := dir(unix.Openat2, h, "src", true)
	if errors.Is(e, unix.ENOENT) {
		return "absent"
	}
	if e != nil {
		return unavailable
	}
	defer unix.Close(src)
	ss, e := stat(src)
	if e != nil || ss.Uid != uint32(cfg.UID) || ss.Mode&0022 != 0 {
		return unavailable
	}
	dup, e := unix.Dup(src)
	if e != nil {
		return unavailable
	}
	f := os.NewFile(uintptr(dup), "src")
	entries, e := f.ReadDir(513)
	f.Close()
	if (e != nil && e != io.EOF) || len(entries) > 512 {
		return unavailable
	}
	target := strings.Split(name, "/")[1]
	matches := []string{}
	for _, entry := range entries {
		if strings.EqualFold(entry.Name(), target) {
			matches = append(matches, entry.Name())
		}
	}
	if len(matches) == 0 {
		if !cloneSourceStillNamed(home, ss) {
			return unavailable
		}
		return "absent"
	}
	if len(matches) != 1 || matches[0] != target {
		return "conflict"
	}
	child, e := dir(unix.Openat2, src, target, true)
	if e != nil {
		if errors.Is(e, unix.EACCES) || errors.Is(e, unix.EPERM) {
			return unavailable
		}
		return "conflict"
	}
	defer unix.Close(child)
	cs, e := stat(child)
	if e != nil || cs.Uid != uint32(cfg.UID) {
		return "conflict"
	}
	gd, e := dir(unix.Openat2, child, ".git", true)
	if e != nil {
		if errors.Is(e, unix.EACCES) || errors.Is(e, unix.EPERM) {
			return unavailable
		}
		return "conflict"
	}
	unix.Close(gd)
	ctx, cancel := context.WithTimeout(parent, 8*time.Second)
	defer cancel()
	// Git read commands do not acquire optional locks or write index metadata.
	read := func(args ...string) ([]byte, error) { return run(ctx, git, home, strconv.Itoa(child), args...) }
	top, e1 := read("-c", "core.fsmonitor=false", "rev-parse", "--is-inside-work-tree")
	remote, e2 := read("-c", "core.fsmonitor=false", "config", "--local", "--get-all", "remote.origin.url")
	named, e3 := dir(unix.Openat2, src, target, true)
	var now unix.Stat_t
	if e3 == nil {
		now, e3 = stat(named)
		unix.Close(named)
	}
	if ctx.Err() != nil || !cloneSourceStillNamed(home, ss) || e3 != nil || !same(cs, now) {
		return unavailable
	}
	if e1 != nil || e2 != nil || string(top) != "true\n" || string(remote) != "https://github.com/"+name+".git\n" {
		return "conflict"
	}
	return "confirmed"
}
