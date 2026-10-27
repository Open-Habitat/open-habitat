---
created: 2026-10-27
updated: 2026-10-27
type: bug
status: open
priority: normal
provenance: other
provenance_detail: worker observation in synthetic lab
source_ref: taskfleet:01m5xzz6ppskd94kn0fvah8ks2/observation:desktop-header-title-squeezed
originating_run: 01m5xzz6ppskd94kn0fvah8ks2
originating_run_kind: spinoff
lane: desktop-header
lane_seq: 1
preparation: ready
---

# Desktop conversation header squeezes the title to nothing at ~1280 px with the sidebar open

## Description

Seen in the synthetic lab on 2026-10-27 while working on `phone-header-too-tall`:
at a 1280 px window with the sidebar open, the conversation column is about
820 px wide, which is above the 800 px phone breakpoint, so the desktop header
is used. Its single row (workspace name, activity "Odottaa sinua", Git chip
with branch, context ring, model chip "Malli ei tiedossa · Ei tiedossa",
editor, terminal, new title, archive, Tiedot) takes the whole width. The
title (`.ah-title-row`, `flex: 1 1 0; min-width: 0`) shrinks to nothing; only
its dots are left. The conversation then has no visible title on desktop.

Likely affects any window between ~800 and ~1400 px with the sidebar open,
and is worse with a long branch name or model name. The phone two-row layout,
or giving the title a minimum width, would fix it.

## Decisions

### 2026-10-27T12:59:39Z · @jari

Jari 2026-10-27: työhön (konduktorin suositus).
