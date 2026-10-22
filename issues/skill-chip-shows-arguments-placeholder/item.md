---
created: 2026-10-22
updated: 2026-10-22
type: bug
reporter: jari
status: fixed
priority: normal
preparation: ready
lane: skill-chip
lane_seq: 1
collision: [web/src/components/conversation-message]
closed: 2026-10-22
---

# Skill chip shows 'Arguments: $ARGUMENTS' instead of the skill name and description

## Description

Jari 2026-10-22 on 1362b57f, after `implement-skill-invocation-panel`: invoking the worktree skill rendered the person's message as a chip reading only "Arguments: $ARGUMENTS ›" — no skill name, no description. Not good.

Find where the chip takes its name/description: it appears to take the first body line of the expanded skill instead of the skill's name and frontmatter `description`, and it shows an unexpanded `$ARGUMENTS` placeholder. Use the skill's own name and description (from the native record or the skill file's frontmatter), never template placeholders; the person's extra text goes below. Test with real installed skills of several shapes (worktree, start-page, a skill whose body begins with an "Arguments:" line, one without description).

## Acceptance Criteria

- [x] The worktree skill invocation shows its name and short description; no `$ARGUMENTS` or other placeholders appear anywhere.
- [x] Regression tests with several real skill shapes.
