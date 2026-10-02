//go:build linux

package gateway

import (
	"net/url"
	"testing"
)

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
