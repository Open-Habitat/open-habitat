//go:build linux

package cli

import (
	"errors"
	"fmt"
	"os"
	"path"
	"strings"
	"syscall"

	"golang.org/x/sys/unix"
)

// absoluteOfferSource makes an offer's --source mean what a path means in any
// shell command the agent runs: a relative one names a file below the CLI
// process's own working directory, not the conversation's workspace. The CLI
// runs as the person, so it may look; the daemon still opens the absolute
// path with its own no-symlink, no-magic-link rules and stays the judge of
// what exists and may be offered.
//
// kind is "file" or "view" and picks the refusal codes the daemon would use.
func absoluteOfferSource(kind, source string) (string, error) {
	abs := source
	if !path.IsAbs(source) {
		// The kernel's own name for the directory, without symlinks:
		// os.Getwd may return $PWD, a logical path whose symlinks the
		// daemon would refuse and against which ".." would mean a different
		// directory than it does to the kernel.
		cwd, err := syscall.Getwd()
		if err != nil || !path.IsAbs(cwd) {
			return "", &cliError{code: "working_directory_unavailable", message: "a relative --source is resolved against the current working directory, which cannot be named; pass an absolute --source", exit: 1}
		}
		abs = cwd
		pushed := 0 // components taken from source, not from cwd
		for _, part := range strings.Split(source, "/") {
			switch part {
			case "", ".":
				continue
			case "..":
				if pushed > 0 {
					// Lexical ".." over a symlink would name another
					// directory than the kernel's; the daemon never sees
					// the component, so judge it here and refuse.
					if err := offerSourceComponent(kind, abs); err != nil {
						return "", err
					}
					pushed--
				}
				// The physical cwd has no symlinks, so its parents are
				// exactly what the kernel would reach.
				abs = path.Dir(abs)
			default:
				abs = path.Join(abs, part)
				pushed++
			}
		}
	}
	if len(abs) > 1024 {
		return "", usage(fmt.Sprintf("--source resolves to %d bytes; at most 1024 bytes", len(abs)))
	}
	// A trailing "/" or "." demands a directory, as it does to the kernel;
	// the cleaned path no longer says so. Existence itself is left to the
	// daemon: an offer replayed with the same key must succeed after its
	// source is gone, and the daemon answers that before it opens anything.
	if base := path.Base(source); strings.HasSuffix(source, "/") || base == "." || base == ".." {
		if st, err := os.Lstat(abs); err == nil && !st.IsDir() && st.Mode()&os.ModeSymlink == 0 {
			return "", offerSourceNotFound(kind, abs+"/")
		}
	}
	return abs, nil
}

// offerSourceComponent judges a directory that a following ".." leaves:
// the kernel walks through it, so it must exist, be a directory and not be
// a symlink, or the lexical result would name a file the kernel would not.
func offerSourceComponent(kind, dir string) error {
	st, err := os.Lstat(dir)
	switch {
	case errors.Is(err, os.ErrNotExist) || errors.Is(err, unix.ENOTDIR):
		return offerSourceNotFound(kind, dir)
	case err != nil:
		return &cliError{code: "native_source_unavailable", message: fmt.Sprintf("--source passes through %s, which cannot be inspected as the person; pass a path without \"..\"", dir), exit: 1}
	case st.Mode()&os.ModeSymlink != 0:
		return &cliError{code: "unsafe_" + kind + "_source", message: fmt.Sprintf("--source passes through the symlink %s before \"..\"; symlinks in the path are refused; pass the real path", dir), exit: 1}
	case !st.IsDir():
		return offerSourceNotFound(kind, dir+"/")
	}
	return nil
}

func offerSourceNotFound(kind, abs string) error {
	return &cliError{code: kind + "_source_not_found", message: fmt.Sprintf("no directory at %s; a relative --source is resolved against the current working directory", abs), exit: 1}
}

// offerNotFoundNamesPaths names the absolute paths the daemon looked for
// when it found no source.
func offerNotFoundNamesPaths(err error, kind string, sources []string) error {
	var c *cliError
	if errors.As(err, &c) && c.code == kind+"_source_not_found" {
		return &cliError{code: c.code, message: "no file or directory found among: " + strings.Join(sources, ", ") + "; a relative --source is resolved against the current working directory", exit: c.exit}
	}
	return err
}
