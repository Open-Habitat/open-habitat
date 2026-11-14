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
	t.Cleanup(func() {
		os.RemoveAll(root)
		os.Remove("/usr/lib/systemd/user/open-habitat-containers.service")
		os.Remove(headlessShellAppArmor.Path)
		os.Remove(needrestartOverride.Path)
	})
	s := Site{Profiles: []string{"core", "integrations", "native-build", "python", "containers"}, Release: Release{"1", strings.Repeat("a", 64)}}
	prepare := func(site Site, unit string) {
		for _, p := range []string{"core/runtime", "integrations/runtime/bin", "python/runtime/bin", "containers/runtime/systemd/user"} {
			if err := os.MkdirAll(generationPath(site)+"/payloads/"+p, 0755); err != nil {
				t.Fatal(err)
			}
		}
		if err := os.WriteFile(generationPath(site)+"/payloads/containers/runtime/systemd/user/open-habitat-containers.service", []byte(unit), 0644); err != nil {
			t.Fatal(err)
		}
	}
	prepare(s, "[Service]\nType=oneshot\nExecStart=/bin/true\n")
	// The customer's app registration predates apply and is not apply's to own.
	app := "{\"dropbox\": {\"client_id\": \"k\", \"client_secret\": \"v\"},\n\"tools\": {\"rclone\": \"/opt/old\"}}\n"
	if err := os.WriteFile(integrationsConfig, []byte(app), 0600); err != nil {
		t.Fatal(err)
	}
	var published []byte
	check := func(site Site) {
		b, err := os.ReadFile(integrationsConfig)
		st, e := os.Stat(integrationsConfig)
		if err != nil || e != nil || st.Mode().Perm() != 0644 || !strings.Contains(string(b), `"dropbox":{"client_id": "k", "client_secret": "v"}`) || !strings.Contains(string(b), `"himalaya":"/opt/open-habitat/profiles/integrations/bin/himalaya"`) || strings.Contains(string(b), "/opt/old") {
			t.Fatalf("integrations config %s %v %v", b, err, e)
		}
		if published != nil && string(published) != string(b) {
			t.Fatal("upgrade rewrote stable tool paths", string(b))
		}
		published = b
		if !integrationsConfigMatches() {
			t.Fatal("published config does not verify")
		}
		for _, p := range []string{"integrations", "python", "containers"} {
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
		if !policiesMatch("/", []policyFile{headlessShellAppArmor}, 0) {
			t.Fatal("headless shell sandbox profile was not published")
		}
		if !needrestartOverrideMatches() {
			t.Fatal("needrestart override was not published")
		}
	}
	if err := finishGeneration(s); err != nil {
		t.Fatal(err)
	}
	check(s)
	if err := finishGeneration(s); err != nil {
		t.Fatal("repeat", err)
	}
	// A file mapped users cannot read is repaired even when its tools are right.
	if err := os.Chmod(integrationsConfig, 0600); err != nil || integrationsConfigMatches() {
		t.Fatal("unreadable config accepted", err)
	}
	if err := finishGeneration(s); err != nil {
		t.Fatal(err)
	}
	check(s)
	// The operator adds an app section in their own formatting; with the tools
	// already right, neither apply nor the upgrade touches a byte of it.
	edited := strings.TrimSuffix(string(published), "}\n") + ",\n  \"google\": {\n    \"client_id\": \"a\",\n    \"client_secret\": \"b\"\n  }\n}\n"
	if err := os.WriteFile(integrationsConfig, []byte(edited), 0644); err != nil {
		t.Fatal(err)
	}
	if err := finishGeneration(s); err != nil {
		t.Fatal(err)
	}
	published = []byte(edited)
	check(s)
	successor := s
	successor.Release.ManifestSHA256 = strings.Repeat("b", 64)
	prepare(successor, "[Service]\nType=oneshot\nExecStart=/bin/false\n")
	if err := switchUpgradeSelectors(successor, s.Release.ManifestSHA256); err != nil {
		t.Fatal(err)
	}
	check(successor)
}

// The public site file says whether views are declared; a person's daemon
// refuses view offers when they are not.
func TestSiteFactsFileNamesViews(t *testing.T) {
	s := Site{Gateway: Gateway{Origin: "https://habitat.example.org"}}
	if got := siteFactsFile(s); got != `{"origin":"https://habitat.example.org","views":false}` {
		t.Fatalf("without views: %s", got)
	}
	s.Views = &Views{OriginTemplate: "https://oh-view-*.example.org"}
	if got := siteFactsFile(s); got != `{"origin":"https://habitat.example.org","views":true}` {
		t.Fatalf("with views: %s", got)
	}
}
