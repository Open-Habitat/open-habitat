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
	// A generation from before the content store holds its payloads; a later
	// one links each profile to its store entry. The upgrade below crosses
	// from the first layout to the second.
	prepare := func(site Site, unit string, store bool) {
		payloads := generationPath(site) + "/payloads"
		if store {
			entry := root + "/payloads/" + strings.Repeat(site.Release.ManifestSHA256[:1], 64)
			if err := os.MkdirAll(generationPath(site), 0755); err != nil {
				t.Fatal(err)
			}
			if err := os.Symlink(entry, payloads); err != nil {
				t.Fatal(err)
			}
			payloads = entry
		}
		for _, p := range []string{"core/runtime", "integrations/runtime/bin", "python/runtime/bin", "containers/runtime/systemd/user"} {
			if err := os.MkdirAll(payloads+"/"+p, 0755); err != nil {
				t.Fatal(err)
			}
		}
		runtime, err := generationRuntime(generationPath(site), "containers")
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(runtime+"/systemd/user/open-habitat-containers.service", []byte(unit), 0644); err != nil {
			t.Fatal(err)
		}
	}
	prepare(s, "[Service]\nType=oneshot\nExecStart=/bin/true\n", false)
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
		for _, p := range []string{"core", "integrations", "python", "containers"} {
			link := root + "/profiles/" + p
			if p == "core" {
				link = root + "/core"
			}
			want, err := generationRuntime(generationPath(site), p)
			have, e := os.Readlink(link)
			if err != nil || e != nil || have != want || (site.Release != s.Release) != strings.HasPrefix(have, root+"/payloads/") {
				t.Fatal(p, have, want, err, e)
			}
		}
		// The integrations Pi wrapper resolves its profile link physically
		// and walks up to core/runtime; both layouts keep them siblings.
		physical, err := filepath.EvalSymlinks(root + "/profiles/integrations/bin")
		if err != nil {
			t.Fatal(err)
		}
		if found, err := filepath.EvalSymlinks(physical + "/../../../core/runtime"); err != nil || found != filepath.Clean(mustRuntime(t, generationPath(site), "core")) {
			t.Fatal("wrapper cannot reach core", found, err)
		}
		pi, err := os.ReadFile(root + "/pi-runtime.json")
		core, _ := generationRuntime(generationPath(site), "core")
		if err != nil || !strings.Contains(string(pi), `"node":"`+core+`/bin/node"`) {
			t.Fatal("pi selector", string(pi), err)
		}
		if _, err := os.Lstat(root + "/profiles/native-build"); !os.IsNotExist(err) {
			t.Fatal("invented runtime for deb-only profile", err)
		}
		have, err := os.ReadFile("/usr/lib/systemd/user/open-habitat-containers.service")
		containers, _ := generationRuntime(generationPath(site), "containers")
		want, e := os.ReadFile(filepath.Join(containers, "systemd/user/open-habitat-containers.service"))
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
	prepare(successor, "[Service]\nType=oneshot\nExecStart=/bin/false\n", true)
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

func mustRuntime(t *testing.T, gen, profile string) string {
	t.Helper()
	runtime, err := generationRuntime(gen, profile)
	if err != nil {
		t.Fatal(err)
	}
	return runtime
}
