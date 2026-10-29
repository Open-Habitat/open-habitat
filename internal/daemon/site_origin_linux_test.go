//go:build linux

package daemon

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSiteParse(t *testing.T) {
	// The bytes host apply publishes for a site with and without views.
	for text, want := range map[string]siteFacts{
		`{"origin":"https://habitat.example.org:8443","views":true}`: {Origin: "https://habitat.example.org:8443", Views: true},
		`{"origin":"https://habitat.example.org","views":false}`:     {Origin: "https://habitat.example.org"},
	} {
		if got, err := parseSite([]byte(text)); err != nil || got != want {
			t.Fatalf("%s = %+v %v", text, got, err)
		}
	}
	for _, bad := range []string{
		`{"origin":"http://habitat.example.org","views":true}`,
		`{"origin":"https://habitat.example.org/","views":true}`,
		`{"origin":"https://habitat.example.org/settings","views":true}`,
		`{"origin":"https://user@habitat.example.org","views":true}`,
		`{"origin":"https://habitat.example.org?x=1","views":true}`,
		`{"origin":"https://habitat.example.org#x","views":true}`,
		`{"origin":"https://","views":true}`,
		`{"origin":"","views":true}`,
		`{"origin":"https://habitat.example.org"}`,
		`{"origin":"https://habitat.example.org","views":"yes"}`,
		`{"origin":"https://habitat.example.org","views":null}`,
		`{"origin":"https://habitat.example.org","views":true,"uid":0}`,
		`{"origin":"https://a.example.org","views":true}{"origin":"https://b.example.org","views":true}`,
	} {
		if o, err := parseSite([]byte(bad)); err == nil {
			t.Fatalf("accepted %s as %+v", bad, o)
		}
	}
}

// A file an ordinary user could have written is not the operator's origin.
func TestAgentSiteUntrustedFileIsUnavailable(t *testing.T) {
	path := filepath.Join(t.TempDir(), "site-origin.json")
	if err := os.WriteFile(path, []byte(`{"origin":"https://evil.example.org","views":true}`), 0o644); err != nil {
		t.Fatal(err)
	}
	old := siteOriginPath
	siteOriginPath = path
	defer func() { siteOriginPath = old }()
	site := agentSite()
	if site["state"] != "unavailable" || site["origin"] != nil || site["views"] != nil {
		t.Fatalf("untrusted origin file used: %v", site)
	}
}
