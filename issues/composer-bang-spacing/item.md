---
created: 2026-10-21
updated: 2026-10-21
type: improvement
reporter: jari
status: done
priority: normal
lane: composer
lane_seq: 1
collision: [web/composer]
preparation: ready
size: S
blocked_by: ['@warm-return-commands-read']
closed: 2026-10-21
---

# Composer: visual space after ! / !! and a clearer focus ring

## Description

Jari 2026-10-21 on the test server: '!git status' and '!!ls' work well. Two refinements: (1) when the person types ! or !!, the composer shows a synthetic visual space between the prefix and the command (presentation only; the submitted text and the native command must not change, and caret/selection/backspace behave naturally); (2) the composer field's focus/active border colour change is too subtle; make it clearly more visible ('hitusen räikeämpi') in both themes, with design-system tokens and sufficient contrast.

## Acceptance Criteria

- [x] Visual spacing after `!` / `!!` leaves native text and editing unchanged.
- [x] Clearly visible, contrast-checked focus border in both themes via tokens.
- [x] Production Storybook states and synthetic desktop/390 px evidence.
- [x] Fast web and affected composer browser checks pass after rebasing.
- [x] Finnish try-out entry and focused self-review recorded.

## Result

[Implementation choice, checks, visual evidence and recovered failures](result.md).
