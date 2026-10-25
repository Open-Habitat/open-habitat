---
created: 2026-10-25
updated: 2026-10-25
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
collision: [web/src/components/Account.tsx]
preparation: ready
closed: 2026-10-25
---

# Signing in to OpenAI from settings closes settings instead of showing the result

## Description

Jari, 2026-10-25, Birch (account maintainer): in Settings → Yhteydet he
pressed the OpenAI (Pi) row's sign-in button and completed the OpenAI sign-in.
Afterwards settings closed and another page opened, probably the start page.
He expected to stay in settings and see that the sign-in succeeded.

Expected: after any provider sign-in started from settings (OpenAI, Claude,
and the same flow from onboarding or the model selector), the person returns
to where they started, with focus on the row whose state now shows the
result (success or a clear failure).

## Acceptance Criteria

- [x] Cause found and fixed for every entry point of the provider sign-in;
  browser regression test that the person returns to the starting view.

