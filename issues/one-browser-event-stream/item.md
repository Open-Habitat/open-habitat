---
created: 2026-10-02
updated: 2026-10-02
type: task
status: untriaged
priority: normal
provenance: other
source_ref: taskfleet:01m3x4p1t2nr61qyw6cz2cwrcm/implementation-slice:journal
originating_run: 01m3x4p1t2nr61qyw6cz2cwrcm
originating_run_kind: technical-decision
---

# Unify browser journal stream per identity

## Goal

Keep one user-wide event connection per authenticated browser tab, independent
of the selected conversation. Route changes should neither reopen the stream
nor lose events for conversations running in the background. This is the
connection part of [ADR 0008](../../docs/adr-0008-snappy-conversation-switching.md).

## Approach

Bring the catalog connection in `App.tsx` and the conversation connection in
`useConversation.ts` under one owner. That owner tracks the daemon instance and
global event position; conversation views consume its updates. Events for
unopened conversations still advance the stream position without allocating
history windows for them. Each tab is independent; a cross-tab coordinator is
not needed for this work.

Continuous replay should recover missed updates. A gap or changed daemon
instance requires a fresh snapshot and reconciliation of retained views.
Loaded text stays readable during a break, with its stale/offline state
visible. Cached status is presentation data; the daemon remains responsible
for command admission and continuation checks.

An identity change or detected logout clears old content and ignores old
in-flight responses. Keep this distinct from operator revocation: Jari chose
to retain the existing revocation behavior, including already-admitted streams,
in @reliable-session-revocation. This task adds no gateway revocation mechanism.

## Acceptance criteria

- [ ] Conversation switches keep the same connection and background updates reach the correct retained conversation.
- [ ] Replay, event gaps and daemon restart recover without silently presenting incomplete content as current.
- [ ] Logout and identity-change tests show that old content and late responses cannot enter the new user's view.
- [ ] Synthetic tests cover independent tabs and stream request counts; validation follows TESTING.md.
