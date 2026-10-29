---
created: 2026-10-29
updated: 2026-10-29
type: task
reporter: jari
status: open
priority: normal
lane: view-sharing
lane_seq: 1
preparation: ready
---

# Decide: anyone with the link can open a shared view

_Source: chat_

## Description

Jari 29.10. (from `research-ville-feedback`, item 4): instead of sharing a view with named people on the same server, **anyone with the link should have access to the content** (Ville shares an interactive cash-flow page with Olli and others). This reverses the earlier "public links stay off" line and is an architecture decision about who may read a person's view.

Decide and record (ADR): the capability-link model (unguessable token, separate origin, no cookies, CSP/sandbox as views today), who can create and revoke a link, expiry, whether the link shows a frozen copy (as views are today) or follows updates, what leaves the person's home (a copy under a public-serving area vs the gateway serving from the person's daemon), abuse and size limits, operator switch per site, how the agent and the browser offer it, and the threat model (link leakage, indexing, phishing on the product's domain). Compare with ADR 0032 and `agent-html-artifacts` research in history (`scripts/from-history.sh`).

## Acceptance Criteria

- [ ] ADR with the recommended model and its authority split, recorded for Jari's approval; implementation issue proposed, not started.
