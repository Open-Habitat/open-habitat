//go:build linux

package daemon

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSiteOriginParse(t *testing.T) {
	if o, err := parseSiteOrigin([]byte(`{"origin":"https://habitat.example.org:8443"}`)); err != nil || o != "https://habitat.example.org:8443" {
		t.Fatalf("valid origin = %q %v", o, err)
	}
	for _, bad := range []string{
		`{"origin":"http://habitat.example.org"}`,
		`{"origin":"https://habitat.example.org/"}`,
		`{"origin":"https://habitat.example.org/settings"}`,
		`{"origin":"https://user@habitat.example.org"}`,
		`{"origin":"https://habitat.example.org?x=1"}`,
		`{"origin":"https://habitat.example.org#x"}`,
		`{"origin":"https://"}`,
		`{"origin":""}`,
		`{"origin":"https://habitat.example.org","uid":0}`,
		`{"origin":"https://a.example.org"}{"origin":"https://b.example.org"}`,
	} {
		if o, err := parseSiteOrigin([]byte(bad)); err == nil {
			t.Fatalf("accepted %s as %q", bad, o)
		}
	}
}

// A file an ordinary user could have written is not the operator's origin.
func TestAgentSiteUntrustedFileIsUnavailable(t *testing.T) {
	path := filepath.Join(t.TempDir(), "site-origin.json")
	if err := os.WriteFile(path, []byte(`{"origin":"https://evil.example.org"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	old := siteOriginPath
	siteOriginPath = path
	defer func() { siteOriginPath = old }()
	site := agentSite()
	if site["state"] != "unavailable" || site["origin"] != nil {
		t.Fatalf("untrusted origin file used: %v", site)
	}
}
