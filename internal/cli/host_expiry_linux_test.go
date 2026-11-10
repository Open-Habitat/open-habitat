//go:build linux

package cli

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/host"
)

func TestHostCheckExpiryWarningOutput(t *testing.T) {
	warning := host.Warning{Code: "github_token_expiring", Message: "Expiring token observed.", FixSuggestion: "Opt out in OAuth Apps > Optional features; reconnect after expiry."}
	r := host.Inspection{Ready: true, Warnings: []host.Warning{warning}}
	out := hostCheckEnvelope(r)
	b, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	var parsed struct {
		Warnings []host.Warning `json:"warnings"`
		Data     struct {
			Ready bool `json:"ready"`
		} `json:"data"`
	}
	if err := json.Unmarshal(b, &parsed); err != nil || !parsed.Data.Ready || len(parsed.Warnings) != 1 || parsed.Warnings[0] != warning {
		t.Fatalf("%s, %v", b, err)
	}
	var text bytes.Buffer
	printWarnings(out, &text)
	if !strings.Contains(text.String(), "warning: "+warning.Message) || !strings.Contains(text.String(), warning.FixSuggestion) {
		t.Fatal(text.String())
	}
	// Other failing checks must not hide the warning in either output mode.
	r.Ready = false
	blocked := hostBlocked("host_check_blocked", "checks failed", r)
	text.Reset()
	if emitError(blocked, options{}, &text) != 1 || !strings.Contains(text.String(), warning.FixSuggestion) {
		t.Fatal(text.String())
	}
	text.Reset()
	if emitError(blocked, options{json: true}, &text) != 1 || !json.Valid(text.Bytes()) || !strings.Contains(text.String(), warning.Code) {
		t.Fatal(text.String())
	}
	r.Warnings = nil
	b, _ = json.Marshal(hostCheckEnvelope(r))
	if !bytes.Contains(b, []byte(`"warnings":[]`)) {
		t.Fatal(string(b))
	}
}
