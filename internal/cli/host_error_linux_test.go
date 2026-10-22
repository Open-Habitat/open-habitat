//go:build linux

package cli

import (
	"errors"
	"github.com/Open-Habitat/open-habitat/internal/host"
	"strings"
	"testing"
)

func TestHostEntryFenceErrorHasPriority(t *testing.T) {
	for _, e := range []error{errors.Join(host.ErrUnitPolicy, host.ErrEntryFence), errors.Join(host.ErrEntryFence, host.ErrUnitPolicy), errors.Join(host.ErrStalePlan, host.ErrEntryFence)} {
		ce := hostError(e)
		if ce.code != "entry_fence_unavailable" || ce.exit != 2 || !strings.Contains(ce.message, "keep external ingress closed") {
			t.Fatalf("closure failure lost precedence: %+v", ce)
		}
	}
}
func TestHostStaleGuidanceDoesNotPromiseSupersession(t *testing.T) {
	ce := hostError(host.ErrStalePlan)
	if ce.code != "stale_plan" || ce.exit != 1 || !strings.Contains(ce.message, "only before an operation starts") || !strings.Contains(ce.message, "never to supersede") {
		t.Fatal(ce)
	}
}
