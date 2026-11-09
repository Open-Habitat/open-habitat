---
created: 2026-11-09
updated: 2026-11-09
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: clean gate failure on fb2e18df9
source_ref: taskfleet:01m6zarkf7v8427ydxgwcpmqj5/gate:fb2e18df9-helper-archive-122
originating_run: 01m6zarkf7v8427ydxgwcpmqj5
originating_run_kind: spinoff
closed: 2026-11-09
---

# Cancelled archive question loses focus when the remounted archive button is still disabled

## Description

The clean gate on fb2e18df9 failed in `web/tests/helper-archive.spec.ts:21`
at line 122 (`await expect(archive).toBeFocused()`), after `gate-red-r69`
had fixed the same assertion's remount race. The trace showed the
conversation's rail archive button resolving first as `disabled`, then
enabled, and focus never arriving.

A cancelled archive question returns focus to the conversation's rail
archive button one animation frame after the dialog closes. While a turn
ends, the remounted row's button can still be disabled (its archive reason
is not yet clear), and `focus()` on a disabled button does nothing, so focus
stays on the page. A person who cancels just as a turn ends loses their
keyboard place the same way.

Expected: focus lands on the conversation's archive button once it becomes
enabled, unless the person has moved on meanwhile.
