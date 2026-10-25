---
created: 2026-10-25
updated: 2026-10-25
type: improvement
reporter: jari
status: done
priority: normal
lane: unlaned
collision: [web/src/components/Account.tsx]
preparation: ready
closed: 2026-10-25
---

# Focus the signed-in provider's row; start page working dot matches the sidebar

## Description

Two small follow-ups from 2026-10-25's landings:

1. `pi-signin-leaves-settings` returns to Settings › Yhteydet but focuses the
   OpenAI row's button even when the person signed in to Claude. Focus the
   row of the provider actually signed in (conductor's recommendation, told
   to Jari without objection).
2. `background-wait-state` noted that the start page's "working" dot is an
   open blinking ring while the sidebar's is a filled pulsing dot. Make the
   working dot the same everywhere, using the shared status-dot styles.

## Acceptance Criteria

- [ ] Focus lands on the signed-in provider's row (browser test).
- [ ] One working-dot style across sidebar, start page and conversation.

