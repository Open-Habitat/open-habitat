//go:build linux

package host

import (
	"context"
	"crypto/rand"
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
	if err == nil && !runtimeSelectorLayout(prefix, old) {
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
	if _, err = os.Lstat(dest); err == nil {
		// Reobserve immutable contents, not merely a prior publication receipt.
		if err = runtimePayloadMatches(ctx, dest, r, []string{"core"}, owner); err != nil {
			return err
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	} else {
		_ = collectPayloads(prefix, map[string]bool{payloadsName(artifacts): true}, owner)
		// An unchanged payload is reverified, not extracted again. Otherwise
		// the archives are authenticated and preflighted before extraction,
		// and no selection changes until the payload is published and checked.
		payloads, _, err := r.ensurePayloads(ctx, artifacts, prefix, parent, open, owner, func() int64 { return 0 })
		if err != nil {
			return err
		}
		name := "generation-" + rand.Text()
		if err = parent.Mkdir(name, 0700); err != nil {
			return ErrReleaseStage
		}
		stage := prefix + "/staging/" + name
		defer os.RemoveAll(stage)
		if err = linkPayloads(stage, payloads); err != nil {
			return err
		}
		if err = syncTree(stage); err != nil {
			return err
		}
		if err = publishGeneration(stage, dest); err != nil {
			return err
		}
	}
	if err = ctx.Err(); err != nil {
		return err
	}
	want, err := generationRuntime(dest, "core")
	if err != nil {
		return err
	}
	return selectRuntime(prefix, want, old, owner, func() error {
		if old == "" {
			return publishLink(link, want)
		}
		return replaceUpgradeLink(link, old, want)
	}, func() error { return publishPiRuntime(prefix, dest, owner) })
}

// runtimeSelectorLayout says whether a core alias names a runtime this
// prefix published: a store entry, or a generation's own payload from before
// the store. Foreign layouts are refused rather than adopted.
func runtimeSelectorLayout(prefix, target string) bool {
	if rest, ok := strings.CutPrefix(target, prefix+"/payloads/"); ok {
		name, tail, _ := strings.Cut(rest, "/")
		return payloadsNameRE.MatchString(name) && tail == "core/runtime"
	}
	return strings.HasPrefix(target, prefix+"/generations/") && strings.HasSuffix(target, "/payloads/core/runtime")
}

// Publication helpers can fail after rename (directory fsync). Reobserve both
// outputs on any failure, and restore both, not just the alias. Filesystem
// failure during restoration is reported too; never claim an unchanged state.
// want is the runtime the alias is moved to.
func selectRuntime(prefix, want, old string, owner uint32, writeLink, writeSelector func() error) error {
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
		if have != want {
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

// runtimePayloadMatches rereads every payload a generation uses, in the store
// or (published before it) in the generation itself, against r.
func runtimePayloadMatches(ctx context.Context, gen string, r AuthenticatedRelease, profiles []string, owner uint32) error {
	_, err := runtimePayloadTimings(ctx, gen, r, profiles, owner, func() int64 { return 0 })
	return err
}

func runtimePayloadTimings(ctx context.Context, gen string, r AuthenticatedRelease, profiles []string, owner uint32, clock func() int64) ([]PayloadTiming, error) {
	artifacts, err := r.Select(profiles)
	if err != nil {
		return nil, err
	}
	timings := []PayloadTiming{}
	dir, err := generationPayloads(gen, artifacts)
	if errors.Is(err, os.ErrNotExist) {
		return nil, ErrReleaseArchive
	} else if err != nil {
		return nil, err
	}
	for _, a := range artifacts {
		if a.Closure == nil {
			return nil, ErrReleaseArchive
		}
		start := clock()
		if err = verifyPayloadTree(ctx, dir+"/"+a.Profile, a, r.manifest.Platform, owner, false); err != nil {
			return nil, err
		}
		timings = append(timings, PayloadTiming{Profile: a.Profile, Outcome: "verified", VerifyMS: clock() - start})
	}
	return timings, nil
}
