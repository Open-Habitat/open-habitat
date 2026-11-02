---
created: 2026-11-02
updated: 2026-11-02
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: observed while verifying live-long-run-gap-under-load under load
source_ref: taskfleet:01m6dhbj8yv17s2rsye0zkg8bh/gate:live-long-run-working
originating_run: 01m6dhbj8yv17s2rsye0zkg8bh
originating_run_kind: spinoff
---

# live-long-run spec misses the working state under heavy load

## Description

Observed while verifying `live-long-run-gap-under-load` on Birch (14 busy loops
under `timeout` beside four parallel workers, load average ~25):
`live-long-run.spec.ts` failed 4 of 13 runs with the fix and 1 of 5 on the
unfixed tree at

    expect(getByTestId("message-input").and('[data-working="true"]')).toBeVisible({ timeout: 15000 })

In every failure the run itself completed ("Pitkä ajo valmis." shown, no
missed-events notice); the page simply never observed `data-working="true"`.
The composer's activity comes only from controller status
(`current.run_active`, BrowserConversation.tsx), refreshed by the active
conversation's status events through `useConversation.refresh`, which queues
behind a pending read. Under starvation the status read that would report
`run_active` apparently lands only after the ~8 s run has settled.

Impact: on a heavily loaded gate host the spec fails without any product
fault visible to a person, the same release-blocking flake class as the
original issue. Open question for triage: is it the spec (it should wait on
something the run is guaranteed to show, or accept a run that was observed
through its live turn), or should the composer show working from the live
stream when status lags?
