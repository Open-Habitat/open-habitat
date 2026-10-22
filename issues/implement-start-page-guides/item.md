---
created: 2026-10-22
updated: 2026-10-22
type: feature
reporter: jari
status: done
priority: normal
preparation: ready
lane: start-guide
lane_seq: 1
collision: [web/src/components/start-page]
closed: 2026-10-22
---

# Start page: goal titles open Opas guide pages; Aloita fills the draft

## Goal

Implement the start page chosen in `proto-start-page-presentation` round 2, direction **Opas**: all goal titles visible on the repository start page, each opening its own guide page (what you get, when to use it, steps, optional full request disclosure), and **Aloita** inserting the request into the editable draft without sending; earlier draft text is preserved.

Jari 2026-10-22 adjustments:
- Aloita visible early: at the top of the guide page next to the title (keep the one at the end too). The landing page keeps goal titles as navigation to the guide.
- After Aloita inserts the text, focus moves to the **end** of the composer, and the inserted text ends with **two newlines** so the person's own text starts a new paragraph.

Includes updating the `.agents/start-page.md` format and the `open-habitat-start-page` skill so each goal carries the guide content the page shows (no compatibility with the old format needed). Prototype, research and review link: `issues/proto-start-page-presentation/` (result.md), https://glasspad.example.test/p/s5272m6an7j6t3xbpyfypnnivu/.

The guide page's visual language is reused by the skill side panel (`implement-skill-invocation-panel`), so build it as a reusable component.

## Acceptance Criteria

- [x] Start page and guide pages work in production on desktop and 390 px, light and dark; returning keeps the draft; nothing is sent by Aloita.
- [x] Skill and file format updated; Storybook and relevant Playwright/a11y specs pass.
