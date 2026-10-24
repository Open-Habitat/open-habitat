//go:build linux

package host

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/ed25519"
	"encoding/binary"
	"errors"
	"os"
	"runtime"
	"testing"
)

func otherPlatform() string {
	if HostPlatform() == "ubuntu-24.04-arm64" {
		return "ubuntu-24.04-amd64"
	}
	return "ubuntu-24.04-arm64"
}

func TestReleasePlatformPackages(t *testing.T) {
	for _, tc := range []struct {
		platform, arch string
		valid          bool
	}{
		{"ubuntu-24.04-amd64", "amd64", true},
		{"ubuntu-24.04-arm64", "arm64", true},
		{"ubuntu-24.04-arm64", "all", true},
		// A requirement for the other architecture can never be met on the
		// host the manifest is for; it is a build error, not drift.
		{"ubuntu-24.04-arm64", "amd64", false},
		{"ubuntu-24.04-amd64", "arm64", false},
		{"ubuntu-24.04-armhf", "armhf", false},
		{"ubuntu-22.04-amd64", "amd64", false},
	} {
		a, _ := releaseFixture(t)
		a.Packages = []RuntimePackage{{"git", tc.arch, "1"}}
		m := releaseManifest(a)
		m.Platform = tc.platform
		if validRelease(m) != tc.valid {
			t.Errorf("%s with %s package: valid=%v", tc.platform, tc.arch, !tc.valid)
		}
	}
}

func TestHostReleasePlatform(t *testing.T) {
	if HostPlatform() == "" {
		t.Skip("unsupported build architecture " + runtime.GOARCH)
	}
	a, _ := releaseFixture(t)
	for _, platform := range []string{HostPlatform(), otherPlatform()} {
		m := releaseManifest(a)
		m.Platform = platform
		b, sig, e := EncodeRelease(m, releaseKey())
		if e != nil {
			t.Fatal(e)
		}
		target := Release{m.Version, releaseDigest(b)}
		pub := releaseKey().Public().(ed25519.PublicKey)
		// Build tooling verifies a release for any supported platform.
		if _, e = AuthenticateRelease(b, sig, pub, target); e != nil {
			t.Fatal(e)
		}
		r, e := authenticateHostRelease(b, sig, pub, target)
		if platform == HostPlatform() && (e != nil || r.Platform() != platform) {
			t.Fatalf("own platform refused: %v", e)
		}
		if platform != HostPlatform() && (!errors.Is(e, ErrReleasePlatform) || r.Platform() != "") {
			t.Fatalf("foreign platform %s: %v", platform, e)
		}
	}
}

// elfHeader is the identifying start of a 64-bit little-endian ELF file.
func elfHeader(class, data byte, machine uint16) []byte {
	b := make([]byte, 64)
	copy(b, "\x7fELF")
	b[4], b[5], b[6] = class, data, 1
	binary.LittleEndian.PutUint16(b[18:], machine)
	return b
}

func TestReleaseExecutableArchitecture(t *testing.T) {
	build := func(name string, content []byte, mode int64) (ReleaseArtifact, *os.File) {
		var raw bytes.Buffer
		tw := tar.NewWriter(&raw)
		if e := tw.WriteHeader(&tar.Header{Name: name, Mode: mode, Size: int64(len(content)), Typeflag: tar.TypeReg}); e != nil {
			t.Fatal(e)
		}
		_, _ = tw.Write(content)
		_ = tw.Close()
		var gz bytes.Buffer
		w := gzip.NewWriter(&gz)
		_, _ = w.Write(raw.Bytes())
		_ = w.Close()
		file := RuntimeFile{Path: name, SHA256: releaseDigest(content), Component: "tool", Mode: mode}
		a := ReleaseArtifact{Profile: "editor", Archive: "editor.tar.gz", SHA256: releaseDigest(gz.Bytes()), Size: int64(gz.Len()), ExpandedSize: int64(raw.Len()), Entries: 1, Requires: []string{}, Packages: []RuntimePackage{},
			Closure: &RuntimeClosure{Files: []RuntimeFile{file}, Components: []RuntimeComponent{{Name: "tool", Version: "1", Kind: "native", SHA256: closureSum(file.SHA256 + " " + file.Path + "\n"), LicenseFiles: []string{file.Path}}}}}
		f, e := os.CreateTemp(t.TempDir(), "archive")
		if e != nil {
			t.Fatal(e)
		}
		t.Cleanup(func() { f.Close() })
		_, _ = f.Write(gz.Bytes())
		return a, f
	}
	x86 := elfHeader(2, 1, elfMachineX8664)
	arm := elfHeader(2, 1, elfMachineAArch64)
	const entry = "runtime/bin/tool"
	for _, tc := range []struct {
		name     string
		path     string
		content  []byte
		mode     int64
		platform string
		ok       bool
	}{
		{"amd64 binary on amd64", entry, x86, 0755, "ubuntu-24.04-amd64", true},
		{"arm64 binary on arm64", entry, arm, 0755, "ubuntu-24.04-arm64", true},
		{"amd64 binary on arm64", entry, x86, 0755, "ubuntu-24.04-arm64", false},
		{"arm64 binary on amd64", entry, arm, 0755, "ubuntu-24.04-amd64", false},
		{"32-bit binary", entry, elfHeader(1, 1, elfMachineAArch64), 0755, "ubuntu-24.04-arm64", false},
		{"big-endian binary", entry, elfHeader(2, 2, elfMachineAArch64), 0755, "ubuntu-24.04-arm64", false},
		{"truncated header", entry, x86[:10], 0755, "ubuntu-24.04-amd64", false},
		{"script", entry, []byte("#!/bin/sh\nexit 0\n"), 0755, "ubuntu-24.04-arm64", true},
		{"foreign data file", entry, x86, 0644, "ubuntu-24.04-arm64", true},
		// Upstream trees vendor prebuilds for every platform (npm native
		// addons, ripgrep in code-server) and pick one at run time.
		{"vendored foreign prebuild", "runtime/node_modules/x/prebuilds/linux-x64/x.node", x86, 0755, "ubuntu-24.04-arm64", true},
		{"nested bin directory", "runtime/bin/sub/tool", x86, 0755, "ubuntu-24.04-arm64", true},
		{"editor Node for another platform", "runtime/lib/node", x86, 0755, "ubuntu-24.04-arm64", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, f := build(tc.path, tc.content, tc.mode)
			e := walkReleaseTar(context.Background(), f, a, tc.platform, nil)
			if (e == nil) != tc.ok {
				t.Fatalf("accepted=%v: %v", e == nil, e)
			}
			if e != nil && !errors.Is(e, ErrReleaseArchive) {
				t.Fatalf("wrong class: %v", e)
			}
		})
	}
}

func TestReleaseNPMLockCPU(t *testing.T) {
	lock := []byte(`{"packages":{"":{},"node_modules/sdk":{"version":"1.0.0"},"node_modules/sdk-linux-x64":{"version":"1.0.0","os":["linux"],"cpu":["x64"]},"node_modules/sdk-linux-arm64":{"version":"1.0.0","os":["linux"],"cpu":["arm64"]}}}`)
	closure := func(names ...string) *RuntimeClosure {
		c := &RuntimeClosure{}
		for _, n := range names {
			c.Components = append(c.Components, RuntimeComponent{Name: "npm:node_modules/" + n, Version: "1.0.0", Kind: "npm"})
		}
		return c
	}
	if npmCPU("ubuntu-24.04-amd64") != "x64" || npmCPU("ubuntu-24.04-arm64") != "arm64" {
		t.Fatal("npm CPU spelling")
	}
	for _, tc := range []struct {
		cpu  string
		pkgs []string
		ok   bool
	}{
		{"x64", []string{"sdk", "sdk-linux-x64"}, true},
		{"arm64", []string{"sdk", "sdk-linux-arm64"}, true},
		{"arm64", []string{"sdk", "sdk-linux-x64"}, false},
		{"arm64", []string{"sdk"}, false},
		{"x64", []string{"sdk", "sdk-linux-x64", "sdk-linux-arm64"}, false},
	} {
		if verifyNPMLock(lock, closure(tc.pkgs...), tc.cpu) != tc.ok {
			t.Errorf("%s %v: accepted=%v", tc.cpu, tc.pkgs, !tc.ok)
		}
	}
}
