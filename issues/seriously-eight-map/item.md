---
created: 2026-10-16
updated: 2026-10-17
type: bug
status: fixed
priority: normal
provenance: other
source_ref: taskfleet:01m527q5a5srcdh3mx7c2y7cxc/observation:lab-automatic-recap-absent
originating_run: 01m527q5a5srcdh3mx7c2y7cxc
originating_run_kind: spinoff
closed: 2026-10-17
---

# Automatic recap is absent in existing lab journeys

## Description

# Synthetic automatic recap no longer appears in existing lab journeys

## Problem

Two existing host-backed lab cases reproducibly fail because the automatic recap never becomes visible: `recap is separate, persisted and becomes stale after a new turn` (20-second wait) and `unsupported-model action remains usable when a native recap arrives` (5-second wait). This removes automatic recap coverage from the clean gate; a genuine regression can no longer be distinguished from the broken prerequisite.

## Reproduction

On base revision `31836307b3bfb4d70404694a9312430d369afeca`, restore the original `web/src/app/BrowserConversation.tsx`, then run:

```
OH_PORT_BASE=29000 OH_BROWSER_WORKERS=1 TMPDIR=/var/tmp/open-habitat-build PLAYWRIGHT_BROWSERS_PATH=/home/maintainer/.cache/ms-playwright ./scripts/test-focused.sh --area browser --spec lab-conversation.spec.ts --tag 'recap is separate|unsupported-model action'
```

Both fail with no `Keskustelun yhteenveto` card. The same failures occurred with four and two workers on the live-turn-flicker branch. Restoring original source establishes that the live-turn warning changes are not required to reproduce them.

## Bounds

The manual streaming → change scenario to pi-recap → second send journey does generate an automatic recap. See `issues/live-turn-flicker/after-recap.{png,html}`. The difference in initial fixture/controller state needs diagnosis rather than simply increasing waits or deleting these tests. No claim about live-server/provider behavior is established.

## Acceptance Criteria

- [ ] Determine whether the missing recap is a controller, fixture or browser fault and restore these journeys' meaningful automatic-recap coverage.

## Comments

### 2026-10-17T10:30:00Z · @jari

Closed as fixed: both recap lab cases passed in the green clean gate of tree `b09da1d6` on 2026-10-17 (Jari's decision).
