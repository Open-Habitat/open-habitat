---
created: 2026-10-22
updated: 2026-10-22
type: feature
reporter: jari
status: open
priority: normal
preparation: ready
lane: start-guide
lane_seq: 2
collision: [web/src/components/start-page]
---

# Skill invocation: Siru chip and side panel in the guide look

## Goal

Implement the skill invocation display chosen in `proto-skill-invocation-display`: the **Siru** chip in the person's message (skill name and short description only, the person's own extra text below it, no internal paths or raw expanded skill text, no HTML artefacts, correct caret), and the full skill text opening in a **side panel** (sivupaneeli) with Sulje/Takaisin and Esc. Long names and a missing description degrade gracefully; the draft survives opening and closing.

Jari 2026-10-22: the side panel shares the visual look of the start page's Opas guide page — reuse the guide component built in `implement-start-page-guides`.

Prototype and review: `issues/proto-skill-invocation-display/` (result.md), https://glasspad.example.test/p/i2emlicdsrv22qlnprknit2s2a/. Keep consistent with how native Pi records the invocation; the daemon must not invent a second record.

## Acceptance Criteria

- [ ] Production conversation shows the chip and side panel on desktop and phone, light and dark, at 1440/1366/390 px.
- [ ] Storybook and relevant Playwright/a11y specs pass.
