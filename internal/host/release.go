//go:build linux

package host

import (
	"bytes"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"regexp"
	"sort"
	"unicode/utf8"
)

// Signatures cover these exact bytes, not a reserialized JSON object. The domain
// prevents an otherwise valid signature for a different product document from
// authorizing a release. Public keys come from operator trust, never the bundle.
const releaseSignatureDomain = "open-habitat.release.v1\x00"
const MaxReleaseManifestBytes = 8 << 20

var (
	ErrRelease          = errors.New("invalid_release: expected authenticated release manifest version 1")
	ErrReleaseSignature = errors.New("release_signature_invalid: verify the independently trusted release key")
	ErrReleaseTarget    = errors.New("release_target_mismatch: manifest does not match the declared release")
	ErrReleaseProfile   = errors.New("release_profile_unavailable: selected profile or dependency is absent or conflicting")
)

// ReleaseManifest is build input, not an installation readiness certificate.
// Authentication binds archive bytes and exact package expectations; it does not
// establish that their closure works, is licensed, or has passed mapped-UID tests.
type ReleaseManifest struct {
	SchemaVersion int               `json:"schema_version"`
	Version       string            `json:"version"`
	Commit        string            `json:"commit"`
	Platform      string            `json:"platform"`
	Artifacts     []ReleaseArtifact `json:"artifacts"`
}
type ReleaseArtifact struct {
	Profile      string           `json:"profile"`
	Archive      string           `json:"archive"`
	SHA256       string           `json:"sha256"`
	Size         int64            `json:"size"`
	ExpandedSize int64            `json:"expanded_size"` // complete decompressed tar stream, including headers/padding
	Entries      int              `json:"entries"`
	Requires     []string         `json:"requires"`
	Packages     []RuntimePackage `json:"packages"`
	Closure      *RuntimeClosure  `json:"closure,omitempty"`
}

// RuntimePackage identifies a tool package, not the kernel/systemd/libc platform
// baseline. Versions are compared exactly, never ordered or silently downgraded.
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
// It neither resolves nor downloads anything. Signing key custody is the caller's.
func EncodeRelease(m ReleaseManifest, key ed25519.PrivateKey) ([]byte, []byte, error) {
	if !validRelease(m) || len(key) != ed25519.PrivateKeySize {
		return nil, nil, ErrRelease
	}
	b, err := json.Marshal(m)
	if err != nil || len(b) > MaxReleaseManifestBytes {
		return nil, nil, ErrRelease
	}
	return b, ed25519.Sign(key, append([]byte(releaseSignatureDomain), b...)), nil
}

func AuthenticateRelease(b, signature []byte, key ed25519.PublicKey, target Release) (AuthenticatedRelease, error) {
	if len(b) == 0 || len(b) > MaxReleaseManifestBytes || len(key) != ed25519.PublicKeySize || len(signature) != ed25519.SignatureSize || !ed25519.Verify(key, append([]byte(releaseSignatureDomain), b...), signature) {
		return AuthenticatedRelease{}, ErrReleaseSignature
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
	sum := sha256.Sum256(b)
	digest := hex.EncodeToString(sum[:])
	if m.Version != target.Version || digest != target.ManifestSHA256 {
		return AuthenticatedRelease{}, ErrReleaseTarget
	}
	return AuthenticatedRelease{m, digest}, nil
}

var commitRE = regexp.MustCompile(`^[0-9a-f]{40}$`)
var archiveRE = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}\.tar\.gz$`)
var packageRE = regexp.MustCompile(`^[a-z0-9][a-z0-9+.-]{0,127}$`)
var packageVersionRE = regexp.MustCompile(`^[0-9][a-zA-Z0-9.+:~_-]{0,199}$`)

func validRelease(m ReleaseManifest) bool {
	if m.SchemaVersion != 1 || !versionRE.MatchString(m.Version) || !commitRE.MatchString(m.Commit) || m.Platform != "ubuntu-24.04-amd64" || len(m.Artifacts) == 0 || len(m.Artifacts) > 64 {
		return false
	}
	profiles, archives := map[string]bool{}, map[string]bool{}
	for _, a := range m.Artifacts {
		if !siteIDRE.MatchString(a.Profile) || profiles[a.Profile] || !archiveRE.MatchString(a.Archive) || archives[a.Archive] || !digestRE.MatchString(a.SHA256) || a.Size <= 0 || a.Size > 16<<30 || a.ExpandedSize < 1024 || a.ExpandedSize > 64<<30 || a.Entries <= 0 || a.Entries > 1000000 || len(a.Requires) > 64 || len(a.Packages) > 10000 || a.Requires == nil || a.Packages == nil {
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
			if !packageRE.MatchString(p.Name) || (p.Architecture != "amd64" && p.Architecture != "all") || !packageVersionRE.MatchString(p.Version) || packages[id] {
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
		return nil, ErrReleaseSignature
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
	versions := map[string]string{}
	for _, a := range r.manifest.Artifacts {
		if !selected[a.Profile] {
			continue
		}
		delete(selected, a.Profile)
		for _, p := range a.Packages {
			id := p.Name + ":" + p.Architecture
			if old, ok := versions[id]; ok && old != p.Version {
				return nil, ErrReleaseProfile
			}
			versions[id] = p.Version
		}
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
			} else if value != p.Version {
				drift = true
			}
		}
	}
	if drift {
		return Check{"release.runtime_packages", "fail", "runtime_package_drift"}, nil
	}
	if count == 0 {
		return Check{"release.runtime_packages", "unavailable", "runtime_package_lock_required"}, nil
	}
	if unavailable {
		return Check{"release.runtime_packages", "unavailable", "runtime_package_observation_required"}, nil
	}
	return Check{"release.runtime_packages", "pass", "runtime_packages_match"}, nil
}

// encoding/json accepts case-insensitive aliases, including two differently
// cased spellings of a field. The signed wire format does not.
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
	m, ok := keys(b, []string{"schema_version", "version", "commit", "platform", "artifacts"})
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
