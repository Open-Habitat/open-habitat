//go:build linux

package cli

import (
	"strings"
	"testing"
)

func TestHostUpgradeExplicitApprovalAndStrictFlags(t *testing.T) {
	base := []string{"--site", "/etc/open-habitat/site.json", "--approved-plan", strings.Repeat("a", 64), "--output=jsonl"}
	if _, e := parseHostUpgrade(base, false); e == nil {
		t.Fatal("maintenance not approved")
	}
	args := append(append([]string{}, base...), "--approve-maintenance", "--approve-interruption")
	o, e := parseHostUpgrade(args, false)
	if e != nil || !o.upgrade || !o.approveInterruption || !o.approveDisruption {
		t.Fatal(o, e)
	}
	for _, extra := range [][]string{{"--approve-maintenance"}, {"--approve-disruption"}, {"--force"}} {
		if _, e = parseHostUpgrade(append(append([]string{}, args...), extra...), false); e == nil {
			t.Fatal("unsafe flag accepted", extra)
		}
	}
	if _, e = parseHostUpgrade(args, true); e == nil {
		t.Fatal("live single JSON accepted")
	}
	if _, e = parseHostUpgrade([]string{"--site", "/site.json", "--dry-run"}, true); e != nil {
		t.Fatal(e)
	}
	for _, bad := range [][]string{{"--lead-time", "30s"}, {"--lead-time", "61m"}, {"--lead-time", "2m", "--immediate"}, {"--lead-time"}, {"--lead-time", "2m", "--lead-time", "3m"}, {"--lead-time", "1m30.5s"}} {
		if _, e = parseHostUpgrade(append(append([]string{}, args...), bad...), false); e == nil {
			t.Fatal("bad countdown accepted", bad)
		}
	}
	o, e = parseHostUpgrade(append(append([]string{}, args...), "--lead-time", "10m"), false)
	if e != nil || o.leadTime.Minutes() != 10 || o.immediate {
		t.Fatal(o, e)
	}
	o, e = parseHostUpgrade(append(append([]string{}, args...), "--immediate"), false)
	if e != nil || !o.immediate || o.leadTime != 0 {
		t.Fatal(o, e)
	}
}
