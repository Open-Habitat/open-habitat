---
created: 2026-10-13
updated: 2026-10-14
type: task
status: wontfix
priority: normal
closed: 2026-10-14
---

# Decide whether a second-writer guarantee for native conversations needs a writer protocol

`history-conversation-control` (landed 2026-10-13) lets the daemon decide
whether a native Pi writer holds a conversation by a census of the person's
own processes (`/proc`, same UID) before continue, archive and retitle. Its
worker recorded the limit: the census is a point-in-time observation, not a
lock. A Pi started from a terminal after the census can still become a
second writer while the browser continues the same conversation.

## Decision needed (Jari)

- Accept the documented best-effort observation for now (the worker's
  recommendation for pre-release), or
- decide on a shared native writer protocol that terminal Pi also takes part
  in (e.g. a lock or lease on the session file honoured by Pi itself), which
  is an architecture change involving Pi, not something a `/proc` scan can
  provide.

The details and test evidence are in `issues/history-conversation-control/result.md`.

## Resolution

### 2026-10-14T06:25:17Z · @issuectl

Accept the documented best-effort same-UID writer observation for pre-release. Reopen if concurrent writers cause observed harm to native session history or if a strict one-writer guarantee is adopted; that would require Pi and terminal writers to share a protocol.
