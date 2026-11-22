//go:build linux

package cli

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/host"
)

func TestDoctorRequiredBrowser(t *testing.T) {
	for _, status := range []string{"pass", "fail", "unavailable"} {
		result, err := doctorBrowserResult("gateway", nil, host.Check{Code: "server_browser.chrome", Status: status, Reason: "test_reason"})
		if status == "pass" {
			if err != nil || result == nil {
				t.Fatalf("result=%v err=%v", result, err)
			}
			continue
		}
		var ce *cliError
		if !errors.As(err, &ce) || ce.exit != 1 || ce.code != "server_browser_required" {
			t.Fatalf("err=%v", err)
		}
		var data struct {
			Data struct {
				Checks  []struct{ ID, Status string }
				Summary map[string]int
			}
		}
		if err := json.Unmarshal(ce.result, &data); err != nil {
			t.Fatal(err)
		}
		if len(data.Data.Checks) != 1 || data.Data.Checks[0].ID != "server_browser.chrome" || data.Data.Checks[0].Status != "fail" || data.Data.Summary["fail"] != 1 {
			t.Fatalf("result=%s", ce.result)
		}
	}
}

func TestHostRequiredBrowserError(t *testing.T) {
	ce := hostError(errors.Join(host.ErrServerBrowser, errors.New("PRIVATE_APT_OUTPUT")))
	if ce.code != "server_browser_required" || ce.exit != 2 || strings.Contains(ce.message, "PRIVATE_APT_OUTPUT") {
		t.Fatalf("error=%+v", ce)
	}
}
