//go:build linux

package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
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
	var logs bytes.Buffer
	l.log = slog.New(slog.NewJSONHandler(&logs, nil))
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
	for _, secret := range []string{"access-secret", "refresh-secret", "device-secret", "FIRST1234", "ABCD12345", "person@example.test"} {
		if strings.Contains(logs.String(), secret) {
			t.Fatal("login diagnostics leaked native data")
		}
	}
	acquired := false
	for _, line := range strings.Split(strings.TrimSpace(logs.String()), "\n") {
		var row map[string]any
		if err := json.Unmarshal([]byte(line), &row); err != nil {
			t.Fatal(err)
		}
		if row["flow"] == "files" && row["transition"] == "token_acquired" {
			acquired = true
			if row["pending_count"] != float64(1) || row["slow_down_count"] != float64(1) {
				t.Fatal("lost polling counters", row)
			}
		}
	}
	if !acquired {
		t.Fatal("missing token transition")
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

// A slow Graph response used to leave the already-spent files code visible.
// Hold discovery at the daemon boundary, not a UI-only simulated state.
func TestMicrosoftRelayHidesApprovedCodeDuringDiscovery(t *testing.T) {
	env := microsoftEnv(t)
	m := syntheticMicrosoft(t, "person@example.test", "")
	base := m.client.Transport
	entered, release := make(chan struct{}), make(chan struct{})
	m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
		if r.URL.Path == "/v1.0/me/drive" {
			close(entered)
			select {
			case <-release:
			case <-r.Context().Done():
				return nil, r.Context().Err()
			}
		}
		return base.RoundTrip(r)
	})
	c := New(env, []Entry{m}, nil)
	ctx, cancel := context.WithCancel(context.Background())
	c.Start(ctx)
	defer func() { cancel(); c.relay.cancelAll(); c.sync.stopAll() }()
	h := c.Handler(allow)
	code, _, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "microsoft"})
	if code != 200 {
		t.Fatal(code)
	}
	select {
	case <-entered:
	case <-time.After(5 * time.Second):
		t.Fatal("discovery not reached")
	}
	view := c.relay.view(ownerA, time.Now())
	if view.State != "completing" || view.LoginPhase != "files_discovery" || view.UserCode != "" || view.VerificationURI != "" {
		t.Fatalf("spent grant still advertised: state=%s phase=%s code_present=%t link_present=%t", view.State, view.LoginPhase, view.UserCode != "", view.VerificationURI != "")
	}
	close(release)
	waitState(t, h, ownerA, "choose_folders")
}
