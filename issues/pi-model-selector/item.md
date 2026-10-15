---
created: 2026-10-15
updated: 2026-10-15
type: feature
reporter: jari
status: done
priority: high
related: ['@conversation-stuck-reauth']
lane: reauth
collision: [internal/daemon]
closed: 2026-10-15
closed_by: claude
---

# Choose Pi's model in the browser

Jari, 2026-10-15: Pi's selected model `openai-codex/gpt-5.5` is not available on his ChatGPT account, so Pi stopped answering (`issues/conversation-stuck-reauth/result.md`). Jari accepted the conductor's recommendation: let the person choose Pi's model in the browser.

The model is Pi's own native setting in the user's home. The daemon, running as the user, lists the models Pi reports as available for the signed-in provider, and changes Pi's default the same way the user would in a terminal (Pi's own settings or command, not a parallel store). Where it appears:
- in the conversation's model chip and details (`design-system/design.md`, Keskustelu; the chip opens the details);
- in the unsupported-model notice, as its action ("Valitse toinen malli");
- in account settings, as the default for new conversations.

Whether a running conversation can switch model depends on Pi. If it cannot, say so and offer a new conversation.

## Acceptance Criteria
- [x] The person can see the available models and choose the default for new conversations. Pi's native setting changes as the user (Go test with a disposable HOME and a Pi fixture).
- [x] The unsupported-model notice offers the choice, and a new conversation with the chosen model works (browser journey with a fixture).
- [x] No new store: the truth is Pi's own setting, read back.
- [x] result.md has a "Decisions for later review" section.
