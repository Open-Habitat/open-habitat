//go:build linux

package host

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/open-habitat/open-habitat/internal/bootguard"
	"github.com/open-habitat/open-habitat/internal/provision"
	"golang.org/x/sys/unix"
)

const releaseDirectory = "/var/lib/open-habitat/release"
const generationParent = "/opt/open-habitat/generations"
const immutableFile = "/var/lib/open-habitat/host/installation.json"
const maintenanceFile = "/etc/open-habitat/maintenance"

var ErrNativeApply = errors.New("host_action_failed: fixed native installation action failed; inspect operation and confirmed entry closure before retry")

func nativeCommand(ctx context.Context, path string, args ...string) ([]byte, error) {
	return nativeCommandTimeout(ctx, 5*time.Minute, path, args...)
}

func nativeCommandTimeout(ctx context.Context, budget time.Duration, path string, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, budget)
	defer cancel()
	c := exec.CommandContext(ctx, path, args...)
	c.Dir = "/"
	c.Env = []string{"PATH=/usr/sbin:/usr/bin:/sbin:/bin", "HOME=/root", "LANG=C", "LC_ALL=C", "DEBIAN_FRONTEND=noninteractive", "NEEDRESTART_MODE=l", "TMPDIR=/var/tmp"}
	c.WaitDelay = time.Second
	b := &packageOutput{}
	c.Stdout = b
	c.Stderr = io.Discard
	var diagnostic aptStderr
	if path == "/usr/bin/apt-get" {
		c.Stderr = &diagnostic
	}
	if e := c.Run(); e != nil {
		cause := ErrNativeApply
		if ctx.Err() != nil {
			cause = ctx.Err()
		}
		if path == "/usr/bin/apt-get" {
			return nil, diagnostic.failure(cause)
		}
		return nil, cause
	}
	return b.data.Bytes(), nil
}
func trustedBytes(path string, max int64) ([]byte, error) {
	fd, e := openDir(filepath.Dir(path), 0, false)
	if e != nil {
		return nil, e
	}
	defer unix.Close(fd)
	f, e := unix.Openat(fd, filepath.Base(path), unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if e != nil {
		return nil, e
	}
	file := os.NewFile(uintptr(f), "input")
	defer file.Close()
	var st unix.Stat_t
	if unix.Fstat(f, &st) != nil || st.Uid != 0 || st.Mode&0022 != 0 || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Nlink != 1 || st.Size < 1 || st.Size > max {
		return nil, ErrTrust
	}
	b, e := io.ReadAll(io.LimitReader(file, max+1))
	if int64(len(b)) > max {
		return nil, ErrTrust
	}
	return b, e
}
func installedImmutable() (Immutable, bool, error) {
	b, e := trustedBytes(immutableFile, MaxSiteBytes)
	if errors.Is(e, os.ErrNotExist) {
		return Immutable{}, false, nil
	}
	var im Immutable
	if e != nil || strictJSON(b) != nil || json.Unmarshal(b, &im) != nil {
		return im, false, ErrTrust
	}
	return im, true, nil
}

// authenticateReleaseFile authenticates dir/release.json by the site's pin
// alone; nothing else in the directory or on the host is consulted.
func authenticateReleaseFile(dir string, target Release) (AuthenticatedRelease, error) {
	b, e := trustedBytes(dir+"/release.json", MaxReleaseManifestBytes)
	if e != nil {
		return AuthenticatedRelease{}, e
	}
	return authenticateHostRelease(b, target)
}
func loadRelease(s Site) (AuthenticatedRelease, error) {
	r, e := authenticateReleaseFile(releaseDirectory, s.Release)
	if e != nil {
		return r, e
	}
	if e = r.RequireIntegrationTools(); e != nil {
		return r, e
	}
	if e = r.RequireCoreRuntime(); e != nil {
		return r, e
	}
	_, e = r.Select(s.Profiles)
	return r, e
}
func generationPath(s Site) string { return generationParent + "/" + s.Release.ManifestSHA256 }
func inputBinding(ctx context.Context, path string) (string, error) {
	exe, _, _, e := productInputs()
	if e != nil {
		return "", e
	}
	product, e := trustedFileDigest(exe)
	if e != nil {
		return "", e
	}
	return inputBindingProduct(ctx, path, product)
}

func inputBindingProduct(ctx context.Context, path, product string) (string, error) {
	s, e := LoadSite(path)
	if e != nil {
		return "", e
	}
	refs := map[string]fileIdentity{}
	for _, ref := range protectedReferences(s) {
		id, e := observeReference(ref.path, 0)
		if e != nil {
			return "", e
		}
		refs[ref.code] = id
	}
	b, _ := json.Marshal(struct {
		Site    Site
		Refs    map[string]fileIdentity
		Product string
	}{s, refs, product})
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:]), ctx.Err()
}

// Pool emptiness is observed through NSS, not just /etc/passwd. Once broker
// state exists, its own committed native identity verifier owns mapped users.
func observePool(ctx context.Context, s Site, fresh bool) (string, error) {
	var records []string
	for _, db := range []string{"passwd", "group"} {
		b, e := nativeCommand(ctx, "/usr/bin/getent", db)
		if e != nil {
			return "", e
		}
		if e = gatewayNSSSafe(s, fresh, db, b); e != nil {
			return "", e
		}
		for _, line := range strings.Split(strings.TrimSpace(string(b)), "\n") {
			f := strings.Split(line, ":")
			if len(f) < 4 {
				return "", ErrTrust
			}
			id, e := strconv.ParseUint(f[2], 10, 32)
			if e != nil {
				return "", ErrTrust
			}
			records = append(records, db+":"+line)
			if fresh && db == "passwd" {
				gid, e := strconv.ParseUint(f[3], 10, 32)
				if e != nil || gid >= uint64(s.Identities.UIDMin) && gid <= uint64(s.Identities.UIDMax) {
					return "", ErrImmutable
				}
			}
			if fresh && id >= uint64(s.Identities.UIDMin) && id <= uint64(s.Identities.UIDMax) {
				return "", ErrImmutable
			}
			if id == uint64(s.Gateway.UID) && db == "passwd" && f[0] != "open-habitat-gateway" || id == uint64(s.Gateway.GID) && db == "group" && f[0] != "open-habitat-gateway" {
				return "", ErrImmutable
			}
			if f[0] == "open-habitat-gateway" && ((db == "passwd" && (id != uint64(s.Gateway.UID) || f[3] != uintString(uint64(s.Gateway.GID)))) || (db == "group" && id != uint64(s.Gateway.GID))) {
				return "", ErrImmutable
			}
		}
	}
	if fresh {
		entries, e := os.ReadDir("/home")
		if e != nil {
			return "", e
		}
		for _, entry := range entries {
			if entry.Name() == "lost+found" {
				continue
			}
			st, e := entry.Info()
			if e != nil {
				return "", e
			}
			u, ok := st.Sys().(*syscall.Stat_t)
			if !ok {
				return "", ErrTrust
			}
			if (u.Uid >= s.Identities.UIDMin && u.Uid <= s.Identities.UIDMax) || (u.Gid >= s.Identities.UIDMin && u.Gid <= s.Identities.UIDMax) {
				return "", ErrImmutable
			}
		}
	}
	slices.Sort(records)
	h := sha256.Sum256([]byte(strings.Join(records, "\n")))
	return hex.EncodeToString(h[:]), nil
}
func brokerAbsent() bool {
	_, e := os.Lstat("/var/lib/open-habitat/broker")
	return errors.Is(e, os.ErrNotExist)
}
func nativeInspection(ctx context.Context, s Site, r *Inspection) {
	set := func(code, status, reason string) {
		for i, c := range r.Checks {
			if c.Code == code {
				r.Checks[i] = Check{code, status, reason}
				return
			}
		}
		r.Checks = append(r.Checks, Check{code, status, reason})
	}
	// Apply and upgrade rewrite the tools section after the generation switch;
	// refuse an unusable operator file before any service stops.
	if _, e := integrationsPolicy(); e != nil {
		set("installation.integrations_config", "fail", "integrations_config_invalid")
	}
	if _, _, id, e := productInputs(); e != nil {
		set("installation.product", "fail", "unsafe_product_input")
	} else {
		set("installation.product", "pass", "trusted_product_input")
		b, _ := json.Marshal(id)
		h := sha256.Sum256(b)
		r.Inputs["product_observation"] = hex.EncodeToString(h[:])
	}
	if e := gatewayAncestorSafe("/etc/open-habitat", 0); e != nil {
		set("installation.parents", "fail", "gateway_parent_requires_root_0711_or_0755_no_acl")
	} else if e := secretParentSafe("/etc/open-habitat/gateway", 0); e != nil {
		set("installation.parents", "fail", "unsafe_gateway_secret_parent")
	}
	im, exists, e := installedImmutable()
	if e != nil {
		set("installation.identity", "fail", "unsafe_installation_policy")
	} else if exists && im != s.Immutable() {
		set("installation.identity", "fail", "immutable_identity_changed")
	} else {
		set("installation.identity", "pass", "immutable_policy_observed")
	}
	policies, policyErr := nativePreparePolicies(ctx, s)
	if policyErr == nil && policiesMatch("/", policies, 0) && sessionPolicyReady(ctx) == nil {
		set("storage.boot_policy", "pass", "prepared_boot_policy_observed")
	}
	// Check the durable preparation proof (EDQUOT under user quotas) as well
	// as today's effective policies. An
	// operation phase or root-written ready bit is not preparation evidence.
	if !preparationExists(s) {
		set("storage.boot_policy", "fail", "preparation_required")
	}
	if e := gatewayListenReady(s.Gateway.Listen); e != nil {
		set("gateway.listen", "fail", "listen_address_or_bind_capability_unavailable")
	} else {
		set("gateway.listen", "pass", "local_address_and_unit_bind_authority")
	}
	if e := nativeUnitInputs(ctx, s, exists); e != nil {
		set("installation.units", "fail", "foreign_unit_policy")
	}
	fresh := brokerAbsent()
	if !exists && !fresh {
		set("installation.identity", "fail", "foreign_installation_state")
	}
	if fresh {
		if _, e := os.Lstat("/var/lib/open-habitat/.broker-initialize"); errors.Is(e, os.ErrNotExist) {
			set("broker.state", "pass", "fresh_empty_broker")
		} else {
			set("broker.state", "fail", "recovery_required")
		}
	}
	if token, e := observePool(ctx, s, fresh); e != nil {
		set("identity.pool", "fail", "identity_pool_occupied")
	} else {
		set("identity.pool", "pass", "identity_pool_observed")
		r.Inputs["pool_observation"] = token
	}
	observedPackages := map[string]string{}
	packagesAvailable := false
	if b, e := queryRuntimePackages(ctx); e == nil {
		var parseErr error
		observedPackages, parseErr = parseRuntimePackages(b)
		packagesAvailable = parseErr == nil
		h := sha256.Sum256(b)
		r.Inputs["package_observation"] = hex.EncodeToString(h[:])
	} else {
		set("release.runtime", "unavailable", "runtime_package_observation_required")
	}
	for _, parent := range []string{"/opt/open-habitat", "/opt/open-habitat/generations", "/etc/open-habitat", "/var/lib/open-habitat"} {
		fd, e := openDir(parent, 0, false)
		if e == nil {
			unix.Close(fd)
		} else if !errors.Is(e, os.ErrNotExist) {
			set("installation.parents", "fail", "unsafe_installation_parent")
		}
	}
	if fresh {
		for _, path := range []string{"/opt/open-habitat/current", "/opt/open-habitat/core", "/etc/open-habitat/gateway/gateway.json"} {
			if _, e := os.Lstat(path); !errors.Is(e, os.ErrNotExist) {
				set("installation.collisions", "fail", "foreign_installation_state")
			}
		}
	}
	rel, e := loadRelease(s)
	if e == nil {
		set("release.manifest", "pass", "authenticated_release")
		artifacts, _ := rel.Select(s.Profiles)
		valid := true
		archiveIDs := []unix.Stat_t{}
		for _, a := range artifacts {
			if a.Closure == nil {
				valid = false
			}
			fd, e := openDir(releaseDirectory, 0, false)
			if e != nil {
				valid = false
				break
			}
			var st unix.Stat_t
			e = unix.Fstatat(fd, a.Archive, &st, unix.AT_SYMLINK_NOFOLLOW)
			unix.Close(fd)
			archiveIDs = append(archiveIDs, st)
			if e != nil || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Uid != 0 || st.Mode&0022 != 0 || st.Size != a.Size {
				valid = false
			}
		}
		ids, _ := json.Marshal(archiveIDs)
		h := sha256.Sum256(ids)
		r.Inputs["archive_observation"] = hex.EncodeToString(h[:])
		if valid && packagesAvailable {
			set("release.runtime", "pass", "qualified_runtime_available")
		}
		if packagesAvailable {
			missing, err := rel.unmetUbuntuRequirements(s.Profiles, observedPackages)
			if err != nil {
				set("release.runtime", "fail", "ubuntu_requirements_invalid")
			} else if len(missing) != 0 {
				for _, p := range missing {
					set("ubuntu.package."+p.Name, "pass", "apt_install_required_minimum_"+p.Version)
				}
				if err := transitionUbuntuPackages(ctx, s.Profiles, rel, observedPackages, false, nativeCommandTimeout); err != nil {
					set("release.runtime", "fail", "ubuntu_package_requirement_unsatisfiable")
					var apt *AptFailure
					if errors.As(err, &apt) {
						set("release.runtime", "fail", "ubuntu_package_requirement_unsatisfiable; "+apt.Error())
					}
					var requirement *UbuntuRequirementError
					if errors.As(err, &requirement) {
						set("ubuntu.package."+requirement.Name, "fail", "apt_candidate_cannot_meet_minimum_"+requirement.Minimum)
					}
				}
			}
		}
	}
	if e == nil {
		status, reason := coreAgentToolsObserved(ctx, rel, generationPath(s)+"/payloads/core/")
		set("runtime.taskfleet", status, reason)
	}
	if exists {
		if generationMatches(ctx, s, rel) == nil {
			set("installation.generation", "pass", "installed_generation_observed")
		} else {
			set("installation.generation", "fail", "generation_drift")
		}
	} else {
		set("installation.generation", "pass", "fresh_generation_planned")
	}
	r.Ready = true
	for _, c := range r.Checks {
		if c.Status != "pass" {
			r.Ready = false
		}
	}
}
func preparationExists(s Site) bool {
	fd, e := openDir(operationDir, 0, true)
	if e != nil {
		return false
	}
	defer unix.Close(fd)
	entries, e := os.ReadDir(operationDir)
	if e != nil {
		return false
	}
	for _, entry := range entries {
		if !strings.HasSuffix(entry.Name(), "-preparation.json") {
			continue
		}
		b, e := readPrivateAt(fd, entry.Name(), 0)
		var p preparationProof
		if e != nil || json.Unmarshal(b, &p) != nil || !p.proves(s) {
			continue
		}
		b, e = readPrivateAt(fd, p.OperationID+".json", 0)
		var o Operation
		if e == nil && decodeOperation(b, &o) == nil && o.Kind == "prepare" && o.Status == "completed" {
			return true
		}
	}
	return false
}

func applyNative(ctx context.Context, req ApplyRequest) (ApplyResult, error) {
	s, e := LoadSite(req.SitePath)
	if e != nil {
		return ApplyResult{}, e
	}
	n := &nativeApply{site: s}
	d := applyDriver{journal: operationDir, owner: 0, now: time.Now, observe: BuildPlan, binding: func(ctx context.Context, path string) (string, error) {
		return applyContinuationBinding(ctx, path, req.ApprovedPlan, operationDir, 0, inputBinding, func(ctx context.Context, path string) (string, error) {
			// The installed immutable product must reproduce the ORIGINAL full
			// binding; accepting a new binary never waives site/key/ref identity.
			s, e := LoadSite(path)
			if e != nil {
				return "", e
			}
			product, e := trustedFileDigest(generationPath(s) + "/open-habitat")
			if e != nil {
				return "", e
			}
			return inputBindingProduct(ctx, path, product)
		})
	}, complete: n.complete, revalidate: n.revalidate, fence: n.failureFence,
		steps: []applyStep{{"quiescing", n.closeEntries}, {"staging", n.stage}, {"initializing", n.initialize}, {"activating", n.activate}, {"converging", n.converge}, {"verifying", n.verify}, {"verified", n.openEntries}}}
	d.resumeSteps = func(o Operation) ([]applyStep, error) {
		if lateApplyPhase(o.Phase) {
			return []applyStep{{"converging", n.recoverGateway}, {"converging", n.converge}, {"verifying", n.verify}, {"verified", n.openEntries}}, nil
		}
		return d.steps, nil
	}
	r, e := executeApply(ctx, req, d)
	r.Administrators = n.roles
	return r, e
}

type nativeApply struct {
	site  Site
	roles []AdministratorOutcome
}

func (n *nativeApply) closeEntries(ctx context.Context) error {
	return installPolicy("/", policyFile{maintenanceFile, "closed\n"}, 0)
}
func (n *nativeApply) initialize(ctx context.Context) error {
	s := n.site
	if err := ensurePolicyDir("/var/lib/open-habitat", 0); err != nil {
		return err
	}
	if e := os.Chmod("/var/lib/open-habitat", 0700); e != nil {
		return e
	}
	if brokerAbsent() {
		p := provision.Initialization{GatewayUID: s.Gateway.UID, GatewayGID: s.Gateway.GID, UIDMin: s.Identities.UIDMin, UIDMax: s.Identities.UIDMax}
		if _, e := os.Lstat("/var/lib/open-habitat/.broker-initialize"); e == nil {
			if e = provision.CompleteBrokerInitialization(ctx, p, s.Identities.Admission); e != nil {
				return e
			}
		} else if errors.Is(e, os.ErrNotExist) {
			if _, e = provision.InitializeBroker(ctx, p, s.Identities.Admission); e != nil {
				return e
			}
		} else {
			return e
		}
	}
	if _, e := os.Lstat("/var/lib/open-habitat/broker/allowlist.json.next"); e == nil {
		if e = provision.CompleteAdmissionPublication(ctx, provision.Initialization{GatewayUID: s.Gateway.UID, GatewayGID: s.Gateway.GID, UIDMin: s.Identities.UIDMin, UIDMax: s.Identities.UIDMax}, s.Identities.Admission, s.Identities.RuntimeAdmission); e != nil {
			return e
		}
	} else if !errors.Is(e, os.ErrNotExist) {
		return e
	}
	state, e := provision.InspectInstallation(ctx)
	if e != nil || state.Policy != (provision.Initialization{GatewayUID: s.Gateway.UID, GatewayGID: s.Gateway.GID, UIDMin: s.Identities.UIDMin, UIDMax: s.Identities.UIDMax}) {
		return ErrImmutable
	}
	im, exists, e := installedImmutable()
	if e != nil {
		return e
	}
	if exists {
		if im != s.Immutable() {
			return ErrImmutable
		}
		return nil
	}
	// A same-input continuation may have published its empty seed immediately
	// before immutable policy. It may not adopt committed foreign identities.
	if len(state.BoundSubjects) != 0 || state.Generation != 1 || state.Epoch != 1 || state.ObservedEpoch != 1 || !slices.Equal(state.Admission, s.Identities.Admission) {
		return ErrImmutable
	}
	b, _ := json.Marshal(s.Immutable())
	fd, e := openDir(operationDir, 0, true)
	if e != nil {
		return e
	}
	defer unix.Close(fd)
	if staged, e := readPrivateAt(fd, "installation.json.next", 0); e == nil {
		if string(staged) != string(b) {
			return ErrRecovery
		}
		if e = unix.Renameat(fd, "installation.json.next", fd, "installation.json"); e != nil {
			return e
		}
		return unix.Fsync(fd)
	} else if !errors.Is(e, os.ErrNotExist) {
		return e
	}
	return replacePrivateAt(fd, "installation.json", b)
}
func (n *nativeApply) activate(ctx context.Context) error {
	s := n.site
	configSame := gatewayConfigurationMatches(s) && policiesMatch("/", []policyFile{applyUnitPolicies(s)[2]}, 0)
	sys := policyFile{"/etc/sysusers.d/open-habitat-gateway.conf", "g open-habitat-gateway " + uintString(uint64(s.Gateway.GID)) + "\nu open-habitat-gateway " + uintString(uint64(s.Gateway.UID)) + ":" + uintString(uint64(s.Gateway.GID)) + " \"Open Habitat gateway\" /nonexistent /usr/sbin/nologin\n"}
	if e := installPolicy("/", sys, 0); e != nil {
		return e
	}
	if _, e := nativeCommand(ctx, "/usr/bin/systemd-sysusers", sys.Path); e != nil {
		return e
	}
	if _, e := observePool(ctx, s, false); e != nil {
		return e
	}
	for _, dir := range []string{"/etc/open-habitat/gateway", "/etc/open-habitat-daemon/daemon/user-mappings"} {
		if e := ensurePolicyDir(dir, 0); e != nil {
			return e
		}
	}
	if e := secretParentSafe("/etc/open-habitat/gateway", 0); e != nil {
		return e
	}
	// Only the gateway group can read its secret/config parent. Binding parents
	// remain separately traversable to mapped users, never secret-bearing.
	if e := os.Chown("/etc/open-habitat/gateway", 0, int(s.Gateway.GID)); e != nil {
		return e
	}
	if e := os.Chmod("/etc/open-habitat/gateway", 0750); e != nil {
		return e
	}
	for _, dir := range []string{"/etc/open-habitat-daemon", "/etc/open-habitat-daemon/daemon", "/etc/open-habitat-daemon/daemon/user-mappings"} {
		if e := os.Chmod(dir, 0711); e != nil {
			return e
		}
	}
	desired, e := gatewayDesired(s)
	if e != nil {
		return e
	}
	for name, b := range desired {
		if e = writeGatewayFile(name, b, s.Gateway.GID); e != nil {
			return e
		}
	}

	units := applyUnitPolicies(s)
	for _, p := range units {
		if e = installPolicy("/", p, 0); e != nil {
			return e
		}
	}
	if _, e = nativeCommand(ctx, "/usr/bin/systemd-tmpfiles", "--create", "/etc/tmpfiles.d/open-habitat.conf"); e != nil {
		return e
	}
	if _, e = nativeCommand(ctx, "/usr/bin/systemctl", "daemon-reload"); e != nil {
		return e
	}
	if e = verifyInstalledUnits(ctx, s); e != nil {
		return e
	}
	if _, e = nativeCommand(ctx, "/usr/bin/systemctl", "enable", "open-habitat-broker.socket", "open-habitat-broker.service", "open-habitat-revoke.socket", "open-habitat-gateway.service"); e != nil {
		return e
	}
	if _, e = nativeCommand(ctx, "/usr/bin/systemctl", "start", "open-habitat-broker.service"); e != nil {
		return e
	}
	verb := "start"
	if !configSame {
		verb = "restart"
	}
	_, e = nativeCommand(ctx, "/usr/bin/systemctl", verb, "open-habitat-gateway.service")
	return e
}
func readSecret(path string) ([]byte, error) {
	if _, e := observeReference(path, 0); e != nil {
		return nil, e
	}
	return trustedBytes(path, MaxSiteBytes)
}
func writeGatewayFile(name string, b []byte, gid uint32) error {
	fd, e := openDir("/etc/open-habitat/gateway", 0, false)
	if e != nil {
		return e
	}
	defer unix.Close(fd)
	if e = noACLAttributes(fd, []string{"system.posix_acl_access", "system.posix_acl_default"}); e != nil {
		return e
	}
	if e = unix.Fstatat(fd, name, &unix.Stat_t{}, unix.AT_SYMLINK_NOFOLLOW); e == nil {
		if _, e = trustedBytes("/etc/open-habitat/gateway/"+name, MaxSiteBytes); e != nil {
			return e
		}
	} else if e != unix.ENOENT {
		return e
	}
	if staged, e := trustedBytes("/etc/open-habitat/gateway/"+name+".next", MaxSiteBytes); e == nil {
		var st unix.Stat_t
		if string(staged) != string(b) || unix.Fstatat(fd, name+".next", &st, unix.AT_SYMLINK_NOFOLLOW) != nil || st.Mode&0777 != 0640 || st.Gid != gid {
			return ErrRecovery
		}
		if e = unix.Renameat(fd, name+".next", fd, name); e != nil {
			return e
		}
		return unix.Fsync(fd)
	} else if !errors.Is(e, os.ErrNotExist) {
		return e
	}
	f, e := unix.Openat(fd, name+".next", unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0600)
	if e != nil {
		return ErrRecovery
	}
	file := os.NewFile(uintptr(f), "gateway")
	defer file.Close()
	if _, e = file.Write(b); e != nil {
		return e
	}
	if e = unix.Fchown(f, 0, int(gid)); e != nil {
		return e
	}
	if e = file.Chmod(0640); e != nil {
		return e
	}
	if e = file.Sync(); e != nil {
		return e
	}
	if e = unix.Renameat(fd, name+".next", fd, name); e != nil {
		return e
	}
	return unix.Fsync(fd)
}
func (n *nativeApply) openEntries(ctx context.Context) error {
	return n.openEntriesMode(ctx, administrationConverged)
}
func (n *nativeApply) openEntriesMode(ctx context.Context, settings administrationCheck) error {
	if _, e := os.Lstat(maintenanceFile + ".next"); !errors.Is(e, os.ErrNotExist) {
		return ErrRecovery
	}
	if e := n.verifyStructure(ctx, settings); e != nil {
		return e
	}
	fd, e := openDir(filepath.Dir(maintenanceFile), 0, false)
	if e != nil {
		return e
	}
	defer unix.Close(fd)
	if e = unix.Unlinkat(fd, filepath.Base(maintenanceFile), 0); e != nil && e != unix.ENOENT {
		return e
	}
	return unix.Fsync(fd)
}
func (n *nativeApply) verify(ctx context.Context) error {
	return n.verifyStructure(ctx, administrationConverged)
}
func (n *nativeApply) verifyStructure(ctx context.Context, settings administrationCheck) error {
	s := n.site
	if !gatewayConfigurationMatches(s) {
		return ErrNativeApply
	}
	if e := verifyInstalledUnits(ctx, s); e != nil {
		return e
	}
	if _, e := observePool(ctx, s, false); e != nil {
		return e
	}
	// Enumeration may legitimately see no account between seeding and sysusers;
	// completion, unlike that intermediate state, requires both actual records.
	for _, db := range []string{"passwd", "group"} {
		b, e := nativeCommand(ctx, "/usr/bin/getent", db, gatewayAccount)
		if e != nil {
			return e
		}
		if e = gatewayNSSSafe(s, false, db, b); e != nil {
			return e
		}
	}

	r, e := loadRelease(s)
	if e != nil {
		return e
	}
	if e = generationMatches(ctx, s, r); e != nil {
		return e
	}
	if !integrationsConfigMatches() {
		return ErrNativeApply
	}
	// Not part of generationMatches: a predecessor installed before this
	// file existed must still validate as an upgrade source.
	if !needrestartOverrideMatches() {
		return ErrNativeApply
	}
	c, e := r.ObserveRuntimePackages(ctx, s.Profiles)
	if e != nil || c.Status != "pass" {
		return ErrNativeApply
	}
	state, e := provision.InspectInstallation(ctx)
	if e != nil || !admissionPublished(state, s) || state.Epoch != state.ObservedEpoch {
		return ErrNativeApply
	}
	if !provision.IntegrationSetupPublished(ctx, s.BrowserSetup()) {
		return ErrNativeApply
	}
	if shell, subjects := s.LoginShellPolicy(); !provision.LoginShellsPublished(ctx, shell, subjects) {
		return ErrNativeApply
	}
	policies, policyErr := nativePreparePolicies(ctx, s)
	if policyErr != nil || !policiesMatch("/", policies, 0) || sessionPolicyReady(ctx) != nil {
		return ErrNativeApply
	}
	// Storage deliberately has no RemainAfterExit. Reobserve its read-only
	// predicate, not its transient process state; no-op verification starts no unit.
	if bootguard.Storage() != "verified" {
		return ErrNativeApply
	}
	for _, unit := range []string{"open-habitat-proc.service", "open-habitat-broker.service", "open-habitat-gateway.service"} {
		if _, e = nativeCommand(ctx, "/usr/bin/systemctl", "is-active", "--quiet", unit); e != nil {
			return e
		}
	}
	if settings != administrationCurrent {
		_, e = n.verifyAdministration(ctx, settings)
		return e
	}
	var current applySettings
	if e := control(ctx, map[string]any{"operation": "show"}, &current); e != nil {
		return e
	}
	if current.Version != 1 {
		return ErrNativeApply
	}
	return nil
}
func (n *nativeApply) complete(ctx context.Context) (bool, error) {
	im, exists, e := installedImmutable()
	if e != nil {
		return false, e
	}
	if !exists {
		return false, nil
	}
	if im != n.site.Immutable() {
		return false, ErrImmutable
	}
	if _, e = os.Lstat(maintenanceFile + ".next"); !errors.Is(e, os.ErrNotExist) {
		return false, nil
	}
	if _, e = os.Lstat(maintenanceFile); e == nil {
		return false, nil
	} else if !errors.Is(e, os.ErrNotExist) {
		return false, e
	}
	if e = n.verify(ctx); e != nil {
		return false, nil
	}
	return true, nil
}

func (n *nativeApply) revalidate(ctx context.Context, path string) error {
	s, e := LoadSite(path)
	if e != nil {
		return e
	}
	n.site = s
	inspection, e := Inspect(ctx, path)
	if e != nil {
		return e
	}
	for _, c := range inspection.Checks {
		if c.Code == "installation.identity" && c.Reason == "foreign_installation_state" {
			continue
		}
		switch c.Code {
		case "operation.fence", "broker.state", "installation.generation", "release.runtime", "installation.collisions":
			continue
		}
		if c.Status != "pass" {
			return ErrApplyBlocked
		}
	}
	if _, e = loadRelease(s); e != nil {
		return e
	}
	return nil
}

func gatewayDesired(s Site) (map[string][]byte, error) {
	result := map[string][]byte{}
	for name, source := range map[string]string{"tls.crt": s.Gateway.TLSCertFile, "tls.key": s.Gateway.TLSKeyFile} {
		b, e := readSecret(source)
		if e != nil {
			return nil, e
		}
		result[name] = b
	}
	secret, e := readSecret(s.Gateway.OAuthSecretFile)
	if e != nil {
		return nil, e
	}
	oauth := map[string]any{"client_id": s.Gateway.OAuthClientID, "client_secret": strings.TrimSuffix(string(secret), "\n"), "callback_url": s.Gateway.OAuthCallback, "origin": s.Gateway.Origin, "identities": []any{}}
	if s.Editor != nil {
		oauth["editor_origin"] = s.Editor.OriginTemplate
	}
	if s.Views != nil {
		oauth["view_origin"] = s.Views.OriginTemplate
		if s.Views.LinkMaxDays != nil {
			oauth["view_link_max_days"] = *s.Views.LinkMaxDays
		}
	}
	if language := s.DefaultLanguage(); language != "" {
		oauth["default_language"] = language
	}
	cfg := map[string]any{"component": "gateway", "listen": s.Gateway.Listen, "gateway_uid": s.Gateway.UID, "static_dir": generationPath(s) + "/web", "oauth": oauth, "tls_cert": "/etc/open-habitat/gateway/tls.crt", "tls_key": "/etc/open-habitat/gateway/tls.key", "entry_gate": "/etc/open-habitat/maintenance"}
	b, _ := json.Marshal(cfg)
	result["gateway.json"] = b
	return result, nil
}

func gatewayConfigurationMatches(s Site) bool {
	var parent unix.Stat_t
	if gatewayAncestorSafe("/etc/open-habitat", 0) != nil || unix.Lstat("/etc/open-habitat/gateway", &parent) != nil || parent.Uid != 0 || parent.Gid != s.Gateway.GID || parent.Mode&07777 != 0750 || secretParentSafe("/etc/open-habitat/gateway", 0) != nil {
		return false
	}
	desired, e := gatewayDesired(s)
	if e != nil {
		return false
	}
	for name, want := range desired {
		path := "/etc/open-habitat/gateway/" + name
		b, e := trustedBytes(path, MaxSiteBytes)
		var st unix.Stat_t
		if e != nil || string(b) != string(want) || unix.Lstat(path, &st) != nil || st.Gid != s.Gateway.GID || st.Mode&0777 != 0640 {
			return false
		}
	}
	return true
}

var ErrEntryFence = errors.New("entry_fence_unavailable: cannot durably confirm closed HTTP entry; keep external ingress closed")

func (n *nativeApply) failureFence(ctx context.Context) error {
	if e := n.closeEntries(ctx); e != nil {
		// Closing the listener is a last-resort availability sacrifice, not a
		// substitute for durable fence evidence. Never report closure as proven.
		_, stop := nativeCommand(ctx, "/usr/bin/systemctl", "stop", "open-habitat-gateway.service")
		return errors.Join(ErrEntryFence, e, stop)
	}
	return nil
}
