---
created: 2026-10-16
updated: 2026-10-17
type: bug
status: open
priority: normal
provenance: other
source_ref: taskfleet:01m527q5a5srcdh3mx7c2y7cxc/observation:native-provisional-turn-duplicate
originating_run: 01m527q5a5srcdh3mx7c2y7cxc
originating_run_kind: spinoff
lane: web
collision: [web/src/app/, web/src/components/]
lane_seq: 3
---

# Native history duplicates a still-running provisional turn

## Description

# Native tool history duplicates an unfinished provisional turn

## Problem

During the held/slow fake-Pi tool phase, the same turn appears twice: a native-history turn marked `Vastaus valmis` with a tool row `tila ei tiedossa`, followed by a still-running provisional turn repeating `Katson ensin, mitä työtilassa on.`. This falsely announces completion while the tool is still running and inserts/removes a sizeable block in the timeline when history catches up.

## Evidence

Compare `issues/live-turn-flicker/before-tool.{png,html}` and `after-tool.{png,html}`. Both show this defect, so it predates the settling-warning fix. The latter corrects the active header's tool label but does not repair duplicate native/provisional turn joining. The selected prototype has one live turn, not two copies.

## Reproduction

In the synthetic lab, select `pi-deltas`, create a Pi conversation, send a prompt containing `hidas` and inspect the turn around tool start (about 6–8 seconds). `web/lab/flicker.mjs after` records this state using the real controller and fake Pi. This is synthetic evidence, not an observation of real provider behavior.

## Affected boundary

`BrowserConversation.tsx` renders `timelineItems(entries, ...)` and a separate provisional AgentTurn. Filtering live tool rows by native tool call ID does not join the containing turn or retire matching provisional message fragments. Fix using native identities/turn boundaries, not text equality.

## Acceptance Criteria

- [ ] During tool execution, native-history catch-up does not create a duplicate turn or claim `Vastaus valmis` before actual settlement.
- [ ] A browser mutation/layout regression covers the native/provisional join, including continued streaming and final saved history.

## Comments

### 2026-10-17T10:30:00Z · @jari

Accepted into the web lane (Jari 2026-10-17).
