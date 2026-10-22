//go:build linux

package host

import (
	"context"
	"errors"
	"os/exec"
	"testing"
)

func TestRuntimeVersionOrderingRefusesNewer(t *testing.T) {
	if _, e := exec.LookPath("dpkg"); e != nil {
		t.Skip("dpkg unavailable")
	}
	for _, c := range []struct {
		installed, wanted string
		newer             bool
	}{{"1.0-1ubuntu0.2", "1.0-1ubuntu0.1", true}, {"1.0-1ubuntu0.1", "1.0-1ubuntu0.2", false}, {"1:2.0", "9.0", true}, {"1.0", "1.0", false}} {
		got, e := runtimeVersionNewer(context.Background(), c.installed, c.wanted)
		if e != nil || got != c.newer {
			t.Fatal(c, got, e)
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, e := runtimeVersionNewer(ctx, "1", "2"); !errors.Is(e, context.Canceled) {
		t.Fatal(e)
	}
}
