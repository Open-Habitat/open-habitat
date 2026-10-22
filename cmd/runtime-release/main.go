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
	keyBytes, e := os.ReadFile(*key)
	if e != nil {
		return errors.New("key file unavailable")
	}
	if command == "sign" {
		if *commit == "" || len(keyBytes) != ed25519.PrivateKeySize {
			return errors.New("commit and raw private key required")
		}
		b, e := os.ReadFile(filepath.Join(*dir, "artifact.json"))
		if e != nil {
			return e
		}
		var a host.ReleaseArtifact
		d := json.NewDecoder(bytes.NewReader(b))
		d.DisallowUnknownFields()
		if e = d.Decode(&a); e != nil {
			return e
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
	b, e := os.ReadFile(filepath.Join(*dir, "release.json"))
	if e != nil {
		return e
	}
	sig, e := os.ReadFile(filepath.Join(*dir, "release.sig"))
	if e != nil {
		return e
	}
	r, e := host.AuthenticateRelease(b, sig, keyBytes, host.Release{Version: *version, ManifestSHA256: *digest})
	if e != nil {
		return e
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
	return func(name string) (io.ReadCloser, error) { return os.Open(filepath.Join(dir, name)) }
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
