//go:build linux

package host

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"os"
	"sort"
	"strings"
)

// RuntimeClosure binds every regular payload file to exactly one component and
// retained upstream licence records. Component hashes cover sorted file records
// (hex SHA256, space, archive path, newline), not mutable package metadata.
// This is an integrity inventory, not legal approval of upstream terms.
type RuntimeClosure struct {
	Files      []RuntimeFile      `json:"files"`
	Components []RuntimeComponent `json:"components"`
}
type RuntimeFile struct {
	Path      string `json:"path"`
	SHA256    string `json:"sha256"`
	Component string `json:"component"`
	Mode      int64  `json:"mode"`
}
type RuntimeComponent struct {
	Name         string   `json:"name"`
	Version      string   `json:"version"`
	Kind         string   `json:"kind"`
	SHA256       string   `json:"sha256"`
	LicenseFiles []string `json:"license_files"`
}

func cloneRuntimeClosure(c *RuntimeClosure) *RuntimeClosure {
	if c == nil {
		return nil
	}
	b, _ := json.Marshal(c)
	var copy RuntimeClosure
	_ = json.Unmarshal(b, &copy)
	return &copy
}
func exactClosureFields(b []byte) bool {
	var c any
	if json.Unmarshal(b, &c) != nil {
		return false
	}
	exact := func(v any, names ...string) bool {
		m, ok := v.(map[string]any)
		if !ok || len(m) != len(names) {
			return false
		}
		for _, n := range names {
			if m[n] == nil {
				return false
			}
		}
		return true
	}
	if !exact(c, "files", "components") {
		return false
	}
	m := c.(map[string]any)
	files, ok := m["files"].([]any)
	if !ok {
		return false
	}
	components, ok := m["components"].([]any)
	if !ok {
		return false
	}
	for _, f := range files {
		if !exact(f, "path", "sha256", "component", "mode") {
			return false
		}
	}
	for _, c := range components {
		if !exact(c, "name", "version", "kind", "sha256", "license_files") {
			return false
		}
	}
	return true
}
func validRuntimeClosure(a ReleaseArtifact) bool {
	c := a.Closure
	if c == nil || len(c.Files) != a.Entries || len(c.Components) == 0 || len(c.Components) > 10000 {
		return false
	}
	files := map[string]RuntimeFile{}
	hashes := map[string]*strings.Builder{}
	previous := ""
	for _, f := range c.Files {
		if strings.HasPrefix(f.Path, "debs/") || !fs.ValidPath(f.Path) || f.Path == "." || strings.ContainsAny(f.Path, "\\\r\n\x00") || f.Path <= previous || !digestRE.MatchString(f.SHA256) || (f.Mode != 0644 && f.Mode != 0755) || f.Component == "" {
			return false
		}
		previous = f.Path
		files[f.Path] = f
		if hashes[f.Component] == nil {
			hashes[f.Component] = &strings.Builder{}
		}
		hashes[f.Component].WriteString(f.SHA256 + " " + f.Path + "\n")
	}
	components := map[string]RuntimeComponent{}
	for _, p := range c.Components {
		if _, exists := components[p.Name]; exists {
			return false
		}
		if hashes[p.Name] == nil {
			return false
		}
		sum := sha256.Sum256([]byte(hashes[p.Name].String()))
		if p.Name == "" || p.Version == "" || p.SHA256 != hex.EncodeToString(sum[:]) || len(p.LicenseFiles) == 0 {
			return false
		}
		switch p.Kind {
		case "node", "npm", "license", "lock", "native":
		default:
			return false
		}
		for _, license := range p.LicenseFiles {
			f, ok := files[license]
			if !ok || f.Component != p.Name {
				return false
			}
		}
		components[p.Name] = p
	}
	for _, f := range files {
		if _, ok := components[f.Component]; !ok {
			return false
		}
	}
	return true
}

// RequireCoreRuntime refuses a target release whose core does not carry what
// this release pins: Node, Pi and its extensions at their versions, and the
// agent tools. It is a requirement on the release being installed, not part
// of manifest validity: an upgrade authenticates its predecessor's manifest
// too, and an older core lacks what this release added.
func (r AuthenticatedRelease) RequireCoreRuntime() error {
	for _, a := range r.manifest.Artifacts {
		// Without a closure there is nothing to judge here; staging and
		// verification refuse such an archive.
		if a.Profile == "core" && a.Closure != nil && !validCoreRuntime(a) {
			return ErrReleaseProfile
		}
	}
	return nil
}

func validCoreRuntime(a ReleaseArtifact) bool {
	files := closureFileMap(a.Closure)
	components := map[string]RuntimeComponent{}
	for _, c := range a.Closure.Components {
		components[c.Name] = c
	}
	if components["node"].Version != "22.21.1" || files["runtime/bin/node"].Component != "node" {
		return false
	}
	for name, version := range map[string]string{"@earendil-works/pi-coding-agent": "1.5.2", "@aliou/pi-processes": "0.10.9", "pi-claude-bridge": "0.12.0", "@anthropic-ai/claude-agent-sdk": "0.3.321", "@aliou/sh": "0.3.4", "playwright-core": "1.58.0", "@mozilla/readability": "0.6.0", "turndown": "7.2.0"} {
		// npm may nest the overridden parser below its consumer.
		found := false
		for id, p := range components {
			if p.Kind == "npm" && strings.HasSuffix(id, "node_modules/"+name) && p.Version == version {
				found = true
			}
		}
		if !found {
			return false
		}
	}
	return validCoreAgentTools(files, components) && validHeadlessShell(files, components)
}

// HeadlessShell is the Chromium the core runtime's page reader renders with
// and the browser profile's QA Playwright uses, at the pinned revision.
var HeadlessShell = struct{ Version, Dir string }{"145.0.7632.6", "runtime/browsers/chromium_headless_shell-1208/"}

func validHeadlessShell(files map[string]RuntimeFile, components map[string]RuntimeComponent) bool {
	if c := components["chromium-headless-shell"]; c.Kind != "native" || c.Version != HeadlessShell.Version {
		return false
	}
	executable := false
	for path, f := range files {
		rest, ok := strings.CutPrefix(path, HeadlessShell.Dir)
		if !ok {
			continue
		}
		if f.Component != "chromium-headless-shell" {
			return false
		}
		if _, name, _ := strings.Cut(rest, "/"); (name == "chrome-headless-shell" || name == "headless_shell") && f.Mode == 0755 {
			executable = true
		}
	}
	return executable
}

// CoreAgentTools are the commands every installation's core runtime puts on
// its agents' PATH, at the versions this release pins: Taskfleet, the workmux
// it creates worktrees with, and the launcher that runs the release's Pi for
// Taskfleet's Pi workers. The daemon appends runtime/agent-bin to agents'
// PATH, so that directory holds exactly these and nothing else.
var CoreAgentTools = map[string]string{"taskfleet": "0.20.0", "workmux": "0.1.278", "pi": ""}

// coreAgentToolOwner is the closure component that owns each command.
func coreAgentToolOwner(name string) string {
	if name == "pi" {
		return "agent-launcher"
	}
	return name
}

func validCoreAgentTools(files map[string]RuntimeFile, components map[string]RuntimeComponent) bool {
	for path, f := range files {
		if name, ok := strings.CutPrefix(path, "runtime/agent-bin/"); ok {
			if _, known := CoreAgentTools[name]; !known || f.Mode != 0755 || f.Component != coreAgentToolOwner(name) {
				return false
			}
		}
	}
	skills := false
	for path, f := range files {
		if strings.HasPrefix(path, "runtime/taskfleet/skills/") && strings.HasSuffix(path, "/SKILL.md") {
			if f.Component != "taskfleet" {
				return false
			}
			skills = true
		}
	}
	// The Pi extensions the launcher and the daemon load: the one that offers
	// the skills, the provider's own web search and the page reader.
	for _, path := range []string{"runtime/taskfleet/extension.mjs", "runtime/web-search/extension.mjs", "runtime/page-reader/extension.mjs"} {
		if files[path].Component != "agent-launcher" {
			return false
		}
	}
	for name, version := range CoreAgentTools {
		owner := coreAgentToolOwner(name)
		f, ok := files["runtime/agent-bin/"+name]
		if !ok || f.Component != owner || components[owner].Kind != "native" || version != "" && components[owner].Version != version {
			return false
		}
	}
	return skills
}

// VerifyArchives is the unprivileged independent verification path. It uses the
// same authenticated descriptors and preflight as privileged staging, but never
// extracts or executes a payload. Temporary files are private and removed.
func (r AuthenticatedRelease) VerifyArchives(ctx context.Context, profiles []string, open func(string) (io.ReadCloser, error)) error {
	artifacts, err := r.Select(profiles)
	if err != nil {
		return err
	}
	for _, a := range artifacts {
		if a.Closure == nil {
			return ErrReleaseArchive
		}
		if err := func() error {
			f, e := os.CreateTemp("", "oh-verify-*")
			if e != nil {
				return ErrReleaseStage
			}
			defer os.Remove(f.Name())
			defer f.Close()
			src, e := open(a.Archive)
			if e != nil {
				return ErrReleaseStage
			}
			e = spoolReleaseArchive(ctx, f, src, a)
			ce := src.Close()
			if e != nil {
				return e
			}
			if ce != nil {
				return ErrReleaseStage
			}
			return walkReleaseTar(ctx, f, a, r.manifest.Platform, nil)
		}(); err != nil {
			return err
		}
	}
	return nil
}

// The npm lock is checked independently of the builder's enumeration. Optional
// explicit OS/CPU/libc restrictions are enforced for Ubuntu Linux/glibc on
// the release's CPU (npm's name, e.g. x64).
// Locks that omit a restriction retain that package, as npm ci does; we do not
// infer a missing restriction from a package name. Every applicable locked
// package must have exactly one component, including nested dependencies.
func verifyNPMLock(b []byte, c *RuntimeClosure, cpu string) bool {
	var lock struct {
		Packages map[string]struct {
			Version string   `json:"version"`
			OS      []string `json:"os"`
			CPU     []string `json:"cpu"`
			Libc    []string `json:"libc"`
		} `json:"packages"`
	}
	if json.Unmarshal(b, &lock) != nil || len(lock.Packages) < 2 {
		return false
	}
	matches := func(values []string, target string) bool {
		if len(values) == 0 {
			return true
		}
		positive := false
		ok := false
		for _, v := range values {
			if v == "!"+target {
				return false
			}
			if !strings.HasPrefix(v, "!") {
				positive = true
			}
			if v == target {
				ok = true
			}
		}
		return !positive || ok
	}
	expected := map[string]string{}
	for path, p := range lock.Packages {
		if path != "" && matches(p.OS, "linux") && matches(p.CPU, cpu) && matches(p.Libc, "glibc") {
			expected["npm:"+path] = p.Version
		}
	}
	for _, p := range c.Components {
		if p.Kind == "npm" {
			if expected[p.Name] != p.Version {
				return false
			}
			delete(expected, p.Name)
		}
	}
	return len(expected) == 0
}

func closureFileMap(c *RuntimeClosure) map[string]RuntimeFile {
	m := map[string]RuntimeFile{}
	if c != nil {
		for _, f := range c.Files {
			m[f.Path] = f
		}
	}
	return m
}

// Component records have no semantic ordering; builders sort to stabilize output.
func SortRuntimeComponents(c *RuntimeClosure) {
	sort.Slice(c.Components, func(i, j int) bool { return c.Components[i].Name < c.Components[j].Name })
}

// coreAgentToolsObserved is the host check's own row for Taskfleet, so an
// operator sees it by name: the target release carries the pinned agent
// tools (RequireCoreRuntime already refuses one that does not), and once
// the site's generation is installed, its bytes are exactly those. gen is
// that generation's core payload directory, with a trailing slash.
func coreAgentToolsObserved(ctx context.Context, r AuthenticatedRelease, gen string) (string, string) {
	artifacts, e := r.Select(nil)
	if e != nil {
		return "unavailable", "runtime_verification_required"
	}
	var core *RuntimeClosure
	for _, a := range artifacts {
		if a.Profile == "core" {
			core = a.Closure
		}
	}
	if core == nil {
		return "fail", "taskfleet_runtime_missing"
	}
	files := map[string]RuntimeFile{}
	for _, f := range core.Files {
		files[f.Path] = f
	}
	if _, e := os.Lstat(gen); errors.Is(e, os.ErrNotExist) {
		return "pass", "taskfleet_runtime_planned"
	}
	for name := range CoreAgentTools {
		if ctx.Err() != nil {
			return "unavailable", "runtime_verification_required"
		}
		f, ok := files["runtime/agent-bin/"+name]
		if !ok {
			return "fail", "taskfleet_runtime_missing"
		}
		st, e := os.Lstat(gen + f.Path)
		if e != nil || !st.Mode().IsRegular() || int64(st.Mode().Perm()) != f.Mode {
			return "fail", "taskfleet_runtime_drift"
		}
		if sum, e := fileDigest(gen + f.Path); e != nil || sum != f.SHA256 {
			return "fail", "taskfleet_runtime_drift"
		}
	}
	return "pass", "taskfleet_runtime_installed"
}
