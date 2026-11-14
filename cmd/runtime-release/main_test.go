package main

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"github.com/open-habitat/open-habitat/internal/host"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
)

func TestReleaseInputBoundsAndSpecialFiles(t *testing.T) {
	dir := t.TempDir()
	regular := filepath.Join(dir, "regular")
	if err := os.WriteFile(regular, []byte("bounds"), 0600); err != nil {
		t.Fatal(err)
	}
	if b, err := readInput(regular, 6); err != nil || string(b) != "bounds" {
		t.Fatalf("exact bound: %q %v", b, err)
	}
	if _, err := readInput(regular, 5); err == nil {
		t.Fatal("accepted oversized release input")
	}
	fifo := filepath.Join(dir, "fifo")
	if err := syscall.Mkfifo(fifo, 0600); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{fifo, dir} {
		if f, err := openInput(path); err == nil {
			f.Close()
			t.Fatal("accepted non-regular release input")
		}
	}
}

func TestArtifactListIsComplete(t *testing.T) {
	dir := t.TempDir()
	for _, input := range []string{`[]`, `null`, `[{}]`, `[{"closure":{"files":[],"components":[]},"unknown":1}]`, `[] {}`} {
		p := filepath.Join(dir, "artifacts.json")
		if e := os.WriteFile(p, []byte(input), 0600); e != nil {
			t.Fatal(e)
		}
		if _, e := readArtifacts(p, true); e == nil {
			t.Fatalf("accepted %s", input)
		}
	}
}

func TestVerifyRefusesUnpinnedManifestAndRetiredKeyInputs(t *testing.T) {
	dir := t.TempDir()
	manifest := []byte(`{"schema_version":2}`)
	if err := os.WriteFile(filepath.Join(dir, "release.json"), manifest, 0600); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(manifest)
	pinned := hex.EncodeToString(sum[:])
	call := func(args ...string) error {
		saved := os.Args
		defer func() { os.Args = saved }()
		os.Args = append([]string{"runtime-release"}, args...)
		return run()
	}
	for name, args := range map[string][]string{
		"wrong digest":               {"verify", "--directory", dir, "--version", "1.0.0", "--manifest-sha256", strings.Repeat("0", 64)},
		"unpinned":                   {"stage", "--directory", dir, "--version", "1.0.0"},
		"manifest no commit":         {"manifest", "--directory", dir, "--version", "1.0.0"},
		"install missing selection":  {"install", "--directory", dir, "--version", "1.0.0"},
		"install optional selection": {"install", "--directory", dir, "--version", "1.0.0", "--select", "editor"},
		"install dry run":            {"install", "--directory", dir, "--version", "1.0.0", "--select", "core", "--dry-run"},
		"install stage parent":       {"install", "--directory", dir, "--version", "1.0.0", "--select", "core", "--stage-parent", dir},
		"verify prefix":              {"verify", "--directory", dir, "--version", "1.0.0", "--prefix", "/opt/open-habitat"},
		// Releases are unsigned: the retired key input and commands are refused, not ignored.
		"key file":   {"verify", "--directory", dir, "--version", "1.0.0", "--manifest-sha256", pinned, "--key-file", filepath.Join(dir, "release.json")},
		"sign":       {"sign", "--directory", dir, "--version", "1.0.0", "--commit", strings.Repeat("a", 40), "--platform", "ubuntu-24.04-amd64"},
		"key-create": {"key-create", "--directory", dir, "--version", "1.0.0"},
	} {
		err := call(args...)
		if err == nil {
			t.Fatalf("%s accepted", name)
		}
		if (name == "wrong digest" || name == "unpinned") && !errors.Is(err, host.ErrReleaseTarget) {
			t.Fatalf("%s: %v", name, err)
		}
	}
	// The pin passes and the manifest itself is then refused as invalid.
	if err := call("verify", "--directory", dir, "--version", "1.0.0", "--manifest-sha256", pinned); !errors.Is(err, host.ErrRelease) {
		t.Fatalf("pinned verify: %v", err)
	}
}
