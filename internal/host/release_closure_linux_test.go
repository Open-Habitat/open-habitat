//go:build linux

package host

import (
	"archive/tar"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"runtime"
	"sort"
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

// coreClosure is a minimal core inventory: the pinned Node, Pi packages and
// agent tools, each file its own licence record. Component digests are
// recomputed from the files, so a mutation is judged on its meaning alone.
func coreClosure(mutate func(files map[string]RuntimeFile, versions map[string]string)) ReleaseArtifact {
	files := map[string]RuntimeFile{"runtime/bin/node": {Component: "node", Mode: 0755}}
	versions := map[string]string{"node": "22.21.1", "taskfleet": "0.20.0", "workmux": "0.1.278", "agent-launcher": "1", "chromium-headless-shell": "145.0.7632.6"}
	for name, version := range map[string]string{"@earendil-works/pi-coding-agent": "1.5.2", "@aliou/pi-processes": "0.10.9", "pi-claude-bridge": "0.12.0", "@anthropic-ai/claude-agent-sdk": "0.3.321", "@aliou/sh": "0.3.4", "playwright-core": "1.58.0", "@mozilla/readability": "0.6.0", "turndown": "7.2.0"} {
		files["runtime/node_modules/"+name+"/package.json"] = RuntimeFile{Component: "npm:node_modules/" + name, Mode: 0644}
		versions["npm:node_modules/"+name] = version
	}
	files["runtime/agent-bin/taskfleet"] = RuntimeFile{Component: "taskfleet", Mode: 0755}
	files["runtime/agent-bin/workmux"] = RuntimeFile{Component: "workmux", Mode: 0755}
	files["runtime/agent-bin/pi"] = RuntimeFile{Component: "agent-launcher", Mode: 0755}
	files["runtime/taskfleet/skills/worktree-merge/SKILL.md"] = RuntimeFile{Component: "taskfleet", Mode: 0644}
	files["runtime/taskfleet/extension.mjs"] = RuntimeFile{Component: "agent-launcher", Mode: 0644}
	files["runtime/web-search/extension.mjs"] = RuntimeFile{Component: "agent-launcher", Mode: 0644}
	files["runtime/page-reader/extension.mjs"] = RuntimeFile{Component: "agent-launcher", Mode: 0644}
	files["runtime/browsers/chromium_headless_shell-1208/chrome-linux/headless_shell"] = RuntimeFile{Component: "chromium-headless-shell", Mode: 0755}
	files["runtime/browsers/chromium_headless_shell-1208/chrome-linux/LICENSE.headless_shell"] = RuntimeFile{Component: "chromium-headless-shell", Mode: 0644}
	if mutate != nil {
		mutate(files, versions)
	}
	c := &RuntimeClosure{}
	records := map[string]string{}
	licences := map[string][]string{}
	paths := []string{}
	for path := range files {
		paths = append(paths, path)
	}
	sort.Strings(paths)
	for _, path := range paths {
		f := files[path]
		f.Path, f.SHA256 = path, closureSum(path)
		c.Files = append(c.Files, f)
		records[f.Component] += f.SHA256 + " " + path + "\n"
		licences[f.Component] = append(licences[f.Component], path)
	}
	for name, version := range versions {
		if records[name] == "" {
			continue
		}
		kind := "native"
		if name == "node" {
			kind = "node"
		} else if strings.HasPrefix(name, "npm:") {
			kind = "npm"
		}
		c.Components = append(c.Components, RuntimeComponent{Name: name, Version: version, Kind: kind, SHA256: closureSum(records[name]), LicenseFiles: licences[name]})
	}
	return ReleaseArtifact{Profile: "core", Entries: len(c.Files), Closure: c}
}

func TestReleaseClosureCoreAgentTools(t *testing.T) {
	if !validRuntimeClosure(coreClosure(nil)) || !validCoreRuntime(coreClosure(nil)) {
		t.Fatal("valid core refused")
	}
	for name, mutate := range map[string]func(map[string]RuntimeFile, map[string]string){
		"taskfleet missing":        func(f map[string]RuntimeFile, _ map[string]string) { delete(f, "runtime/agent-bin/taskfleet") },
		"workmux missing":          func(f map[string]RuntimeFile, _ map[string]string) { delete(f, "runtime/agent-bin/workmux") },
		"launcher missing":         func(f map[string]RuntimeFile, _ map[string]string) { delete(f, "runtime/agent-bin/pi") },
		"taskfleet unpinned":       func(_ map[string]RuntimeFile, v map[string]string) { v["taskfleet"] = "0.18.0" },
		"workmux unpinned":         func(_ map[string]RuntimeFile, v map[string]string) { v["workmux"] = "0.1.276" },
		"skills extension missing": func(f map[string]RuntimeFile, _ map[string]string) { delete(f, "runtime/taskfleet/extension.mjs") },
		"web search missing":       func(f map[string]RuntimeFile, _ map[string]string) { delete(f, "runtime/web-search/extension.mjs") },
		"page reader missing":      func(f map[string]RuntimeFile, _ map[string]string) { delete(f, "runtime/page-reader/extension.mjs") },
		"playwright unpinned":      func(_ map[string]RuntimeFile, v map[string]string) { v["npm:node_modules/playwright-core"] = "1.59.0" },
		"headless shell missing": func(f map[string]RuntimeFile, _ map[string]string) {
			delete(f, "runtime/browsers/chromium_headless_shell-1208/chrome-linux/headless_shell")
		},
		"headless shell not executable": func(f map[string]RuntimeFile, _ map[string]string) {
			f["runtime/browsers/chromium_headless_shell-1208/chrome-linux/headless_shell"] = RuntimeFile{Component: "chromium-headless-shell", Mode: 0644}
		},
		"headless shell of another revision": func(_ map[string]RuntimeFile, v map[string]string) { v["chromium-headless-shell"] = "146.0.0.0" },
		"file of another part in the shell": func(f map[string]RuntimeFile, _ map[string]string) {
			f["runtime/browsers/chromium_headless_shell-1208/chrome-linux/libEGL.so"] = RuntimeFile{Component: "agent-launcher", Mode: 0755}
		},
		"skills missing": func(f map[string]RuntimeFile, _ map[string]string) {
			delete(f, "runtime/taskfleet/skills/worktree-merge/SKILL.md")
		},
		"skill of another part": func(f map[string]RuntimeFile, _ map[string]string) {
			f["runtime/taskfleet/skills/x/SKILL.md"] = RuntimeFile{Component: "workmux", Mode: 0644}
		},
		"foreign PATH command": func(f map[string]RuntimeFile, _ map[string]string) {
			f["runtime/agent-bin/git"] = RuntimeFile{Component: "taskfleet", Mode: 0755}
		},
		"command not executable": func(f map[string]RuntimeFile, _ map[string]string) {
			f["runtime/agent-bin/workmux"] = RuntimeFile{Component: "workmux", Mode: 0644}
		},
		"command of another part": func(f map[string]RuntimeFile, _ map[string]string) {
			f["runtime/agent-bin/pi"] = RuntimeFile{Component: "taskfleet", Mode: 0755}
		},
	} {
		t.Run(name, func(t *testing.T) {
			if validCoreRuntime(coreClosure(mutate)) {
				t.Fatal("accepted core without its pinned agent tools")
			}
		})
	}
}

// An upgrade authenticates its predecessor's manifest with the successor's
// code. A core from before the agent tools, on an older Pi, is still a valid
// manifest; only a release installed as the target must carry this one's.
func TestReleaseOlderCoreAuthenticatesAsPredecessor(t *testing.T) {
	older := coreClosure(func(f map[string]RuntimeFile, v map[string]string) {
		for path := range f {
			if strings.HasPrefix(path, "runtime/agent-bin/") || strings.HasPrefix(path, "runtime/taskfleet/") {
				delete(f, path)
			}
		}
		v["npm:node_modules/@earendil-works/pi-coding-agent"] = "1.2.0"
	})
	older.Archive, older.SHA256, older.Size, older.ExpandedSize, older.Requires, older.Packages = "core.tar.gz", strings.Repeat("a", 64), 1, 1024, []string{}, []RuntimePackage{}
	r := authenticatedFixture(t, releaseManifest(older))
	if e := r.RequireCoreRuntime(); !errors.Is(e, ErrReleaseProfile) {
		t.Fatalf("older core as a target: %v", e)
	}
	current := coreClosure(nil)
	current.Archive, current.SHA256, current.Size, current.ExpandedSize, current.Requires, current.Packages = "core.tar.gz", strings.Repeat("a", 64), 1, 1024, []string{}, []RuntimePackage{}
	if e := authenticatedFixture(t, releaseManifest(current)).RequireCoreRuntime(); e != nil {
		t.Fatalf("current core as a target: %v", e)
	}
}

// TestReleaseClosureBuiltCore verifies a real core build's archive and
// inventory, as runtime-release does for a whole release, when
// OH_CORE_ARTIFACT_DIR names the output directory of build-core-runtime.sh.
func TestReleaseClosureBuiltCore(t *testing.T) {
	dir := os.Getenv("OH_CORE_ARTIFACT_DIR")
	if dir == "" {
		t.Skip("OH_CORE_ARTIFACT_DIR names a build-core-runtime.sh output")
	}
	b, e := os.ReadFile(dir + "/artifact.json")
	if e != nil {
		t.Fatal(e)
	}
	var a ReleaseArtifact
	if e = json.Unmarshal(b, &a); e != nil {
		t.Fatal(e)
	}
	platform := "ubuntu-24.04-amd64"
	if runtime.GOARCH == "arm64" {
		platform = "ubuntu-24.04-arm64"
	}
	m, e := EncodeRelease(ReleaseManifest{SchemaVersion: 2, Version: "0.0.0-built-core", Commit: strings.Repeat("a", 40), Platform: platform, Artifacts: []ReleaseArtifact{a}})
	if e != nil {
		t.Fatal(e)
	}
	r, e := AuthenticateRelease(m, Release{Version: "0.0.0-built-core", ManifestSHA256: closureSum(string(m))})
	if e != nil {
		t.Fatal(e)
	}
	if e = r.VerifyArchives(context.Background(), nil, func(name string) (io.ReadCloser, error) { return os.Open(dir + "/" + name) }); e != nil {
		t.Fatal(e)
	}
}

func TestReleaseCoreAgentToolsObserved(t *testing.T) {
	a := coreClosure(nil)
	a.Archive, a.SHA256, a.Size, a.ExpandedSize, a.Requires, a.Packages = "core.tar.gz", strings.Repeat("a", 64), 1, 1024, []string{}, []RuntimePackage{}
	r := authenticatedFixture(t, releaseManifest(a))
	gen := t.TempDir() + "/core/"
	if status, reason := coreAgentToolsObserved(context.Background(), r, gen); status != "pass" || reason != "taskfleet_runtime_planned" {
		t.Fatal(status, reason)
	}
	for name := range CoreAgentTools {
		path := "runtime/agent-bin/" + name
		if e := os.MkdirAll(gen+"runtime/agent-bin", 0755); e != nil {
			t.Fatal(e)
		}
		// coreClosure's file digest is the digest of its own path.
		if e := os.WriteFile(gen+path, []byte(path), 0755); e != nil {
			t.Fatal(e)
		}
		if e := os.Chmod(gen+path, 0755); e != nil {
			t.Fatal(e)
		}
	}
	if status, reason := coreAgentToolsObserved(context.Background(), r, gen); status != "pass" || reason != "taskfleet_runtime_installed" {
		t.Fatal(status, reason)
	}
	if e := os.WriteFile(gen+"runtime/agent-bin/taskfleet", []byte("a person's own build"), 0755); e != nil {
		t.Fatal(e)
	}
	if status, reason := coreAgentToolsObserved(context.Background(), r, gen); status != "fail" || reason != "taskfleet_runtime_drift" {
		t.Fatal(status, reason)
	}
}
