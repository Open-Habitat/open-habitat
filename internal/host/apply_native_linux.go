//go:build linux

package host

import (
	"context"
	"crypto/ed25519"
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

	policy "github.com/Open-Habitat/open-habitat"
	"github.com/Open-Habitat/open-habitat/internal/provision"
	"golang.org/x/sys/unix"
)

const releaseDirectory = "/var/lib/open-habitat/release"
const releaseTrustKey = "/etc/open-habitat/release-key.pub"
const generationParent = "/opt/open-habitat/generations"
const immutableFile = "/var/lib/open-habitat/host/installation.json"
const maintenanceFile = "/etc/open-habitat/maintenance"

var ErrNativeApply = errors.New("host_action_failed: fixed native installation action failed; entry points remain closed; inspect operation and service journals")

func nativeCommand(ctx context.Context, path string, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()
	c := exec.CommandContext(ctx, path, args...)
	c.Dir = "/"
	c.Env = []string{"PATH=/usr/sbin:/usr/bin:/sbin:/bin", "HOME=/root", "LANG=C", "LC_ALL=C", "DEBIAN_FRONTEND=noninteractive", "NEEDRESTART_MODE=l", "TMPDIR=/var/tmp"}
	c.WaitDelay = time.Second
	b := &packageOutput{}
	c.Stdout = b
	c.Stderr = io.Discard
	if e := c.Run(); e != nil {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		return nil, ErrNativeApply
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
func loadRelease(s Site) (AuthenticatedRelease, error) {
	b, e := trustedBytes(releaseDirectory+"/release.json", MaxReleaseManifestBytes)
	if e != nil {
		return AuthenticatedRelease{}, e
	}
	sig, e := trustedBytes(releaseDirectory+"/release.sig", 64)
	if e != nil {
		return AuthenticatedRelease{}, e
	}
	key, e := trustedBytes(releaseTrustKey, 32)
	if e != nil {
		return AuthenticatedRelease{}, e
	}
	r, e := AuthenticateRelease(b, sig, ed25519.PublicKey(key), s.Release)
	if e != nil {
		return r, e
	}
	_, e = r.Select(s.Profiles)
	return r, e
}
func generationPath(s Site) string { return generationParent + "/" + s.Release.ManifestSHA256 }
func inputBinding(ctx context.Context, path string) (string, error) {
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
	key, e := trustedBytes(releaseTrustKey, 32)
	if e != nil {
		return "", e
	}
	b, _ := json.Marshal(struct {
		Site Site
		Refs map[string]fileIdentity
		Key  []byte
	}{s, refs, key})
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
	im, exists, e := installedImmutable()
	if e != nil {
		set("installation.identity", "fail", "unsafe_installation_policy")
	} else if exists && im != s.Immutable() {
		set("installation.identity", "fail", "immutable_identity_changed")
	} else {
		set("installation.identity", "pass", "immutable_policy_observed")
	}
	if policiesMatch("/", preparePolicies(s), 0) && sessionPolicyReady(ctx) == nil {
		set("storage.boot_policy", "pass", "prepared_boot_policy_observed")
	}
	// Check the durable EDQUOT proof as well as today's effective policies. An
	// operation phase or root-written ready bit is not preparation evidence.
	if !preparationExists(s) {
		set("storage.boot_policy", "fail", "preparation_required")
	}
	fresh := brokerAbsent()
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
	if b, e := queryRuntimePackages(ctx); e == nil {
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
		if valid {
			set("release.runtime", "pass", "qualified_runtime_available")
		}
		if exists {
			c, e := rel.ObserveRuntimePackages(ctx, s.Profiles)
			if e != nil || c.Status != "pass" {
				set("release.runtime", "fail", "runtime_package_drift")
			}
		}
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
		if e != nil || json.Unmarshal(b, &p) != nil || p.HomeUUID != s.Storage.HomeUUID || p.SiteID != s.SiteID || !p.Probe.EDQUOT || !p.Probe.Cleaned || p.OperationID != p.Probe.OperationID {
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
	d := applyDriver{journal: operationDir, owner: 0, now: time.Now, observe: BuildPlan, binding: inputBinding, complete: n.complete, revalidate: n.revalidate,
		steps: []applyStep{{"quiescing", n.closeEntries}, {"staging", n.stage}, {"initializing", n.initialize}, {"activating", n.activate}, {"converging", n.converge}, {"verifying", n.verify}, {"verified", n.openEntries}}}
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
	b, _ := json.Marshal(s.Immutable())
	fd, e := openDir(operationDir, 0, true)
	if e != nil {
		return e
	}
	defer unix.Close(fd)
	return replacePrivateAt(fd, "installation.json", b)
}
func (n *nativeApply) activate(ctx context.Context) error {
	s := n.site
	sys := policyFile{"/etc/sysusers.d/open-habitat-gateway.conf", "g open-habitat-gateway " + uintString(uint64(s.Gateway.GID)) + "\nu open-habitat-gateway " + uintString(uint64(s.Gateway.UID)) + ":" + uintString(uint64(s.Gateway.GID)) + " \"Open Habitat gateway\" /nonexistent /usr/sbin/nologin\n"}
	if e := installPolicy("/", sys, 0); e != nil {
		return e
	}
	if _, e := nativeCommand(ctx, "/usr/bin/systemd-sysusers", sys.Path); e != nil {
		return e
	}
	for _, dir := range []string{"/etc/open-habitat/gateway", "/etc/open-habitat-daemon/daemon/user-mappings"} {
		if e := ensurePolicyDir(dir, 0); e != nil {
			return e
		}
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
	for name, source := range map[string]string{"tls.crt": s.Gateway.TLSCertFile, "tls.key": s.Gateway.TLSKeyFile} {
		b, e := readSecret(source)
		if e != nil {
			return e
		}
		if e = writeGatewayFile(name, b, s.Gateway.GID); e != nil {
			return e
		}
	}
	secret, e := readSecret(s.Gateway.OAuthSecretFile)
	if e != nil {
		return e
	}
	oauth := map[string]any{"client_id": s.Gateway.OAuthClientID, "client_secret": strings.TrimSuffix(string(secret), "\n"), "callback_url": s.Gateway.OAuthCallback, "origin": s.Gateway.Origin, "identities": []any{}}
	if s.Editor != nil {
		oauth["editor_origin"] = strings.ReplaceAll(s.Editor.OriginTemplate, "{identity}", "*")
	}
	cfg := map[string]any{"component": "gateway", "listen": s.Gateway.Listen, "gateway_uid": s.Gateway.UID, "static_dir": generationPath(s) + "/web", "oauth": oauth, "tls_cert": "/etc/open-habitat/gateway/tls.crt", "tls_key": "/etc/open-habitat/gateway/tls.key", "entry_gate": "/etc/open-habitat/maintenance"}
	b, _ := json.Marshal(cfg)
	if e = writeGatewayFile("gateway.json", b, s.Gateway.GID); e != nil {
		return e
	}
	units := []policyFile{{"/etc/systemd/system/open-habitat-daemon@.service", policy.DaemonService}, {"/etc/systemd/system/open-habitat-revoke.socket", policy.RevokeSocket}, {"/etc/systemd/system/open-habitat-gateway.service", strings.ReplaceAll(policy.GatewayService, "/etc/open-habitat/gateway.json", "/etc/open-habitat/gateway/gateway.json")}}
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
	if _, e = nativeCommand(ctx, "/usr/bin/systemctl", "enable", "open-habitat-broker.socket", "open-habitat-broker.service", "open-habitat-revoke.socket", "open-habitat-gateway.service"); e != nil {
		return e
	}
	_, e = nativeCommand(ctx, "/usr/bin/systemctl", "start", "open-habitat-broker.service", "open-habitat-gateway.service")
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
	if e = unix.Fstatat(fd, name, &unix.Stat_t{}, unix.AT_SYMLINK_NOFOLLOW); e == nil {
		if _, e = trustedBytes("/etc/open-habitat/gateway/"+name, MaxSiteBytes); e != nil {
			return e
		}
	} else if e != unix.ENOENT {
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
	if e := n.verify(ctx); e != nil {
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
	s := n.site
	r, e := loadRelease(s)
	if e != nil {
		return e
	}
	if e = generationMatches(ctx, s, r); e != nil {
		return e
	}
	c, e := r.ObserveRuntimePackages(ctx, s.Profiles)
	if e != nil || c.Status != "pass" {
		return ErrNativeApply
	}
	state, e := provision.InspectInstallation(ctx)
	if e != nil || !slices.Equal(state.Admission, s.Identities.Admission) || state.Epoch != state.ObservedEpoch {
		return ErrNativeApply
	}
	if !policiesMatch("/", preparePolicies(s), 0) || sessionPolicyReady(ctx) != nil {
		return ErrNativeApply
	}
	for _, unit := range []string{"open-habitat-storage.service", "open-habitat-proc.service", "open-habitat-broker.service", "open-habitat-gateway.service"} {
		if _, e = nativeCommand(ctx, "/usr/bin/systemctl", "is-active", "--quiet", unit); e != nil {
			return e
		}
	}
	return n.verifySettings(ctx)
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
		switch c.Code {
		case "operation.fence", "broker.state", "identity.pool", "installation.generation", "release.runtime":
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
