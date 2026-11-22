---
created: 2026-11-22
updated: 2026-11-22
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: v0.1.5 release gate
source_ref: taskfleet:01m8203anaw519dvyrq9ag3jdv/gate-flake:rail-outline-focus
originating_run: 01m8203anaw519dvyrq9ag3jdv
originating_run_kind: spinoff
---

# Rail row focus outline missing after keyboard focus (rail-archive flake)

## Description

## Description

`web/tests/rail-archive.spec.ts:18` › "rail titles have no field outline at rest, selected, hovered or focused" failed in 1 of 4 isolated reruns on a calm host during the v0.1.5 release gate on `f07782c0d` (`OH_BROWSER_WORKERS=2`, seed `OH_REPLY_SEED=52b6027fbc98b0ed OH_REPLY_DELAY_MS=60`).

```
expect(locator).toHaveCSS(expected) failed
Locator:  getByRole('navigation').getByTestId('agent-item-pi:…').locator('.ah-now-row')
Expected: "solid"  Received: "none"   (outline-style)
  at web/tests/rail-archive.spec.ts:77:52   (after keyboard Tab + link.focus())
```

After focusing the row's link the row's focus outline did not appear within 5 s. Either focus moved away (a re-render replacing the link, or the Tab landing elsewhere) or `:focus-visible` was not set because `link.focus()` came after a pointer interaction. Release diff since the last green gate does not touch the rail.

Find out whether keyboard focus on a rail row can lose its visible outline for a person; if not, make the spec establish keyboard modality deterministically.

Reproduce from the product root:

```
OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec rail-archive.spec.ts
```
(repeat a few times; seed above.) The same file's "archives from its row … comes back from the notice" case failed in the gate itself; that one is already filed as `quite-dead-stocking`.
