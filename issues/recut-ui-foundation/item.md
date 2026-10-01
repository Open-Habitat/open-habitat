---
created: 2026-09-30
updated: 2026-09-30
type: task
reporter: jari
status: done
priority: high
related: ['@review-browser-design-v2', '@complete-conversation-ui']
lane: design-v2
lane_seq: 1
collision: [design-system/, web/src/components/, web/src/components/Conversation.tsx, web/src/app/App.tsx]
closed: 2026-09-30
closed_by: night-ui-worker
---

# Re-cut the UI foundation for browser design v2

## Goal

Re-cut the shared UI foundation so that browser design v2 can be implemented
faithfully and tuned predictably, and prove it in the conversation view.

## Scope

- Tokens re-cut from the v2 sizing and typography table (font sizes, spacing,
  radii, rail/column widths, focus ring); update the sentence in
  `design-system/production-v1.md` that treats draft sizes as references only,
  citing the provisional decision.
- Layout templates in the component library: top bar, scrolling message
  stream, composer, sidebar frame. Remove the app-layer inline `60vh` and
  similar ancestor-dependent layout.
- Button, status-mark and icon primitives: one button presentation that does
  not depend on ancestor selectors, a readable disabled state in both themes
  (`--ah-line` background, `--ah-muted` text, reason beside it), one status
  vocabulary (working, read-only, ✓, ✕, ?, pill) and a small SVG icon set.
- One styling mechanism for the touched components; clean overrides such as
  the reading-view message override as they are met. Update tests, the lab
  snapshot and `App.tsx` focus return that use `.ah-*` selectors.
- Before implementation, write `component-map.md` in this issue folder (the
  handoff's "first task": draft element → component, new components, state
  mapping, deviations). Jari reviews it in the morning; proceed with it tonight.

## Acceptance Criteria

- [x] In the conversation view, font sizes, spacing and layout dimensions come
  from shared values, and changing one value shows in every place it is used.
- [x] Button appearance does not depend on an ancestor selector, and a disabled
  button is readable in both themes.
- [x] The status vocabulary comes from one component.
- [x] Icons do not depend on the system font.
- [x] Top bar, message stream and composer layout is part of the component
  library, not application-layer inline style, and works at phone width.
- [x] New and changed components have stories in both themes.
- [x] A browser test in the gate reads computed styles of landmark elements in
  the lab (rail widths, top-bar padding, column width, text sizes, radii, focus
  ring) and compares them with the handoff table.
- [x] `component-map.md` exists and lists deviations that were not resolved.
## Shared context for every design-v2 slice

- Benchmark: [handoff](../../design-system/drafts/v2/handoff.md) and the
  drafts in `../../design-system/drafts/v2/vedokset/`; the
  [assessment](../review-browser-design-v2/assessment.md) explains the gaps
  and the [first reading](../review-browser-design-v2/first-read.md) the
  known behavioural differences.
- Provisional decisions for the night of 2026-09-30 (recorded on
  @review-browser-design-v2; Jari may overturn them): phone width is in scope,
  and the v2 sizing table is the source of the shared values.
- Agreed repository-chooser default: all repositories visible, time filtering
  is the user's choice (not the handoff's monthly default).
- Keep existing state handling, polling, session binding, drafts, reading
  position and uncertain-send honesty. Where the draft contradicts
  `docs/ui.md`, `docs/interfaces.md`, `design-system/production-v1.md` or the
  state machine, do not resolve it silently: record the deviation in this
  issue and follow the existing agreement.
- Only existing `--ah-*` colour tokens. Icons must not depend on the system
  font. Every new or changed component has a story in both themes.
- Evidence comes from the synthetic lab (`web/AGENTS.md`), never a real
  server. Redact anything personal from screenshots kept in the issue folder.
- Ownership tonight: this work may change `web/`, `design-system/`,
  `docs/ui.md` and `docs/design-system.md`. A needed change in `internal/`,
  `contracts/` or other docs is recorded in this issue as a request instead.
