//go:build linux

package host

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/Open-Habitat/open-habitat/internal/provision"
	"golang.org/x/sys/unix"
)

// Check codes and reasons are API enums. No native diagnostics or supplied
// paths enter a result. Unavailable is never a successful observation.
var ErrUnstable = errors.New("observation_unstable: inputs changed during observation; re-run the read")

type Check struct {
	Code   string `json:"code"`
	Status string `json:"status"` // pass, fail, unavailable
	Reason string `json:"reason"`
}
type Action struct {
	Code   string `json:"code"`
	Status string `json:"status"`
	Reason string `json:"reason"`
}
type Inspection struct {
	SiteID          string            `json:"site_id"`
	Target          Release           `json:"target"`
	Inputs          map[string]string `json:"inputs"`
	Checks          []Check           `json:"checks"`
	Ready           bool              `json:"ready"`
	storageIdentity string
	// userQuota is the site's storage mode, carried for preparation planning.
	userQuota bool
}

const ApplyProtocol = "host.apply.v2"

type Plan struct {
	Inspection
	Protocol   string   `json:"protocol"`
	PlanID     string   `json:"plan_id"`
	Approvable bool     `json:"approvable"`
	Actions    []Action `json:"actions"`
	// Continuation is the fenced, unpublished apply this plan continues under
	// its own approval; the plan ID binds this exact record.
	Continuation *Operation `json:"continuation,omitempty"`
	// RuntimeAdmission is information, never an action: host apply converges
	// only the switch and the operator source, and reports the site_admin
	// entries with their actor and time so root can see what was admitted.
	RuntimeAdmission *RuntimeAdmissionReport `json:"runtime_admission,omitempty"`
	// Integrations is information too: who set each provider's app
	// credentials and when. Apply converges only the browser_setup switch.
	Integrations *IntegrationsReport `json:"integrations,omitempty"`
}

// IntegrationsReport is the broker's browser_setup switch as published and as
// the site asks for it, and each app section's source, actor and time. It
// carries client ids, which are public, and never a secret.
type IntegrationsReport struct {
	Site   bool                       `json:"site"`
	Broker bool                       `json:"broker"`
	Apps   []provision.IntegrationApp `json:"apps"`
}

// RuntimeAdmissionReport is the broker's switch and site_admin source as
// observed; Site is the switch the site file asks for.
type RuntimeAdmissionReport struct {
	Site    bool                     `json:"site"`
	Broker  bool                     `json:"broker"`
	Entries []provision.RuntimeEntry `json:"entries"`
}

type inspectSources struct {
	owner                                              uint32
	osRelease, systemd, mountInfo, homeDevice, journal string
	machineID, bootID                                  string
	broker                                             func(context.Context) (provision.InstallationState, error)
	statDevice                                         func(string, *unix.Stat_t) error
	superblock                                         func(string, string) ([]byte, error)
	enforcement                                        func(homeMount) error
	integrations                                       func(context.Context) (provision.IntegrationState, error)
	pinned                                             func(homeMount) error
	// installRoot, when set, lets an apply plan verify a pre-publication
	// continuation against the installation paths below it.
	installRoot string
}

func productionSources() inspectSources {
	return inspectSources{0, "/etc/os-release", "/run/systemd/system", "/proc/self/mountinfo", "/dev/disk/by-uuid/", operationDir, "/etc/machine-id", "/proc/sys/kernel/random/boot_id", provision.InspectInstallation, unix.Stat, readHomeSuperblock, homeQuotaEnforcement, provision.InspectIntegrations, homePinned, "/"}
}

// Inspect observes rather than reserves native state. Fixed read-only queries
// may contact NSS/systemd, but no writer lock, quota probe, service activation,
// installation or repair occurs. Broker inspection only flocks an existing
// directory. Filesystem reads may update access times.
func Inspect(ctx context.Context, sitePath string) (Inspection, error) {
	if os.Geteuid() != 0 {
		return Inspection{}, ErrTrust
	}
	return inspect(ctx, sitePath, productionSources())
}
func inspect(ctx context.Context, sitePath string, src inspectSources) (Inspection, error) {
	s, e := loadSite(sitePath, src.owner)
	if e != nil {
		return Inspection{}, e
	}
	r := Inspection{SiteID: s.SiteID, Target: s.Release, Inputs: map[string]string{"site": "flag", "environment": "ignored", "policy": "release"}, Checks: []Check{}, Ready: true, userQuota: s.Storage.EnforceUserQuota}
	add := func(code, status, reason string) {
		r.Checks = append(r.Checks, Check{code, status, reason})
		if status != "pass" {
			r.Ready = false
		}
	}
	add("site.schema", "pass", "valid_site")
	if _, e := hostIdentity(src); e != nil {
		add("host.identity", "unavailable", "host_identity_unavailable")
	} else {
		add("host.identity", "pass", "host_identity_observed")
	}
	b, e := os.ReadFile(src.osRelease)
	if e != nil {
		add("platform.os", "unavailable", "observation_unavailable")
	} else if osField(string(b), "ID") == "ubuntu" && osField(string(b), "VERSION_ID") == "24.04" && HostPlatform() != "" {
		add("platform.os", "pass", "supported_platform")
	} else {
		add("platform.os", "fail", "unsupported_platform")
	}
	if st, e := os.Stat(src.systemd); e == nil && st.IsDir() {
		add("platform.systemd", "pass", "systemd_present")
	} else {
		add("platform.systemd", "unavailable", "observation_unavailable")
	}
	mountStatus, mountReason, storage := observeStorage(s, src)
	r.storageIdentity = storage.token
	add("storage.home", mountStatus, mountReason)
	add(storage.format.Code, storage.format.Status, storage.format.Reason)
	add(storage.enforcement.Code, storage.enforcement.Status, storage.enforcement.Reason)
	add("storage.boot_policy", "unavailable", "boot_policy_verification_required")
	for _, ref := range protectedReferences(s) {
		_, e := observeReference(ref.path, src.owner)
		status, reason := "pass", "protected_reference"
		if e != nil {
			status, reason = "unavailable", "protected_reference_unavailable"
			if errors.Is(e, ErrTrust) {
				status, reason = "fail", "unsafe_protected_reference"
			}
		}
		add(ref.code, status, reason)
	}
	state, e := src.broker(ctx)
	if e != nil {
		add("broker.state", "unavailable", "broker_state_unavailable")
	} else {
		p := provision.Initialization{GatewayUID: s.Gateway.UID, GatewayGID: s.Gateway.GID, UIDMin: s.Identities.UIDMin, UIDMax: s.Identities.UIDMax}
		if state.Policy != p {
			add("broker.state", "fail", "immutable_identity_changed")
		} else if state.Epoch != state.ObservedEpoch {
			add("broker.state", "fail", "admission_not_observed")
		} else {
			add("broker.state", "pass", "broker_state_observed")
		}
	}
	add("identity.pool", "unavailable", "pool_verification_required")
	add("release.manifest", "unavailable", "release_verification_required")
	add("release.runtime", "unavailable", "runtime_verification_required")
	add("installation.generation", "unavailable", "generation_verification_required")
	status, reason := observeJournal(src.journal, src.owner)
	add("operation.fence", status, reason)
	if src.journal == operationDir {
		nativeInspection(ctx, s, &r)
	}
	return r, nil
}
func osField(b, key string) string {
	for _, line := range strings.Split(b, "\n") {
		if strings.HasPrefix(line, key+"=") {
			return strings.Trim(strings.TrimPrefix(line, key+"="), `"`)
		}
	}
	return ""
}

type reference struct{ code, path string }

func protectedReferences(s Site) []reference {
	r := []reference{{"reference.oauth", s.Gateway.OAuthSecretFile}, {"reference.tls_cert", s.Gateway.TLSCertFile}, {"reference.tls_key", s.Gateway.TLSKeyFile}}
	if s.Gateway.OriginCAFile != "" {
		r = append(r, reference{"reference.origin_ca", s.Gateway.OriginCAFile})
	}
	return r
}

// Metadata, not a digest of secret bytes: publishing a password hash would
// provide an offline guessing oracle. Apply must re-open/revalidate under lock;
// this observation is not a reservation against root changing a file.
type fileIdentity struct {
	Dev, Inode     uint64
	UID, GID, Mode uint32
	Size           int64
	Mtime, Ctime   unix.Timespec
}

func observeReference(path string, owner uint32) (fileIdentity, error) {
	var id fileIdentity
	fd, e := openDir(filepath.Dir(path), owner, false)
	if e != nil {
		return id, e
	}
	defer unix.Close(fd)
	f, e := unix.Openat(fd, filepath.Base(path), unix.O_PATH|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if e != nil {
		return id, e
	}
	defer unix.Close(f)
	var st unix.Stat_t
	if unix.Fstat(f, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Uid != owner || st.Mode&0077 != 0 || st.Nlink != 1 || st.Size < 1 || st.Size > MaxSiteBytes {
		return id, ErrTrust
	}
	return fileIdentity{st.Dev, st.Ino, st.Uid, st.Gid, st.Mode, st.Size, st.Mtim, st.Ctim}, nil
}
func observeJournal(dir string, owner uint32) (string, string) {
	fd, e := openDir(dir, owner, true)
	if errors.Is(e, ErrTrust) {
		return "fail", "unsafe_operation_journal"
	}
	// Absent and empty are one state: the broker creates the directory for
	// its first integration write, and that must not make an approved plan
	// stale, since the plan ID hashes this reason.
	if errors.Is(e, os.ErrNotExist) {
		return "pass", "no_active_operation"
	}
	if e != nil {
		return "unavailable", "operation_journal_unavailable"
	}
	defer unix.Close(fd)
	var st unix.Stat_t
	if unix.Fstatat(fd, "active.json.next", &st, unix.AT_SYMLINK_NOFOLLOW) != unix.ENOENT {
		return "fail", "recovery_required"
	}
	b, e := readPrivateAt(fd, "active.json", owner)
	if errors.Is(e, ErrTrust) {
		return "fail", "unsafe_operation_journal"
	}
	if errors.Is(e, os.ErrNotExist) {
		return "pass", "no_active_operation"
	}
	if e != nil {
		return "unavailable", "operation_journal_unavailable"
	}
	var o Operation
	if decodeOperation(b, &o) != nil || o.Status != "completed" {
		return "fail", "recovery_required"
	}
	receipt, e := showOperation(dir, o.ID, owner)
	if e != nil || receipt != o {
		return "fail", "recovery_required"
	}
	return "pass", "operation_completed"
}

func BuildPlan(ctx context.Context, sitePath string) (Plan, error) {
	if os.Geteuid() != 0 {
		return Plan{}, ErrTrust
	}
	return buildPlan(ctx, sitePath, productionSources())
}
func buildPlan(ctx context.Context, sitePath string, src inspectSources) (Plan, error) {
	return buildPlanMode(ctx, sitePath, src, false)
}
func buildPlanMode(ctx context.Context, sitePath string, src inspectSources, preparation bool) (Plan, error) {
	var runtime *RuntimeAdmissionReport
	var continuation *Operation
	capture := func() (Inspection, []Action, []byte, error) {
		r, e := inspect(ctx, sitePath, src)
		if e != nil {
			return Inspection{}, nil, nil, e
		}
		continuation = nil
		if !preparation && src.installRoot != "" {
			for i, c := range r.Checks {
				if c.Code == "operation.fence" && c.Status == "fail" && c.Reason == "recovery_required" {
					if o, e := applyPrepublicationContinuation(src.journal, src.owner, src.installRoot); e == nil {
						continuation = &o
						r.Checks[i] = Check{"operation.fence", "pass", "apply_prepublication_continuation_verified"}
						r.Ready = true
						for _, c := range r.Checks {
							if c.Status != "pass" {
								r.Ready = false
							}
						}
					}
				}
			}
		}
		if preparation {
			for i, c := range r.Checks {
				if c.Code == "operation.fence" && c.Status == "pass" {
					r.Checks[i].Reason = "operation_clear"
				}
			}
		}
		s, e := loadSite(sitePath, src.owner)
		if e != nil {
			return Inspection{}, nil, nil, e
		}
		identities := map[string]fileIdentity{}
		for _, ref := range protectedReferences(s) {
			id, e := observeReference(ref.path, src.owner)
			if e == nil {
				identities[ref.code] = id
			}
		}
		state, e := src.broker(ctx)
		token := ""
		runtime = nil
		if e == nil {
			token = state.Token
			runtime = &RuntimeAdmissionReport{Site: s.Identities.RuntimeAdmission, Broker: state.RuntimeAdmission, Entries: state.Runtime}
		}
		actions := []Action{{"installation.apply", "blocked", "apply_qualification_required"}, {"broker.admission", "blocked", "broker_state_unavailable"}, {"settings.reconcile", "blocked", "control_observation_required"}, {"administrators.reconcile", "blocked", "control_observation_required"}}
		if e == nil {
			expected := provision.Initialization{GatewayUID: s.Gateway.UID, GatewayGID: s.Gateway.GID, UIDMin: s.Identities.UIDMin, UIDMax: s.Identities.UIDMax}
			switch {
			case state.Policy != expected:
				actions[1].Reason = "immutable_identity_changed"
			case state.Epoch != state.ObservedEpoch:
				actions[1].Reason = "admission_not_observed"
			case admissionPublished(state, s):
				actions[1] = Action{"broker.admission", "no_change", "admission_matches"}
			default:
				actions[1].Reason = "admission_change_required"
			}
		}
		hostID, _ := hostIdentity(src)
		siteID, _ := observeReference(sitePath, src.owner)
		binding := struct {
			Protocol    string
			Host        string
			Storage     string
			SiteFile    fileIdentity
			Site        Site
			References  map[string]fileIdentity
			Broker      string
			Observation Inspection
			Actions     []Action
			// Absent outside a continuation, so other plans keep their IDs.
			Continuation *Operation `json:",omitempty"`
		}{ApplyProtocol, hostID, r.storageIdentity, siteID, s, identities, token, r, actions, continuation}
		b, _ := json.Marshal(binding)
		return r, actions, b, nil
	}
	r, actions, b, e := capture()
	if e != nil {
		return Plan{}, e
	}
	_, _, again, e := capture()
	if e != nil {
		return Plan{}, e
	}
	if string(b) != string(again) {
		return Plan{}, ErrUnstable
	}
	if src.journal == operationDir && !preparation {
		actions = []Action{{"installation.apply", "planned", "qualified_fresh_installation_or_convergence"}}
		for _, check := range r.Checks {
			if strings.HasPrefix(check.Code, "ubuntu.package.") {
				actions = append(actions, Action{check.Code, "planned", check.Reason})
			}
		}
	}
	sum := sha256.Sum256(b)
	// An observation fingerprint is not authenticated release/preparation evidence.
	// Keep plans non-approvable until those postconditions and the executor exist.
	var integrations *IntegrationsReport
	if src.integrations != nil {
		if s, e := loadSite(sitePath, src.owner); e == nil {
			if state, e := src.integrations(ctx); e == nil {
				integrations = &IntegrationsReport{Site: s.BrowserSetup(), Broker: state.BrowserSetup, Apps: state.Apps}
			}
		}
	}
	return Plan{Inspection: r, Protocol: ApplyProtocol, PlanID: hex.EncodeToString(sum[:]), Approvable: r.Ready, Actions: actions, Continuation: continuation, RuntimeAdmission: runtime, Integrations: integrations}, nil
}

// Bind this observation to the machine and boot without disclosing machine IDs.
// Part B must additionally authenticate the qualified release and installation.
func hostIdentity(src inspectSources) (string, error) {
	a, e := os.ReadFile(src.machineID)
	if e != nil || len(a) > 128 || !regexp.MustCompile(`^[0-9a-f]{32}$`).MatchString(strings.TrimSpace(string(a))) {
		return "", ErrTrust
	}
	b, e := os.ReadFile(src.bootID)
	if e != nil || len(b) > 128 || !uuidRE.MatchString(strings.TrimSpace(string(b))) {
		return "", ErrTrust
	}
	sum := sha256.Sum256(append(a, b...))
	return hex.EncodeToString(sum[:]), nil
}
