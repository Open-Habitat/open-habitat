//go:build linux

package provision

import (
	"errors"
	"strings"
	"testing"
)

// The writer's optional diagnostic callback receives only a fixed stage. A
// promptly failing sink cannot change the pre-reservation denial or state.
func TestGuardDiagnosticSinkFailurePreservesDenial(t *testing.T) {
	w, host := writerFixture(t)
	host.fail = "available"
	var stages []string
	w.GuardEvent = func(stage string) {
		stages = append(stages, stage)
		_, _ = (&rejectGuardLog{}).Write([]byte(stage))
	}
	reply := handle(w, "ensure", "42", "carol")
	if reply.Failure != Drift || reply.Route != nil || len(stages) != 1 || stages[0] != "availability_error" {
		t.Fatalf("reply=%+v stages=%v", reply, stages)
	}
	for _, secret := range []string{"carol", "42", "synthetic-token", "synthetic-tool-content"} {
		if strings.Contains(strings.Join(stages, ""), secret) {
			t.Fatal("guard emitted request/content")
		}
	}
	// Even after a diagnostic write failure, this was a guard, not a mutation.
	if got := handle(w, "authorize", "42", ""); got.Route != nil {
		t.Fatalf("unexpected binding: %+v", got)
	}
}

type rejectGuardLog struct{}

func (*rejectGuardLog) Write([]byte) (int, error) { return 0, errors.New("synthetic sink unavailable") }
