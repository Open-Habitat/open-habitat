---
created: 2026-11-01
updated: 2026-11-01
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: pilot.18 clean gate
source_ref: taskfleet:01m6c2ybczc0gvg629k2gnka93/gate:live-long-run
originating_run: 01m6c2ybczc0gvg629k2gnka93
originating_run_kind: spinoff
---

# Missed-events notice flashes during a long run under load (live-long-run spec)

## Description

Observed in the pilot.18 clean gate on Birch (1.11.), attempts 1 (48eae59f)
and 3 (22a8ec89): `live-long-run.spec.ts` "a long tool-calling run shows
no missed-events notice" failed under the whole suite's load with one or
more 25 ms samples of `event-gap` visible while the run was working
(`samples.filter(s => s.gap)` was `[{gap: true, working: true}]` in
attempt 3). It passed alone each time it was rerun (three times on 1.11.).

So under CPU load the "Tapahtumia jäi väliin" notice still flashes briefly
while the daemon gives the live tail up (`ring_truncated`) and the page
recovers, the case 800f9458 fixed for the unloaded run. Whether a person
sees the flash on a loaded host, or only the 25 ms sampler does, is not
established.

Sample runs from attempt 3:

```
run states (25 ms samples):
gap=false working=false ×2
gap=true working=true ×1
gap=false working=true ×310
gap=false working=false ×21

  1) [chromium] › tests/live-long-run.spec.ts:12:1 › a long tool-calling run shows no missed-events notice 

    Error: expect(received).toEqual(expected) // deep equality
```

This blocked the pilot.18 gate together with
`TestProcessResumeCatchUpAcrossDaemonRestart` (filed separately).
