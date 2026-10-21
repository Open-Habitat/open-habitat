---
created: 2026-10-20
updated: 2026-10-21
type: bug
status: open
priority: normal
provenance: other
source_ref: taskfleet:01m5crtawtj0wsyqz17tfxscwa/baseline:recheck-popover
originating_run: 01m5crtawtj0wsyqz17tfxscwa
originating_run_kind: spinoff
lane: test-health
lane_seq: 1
collision: [web/tests]
---

# Conversation recheck test opens a popover that blocks its recovery button

## Description

## Description

The maintained conversation regression suite deterministically times out in `validated uncertain send receipt never reposts`: its `refreshConversation` helper opens Tiedot even when the recovery button is outside that popover, then tries to click the covered button. The popover intercepts pointer events for 30 seconds. This prevents the suite from verifying no replay on uncertain delivery and makes otherwise unrelated changes fail landing validation. Establish whether the helper must avoid opening/close the informational popover when the action is already visible; do not force-click through it or weaken delivery assertions.

## Reproduction

On unchanged main revision `daadaef5`, run `umask 077; TMPDIR=/var/tmp ./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts`. Result: 66 passed, exactly one failed at `refreshConversation` line 48 clicking `Tarkista keskustelun tila`. Trace: section `.ah-details-popover` from `.ah-agent-header` intercepts the pointer. Both phone/desktop model-picker cases pass.

Unchanged-main copy: `/var/tmp/quota-baseline-current.FfccfA` (detached clean clone, no quota implementation). Remote ARM64 job `5bb9a88285f87a52cc6aeff87da1db7da91d3b6d0a088406be8d87250932a044`, evidence `/var/tmp/oh-browser-d98qk0ym`, snapshot `f080c99f245af6c021f6968f09465990262ceb3d1dd5e8108d69f890cd6a1730`.

Identical failure on quota integration revision `ff1b3de6`: job `079921cc647a5a275d0146628eaa8e45db106a3199ebf7e704b546fac3de2089`, evidence `/var/tmp/oh-browser-_gad_urb`, 66 passed/1 failed. Also reproduced on an earlier integrated attempt. This is a verified baseline regression, not a quota-induced failure. No claim of a live product failure or automatic replay.

## Quick Test

The full conversation spec passes without bypassing browser hit testing; uncertain delivery still never triggers automatic reposting.
