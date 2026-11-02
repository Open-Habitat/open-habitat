---
created: 2026-11-01
updated: 2026-11-02
type: bug
status: open
priority: normal
provenance: other
provenance_detail: pilot.18 clean gate
source_ref: taskfleet:01m6c2ybczc0gvg629k2gnka93/gate:process-resume-catch-up
originating_run: 01m6c2ybczc0gvg629k2gnka93
originating_run_kind: spinoff
---

# TestProcessResumeCatchUpAcrossDaemonRestart fails under gate load

## Description

Observed in the pilot.18 clean gate on Birch (1.11., attempt 3 at
22a8ec89, Go/contracts phase running beside the browser suites):

```
--- FAIL: TestProcessResumeCatchUpAcrossDaemonRestart (1.35s)
    process_resume_native_linux_test.go:299: a catch-up without news:
```

followed by the fake model request body. The test passed in attempts 1 and 2
and three times alone afterwards
(`go test ./internal/daemon -run '^TestProcessResumeCatchUpAcrossDaemonRestart$' -count=1`),
so it depends on timing under load. The assertion at line 299 is:

```go
	})
	stop(second, cancelSecond, id)

	// Nothing happened while Pi was down this time: the agent is told nothing,
	// as the person saw no card, and nothing earlier is told again.
	third, cancelThird := h.daemon()
	defer cancelThird()
	if inv := inventory(third, id); len(inv.Interrupted) != 0 {
		t.Fatalf("nothing was cut off: %+v", inv.Interrupted)
	}
	if w := h.send(third, id, "Taas", heldC); w.Code != 200 {
		t.Fatalf("third send: %d %s", w.Code, w.Body.String())
	}
	if again := request(third, id, 8); strings.Count(again, "[Open Habitat] This conversation's Pi stopped at") != 1 || strings.Count(again, "Nothing settled meanwhile.") != 0 || strings.Count(again, `\"dev-server\": test`) != 1 || strings.Count(again, "nothing is waiting for") != 1 {
		t.Fatalf("a catch-up without news:\n%s", again)
	}
	settled(third, id, heldC)
}

func TestProcessCatchUpLogic(t *testing.T) {
	command := exec.Command("node", "--test", "pi-device-test/catch-up.test.mjs")
```
