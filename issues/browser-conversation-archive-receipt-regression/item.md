---
created: 2026-11-21
updated: 2026-11-21
type: bug
status: open
priority: normal
provenance: other
provenance_detail: observed while verifying the multiplayer browser surface
source_ref: taskfleet:01m7zetb9c2dwe7feak907cm0n/observed:browser-conversation-deterministic-14
originating_run: 01m7zetb9c2dwe7feak907cm0n
originating_run_kind: spinoff
lane: gate-red
lane_seq: 4
preparation: ready
---

# browser-conversation spec fails 14 archive and receipt cases deterministically on main

## Description

## Problem

On an unchanged `main` (01e1dc15), `web/tests/browser-conversation.spec.ts` fails the same 14 cases on every run, with `OH_BROWSER_WORKERS=2` on the synthetic browser host (not intermittent, unlike the cases in the repeat-flake issues):

- `:648` validated pending / rejected / uncertain send receipt never reposts (three cases, `toBeVisible`)
- `:910` settled turn uses its native strip without a duplicate receipt
- `:2101` idle controlled Pi can archive without stopping its child — after archive the URL stays `/workspaces/<id>?conversation=pi:<id>` where the case expects `/workspaces/<id>`
- `:2133` phone archives directly into its workspace (same URL expectation)
- `:2235`, `:2290`, `:2406` restart / restore archive cases
- `:3387`, `:3452`, `:3609` archive hiding and home card cases
- `:3917`, `:3944` archive undo and offer cases

The URL in the archive cases suggests the conversation route now carries `?conversation=pi:<id>` on the workspace page, and the archive cases (and possibly the receipt cases) still assume the earlier route shape.

## Reproduce

`OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts` on main: 14 failed, 74 passed (4.6 min). A branch adding the multiplayer browser surface fails the same 14.

## Done when

The spec is green on main, either by adapting the cases to the current route or by fixing a real regression in archive navigation if that is what they show.
