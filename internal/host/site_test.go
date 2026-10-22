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
	s.Storage.DefaultLimitBytes *= 2
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
