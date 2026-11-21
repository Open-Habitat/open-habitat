//go:build linux

package host

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"slices"
	"strings"
	"sync"

	"golang.org/x/sys/unix"
)

// Runtime payloads are content-addressed: the set of runtime archives a
// generation uses is extracted once into <prefix>/payloads/<payloadsName>,
// which holds one <profile>/ tree per archive exactly as a generation's own
// payloads/ directory did, and every generation whose authenticated manifest
// names the same archives links its payloads/ there. A generation is still
// named after its manifest, so the product binary, site and selectors stay
// per release; only the large unchanged runtime trees are shared, read-only,
// between releases. The manifest digest changes with every release even when
// the runtime does not, and extracting, fsyncing and attesting an identical
// tree again was most of an upgrade's duration.
//
// The entry is keyed by the whole set, not per archive, because payloads find
// each other by relative path: the integrations profile's Pi wrapper walks
// from its own physical location to ../core/runtime. A shared per-archive
// tree would have no single sibling to find.
//
// An entry's existence authorizes nothing. Before a generation refers to it,
// and again whenever that generation is checked, its trees are re-read and
// compared with the authenticated manifest that now names them
// (verifyPayloadTree). Selectors name the entry directly: the daemon refuses
// a Pi runtime reached through a symlink.

var payloadsNameRE = regexp.MustCompile(`^[0-9a-f]{64}$`)

// payloadsName is the store entry for exactly these artifacts: a digest over
// each profile and its authenticated archive digest, in profile order.
func payloadsName(artifacts []ReleaseArtifact) string {
	lines := []string{}
	for _, a := range artifacts {
		lines = append(lines, a.Profile+" "+a.SHA256+"\n")
	}
	slices.Sort(lines)
	sum := sha256.Sum256([]byte(strings.Join(lines, "")))
	return hex.EncodeToString(sum[:])
}

// payloadStore is the content store beside a generation's parent:
// <prefix>/generations/<id> uses <prefix>/payloads.
func payloadStore(gen string) string { return filepath.Dir(filepath.Dir(gen)) + "/payloads" }

// generationPayloads is the directory holding a generation's extracted
// payloads for artifacts. Generations published before the content store
// hold them themselves; later ones link to the store entry the authenticated
// archive digests name, and to nothing else.
func generationPayloads(gen string, artifacts []ReleaseArtifact) (string, error) {
	path := gen + "/payloads"
	st, e := os.Lstat(path)
	if e != nil {
		return "", e
	}
	switch {
	case st.Mode()&os.ModeSymlink != 0:
		target, e := os.Readlink(path)
		if e != nil {
			return "", e
		}
		if target != payloadStore(gen)+"/"+payloadsName(artifacts) {
			return "", ErrReleaseArchive
		}
		return target, nil
	case st.IsDir():
		return path, nil
	}
	return "", ErrReleaseArchive
}

// generationRuntime is the runtime directory a selector names for profile, or
// os.ErrNotExist when the generation ships no payload for it. It reads only
// the generation's layout; generationPayloadMatches binds the target to the
// authenticated archive digests and contents before any selector changes.
func generationRuntime(gen, profile string) (string, error) {
	path := gen + "/payloads"
	st, e := os.Lstat(path)
	if e != nil {
		return "", e
	}
	if st.Mode()&os.ModeSymlink != 0 {
		target, e := os.Readlink(path)
		if e != nil {
			return "", e
		}
		if filepath.Dir(target) != payloadStore(gen) || !payloadsNameRE.MatchString(filepath.Base(target)) {
			return "", ErrReleaseArchive
		}
		path = target
	} else if !st.IsDir() {
		return "", ErrReleaseArchive
	}
	runtime := path + "/" + profile + "/runtime"
	if st, e = os.Lstat(runtime); e != nil {
		return "", e
	}
	if !st.IsDir() {
		return "", os.ErrNotExist
	}
	return runtime, nil
}

// PayloadTiming is how long each part of making one runtime payload
// available took, in milliseconds. A reused payload is only verified; a
// published one is authenticated, preflighted and extracted, then made
// durable. Selection happens later, in the upgrade's activating phase.
type PayloadTiming struct {
	Profile string `json:"profile"`
	Outcome string `json:"outcome"` // reused | verified | published
	// Reused or verified: rereading the tree against the manifest.
	VerifyMS int64 `json:"verify_ms,omitempty"`
	// Published: all profiles are staged together, each phase over all of
	// them before the next, and made durable together, so these are reported
	// once, on the first profile.
	AuthenticateMS int64 `json:"authenticate_ms,omitempty"`
	PreflightMS    int64 `json:"preflight_ms,omitempty"`
	ExtractMS      int64 `json:"extract_ms,omitempty"`
	// Published: fsync of the trees and the publishing rename.
	SyncMS int64 `json:"sync_ms,omitempty"`
}

// ensurePayloads makes the artifacts' payloads available as one entry in
// prefix's content store and returns its path. An existing entry is verified
// against r before use. Otherwise all archives are staged under parent
// (prefix/staging), so every one is authenticated and preflighted before the
// first byte is extracted, then made durable and published with one rename.
// Nothing refers to a new entry yet.
func (r AuthenticatedRelease) ensurePayloads(ctx context.Context, artifacts []ReleaseArtifact, prefix string, parent *os.Root, open func(string) (io.ReadCloser, error), owner uint32, clock func() int64) (string, []PayloadTiming, error) {
	store := prefix + "/payloads"
	if e := ensurePolicyDir(store, owner); e != nil {
		return "", nil, e
	}
	if e := sameFilesystem(prefix+"/staging", store, owner); e != nil {
		return "", nil, e
	}
	for _, a := range artifacts {
		if a.Closure == nil {
			return "", nil, ErrReleaseArchive
		}
	}
	path := store + "/" + payloadsName(artifacts)
	timings := []PayloadTiming{}
	if _, e := os.Lstat(path); e == nil {
		for _, a := range artifacts {
			start := clock()
			if e := verifyPayloadTree(ctx, path+"/"+a.Profile, a, r.manifest.Platform, owner, true); e != nil {
				return "", nil, e
			}
			timings = append(timings, PayloadTiming{Profile: a.Profile, Outcome: "reused", VerifyMS: clock() - start})
		}
		return path, timings, nil
	} else if !errors.Is(e, os.ErrNotExist) {
		return "", nil, e
	}
	var phases stagePhases
	name, e := r.stageArtifacts(ctx, artifacts, parent, open, owner, clock, &phases)
	if e != nil {
		return "", nil, e
	}
	stage := prefix + "/staging/" + name
	defer os.RemoveAll(stage)
	start := clock()
	if e = os.Chmod(stage+"/payloads", 0755); e != nil {
		return "", nil, e
	}
	if e = syncTree(stage + "/payloads"); e != nil {
		return "", nil, e
	}
	if e = publishGeneration(stage+"/payloads", path); e != nil {
		return "", nil, e
	}
	// Extraction hashed and checked every byte it wrote against r.
	for i, a := range artifacts {
		t := PayloadTiming{Profile: a.Profile, Outcome: "published"}
		if i == 0 {
			t.AuthenticateMS, t.PreflightMS, t.ExtractMS, t.SyncMS = phases.authenticate, phases.preflight, phases.extract, clock()-start
		}
		timings = append(timings, t)
	}
	return path, timings, nil
}

func sameFilesystem(a, b string, owner uint32) error {
	var devices [2]uint64
	for i, path := range []string{a, b} {
		fd, e := openDir(path, owner, false)
		if e != nil {
			return e
		}
		var st unix.Stat_t
		e = unix.Fstat(fd, &st)
		unix.Close(fd)
		if e != nil {
			return e
		}
		devices[i] = st.Dev
	}
	if devices[0] != devices[1] {
		return ErrStagingCrossDevice
	}
	return nil
}

// linkPayloads links dir/payloads, in a new private generation stage, to the
// store entry; the link is published with the stage.
func linkPayloads(dir, payloads string) error { return os.Symlink(payloads, dir+"/payloads") }

// verifyPayloadTree re-reads a published payload and compares it with the
// authenticated closure that names it. It is the check that lets a tree
// extracted for one release be used by another, so it is not a receipt or a
// metadata comparison: every file's bytes are hashed again. With accept, when
// a tree is about to be used for a release it was not extracted for, it also
// repeats the extraction's acceptance rules that depend on content
// (entry-point architecture, npm lock, non-empty licenses) against the new
// manifest. Without accept it rechecks integrity only, as for a generation
// published earlier under the acceptance rules of the release that staged it:
// a predecessor must stay verifiable after those rules tighten. Either way it
// refuses anything extraction could never have produced: other file types,
// files outside the inventory, modes other than the manifest's (including
// setuid/setgid/sticky), extra links, other owners and file capabilities.
// Directories are checked for owner and mode; an extra empty directory is
// harmless and not refused. The walk never follows a symlink.
//
// Re-reading the tree costs a fraction of extraction (no decompression, no
// writes or fsync) and is spread over several readers.
func verifyPayloadTree(ctx context.Context, dir string, a ReleaseArtifact, platform string, owner uint32, accept bool) error {
	if a.Closure == nil {
		return ErrReleaseArchive
	}
	root, e := openDir(dir, owner, false)
	if e != nil {
		return e
	}
	defer unix.Close(root)
	var st unix.Stat_t
	if unix.Fstat(root, &st) != nil || st.Mode&07777 != 0755 {
		return ErrReleaseArchive
	}
	inventory := closureFileMap(a.Closure)
	licenses := map[string]bool{}
	for _, c := range a.Closure.Components {
		for _, l := range c.LicenseFiles {
			licenses[l] = true
		}
	}
	type job struct {
		rel      string
		dev, ino uint64
		want     RuntimeFile
	}
	jobs := []job{}
	// Extraction creates exactly the inventory's ancestor directories (a
	// closure tar holds only regular files); an extra empty one is harmless,
	// so allow those plus as many again before calling the walk unbounded.
	ancestors := map[string]bool{}
	for _, f := range a.Closure.Files {
		for d := filepath.Dir(f.Path); d != "."; d = filepath.Dir(d) {
			ancestors[d] = true
		}
	}
	directories := 0
	limit := 2*len(ancestors) + 1
	var walk func(fd int, prefix string) error
	walk = func(fd int, prefix string) error {
		if e := ctx.Err(); e != nil {
			return e
		}
		d := os.NewFile(uintptr(fd), prefix)
		defer d.Close()
		names, e := d.Readdirnames(-1)
		if e != nil {
			return ErrReleaseArchive
		}
		for _, name := range names {
			rel := prefix + name
			var st unix.Stat_t
			if unix.Fstatat(fd, name, &st, unix.AT_SYMLINK_NOFOLLOW) != nil || st.Uid != owner {
				return ErrReleaseArchive
			}
			switch st.Mode & unix.S_IFMT {
			case unix.S_IFDIR:
				directories++
				if directories > limit || st.Mode&07777 != 0755 {
					return ErrReleaseArchive
				}
				child, e := unix.Openat(fd, name, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
				if e != nil {
					return ErrReleaseArchive
				}
				if e := walk(child, rel+"/"); e != nil {
					return e
				}
			case unix.S_IFREG:
				want, ok := inventory[rel]
				if !ok || st.Nlink != 1 || st.Mode&07777 != uint32(want.Mode) || (accept && st.Size == 0 && licenses[rel]) {
					return ErrReleaseArchive
				}
				delete(inventory, rel)
				jobs = append(jobs, job{rel, uint64(st.Dev), st.Ino, want})
			default:
				return ErrReleaseArchive
			}
		}
		return nil
	}
	dup, e := unix.Dup(root)
	if e != nil {
		return e
	}
	// walk closes each directory it walks, including this duplicate.
	if e = walk(dup, ""); e != nil {
		return e
	}
	if len(inventory) != 0 {
		return ErrReleaseArchive
	}
	var lock []byte
	var mu sync.Mutex
	check := func(j job) error {
		fd, e := unix.Openat2(root, j.rel, &unix.OpenHow{Flags: unix.O_RDONLY | unix.O_NOFOLLOW | unix.O_NONBLOCK | unix.O_CLOEXEC, Resolve: unix.RESOLVE_BENEATH | unix.RESOLVE_NO_SYMLINKS | unix.RESOLVE_NO_MAGICLINKS | unix.RESOLVE_NO_XDEV})
		if e != nil {
			return ErrReleaseArchive
		}
		f := os.NewFile(uintptr(fd), j.rel)
		defer f.Close()
		var st unix.Stat_t
		if unix.Fstat(fd, &st) != nil || uint64(st.Dev) != j.dev || st.Ino != j.ino || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Uid != owner || st.Nlink != 1 || st.Mode&07777 != uint32(j.want.Mode) {
			return ErrReleaseArchive
		}
		// A capability would let an unprivileged caller gain privilege from
		// a file whose bytes and mode still match.
		if _, e := unix.Fgetxattr(fd, "security.capability", nil); e == nil || (e != unix.ENODATA && e != unix.ENOTSUP) {
			return ErrReleaseArchive
		}
		h := sha256.New()
		var w io.Writer = h
		head := &headBuffer{}
		if accept && j.want.Mode == 0755 && entryPoint(j.rel) {
			w = io.MultiWriter(h, head)
		}
		var content bytes.Buffer
		if accept && j.rel == "runtime/package-lock.json" {
			if st.Size > MaxReleaseManifestBytes {
				return ErrReleaseArchive
			}
			w = io.MultiWriter(w, &content)
		}
		if _, e = io.Copy(w, contextReader{ctx, f}); e != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return ErrReleaseArchive
		}
		if hex.EncodeToString(h.Sum(nil)) != j.want.SHA256 || !elfMatches(head.b, platform) {
			return ErrReleaseArchive
		}
		if accept && j.rel == "runtime/package-lock.json" {
			mu.Lock()
			lock = content.Bytes()
			mu.Unlock()
		}
		return nil
	}
	workers := min(max(runtime.GOMAXPROCS(0), 2), 8)
	next := make(chan job)
	errs := make(chan error, workers)
	var wg sync.WaitGroup
	for range workers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			var first error
			for j := range next {
				if first == nil {
					first = check(j)
				}
			}
			errs <- first
		}()
	}
	for _, j := range jobs {
		next <- j
	}
	close(next)
	wg.Wait()
	close(errs)
	for e := range errs {
		if e != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return e
		}
	}
	needsNPM := a.Profile == "core"
	for _, c := range a.Closure.Components {
		needsNPM = needsNPM || c.Kind == "npm"
	}
	if accept && needsNPM && !verifyNPMLock(lock, a.Closure, npmCPU(platform)) {
		return ErrReleaseArchive
	}
	return nil
}

// collectPayloads removes store entries no generation or selector under
// prefix refers to, keeping those in keep (the release being installed). It
// runs under the operation lock, so no publication is in flight. Generations
// themselves are still removed by the operator once unused; an entry goes only
// after the last generation that names it. An unreadable generation or
// selector stops collection without removing anything. An entry is renamed
// into staging before deletion, so an interrupted removal never leaves a
// partial tree under its content name.
func collectPayloads(prefix string, keep map[string]bool, owner uint32) error {
	store := prefix + "/payloads"
	entries, e := os.ReadDir(store)
	if errors.Is(e, os.ErrNotExist) {
		return nil
	} else if e != nil {
		return e
	}
	// A collection interrupted before its deletion finished left the tree
	// here, already out of the store and named by nothing.
	if leftovers, e := os.ReadDir(prefix + "/staging"); e == nil {
		for _, l := range leftovers {
			if strings.HasPrefix(l.Name(), "collect-") {
				if e := os.RemoveAll(prefix + "/staging/" + l.Name()); e != nil {
					return e
				}
			}
		}
	}
	refs := map[string]bool{}
	for name := range keep {
		refs[name] = true
	}
	refer := func(path string) {
		if rest, ok := strings.CutPrefix(path, store+"/"); ok {
			refs[strings.SplitN(rest, "/", 2)[0]] = true
		}
	}
	gens, e := os.ReadDir(prefix + "/generations")
	if e != nil && !errors.Is(e, os.ErrNotExist) {
		return e
	}
	for _, g := range gens {
		target, e := os.Readlink(prefix + "/generations/" + g.Name() + "/payloads")
		if e == nil {
			refer(target)
		} else if !errors.Is(e, os.ErrNotExist) && !errors.Is(e, unix.EINVAL) && !errors.Is(e, unix.ENOTDIR) {
			return e
		}
	}
	links := []string{prefix + "/core", prefix + "/core.next"}
	profiles, e := os.ReadDir(prefix + "/profiles")
	if e != nil && !errors.Is(e, os.ErrNotExist) {
		return e
	}
	for _, p := range profiles {
		links = append(links, prefix+"/profiles/"+p.Name())
	}
	for _, link := range links {
		target, e := os.Readlink(link)
		if e == nil {
			refer(target)
		} else if !errors.Is(e, os.ErrNotExist) {
			return e
		}
	}
	for _, name := range []string{"pi-runtime.json", "pi-runtime.json.next", "editor.json", "editor.json.next"} {
		b, e := os.ReadFile(prefix + "/" + name)
		if errors.Is(e, os.ErrNotExist) {
			continue
		} else if e != nil {
			return e
		}
		var selector map[string]string
		if json.Unmarshal(b, &selector) != nil {
			return ErrTrust
		}
		for _, path := range selector {
			refer(path)
		}
	}
	for _, entry := range entries {
		name := entry.Name()
		if refs[name] || !payloadsNameRE.MatchString(name) || !entry.IsDir() {
			continue
		}
		if e := ensurePolicyDir(prefix+"/staging", owner); e != nil {
			return e
		}
		doomed := prefix + "/staging/collect-" + rand.Text()
		if e := unix.Renameat2(unix.AT_FDCWD, store+"/"+name, unix.AT_FDCWD, doomed, unix.RENAME_NOREPLACE); e != nil {
			return e
		}
		if e := syncDirectory(store); e != nil {
			return e
		}
		if e := os.RemoveAll(doomed); e != nil {
			return e
		}
	}
	return nil
}
