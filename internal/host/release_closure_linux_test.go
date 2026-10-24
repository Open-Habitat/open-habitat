//go:build linux

package host

import (
	"archive/tar"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"strings"
	"testing"
)

func closureSum(s string) string { h := sha256.Sum256([]byte(s)); return hex.EncodeToString(h[:]) }
func closureFixture(t *testing.T) (ReleaseArtifact, []byte) {
	t.Helper()
	a, b := releaseFixture(t, &tar.Header{Name: "LICENSE", Mode: 0644, Size: 4, Typeflag: tar.TypeReg})
	a.Profile = "editor"
	a.Archive = "editor.tar.gz"
	f := RuntimeFile{Path: "LICENSE", SHA256: closureSum("xxxx"), Component: "editor", Mode: 0644}
	a.Closure = &RuntimeClosure{Files: []RuntimeFile{f}, Components: []RuntimeComponent{{Name: "editor", Version: "1.0.0", Kind: "license", SHA256: closureSum(f.SHA256 + " LICENSE\n"), LicenseFiles: []string{"LICENSE"}}}}
	return a, b
}
func TestReleaseClosureInventory(t *testing.T) {
	a, b := closureFixture(t)
	if !validRuntimeClosure(a) {
		t.Fatal("valid inventory refused")
	}
	for name, mutate := range map[string]func(*ReleaseArtifact){
		"missing licence":          func(a *ReleaseArtifact) { a.Closure.Components[0].LicenseFiles = nil },
		"foreign licence":          func(a *ReleaseArtifact) { a.Closure.Components[0].LicenseFiles = []string{"absent"} },
		"missing member":           func(a *ReleaseArtifact) { a.Closure.Files = nil },
		"extra member":             func(a *ReleaseArtifact) { a.Closure.Files = append(a.Closure.Files, RuntimeFile{Path: "unrecorded"}) },
		"missing component":        func(a *ReleaseArtifact) { a.Closure.Components = nil },
		"changed component digest": func(a *ReleaseArtifact) { a.Closure.Components[0].SHA256 = strings.Repeat("0", 64) },
	} {
		t.Run(name, func(t *testing.T) {
			copy := a
			copy.Closure = cloneRuntimeClosure(a.Closure)
			mutate(&copy)
			if validRuntimeClosure(copy) {
				t.Fatal("accepted incomplete inventory")
			}
		})
	}
	f, e := os.CreateTemp(t.TempDir(), "archive")
	if e != nil {
		t.Fatal(e)
	}
	defer f.Close()
	_, _ = f.Write(b)
	if e = walkReleaseTar(context.Background(), f, a, "ubuntu-24.04-amd64", nil); e != nil {
		t.Fatal(e)
	}
	for _, name := range []string{"renamed", "digest", "mode"} {
		t.Run(name, func(t *testing.T) {
			copy := a
			copy.Closure = cloneRuntimeClosure(a.Closure)
			switch name {
			case "renamed":
				copy.Closure.Files[0].Path = "other"
			case "digest":
				copy.Closure.Files[0].SHA256 = strings.Repeat("0", 64)
			case "mode":
				copy.Closure.Files[0].Mode = 0755
			}
			if e := walkReleaseTar(context.Background(), f, copy, "ubuntu-24.04-amd64", nil); e == nil {
				t.Fatal("accepted mismatched signed file record")
			}
		})
	}
	core, _ := releaseFixture(t)
	r := authenticatedFixture(t, releaseManifest(core, a))
	if err := r.VerifyArchives(context.Background(), []string{"editor"}, archiveOpener(b)); err == nil {
		t.Fatal("accepted core with no closure")
	}
	// Deep-copy selection must not let an unprivileged caller mutate capability.
	selected, err := r.Select([]string{"editor"})
	if err != nil {
		t.Fatal(err)
	}
	selected[1].Closure.Components[0].LicenseFiles[0] = "changed"
	again, _ := r.Select([]string{"editor"})
	if again[1].Closure.Components[0].LicenseFiles[0] != "LICENSE" {
		t.Fatal("mutable authenticated state")
	}
}
func TestReleaseClosureNPMLock(t *testing.T) {
	lock := []byte(`{"packages":{"":{},"node_modules/a":{"version":"1.2.3"},"node_modules/a/node_modules/b":{"version":"2.0.0"},"node_modules/mac":{"version":"1.0.0","os":["darwin"]},"node_modules/musl":{"version":"1.0.0","os":["linux"],"cpu":["x64"],"libc":["musl"]}}}`)
	c := &RuntimeClosure{Components: []RuntimeComponent{{Name: "npm:node_modules/a", Version: "1.2.3", Kind: "npm"}, {Name: "npm:node_modules/a/node_modules/b", Version: "2.0.0", Kind: "npm"}}}
	if !verifyNPMLock(lock, c, "x64") {
		t.Fatal("valid graph")
	}
	for _, change := range []string{"missing", "extra", "wrong-version", "foreign-platform"} {
		t.Run(change, func(t *testing.T) {
			copy := cloneRuntimeClosure(c)
			switch change {
			case "missing":
				copy.Components = copy.Components[:1]
			case "extra":
				copy.Components = append(copy.Components, RuntimeComponent{Name: "npm:node_modules/extra", Version: "1.0.0", Kind: "npm"})
			case "wrong-version":
				copy.Components[0].Version = "1.2.4"
			case "foreign-platform":
				copy.Components = append(copy.Components, RuntimeComponent{Name: "npm:node_modules/mac", Version: "1.0.0", Kind: "npm"})
			}
			if verifyNPMLock(lock, copy, "x64") {
				t.Fatal("accepted incorrect lock membership")
			}
		})
	}
}

func TestReleaseOptionalClosureRequiresLocks(t *testing.T) {
	for _, kind := range []string{"npm"} {
		t.Run(kind, func(t *testing.T) {
			a, b := closureFixture(t)
			a.Closure.Components[0].Kind = kind
			f, e := os.CreateTemp(t.TempDir(), "archive")
			if e != nil {
				t.Fatal(e)
			}
			defer f.Close()
			if _, e = f.Write(b); e != nil {
				t.Fatal(e)
			}
			if e = walkReleaseTar(context.Background(), f, a, "ubuntu-24.04-amd64", nil); e == nil {
				t.Fatal("optional package closure accepted without native lock")
			}
		})
	}
}
