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
}
