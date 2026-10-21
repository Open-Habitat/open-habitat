---
created: 2026-10-20
updated: 2026-10-21
type: bug
status: open
priority: normal
provenance: other
source_ref: taskfleet:01m5bwth0jx3g2bt67w44s5dqj/observed:terminal-tablist-aria
originating_run: 01m5bwth0jx3g2bt67w44s5dqj
originating_run_kind: spinoff
lane: terminal
lane_seq: 1
collision: [web/src/components/terminal]
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
