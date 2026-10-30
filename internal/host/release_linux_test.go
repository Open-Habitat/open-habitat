//go:build linux

package host

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func releaseKey() ed25519.PrivateKey { return ed25519.NewKeyFromSeed(bytes.Repeat([]byte{17}, 32)) }
func releaseDigest(b []byte) string  { s := sha256.Sum256(b); return hex.EncodeToString(s[:]) }
func releaseFixture(t *testing.T, headers ...*tar.Header) (ReleaseArtifact, []byte) {
	t.Helper()
	var raw bytes.Buffer
	tw := tar.NewWriter(&raw)
	if len(headers) == 0 {
		headers = []*tar.Header{{Name: "bin/tool", Mode: 0755, Typeflag: tar.TypeReg, Size: 4}}
	}
	for _, h := range headers {
		if e := tw.WriteHeader(h); e != nil {
			t.Fatal(e)
		}
		if h.Typeflag == tar.TypeReg {
			if _, e := tw.Write(bytes.Repeat([]byte{'x'}, int(h.Size))); e != nil {
				t.Fatal(e)
			}
		}
	}
	if e := tw.Close(); e != nil {
		t.Fatal(e)
	}
	var compressed bytes.Buffer
	gz := gzip.NewWriter(&compressed)
	_, _ = gz.Write(raw.Bytes())
	if e := gz.Close(); e != nil {
		t.Fatal(e)
	}
	b := compressed.Bytes()
	return ReleaseArtifact{Profile: "core", Archive: "core.tar.gz", SHA256: releaseDigest(b), Size: int64(len(b)), ExpandedSize: int64(raw.Len()), Entries: len(headers), Requires: []string{}, Packages: []RuntimePackage{}}, b
}
func releaseManifest(a ...ReleaseArtifact) ReleaseManifest {
	return ReleaseManifest{SchemaVersion: 2, Version: "1.2.3", Commit: strings.Repeat("a", 40), Platform: "ubuntu-24.04-amd64", Artifacts: a}
}
func authenticatedFixture(t *testing.T, m ReleaseManifest) AuthenticatedRelease {
	t.Helper()
	b, _, e := EncodeRelease(m, releaseKey())
	if e != nil {
		t.Fatal(e)
	}
	r, e := AuthenticateRelease(b, Release{m.Version, releaseDigest(b)})
	if e != nil {
		t.Fatal(e)
	}
	return r
}
func TestReleaseAuthenticationAndStrictWire(t *testing.T) {
	a, _ := releaseFixture(t)
	m := releaseManifest(a)
	b, sig, e := EncodeRelease(m, releaseKey())
	if e != nil {
		t.Fatal(e)
	}
	target := Release{m.Version, releaseDigest(b)}
	// The pinned digest alone authenticates: no signature or key is consulted.
	if _, e := AuthenticateRelease(b, target); e != nil {
		t.Fatal(e)
	}
	for name, change := range map[string]func() ([]byte, Release){
		"tamper":         func() ([]byte, Release) { return append(append([]byte{}, b...), ' '), target },
		"wrong target":   func() ([]byte, Release) { return b, Release{"1.2.4", target.ManifestSHA256} },
		"wrong digest":   func() ([]byte, Release) { return b, Release{m.Version, strings.Repeat("0", 64)} },
		"unpinned":       func() ([]byte, Release) { return b, Release{m.Version, ""} },
		"uppercase pin":  func() ([]byte, Release) { return b, Release{m.Version, strings.ToUpper(target.ManifestSHA256)} },
		"empty manifest": func() ([]byte, Release) { return nil, Release{m.Version, releaseDigest(nil)} },
		// Unparseable bytes are refused on the pin before they are parsed.
		"garbage": func() ([]byte, Release) { return []byte("{"), target },
	} {
		t.Run(name, func(t *testing.T) {
			b, target := change()
			if _, e := AuthenticateRelease(b, target); !errors.Is(e, ErrReleaseTarget) {
				t.Fatalf("accepted or misreported unpinned/mismatched target: %v", e)
			}
		})
	}
	pub := releaseKey().Public().(ed25519.PublicKey)
	if !ReleaseSignatureValid(b, sig, pub) {
		t.Fatal("release cut signature does not verify")
	}
	other := ed25519.NewKeyFromSeed(bytes.Repeat([]byte{18}, 32)).Public().(ed25519.PublicKey)
	for name, ok := range map[string]bool{
		"wrong key":    ReleaseSignatureValid(b, sig, other),
		"unsigned":     ReleaseSignatureValid(b, nil, pub),
		"wrong domain": ReleaseSignatureValid(b, ed25519.Sign(releaseKey(), b), pub),
		"tamper":       ReleaseSignatureValid(append(append([]byte{}, b...), ' '), sig, pub),
	} {
		if ok {
			t.Fatalf("%s signature verified", name)
		}
	}
	for name, bad := range map[string]string{
		"duplicate":      strings.Replace(string(b), `"version":"1.2.3"`, `"version":"9.9.9","version":"1.2.3"`, 1),
		"case alias":     strings.Replace(string(b), `"version"`, `"Version"`, 1),
		"case collision": strings.Replace(string(b), `"version":"1.2.3"`, `"Version":"9.9.9","version":"1.2.3"`, 1),
		"unknown":        strings.Replace(string(b), `"schema_version":2`, `"schema_version":2,"secret":"do-not-echo"`, 1),
		"null":           strings.Replace(string(b), `"requires":[]`, `"requires":null`, 1),
		"missing":        strings.Replace(string(b), `"packages":[]`, `"unused":[]`, 1),
		"trailing":       string(b) + `{}`,
	} {
		t.Run(name, func(t *testing.T) {
			raw := []byte(bad)
			_, e := AuthenticateRelease(raw, Release{m.Version, releaseDigest(raw)})
			if !errors.Is(e, ErrRelease) || strings.Contains(e.Error(), "do-not-echo") {
				t.Fatalf("strict parse: %v", e)
			}
		})
	}
	if _, _, e := EncodeRelease(m, nil); e == nil {
		t.Fatal("nil signing key")
	}
	if _, e := (AuthenticatedRelease{}).Select(nil); e == nil {
		t.Fatal("zero capability")
	}
}

func TestReleaseProfilesAndPackageDrift(t *testing.T) {
	a, _ := releaseFixture(t)
	a.Packages = []RuntimePackage{{"git", "amd64", "1:2.43.0-1ubuntu7.3"}}
	b := a
	b.Profile = "coding"
	b.Archive = "coding.tar.gz"
	b.Packages = []RuntimePackage{{"jq", "amd64", "1.7.1-3ubuntu0.24.04.1"}}
	c := b
	c.Profile = "editor"
	c.Archive = "editor.tar.gz"
	c.Requires = []string{"coding"}
	c.Packages = []RuntimePackage{}
	m := releaseManifest(a, b, c)
	r := authenticatedFixture(t, m)
	selected, e := r.Select([]string{"core", "editor"})
	if e != nil || len(selected) != 3 {
		t.Fatalf("dependency selection: %v %v", selected, e)
	}
	selected[0].Packages[0].Version = "mutated"
	again, _ := r.Select([]string{"coding"})
	if again[0].Packages[0].Version == "mutated" {
		t.Fatal("mutable authenticated metadata")
	}
	for _, profiles := range [][]string{{"absent"}, {"coding", "coding"}, {"core", "core"}} {
		if _, e := r.Select(profiles); e == nil {
			t.Fatal("bad selection", profiles)
		}
	}
	for _, tc := range []struct {
		name           string
		observed       map[string]string
		status, reason string
	}{
		{"exact", map[string]string{"git:amd64": "1:2.43.0-1ubuntu7.3", "jq:amd64": "1.7.1-3ubuntu0.24.04.1"}, "pass", "runtime_packages_match"},
		{"security update", map[string]string{"git:amd64": "1:2.43.0-1ubuntu7.4", "jq:amd64": "1.7.1-3ubuntu0.24.04.1"}, "pass", "runtime_packages_match"},
		{"missing", map[string]string{"git:amd64": ""}, "fail", "ubuntu_package_requirement_unmet"},
		{"unknown", map[string]string{}, "unavailable", "runtime_package_observation_required"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, e := r.CheckRuntimePackages([]string{"coding"}, tc.observed)
			if e != nil || got.Status != tc.status || got.Reason != tc.reason {
				t.Fatalf("%+v %v", got, e)
			}
		})
	}
	conflict := b
	conflict.Packages = []RuntimePackage{{"git", "amd64", "2.0"}}
	r = authenticatedFixture(t, releaseManifest(a, conflict))
	if _, e := r.Select([]string{"coding"}); e != nil {
		t.Fatal("minimum versions should compose", e)
	}
	for name, mutate := range map[string]func(*ReleaseManifest){
		"cycle":              func(m *ReleaseManifest) { m.Artifacts[1].Requires = []string{"editor"} },
		"unknown dependency": func(m *ReleaseManifest) { m.Artifacts[1].Requires = []string{"absent"} },
		"core dependency":    func(m *ReleaseManifest) { m.Artifacts[0].Requires = []string{"coding"} },
		"duplicate archive":  func(m *ReleaseManifest) { m.Artifacts[1].Archive = m.Artifacts[0].Archive },
		"duplicate profile":  func(m *ReleaseManifest) { m.Artifacts[1].Profile = "core" },
		"floating package":   func(m *ReleaseManifest) { m.Artifacts[0].Packages[0].Version = "latest" },
		"path archive":       func(m *ReleaseManifest) { m.Artifacts[0].Archive = "../core.tar.gz" },
		"platform":           func(m *ReleaseManifest) { m.Platform = "ubuntu-latest" },
		"oversize":           func(m *ReleaseManifest) { m.Artifacts[0].Size = 17 << 30 },
	} {
		t.Run(name, func(t *testing.T) {
			raw, _ := json.Marshal(m)
			var copy ReleaseManifest
			_ = json.Unmarshal(raw, &copy)
			mutate(&copy)
			if _, _, e := EncodeRelease(copy, releaseKey()); e == nil {
				t.Fatal("invalid build input")
			}
		})
	}
}
