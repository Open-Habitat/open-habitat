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
	"path/filepath"
	"strconv"
	"time"

	policy "github.com/Open-Habitat/open-habitat"
	"github.com/Open-Habitat/open-habitat/internal/storagebaseline"
	"golang.org/x/sys/unix"
)

type prepareSources struct {
	inspect    inspectSources
	root       string
	home       string
	executable string
	probe      quotaProbeOps
	now        func() time.Time
}

func productionPrepareSources() prepareSources {
	exe, _ := os.Executable()
	return prepareSources{productionSources(), "/", "/home", exe, nativeQuotaProbeOps(), time.Now}
}

type preparationProof struct {
	Binding     string        `json:"binding"`
	OperationID string        `json:"operation_id"`
	Probe       ProbeEvidence `json:"probe"`
}

func prepare(ctx context.Context, req PrepareRequest, src prepareSources) (PrepareResult, error) {
	observe := func(ctx context.Context, path string) (Plan, error) {
		p, err := buildPlanMode(ctx, path, src.inspect, true)
		if err != nil {
			return p, err
		}
		s, err := loadSite(path, src.inspect.owner)
		if err != nil {
			return p, err
		}
		policies := preparePolicies(s)
		token, err := policyObservation(src.root, policies, src.inspect.owner)
		if err != nil {
			return p, err
		}
		if src.root == "/" {
			group, e := procGroup(ctx)
			if e != nil {
				return p, e
			}
			token += "\x00proc-group:" + group
		}
		sum := sha256.Sum256([]byte(p.PlanID + "\x00" + token))
		p.PlanID = hex.EncodeToString(sum[:])
		p.Checks = append(p.Checks, Check{"preparation.policy", "pass", "policy_files_observed"})
		return p, nil
	}
	r, err := preflightPrepare(ctx, req, observe)
	if r.Plan.PlanID != "" {
		s, e := loadSite(req.SitePath, src.inspect.owner)
		if e != nil {
			return r, e
		}
		for _, p := range preparePolicies(s) {
			r.PolicyFiles = append(r.PolicyFiles, p.Path)
		}
	}
	if err != nil {
		return r, err
	}
	if req.DryRun {
		s, e := loadSite(req.SitePath, src.inspect.owner)
		if e != nil {
			return r, e
		}
		binding, e := preparationBinding(s, r.Plan.Inspection, src.inspect)
		if e != nil {
			return r, e
		}
		fd, e := openDir(src.inspect.journal, src.inspect.owner, true)
		if e == nil {
			l := &Lock{fd: fd, owner: src.inspect.owner, now: src.now}
			if _, ok := completedPreparation(ctx, l, binding, src.root, preparePolicies(s)); ok {
				r.Would = []Action{}
				r.Plan.Actions = []Action{}
			}
			unix.Close(fd)
		} else if !errors.Is(e, os.ErrNotExist) {
			return r, e
		}
		return r, nil
	}
	// Creating the lock's trust root is the only pre-revalidation write. No
	// quota, policy, or operation intent is changed until approval matches again.
	if err = ensurePolicyDir(filepath.Dir(src.inspect.journal), src.inspect.owner); err != nil {
		return r, err
	}
	l, err := openOperationLock(ctx, src.inspect.journal, src.inspect.owner, src.now)
	if err != nil {
		return r, err
	}
	defer l.Close()
	files := r.PolicyFiles
	r, err = preflightPrepare(ctx, req, observe)
	r.PolicyFiles = files
	if err != nil {
		return r, err
	}
	s, err := loadSite(req.SitePath, src.inspect.owner)
	if err != nil {
		return r, err
	}
	inspection, err := inspect(ctx, req.SitePath, src.inspect)
	if err != nil {
		return r, err
	}
	if inspection.storageIdentity != r.Plan.storageIdentity {
		return r, ErrStalePlan
	}
	hostID, err := hostIdentity(src.inspect)
	if err != nil {
		return r, err
	}
	binding, err := preparationBinding(s, inspection, src.inspect)
	if err != nil {
		return r, err
	}
	policies := preparePolicies(s)
	if prior, ok := completedPreparation(ctx, l, binding, src.root, policies); ok {
		r.Outcome = "no_change"
		r.Operation = &prior
		r.Would = []Action{}
		r.Plan.Actions = []Action{}
		return r, nil
	}
	if err = ctx.Err(); err != nil {
		return r, err
	}
	home, err := openDir(src.home, src.inspect.owner, false)
	if err != nil {
		return r, err
	}
	defer unix.Close(home)
	// Opening /home again must resolve to the same mount, not an overmount that
	// appeared since the approved observation. The native probe also pins it.
	if src.root == "/" {
		b, e := os.ReadFile(src.inspect.mountInfo)
		if e != nil {
			return r, ErrHomeMount
		}
		m, status, _ := homeMountFrom(b)
		if status != "pass" {
			return r, ErrHomeMount
		}
		var sx unix.Statx_t
		var st unix.Stat_t
		if unix.Fstat(home, &st) != nil || fmtDevice(st.Dev) != m.device || unix.Statx(home, "", unix.AT_EMPTY_PATH, unix.STATX_MNT_ID, &sx) != nil || sx.Mask&unix.STATX_MNT_ID == 0 || uintString(sx.Mnt_id) != m.id {
			return r, ErrUnstable
		}
	}
	// Revalidate once more after opening the pinned mount and loading execution
	// inputs. Those reads must not silently select a newer, unapproved target.
	if _, err = preflightPrepare(ctx, req, observe); err != nil {
		return r, err
	}
	o, err := l.Begin("prepare", r.Plan.PlanID, s.Release)
	if err != nil {
		return r, err
	}
	r.Operation = &o
	r.Outcome = "incomplete"
	// Any error after Begin leaves a running fence. Cleanup is attempted by the
	// probe, but an incomplete whole operation is never automatically replayed.
	if req.Progress != nil {
		if err = req.Progress("quota_probe"); err != nil {
			return r, err
		}
	}
	o, ev, err := prepareQuotaProbe(ctx, l, o, home, src.executable, src.probe)
	r.Operation = &o
	if err != nil {
		return r, err
	}
	next, err := l.Advance(o, "policy_installing", "running", "")
	if err != nil {
		return r, err
	}
	o = next
	r.Operation = &o
	if req.Progress != nil {
		if err = req.Progress("policy_installing"); err != nil {
			return r, err
		}
	}
	// Establish the exemption before installing anything that names it. Stock
	// systemd-sysusers is conditional and is not a guaranteed boot-time replay.
	groupPolicy := policyFile{"/etc/sysusers.d/open-habitat-proc.conf", "g open-habitat-proc -\n"}
	if err = installPolicy(src.root, groupPolicy, src.inspect.owner); err != nil {
		return r, err
	}
	if src.root == "/" {
		if err = ensureProcGroup(ctx); err != nil {
			return r, err
		}
	}
	for _, p := range policies {
		if err = ctx.Err(); err != nil {
			return r, err
		}
		if err = installPolicy(src.root, p, src.inspect.owner); err != nil {
			return r, err
		}
	}
	if !policiesMatch(src.root, policies, src.inspect.owner) {
		return r, ErrRecovery
	}
	// Reobserve storage and boot after writes. A completed preparation is not
	// installation readiness and does not certify a subsequent boot.
	after, err := inspect(ctx, req.SitePath, src.inspect)
	if err != nil {
		return r, err
	}
	afterHost, err := hostIdentity(src.inspect)
	if err != nil {
		return r, err
	}
	afterSite, e := loadSite(req.SitePath, src.inspect.owner)
	if e != nil {
		return r, e
	}
	beforeSite, _ := json.Marshal(s)
	currentSite, _ := json.Marshal(afterSite)
	if string(beforeSite) != string(currentSite) || afterHost != hostID || after.storageIdentity != inspection.storageIdentity {
		return r, ErrUnstable
	}
	for _, c := range after.Checks {
		if (c.Code == "storage.home" || c.Code == "storage.quota_format" || c.Code == "storage.enforcement") && c.Status != "pass" {
			return r, ErrQuotaEnforcement
		}
	}
	if err = ctx.Err(); err != nil {
		return r, err
	}
	proof, _ := json.Marshal(preparationProof{binding, o.ID, ev})
	if err = replacePrivateAt(l.fd, o.ID+"-preparation.json", proof); err != nil {
		return r, err
	}
	next, err = l.Advance(o, "completed", "completed", "")
	if err != nil {
		return r, err
	}
	o = next
	r.Operation = &o
	r.Outcome = "prepared"
	r.Would = []Action{}
	return r, nil
}
func completedPreparation(ctx context.Context, l *Lock, binding, root string, policies []policyFile) (Operation, bool) {
	var o Operation
	if root == "/" {
		group, e := procGroup(ctx)
		if e != nil || group == "absent" {
			return o, false
		}
	}
	b, err := readPrivateAt(l.fd, "active.json", l.owner)
	if err != nil || decodeOperation(b, &o) != nil || o.Kind != "prepare" || o.Status != "completed" || l.matchReceipt(o) != nil {
		return o, false
	}
	b, err = readPrivateAt(l.fd, o.ID+"-preparation.json", l.owner)
	var p preparationProof
	if err != nil || strictJSON(b) != nil || json.Unmarshal(b, &p) != nil || p.Binding != binding || p.OperationID != o.ID || p.Probe.OperationID != o.ID || !p.Probe.EDQUOT || !p.Probe.Cleaned {
		return o, false
	}
	return o, policiesMatch(root, policies, l.owner)
}

// Policy installation deliberately does not reload/start services. The boot
// storage gate is installed here; binding gates and session restarts are separate.
type policyFile struct{ Path, Content string }

func preparePolicies(s Site) []policyFile {
	storage := storagebaseline.PolicyBytes(s.Storage.HomeUUID)
	return []policyFile{
		{"/etc/open-habitat/storage-policy.json", string(storage)},
		{"/etc/tmpfiles.d/open-habitat.conf", policy.Tmpfiles},
		{"/etc/sysusers.d/open-habitat-proc.conf", "g open-habitat-proc -\n"},
		{"/etc/systemd/system/open-habitat-proc.service", policy.ProcService},
		{"/etc/systemd/system/open-habitat-storage.service", policy.StorageService},
		{"/etc/systemd/system/open-habitat-broker.socket", policy.BrokerSocket},
		{"/etc/systemd/system/open-habitat-broker.service", policy.BrokerService},
		{"/etc/systemd/system/open-habitat-daemon@.socket", policy.DaemonSocket},
		{"/etc/systemd/system/open-habitat-agent@.socket", policy.AgentSocket},
		{"/etc/systemd/system/systemd-logind.service.d/open-habitat-proc.conf", policy.LogindDropIn},
		{"/etc/systemd/system/polkit.service.d/open-habitat-proc.conf", policy.PolkitDropIn},
	}
}
func policyPath(root, path string) string { return filepath.Join(root, path) }
func ensurePolicyDir(path string, owner uint32) error {
	fd, err := openDir(path, owner, false)
	if err == nil {
		unix.Close(fd)
		return nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if err = ensurePolicyDir(filepath.Dir(path), owner); err != nil {
		return err
	}
	parent, err := openDir(filepath.Dir(path), owner, false)
	if err != nil {
		return err
	}
	defer unix.Close(parent)
	if err = unix.Mkdirat(parent, filepath.Base(path), 0755); err != nil && err != unix.EEXIST {
		return err
	}
	if unix.Fsync(parent) != nil {
		return ErrRecovery
	}
	fd, err = openDir(path, owner, false)
	if err == nil {
		unix.Close(fd)
	}
	return err
}

type policySnapshot struct {
	Content string
	Mode    uint32
}

func policyBytes(root string, p policyFile, owner uint32) (policySnapshot, error) {
	fd, err := openDir(filepath.Dir(policyPath(root, p.Path)), owner, false)
	if err != nil {
		return policySnapshot{}, err
	}
	defer unix.Close(fd)
	f, err := unix.Openat(fd, filepath.Base(p.Path), unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if err != nil {
		return policySnapshot{}, err
	}
	file := os.NewFile(uintptr(f), "policy")
	defer file.Close()
	var st unix.Stat_t
	if unix.Fstat(f, &st) != nil || st.Uid != owner || st.Mode&0022 != 0 || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Nlink != 1 || st.Size > MaxSiteBytes {
		return policySnapshot{}, ErrTrust
	}
	b, e := io.ReadAll(io.LimitReader(file, MaxSiteBytes+1))
	return policySnapshot{string(b), st.Mode & 0777}, e
}
func policyObservation(root string, ps []policyFile, owner uint32) (string, error) {
	var state []any
	for _, p := range ps {
		b, err := policyBytes(root, p, owner)
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return "", err
		}
		if err != nil {
			state = append(state, "absent")
		} else {
			state = append(state, b)
		}
		state = append(state, p.Path, p.Content)
	}
	b, _ := json.Marshal(state)
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:]), nil
}
func policiesMatch(root string, ps []policyFile, owner uint32) bool {
	for _, p := range ps {
		b, e := policyBytes(root, p, owner)
		if e != nil || b.Content != p.Content || b.Mode != 0644 {
			return false
		}
	}
	return true
}
func installPolicy(root string, p policyFile, owner uint32) error {
	path := policyPath(root, p.Path)
	if err := ensurePolicyDir(filepath.Dir(path), owner); err != nil {
		return err
	}
	// Revalidate the target at write time; never follow a symlink or replace a
	// foreign-owned/writable policy, even after a previously valid preview.
	if _, err := policyBytes(root, p, owner); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	fd, err := openDir(filepath.Dir(path), owner, false)
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	return replaceAtMode(fd, filepath.Base(path), []byte(p.Content), 0644)
}

func uintString(n uint64) string { return strconv.FormatUint(n, 10) }

func preparationBinding(s Site, inspection Inspection, src inspectSources) (string, error) {
	hostID, err := hostIdentity(src)
	if err != nil {
		return "", err
	}
	raw, _ := json.Marshal(struct {
		Site          Site
		Host, Storage string
	}{s, hostID, inspection.storageIdentity})
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:]), nil
}
