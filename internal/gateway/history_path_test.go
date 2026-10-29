//go:build linux

package gateway

import (
	"net/url"
	"testing"
)

func TestRecapAndContextGatewayReadPaths(t *testing.T) {
	for _, base := range []string{"/api/v1/agents/pi:11111111-1111-4111-8111-111111111111/recap", "/api/v1/agents/pi:11111111-1111-4111-8111-111111111111/context", "/api/v1/agents/pi:11111111-1111-4111-8111-111111111111/spinoff-work"} {
		if !historyGatewayPath(base, url.Values{}) || historyGatewayPath(base, url.Values{"limit": {"1"}}) || historyGatewayPath(base+"/other", url.Values{}) {
			t.Fatalf("%s must be exact and query-free", base)
		}
	}
	if historyGatewayPath("/api/v1/agents/claude:11111111-1111-4111-8111-111111111111/context", url.Values{}) {
		t.Fatal("only native Pi sessions have a context read")
	}
}

func TestHistoryGatewayBackwardQuery(t *testing.T) {
	path := "/api/v1/agents/pi:11111111-1111-4111-8111-111111111111/history"
	for _, tc := range []struct {
		query string
		valid bool
	}{
		{"limit=25", true}, {"limit=25&before=native0226", true},
		{"limit=25&after=", true}, {"before=a&after=b", false},
		{"before=a&before=b", false}, {"before=a&limit=25&extra=x", false},
	} {
		q, err := url.ParseQuery(tc.query)
		if err != nil {
			t.Fatal(err)
		}
		if got := historyGatewayPath(path, q); got != tc.valid {
			t.Errorf("%s: got %v, want %v", tc.query, got, tc.valid)
		}
	}
}

func TestSpinoffGatewayReadPath(t *testing.T) {
	path := "/api/v1/agents/pi:11111111-1111-4111-8111-111111111111/spinoffs"
	for _, tc := range []struct {
		q     string
		valid bool
	}{{"", true}, {"run=01m521vczarx5bkx086n64t1t2", true}, {"run=../outside", false}, {"run=--help", false}, {"run=01m521vczarx5bkx086n64t1t2&run=01m521vczarx5bkx086n64t1t2", false}, {"node=n-0001", false}, {"run=01m521vczarx5bkx086n64t1t2&write=yes", false}} {
		q, _ := url.ParseQuery(tc.q)
		if historyGatewayPath(path, q) != tc.valid {
			t.Errorf("query %s", tc.q)
		}
	}
}

func TestHistorySkillArgumentSelectorAllowlist(t *testing.T) {
	path := "/api/v1/agents/pi:11111111-1111-4111-8111-111111111111/entries/entry_1/blocks/0"
	for _, tc := range []struct {
		query string
		want  bool
	}{
		{"revision=hash&offset=0&limit_bytes=65536", true},
		{"revision=hash&offset=0&limit_bytes=65536&part=skill_arguments", true},
		{"revision=hash&offset=0&limit_bytes=65536&part=raw", false},
		{"revision=hash&offset=0&limit_bytes=65536&part=", false},
		{"revision=hash&offset=0&limit_bytes=65536&part=skill_arguments&part=skill_arguments", false},
		{"revision=hash&offset=0&limit_bytes=65536&part=skill_arguments&uid=other", false},
	} {
		q, _ := url.ParseQuery(tc.query)
		if historyGatewayPath(path, q) != tc.want {
			t.Fatalf("selector query: %q", tc.query)
		}
	}
}
