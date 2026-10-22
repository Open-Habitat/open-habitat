//go:build linux

package host

import (
	"context"
	"errors"
	policy "github.com/Open-Habitat/open-habitat"
	"os"
	"path/filepath"
	"strings"
)

var ErrUnitPolicy = errors.New("foreign_unit_policy: product units have foreign fragments or overrides; qualify the policy explicitly")

func applyUnitPolicies() []policyFile {
	return []policyFile{
		{"/etc/systemd/system/open-habitat-daemon@.service", policy.DaemonService},
		{"/etc/systemd/system/open-habitat-revoke.socket", policy.RevokeSocket},
		{"/etc/systemd/system/open-habitat-gateway.service", strings.ReplaceAll(policy.GatewayService, "/etc/open-habitat/gateway.json", "/etc/open-habitat/gateway/gateway.json")},
	}
}

var productUnitFragments = []string{"open-habitat-proc.service", "open-habitat-storage.service", "open-habitat-binding@.service", "open-habitat-broker.service", "open-habitat-broker.socket", "open-habitat-revoke.socket", "open-habitat-gateway.service", "open-habitat-daemon@.service", "open-habitat-daemon@.socket", "open-habitat-agent@.socket"}

func unitSearchPaths(ctx context.Context) ([]string, error) {
	b, e := nativeCommand(ctx, "/usr/bin/systemd-analyze", "--system", "unit-paths")
	if e != nil {
		return nil, e
	}
	paths := strings.Split(strings.TrimSpace(string(b)), "\n")
	if len(paths) == 0 || len(paths) > 128 {
		return nil, ErrNativeApply
	}
	for _, p := range paths {
		if !absolute(p) {
			return nil, ErrNativeApply
		}
	}
	return paths, nil
}

// Product actors use fixed unit templates. Unknown overrides can add root
// hooks, ambient capabilities or foreign groups even when base bytes are right.
// Resource budgets belong on user slices, not unqualified actor overrides.
func unitOverridesSafe(paths []string, owner uint32) error {
	for _, path := range paths {
		fd, e := openDir(path, owner, false)
		if errors.Is(e, os.ErrNotExist) {
			continue
		}
		if e != nil {
			return e
		}
		dir := os.NewFile(uintptr(fd), "unit-search")
		entries, e := dir.ReadDir(-1)
		dir.Close()
		if e != nil {
			return e
		}
		if len(entries) > 100000 {
			return ErrUnitPolicy
		}
		for _, entry := range entries {
			name := entry.Name()
			override := name == "service.d" || name == "socket.d" || name == "open-.service.d" || name == "open-.socket.d" || name == "open-habitat-.service.d" || name == "open-habitat-.socket.d"
			for _, base := range productUnitFragments {
				if name == base+".d" {
					override = true
				}
				if prefix, suffix, ok := strings.Cut(base, "@"); ok {
					if strings.HasPrefix(name, prefix+"@") && strings.HasSuffix(name, suffix+".d") {
						override = true
					}
					if name != base && strings.HasPrefix(name, prefix+"@") && strings.HasSuffix(name, suffix) {
						return ErrUnitPolicy
					}
				}
			}
			if !override {
				continue
			}
			child, e := openDir(filepath.Join(path, name), owner, false)
			if e != nil {
				return e
			}
			f := os.NewFile(uintptr(child), "unit-overrides")
			members, e := f.ReadDir(-1)
			f.Close()
			if e != nil {
				return e
			}
			for _, member := range members {
				if strings.HasSuffix(member.Name(), ".conf") {
					return ErrUnitPolicy
				}
			}
		}
	}
	return nil
}

func nativeUnitInputs(ctx context.Context, initialized bool) error {
	for _, p := range applyUnitPolicies() {
		got, e := policyBytes("/", p, 0)
		if errors.Is(e, os.ErrNotExist) {
			continue
		}
		if e != nil {
			return e
		}
		if !initialized || got.Mode != 0644 || got.Content != p.Content {
			return ErrUnitPolicy
		}
	}
	paths, e := unitSearchPaths(ctx)
	if e != nil {
		return e
	}
	return unitOverridesSafe(paths, 0)
}

func verifyInstalledUnits(ctx context.Context, s Site) error {
	return verifyUnitPolicies(ctx, append(preparePolicies(s), applyUnitPolicies()...))
}
func verifyUnitPolicies(ctx context.Context, policies []policyFile) error {
	if !policiesMatch("/", policies, 0) {
		return ErrUnitPolicy
	}
	paths, e := unitSearchPaths(ctx)
	if e != nil {
		return e
	}
	if e = unitOverridesSafe(paths, 0); e != nil {
		return e
	}
	for _, base := range productUnitFragments {
		name := strings.ReplaceAll(base, "@.", "@host-qualification.")
		b, e := nativeCommand(ctx, "/usr/bin/systemctl", "show", "--property=FragmentPath,DropInPaths", name)
		if e != nil {
			return e
		}
		if !unitFragmentMatches(b, "/etc/systemd/system/"+base) {
			return ErrUnitPolicy
		}
	}
	return nil
}
func unitFragmentMatches(b []byte, want string) bool {
	fields := map[string]string{}
	for _, line := range strings.Split(strings.TrimSpace(string(b)), "\n") {
		key, value, ok := strings.Cut(line, "=")
		if !ok || (key != "FragmentPath" && key != "DropInPaths") {
			return false
		}
		if _, exists := fields[key]; exists {
			return false
		}
		fields[key] = value
	}
	return len(fields) == 2 && fields["FragmentPath"] == want && fields["DropInPaths"] == ""
}
