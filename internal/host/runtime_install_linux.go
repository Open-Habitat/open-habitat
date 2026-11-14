//go:build linux

package host

import (
	"context"
	"errors"
	"golang.org/x/sys/unix"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// InstallRuntime publishes only core runtime payloads and their Pi selection.
// It does not install Ubuntu packages, product binaries, units or site policy.
// The operator must supply a qualified core closure and installed prerequisites.
func InstallRuntime(ctx context.Context, manifest []byte, target Release, prefix string, open func(string) (io.ReadCloser, error)) error {
	if os.Geteuid() != 0 {
		return ErrTrust
	}
	if !filepath.IsAbs(prefix) || filepath.Clean(prefix) != prefix || prefix == "/" {
		return ErrTrust
	}
	lock, err := OpenOperationLock(ctx)
	if err != nil {
		return err
	}
	defer lock.Close()
	if err = runtimeInstallJournalClear(lock); err != nil {
		return err
	}
	r, err := AuthenticateRelease(manifest, target)
	if err != nil {
		return err
	}
	if err = r.RequireCoreRuntime(); err != nil {
		return err
	}
	if err = r.requireRuntimePackages(ctx, []string{"core"}, queryRuntimePackages); err != nil {
		return err
	}
	return installRuntime(ctx, r, prefix, open, 0)
}

func installRuntime(ctx context.Context, r AuthenticatedRelease, prefix string, open func(string) (io.ReadCloser, error), owner uint32) error {
	// A manually installed product may have current too. Only a host-owned
	// generation (or its operation journal) requires host upgrade's gates.
	if target, err := os.Readlink(prefix + "/current"); err == nil {
		if filepath.Dir(target) == prefix+"/generations" {
			return ErrReleaseTarget
		}
	} else if !errors.Is(err, os.ErrNotExist) && !errors.Is(err, unix.EINVAL) {
		return ErrTrust
	}
	artifacts, err := r.Select([]string{"core"})
	if err != nil {
		return err
	}
	for _, a := range artifacts {
		if a.Closure == nil {
			return ErrReleaseArchive
		}
	}
	// This command deliberately owns no optional-profile selectors.
	if len(artifacts) != 1 {
		return ErrReleaseProfile
	}
	if err := ensurePolicyDir(prefix, owner); err != nil {
		return err
	}
	// A separate name cannot collide with host apply's complete generation.
	dest := prefix + "/generations/runtime-" + r.digest
	link := prefix + "/core"
	old, err := os.Readlink(link)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return ErrTrust
	}
	if err == nil && (!strings.HasPrefix(old, prefix+"/generations/") || !strings.HasSuffix(old, "/payloads/core/runtime")) {
		return ErrReleaseTarget
	}
	if _, err := policyBytes("/", policyFile{Path: prefix + "/pi-runtime.json"}, owner); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	parent, err := openGenerationStage(prefix+"/staging", prefix+"/generations", owner)
	if err != nil {
		return err
	}
	defer parent.Close()
	// Even a retry authenticates the supplied archives. No selection is changed
	// until the complete closure has been staged and checked.
	name, err := r.stageRelease(ctx, []string{"core"}, parent, open, owner)
	if err != nil {
		return err
	}
	stage := prefix + "/staging/" + name
	defer os.RemoveAll(stage)
	if err = syncTree(stage); err != nil {
		return err
	}
	if _, err = os.Lstat(dest); errors.Is(err, os.ErrNotExist) {
		if err = publishGeneration(stage, dest); err != nil {
			return err
		}
	} else if err != nil {
		return err
	} else {
		// Reobserve immutable contents, not merely a prior publication receipt.
		if err = runtimePayloadMatches(ctx, dest, r, []string{"core"}, owner); err != nil {
			return err
		}
	}
	if err = ctx.Err(); err != nil {
		return err
	}
	return selectRuntime(prefix, dest, old, owner, func() error {
		want := dest + "/payloads/core/runtime"
		if old == "" {
			return publishLink(link, want)
		}
		return replaceUpgradeLink(link, old, want)
	}, func() error { return publishPiRuntime(prefix, dest, owner) })
}

// Publication helpers can fail after rename (directory fsync). Reobserve both
// outputs on any failure, and restore both, not just the alias. Filesystem
// failure during restoration is reported too; never claim an unchanged state.
func selectRuntime(prefix, dest, old string, owner uint32, writeLink, writeSelector func() error) error {
	selector := prefix + "/pi-runtime.json"
	before, err := policyBytes("/", policyFile{Path: selector}, owner)
	absent := errors.Is(err, os.ErrNotExist)
	if err != nil && !absent {
		return err
	}
	// replaceAtMode restores exactly these policy modes. Refuse any other
	// predecessor before publication rather than discovering it in recovery.
	if !absent && before.Mode != 0600 && before.Mode != 0644 {
		return ErrTrust
	}
	err = writeLink()
	if err == nil {
		err = writeSelector()
	}
	if err == nil {
		return nil
	}
	var recovery error
	after, readErr := policyBytes("/", policyFile{Path: selector}, owner)
	if readErr == nil && (absent || after != before) {
		if absent {
			recovery = os.Remove(selector)
		} else {
			fd, e := openDir(prefix, owner, false)
			if e == nil {
				e = replaceAtMode(fd, "pi-runtime.json", []byte(before.Content), os.FileMode(before.Mode))
				unix.Close(fd)
			}
			recovery = e
		}
	} else if readErr != nil && !errors.Is(readErr, os.ErrNotExist) {
		recovery = readErr
	}
	link := prefix + "/core"
	if have, e := os.Readlink(link); e == nil && have != old {
		if have != dest+"/payloads/core/runtime" {
			recovery = errors.Join(recovery, ErrRecovery)
		} else if old == "" {
			recovery = errors.Join(recovery, os.Remove(link))
		} else {
			recovery = errors.Join(recovery, replaceUpgradeLink(link, have, old))
		}
	} else if e != nil && !errors.Is(e, os.ErrNotExist) {
		recovery = errors.Join(recovery, e)
	}
	recovery = errors.Join(recovery, syncDirectory(prefix))
	if recovery != nil {
		return errors.Join(err, ErrRecovery, recovery)
	}
	return err
}

func runtimeInstallJournalClear(lock *Lock) error {
	for _, name := range []string{"active.json", "active.json.next", "installation.json", "installation.json.next"} {
		var st unix.Stat_t
		if err := unix.Fstatat(lock.fd, name, &st, unix.AT_SYMLINK_NOFOLLOW); err != unix.ENOENT {
			return ErrReleaseTarget
		}
	}
	return nil
}

func runtimePayloadMatches(ctx context.Context, gen string, r AuthenticatedRelease, profiles []string, owner uint32) error {
	artifacts, err := r.Select(profiles)
	if err != nil {
		return err
	}
	for _, a := range artifacts {
		if a.Closure == nil {
			return ErrReleaseArchive
		}
		for _, f := range a.Closure.Files {
			if err = ctx.Err(); err != nil {
				return err
			}
			path := gen + "/payloads/" + a.Profile + "/" + f.Path
			fd, err := openDir(filepath.Dir(path), owner, false)
			if err != nil {
				return err
			}
			var st unix.Stat_t
			err = unix.Fstatat(fd, filepath.Base(path), &st, unix.AT_SYMLINK_NOFOLLOW)
			unix.Close(fd)
			if err != nil || st.Uid != owner || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Nlink != 1 || st.Mode&0777 != uint32(f.Mode) {
				return ErrReleaseArchive
			}
			sum, err := fileDigest(path)
			if err != nil || sum != f.SHA256 {
				return ErrReleaseArchive
			}
		}
	}
	return nil
}
