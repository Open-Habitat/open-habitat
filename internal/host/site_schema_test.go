package host

import (
	"encoding/json"
	"os/exec"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/testpython"
)

// The gate already installs Python jsonschema for contract validation. Exercise
// the shipped schema against the real parser, not a second Go schema model.
func TestSiteSchemaDrift(t *testing.T) {
	var base map[string]any
	if e := json.Unmarshal(example(t), &base); e != nil {
		t.Fatal(e)
	}
	base["gateway"].(map[string]any)["origin"] = "https://habitat.other.test"
	base["gateway"].(map[string]any)["oauth_callback"] = "https://habitat.other.test/auth/github/callback"
	base["gateway"].(map[string]any)["origin_ca_file"] = "/etc/open-habitat/ca.pem"
	base["integrations"] = map[string]any{"browser_setup": false}
	base["identities"].(map[string]any)["login_shell"] = map[string]any{"shell": "/bin/bash", "subjects": []any{"123456"}}
	base["profiles"] = []any{"core", "editor", "integrations"}
	base["editor"] = map[string]any{"origin_template": "https://oh-code-*.example.org"}
	base["views"] = map[string]any{"origin_template": "https://oh-view-*.example.org", "link_max_days": 90}
	base["ui"] = map[string]any{"default_language": "en"}
	var cases []json.RawMessage
	add := func(v any) {
		b, e := json.Marshal(v)
		if e != nil {
			t.Fatal(e)
		}
		cases = append(cases, b)
	}
	add(base)
	// At every declared field, check omission, null and wrong JSON types. This
	// catches required/optional drift and Go's permissive scalar/alias decoding.
	var walk func(map[string]any, []string)
	walk = func(obj map[string]any, path []string) {
		for key, v := range obj {
			full := append(append([]string{}, path...), key)
			mutate := func(replacement any, remove bool) {
				b, _ := json.Marshal(base)
				var c map[string]any
				json.Unmarshal(b, &c)
				parent := c
				for _, p := range path {
					parent = parent[p].(map[string]any)
				}
				if remove {
					delete(parent, key)
				} else {
					parent[key] = replacement
				}
				add(c)
			}
			mutate(nil, true)
			mutate(nil, false)
			for _, bad := range []any{false, 0.5, "", []any{}, map[string]any{}} {
				mutate(bad, false)
			}
			if child, ok := v.(map[string]any); ok {
				walk(child, full)
			}
		}
	}
	walk(base, nil)
	// Numeric boundaries plus the exact pilot failure and namespace regressions.
	change := func(path string, v any) {
		b, _ := json.Marshal(base)
		var c map[string]any
		json.Unmarshal(b, &c)
		parts := strings.Split(path, ".")
		parent := c
		for _, p := range parts[:len(parts)-1] {
			parent = parent[p].(map[string]any)
		}
		parent[parts[len(parts)-1]] = v
		add(c)
	}
	for _, p := range []string{"gateway.uid", "gateway.gid", "identities.uid_min", "identities.uid_max"} {
		for _, v := range []int{999, 60001} {
			change(p, v)
		}
	}
	for _, v := range []any{1048575, 1048576, 1125899906842624, 1125899906843648, 1048577} {
		change("storage.default_limit_bytes", v)
	}
	// Without user quotas the default limit must be absent, even as zero.
	without := func(limit any) {
		b, _ := json.Marshal(base)
		var c map[string]any
		json.Unmarshal(b, &c)
		st := c["storage"].(map[string]any)
		st["enforce_user_quota"] = false
		delete(st, "default_limit_bytes")
		if limit != nil {
			st["default_limit_bytes"] = limit
		}
		add(c)
	}
	without(nil)
	without(0)
	without(10737418240)
	for _, v := range []string{"https://oh-code-*.example.org", "https://*.example.org", "https://code-{identity}.example.org", "https://code.example.org", "https://code-*.example.org/", "https://code-*.example.org:443", "https://verylongcode-*.example.org", "https://code.*.example.org", "http://code-*.example.org", "https://code-*.example.org?", "https://code-*.example.org\n"} {
		change("editor.origin_template", v)
	}
	for _, v := range []string{"https://oh-view-*.example.org", "https://*.example.org", "https://view.example.org", "https://view-*.example.org:443", "https://verylongview-*.example.org", "http://view-*.example.org"} {
		change("views.origin_template", v)
	}
	for _, v := range []int{0, 1, 365, 366, -1} {
		change("views.link_max_days", v)
	}
	for _, v := range []string{"system", "fi", "en", "en-US", "en-GB", "en-AU", "sv", "EN", "fi-FI"} {
		change("ui.default_language", v)
	}
	for _, v := range []string{"/bin/bash", "/usr/bin/zsh", "/opt/fish-3.7/bin/fish", "bin/bash", "/bin/bash/", "//bin/bash", "/bin/../bin/bash", "/bin/./bash", "/usr/sbin/nologin", "/sbin/nologin", "/bin/false", "/usr/bin/false", "/bin/nologin.sh", "/bin/ba sh", "/bin/ba:sh", "/bin/bash\n", "/" + strings.Repeat("a", 127), "/" + strings.Repeat("a", 128)} {
		change("identities.login_shell.shell", v)
	}
	for _, v := range [][]any{{}, {"123456", "123456"}, {"0123456"}} {
		change("identities.login_shell.subjects", v)
	}
	for _, v := range [][]any{{"core", "editor"}, {"integrations", "editor"}, {"editor", "integrations", "core"}} {
		change("profiles", v)
	}
	for _, v := range []string{" client", "client ", "client\n", "\u0085client", "client\ufeff", strings.Repeat("é", 200), strings.Repeat("é", 257), strings.Repeat("😀", 256), strings.Repeat("😀", 257)} {
		change("gateway.oauth_client_id", v)
	}
	// Deliberate runtime-only restrictions documented by the schema. Pin the
	// direction as well as the rule so they cannot silently become generic drift.
	runtimeOnlyStart := len(cases)
	for _, raw := range []string{`"uid": 31000.0`, `"uid": 3.1e4`} {
		cases = append(cases, json.RawMessage(strings.Replace(string(example(t)), `"uid": 31000`, raw, 1)))
	}
	change("identities.admission", []any{"18446744073709551616"})
	change("gateway.origin", "https://")
	change("gateway.origin", "https://habitat.other.test/path")
	change("gateway.oauth_callback", "https://different.test/auth/github/callback")
	change("gateway.oauth_secret_file", "/etc/../secret")
	change("identities.uid_max", 37000)
	change("gateway.uid", 32000)
	change("identities.login_shell.subjects", []any{"654321"})
	change("views.origin_template", "https://oh-code-*.example.org")
	payload, _ := json.Marshal(cases)
	cmd := exec.Command(testpython.Validator(t), "-c", `
import json,sys
from jsonschema import Draft202012Validator
schema=json.load(open('../../site/schema.json'))
Draft202012Validator.check_schema(schema)
v=Draft202012Validator(schema)
print(json.dumps([v.is_valid(c) for c in json.load(sys.stdin)]))
`)
	cmd.Stdin = strings.NewReader(string(payload))
	out, e := cmd.CombinedOutput()
	if e != nil {
		t.Fatalf("schema check (requires CI jsonschema): %v: %s", e, out)
	}
	var accepted []bool
	if e := json.Unmarshal(out, &accepted); e != nil {
		t.Fatal(e, string(out))
	}
	if len(accepted) != len(cases) {
		t.Fatal("schema result count")
	}
	for i, b := range cases {
		_, e := ParseSite(b)
		if i >= runtimeOnlyStart {
			wantPaths := []string{"$.gateway.uid", "$.gateway.uid", "$.identities.admission[0]", "$.gateway.origin", "$.gateway.origin", "$.gateway.oauth_callback", "$.gateway.oauth_secret_file", "$.identities.uid_max", "$.gateway.uid", "$.identities.login_shell.subjects[0]", "$.views.origin_template"}
			se, ok := e.(*SiteError)
			if !accepted[i] || !ok || se.Path != wantPaths[i-runtimeOnlyStart] {
				t.Errorf("declared runtime-only boundary changed case %d: schema=%v parser=%v", i, accepted[i], e)
			}
			continue
		}
		// The schema cannot relate login_shell.subjects to admission, so a
		// mutation that empties admission is refused only by the parser.
		if se, ok := e.(*SiteError); ok && accepted[i] && strings.HasPrefix(se.Path, "$.identities.login_shell.subjects[") && se.Rule == "must also be listed in identities.admission" {
			continue
		}
		if (e == nil) != accepted[i] {
			t.Errorf("schema/parser drift case %d: schema=%v parser=%v input=%s", i, accepted[i], e, b)
		}
	}
}

func TestSiteErrorPathsAndRedaction(t *testing.T) {
	tests := []struct{ old, new, path string }{
		{`"uid_min": 32000`, `"uid_min": 999`, "$.identities.uid_min"},
		{`"uid": 31000`, `"uid": null`, "$.gateway.uid"},
		{`"uid": 31000`, `"UID": 31000`, "$.gateway"},
		{`"uid": 31000`, `"uid": "SECRET_SENTINEL"`, "$.gateway.uid"},
		{`"uid": 31000`, `"uid": 31000,"uid": 31000`, "$.gateway.uid"},
		{`"site_id": "example-site"`, `"site_id": "example-site","SECRET_KEY":"SECRET_VALUE"`, "$"},
		{`"uid_max": 32015`, `"uid_max": 31000`, "$.identities.uid_max"},
		{`"default_limit_bytes": 10737418240`, `"default_limit_bytes": 1025`, "$.storage.default_limit_bytes"},
	}
	for _, tt := range tests {
		_, e := ParseSite([]byte(strings.Replace(string(example(t)), tt.old, tt.new, 1)))
		se, ok := e.(*SiteError)
		if !ok || se.Path != tt.path || se.Rule == "" || strings.Contains(e.Error(), "SECRET") {
			t.Errorf("expected %s, got %v", tt.path, e)
		}
	}
}

func TestSitePilotWildcard(t *testing.T) {
	s, e := ParseSite(example(t))
	if e != nil {
		t.Fatal(e)
	}
	s.Profiles = append(s.Profiles, "editor")
	s.Editor = &Editor{"https://oh-code-*.example.org"}
	if e := s.Validate(); e != nil {
		t.Fatal(e)
	}
	s.Editor.OriginTemplate = "https://oh-code-{identity}.example.org"
	if e := s.Validate(); e == nil || !strings.Contains(e.Error(), "$.editor.origin_template") {
		t.Fatal(e)
	}
}
