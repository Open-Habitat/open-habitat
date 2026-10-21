---
created: 2026-10-20
updated: 2026-10-21
type: bug
status: fixed
priority: normal
provenance: other
source_ref: taskfleet:01m5bwth0jx3g2bt67w44s5dqj/observed:terminal-tablist-aria
originating_run: 01m5bwth0jx3g2bt67w44s5dqj
originating_run_kind: spinoff
lane: terminal
lane_seq: 1
collision: [web/src/components/terminal]
closed: 2026-10-21
---

# Terminal tablist has invalid close-button children

## Description

The browser terminal's tablist contains both tab buttons and sibling close
buttons inside each visual tab wrapper. Axe flags `aria-required-children`
(critical, WCAG 1.3.1): the tablist's close buttons are not allowed children.
This is present before browser-shell-polish, but was observed while running
its new focused accessibility check against the real synthetic host.

Reproduce: open a conversation, open its terminal, then run AxeBuilder on
`.ah-terminal-dock`. The invalid descendant is `.ah-terminal-x` under
`.ah-terminal-tabs[role=tablist]`. Source: web/src/components/TerminalPanel.tsx.

Keep the visible per-tab close action, keyboard Delete action and tab
navigation while making the accessibility tree a valid tablist. Include a
focused axe regression. No gateway or daemon change is needed.


## Acceptance Criteria

- [x] The terminal tablist owns only tabs; per-tab close buttons remain exposed separately.
- [x] Arrow navigation, visible close actions and keyboard Delete remain usable.
- [x] Focused axe checks cover the complete terminal dock without excluding tabs.

## Result

The visual strip retains its existing markup and layout for each tab/close pair.
A separate, layout-neutral tablist uses `aria-owns` to group only the tab buttons;
close buttons remain independent accessible actions. The tablist has a small
absolute-positioned box because Chromium omits an empty `display: contents`
node. Existing tab focus references still point at the visual strip.

Focused self-review was proportionate: this changes only browser semantics and
its regression tests, with no identity, host authority, credentials or Unix-user
boundary changes. Reviewed ownership updates on tab creation/removal, stable
IDs and panel labelling, arrow focus and existing close handling.

Host-backed synthetic ARM64 browser evidence (same UID, not isolation proof):
`TMPDIR=/var/tmp ./scripts/test-focused.sh --area browser --spec browser-shell.spec.ts`
passed all 9 cases, including the full-dock axe check, the two-tab accessibility
tree, both arrow directions, visible busy-shell close confirmation and Delete
on an idle tab. Job `a604c63628fa4f5adaf755a3721019f340be275eb7750da2a6bd3494cdf30bc4`,
base HEAD `2d81ff0dee972fd2a0852c8181ea370dddb4ec56` plus this issue's source diff.
The subsequent test edit only applies formatter-required line wrapping.

Development failures resolved: initial formatting errors; YAML quoting in the
new ARIA snapshot; the omitted `display: contents` tablist; and the new Delete
case racing the optimistic tab's replacement. The final case waits for a real
shell and terminal focus. A later web check caught one more line-wrap error,
now corrected. No application failure is being waived as pre-existing.

Captures deferred under Alder's no-local-specialist/lab policy; no live host
was accessed. Browser evidence is Chromium-only; manual screen-reader and
other-browser testing were not performed. No Fleetrepo installation change is
needed.

Final `TMPDIR=/var/tmp ./scripts/test-focused.sh --area web` passed formatting,
lint, typecheck, unit and component checks (job
`55c6b13e7fc615975ba6a4f7cc6d1f3284fd606c518ce9997cb94855f2d91a8e`).
`git diff --check`, `issuectl doctor --json` and
`python3 scripts/validate-project-view.py` passed. The focused checks deliberately
do not cover Go, contracts, packaging or produce a clean-gate receipt.
