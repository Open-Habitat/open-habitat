//go:build linux

package host

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestApplyProfilePublicationAndUpgrade(t *testing.T) {
	if os.Geteuid() != 0 || os.Getenv("HOST_INIT_UID_CONTAINER") != "1" {
		t.Skip("disposable root host container only")
	}
	const root = "/opt/open-habitat"
	if _, err := os.Lstat(root); !os.IsNotExist(err) {
		t.Fatal("fixture root already exists", err)
	}
	if err := os.Mkdir(root, 0755); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(root); os.Remove("/usr/lib/systemd/user/open-habitat-containers.service") })
	s := Site{Profiles: []string{"core", "native-build", "python", "containers"}, Release: Release{"1", strings.Repeat("a", 64)}}
	prepare := func(site Site, unit string) {
		for _, p := range []string{"core/runtime", "python/runtime/bin", "containers/runtime/systemd/user"} {
			if err := os.MkdirAll(generationPath(site)+"/payloads/"+p, 0755); err != nil {
				t.Fatal(err)
			}
		}
		if err := os.WriteFile(generationPath(site)+"/payloads/containers/runtime/systemd/user/open-habitat-containers.service", []byte(unit), 0644); err != nil {
			t.Fatal(err)
		}
	}
	prepare(s, "[Service]\nType=oneshot\nExecStart=/bin/true\n")
	check := func(site Site) {
		for _, p := range []string{"python", "containers"} {
			have, err := os.Readlink(root + "/profiles/" + p)
			if err != nil || have != generationPath(site)+"/payloads/"+p+"/runtime" {
				t.Fatal(p, have, err)
			}
		}
		if _, err := os.Lstat(root + "/profiles/native-build"); !os.IsNotExist(err) {
			t.Fatal("invented runtime for deb-only profile", err)
		}
		have, err := os.ReadFile("/usr/lib/systemd/user/open-habitat-containers.service")
		want, e := os.ReadFile(filepath.Join(generationPath(site), "payloads/containers/runtime/systemd/user/open-habitat-containers.service"))
		if err != nil || e != nil || string(have) != string(want) {
			t.Fatal("user unit was not published", err, e)
		}
	}
	if err := finishGeneration(s); err != nil {
		t.Fatal(err)
	}
	check(s)
	if err := finishGeneration(s); err != nil {
		t.Fatal("repeat", err)
	}
	successor := s
	successor.Release.ManifestSHA256 = strings.Repeat("b", 64)
	prepare(successor, "[Service]\nType=oneshot\nExecStart=/bin/false\n")
	if err := switchUpgradeSelectors(successor, s.Release.ManifestSHA256); err != nil {
		t.Fatal(err)
	}
	check(successor)
}
