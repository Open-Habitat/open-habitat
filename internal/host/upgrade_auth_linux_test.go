//go:build linux

package host

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
	"testing"
)

func TestUpgradeReleaseAuthentication(t *testing.T) {
	pub, key, e := ed25519.GenerateKey(rand.Reader)
	if e != nil {
		t.Fatal(e)
	}
	m := ReleaseManifest{SchemaVersion: 1, Version: "2.0.0", Commit: strings.Repeat("a", 40), Platform: "ubuntu-24.04-amd64", Artifacts: []ReleaseArtifact{{Profile: "core", Archive: "core.tar.gz", SHA256: strings.Repeat("a", 64), Size: 1, ExpandedSize: 1024, Entries: 1, Requires: []string{}, Packages: []RuntimePackage{}}}, Upgrade: &ReleaseUpgrade{Protocol: 1, Predecessor: Release{"1.0.0", strings.Repeat("b", 64)}, Product: []ProductFile{{"open-habitat", strings.Repeat("c", 64), 0755}, {"web/index.html", strings.Repeat("d", 64), 0644}}}}
	authenticate := func(b, sig []byte) error {
		h := sha256.Sum256(b)
		_, e := AuthenticateRelease(b, sig, pub, Release{m.Version, hex.EncodeToString(h[:])})
		return e
	}
	b, sig, e := EncodeRelease(m, key)
	if e != nil {
		t.Fatal(e)
	}
	if e = authenticate(b, sig); e != nil {
		t.Fatal(e)
	}
	// The predecessor and product bytes are both covered by the release signature.
	for _, change := range []func(*ReleaseManifest){func(m *ReleaseManifest) { m.Upgrade.Predecessor.ManifestSHA256 = strings.Repeat("e", 64) }, func(m *ReleaseManifest) { m.Upgrade.Product[0].SHA256 = strings.Repeat("f", 64) }} {
		var altered ReleaseManifest
		if e = json.Unmarshal(b, &altered); e != nil {
			t.Fatal(e)
		}
		change(&altered)
		data, _ := json.Marshal(altered)
		if authenticate(data, sig) == nil {
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
