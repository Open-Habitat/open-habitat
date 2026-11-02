//go:build linux

package host

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"regexp"
	"sort"
	"strings"
	"unicode/utf8"
)

// Complete non-Ubuntu file/license inventories (including integrations) need
// more than 8 MiB even without any Ubuntu archives. Keep a bounded pinned input.
const MaxReleaseManifestBytes = 16 << 20

var (
	ErrRelease         = errors.New("invalid_release: expected authenticated release manifest version 2")
	ErrReleaseTarget   = errors.New("release_target_mismatch: manifest does not match the declared release")
	ErrReleaseProfile  = errors.New("release_profile_unavailable: selected profile or dependency is absent or conflicting")
	ErrReleasePlatform = errors.New("release_platform_mismatch: release targets a different Ubuntu architecture than this host")
)

// ReleaseManifest is build input, not an installation readiness certificate.
// Authentication binds archive bytes and Ubuntu minimum requirements; it does not
// establish that their closure works, is licensed, or has passed mapped-UID tests.
type ReleaseManifest struct {
	SchemaVersion int               `json:"schema_version"`
	Version       string            `json:"version"`
	Commit        string            `json:"commit"`
	Platform      string            `json:"platform"`
	Artifacts     []ReleaseArtifact `json:"artifacts"`
	Upgrade       *ReleaseUpgrade   `json:"upgrade,omitempty"`
}

// ReleaseUpgrade authenticates the exact supported transition and all product
// bytes, separately from runtime closure. Compatibility is an explicit protocol,
// never an inference from version ordering or a claim supplied by the operator.
type ReleaseUpgrade struct {
	Protocol                int           `json:"protocol"`
	PredecessorBinarySHA256 string        `json:"predecessor_binary_sha256"`
	Predecessor             Release       `json:"predecessor"`
	Product                 []ProductFile `json:"product"`
}
type ProductFile struct {
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
	Mode   uint32 `json:"mode"`
}

type ReleaseArtifact struct {
	Profile string `json:"profile"`
	Archive string `json:"archive"`
	// ArchiveRelease is a same-repository immutable GitHub release tag, used only
	// by download tooling. Offline verification still requires all local bytes.
	ArchiveRelease string           `json:"archive_release,omitempty"`
	SHA256         string           `json:"sha256"`
	Size           int64            `json:"size"`
	ExpandedSize   int64            `json:"expanded_size"` // complete decompressed tar stream, including headers/padding
	Entries        int              `json:"entries"`
	Requires       []string         `json:"requires"`
	Packages       []RuntimePackage `json:"packages"`
	Closure        *RuntimeClosure  `json:"closure,omitempty"`
}

// RuntimePackage declares an Ubuntu requirement. Version is the qualified minimum,
// not an exact pin; Ubuntu apt owns its dependency closure and security updates.
type RuntimePackage struct {
	Name         string `json:"name"`
	Architecture string `json:"architecture"`
	Version      string `json:"version"`
}

// AuthenticatedRelease has no exported mutable state. A zero value authorizes
// nothing. Keeping this separate from ReleaseManifest prevents parsed-but-not-
// authenticated metadata from reaching the archive staging adapter.
type AuthenticatedRelease struct {
	manifest ReleaseManifest
	digest   string
}

// EncodeRelease is for the release builder, offline after closure resolution.
// It neither resolves nor downloads anything. The SHA-256 of the returned bytes
// is the whole release trust once GitHub states it for the published asset.
func EncodeRelease(m ReleaseManifest) ([]byte, error) {
	if !validRelease(m) {
		return nil, ErrRelease
	}
	b, err := json.Marshal(m)
	if err != nil || len(b) > MaxReleaseManifestBytes {
		return nil, ErrRelease
	}
	return b, nil
}

// AuthenticateRelease accepts exactly the manifest bytes whose SHA-256 the
// operator pinned, taken from the digest GitHub states for the release asset.
// The pin is compared before the bytes are parsed: nothing else in the bundle
// can make a release acceptable.
func AuthenticateRelease(b []byte, target Release) (AuthenticatedRelease, error) {
	if len(b) == 0 || len(b) > MaxReleaseManifestBytes || !digestRE.MatchString(target.ManifestSHA256) {
		return AuthenticatedRelease{}, ErrReleaseTarget
	}
	sum := sha256.Sum256(b)
	digest := hex.EncodeToString(sum[:])
	if digest != target.ManifestSHA256 {
		return AuthenticatedRelease{}, ErrReleaseTarget
	}
	if !utf8.Valid(b) || strictJSON(b) != nil {
		return AuthenticatedRelease{}, ErrRelease
	}
	var m ReleaseManifest
	d := json.NewDecoder(bytes.NewReader(b))
	d.DisallowUnknownFields()
	if d.Decode(&m) != nil || d.Decode(new(any)) != io.EOF || !validRelease(m) || !exactReleaseFields(b) {
		return AuthenticatedRelease{}, ErrRelease
	}
	if m.Version != target.Version {
		return AuthenticatedRelease{}, ErrReleaseTarget
	}
	return AuthenticatedRelease{m, digest}, nil
}

var commitRE = regexp.MustCompile(`^[0-9a-f]{40}$`)
var archiveReleaseRE = regexp.MustCompile(`^v[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*)?$`)
var archiveRE = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}\.tar\.gz$`)
var packageRE = regexp.MustCompile(`^[a-z0-9][a-z0-9+.-]{0,127}$`)
var packageVersionRE = regexp.MustCompile(`^[0-9][a-zA-Z0-9.+:~_-]{0,199}$`)

func validRelease(m ReleaseManifest) bool {
	if m.SchemaVersion != 2 || !versionRE.MatchString(m.Version) || !commitRE.MatchString(m.Commit) || platformArchitecture(m.Platform) == "" || len(m.Artifacts) == 0 || len(m.Artifacts) > 64 {
		return false
	}
	if m.Upgrade != nil && !validUpgrade(m.Upgrade, m.Version) {
		return false
	}
	profiles, archives := map[string]bool{}, map[string]bool{}
	for _, a := range m.Artifacts {
		if !siteIDRE.MatchString(a.Profile) || profiles[a.Profile] || !archiveRE.MatchString(a.Archive) || archives[a.Archive] || !digestRE.MatchString(a.SHA256) || a.Size <= 0 || a.Size > 16<<30 || a.ExpandedSize < 1024 || a.ExpandedSize > 64<<30 || a.Entries <= 0 || a.Entries > 1000000 || len(a.Requires) > 64 || len(a.Packages) > 10000 || a.Requires == nil || a.Packages == nil {
			return false
		}
		if a.ArchiveRelease != "" && (!archiveReleaseRE.MatchString(a.ArchiveRelease) || a.ArchiveRelease == "v"+m.Version) {
			return false
		}
		if a.Closure != nil && !validRuntimeClosure(a) {
			return false
		}
		profiles[a.Profile] = true
		archives[a.Archive] = true
		deps, packages := map[string]bool{}, map[string]bool{}
		for _, dep := range a.Requires {
			if !siteIDRE.MatchString(dep) || dep == a.Profile || dep == "core" || deps[dep] {
				return false
			}
			deps[dep] = true
		}
		for _, p := range a.Packages {
			id := p.Name + ":" + p.Architecture
			if !packageRE.MatchString(p.Name) || (p.Architecture != platformArchitecture(m.Platform) && p.Architecture != "all") || !packageVersionRE.MatchString(p.Version) || packages[id] {
				return false
			}
			packages[id] = true
		}
	}
	if !profiles["core"] {
		return false
	}
	// Profile dependencies are a DAG. Core is always implicitly selected and may
	// not depend on optional profiles.
	state := map[string]int{}
	var visit func(string) bool
	visit = func(name string) bool {
		if !profiles[name] || state[name] == 1 {
			return false
		}
		if state[name] == 2 {
			return true
		}
		state[name] = 1
		for _, a := range m.Artifacts {
			if a.Profile == name {
				if name == "core" && len(a.Requires) != 0 {
					return false
				}
				for _, dep := range a.Requires {
					if !visit(dep) {
						return false
					}
				}
			}
		}
		state[name] = 2
		return true
	}
	for name := range profiles {
		if !visit(name) {
			return false
		}
	}
	return true
}

// Select includes core plus the transitive profile dependencies. Returned values
// are deep copies, not mutable capabilities. Accepts Site.Profiles (including
// its explicit core) or optional profiles alone. Unknown/duplicate selectors fail.
func (r AuthenticatedRelease) Select(profiles []string) ([]ReleaseArtifact, error) {
	if r.digest == "" {
		return nil, ErrRelease
	}
	selected := map[string]bool{"core": true}
	requested := map[string]bool{}
	for _, name := range profiles {
		if requested[name] {
			return nil, ErrReleaseProfile
		}
		requested[name] = true
		selected[name] = true
	}
	for changed := true; changed; {
		changed = false
		for _, a := range r.manifest.Artifacts {
			if selected[a.Profile] {
				for _, dep := range a.Requires {
					if !selected[dep] {
						selected[dep] = true
						changed = true
					}
				}
			}
		}
	}
	result := []ReleaseArtifact{}
	for _, a := range r.manifest.Artifacts {
		if !selected[a.Profile] {
			continue
		}
		delete(selected, a.Profile)
		a.Requires = append([]string{}, a.Requires...)
		a.Packages = append([]RuntimePackage{}, a.Packages...)
		a.Closure = cloneRuntimeClosure(a.Closure)
		result = append(result, a)
	}
	if len(selected) != 0 {
		return nil, ErrReleaseProfile
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Profile < result[j].Profile })
	return result, nil
}

// CheckRuntimePackages consumes an explicit package observation, e.g. a bounded
// dpkg-query adapter. Absent keys mean observation unavailable; an empty value
// means observed not installed. It never invokes a solver or proposes downgrades.
func (r AuthenticatedRelease) CheckRuntimePackages(profiles []string, observed map[string]string) (Check, error) {
	artifacts, err := r.Select(profiles)
	if err != nil {
		return Check{}, err
	}
	unavailable, drift := false, false
	count := 0
	for _, a := range artifacts {
		for _, p := range a.Packages {
			count++
			value, ok := observed[p.Name+":"+p.Architecture]
			if !ok {
				unavailable = true
			} else if !packageVersionRE.MatchString(value) || compareDebVersions(value, p.Version) < 0 {
				drift = true
			}
		}
	}
	if drift {
		return Check{"release.runtime_packages", "fail", "ubuntu_package_requirement_unmet"}, nil
	}
	if count == 0 {
		return Check{"release.runtime_packages", "pass", "ubuntu_package_requirements_empty"}, nil
	}
	if unavailable {
		return Check{"release.runtime_packages", "unavailable", "runtime_package_observation_required"}, nil
	}
	return Check{"release.runtime_packages", "pass", "runtime_packages_match"}, nil
}

// encoding/json accepts case-insensitive aliases, including two differently
// cased spellings of a field. The pinned wire format does not.
func exactReleaseFields(b []byte) bool {
	var keys func([]byte, []string) (map[string]json.RawMessage, bool)
	keys = func(b []byte, allowed []string) (map[string]json.RawMessage, bool) {
		var fields map[string]json.RawMessage
		if json.Unmarshal(b, &fields) != nil || len(fields) != len(allowed) {
			return nil, false
		}
		for _, name := range allowed {
			if _, ok := fields[name]; !ok {
				return nil, false
			}
		}
		return fields, true
	}
	allowed := []string{"schema_version", "version", "commit", "platform", "artifacts"}
	var raw map[string]json.RawMessage
	if json.Unmarshal(b, &raw) != nil {
		return false
	}
	if _, present := raw["upgrade"]; present {
		allowed = append(allowed, "upgrade")
		if string(raw["upgrade"]) == "null" {
			return false
		}
	}
	m, ok := keys(b, allowed)
	if !ok {
		return false
	}
	var artifacts []json.RawMessage
	if json.Unmarshal(m["artifacts"], &artifacts) != nil {
		return false
	}
	for _, a := range artifacts {
		allowed := []string{"profile", "archive", "sha256", "size", "expanded_size", "entries", "requires", "packages"}
		var raw map[string]json.RawMessage
		if json.Unmarshal(a, &raw) != nil {
			return false
		}
		if source, present := raw["archive_release"]; present {
			allowed = append(allowed, "archive_release")
			var tag string
			if json.Unmarshal(source, &tag) != nil || !archiveReleaseRE.MatchString(tag) {
				return false
			}
		}
		if _, present := raw["closure"]; present {
			allowed = append(allowed, "closure")
			if !exactClosureFields(raw["closure"]) {
				return false
			}
		}
		fields, ok := keys(a, allowed)
		if !ok {
			return false
		}
		var packages []json.RawMessage
		if json.Unmarshal(fields["packages"], &packages) != nil {
			return false
		}
		for _, p := range packages {
			if _, ok := keys(p, []string{"name", "architecture", "version"}); !ok {
				return false
			}
		}
	}
	return true
}

func validUpgrade(u *ReleaseUpgrade, version string) bool {
	if u.Protocol != 1 || !digestRE.MatchString(u.PredecessorBinarySHA256) || !versionRE.MatchString(u.Predecessor.Version) || u.Predecessor.Version == version || !digestRE.MatchString(u.Predecessor.ManifestSHA256) || len(u.Product) < 2 || len(u.Product) > 100000 {
		return false
	}
	seen := map[string]bool{}
	for _, f := range u.Product {
		if !fs.ValidPath(f.Path) || seen[f.Path] || !digestRE.MatchString(f.SHA256) {
			return false
		}
		if f.Path == "open-habitat" {
			if f.Mode != 0755 {
				return false
			}
		} else if !strings.HasPrefix(f.Path, "web/") || f.Mode != 0644 {
			return false
		}
		seen[f.Path] = true
	}
	return seen["open-habitat"] && seen["web/index.html"]
}
