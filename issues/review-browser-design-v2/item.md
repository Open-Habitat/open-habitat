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

The [first reading](first-read.md) records the intended experience, decision
sources and unresolved differences. Continue in the order Jari chose in
@rethink-project-docs: account isolation, deprovisioning, onboarding, account
settings and shared UI documents, then return here for the component/state map
and implementation slices. This prevents the prototype's assumptions from
becoming requirements before their product meaning is settled.

The map connects the sketches to current production components, tokens and
host states, including keyboard/focus behavior and missing views. It should
make the remaining work understandable enough to assign without overlapping
agent-control, onboarding or account-settings work. Important differences
include unresolved checkout outcomes, preserved drafts and reading position,
identity display sources, OpenAI settings and mobile scope. The first reading
has the sources and recommendations; prototype approval labels alone do not
resolve them. Real user decisions and native state determine the behavior.

## Acceptance Criteria
- [ ] Component/state map and conflict list tied to current source and accepted decisions; note which sketches are missing and what decision would change an outcome Jari cares about.
- [ ] Recommend ordered, independently implementable visual slices with explicit hot-file/collision boundaries; do not conflate design review with visual acceptance or issue completion.
- [ ] Record Jari's decision on material design disagreements before scheduling implementation. Do not publish the prototypes or live data as a shareable link without review.
