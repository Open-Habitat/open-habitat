---
created: 2026-11-28
updated: 2026-11-28
type: bug
reporter: jari
status: open
priority: high
provenance: chat
source_ref: chat:conductor-2711/eval-passwords
lane: unlaned
preparation: pending
---

# Server browser: agent eval can read password field values

## Description

Jari 28.11.2026: in the signed-in server browser, the agent must not be able
to read the values of password fields (`input[type=password]`, and fields the
person typed a password into) through `open-habitat agent browser eval` or
the other read verbs (`text`, `screenshot` already shows masked dots). The AI
must not see passwords the person typed when they took control to sign in.
Agreed next action: implementation.
