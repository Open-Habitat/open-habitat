---
created: 2026-10-29
updated: 2026-10-29
type: feature
reporter: jari
status: open
priority: normal
lane: view-sharing
lane_seq: 2
preparation: ready
---

# Shared view links: anyone with the link opens the view (ADR 0033)

_Source: chat_

## Description

Implement ADR 0033 (view capability links) with Jari's 29.10. change: anyone with the link opens the shared view; the person alone creates, extends, re-points and revokes links in the browser; the administrator can revoke any link; the agent gets no link operation; the content is read from the owner's daemon (frozen export), not copied to a public area; operator switch per site, off by default. Jari dropped the anti-phishing measures: no mandatory script-free frame that blocks navigation and no separate-domain recommendation; shared content runs like the person's own view on its view origin.

## Acceptance Criteria

- [ ] ADR 0033 updated to Jari's decision and marked accepted.
- [ ] Gateway link records, anonymous read through the owner's daemon, revocation and expiry; browser "Jaa linkillä" on the view card with expiry, copy, re-point and revoke; administrator list and revoke.
- [ ] Contract, gateway/daemon tests and browser specs; operations.md; KOKEILTAVAA line.
