---
created: 2026-11-01
updated: 2026-11-02
type: bug
status: open
priority: high
provenance: other
provenance_detail: pilot.18 clean gate
source_ref: taskfleet:01m6c2ybczc0gvg629k2gnka93/gate:live-long-run
originating_run: 01m6c2ybczc0gvg629k2gnka93
originating_run_kind: spinoff
lane: live-long-run-gap-under-load
lane_seq: 1
preparation: ready
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

Sample runs from attempt 3 (the flash came right as the run started working):

```
long-run states (25 ms samples):
gap=false working=false ×2
gap=true working=true ×1
gap=false working=true ×310
gap=false working=false ×21
```

This blocked the pilot.18 gate together with
`TestProcessResumeCatchUpAcrossDaemonRestart` (filed separately).

## Decision (Jari 2.11.)

This is a product defect, not a test to loosen. Even a 25 ms appearance of
the missed-events notice shifts the conversation's layout, so the whole UI
jolts visibly although the banner itself is hardly seen. The notice must
never appear while the page is recovering normally from `ring_truncated`
under load, and nothing may shift the layout during that recovery. Keep
the spec's strict "no sample shows the notice" assertion; fix the product so
it holds on a loaded host (reproduce under load, e.g. with the CPU-load
helper under `timeout` beside the spec, before and after).

Jari 2.11.: he has **not** seen any flash in real use. The only evidence is
the gate on a heavily loaded Birch (eight browser hosts plus Go tests on
eight cores). The fix still matters: the strict spec otherwise fails the
gate intermittently and blocks releases, and a loaded host must not jolt the
UI either.
