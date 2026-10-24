//go:build linux

package host

import (
	"encoding/binary"
	"runtime"
	"strings"
)

// Each supported platform is one Ubuntu release on one architecture. A signed
// manifest names exactly one; its archives carry that architecture's binaries
// and its Ubuntu requirements name that architecture (or "all"). Debian and Go
// happen to spell both supported architectures the same way.
var releasePlatforms = map[string]uint16{
	"ubuntu-24.04-amd64": elfMachineX8664,
	"ubuntu-24.04-arm64": elfMachineAArch64,
}

const (
	elfMachineX8664   = 62
	elfMachineAArch64 = 183
)

// HostPlatform is the release platform this binary can install, or "" when
// it was built for an unsupported architecture.
func HostPlatform() string {
	p := "ubuntu-24.04-" + runtime.GOARCH
	if _, ok := releasePlatforms[p]; !ok {
		return ""
	}
	return p
}

// platformArchitecture returns the Debian architecture of a supported platform.
func platformArchitecture(platform string) string {
	if _, ok := releasePlatforms[platform]; !ok {
		return ""
	}
	return strings.TrimPrefix(platform, "ubuntu-24.04-")
}

// npm spells the 64-bit x86 CPU "x64"; package locks restrict optional
// native packages with npm's names.
func npmCPU(platform string) string {
	if a := platformArchitecture(platform); a != "amd64" {
		return a
	}
	return "x64"
}

// entryPoint reports whether a payload path is one of a profile's runtime/bin
// executables, which the installation runs or puts on PATH. Upstream trees
// below them may vendor prebuilds for every platform and pick one at run
// time, so only entry points are bound to the release architecture.
func entryPoint(name string) bool {
	rest, ok := strings.CutPrefix(name, "runtime/bin/")
	return ok && rest != "" && !strings.Contains(rest, "/")
}

// elfMatches reports whether an entry point that begins with an ELF header is
// a 64-bit little-endian binary for the platform. A signature binds bytes, not
// their architecture: without this a correctly signed archive of the other
// architecture would stage and fail only when a person's daemon first
// executes it.
func elfMatches(head []byte, platform string) bool {
	if len(head) < 4 || string(head[:4]) != "\x7fELF" {
		return true
	}
	return len(head) >= 20 && head[4] == 2 && head[5] == 1 && binary.LittleEndian.Uint16(head[18:20]) == releasePlatforms[platform]
}

// AuthenticatedRelease.Platform names the platform the signature covers.
func (r AuthenticatedRelease) Platform() string { return r.manifest.Platform }

// authenticateHostRelease is AuthenticateRelease for an installation on this
// host. Build tooling authenticates releases of any supported platform; the
// host operator only installs its own.
func authenticateHostRelease(b, signature []byte, key []byte, target Release) (AuthenticatedRelease, error) {
	r, e := AuthenticateRelease(b, signature, key, target)
	if e != nil {
		return r, e
	}
	if r.manifest.Platform != HostPlatform() {
		return AuthenticatedRelease{}, ErrReleasePlatform
	}
	return r, nil
}
