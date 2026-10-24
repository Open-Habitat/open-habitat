//go:build linux

package host

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"strings"
)

// integrationsConfig is the daemon catalog's operator file
// (internal/daemon/integrations.ConfigPath). Apply owns only its "tools"
// section. The app registrations beside it are the customer's and are copied
// byte-for-byte, so a credential entered later is never rewritten or dropped.
const integrationsConfig = "/opt/open-habitat/integrations.json"

// The daemon reads at most this much of the operator file.
const maxIntegrationsConfig = 16384

var ErrIntegrationsConfig = errors.New("integrations_config_invalid: inspect /opt/open-habitat/integrations.json; it must be one JSON object")

// integrationProfileTools are the executables the integrations profile ships,
// relative to its runtime. Every one is required in the signed closure, so a
// release cannot leave a catalog entry silently unavailable.
var integrationProfileTools = map[string]string{
	"gog":               "bin/gog",
	"himalaya":          "bin/himalaya",
	"microsoft-native":  "bin/microsoft-native",
	"ms-365-mcp-server": "bin/ms-365-mcp-server",
	"pi":                "bin/pi",
	"rclone":            "bin/rclone",
}

// DAV uses Ubuntu's curl. Each system tool is named after the Ubuntu package
// the profile must declare, so apt keeps it installed and updated.
var integrationSystemTools = map[string]string{"curl": "/usr/bin/curl"}

// The stable profile link keeps the file unchanged across upgrades; the
// upgrade switches the link, not the operator file.
func integrationTools() map[string]string {
	tools := map[string]string{}
	for name, rel := range integrationProfileTools {
		tools[name] = "/opt/open-habitat/profiles/integrations/" + rel
	}
	for name, path := range integrationSystemTools {
		tools[name] = path
	}
	return tools
}

// mergeIntegrationTools replaces the "tools" member of an operator file and
// keeps every other member's value bytes and order. The result is canonical
// for its own input, so merging twice yields the same bytes.
func mergeIntegrationTools(existing []byte, tools map[string]string) ([]byte, error) {
	b, _ := json.Marshal(tools)
	members := []string{`"tools":` + string(b)}
	if existing != nil {
		if strictJSON(existing) != nil {
			return nil, ErrIntegrationsConfig
		}
		d := json.NewDecoder(bytes.NewReader(existing))
		if t, e := d.Token(); e != nil || t != json.Delim('{') {
			return nil, ErrIntegrationsConfig
		}
		for d.More() {
			t, e := d.Token()
			key, ok := t.(string)
			var raw json.RawMessage
			if e != nil || !ok || d.Decode(&raw) != nil {
				return nil, ErrIntegrationsConfig
			}
			if key == "tools" {
				continue
			}
			k, _ := json.Marshal(key)
			members = append(members, string(k)+":"+string(raw))
		}
	}
	out := []byte("{" + strings.Join(members, ",") + "}\n")
	if len(out) > maxIntegrationsConfig {
		return nil, ErrIntegrationsConfig
	}
	return out, nil
}

// integrationsPolicy is the operator file apply publishes: the observed file
// with the release's tools. An untrusted existing file is refused rather than
// replaced, since it may hold the only copy of a customer's app registration.
func integrationsPolicy() (policyFile, error) {
	current, e := policyBytes("/", policyFile{Path: integrationsConfig}, 0)
	var existing []byte
	if e == nil {
		existing = []byte(current.Content)
	} else if !errors.Is(e, os.ErrNotExist) {
		return policyFile{}, ErrIntegrationsConfig
	}
	b, e := mergeIntegrationTools(existing, integrationTools())
	if e != nil {
		return policyFile{}, e
	}
	return policyFile{integrationsConfig, string(b)}, nil
}

func integrationsConfigMatches() bool {
	p, e := integrationsPolicy()
	return e == nil && policiesMatch("/", []policyFile{p}, 0)
}

// validIntegrationsClosure binds the published tool names to executables the
// signed integrations archive actually carries, with their pinned versions.
func validIntegrationsClosure(a ReleaseArtifact, files map[string]RuntimeFile, components map[string]RuntimeComponent) bool {
	for _, rel := range integrationProfileTools {
		if f, ok := files["runtime/"+rel]; !ok || f.Mode != 0755 {
			return false
		}
	}
	for name, version := range map[string]string{"himalaya": "2.2.1", "rclone": "1.71.2", "gog": "0.39.1"} {
		c, ok := components[name]
		if !ok || c.Kind != "native" || c.Version != version || files["runtime/bin/"+name].Component != name {
			return false
		}
	}
	required := map[string]bool{}
	for _, p := range a.Packages {
		required[p.Name] = true
	}
	for name := range integrationSystemTools {
		if !required[name] {
			return false
		}
	}
	return true
}
