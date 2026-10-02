---
created: 2026-10-02
updated: 2026-10-02
type: bug
status: untriaged
priority: normal
provenance: lab-test
source_ref: taskfleet:01m3y604smwsz03p5qtyqw9z7h/lab-observation:controlled-reading-position
originating_run: 01m3y604smwsz03p5qtyqw9z7h
originating_run_kind: spinoff
---

# Warm controlled conversation return loses reading position after older paging

## Description

## Description
A warm return to a controlled conversation jumps to the newest message rather than retaining the reader's position after backward paging. This defeats the core reading-position goal for long conversations and interrupts reviewing older text. Observed in the synthetic Chromium lab (production bundle, fake Pi), not inferred from code.

## Reproduction
1. In Alice's lab workspace `aurinkokello`, start a controlled conversation and send 34 numbered messages to fake Pi; wait for each reply. Reload the route so history is fetched as a window.
2. Scroll toward older messages and click `Lataa seuraava historiasivu` (the network requests include `history?limit=25&before=...`). Note which old reply is visible.
3. Click `Etusivu`, then click the same controlled conversation in the sidebar without reloading.
4. Observe the conversation at the newest reply instead of the old one. No history/status GET occurs on this warm return; this is a client reading-position problem.

Observed twice in a fresh synthetic profile on this worktree: before the switch `pitkä historia 28` was in view; after the return `pitkä historia 34` was in view. In one trace scrollTop changed from 7911 to 16547. The backward-page anchor itself held: the selected old reply's top moved only 0.0625 px on page insertion. The warm return took 170 ms and made zero API requests. Local trace and before/after screenshots: ignored `.cache/lab/final-probe.log` and `.cache/lab/shots/snappy-scroll-{before,after}.{png,html}`. Do not interpret the scrollTop values alone as a stable row key.

## Quick Test
Repeat the journey with a seeded long controlled history; compare the first visible reply text and its position before navigating away and after returning, while checking zero status/history GETs. Test both at top of an older page and mid-way through it.
