//go:build linux

package provision

import (
	"path/filepath"
	"testing"
)

func TestWriterPublicationIsSeparateFromReadiness(t *testing.T) {
	w, host := writerFixture(t)
	var published []string
	w.Published = func(user string) { published = append(published, user) }
	host.readyErr = true
	reply := handle(w, "ensure", "42", "carol")
	if reply.Route != nil || len(published) != 1 || published[0] != "carol" {
		t.Fatalf("publication and readiness conflated: %+v, %v", reply, published)
	}
}

func TestWriterPreReservationGuardDiagnostic(t *testing.T) {
	for _, tc := range []struct {
		name, fail, stage string
		occupied          bool
		want              Failure
	}{
		{name: "host error", fail: "available", stage: "availability_error", want: Drift},
		{name: "host occupied", occupied: true, stage: "no_available_binding", want: NameCollision},
		{name: "allowlist denial", want: Denied},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w, h := writerFixture(t)
			h.fail = tc.fail
			if tc.occupied {
				h.occupied["carol"] = true
			}
			var stages []string
			w.GuardEvent = func(stage string) { stages = append(stages, stage) }
			id := "42"
			if tc.want == Denied {
				id = "43"
			}
			r := handle(w, "ensure", id, "carol")
			if r.Failure != tc.want || r.Route != nil {
				t.Fatalf("reply: %+v", r)
			}
			if tc.stage == "" && len(stages) != 0 || tc.stage != "" && (len(stages) != 1 || stages[0] != tc.stage) {
				t.Fatalf("guard stages: %v", stages)
			}
			if !fileAbsent(filepath.Join(w.Dir, "pending.json")) {
				t.Fatal("pre-reservation guard wrote pending state")
			}
		})
	}
}
