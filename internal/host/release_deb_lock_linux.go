//go:build linux

package host

import (
	"encoding/json"
	"path"
	"strings"
)

// The resolved Ubuntu lock is a release-build input retained verbatim. This
// cross-check prevents an inventory enumerator from silently dropping a member
// already installed in its build image. Dependency satisfaction is additionally
// tested by offline installation on the supported fresh guest.
func verifyDebLock(b []byte, a ReleaseArtifact) bool {
	var lock struct {
		Platform string   `json:"platform"`
		Roots    []string `json:"roots"`
		Packages []struct {
			Name         string `json:"name"`
			Version      string `json:"version"`
			Architecture string `json:"architecture"`
			Filename     string `json:"filename"`
			SHA256       string `json:"sha256"`
			Role         string `json:"role"`
		} `json:"packages"`
	}
	if json.Unmarshal(b, &lock) != nil || lock.Platform != "ubuntu-24.04-amd64" || len(lock.Packages) == 0 {
		return false
	}
	files := closureFileMap(a.Closure)
	components := map[string]RuntimeComponent{}
	for _, c := range a.Closure.Components {
		components[c.Name] = c
	}
	expected := map[string]bool{}
	packages := map[string]RuntimePackage{}
	for _, p := range a.Packages {
		packages[p.Name] = p
	}
	for _, p := range lock.Packages {
		name := "debs/" + p.Filename
		f, ok := files[name]
		if !ok || path.Base(p.Filename) != p.Filename || !strings.HasSuffix(p.Filename, ".deb") || expected[name] || f.SHA256 != p.SHA256 || f.Component != "deb:"+p.Name {
			return false
		}
		c := components["deb:"+p.Name]
		if c.Version != p.Version {
			return false
		}
		if p.Role == "platform" {
			if c.Kind != "platform-deb" || (p.Name != "libc6" && p.Name != "libc-bin" && p.Name != "libsystemd0") {
				return false
			}
		} else if p.Role == "tool" {
			actual, ok := packages[p.Name]
			if c.Kind != "deb" || !ok || actual.Version != p.Version || actual.Architecture != p.Architecture {
				return false
			}
			delete(packages, p.Name)
		} else {
			return false
		}
		expected[name] = true
	}
	if len(packages) != 0 {
		return false
	}
	for name := range files {
		if strings.HasPrefix(name, "debs/") && !expected[name] {
			return false
		}
	}
	return true
}
