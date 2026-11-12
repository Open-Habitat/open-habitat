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
// path with its own no-symlink, no-magic-link rules and stays the judge.
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
	// Name the path that was looked for. Anything else (permissions, a
	// symlink, a special file) is left for the daemon's own open to refuse.
	if _, err := os.Lstat(abs); errors.Is(err, os.ErrNotExist) || errors.Is(err, unix.ENOTDIR) {
		return "", offerSourceNotFound(kind, abs)
	}
	return abs, nil
}

func offerSourceComponent(kind, dir string) error {
	st, err := os.Lstat(dir)
	switch {
	case errors.Is(err, os.ErrNotExist) || errors.Is(err, unix.ENOTDIR):
		return offerSourceNotFound(kind, dir)
	case err == nil && st.Mode()&os.ModeSymlink != 0:
		return &cliError{code: "unsafe_" + kind + "_source", message: fmt.Sprintf("--source passes through the symlink %s before \"..\"; symlinks in the path are refused; pass the real path", dir), exit: 1}
	}
	return nil
}

func offerSourceNotFound(kind, abs string) error {
	return &cliError{code: kind + "_source_not_found", message: fmt.Sprintf("no file or directory at %s; a relative --source is resolved against the current working directory", abs), exit: 1}
}

// offerNotFoundNamesPaths adds the absolute paths sent to the daemon when it
// still found no source (one vanished after the CLI looked, or a directory
// descendant is missing).
func offerNotFoundNamesPaths(err error, kind string, sources []string) error {
	var c *cliError
	if errors.As(err, &c) && c.code == kind+"_source_not_found" {
		return &cliError{code: c.code, message: "no file or directory found among: " + strings.Join(sources, ", "), exit: c.exit}
	}
	return err
}
