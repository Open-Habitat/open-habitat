---
created: 2026-11-07
updated: 2026-11-14
type: bug
status: open
priority: normal
provenance: other
provenance_detail: taskfleet worker finding from Kaisa's journal facts
source_ref: taskfleet:01m6tyjw70920ryv19hn8srmx9/title-helper-extension-providers
originating_run: 01m6tyjw70920ryv19hn8srmx9
originating_run_kind: spinoff
lane: titles
lane_seq: 1
preparation: ready
---

# Automatic titles fail for accounts whose only AI sign-in is an extension provider (Claude subscription bridge)

## Description

Observed on Birch, 7.11.2026 14:00:29 EET, in Kaisa's daemon journal: `conversation_title outcome=failed operation=automatic reason=model_unavailable` for a conversation whose own turn ran normally. Her conversations therefore keep the first-message fallback title.

Likely cause, from the code: the title helper (`internal/daemon/title-helper.mjs`) builds Pi's `ModelRuntime` without loading any extension, so providers that only an extension registers, such as pi-claude-bridge (the Claude subscription), are not in its model list. `background-model.mjs` says so ("the title helper does not load pi-claude-bridge") and falls back to another configured provider's middle tier; a person whose only working sign-in is the Claude subscription has none, so every automatic and every "Luo uusi otsikko" title fails with `model_unavailable`. Recaps run inside Pi with the bridge loaded and are not affected. Not verified against her settings (her home was not read); confirming needs only which providers her Pi has.

Impact: for such accounts automatic titles never work, and the person is told to check a sign-in that is in fact fine. `rename-fails-kaisa` made the manual-title text say that no model could be used and that naming by hand works, but the gap itself remains.

Options to weigh: let the title helper use the conversation's own provider through Pi with the bridge loaded (as recaps do), or generate titles inside the running Pi like recaps.
