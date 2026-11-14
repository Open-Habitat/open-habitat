//go:build linux

package host

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
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
	"github.com/open-habitat/open-habitat/internal/entryfence"
	"github.com/open-habitat/open-habitat/internal/provision"
	"golang.org/x/sys/unix"
)

type upgradeProof struct {
	SchemaVersion int    `json:"schema_version"`
	OperationID   string `json:"operation_id"`
	BrokerToken   string `json:"broker_token"`
	// Hashes stay root-private. Session/bearer contents never enter output.
	GatewayState map[string]string `json:"gateway_state"`
	Users        []upgradeUser     `json:"users"`
}
type upgradeUser struct {
	Name string `json:"name"`
	UID  uint32 `json:"uid"`
	GID  uint32 `json:"gid"`
	// User-manager units are reported, never stopped, restarted or compared:
	// shells, editors and Taskfleet runs outlive the upgrade on the generation
	// they started with, and start or stop units of their own meanwhile.
	UserUnits           []string `json:"user_units_left_running"`
	UserUnitsObservable bool     `json:"user_units_observable"`
	Daemon              bool     `json:"daemon"`
	Admitted            bool     `json:"admitted"`
	ActiveTurns         int      `json:"active_turns"`
	TurnsObservable     bool     `json:"turns_observable"`
}
type nativeUpgrade struct {
	site    Site
	request UpgradeRequest
	n       *nativeApply
	proof   upgradeProof
}

func upgradeNative(ctx context.Context, req UpgradeRequest) (UpgradeResult, error) {
	s, e := LoadSite(req.SitePath)
	if e != nil {
		return UpgradeResult{}, e
	}
	n := &nativeUpgrade{site: s, request: req, n: &nativeApply{site: s}}
	d := upgradeDriver{journal: operationDir, owner: 0, now: time.Now, plan: BuildUpgradePlan, binding: inputBinding, stage: func(c context.Context) error {
		if e := n.n.stageGeneration(c, false); e != nil {
			return e
		}
		r, e := loadRelease(s)
		if e != nil {
			return e
		}
		if e = runtimePackageTransition(c, s, r, generationPath(s), false); e != nil {
			return errors.Join(ErrRuntimePackages, e)
		}
		return nil
	}, isOwner: func() bool { exe, e := os.Executable(); return e == nil && exe == generationPath(s)+"/open-habitat" }, prepare: n.prepare, fence: n.failureFence, verifyComplete: n.complete, finishAccepted: n.finishAccepted,
		steps: []upgradeStep{{"quiescing", n.quiesce}, {"activating", n.activate}, {"verifying", n.verify}, {"verified", n.open}}}
	return executeUpgrade(ctx, req, d)
}

func (n *nativeUpgrade) prepare(ctx context.Context, l *Lock, o Operation) error {
	b, e := readPrivateAt(l.fd, o.ID+"-upgrade-proof.json", 0)
	if e == nil {
		if strictJSON(b) != nil || json.Unmarshal(b, &n.proof) != nil || n.proof.SchemaVersion != 1 || n.proof.OperationID != o.ID {
			return ErrRecovery
		}
		return nil
	}
	if !errors.Is(e, os.ErrNotExist) || o.Phase != "started" && o.Phase != "quiescing" {
		return ErrRecovery
	}
	// Do not capture mutable sessions until the gateway and its entry points
	// have stopped. This phase only requires the same authenticated predecessor.
	old, _, e := installedRelease(ctx)
	if e != nil {
		return e
	}
	r, e := loadRelease(n.site)
	if e != nil {
		return e
	}
	if old.Release != r.manifest.Upgrade.Predecessor {
		return ErrUpgradeTarget
	}
	return nil
}

func (n *nativeUpgrade) quiesce(ctx context.Context, l *Lock, o Operation) error {
	if e := publishUpgradeFences(); e != nil {
		return e
	}
	if e := n.n.closeEntries(ctx); e != nil {
		return e
	}
	// The HTTP marker is not drain: stop existing websocket/control consumers,
	// the broker and root socket activation before any native snapshot/switch.
	if _, e := nativeCommand(ctx, "/usr/bin/systemctl", "stop", "open-habitat-gateway.service", "open-habitat-revoke.socket", "open-habitat-broker.socket", "open-habitat-broker.service"); e != nil {
		return e
	}
	if n.proof.OperationID == "" {
		state, e := provision.InspectInstallation(ctx)
		if e != nil {
			return e
		}
		users, e := observeUpgradeWork(ctx, n.site, generationParent+"/"+n.predecessorDigest()+"/open-habitat")
		if e != nil {
			return e
		}
		proof := upgradeProof{SchemaVersion: 1, OperationID: o.ID, BrokerToken: state.Token, GatewayState: map[string]string{}, Users: users}
		if interruptionRequired(users) && !n.request.ApproveInterruption {
			return ErrWorkBusy
		}

		for _, name := range []string{"sessions.json", "administration.json"} {
			sum, e := gatewayStateDigest(name, n.site.Gateway.UID)
			if e != nil {
				return e
			}
			proof.GatewayState[name] = sum
		}
		b, _ := json.Marshal(proof)
		if e = replacePrivateAt(l.fd, o.ID+"-upgrade-proof.json", b); e != nil {
			return e
		}
		n.proof = proof
	}
	// Snapshot is durable before any daemon interruption. Only product system
	// units stop; user managers, SSH sessions and their tmux are never signalled.
	for _, u := range n.proof.Users {
		units := []string{"open-habitat-daemon@" + u.Name + ".service", "open-habitat-daemon@" + u.Name + ".socket", "open-habitat-agent@" + u.Name + ".socket"}
		if _, e := nativeCommand(ctx, "/usr/bin/systemctl", append([]string{"stop"}, units...)...); e != nil {
			return e
		}
	}
	return n.preserved(ctx)
}
func (n *nativeUpgrade) predecessorDigest() string {
	r, e := loadRelease(n.site)
	if e != nil || r.manifest.Upgrade == nil {
		return ""
	}
	return r.manifest.Upgrade.Predecessor.ManifestSHA256
}

func (n *nativeUpgrade) activate(ctx context.Context, l *Lock, o Operation) error {
	if e := n.preserved(ctx); e != nil {
		return e
	}
	r, e := loadRelease(n.site)
	if e != nil {
		return e
	}
	if e = verifyUpgradeProduct(ctx, r); e != nil {
		return e
	}
	if e = generationPayloadMatches(ctx, n.site, r); e != nil {
		return e
	}
	if e = installRuntimePackages(ctx, n.site, r, generationPath(n.site)); e != nil {
		return errors.Join(ErrRuntimePackages, e)
	}
	// Selector replacement is restricted to this pinned predecessor/successor.
	if e = switchUpgradeSelectors(n.site, n.predecessorDigest()); e != nil {
		return e
	}
	ps, e := nativePreparePolicies(ctx, n.site)
	if e != nil {
		return e
	}
	for _, p := range ps {
		if e = installPolicy("/", p, 0); e != nil {
			return e
		}
	}
	// Old shared links end here, once, before the gateway starts on the
	// stable view address format (ADR 0035). The gateway's own code, as its
	// account, owns that file and its formats; a current or unusable store
	// is left as it is.
	gateway := upgradeUser{Name: gatewayAccount, UID: n.site.Gateway.UID, GID: n.site.Gateway.GID}
	if _, e = userCommand(ctx, gateway, generationPath(n.site)+"/open-habitat", "upgrade-view-addresses"); e != nil {
		return e
	}
	if e = n.n.activate(ctx); e != nil {
		return e
	}
	// activate starts the broker/gateway, but only explicit daemon restarts prove
	// adoption. Socket activation starts no process until structural health asks.
	for _, u := range n.proof.Users {
		if u.Admitted {
			if _, e = nativeCommand(ctx, "/usr/bin/systemctl", "start", "open-habitat-daemon@"+u.Name+".socket", "open-habitat-agent@"+u.Name+".socket"); e != nil {
				return e
			}
			if u.Daemon {
				if _, e = nativeCommand(ctx, "/usr/bin/systemctl", "start", "open-habitat-daemon@"+u.Name+".service"); e != nil {
					return e
				}
			}
		}
	}
	return nil
}
func (n *nativeUpgrade) verify(ctx context.Context, l *Lock, o Operation) error {
	if e := n.preserved(ctx); e != nil {
		return e
	}
	if e := waitControl(ctx); e != nil {
		return e
	}
	// The upgrade converges no administration: site.json's roles must hold,
	// and the gateway's current default stays whatever an administrator set.
	if e := n.n.verifyStructure(ctx, administrationDeclared); e != nil {
		return e
	}
	// Cold-start both listeners with real peer credentials. Production daemon
	// startup itself validates pinned Node/Pi before exposing either handler.
	for _, u := range n.proof.Users {
		if !u.Admitted {
			continue
		}
		deadline := time.Now().Add(90 * time.Second)
		for {
			_, agentErr := userCommand(ctx, u, generationPath(n.site)+"/open-habitat", "upgrade-listener-probe", "agent", u.Name)
			gateway := upgradeUser{Name: gatewayAccount, UID: n.site.Gateway.UID, GID: n.site.Gateway.GID}
			_, webErr := userCommand(ctx, gateway, generationPath(n.site)+"/open-habitat", "upgrade-listener-probe", "web", u.Name)
			if agentErr == nil && webErr == nil {
				break
			}
			if time.Now().After(deadline) {
				return ErrNativeApply
			}
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(250 * time.Millisecond):
			}
		}
	}
	if e := n.currentAdoption(ctx); e != nil {
		return e
	}
	return n.preserved(ctx)
}

type upgradeAcceptance struct {
	Version         int    `json:"version"`
	OperationID     string `json:"operation_id"`
	OwnerGeneration string `json:"owner_generation"`
}

func (n *nativeUpgrade) accepted(l *Lock, o Operation) (bool, error) {
	b, e := readPrivateAt(l.fd, o.ID+"-upgrade-accepted.json", 0)
	if errors.Is(e, os.ErrNotExist) {
		if unix.Fstatat(l.fd, o.ID+"-upgrade-accepted.json.next", &unix.Stat_t{}, unix.AT_SYMLINK_NOFOLLOW) != unix.ENOENT {
			return false, ErrRecovery
		}
		return false, nil
	}
	var a upgradeAcceptance
	if e != nil || strictJSON(b) != nil || json.Unmarshal(b, &a) != nil || a != (upgradeAcceptance{1, o.ID, o.OwnerGeneration}) {
		return false, ErrRecovery
	}
	return true, nil
}
func (n *nativeUpgrade) open(ctx context.Context, l *Lock, o Operation) error {
	if e := upgradePublicationsClear(); e != nil {
		return e
	}
	if e := n.verify(ctx, l, o); e != nil {
		return e
	}
	// Structural acceptance is durable while entry remains closed. Hash equality
	// proves preservation only in that window, never after ordinary use resumes.
	b, _ := json.Marshal(upgradeAcceptance{1, o.ID, o.OwnerGeneration})
	if e := replacePrivateAt(l.fd, o.ID+"-upgrade-accepted.json", b); e != nil {
		return e
	}
	if e := n.n.openEntriesMode(ctx, administrationDeclared); e != nil {
		return e
	}
	return removeUpgradeFence()
}
func (n *nativeUpgrade) finishAccepted(ctx context.Context, l *Lock, o Operation) (bool, error) {
	accepted, e := n.accepted(l, o)
	if e != nil || !accepted {
		return false, e
	}
	// A returned post-acceptance failure may have stopped product consumers.
	// Revalidate the installed successor before starting only missing accepted
	// consumers; never requiesce healthy work or replay old administration.
	if e = n.acceptedRecoveryPrerequisites(ctx); e != nil {
		return false, e
	}
	if e = n.startAcceptedConsumers(ctx); e != nil {
		return false, e
	}
	if e = waitControl(ctx); e != nil {
		return false, e
	}
	if e = n.currentAdoption(ctx); e != nil {
		return false, e
	}
	if e = n.n.openEntriesMode(ctx, administrationCurrent); e != nil {
		return false, e
	}
	if e = removeUpgradeFence(); e != nil {
		return false, e
	}
	ok, e := n.complete(ctx, l, o)
	if e != nil {
		return false, e
	}
	if !ok {
		return false, ErrRecovery
	}
	return true, nil
}
func (n *nativeUpgrade) complete(ctx context.Context, l *Lock, o Operation) (bool, error) {
	accepted, e := n.accepted(l, o)
	if e != nil || !accepted {
		return false, e
	}
	for _, path := range []string{maintenanceFile, maintenanceFile + ".next", entryfence.UpgradePath, entryfence.UpgradePath + ".next", entryfence.AgentUpgradePath, entryfence.AgentUpgradePath + ".next"} {
		if _, e = os.Lstat(path); !errors.Is(e, os.ErrNotExist) {
			return false, ErrRecovery
		}
	}
	if e = n.currentAdoption(ctx); e != nil {
		return false, e
	}
	if e = n.n.verifyStructure(ctx, administrationCurrent); e != nil {
		return false, e
	}
	return true, nil
}
func (n *nativeUpgrade) acceptedRecoveryPrerequisites(ctx context.Context) error {
	if e := upgradePublicationsClear(); e != nil {
		return e
	}
	if e := n.n.revalidate(ctx, n.request.SitePath); e != nil {
		return e
	}
	im, exists, e := installedImmutable()
	if e != nil || !exists || im != n.site.Immutable() {
		return ErrImmutable
	}
	r, e := loadRelease(n.site)
	if e != nil {
		return e
	}
	if e = generationMatches(ctx, n.site, r); e != nil {
		return e
	}
	if e = verifyInstalledUnits(ctx, n.site); e != nil {
		return e
	}
	packages, e := r.ObserveRuntimePackages(ctx, n.site.Profiles)
	if e != nil || packages.Status != "pass" {
		return ErrUpgradeTarget
	}
	if !gatewayConfigurationMatches(n.site) || bootguard.Storage() != "verified" || sessionPolicyReady(ctx) != nil {
		return ErrUpgradeTarget
	}
	state, e := provision.InspectInstallation(ctx)
	if e != nil || !admissionPublished(state, n.site) || state.Epoch != state.ObservedEpoch {
		return ErrRecovery
	}
	return nil
}
func (n *nativeUpgrade) startAcceptedConsumers(ctx context.Context) error {
	state, e := provision.InspectInstallation(ctx)
	if e != nil {
		return e
	}
	ids, e := provision.MaintenanceIdentities(ctx)
	if e != nil {
		return e
	}
	units := []string{"open-habitat-broker.service", "open-habitat-gateway.service"}
	for _, i := range ids {
		if state.Admits(i.ID()) {
			units = append(units, "open-habitat-daemon@"+i.Username()+".socket", "open-habitat-agent@"+i.Username()+".socket", "open-habitat-daemon@"+i.Username()+".service")
		}
	}
	for _, unit := range units {
		if _, e = nativeCommand(ctx, "/usr/bin/systemctl", "start", unit); e != nil {
			return e
		}
	}
	return nil
}

func (n *nativeUpgrade) currentAdoption(ctx context.Context) error {
	want, e := trustedFileDigest(generationPath(n.site) + "/open-habitat")
	if e != nil {
		return e
	}
	units := []string{"open-habitat-gateway.service", "open-habitat-broker.service"}
	ids, e := provision.MaintenanceIdentities(ctx)
	if e != nil {
		return e
	}
	for _, i := range ids {
		unit := "open-habitat-daemon@" + i.Username() + ".service"
		b, e := nativeCommand(ctx, "/usr/bin/systemctl", "show", "--value", "--property=MainPID", unit)
		if e != nil {
			return e
		}
		if strings.TrimSpace(string(b)) != "0" {
			units = append(units, unit)
		}
	}
	for _, unit := range units {
		b, e := nativeCommand(ctx, "/usr/bin/systemctl", "show", "--value", "--property=MainPID", unit)
		if e != nil {
			return e
		}
		pid, e := strconv.ParseUint(strings.TrimSpace(string(b)), 10, 32)
		if e != nil || pid == 0 {
			return ErrNativeApply
		}
		path := fmt.Sprintf("/proc/%d/exe", pid)
		target, e := os.Readlink(path)
		if e != nil || target != generationPath(n.site)+"/open-habitat" {
			return ErrNativeApply
		}
		sum, e := fileDigest(path)
		if e != nil || sum != want {
			return ErrNativeApply
		}
	}
	return nil
}

func (n *nativeUpgrade) preserved(ctx context.Context) error {
	if n.proof.OperationID == "" {
		return ErrRecovery
	}
	s, e := provision.InspectInstallation(ctx)
	if e != nil || s.Token != n.proof.BrokerToken {
		return ErrRecovery
	}
	for name, want := range n.proof.GatewayState {
		sum, e := gatewayStateDigest(name, n.site.Gateway.UID)
		if e != nil || sum != want {
			return ErrRecovery
		}
	}
	return nil
}

// legacyViewLinks says whether the gateway still holds ADR 0033's shared
// links, which the upgrade resets: the plan announces that their URLs stop
// working. Only the format version is read, never a link.
func legacyViewLinks(uid uint32) bool {
	fd, e := openDir("/var/lib/open-habitat-gateway", uid, true)
	if e != nil {
		return false
	}
	defer unix.Close(fd)
	b, e := readPrivateAtLimit(fd, "view-links.json", uid, 32<<20)
	var head struct {
		Version int `json:"version"`
	}
	return e == nil && json.Unmarshal(b, &head) == nil && head.Version == 1
}

func gatewayStateDigest(name string, uid uint32) (string, error) {
	if name != "sessions.json" && name != "administration.json" {
		return "", ErrTrust
	}
	fd, e := openDir("/var/lib/open-habitat-gateway", uid, true)
	if e != nil {
		return "", e
	}
	defer unix.Close(fd)
	b, e := readPrivateAtLimit(fd, name, uid, 4<<20)
	if errors.Is(e, os.ErrNotExist) {
		return "absent", nil
	}
	if e != nil {
		return "", e
	}
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:]), nil
}
func userCommand(ctx context.Context, u upgradeUser, path string, args ...string) ([]byte, error) {
	if !siteIDRE.MatchString(u.Name) || u.UID == 0 || u.GID == 0 {
		return nil, ErrTrust
	}
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	c := exec.CommandContext(ctx, path, args...)
	c.Dir = "/"
	id := strconv.FormatUint(uint64(u.UID), 10)
	c.Env = []string{"PATH=/usr/sbin:/usr/bin:/sbin:/bin", "HOME=/home/" + u.Name, "USER=" + u.Name, "LOGNAME=" + u.Name, "LANG=C", "LC_ALL=C", "XDG_RUNTIME_DIR=/run/user/" + id, "DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/" + id + "/bus"}
	c.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: u.UID, Gid: u.GID, Groups: []uint32{u.GID}}}
	c.WaitDelay = time.Second
	b := &packageOutput{}
	c.Stdout = b
	c.Stderr = io.Discard
	if e := c.Run(); e != nil {
		return nil, ErrNativeApply
	}
	return b.data.Bytes(), nil
}

// userUnits lists what a user manager is running, for the operator's preview
// only. The upgrade acts on none of it, so an unobservable manager is reported
// as such rather than refusing the upgrade.
func userUnits(ctx context.Context, u upgradeUser) ([]string, bool) {
	b, e := nativeCommand(ctx, "/usr/bin/systemctl", "show", "--value", "--property=ActiveState", "user@"+uintString(uint64(u.UID))+".service")
	if e != nil {
		return []string{}, false
	}
	switch strings.TrimSpace(string(b)) {
	case "inactive", "failed":
		return []string{}, true
	case "active":
	default:
		return []string{}, false
	}
	b, e = userCommand(ctx, u, "/usr/bin/systemctl", "--user", "list-units", "--type=service,socket,timer,path", "--state=active,activating,reloading", "--output=json", "--no-pager")
	if e != nil {
		return []string{}, false
	}
	return parseUserUnits(b)
}
func parseUserUnits(b []byte) ([]string, bool) {
	var rows []struct {
		Unit string `json:"unit"`
	}
	if json.Unmarshal(b, &rows) != nil || rows == nil {
		return []string{}, false
	}
	out := []string{}
	for _, r := range rows {
		out = append(out, r.Unit)
	}
	slices.Sort(out)
	return out, true
}
func switchUpgradeSelectors(s Site, predecessor string) error {
	old := generationParent + "/" + predecessor
	for path, target := range map[string]string{"/opt/open-habitat/current": generationPath(s), "/opt/open-habitat/core": generationPath(s) + "/payloads/core/runtime"} {
		suffix := ""
		if filepath.Base(path) == "core" {
			suffix = "/payloads/core/runtime"
		}
		if e := replaceUpgradeLink(path, old+suffix, target); e != nil {
			return e
		}
	}
	for _, p := range s.Profiles {
		if p == "core" {
			continue
		}
		if st, e := os.Stat(generationPath(s) + "/payloads/" + p + "/runtime"); e == nil && st.IsDir() {
			if e = replaceUpgradeLink("/opt/open-habitat/profiles/"+p, old+"/payloads/"+p+"/runtime", generationPath(s)+"/payloads/"+p+"/runtime"); e != nil {
				return e
			}
		}
	}
	return finishGeneration(s)
}
func replaceUpgradeLink(path, old, want string) error {
	have, e := os.Readlink(path)
	if e != nil {
		return e
	}
	if have == want {
		return nil
	}
	if have != old {
		return ErrRecovery
	}
	if staged, e := os.Readlink(path + ".next"); e == nil {
		if staged != want {
			return ErrRecovery
		}
	} else if !errors.Is(e, os.ErrNotExist) {
		return e
	} else if e = os.Symlink(want, path+".next"); e != nil {
		return e
	}
	if e = os.Rename(path+".next", path); e != nil {
		return e
	}
	return syncDirectory(filepath.Dir(path))
}

// Cold startup and own-UID mutation have different visibility requirements.
// Publish the stable cold fence first, so even a predecessor boot refuses an
// interruption before publication of the public agent fence or service drain.
func publishUpgradeFences() error {
	var errs []error
	for _, path := range []string{entryfence.UpgradePath, entryfence.AgentUpgradePath} {
		errs = append(errs, installPolicy("/", policyFile{path, "closed\n"}, 0))
	}
	return errors.Join(errs...)
}

func removeUpgradeFence() error {
	if e := upgradePublicationsClear(); e != nil {
		return e
	}
	// Retain the cold denial until the own-UID entry fence has been removed.
	for _, path := range []string{entryfence.AgentUpgradePath, entryfence.UpgradePath} {
		fd, e := openDir(filepath.Dir(path), 0, false)
		if e != nil {
			return e
		}
		e = unix.Unlinkat(fd, filepath.Base(path), 0)
		if e == unix.ENOENT {
			e = nil
		}
		if e == nil {
			e = unix.Fsync(fd)
		}
		unix.Close(fd)
		if e != nil {
			return e
		}
	}
	return nil
}
func (n *nativeUpgrade) failureFence(ctx context.Context) error {
	e := publishUpgradeFences()
	e = errors.Join(e, n.n.failureFence(ctx))
	units := []string{"open-habitat-gateway.service", "open-habitat-revoke.socket", "open-habitat-broker.socket", "open-habitat-broker.service"}
	users := n.proof.Users
	if len(users) == 0 {
		ids, err := provision.MaintenanceIdentities(ctx)
		if err != nil {
			e = errors.Join(e, err)
		} else {
			for _, i := range ids {
				users = append(users, upgradeUser{Name: i.Username(), UID: i.UID()})
			}
		}
	}
	for _, u := range users {
		units = append(units, "open-habitat-daemon@"+u.Name+".socket", "open-habitat-agent@"+u.Name+".socket")
		if n.proof.OperationID != "" {
			units = append(units, "open-habitat-daemon@"+u.Name+".service")
		}
	}

	_, stop := nativeCommand(ctx, "/usr/bin/systemctl", append([]string{"stop"}, units...)...)
	return errors.Join(e, stop)
}

func observeUpgradeWork(ctx context.Context, s Site, binary string) ([]upgradeUser, error) {
	state, e := provision.InspectInstallation(ctx)
	if e != nil {
		return nil, e
	}
	ids, e := provision.MaintenanceIdentities(ctx)
	if e != nil {
		return nil, e
	}
	out := []upgradeUser{}
	for _, i := range ids {
		u := upgradeUser{Name: i.Username(), UID: i.UID(), GID: i.UID(), Admitted: state.Admits(i.ID())}
		b, e := nativeCommand(ctx, "/usr/bin/systemctl", "show", "--value", "--property=ActiveState", "open-habitat-daemon@"+u.Name+".service")
		if e != nil {
			return nil, e
		}
		switch strings.TrimSpace(string(b)) {
		case "active":
			u.Daemon = true
		case "inactive", "failed":
		default:
			return nil, ErrWorkBusy
		}
		u.UserUnits, u.UserUnitsObservable = userUnits(ctx, u)
		if u.Daemon {
			// Inventory is observational, not an in-flight mutation barrier. A live
			// daemon always needs interruption consent even if this list says idle.
			data, e := userCommand(ctx, u, binary, "agent", "conversation", "list", "--json")
			var reply struct {
				Data struct {
					Result struct {
						Sessions []struct {
							State string `json:"state"`
						} `json:"sessions"`
					} `json:"result"`
				} `json:"data"`
			}
			if e == nil && json.Unmarshal(data, &reply) == nil && reply.Data.Result.Sessions != nil {
				u.TurnsObservable = true
				for _, v := range reply.Data.Result.Sessions {
					if upgradeSessionActive(v.State) {
						u.ActiveTurns++
					}
				}
			}
		}
		out = append(out, u)
	}
	return out, nil
}

func upgradeSessionActive(state string) bool {
	switch state {
	case "idle", "stopped", "failed", "start_failed":
		// A failed start is retained for recovery, but has no live child.
		return false
	default:
		// Unfamiliar states must not make work look safe to interrupt.
		return true
	}
}

// A live daemon is conservatively busy: an idle conversation list cannot
// exclude an admitted in-flight request. User-manager units are left running.
func interruptionRequired(users []upgradeUser) bool {
	return slices.ContainsFunc(users, func(u upgradeUser) bool { return u.Daemon })
}

func upgradePublicationsClear() error {
	for _, path := range []string{maintenanceFile + ".next", entryfence.UpgradePath + ".next", entryfence.AgentUpgradePath + ".next"} {
		if _, e := os.Lstat(path); !errors.Is(e, os.ErrNotExist) {
			return ErrRecovery
		}
	}
	return nil
}
