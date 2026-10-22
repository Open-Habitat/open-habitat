//go:build linux

package cli

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestHostPrepareParsing(t *testing.T) {
	id := strings.Repeat("a", 64)
	for _, args := range [][]string{
		{"--site", "relative", "--dry-run"},
		{"--site", "/site.json", "--dry-run", "--approved-plan", ""},
		{"--site", "/site.json", "--dry-run", "--approved-plan", "SECRET_SENTINEL"},
		{"--site", "/site.json", "--approved-plan", id, "--output=jsonl"},
		{"--site", "/site.json", "--approve-disruption", "--output=jsonl"},
		{"--site", "/site.json", "--approve-disruption", "--approved-plan", id},
		{"--site", "/site.json", "--dry-run", "--approve-disruption", "--approve-disruption"},
		{"--site", "/site.json", "--dry-run", "--site", "/other"},
		{"--site", "/site.json", "--dry-run", "--resume", "SECRET_SENTINEL"},
	} {
		var out, diagnostic bytes.Buffer
		if code := Run(append([]string{"--json", "host", "prepare"}, args...), &out, &diagnostic); code != 1 || out.Len() != 0 || !strings.Contains(diagnostic.String(), "invalid_arguments") || strings.Contains(diagnostic.String(), "SECRET_SENTINEL") {
			t.Fatal(args, code, out.String(), diagnostic.String())
		}
	}
	for _, args := range [][]string{
		{"--site", "/site.json", "--dry-run"},
		{"--site", "/site.json", "--dry-run", "--approved-plan", id},
		{"--site", "/site.json", "--approved-plan", id, "--approve-disruption", "--output=jsonl"},
	} {
		if _, err := parseHostMaintenance(args, false, true); err != nil {
			t.Fatal(args, err)
		}
	}
	if _, err := parseHostMaintenance([]string{"--site", "/site.json", "--approved-plan", id, "--approve-disruption", "--output=jsonl"}, true, true); err == nil {
		t.Fatal("live single-document JSON accepted")
	}
	if _, err := parseHostApply([]string{"--site", "/site.json", "--dry-run", "--approve-disruption"}, true); err == nil {
		t.Fatal("prepare flag leaked into apply")
	}
}

func TestHostPrepareNoFabricatedResultBeforeObservation(t *testing.T) {
	var out, diagnostic bytes.Buffer
	code := Run([]string{"host", "prepare", "--site", "/nonexistent/host-site.json", "--dry-run", "--output=jsonl"}, &out, &diagnostic)
	if code == 0 {
		t.Fatal("missing site succeeded")
	}
	lines := strings.Split(strings.TrimSpace(out.String()), "\n")
	if len(lines) != 2 {
		t.Fatal(out.String())
	}
	var event map[string]any
	if json.Unmarshal([]byte(lines[1]), &event) != nil || event["event"] != "error" {
		t.Fatal(out.String())
	}
	if _, ok := event["data"]; ok {
		t.Fatal("fabricated preparation result", out.String())
	}
}
