---
created: 2026-10-21
updated: 2026-10-21
type: improvement
reporter: jari
status: open
priority: normal
lane: composer
lane_seq: 1
collision: [web/composer]
preparation: ready
size: S
blocked_by: ['@warm-return-commands-read']
---

# Composer: visual space after ! / !! and a clearer focus ring

## Description

Jari 2026-10-21 on the test server: '!git status' and '!!ls' work well. Two refinements: (1) when the person types ! or !!, the composer shows a synthetic visual space between the prefix and the command (presentation only; the submitted text and the native command must not change, and caret/selection/backspace behave naturally); (2) the composer field's focus/active border colour change is too subtle; make it clearly more visible ('hitusen räikeämpi') in both themes, with design-system tokens and sufficient contrast.
