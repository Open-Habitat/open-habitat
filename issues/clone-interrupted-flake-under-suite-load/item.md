---
created: 2026-10-28
updated: 2026-10-28
type: bug
reporter: conductor
status: untriaged
priority: normal
provenance: chat
source_ref: suite:2026-10-28/r29/clone-page
---

# Browser suite: interrupted-clone spec times out under whole-suite load

## Description

Whole browser suite on main 71340904 (Birch, 28.10. r29, default workers): tests/clone-page.spec.ts:243 '@lab an interrupted clone is restarted or removed only explicitly' failed: expect(page).toHaveURL(/\/workspaces$/) timed out after 5000 ms, page stayed at /workspaces/new. The same spec passed 3/3 alone (11 passed each, OH_BROWSER_WORKERS=2). Load-dependent timing, not a regression of the round (folder offer rows, integration wizard). Log: ~/.local/state/oh-conductor/suite-r29/browser.log on Birch.
