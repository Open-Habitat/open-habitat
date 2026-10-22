//go:build linux

package host

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
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
		if !fs.ValidPath(f.Path) || f.Path == "." || strings.ContainsAny(f.Path, "\\\r\n\x00") || f.Path <= previous || !digestRE.MatchString(f.SHA256) || (f.Mode != 0644 && f.Mode != 0755) || f.Component == "" {
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
		case "node", "npm", "deb", "platform-deb", "license", "lock":
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
	if a.Profile == "core" {
		if components["node"].Version != "22.21.1" || files["runtime/bin/node"].Component != "node" {
			return false
		}
		for name, version := range map[string]string{"@earendil-works/pi-coding-agent": "1.3.0", "@aliou/pi-processes": "0.10.9", "pi-claude-bridge": "0.9.3", "@anthropic-ai/claude-agent-sdk": "0.3.301", "@aliou/sh": "0.3.4"} {
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
		debs := map[string]string{}
		for _, p := range a.Packages {
			debs["deb:"+p.Name] = p.Version
		}
		for id, p := range components {
			if p.Kind == "deb" {
				if debs[id] != p.Version {
					return false
				}
				delete(debs, id)
			}
		}
		if len(debs) != 0 {
			return false
		}
		for _, name := range []string{"git", "gh", "tmux", "passwd", "adduser", "acl", "quota"} {
			if components["deb:"+name].Kind != "deb" {
				return false
			}
		}
	}
	return true
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
			return walkReleaseTar(ctx, f, a, nil)
		}(); err != nil {
			return err
		}
	}
	return nil
}

// The npm lock is checked independently of the builder's enumeration. Optional
// explicit OS/CPU/libc restrictions are enforced for Ubuntu Linux/x64/glibc.
// Locks that omit a restriction retain that package, as npm ci does; we do not
// infer a missing restriction from a package name. Every applicable locked
// package must have exactly one component, including nested dependencies.
func verifyNPMLock(b []byte, c *RuntimeClosure) bool {
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
		if path != "" && matches(p.OS, "linux") && matches(p.CPU, "x64") && matches(p.Libc, "glibc") {
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
