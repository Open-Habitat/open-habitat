//go:build linux

package integrations

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

// A completed approval must be consumed by the next scheduled poll, without
// another devicecode request or a resubmission of the displayed user code.
// Both native stores must then be ready, not merely the first Graph token.
func TestMicrosoftFirstApprovalAfterPendingAndSlowDown(t *testing.T) {
	env := microsoftEnv(t)
	m := syntheticMicrosoft(t, "person@example.test", "")
	base := m.client.Transport
	polls, codes := 0, 0
	var previous time.Time
	m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
		if strings.HasSuffix(r.URL.Path, "/devicecode") {
			codes++
		}
		if strings.HasSuffix(r.URL.Path, "/token") {
			polls++
			now := time.Now()
			if polls == 3 && now.Sub(previous) < 5*time.Second {
				t.Error("ignored slow_down interval")
			}
			previous = now
			response := ""
			if polls == 1 {
				response = `{"error":"authorization_pending","error_codes":[70016]}`
			}
			if polls == 2 {
				response = `{"error":"slow_down"}`
			}
			if response != "" {
				return &http.Response{StatusCode: http.StatusBadRequest, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(response))}, nil
			}
		}
		return base.RoundTrip(r)
	})
	l := msLogin(t, m, env, "")
	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
	defer cancel()
	prompts := 0
	address, err := l.WaitWithPrompt(ctx, func(p Prompt) error {
		prompts++
		if p.UserCode == l.prompt.UserCode {
			t.Error("reused the files code for Outlook")
		}
		return nil
	})
	if err != nil || address != "person@example.test" || polls != 3 || codes != 1 || prompts != 1 {
		t.Fatalf("approval result: address=%q err=%v polls=%d code requests=%d Outlook prompts=%d", address, err, polls, codes, prompts)
	}
	if err := l.Commit(ctx, address); err != nil {
		t.Fatal(err)
	}
	if remotes, err := microsoftRemotes(env, address); err != nil || len(remotes) != 2 {
		t.Fatal("files store not ready", err)
	}
	if state := microsoftMCPState(ctx, env, address); state != StateOK {
		t.Fatal("Outlook store not ready", state)
	}
}
