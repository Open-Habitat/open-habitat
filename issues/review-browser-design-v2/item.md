---
created: 2026-09-30
updated: 2026-09-30
type: task
reporter: jari
status: open
priority: high
related: ['@assemble-browser-redesign-handoff']
lane: design-review
collision: [design-system/, docs/, web/src/components/Conversation.tsx]
---

# Review browser design v2 delivery

## Goal
Review the external designer's **Selainpolku v2** delivery at the start of the next stint and turn it into a grounded, reviewable implementation plan. This is a review of received design, not approval of every proposed behavior or permission to copy prototype code.

## Input
Jari supplied `rowan:/Users/maintainer/Downloads/Selainpolku v2 suunnittelu.zip` (SHA-256 `4bb65eba40a4206eeddda6b3dff4c561c398e858eb844f1397c8a7499729f94f`), received on 2026-09-30. Extracted source is under this issue's `design/`: `handoff.md` and four HTML mockups plus `support.js`. The zip is not committed. The mockups load public CDN React/Babel and Google Fonts when opened; treat them as untrusted prototypes, not production assets or live app screens.

## Review
Read the handoff and inspect mockups against the **current** production components, design tokens, `docs/ui.md`, `docs/interfaces.md`, accepted issue decisions and latest landed agent-control/onboarding work. Produce the requested component map first, with state-to-code mapping, component ownership, a11y and conflicts; stage an implementation proposal before rewriting production UI. In particular, the mockup proposes hiding partial/uncertain checkout state, which must not disguise an ambiguous native write or cause an automatic retry. The handoff's statement that every line is Jari-approved is not itself an acceptance record; distinguish settled decisions from new proposals (verified name/avatar, OpenAI settings row, mobile settings, workspace view, copy/queue controls). Preserve identity and per-UID security boundaries, Pi native ownership, native history and no automatic resend.

## Acceptance Criteria
- [ ] Component/state map and conflict list tied to current source and accepted decisions; note which sketches are missing and what decision would change an outcome Jari cares about.
- [ ] Recommend ordered, independently implementable visual slices with explicit hot-file/collision boundaries; do not conflate design review with visual acceptance or issue completion.
- [ ] Record Jari's decision on material design disagreements before scheduling implementation. Do not publish the prototypes or live data as a shareable link without review.
