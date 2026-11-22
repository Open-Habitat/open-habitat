package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/host"
)

func commandOutput(t *testing.T, args ...string) ([]byte, error) {
	t.Helper()
	out, err := os.CreateTemp(t.TempDir(), "stdout")
	if err != nil {
		t.Fatal(err)
	}
	defer out.Close()
	oldArgs, oldOut := os.Args, os.Stdout
	defer func() { os.Args, os.Stdout = oldArgs, oldOut }()
	os.Args, os.Stdout = append([]string{"runtime-release"}, args...), out
	err = run()
	b, readErr := os.ReadFile(out.Name())
	if readErr != nil {
		t.Fatal(readErr)
	}
	return b, err
}

func TestVerificationContractQuery(t *testing.T) {
	b, err := commandOutput(t, "contract", "show", "--json")
	if err != nil {
		t.Fatal(err)
	}
	var result struct {
		Data map[string]string `json:"data"`
	}
	if json.Unmarshal(b, &result) != nil || result.Data["verification_contract"] != host.RuntimeVerificationContract || result.Data["status"] != "" {
		t.Fatalf("query must identify code without claiming verification: %s", b)
	}
	for _, args := range [][]string{{"contract"}, {"contract", "show", "extra"}, {"contract", "show", "--directory", "/unread"}} {
		if _, err := commandOutput(t, args...); err == nil {
			t.Fatalf("accepted %v", args)
		}
	}
}

func TestVerifyReportsRunningContractAndStillChecksBytes(t *testing.T) {
	dir := t.TempDir()
	m, archive := verificationFixture(t)
	for _, id := range []string{"", host.RuntimeVerificationContract, "runtime-release-v999"} {
		t.Run("manifest-"+id, func(t *testing.T) {
			m.VerificationContract = id
			manifest, err := host.EncodeRelease(m)
			if err != nil {
				t.Fatal(err)
			}
			for name, b := range map[string][]byte{"release.json": manifest, "core.tar.gz": archive} {
				if err := os.WriteFile(filepath.Join(dir, name), b, 0600); err != nil {
					t.Fatal(err)
				}
			}
			pin := digestBytes(manifest)
			args := []string{"verify", "--json", "--directory", dir, "--version", m.Version, "--manifest-sha256", pin}
			b, err := commandOutput(t, args...)
			if err != nil {
				t.Fatal(err)
			}
			var result struct {
				Data map[string]string `json:"data"`
			}
			if json.Unmarshal(b, &result) != nil || result.Data["status"] != "verified" || result.Data["verification_contract"] != host.RuntimeVerificationContract || result.Data["manifest_verification_contract"] != id || result.Data["manifest_sha256"] != pin {
				t.Fatalf("incorrect verification identity: %s", b)
			}
			if err := os.WriteFile(filepath.Join(dir, "core.tar.gz"), []byte("corrupt"), 0600); err != nil {
				t.Fatal(err)
			}
			if b, err := commandOutput(t, args...); err == nil || len(b) != 0 {
				t.Fatalf("contract bypassed checks or emitted success: %s %v", b, err)
			}
		})
	}
}

func digestBytes(b []byte) string { return fmt.Sprintf("%x", sha256.Sum256(b)) }

// Small structurally valid core closure; verify checks inventory and native lock
// consistency, not the manifest writer's current product qualification pins.
func verificationFixture(t *testing.T) (host.ReleaseManifest, []byte) {
	t.Helper()
	files := []struct{ path, content, owner, kind, version string }{
		{"NOTICE", "Synthetic package licence", "npm:node_modules/demo", "npm", "1.0.0"},
		{"runtime/package-lock.json", `{"packages":{"":{},"node_modules/demo":{"version":"1.0.0"}}}`, "lock", "lock", "1"},
	}
	closure := &host.RuntimeClosure{}
	var raw bytes.Buffer
	tw := tar.NewWriter(&raw)
	for _, f := range files {
		hash := digestBytes([]byte(f.content))
		closure.Files = append(closure.Files, host.RuntimeFile{Path: f.path, SHA256: hash, Component: f.owner, Mode: 0644})
		closure.Components = append(closure.Components, host.RuntimeComponent{Name: f.owner, Version: f.version, Kind: f.kind, SHA256: digestBytes([]byte(hash + " " + f.path + "\n")), LicenseFiles: []string{f.path}})
		if err := tw.WriteHeader(&tar.Header{Name: f.path, Mode: 0644, Size: int64(len(f.content)), Typeflag: tar.TypeReg}); err != nil {
			t.Fatal(err)
		}
		if _, err := tw.Write([]byte(f.content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := tw.Close(); err != nil {
		t.Fatal(err)
	}
	var compressed bytes.Buffer
	gz := gzip.NewWriter(&compressed)
	if _, err := gz.Write(raw.Bytes()); err != nil {
		t.Fatal(err)
	}
	if err := gz.Close(); err != nil {
		t.Fatal(err)
	}
	archive := compressed.Bytes()
	a := host.ReleaseArtifact{Profile: "core", Archive: "core.tar.gz", SHA256: digestBytes(archive), Size: int64(len(archive)), ExpandedSize: int64(raw.Len()), Entries: len(files), Requires: []string{}, Packages: []host.RuntimePackage{}, Closure: closure}
	return host.ReleaseManifest{SchemaVersion: 2, Version: "1.2.3", Commit: strings.Repeat("a", 40), Platform: "ubuntu-24.04-amd64", Artifacts: []host.ReleaseArtifact{a}}, archive
}
