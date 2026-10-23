//go:build linux

package host

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"
)

func (r AuthenticatedRelease) unmetUbuntuRequirements(profiles []string, observed map[string]string) ([]RuntimePackage, error) {
	artifacts, err := r.Select(profiles)
	if err != nil {
		return nil, err
	}
	required := map[string]RuntimePackage{}
	for _, a := range artifacts {
		for _, p := range a.Packages {
			id := p.Name + ":" + p.Architecture
			if old, ok := required[id]; !ok || compareDebVersions(p.Version, old.Version) > 0 {
				required[id] = p
			}
		}
	}
	missing := []RuntimePackage{}
	for id, p := range required {
		if v := observed[id]; !packageVersionRE.MatchString(v) || compareDebVersions(v, p.Version) < 0 {
			missing = append(missing, p)
		}
	}
	sort.Slice(missing, func(i, j int) bool {
		return missing[i].Name+":"+missing[i].Architecture < missing[j].Name+":"+missing[j].Architecture
	})
	return missing, nil
}

// UbuntuRequirementError contains only authenticated declaration fields, never
// repository output or native diagnostics. It is safe to surface to an operator.
type UbuntuRequirementError struct{ Name, Minimum string }

func (e *UbuntuRequirementError) Error() string {
	return "Ubuntu package " + e.Name + " requires >= " + e.Minimum + "; host apt candidate cannot meet the requirement"
}
func (e *UbuntuRequirementError) Unwrap() error { return ErrRuntimePackageSolve }

func ubuntuCandidate(output []byte, p RuntimePackage) (string, bool) {
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	// apt accepts package-name regex fallback. Only a single exact policy block
	// establishes literal identity, otherwise a typo could select unrelated tools.
	if len(lines) == 0 || (lines[0] != p.Name+":" && lines[0] != p.Name+":"+p.Architecture+":") {
		return "", false
	}
	candidate := ""
	count := 0
	for _, line := range lines[1:] {
		if strings.HasPrefix(strings.TrimSpace(line), "Candidate:") {
			candidate = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(line), "Candidate:"))
			count++
		}
		if line != "" && line[0] != ' ' && line[0] != '\t' {
			return "", false
		}
	}
	return candidate, count == 1 && packageVersionRE.MatchString(candidate)
}

type ubuntuCommand func(context.Context, time.Duration, string, ...string) ([]byte, error)

func transitionUbuntuPackages(ctx context.Context, profiles []string, r AuthenticatedRelease, observed map[string]string, install bool, run ubuntuCommand) error {
	missing, err := r.unmetUbuntuRequirements(profiles, observed)
	if err != nil {
		return err
	}
	if len(missing) == 0 {
		return nil
	}
	names := []string{}
	for _, p := range missing {
		name := p.Name
		if p.Architecture != "all" {
			name += ":" + p.Architecture
		}
		// Never specify a version to apt: the host's candidate may be a newer
		// security update. Explicitly reject an unavailable/older candidate before
		// a privileged transaction rather than accepting a successful no-op.
		output, e := run(ctx, time.Minute, "/usr/bin/apt-cache", "policy", name)
		candidate, exact := ubuntuCandidate(output, p)
		if e != nil || !exact || compareDebVersions(candidate, p.Version) < 0 {
			return &UbuntuRequirementError{Name: p.Name, Minimum: p.Version}
		}
		names = append(names, name)
	}
	// Explicit false options override permissive host apt.conf settings. apt -y
	// refuses a downgrade or held-package change unless those options are allowed.
	args := []string{"-y", "--no-remove", "--no-install-recommends",
		"-o", "DPkg::Lock::Timeout=300",
		// Disable legacy unanchored regex fallback even if another apt writer
		// replaces indexes between the exact policy check and installation.
		"-o", "APT::Cmd::Pattern-Only=true",
		// Debconf noninteractive does not suppress dpkg conffile prompts.
		// Keep customer configuration rather than hanging for terminal input.
		"-o", "Dpkg::Options::=--force-confdef", "-o", "Dpkg::Options::=--force-confold",
		"-o", "APT::Get::allow-Downgrades=false", "-o", "APT::Get::allow-Change-Held-Packages=false",
		"-o", "APT::Get::allow-Remove-Essential=false", "-o", "APT::Get::force-yes=false",
		"-o", "APT::Get::AllowUnauthenticated=false", "install"}
	args = append(args, names...)
	if _, err = run(ctx, 5*time.Minute, "/usr/bin/apt-get", append([]string{"--simulate"}, args...)...); err != nil {
		return errors.Join(ErrRuntimePackageSolve, err)
	}
	if !install {
		return nil
	}
	if _, err = run(ctx, 30*time.Minute, "/usr/bin/apt-get", args...); err != nil {
		return errors.Join(ErrRuntimePackageInstall, err)
	}
	return r.requireRuntimePackages(ctx, profiles, queryRuntimePackages)
}
