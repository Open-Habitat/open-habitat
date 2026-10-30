//go:build linux

package host

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"slices"
	"strings"
	"testing"
)

func TestUpgradeReleaseAuthentication(t *testing.T) {
	_, key, e := ed25519.GenerateKey(rand.Reader)
	if e != nil {
		t.Fatal(e)
	}
	m := ReleaseManifest{SchemaVersion: 2, Version: "2.0.0", Commit: strings.Repeat("a", 40), Platform: "ubuntu-24.04-amd64", Artifacts: []ReleaseArtifact{{Profile: "core", Archive: "core.tar.gz", SHA256: strings.Repeat("a", 64), Size: 1, ExpandedSize: 1024, Entries: 1, Requires: []string{}, Packages: []RuntimePackage{}}}, Upgrade: &ReleaseUpgrade{Protocol: 1, PredecessorBinarySHA256: strings.Repeat("e", 64), Predecessor: Release{"1.0.0", strings.Repeat("b", 64)}, Product: []ProductFile{{"open-habitat", strings.Repeat("c", 64), 0755}, {"web/index.html", strings.Repeat("d", 64), 0644}}}}
	b, _, e := EncodeRelease(m, key)
	if e != nil {
		t.Fatal(e)
	}
	h := sha256.Sum256(b)
	pin := Release{m.Version, hex.EncodeToString(h[:])}
	if _, e = AuthenticateRelease(b, pin); e != nil {
		t.Fatal(e)
	}
	// The predecessor and product bytes are both covered by the pinned digest.
	for _, change := range []func(*ReleaseManifest){func(m *ReleaseManifest) { m.Upgrade.Predecessor.ManifestSHA256 = strings.Repeat("e", 64) }, func(m *ReleaseManifest) { m.Upgrade.Product[0].SHA256 = strings.Repeat("f", 64) }} {
		var altered ReleaseManifest
		if e = json.Unmarshal(b, &altered); e != nil {
			t.Fatal(e)
		}
		change(&altered)
		data, _ := json.Marshal(altered)
		if _, e := AuthenticateRelease(data, pin); e == nil {
			t.Fatal("tampered transition authenticated")
		}
	}
	for _, change := range []func(*ReleaseManifest){
		func(m *ReleaseManifest) { m.Upgrade.Protocol = 2 },
		func(m *ReleaseManifest) { m.Upgrade.Predecessor.Version = m.Version },
		func(m *ReleaseManifest) { m.Upgrade.Product[0].Path = "../open-habitat" },
		func(m *ReleaseManifest) { m.Upgrade.Product[0].Mode = 0777 },
		func(m *ReleaseManifest) { m.Upgrade.Product = append(m.Upgrade.Product, m.Upgrade.Product[0]) },
	} {
		var bad ReleaseManifest
		json.Unmarshal(b, &bad)
		change(&bad)
		if _, _, e = EncodeRelease(bad, key); e == nil {
			t.Fatal("unsafe upgrade metadata signed")
		}
	}
}

func TestUpgradeDeclarationUsesNativeMutableTruth(t *testing.T) {
	old := Site{SiteID: "fixture", Profiles: []string{"core"}, Identities: Identities{UIDMin: 21032, UIDMax: 21035, Admission: []string{"42"}}}
	current := old
	current.Identities.Admission = []string{"42", "43"}
	current.Identities.Administrators = []string{"42"}
	limit := uint64(64 << 20)
	current.Storage.DefaultLimitBytes = &limit
	if !upgradeDeclarationSame(old, current) {
		t.Fatal("initial generation became a second mutable-state registry")
	}
	current.Identities.UIDMax++
	if upgradeDeclarationSame(old, current) {
		t.Fatal("identity migration accepted")
	}
}

// An administrator may raise the quota default in the browser after the last
// apply. A release upgrade converges no administration, so it must neither
// refuse that predecessor nor carry site.json's older default back.
func TestUpgradeAcceptsBrowserChangedQuotaDefault(t *testing.T) {
	declared := uint64(20 << 30)
	s := Site{Identities: Identities{Administrators: []string{"42", "43"}}}
	s.Storage.EnforceUserQuota, s.Storage.DefaultLimitBytes = true, &declared
	live := applySettings{Version: 1, Administrators: []string{"42"}, DefaultLimitBytes: 40 << 30, Pending: []string{"43"}}
	bound := []string{"42", "44"}
	if _, reason := administrationMatches(s, live, bound, administrationConverged); reason != "default_limit_not_applied" {
		t.Fatalf("apply readback accepted an unconverged default: %q", reason)
	}
	roles, reason := administrationMatches(s, live, bound, administrationDeclared)
	if reason != "" {
		t.Fatalf("browser-changed default refused the upgrade: %q", reason)
	}
	if !slices.Equal(roles, []AdministratorOutcome{{"42", "granted"}, {"43", "deferred_until_bound"}}) {
		t.Fatal(roles)
	}
	for name, c := range map[string]struct {
		change func(*applySettings, *Site)
		reason string
	}{
		"version":            {func(a *applySettings, _ *Site) { a.Version = 2 }, "administration_version_unsupported"},
		"zero default":       {func(a *applySettings, _ *Site) { a.DefaultLimitBytes = 0 }, "default_limit_invalid"},
		"unaligned default":  {func(a *applySettings, _ *Site) { a.DefaultLimitBytes = 40<<30 + 1 }, "default_limit_invalid"},
		"undeclared role":    {func(a *applySettings, _ *Site) { a.Administrators = []string{"42", "44"} }, "administrators_not_applied"},
		"missing role":       {func(a *applySettings, _ *Site) { a.Administrators = nil }, "administrators_not_applied"},
		"undeclared pending": {func(a *applySettings, _ *Site) { a.Pending = []string{"45"} }, "administrators_not_applied"},
		"browser designation": {func(a *applySettings, _ *Site) {
			a.Administrators, a.Designated = []string{"42", "44"}, []applyDesignation{{"44"}, {"46"}}
		}, ""},
		"no quotas": {func(a *applySettings, s *Site) {
			s.Storage.EnforceUserQuota, s.Storage.DefaultLimitBytes, a.DefaultLimitBytes = false, nil, 0
		}, ""},
	} {
		a, site := live, s
		c.change(&a, &site)
		if _, reason := administrationMatches(site, a, bound, administrationDeclared); reason != c.reason {
			t.Fatalf("%s: got %q, want %q", name, reason, c.reason)
		}
	}
}

// Apply (the incoming release directory) and upgrade (an installed generation)
// both authenticate release.json by the site's pin alone. A generation installed
// while releases were signed still holds release.sig; no key is on the host.
func TestReleaseFileAuthenticatesByPinAlone(t *testing.T) {
	if os.Geteuid() != 0 || os.Getenv("HOST_INIT_UID_CONTAINER") != "1" {
		t.Skip("root-owned trusted release directory requires disposable root container")
	}
	if HostPlatform() == "" {
		t.Skip("unsupported build architecture")
	}
	if _, e := os.Stat("/etc/open-habitat/release-key.pub"); !os.IsNotExist(e) {
		t.Fatalf("container already holds a release key: %v", e)
	}
	a, _ := releaseFixture(t)
	m := releaseManifest(a)
	m.Platform = HostPlatform()
	b, sig, e := EncodeRelease(m, releaseKey())
	if e != nil {
		t.Fatal(e)
	}
	pin := Release{m.Version, releaseDigest(b)}
	for _, layout := range []struct {
		name string
		sig  bool
	}{{"incoming", false}, {"signed generation", true}} {
		dir, e := os.MkdirTemp("/opt", "release-pin-")
		if e != nil {
			t.Fatal(e)
		}
		defer os.RemoveAll(dir)
		if e = os.Chmod(dir, 0755); e != nil {
			t.Fatal(e)
		}
		if e = os.WriteFile(dir+"/release.json", b, 0644); e != nil {
			t.Fatal(e)
		}
		if layout.sig {
			if e = os.WriteFile(dir+"/release.sig", sig, 0644); e != nil {
				t.Fatal(e)
			}
		}
		if r, e := authenticateReleaseFile(dir, pin); e != nil || r.Platform() != m.Platform {
			t.Fatalf("%s refused by its pin: %v", layout.name, e)
		}
		for name, wrong := range map[string]Release{
			"other digest":  {m.Version, strings.Repeat("0", 64)},
			"other version": {"1.2.4", pin.ManifestSHA256},
			"unpinned":      {m.Version, ""},
		} {
			if _, e := authenticateReleaseFile(dir, wrong); !errors.Is(e, ErrReleaseTarget) {
				t.Fatalf("%s accepted with %s: %v", layout.name, name, e)
			}
		}
		// Bytes swapped after the pin was taken, even validly re-signed, refuse.
		m2 := m
		m2.Commit = strings.Repeat("b", 40)
		other, otherSig, e := EncodeRelease(m2, releaseKey())
		if e != nil {
			t.Fatal(e)
		}
		if e = os.WriteFile(dir+"/release.json", other, 0644); e != nil {
			t.Fatal(e)
		}
		if layout.sig {
			if e = os.WriteFile(dir+"/release.sig", otherSig, 0644); e != nil {
				t.Fatal(e)
			}
		}
		if _, e := authenticateReleaseFile(dir, pin); !errors.Is(e, ErrReleaseTarget) {
			t.Fatalf("%s accepted swapped manifest: %v", layout.name, e)
		}
	}
}
