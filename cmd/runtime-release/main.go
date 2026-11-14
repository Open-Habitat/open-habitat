// runtime-release builds and verifies closures; install is a root-only operator.
// verify and stage receive the approved target (version and the manifest digest
// GitHub states for the release asset) separately from the bundle; nothing in
// the bundle can authorize it. manifest writes the release.json whose SHA-256,
// once GitHub states it for the published asset, is the whole release trust.
package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"github.com/open-habitat/open-habitat/internal/host"
	"io"
	"os"
	"os/signal"
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
		return errors.New("expected manifest|verify|stage|install; use COMMAND --help")
	}
	command := os.Args[1]
	fs := flag.NewFlagSet(command, flag.ContinueOnError)
	dir := fs.String("directory", "", "release directory (required)")
	version := fs.String("version", "", "exact approved release version")
	commit := fs.String("commit", "", "full source commit (manifest only)")
	artifactsFile := fs.String("artifacts-file", "", "JSON artifact descriptor array (manifest only; default artifact.json is one core descriptor)")
	upgradeFile := fs.String("upgrade-file", "", "authenticated transition/product descriptor JSON (manifest only)")
	platform := fs.String("platform", "", "ubuntu-24.04-amd64 or ubuntu-24.04-arm64, the architecture every archive was built for (manifest only)")
	digest := fs.String("manifest-sha256", "", "independently approved manifest digest (verify/stage/install)")
	parent := fs.String("stage-parent", "", "existing trusted root-owned 0700 directory (stage only)")
	selectProfile := fs.String("select", "", "required profile: core (install only)")
	prefix := fs.String("prefix", "/opt/open-habitat", "trusted runtime installation prefix (install only; requires root)")
	dryRun := fs.Bool("dry-run", false, "refuse without writing: runtime selection has no dry-run (install only)")
	if err := fs.Parse(os.Args[2:]); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return errors.New("invalid arguments")
	}
	if fs.NArg() != 0 {
		return errors.New("no positional arguments")
	}
	if *dir == "" || *version == "" {
		return errors.New("directory and exact version required")
	}
	if command == "install" {
		if *dryRun {
			return errors.New("dry_run_unsupported: install requires locked runtime publication; use verify for read-only closure verification")
		}
		if *selectProfile != "core" || *parent != "" || *commit != "" || *artifactsFile != "" || *upgradeFile != "" || *platform != "" {
			return errors.New("install requires --select core and accepts only directory, version, manifest-sha256 and prefix")
		}
		b, err := readInput(filepath.Join(*dir, "release.json"), host.MaxReleaseManifestBytes)
		if err != nil {
			return err
		}
		ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
		defer cancel()
		if err = host.InstallRuntime(ctx, b, host.Release{Version: *version, ManifestSHA256: *digest}, *prefix, opener(*dir)); err != nil {
			return err
		}
		fmt.Println(`{"schema_version":1,"data":{"status":"installed"},"warnings":[]}`)
		return nil
	}
	installFlag := false
	fs.Visit(func(f *flag.Flag) {
		if f.Name == "select" || f.Name == "prefix" || f.Name == "dry-run" {
			installFlag = true
		}
	})
	if installFlag {
		return errors.New("select, prefix and dry-run are install-only")
	}
	if command == "manifest" {
		if *commit == "" || *platform == "" {
			return errors.New("commit and platform required")
		}
		input := *artifactsFile
		if input == "" {
			input = filepath.Join(*dir, "artifact.json")
		}
		artifacts, e := readArtifacts(input, *artifactsFile != "")
		if e != nil {
			return e
		}
		m := host.ReleaseManifest{SchemaVersion: 2, Version: *version, Commit: *commit, Platform: *platform, Artifacts: artifacts}
		if *upgradeFile != "" {
			b, e := readInput(*upgradeFile, host.MaxReleaseManifestBytes)
			if e != nil {
				return e
			}
			d := json.NewDecoder(bytes.NewReader(b))
			d.DisallowUnknownFields()
			var u host.ReleaseUpgrade
			if d.Decode(&u) != nil || d.Decode(new(any)) != io.EOF {
				return errors.New("invalid upgrade descriptor")
			}
			m.Upgrade = &u
		}
		manifest, e := host.EncodeRelease(m)
		if e != nil {
			return e
		}
		sum := sha256.Sum256(manifest)
		// Verify the produced closure independently before writing the manifest.
		r, e := host.AuthenticateRelease(manifest, host.Release{Version: *version, ManifestSHA256: hex.EncodeToString(sum[:])})
		if e != nil {
			return e
		}
		// Every installation selects core and integrations; never publish a
		// release that apply would refuse as a target.
		if e = r.RequireIntegrationTools(); e != nil {
			return e
		}
		if e = r.RequireCoreRuntime(); e != nil {
			return e
		}
		if e = r.VerifyArchives(context.Background(), allProfiles(m), opener(*dir)); e != nil {
			return e
		}
		if e = writeNew(filepath.Join(*dir, "release.json"), manifest, 0644); e != nil {
			return e
		}
		fmt.Printf("{\"schema_version\":1,\"data\":{\"manifest_sha256\":\"%x\",\"status\":\"written\"},\"warnings\":[]}\n", sum)
		return nil
	}
	if command != "verify" && command != "stage" {
		return errors.New("unknown command")
	}
	b, e := readInput(filepath.Join(*dir, "release.json"), host.MaxReleaseManifestBytes)
	if e != nil {
		return e
	}
	r, e := host.AuthenticateRelease(b, host.Release{Version: *version, ManifestSHA256: *digest})
	if e != nil {
		return e
	}
	if *artifactsFile != "" || *upgradeFile != "" || *platform != "" {
		return errors.New("artifacts-file, upgrade-file and platform are manifest-only")
	}
	// Never label a release verified while silently selecting only implicit core.
	var manifest host.ReleaseManifest
	if json.Unmarshal(b, &manifest) != nil {
		return errors.New("invalid manifest")
	}
	for _, a := range manifest.Artifacts {
		if a.Closure == nil {
			return errors.New("complete closure required for every profile")
		}
	}
	profiles := allProfiles(manifest)
	// StageRelease itself spools/authenticates and preflights the full closure
	// before any extraction. Do not add a redundant root verification pass.
	if command == "verify" {
		if e = r.VerifyArchives(context.Background(), profiles, opener(*dir)); e != nil {
			return e
		}
	}
	if command == "stage" {
		root, e := os.OpenRoot(*parent)
		if e != nil {
			return e
		}
		defer root.Close()
		name, e := r.StageRelease(context.Background(), profiles, root, opener(*dir))
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

func allProfiles(m host.ReleaseManifest) []string {
	names := make([]string, 0, len(m.Artifacts))
	for _, a := range m.Artifacts {
		names = append(names, a.Profile)
	}
	return names
}
func readArtifacts(path string, array bool) ([]host.ReleaseArtifact, error) {
	b, e := readInput(path, host.MaxReleaseManifestBytes)
	if e != nil {
		return nil, e
	}
	d := json.NewDecoder(bytes.NewReader(b))
	d.DisallowUnknownFields()
	var artifacts []host.ReleaseArtifact
	if array {
		e = d.Decode(&artifacts)
	} else {
		var a host.ReleaseArtifact
		e = d.Decode(&a)
		artifacts = []host.ReleaseArtifact{a}
	}
	if e != nil || d.Decode(new(any)) != io.EOF || len(artifacts) == 0 {
		return nil, errors.New("invalid artifact document")
	}
	for _, a := range artifacts {
		if a.Closure == nil {
			return nil, errors.New("complete closure required")
		}
		host.SortRuntimeComponents(a.Closure)
	}
	return artifacts, nil
}
