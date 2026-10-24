//go:build linux

package host

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestMergeIntegrationToolsKeepsAppSections(t *testing.T) {
	tools := integrationTools()
	fresh, err := mergeIntegrationTools(nil, tools)
	if err != nil {
		t.Fatal(err)
	}
	var parsed map[string]map[string]string
	if json.Unmarshal(fresh, &parsed) != nil || len(parsed) != 1 || len(parsed["tools"]) != len(tools) {
		t.Fatalf("fresh file %s", fresh)
	}
	for name, path := range tools {
		if parsed["tools"][name] != path {
			t.Fatal(name, parsed["tools"][name])
		}
	}
	if parsed["tools"]["himalaya"] != "/opt/open-habitat/profiles/integrations/bin/himalaya" || parsed["tools"]["curl"] != "/usr/bin/curl" {
		t.Fatal(parsed["tools"])
	}

	// An operator's sections, including formatting inside their values and
	// unknown future keys, survive exactly; a stale tools section does not.
	google := "{\n  \"client_id\": \"id.apps.example\",\n  \"client_secret\": \"s\\u0065cret\"\n}"
	microsoft := `{"client_id":"00000000-0000-4000-8000-000000000000","tenant_id":"common"}`
	existing := "{\n \"google\": " + google + ",\n \"tools\": {\"rclone\": \"/opt/old/rclone\", \"extra\": \"/opt/x\"},\n \"microsoft\":" + microsoft + ",\n \"future\": [1, 2]\n}\n"
	merged, err := mergeIntegrationTools([]byte(existing), tools)
	if err != nil {
		t.Fatal(err)
	}
	s := string(merged)
	for _, want := range []string{`"google":` + google, `"microsoft":` + microsoft, `"future":[1, 2]`} {
		if !strings.Contains(s, want) {
			t.Fatalf("lost %q in %s", want, s)
		}
	}
	if strings.Contains(s, "/opt/old/rclone") || strings.Contains(s, "extra") {
		t.Fatal("stale tools kept", s)
	}
	if strings.Index(s, `"google"`) > strings.Index(s, `"microsoft"`) || strings.Index(s, `"microsoft"`) > strings.Index(s, `"future"`) {
		t.Fatal("member order changed", s)
	}
	again, err := mergeIntegrationTools(merged, tools)
	if err != nil || string(again) != s {
		t.Fatalf("not idempotent:\n%s\n%s", s, again)
	}
}

func TestMergeIntegrationToolsRefusesUnusableFiles(t *testing.T) {
	for name, b := range map[string]string{
		"not json":       "tools=1",
		"array":          `[{"tools":{}}]`,
		"duplicate key":  `{"google":{},"google":{}}`,
		"trailing value": `{"google":{}} {}`,
		"empty":          "",
		"too large":      `{"pad":"` + strings.Repeat("x", maxIntegrationsConfig) + `"}`,
	} {
		if _, err := mergeIntegrationTools([]byte(b), integrationTools()); err != ErrIntegrationsConfig {
			t.Error(name, err)
		}
	}
}

func TestIntegrationsClosurePinsTools(t *testing.T) {
	files := map[string]RuntimeFile{}
	components := map[string]RuntimeComponent{}
	for name, rel := range integrationProfileTools {
		owner := "microsoft-native"
		if name == "himalaya" || name == "rclone" || name == "gog" {
			owner = name
		}
		files["runtime/"+rel] = RuntimeFile{Path: "runtime/" + rel, Component: owner, Mode: 0755}
	}
	for name, version := range map[string]string{"himalaya": "2.2.1", "rclone": "1.71.2", "gog": "0.39.1"} {
		components[name] = RuntimeComponent{Name: name, Version: version, Kind: "native"}
	}
	a := ReleaseArtifact{Profile: "integrations", Packages: []RuntimePackage{{"curl", "amd64", "8.5.0-2ubuntu10.6"}}}
	if !validIntegrationsClosure(a, files, components) {
		t.Fatal("complete closure refused")
	}
	for name, mutate := range map[string]func(ReleaseArtifact, map[string]RuntimeFile, map[string]RuntimeComponent) ReleaseArtifact{
		"missing tool": func(a ReleaseArtifact, f map[string]RuntimeFile, _ map[string]RuntimeComponent) ReleaseArtifact {
			delete(f, "runtime/bin/pi")
			return a
		},
		"non-executable": func(a ReleaseArtifact, f map[string]RuntimeFile, _ map[string]RuntimeComponent) ReleaseArtifact {
			r := f["runtime/bin/gog"]
			r.Mode = 0644
			f["runtime/bin/gog"] = r
			return a
		},
		"other version": func(a ReleaseArtifact, _ map[string]RuntimeFile, c map[string]RuntimeComponent) ReleaseArtifact {
			r := c["rclone"]
			r.Version = "1.60.1"
			c["rclone"] = r
			return a
		},
		"foreign owner": func(a ReleaseArtifact, f map[string]RuntimeFile, _ map[string]RuntimeComponent) ReleaseArtifact {
			r := f["runtime/bin/himalaya"]
			r.Component = "gog"
			f["runtime/bin/himalaya"] = r
			return a
		},
		"no curl package": func(a ReleaseArtifact, _ map[string]RuntimeFile, _ map[string]RuntimeComponent) ReleaseArtifact {
			a.Packages = nil
			return a
		},
	} {
		f, c := map[string]RuntimeFile{}, map[string]RuntimeComponent{}
		for k, v := range files {
			f[k] = v
		}
		for k, v := range components {
			c[k] = v
		}
		if validIntegrationsClosure(mutate(a, f, c), f, c) {
			t.Error(name, "accepted")
		}
	}
}

func TestOnlyInstallationTargetsRequireIntegrationTools(t *testing.T) {
	old := AuthenticatedRelease{manifest: ReleaseManifest{Artifacts: []ReleaseArtifact{
		{Profile: "core", Closure: &RuntimeClosure{}},
		{Profile: "integrations", Closure: &RuntimeClosure{Files: []RuntimeFile{{Path: "runtime/bin/microsoft-native", Component: "microsoft-native", Mode: 0755}}}},
	}}, digest: "x"}
	if old.RequireIntegrationTools() == nil {
		t.Fatal("a release without the pinned tools became an installation target")
	}
	files := []RuntimeFile{}
	components := []RuntimeComponent{}
	for name, rel := range integrationProfileTools {
		files = append(files, RuntimeFile{Path: "runtime/" + rel, Component: name, Mode: 0755})
	}
	for name, version := range map[string]string{"himalaya": "2.2.1", "rclone": "1.71.2", "gog": "0.39.1"} {
		components = append(components, RuntimeComponent{Name: name, Version: version, Kind: "native"})
	}
	current := AuthenticatedRelease{manifest: ReleaseManifest{Artifacts: []ReleaseArtifact{
		{Profile: "integrations", Packages: []RuntimePackage{{"curl", "amd64", "8.5.0-2ubuntu10.13"}}, Closure: &RuntimeClosure{Files: files, Components: components}},
	}}, digest: "x"}
	if err := current.RequireIntegrationTools(); err != nil {
		t.Fatal(err)
	}
}
