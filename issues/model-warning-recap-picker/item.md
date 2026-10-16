---
created: 2026-10-16
updated: 2026-10-16
type: bug
reporter: jari
status: open
priority: high
lane: web
lane_seq: 1
collision: [web/src/app/, web/src/components/]
preparation: ready
---

# Recap hides model warning and closes popover; model cannot be chosen from the warning

Jari on the test server, 2026-10-16 morning (pilot.123). The screenshot is in this directory (`unsupported-model.png`). A new Pi conversation using `gpt-5.5` showed the notice "Valittu kielimalli ei ole käytettävissä" with a "Valitse toinen malli" button. Then:

1. When the conversation's Tilannekatsaus (recap card above the composer) arrived, it **hid the warning notice**. The notice must remain visible: a recap must never displace an error the person still has to act on.
2. When the recap arrived, it **closed the open model popover** (the pop-up that opens from the model name in the conversation header). New content arriving must never close a popover or dialog the person has open.
3. Clicking **"Valitse toinen malli"** opens the model modal, but **a model cannot be selected in it**.

Expected: the warning stays visible until resolved, recap arrival does not close open popovers, and the button leads to a working model choice. That choice changes the native default for new conversations, as the notice text says; this conversation does not switch model.

Context: why gpt-5.5 is rejected (OpenAI's Codex route refuses it for this ChatGPT account, and Codex CLI 0.156.1 gets the same refusal) is a separate matter, covered by `model-discovery`.

## Acceptance Criteria
- [ ] Recap arrival keeps the unsupported-model notice (and other actionable notices) visible; covered by a browser test.
- [ ] Recap arrival, or other live updates, do not close an open model popover; covered by a browser test.
- [ ] "Valitse toinen malli" opens a modal where a model can be chosen and saved; covered by a browser test.
- [ ] Lab screenshots before and after in this issue directory.
