// runtime-release is build tooling, not a daemon or installed host operator.
// It deliberately receives trust and the approved target separately from the
// bundle. A public key inside a release can never authorize that release.
package main

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"github.com/Open-Habitat/open-habitat/internal/host"
	"io"
	"os"
	"path/filepath"
	"syscall"
)

func main() {
	if err := run(); err != nil {
		b, _ := json.Marshal(map[string]any{"schema_version": 1, "error": map[string]string{"code": "runtime_release_failed", "message": err.Error()}})
		fmt.Fprintln(os.Stderr, string(b))
		os.Exit(1)
	}
}
func run() error {
	if len(os.Args) < 2 {
		return errors.New("expected key-create|sign|verify|stage; use COMMAND --help")
	}
	command := os.Args[1]
	fs := flag.NewFlagSet(command, flag.ContinueOnError)
	dir := fs.String("directory", "", "release directory (required)")
	key := fs.String("key-file", "", "independently trusted raw public key; sign uses private key")
	version := fs.String("version", "", "exact approved release version")
	commit := fs.String("commit", "", "full source commit (sign only)")
	digest := fs.String("manifest-sha256", "", "independently approved manifest digest (verify/stage)")
	parent := fs.String("stage-parent", "", "existing trusted root-owned 0700 directory (stage only)")
	if err := fs.Parse(os.Args[2:]); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return errors.New("invalid arguments")
	}
	if fs.NArg() != 0 || *key == "" {
		return errors.New("key-file required; no positional arguments")
	}
	if command == "key-create" {
		pub, priv, e := ed25519.GenerateKey(rand.Reader)
		if e != nil {
			return e
		}
		if e = writeNew(*key, priv, 0600); e != nil {
			return e
		}
		if e = writeNew(*key+".pub", pub, 0644); e != nil {
			return e
		}
		fmt.Println(`{"schema_version":1,"data":{"status":"development-key-created"},"warnings":["Test key only; not approved production trust"]}`)
		return nil
	}
	if *dir == "" || *version == "" {
		return errors.New("directory and exact version required")
	}
	keyBytes, e := readInput(*key, ed25519.PrivateKeySize)
	if e != nil {
		return errors.New("key file unavailable")
	}
	if command == "sign" {
		if *commit == "" || len(keyBytes) != ed25519.PrivateKeySize {
			return errors.New("commit and raw private key required")
		}
		b, e := readInput(filepath.Join(*dir, "artifact.json"), host.MaxReleaseManifestBytes)
		if e != nil {
			return e
		}
		var a host.ReleaseArtifact
		d := json.NewDecoder(bytes.NewReader(b))
		d.DisallowUnknownFields()
		if e = d.Decode(&a); e != nil || d.Decode(new(any)) != io.EOF {
			return errors.New("invalid artifact document")
		}
		if a.Closure == nil {
			return errors.New("complete closure required")
		}
		host.SortRuntimeComponents(a.Closure)
		m := host.ReleaseManifest{SchemaVersion: 1, Version: *version, Commit: *commit, Platform: "ubuntu-24.04-amd64", Artifacts: []host.ReleaseArtifact{a}}
		manifest, sig, e := host.EncodeRelease(m, keyBytes)
		if e != nil {
			return e
		}
		sum := sha256.Sum256(manifest)
		// Verify the produced closure independently before publishing signed metadata.
		r, e := host.AuthenticateRelease(manifest, sig, ed25519.PrivateKey(keyBytes).Public().(ed25519.PublicKey), host.Release{Version: *version, ManifestSHA256: hex.EncodeToString(sum[:])})
		if e != nil {
			return e
		}
		if e = r.VerifyArchives(context.Background(), nil, opener(*dir)); e != nil {
			return e
		}
		if e = writeNew(filepath.Join(*dir, "release.json"), manifest, 0644); e != nil {
			return e
		}
		if e = writeNew(filepath.Join(*dir, "release.sig"), sig, 0644); e != nil {
			return e
		}
		fmt.Printf("{\"schema_version\":1,\"data\":{\"manifest_sha256\":\"%x\",\"status\":\"signed\"},\"warnings\":[]}\n", sum)
		return nil
	}
	if command != "verify" && command != "stage" {
		return errors.New("unknown command")
	}
	b, e := readInput(filepath.Join(*dir, "release.json"), host.MaxReleaseManifestBytes)
	if e != nil {
		return e
	}
	sig, e := readInput(filepath.Join(*dir, "release.sig"), ed25519.SignatureSize)
	if e != nil {
		return e
	}
	r, e := host.AuthenticateRelease(b, sig, keyBytes, host.Release{Version: *version, ManifestSHA256: *digest})
	if e != nil {
		return e
	}
	// This helper publishes only core releases. Do not label a future profile
	// manifest fully verified while silently selecting just its implicit core.
	var manifest host.ReleaseManifest
	if json.Unmarshal(b, &manifest) != nil || len(manifest.Artifacts) != 1 || manifest.Artifacts[0].Profile != "core" {
		return errors.New("core-only manifest required; optional profiles are not supported")
	}
	if e = r.VerifyArchives(context.Background(), nil, opener(*dir)); e != nil {
		return e
	}
	if command == "stage" {
		root, e := os.OpenRoot(*parent)
		if e != nil {
			return e
		}
		defer root.Close()
		name, e := r.StageRelease(context.Background(), nil, root, opener(*dir))
		if e != nil {
			return e
		}
		b, _ := json.Marshal(map[string]any{"schema_version": 1, "data": map[string]string{"status": "staged", "name": name}, "warnings": []string{}})
		fmt.Println(string(b))
		return nil
	}
	fmt.Println(`{"schema_version":1,"data":{"status":"verified"},"warnings":[]}`)
	return nil
}
func opener(dir string) func(string) (io.ReadCloser, error) {
	return func(name string) (io.ReadCloser, error) { return openInput(filepath.Join(dir, name)) }
}
func writeNew(path string, b []byte, mode os.FileMode) error {
	f, e := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, mode)
	if e != nil {
		return e
	}
	_, e = f.Write(b)
	ce := f.Close()
	if e != nil {
		return e
	}
	return ce
}

// Untrusted release files must not turn a bounded authenticator into an
// unbounded allocation or a blocking FIFO open before authentication.
func openInput(path string) (*os.File, error) {
	f, e := os.OpenFile(path, os.O_RDONLY|syscall.O_NONBLOCK, 0)
	if e != nil {
		return nil, errors.New("release input unavailable")
	}
	info, e := f.Stat()
	if e != nil || !info.Mode().IsRegular() {
		f.Close()
		return nil, errors.New("regular release input required")
	}
	return f, nil
}
func readInput(path string, limit int64) ([]byte, error) {
	f, e := openInput(path)
	if e != nil {
		return nil, e
	}
	defer f.Close()
	info, e := f.Stat()
	if e != nil || info.Size() > limit {
		return nil, errors.New("release input exceeds size limit")
	}
	b, e := io.ReadAll(io.LimitReader(f, limit+1))
	if e != nil || int64(len(b)) > limit {
		return nil, errors.New("release input unavailable or oversized")
	}
	return b, nil
}
