//go:build linux

package host

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"golang.org/x/sys/unix"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/provision"
)

func inspectionFixture(t *testing.T) (string, inspectSources, Site) {
	t.Helper()
	journal, owner := operationFixture(t)
	dir := filepath.Dir(journal)
	s, e := ParseSite(example(t))
	if e != nil {
		t.Fatal(e)
	}
	secret := filepath.Join(dir, "secret")
	s.Gateway.OAuthSecretFile = secret
	s.Gateway.TLSCertFile = secret
	s.Gateway.TLSKeyFile = secret
	write := func(name string, b []byte) {
		t.Helper()
		if e := os.WriteFile(name, b, 0600); e != nil {
			t.Fatal(e)
		}
	}
	write(secret, []byte("LOW_ENTROPY_SECRET_SENTINEL"))
	site := filepath.Join(dir, "site.json")
	b, _ := json.Marshal(s)
	write(site, b)
	osRelease := filepath.Join(dir, "os-release")
	write(osRelease, []byte("ID=ubuntu\nVERSION_ID=\"24.04\"\n"))
	mounts := filepath.Join(dir, "mountinfo")
	write(mounts, []byte("1 0 0:1 / / rw - ext4 /dev/root rw\n"))
	state := provision.InstallationState{Policy: provision.Initialization{GatewayUID: s.Gateway.UID, GatewayGID: s.Gateway.GID, UIDMin: s.Identities.UIDMin, UIDMax: s.Identities.UIDMax}, Epoch: 1, ObservedEpoch: 1, Token: strings.Repeat("a", 64)}
	machine := filepath.Join(dir, "machine-id")
	write(machine, []byte(strings.Repeat("a", 32)))
	boot := filepath.Join(dir, "boot-id")
	write(boot, []byte("00000000-0000-4000-8000-000000000001"))
	src := inspectSources{owner, osRelease, dir, mounts, dir, journal, machine, boot, func(context.Context) (provision.InstallationState, error) { return state, nil }, unix.Stat, func(string, string) ([]byte, error) { return nil, os.ErrNotExist }, func(homeMount) error { return os.ErrNotExist }, func(context.Context) (provision.IntegrationState, error) {
		return provision.IntegrationState{BrowserSetup: true, Apps: []provision.IntegrationApp{}}, nil
	}, func(homeMount) error { return nil }, ""}
	return site, src, s
}
func snapshot(t *testing.T, dir string) string {
	t.Helper()
	records := []any{}
	e := filepath.WalkDir(dir, func(p string, d os.DirEntry, e error) error {
		if e != nil {
			return e
		}
		st, e := os.Lstat(p)
		if e != nil {
			return e
		}
		var b []byte
		if st.Mode().IsRegular() {
			b, e = os.ReadFile(p)
			if e != nil {
				return e
			}
		}
		records = append(records, []any{p, st.Mode(), st.Size(), st.ModTime(), string(b)})
		return nil
	})
	if e != nil {
		t.Fatal(e)
	}
	b, _ := json.Marshal(records)
	return string(b)
}
func TestInspectionReadOnlyAndNoSecretOracle(t *testing.T) {
	site, src, s := inspectionFixture(t)
	dir := filepath.Dir(site)
	before := snapshot(t, dir)
	r, e := inspect(context.Background(), site, src)
	if e != nil {
		t.Fatal(e)
	}
	p, e := buildPlan(context.Background(), site, src)
	if e != nil {
		t.Fatal(e)
	}
	q, e := buildPlan(context.Background(), site, src)
	if e != nil || q.PlanID != p.PlanID {
		t.Fatal("unstable plan", e)
	}
	if before != snapshot(t, dir) {
		t.Fatal("read commands changed host state")
	}
	if r.Ready || p.Approvable {
		t.Fatal("unverified host accepted")
	}
	checks := map[string]Check{}
	for _, c := range r.Checks {
		checks[c.Code] = c
	}
	if checks["broker.state"].Status != "pass" || checks["reference.oauth"].Status != "pass" || checks["storage.home"].Reason != "separate_home_required" || checks["storage.enforcement"].Status != "unavailable" {
		t.Fatal(r)
	}
	b, _ := json.Marshal(p)
	if strings.Contains(string(b), "SECRET_SENTINEL") || strings.Contains(string(b), s.Gateway.OAuthSecretFile) || strings.Contains(string(b), strings.Repeat("a", 64)) {
		t.Fatal("protected input leaked", string(b))
	}
	// Same path/length but replaced inode must change the fingerprint. The
	// contents are never hashed or read by reference inspection.
	next := s.Gateway.OAuthSecretFile + ".next"
	if e := os.WriteFile(next, []byte("LOW_ENTROPY_SECRET_SENTINEL"), 0600); e != nil {
		t.Fatal(e)
	}
	if e := os.Rename(next, s.Gateway.OAuthSecretFile); e != nil {
		t.Fatal(e)
	}
	changed, e := buildPlan(context.Background(), site, src)
	if e != nil || changed.PlanID == p.PlanID {
		t.Fatal("replacement not bound", e)
	}
	os.WriteFile(src.bootID, []byte("00000000-0000-4000-8000-000000000002"), 0600)
	rebooted, e := buildPlan(context.Background(), site, src)
	if e != nil || rebooted.PlanID == changed.PlanID {
		t.Fatal("boot not bound", e)
	}
	doubled := s.Storage.DefaultLimit() * 2
	s.Storage.DefaultLimitBytes = &doubled
	b, _ = json.Marshal(s)
	os.WriteFile(site, b, 0600)
	changedAgain, e := buildPlan(context.Background(), site, src)
	if e != nil || changedAgain.PlanID == changed.PlanID {
		t.Fatal("desired state not bound", e)
	}
}
func TestInspectionUnsafeAndUnavailable(t *testing.T) {
	site, src, s := inspectionFixture(t)
	os.Remove(s.Gateway.OAuthSecretFile)
	src.broker = func(context.Context) (provision.InstallationState, error) {
		return provision.InstallationState{}, errors.New("SECRET_SENTINEL")
	}
	r, e := inspect(context.Background(), site, src)
	if e != nil {
		t.Fatal(e)
	}
	for _, c := range r.Checks {
		if (c.Code == "reference.oauth" || c.Code == "broker.state") && c.Status != "unavailable" {
			t.Fatal(c)
		}
	}
	if e := os.Symlink(site, s.Gateway.OAuthSecretFile); e != nil {
		t.Fatal(e)
	}
	r, e = inspect(context.Background(), site, src)
	if e != nil {
		t.Fatal(e)
	}
	for _, c := range r.Checks {
		if c.Code == "reference.oauth" && (c.Status != "fail" || c.Reason != "unsafe_protected_reference") {
			t.Fatal(c)
		}
	}
	os.Chmod(site, 0644)
	if _, e := inspect(context.Background(), site, src); !errors.Is(e, ErrTrust) {
		t.Fatal("unsafe site accepted", e)
	}
}
func TestInspectionJournalAndChangingInputs(t *testing.T) {
	site, src, _ := inspectionFixture(t)
	os.Mkdir(src.journal, 0700)
	os.WriteFile(filepath.Join(src.journal, "active.json.next"), []byte("{}"), 0600)
	r, e := inspect(context.Background(), site, src)
	if e != nil {
		t.Fatal(e)
	}
	found := false
	for _, c := range r.Checks {
		if c.Code == "operation.fence" {
			found = c.Status == "fail" && c.Reason == "recovery_required"
		}
	}
	if !found {
		t.Fatal(r)
	}
	calls := 0
	src.broker = func(context.Context) (provision.InstallationState, error) {
		calls++
		return provision.InstallationState{Token: strings.Repeat(string(rune('a'+calls)), 64)}, nil
	}
	if _, e := buildPlan(context.Background(), site, src); !errors.Is(e, ErrUnstable) {
		t.Fatal("mixed observation accepted", e)
	}
}

func TestHomeObservationRejectsRootAndBindMounts(t *testing.T) {
	_, src, s := inspectionFixture(t)
	for _, line := range []string{
		"2 1 0:1 / /home rw - ext4 /dev/root rw",
		"2 1 0:2 /subdir /home rw - ext4 /dev/home rw",
		"2 1 0:2 / /home ro - ext4 /dev/home ro",
		"2 1 0:2 / /home rw - xfs /dev/home rw",
	} {
		os.WriteFile(src.mountInfo, []byte("1 0 0:1 / / rw - ext4 /dev/root rw\n"+line+"\n"), 0600)
		status, reason := observeHome(s, src)
		if status != "fail" || reason != "unsupported_home_mount" {
			t.Fatal(line, status, reason)
		}
	}
	os.WriteFile(src.mountInfo, []byte("1 0 0:1 / / rw - ext4 /dev/root rw\n2 1 0:2 / /home rw - ext4 /dev/home rw\n"), 0600)
	if status, reason := observeHome(s, src); status != "unavailable" || reason != "home_uuid_unavailable" {
		t.Fatal(status, reason)
	}
}

func TestPlanAdmissionDifferencesWithoutInventingInitialization(t *testing.T) {
	site, src, s := inspectionFixture(t)
	state, _ := src.broker(context.Background())
	state.Admission = append([]string{}, s.Identities.Admission...)
	src.broker = func(context.Context) (provision.InstallationState, error) { return state, nil }
	p, e := buildPlan(context.Background(), site, src)
	if e != nil || p.Actions[1].Status != "no_change" {
		t.Fatal(p, e)
	}
	// Runtime entries are the broker's and only reported; the switch is the
	// site's and converges.
	state.Runtime = []provision.RuntimeEntry{{ID: "777", State: "admitted", LoginHint: "newcomer", Actor: "123456", At: "2026-10-24T09:30:00Z"}}
	p, e = buildPlan(context.Background(), site, src)
	if e != nil || p.Actions[1].Status != "no_change" || p.RuntimeAdmission == nil || len(p.RuntimeAdmission.Entries) != 1 || p.RuntimeAdmission.Entries[0].ID != "777" {
		t.Fatal(p, e)
	}
	// Who set an app credential is reported, never planned; the site's
	// switch defaults to on.
	src.integrations = func(context.Context) (provision.IntegrationState, error) {
		return provision.IntegrationState{BrowserSetup: false, Apps: []provision.IntegrationApp{{Provider: "google", ClientID: "1-a.apps.googleusercontent.com", Usable: true, Source: provision.AppSourceSiteAdmin, Actor: "123456", At: "2026-10-24T12:00:00Z"}}}, nil
	}
	p, e = buildPlan(context.Background(), site, src)
	if e != nil || p.Actions[1].Status != "no_change" || p.Integrations == nil || !p.Integrations.Site || p.Integrations.Broker || len(p.Integrations.Apps) != 1 || p.Integrations.Apps[0].Actor != "123456" {
		t.Fatal(p.Integrations, e)
	}
	state.RuntimeAdmission = true
	p, e = buildPlan(context.Background(), site, src)
	if e != nil || p.Actions[1].Reason != "admission_change_required" || p.RuntimeAdmission.Site || !p.RuntimeAdmission.Broker {
		t.Fatal(p, e)
	}
	state.RuntimeAdmission = false
	state.Admission = []string{"987654321"}
	p, e = buildPlan(context.Background(), site, src)
	if e != nil || p.Actions[1].Status != "blocked" || p.Actions[1].Reason != "admission_change_required" {
		t.Fatal(p, e)
	}
	state.Policy.UIDMin++
	p, e = buildPlan(context.Background(), site, src)
	if e != nil || p.Actions[1].Reason != "immutable_identity_changed" {
		t.Fatal(p, e)
	}
	src.broker = func(context.Context) (provision.InstallationState, error) {
		return provision.InstallationState{}, os.ErrNotExist
	}
	p, e = buildPlan(context.Background(), site, src)
	if e != nil || p.Actions[1].Reason != "broker_state_unavailable" || p.Approvable {
		t.Fatal(p, e)
	}
}

func TestReferenceCodesCannotEchoProviderInput(t *testing.T) {
	site, src, s := inspectionFixture(t)
	s.Profiles = append(s.Profiles, "secret-sentinel")
	b, _ := json.Marshal(s)
	if e := os.WriteFile(site, b, 0600); e != nil {
		t.Fatal(e)
	}
	r, e := inspect(context.Background(), site, src)
	if e != nil {
		t.Fatal(e)
	}
	b, _ = json.Marshal(r)
	if strings.Contains(string(b), "secret-sentinel") {
		t.Fatal("provider value entered diagnostic code")
	}
}

func TestInspectionStorageDeviceEvidenceAndUnsafeJournal(t *testing.T) {
	_, src, s := inspectionFixture(t)
	os.WriteFile(src.mountInfo, []byte("1 0 0:1 / / rw - ext4 /dev/root rw\n2 1 8:42 / /home rw - ext4 /dev/home rw\n"), 0600)
	src.statDevice = func(path string, st *unix.Stat_t) error {
		if path != filepath.Join(src.homeDevice, s.Storage.HomeUUID) {
			t.Fatal("wrong UUID observation")
		}
		st.Mode = unix.S_IFBLK
		st.Rdev = unix.Mkdev(8, 42)
		return nil
	}
	if status, reason := observeHome(s, src); status != "pass" || reason != "home_mount_observed" {
		t.Fatal(status, reason)
	}
	src.statDevice = func(_ string, st *unix.Stat_t) error { st.Mode = unix.S_IFBLK; st.Rdev = unix.Mkdev(8, 43); return nil }
	if status, reason := observeHome(s, src); status != "fail" || reason != "home_uuid_mismatch" {
		t.Fatal(status, reason)
	}
	src.statDevice = func(_ string, st *unix.Stat_t) error { st.Mode = unix.S_IFREG; st.Rdev = unix.Mkdev(8, 42); return nil }
	if status, reason := observeHome(s, src); status != "fail" || reason != "home_uuid_mismatch" {
		t.Fatal(status, reason)
	}
	os.Mkdir(src.journal, 0700)
	// Deliberately unsafe fixtures must not depend on the runner's umask.
	if err := os.Chmod(src.journal, 0755); err != nil {
		t.Fatal(err)
	}
	status, reason := observeJournal(src.journal, src.owner)
	if status != "fail" || reason != "unsafe_operation_journal" {
		t.Fatal(status, reason)
	}
	os.Chmod(src.journal, 0700)
	active := filepath.Join(src.journal, "active.json")
	os.WriteFile(active, []byte("{}"), 0600)
	if err := os.Chmod(active, 0644); err != nil {
		t.Fatal(err)
	}
	status, reason = observeJournal(src.journal, src.owner)
	if status != "fail" || reason != "unsafe_operation_journal" {
		t.Fatal(status, reason)
	}
}
func TestInspectionRequiresRootBeforeFileAccess(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("nonroot refusal test")
	}
	if _, e := Inspect(context.Background(), "/unreadable/site.json"); !errors.Is(e, ErrTrust) {
		t.Fatal(e)
	}
	if _, e := BuildPlan(context.Background(), "/unreadable/site.json"); !errors.Is(e, ErrTrust) {
		t.Fatal(e)
	}
}

func TestApplyLiftsGatewayDenyOnlyForOperatorIDs(t *testing.T) {
	var calls []string
	exchange := func(_ context.Context, request any, reply any) error {
		r := request.(map[string]any)
		calls = append(calls, fmt.Sprint(r["operation"], r["subject"]))
		body := `{"schema_version":1,"entries":[{"id":"1","source":"operator","denied":true},{"id":"2","source":"site_admin","denied":true},{"id":"3","source":"operator","denied":false},{"id":"4","source":"none","denied":true}]}`
		if r["operation"] == "access_add" {
			body = fmt.Sprintf(`{"id":%q,"denied":false}`, r["subject"])
		}
		return json.Unmarshal([]byte(body), reply)
	}
	if e := liftOperatorDenies(context.Background(), exchange); e != nil {
		t.Fatal(e)
	}
	if !slices.Equal(calls, []string{"access_list<nil>", "access_add1"}) {
		t.Fatal(calls)
	}
}
