//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestMicrosoftCompositeSiteWirePath(t *testing.T) {
	m := syntheticMicrosoft(t, "person@example.test", "")
	l := &microsoftLogin{entry: m, address: "person@example.test"}
	if err := l.discover(context.Background(), "access-secret", map[string]bool{"Sites.ReadWrite.All": true}); err != nil {
		t.Fatal(err)
	}
	if len(l.skippedSites) != 0 || !strings.Contains(string(l.config), "drive_id=library-drive,") {
		t.Fatal("composite site did not yield its library")
	}
}

func TestMicrosoftSiteIDValidationBeforeRequest(t *testing.T) {
	for _, id := range []string{
		"", "tenant,site,web", "root", "../me", testMicrosoftSite + "/../root",
		strings.ReplaceAll(testMicrosoftSite, ",", "%2C"), testMicrosoftSite + "?x=1",
		testMicrosoftSite + "#fragment", testMicrosoftSite + "\n", testMicrosoftSite + ",extra",
		strings.Replace(testMicrosoftSite, "2C712604", "gC712604", 1),
		"https://" + testMicrosoftSite, "user@" + testMicrosoftSite,
		"-" + testMicrosoftSite, "." + testMicrosoftSite,
		strings.Replace(testMicrosoftSite, "contoso", strings.Repeat("a", 64), 1),
		strings.Repeat(strings.Repeat("a", 63)+".", 4) + testMicrosoftSite,
	} {
		t.Run(id, func(t *testing.T) {
			m := syntheticMicrosoft(t, "person@example.test", "")
			base := m.client.Transport
			m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
				if r.URL.Path == "/v1.0/me/followedSites" {
					data, _ := json.Marshal(map[string]any{"value": []map[string]string{{"id": id}}})
					return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(string(data)))}, nil
				}
				if r.URL.Path != "/v1.0/me/drive" {
					t.Errorf("invalid site ID reached HTTP: %s", r.URL)
					return nil, ToolFailed
				}
				return base.RoundTrip(r)
			})
			l := &microsoftLogin{entry: m, address: "person@example.test"}
			err := l.discover(context.Background(), "access-secret", map[string]bool{"Sites.ReadWrite.All": true})
			var detail microsoftDiscoveryError
			if !errors.As(err, &detail) || detail.step != "site_id" || len(l.config) != 0 {
				t.Fatalf("invalid site not rejected before discovery: %v", err)
			}
		})
	}
	for _, id := range []string{testMicrosoftSite, strings.ToLower(testMicrosoftSite), strings.Replace(testMicrosoftSite, "contoso.sharepoint.com", "tenant-name.sharepoint.us", 1)} {
		if !validMicrosoftSiteID(id) {
			t.Errorf("valid composite ID rejected: %s", id)
		}
	}
}

// Labels are only names: an inventory that fits without them still
// connects when they would not fit.
func TestMicrosoftLabelsGiveWayToTheAccountsOwnRoots(t *testing.T) {
	m := syntheticMicrosoft(t, "person@example.test", "")
	probe := &microsoftLogin{entry: m, address: "person@example.test"}
	if err := probe.discover(context.Background(), "access-secret", map[string]bool{"Sites.ReadWrite.All": true}); err != nil {
		t.Fatal(err)
	}
	// Two sections with labels; choose a token that fits only without them.
	labels := strings.Count(string(probe.config), microsoftLabelKey+" = ")
	if labels != 2 {
		t.Fatal(labels)
	}
	labelBytes := 0
	for _, line := range strings.Split(string(probe.config), "\n") {
		if strings.HasPrefix(line, microsoftLabelKey+" = ") {
			labelBytes += len(line) + 1
		}
	}
	bare := len(probe.config) - labelBytes
	// The one token, in the account's section, takes the rest of the room.
	l := &microsoftLogin{entry: m, address: "person@example.test", token: []byte(strings.Repeat("t", maxMicrosoftConfig-bare))}
	if err := l.discover(context.Background(), "access-secret", map[string]bool{"Sites.ReadWrite.All": true}); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(l.config), microsoftLabelKey) || len(l.config) > maxMicrosoftConfig || len(l.config)+labelBytes <= maxMicrosoftConfig {
		t.Fatal(len(l.config), labelBytes)
	}
}
