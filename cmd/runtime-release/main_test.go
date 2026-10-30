package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"github.com/Open-Habitat/open-habitat/internal/host"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
)

func TestReleaseInputBoundsAndSpecialFiles(t *testing.T) {
	dir := t.TempDir()
	regular := filepath.Join(dir, "regular")
	if err := os.WriteFile(regular, []byte("signed"), 0600); err != nil {
		t.Fatal(err)
	}
	if b, err := readInput(regular, 6); err != nil || string(b) != "signed" {
		t.Fatalf("exact bound: %q %v", b, err)
	}
	if _, err := readInput(regular, 5); err == nil {
		t.Fatal("accepted oversized manifest/key/signature")
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

func TestVerifyRefusesUnpinnedManifestAndBadOptionalSignature(t *testing.T) {
	dir := t.TempDir()
	manifest := []byte(`{"schema_version":2}`)
	if err := os.WriteFile(filepath.Join(dir, "release.json"), manifest, 0600); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(manifest)
	pinned := hex.EncodeToString(sum[:])
	key := filepath.Join(dir, "key.pub")
	pub, _, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(key, pub, 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "release.sig"), make([]byte, 64), 0600); err != nil {
		t.Fatal(err)
	}
	call := func(args ...string) error {
		saved := os.Args
		defer func() { os.Args = saved }()
		os.Args = append([]string{"runtime-release"}, args...)
		return run()
	}
	for name, args := range map[string][]string{
		"wrong digest":  {"verify", "--directory", dir, "--version", "1.0.0", "--manifest-sha256", strings.Repeat("0", 64)},
		"unpinned":      {"stage", "--directory", dir, "--version", "1.0.0"},
		"bad signature": {"verify", "--directory", dir, "--version", "1.0.0", "--manifest-sha256", pinned, "--key-file", key},
		"sign keyless":  {"sign", "--directory", dir, "--version", "1.0.0"},
	} {
		err := call(args...)
		if err == nil {
			t.Fatalf("%s accepted", name)
		}
		if name == "bad signature" && !strings.Contains(err.Error(), "release_signature_invalid") {
			t.Fatalf("bad signature: %v", err)
		}
		if (name == "wrong digest" || name == "unpinned") && !errors.Is(err, host.ErrReleaseTarget) {
			t.Fatalf("%s: %v", name, err)
		}
	}
	// Without --key-file the signature is not read: the pin passes and the
	// manifest itself is then refused as invalid, not as unsigned.
	if err := call("verify", "--directory", dir, "--version", "1.0.0", "--manifest-sha256", pinned); !errors.Is(err, host.ErrRelease) {
		t.Fatalf("pinned keyless verify: %v", err)
	}
}
