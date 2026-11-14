//go:build linux

package host

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"golang.org/x/sys/unix"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"slices"

	policy "github.com/open-habitat/open-habitat"
)

var ErrRuntimeStage = errors.New("runtime_archive_staging_failed")
var ErrRuntimePackages = errors.New("runtime_package_transition_failed")
var ErrRuntimePackageSolve = errors.New("runtime_package_solve_failed")
var ErrRuntimePackageInstall = errors.New("runtime_package_install_failed")

type productFile = ProductFile

func fileDigest(path string) (string, error) {
	f, e := os.Open(path)
	if e != nil {
		return "", e
	}
	defer f.Close()
	h := sha256.New()
	_, e = io.Copy(h, f)
	return hex.EncodeToString(h.Sum(nil)), e
}
func generationPayloadMatches(ctx context.Context, s Site, r AuthenticatedRelease) error {
	gen := generationPath(s)
	fd, e := openDir(gen, 0, false)
	if e != nil {
		return e
	}
	unix.Close(fd)
	if e = runtimePayloadMatches(ctx, gen, r, s.Profiles, 0); e != nil {
		return e
	}
	b, e := trustedBytes(gen+"/product.json", MaxReleaseManifestBytes)
	if e != nil {
		return e
	}
	var files []productFile
	if json.Unmarshal(b, &files) != nil || len(files) < 2 {
		return ErrReleaseArchive
	}
	if r.manifest.Upgrade != nil {
		want := map[string]ProductFile{}
		for _, f := range r.manifest.Upgrade.Product {
			want[f.Path] = f
		}
		if len(files) != len(want) {
			return ErrUpgradeTarget
		}
		for _, f := range files {
			if expected, ok := want[f.Path]; !ok || expected != f {
				return ErrUpgradeTarget
			}
			delete(want, f.Path)
		}
		if len(want) != 0 {
			return ErrUpgradeTarget
		}
	}
	for _, f := range files {
		if !fs.ValidPath(f.Path) {
			return ErrTrust
		}
		st, e := os.Lstat(gen + "/" + f.Path)
		if e != nil || !st.Mode().IsRegular() || uint32(st.Mode().Perm()) != f.Mode {
			return ErrTrust
		}
		sum, e := fileDigest(gen + "/" + f.Path)
		if e != nil || sum != f.SHA256 {
			return ErrReleaseArchive
		}
	}
	return nil
}
func generationMatches(ctx context.Context, s Site, r AuthenticatedRelease) error {
	gen := generationPath(s)
	if e := generationPayloadMatches(ctx, s, r); e != nil {
		return e
	}
	if target, e := os.Readlink("/opt/open-habitat/current"); e != nil || target != gen {
		return ErrReleaseTarget
	}
	if target, e := os.Readlink("/opt/open-habitat/core"); e != nil || target != gen+"/payloads/core/runtime" {
		return ErrReleaseTarget
	}
	for _, profile := range s.Profiles {
		if profile == "core" {
			continue
		}
		runtime := gen + "/payloads/" + profile + "/runtime"
		if st, e := os.Stat(runtime); e == nil && st.IsDir() {
			if target, e := os.Readlink("/opt/open-habitat/profiles/" + profile); e != nil || target != runtime {
				return ErrReleaseTarget
			}
		}
	}
	units, e := runtimeUserPolicies(s)
	if e != nil {
		return e
	}
	if !policiesMatch("/", units, 0) {
		return ErrReleaseTarget
	}
	return nil
}
func (n *nativeApply) stage(ctx context.Context) error { return n.stageGeneration(ctx, true) }

// Private staging/publication changes no selectors or packages during upgrade.
func (n *nativeApply) stageGeneration(ctx context.Context, activate bool) error {
	s := n.site
	r, e := loadRelease(s)
	if e != nil {
		return e
	}
	if _, e = os.Lstat(generationPath(s)); e == nil {
		if e = generationPayloadMatches(ctx, s, r); e != nil {
			return e
		}
		if activate {
			if e = installRuntimePackages(ctx, s, r, generationPath(s)); e != nil {
				return errors.Join(ErrRuntimePackages, e)
			}
			return finishGeneration(s)
		}
		return nil
	} else if !errors.Is(e, os.ErrNotExist) {
		return e
	}
	parent, e := openGenerationStage(generationStageParent, generationParent, 0)
	if e != nil {
		return e
	}
	defer parent.Close()
	source, e := os.OpenRoot(releaseDirectory)
	if e != nil {
		return e
	}
	defer source.Close()
	name, e := r.StageRelease(ctx, s.Profiles, parent, func(name string) (io.ReadCloser, error) { return source.Open(name) })
	if e != nil {
		return errors.Join(ErrRuntimeStage, e)
	}
	stage := generationStageParent + "/" + name
	// A new private stage is disposable; no account/broker bytes are held here.
	defer os.RemoveAll(stage)
	if activate {
		if e = installRuntimePackages(ctx, s, r, stage); e != nil {
			return errors.Join(ErrRuntimePackages, e)
		}
	}
	exe, sourceWeb, _, e := productInputs()
	if e != nil {
		return e
	}

	files := []productFile{}
	copyOne := func(source, dest, relative string, mode os.FileMode) error {
		if e := ctx.Err(); e != nil {
			return e
		}
		parent, e := openDir(filepath.Dir(source), 0, false)
		if e != nil {
			return e
		}
		fd, e := unix.Openat(parent, filepath.Base(source), unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
		unix.Close(parent)
		if e != nil {
			return e
		}
		in := os.NewFile(uintptr(fd), "product-input")
		var st unix.Stat_t
		if unix.Fstat(fd, &st) != nil || st.Uid != 0 || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Mode&0022 != 0 || st.Nlink != 1 {
			in.Close()
			return ErrTrust
		}
		defer in.Close()
		if e = os.MkdirAll(filepath.Dir(dest), 0755); e != nil {
			return e
		}
		out, e := os.OpenFile(dest, os.O_CREATE|os.O_EXCL|os.O_WRONLY, mode)
		if e != nil {
			return e
		}
		h := sha256.New()
		_, e = io.Copy(io.MultiWriter(out, h), in)
		if e == nil {
			e = out.Chmod(mode)
		}
		if e == nil {
			e = out.Sync()
		}
		ce := out.Close()
		if e != nil {
			return e
		}
		if ce != nil {
			return ce
		}
		files = append(files, productFile{relative, hex.EncodeToString(h.Sum(nil)), uint32(mode)})
		return nil
	}
	if e = copyOne(exe, stage+"/open-habitat", "open-habitat", 0755); e != nil {
		return e
	}
	e = filepath.WalkDir(sourceWeb, func(path string, d fs.DirEntry, e error) error {
		if e != nil {
			return e
		}
		if d.IsDir() {
			return nil
		}
		rel, e := filepath.Rel(sourceWeb, path)
		if e != nil {
			return e
		}
		return copyOne(path, stage+"/web/"+rel, "web/"+filepath.ToSlash(rel), 0644)
	})
	if e != nil {
		return e
	}
	b, _ := json.Marshal(files)
	if e = os.WriteFile(stage+"/product.json", b, 0644); e != nil {
		return e
	}
	ps, e := nativePreparePolicies(ctx, s)
	if e != nil {
		return e
	}
	unitBytes, _ := json.Marshal(append(ps, applyUnitPolicies(s)...))
	if e = os.WriteFile(stage+"/unit-policies.json", unitBytes, 0644); e != nil {
		return e
	}
	// Retain the authenticated predecessor for later explicit upgrade validation.
	siteBytes, _ := json.Marshal(s)
	for name, data := range map[string][]byte{"site.json": siteBytes} {
		if e = os.WriteFile(stage+"/"+name, data, 0600); e != nil {
			return e
		}
	}
	// Only the manifest is retained, and only the bytes the site pins: the
	// release directory may have changed since loadRelease authenticated it.
	manifest, e := trustedBytes(releaseDirectory+"/release.json", MaxReleaseManifestBytes)
	if e != nil {
		return e
	}
	if sum := sha256.Sum256(manifest); hex.EncodeToString(sum[:]) != s.Release.ManifestSHA256 {
		return ErrReleaseTarget
	}
	if e = os.WriteFile(stage+"/release.json", manifest, 0644); e != nil {
		return e
	}
	// Make only the authenticated immutable generation public, never its secret,
	// broker or staging parents. Fsync payload and directories before publication.
	if e = os.Chmod(stage, 0755); e != nil {
		return e
	}
	if e = os.Chmod(stage+"/payloads", 0755); e != nil {
		return e
	}
	if e = syncTree(stage); e != nil {
		return e
	}
	if e = publishGeneration(stage, generationPath(s)); e != nil {
		return e
	}
	if !activate {
		return generationPayloadMatches(ctx, s, r)
	}
	if e = finishGeneration(s); e != nil {
		return e
	}
	return generationMatches(ctx, s, r)
}

// A generation is staged beside its publish target, never under /var: /var,
// /opt and / are often separate filesystems, and the one atomic publication
// step is a rename, which cannot cross them.
const generationStageParent = "/opt/open-habitat/staging"

var ErrStagingCrossDevice = errors.New("generation_staging_cross_device: the generation stage and /opt/open-habitat/generations are on different filesystems; nothing was published")

// openGenerationStage returns the private (root 0700) staging parent after
// proving it shares a filesystem with the generations, before any archive
// work: a mount under /opt/open-habitat would otherwise fail only at the end.
func openGenerationStage(stageParent, genParent string, owner uint32) (*os.Root, error) {
	if e := ensurePolicyDir(genParent, owner); e != nil {
		return nil, e
	}
	if e := ensurePolicyDir(stageParent, owner); e != nil {
		return nil, e
	}
	if e := os.Chmod(stageParent, 0700); e != nil {
		return nil, e
	}
	var devices [2]uint64
	for i, path := range []string{stageParent, genParent} {
		fd, e := openDir(path, owner, false)
		if e != nil {
			return nil, e
		}
		var st unix.Stat_t
		e = unix.Fstat(fd, &st)
		unix.Close(fd)
		if e != nil {
			return nil, e
		}
		devices[i] = st.Dev
	}
	if devices[0] != devices[1] {
		return nil, ErrStagingCrossDevice
	}
	return os.OpenRoot(stageParent)
}

// publishGeneration makes a complete, synced stage visible under its final
// name in one rename. EXDEV is a layout fault with a typed cause, not an
// unavailable observation: nothing was published and the stage is intact.
func publishGeneration(stage, dest string) error {
	if e := unix.Renameat2(unix.AT_FDCWD, stage, unix.AT_FDCWD, dest, unix.RENAME_NOREPLACE); e != nil {
		if errors.Is(e, unix.EXDEV) {
			return errors.Join(ErrStagingCrossDevice, e)
		}
		return e
	}
	return syncDirectory(filepath.Dir(dest))
}
func finishGeneration(s Site) error {
	var e error
	if e = publishLink("/opt/open-habitat/current", generationPath(s)); e != nil {
		return e
	}
	if e = publishLink("/opt/open-habitat/core", generationPath(s)+"/payloads/core/runtime"); e != nil {
		return e
	}
	if e = ensurePolicyDir("/opt/open-habitat/profiles", 0); e != nil {
		return e
	}
	for _, profile := range s.Profiles {
		if profile == "core" {
			continue
		}
		runtime := generationPath(s) + "/payloads/" + profile + "/runtime"
		if st, e := os.Stat(runtime); e == nil && st.IsDir() {
			if e = publishLink("/opt/open-habitat/profiles/"+profile, runtime); e != nil {
				return e
			}
		}
	}
	if e = publishPiRuntime("/opt/open-habitat", generationPath(s), 0); e != nil {
		return e
	}
	if e = installPolicy("/", policyFile{"/opt/open-habitat/site-origin.json", siteFactsFile(s)}, 0); e != nil {
		return e
	}
	if slices.Contains(s.Profiles, "editor") {
		b, _ := json.Marshal(map[string]string{"code_server": generationPath(s) + "/payloads/editor/runtime/bin/code-server"})
		if e = installPolicy("/", policyFile{"/opt/open-habitat/editor.json", string(b)}, 0); e != nil {
			return e
		}
	}
	// After the profile link, so the published tool paths already resolve.
	if e = publishIntegrationTools(); e != nil {
		return e
	}
	units, e := runtimeUserPolicies(s)
	if e != nil {
		return e
	}
	for _, unit := range units {
		if e = installPolicy("/", unit, 0); e != nil {
			return e
		}
	}
	if e = installPolicy("/", needrestartOverride, 0); e != nil {
		return e
	}
	return publishHeadlessShellSandbox()
}

func publishPiRuntime(prefix, generation string, owner uint32) error {
	runtime := generation + "/payloads/core/runtime"
	selector := map[string]string{"node": runtime + "/bin/node", "entry": runtime + "/node_modules/@earendil-works/pi-coding-agent/dist/index.js", "manifest": runtime + "/node_modules/@earendil-works/pi-coding-agent/package.json"}
	b, _ := json.Marshal(selector)
	return installPolicy("/", policyFile{prefix + "/pi-runtime.json", string(b)}, owner)
}

// needrestartOverride keeps an OS library update from restarting the
// product's services: Ubuntu's unattended upgrades run needrestart, which
// would otherwise restart every person's daemon and end their running turns.
// The file's own comments say why each unit is safe to leave running. It is
// installed even where needrestart is absent, so a later install honours it,
// and needrestart reads only *.conf, never the unpublished .next stage.
var needrestartOverride = policyFile{"/etc/needrestart/conf.d/open-habitat.conf", policy.NeedrestartOverride}

func needrestartOverrideMatches() bool {
	return policiesMatch("/", []policyFile{needrestartOverride}, 0)
}

// headlessShellAppArmor lets the core runtime's headless Chromium start its
// sandbox, which Ubuntu 24.04 otherwise denies; the page reader refuses to run
// Chromium without it. The profile is loaded now as well as at boot. A kernel
// without AppArmor has no such restriction, so there is nothing to load; a host
// whose AppArmor tools were removed gets no page reading, not a failed apply.
var headlessShellAppArmor = policyFile{"/etc/apparmor.d/open-habitat-headless-shell", policy.HeadlessShellAppArmor}

const apparmorParser = "/usr/sbin/apparmor_parser"

func publishHeadlessShellSandbox() error {
	if e := installPolicy("/", headlessShellAppArmor, 0); e != nil {
		return e
	}
	if _, e := os.Stat("/sys/kernel/security/apparmor/profiles"); e != nil {
		return nil
	}
	if _, e := os.Stat(apparmorParser); e != nil {
		return nil
	}
	_, e := nativeCommand(context.Background(), apparmorParser, "--replace", "--write-cache", headlessShellAppArmor.Path)
	return e
}

// The profile's authenticated user unit is made available, not started as root
// or enabled for unrelated local accounts. Mapped users own its invocation.
func runtimeUserPolicies(s Site) ([]policyFile, error) {
	if !slices.Contains(s.Profiles, "containers") {
		return nil, nil
	}
	b, e := trustedBytes(generationPath(s)+"/payloads/containers/runtime/systemd/user/open-habitat-containers.service", MaxSiteBytes)
	if e != nil {
		return nil, e
	}
	return []policyFile{{"/usr/lib/systemd/user/open-habitat-containers.service", string(b)}}, nil
}
func publishLink(path, target string) error {
	if old, e := os.Readlink(path); e == nil {
		if old == target {
			return nil
		}
		return ErrReleaseTarget
	} else if _, e = os.Lstat(path); !errors.Is(e, os.ErrNotExist) {
		return ErrTrust
	}
	if e := os.Symlink(target, path+".next"); e != nil {
		if old, e := os.Readlink(path + ".next"); e != nil || old != target {
			return ErrRecovery
		}
	}
	if e := os.Rename(path+".next", path); e != nil {
		return e
	}
	return syncDirectory(filepath.Dir(path))
}
func syncDirectory(path string) error {
	d, e := os.Open(path)
	if e != nil {
		return e
	}
	defer d.Close()
	return d.Sync()
}
func syncTree(root string) error {
	return filepath.WalkDir(root, func(path string, d fs.DirEntry, e error) error {
		if e != nil {
			return e
		}
		if d.IsDir() {
			if e := os.Chmod(path, 0755); e != nil {
				return e
			}
			return syncDirectory(path)
		}
		if !d.Type().IsRegular() {
			return ErrTrust
		}
		f, e := os.Open(path)
		if e != nil {
			return e
		}
		e = f.Sync()
		f.Close()
		return e
	})
}
func installRuntimePackages(ctx context.Context, s Site, r AuthenticatedRelease, stage string) error {
	return runtimePackageTransition(ctx, s, r, stage, true)
}

// Simulation is read-only. The initial approval includes the package database;
// recovery reobserves and converges the same authenticated minimum requirements,
// not the old database (a partial apt transaction necessarily changes it).
// Apt retains its own lock and independently refuses removals, downgrades and
// held-package changes.
func runtimePackageTransition(ctx context.Context, s Site, r AuthenticatedRelease, stage string, install bool) error {
	b, e := queryRuntimePackages(ctx)
	if e != nil {
		return e
	}
	observed, e := parseRuntimePackages(b)
	if e != nil {
		return e
	}
	return transitionUbuntuPackages(ctx, s.Profiles, r, observed, install, nativeCommandTimeout)
}

// siteFactsFile is the public site file a person's daemon reads: the origin
// lets their agent link them to this site, and views says whether a view
// offer can show them anything. It is display data, never identity, so every
// user may read it.
func siteFactsFile(s Site) string {
	b, _ := json.Marshal(map[string]any{"origin": s.Gateway.Origin, "views": s.Views != nil})
	return string(b)
}
