---
created: 2026-11-07
updated: 2026-11-14
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: taskfleet worker finding from daemon title failure
source_ref: taskfleet:01m6tyjw70920ryv19hn8srmx9/title-helper-extension-providers
originating_run: 01m6tyjw70920ryv19hn8srmx9
originating_run_kind: spinoff
lane: titles
lane_seq: 1
preparation: ready
closed: 2026-11-14
---

# Automatic titles fail for accounts whose only AI sign-in is an extension provider (Claude subscription bridge)

## Description

An account using only the Claude subscription bridge receives `conversation_title outcome=failed operation=automatic reason=model_unavailable` while ordinary conversation turns work. Conversations keep the first-message fallback title.

Likely cause, from the code: the title helper (`internal/daemon/title-helper.mjs`) builds Pi's `ModelRuntime` without loading any extension, so providers that only an extension registers, such as pi-claude-bridge (the Claude subscription), are not in its model list. `background-model.mjs` says so ("the title helper does not load pi-claude-bridge") and falls back to another configured provider's middle tier; a person whose only working sign-in is the Claude subscription has none, so every automatic and every "Luo uusi otsikko" title fails with `model_unavailable`. Recaps run inside Pi with the bridge loaded and are not affected. Reproduction requires a synthetic account with only an extension-provided model.

Impact: automatic and regenerated titles fail despite a working sign-in; naming by hand is the only workaround.

Options to weigh: let the title helper use the conversation's own provider through Pi with the bridge loaded (as recaps do), or generate titles inside the running Pi like recaps.

## Acceptance Criteria

- [x] Bridge-only accounts can generate a title through the pinned Pi runtime.
- [x] Native-provider titles still work when the installed bridge cannot answer.
- [x] Regression tests cover both known and unknown conversation models.

## Resolution

### 2026-11-14T07:41:21Z · @issuectl

Fixed shipped bridge registration for title generation; regression and validation are recorded in result.md. Live check: synthetic pinned-Pi integration passed; no live subscription check.
