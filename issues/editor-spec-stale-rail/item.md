---
created: 2026-10-30
updated: 2026-10-30
type: bug
reporter: agent
status: open
priority: normal
lane: editor-spec
lane_seq: 1
preparation: ready
---

# workspace-editor spec still expects the rail hidden beside the editor

## Description


## Description

The whole browser suite on integrated main (`b637b728`, 30.10.) fails one
case, deterministically and already on `abcef87a` before the 30.10. round:
`web/tests/workspace-editor.spec.ts:79` (*opens beside the conversation with a
remembered divider and a strip*) asserts at line 97 that
`getByRole("navigation")` is hidden once the editor opens. Since `eb23bed9`
(`account-button-hidden-with-editor`, 29.10.) the rail intentionally narrows to
its compact strip beside the editor instead of stepping aside, so the
navigation stays visible (`nav.ah-rail.ah-rail-collapsed`). 480 other cases
passed.

## Acceptance Criteria

- [ ] The spec asserts the 29.10. behaviour (the rail shows its compact strip
      beside the editor, column width as before) instead of a hidden rail, and
      passes; the rest of `workspace-editor.spec.ts` stays green.
