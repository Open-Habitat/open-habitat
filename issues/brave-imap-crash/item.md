---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: cannot-reproduce
priority: high
lane: integrations-ui
lane_seq: 1
collision: [integrations-ui]
closed: 2026-10-20
---

# Brave crashes while typing an email address in the IMAP integration form

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20 (pilot.247, Brave on macOS): Asetukset › Integraatiot › Sähköposti (IMAP) › Yhdistä…; typing maintainer@example.org crashes the whole browser right after the characters j, a, r regardless of typing speed. Likely a per-keystroke behaviour in the form (provider auto-discovery request, datalist/autocomplete suggestions, a heavy regex or re-render loop, or an input attribute Brave's autofill mishandles). Reproduce in Chromium-based browsers (Brave if available, else Chromium with the same inputs), find the trigger and fix it; even if the root cause is a Brave bug, avoid the trigger. Done: typing an address works, regression test on the trigger.
