package host

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func example(t *testing.T) []byte {
	t.Helper()
	b, e := os.ReadFile("../../site/example.json")
	if e != nil {
		t.Fatal(e)
	}
	return b
}
func TestSiteStrictAndBounded(t *testing.T) {
	b := example(t)
	if _, e := ParseSite(b); e != nil {
		t.Fatal(e)
	}
	for _, bad := range []string{
		strings.Replace(string(b), "example-client", "example-\xff", 1),
		strings.Replace(string(b), `"schema_version": 1`, `"schema_version": 1,"schema_version":1`, 1),
		strings.Replace(string(b), `"uid": 31000`, `"uid": 31000,"uid":31000`, 1),
		strings.Replace(string(b), `"site_id": "example-site"`, `"site_id": "example-site","SENSITIVE_UNKNOWN":"SECRET_SENTINEL"`, 1),
		strings.Replace(string(b), `"core"`, `"core", "core"`, 1),
		strings.Replace(string(b), `"admission": [`, `"admission": null, "secret": [`, 1),
		strings.Replace(string(b), `32015`, `61000`, 1),
		strings.Replace(string(b), `31000`, `32000`, 1),
		strings.Replace(string(b), `10737418240`, `1025`, 1),
		strings.Replace(string(b), `"ext4"`, `"xfs"`, 1),
		strings.Replace(string(b), `/secrets/github`, `/secrets/../github`, 1),
		string(b) + ` {}`,
		strings.Repeat("[", 40) + "0" + strings.Repeat("]", 40),
	} {
		if _, e := ParseSite([]byte(bad)); e == nil {
			t.Fatal("accepted malformed site")
		} else if strings.Contains(e.Error(), "SECRET") || strings.Contains(e.Error(), "SENSITIVE") {
			t.Fatal("secret reflected")
		}
	}
}
func TestSiteCanonicalSetsAndImmutable(t *testing.T) {
	s, e := ParseSite(example(t))
	if e != nil {
		t.Fatal(e)
	}
	s.Identities.Admission = []string{"456", "123"}
	b, _ := json.Marshal(s)
	s, e = ParseSite(b)
	if e != nil || strings.Join(s.Identities.Admission, ",") != "123,456" {
		t.Fatal("not canonical", e)
	}
	before := s.Immutable()
	doubled := s.Storage.DefaultLimit() * 2
	s.Storage.DefaultLimitBytes = &doubled
	s.Profiles = append(s.Profiles, "workflow")
	s.Identities.Admission = []string{}
	if s.Immutable() != before {
		t.Fatal("mutable state treated as migration")
	}
	s.Storage.HomeUUID = "00000000-0000-4000-8000-000000000002"
	if s.Immutable() == before {
		t.Fatal("mount migration hidden")
	}
}

func TestSiteLoginShell(t *testing.T) {
	s, e := ParseSite(example(t))
	if e != nil {
		t.Fatal(e)
	}
	if shell, subjects := s.LoginShellPolicy(); shell != "" || subjects == nil || len(subjects) != 0 {
		t.Fatal("absent login_shell is not the empty declaration", shell, subjects)
	}
	with := func(v string) string {
		return strings.Replace(string(example(t)), `"admission": [`, `"login_shell": `+v+`, "admission": ["777",`, 1)
	}
	s, e = ParseSite([]byte(with(`{"shell": "/bin/bash", "subjects": ["777", "123456"]}`)))
	if e != nil {
		t.Fatal(e)
	}
	if shell, subjects := s.LoginShellPolicy(); shell != "/bin/bash" || strings.Join(subjects, ",") != "123456,777" {
		t.Fatal(shell, subjects)
	}
	for v, path := range map[string]string{
		`{"shell": "/bin/bash", "subjects": ["888"]}`:         "$.identities.login_shell.subjects[0]",
		`{"shell": "/bin/bash", "subjects": []}`:              "$.identities.login_shell.subjects",
		`{"shell": "/usr/sbin/nologin", "subjects": ["777"]}`: "$.identities.login_shell.shell",
		`{"shell": "bash", "subjects": ["777"]}`:              "$.identities.login_shell.shell",
		`{"shell": "/bin/bash", "subjects": ["777", "777"]}`:  "$.identities.login_shell.subjects[1]",
		`{"shell": "/bin/bash"}`:                              "$.identities.login_shell.subjects",
		`{"shell": "/bin/bash", "subjects": ["777"], "x": 1}`: "$.identities.login_shell",
		`null`: "$.identities.login_shell",
	} {
		_, e := ParseSite([]byte(with(v)))
		se, ok := e.(*SiteError)
		if !ok || se.Path != path {
			t.Errorf("%s: want %s, got %v", v, path, e)
		}
	}
}
