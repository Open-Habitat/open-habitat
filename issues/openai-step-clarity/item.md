---
created: 2026-10-12
updated: 2026-10-12
type: bug
status: open
priority: normal
lane: signin-fix
lane_seq: 5
collision: [web/]
---

# OpenAI onboarding step flashes an error and buries its status

_Source: chat_

Jari, 2026-10-12, first sign-in on pilot.22 (open-habitat-test), onboarding step 3 (OpenAI). The sign-in itself succeeded (daemon `pi_device_start accepted` 11:20:27 UTC, Pi auth stored), but:

1. Clicking "Aloita kirjautuminen" briefly flashed a red error notice ("ei onnistu" or similar) in the step before the device-code view appeared. An in-flight start must not render as a failure; find which state renders the error during the normal transition and remove it from the happy path.
2. Near the end, the notice that the page updates automatically was buried in a large, cluttered amount of text, so it was easy to miss. On the happy path, the step should show only what the person needs right now (the code, the link, and that the page continues by itself), with secondary detail collapsed or removed.

Reproduce in the lab with the fake Pi device flow, capture each state on desktop and phone, and fix both.
