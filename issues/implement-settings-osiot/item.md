---
created: 2026-10-16
updated: 2026-10-16
type: feature
reporter: jari
status: open
priority: high
lane: pi-runtime
lane_seq: 3
collision: [web/src/app/, web/src/components/, internal/daemon, contracts/v1]
blocked_by: ['@implement-model-choice']
preparation: ready
---

# Implement settings and administration (Osiot)

Implement the settings and server administration views that Jari accepted on 2026-10-16: direction **2, Osiot**, of prototype round `design-system/prototypes/rounds/2026-10-15-asetukset/`. The accepted prototype is the specification; read `issues/proto-settings-admin/result.md` and its Decisions.

Jari's additions:
- The theme icons from the account (Jari) menu are used in the settings view, at least as button prefixes.
- The OpenAI API key is shown as `sk-…abcd`.
- The credential switch for new conversations sits next to the default model, with the ChatGPT subscription as the default.

The API key itself is `provider-api-keys`, whose accepted architecture is `issues/provider-api-keys/architecture.md`. Implement that in the same unit or right after; the settings view must have a working key row either way. The model default row shares the picker built in `implement-model-choice`; reuse it, do not duplicate it.

## Acceptance Criteria
- [ ] The Osiot view (section list plus one section; on a phone, the list and the section are separate screens) matches the prototype in lab screenshots (desktop and phone, light and dark), with every deviation justified.
- [ ] Administration is its own group in the same list for administrators only, and a non-administrator never sees or reaches it (tested).
- [ ] Leaving actions (sign-out, detaching GitHub, removing the key) are confirmed as in the prototype.
- [ ] Browser tests for the section navigation, the key row and the administration authorization.
- [ ] Deployed, with live checks for Jari in KOKEILTAVAA.md.
