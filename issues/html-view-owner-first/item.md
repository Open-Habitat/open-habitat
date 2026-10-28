---
created: 2026-10-25
updated: 2026-10-28
type: feature
reporter: jari
status: done
priority: normal
closed: 2026-10-25
lane: html-views
lane_seq: 2
collision: [web/src/app/, contracts/v1/, internal/gateway/, docs/]
preparation: ready
---

# Show an agent's HTML view to its owner: offer card, side panel and own tab

## Description

The first implementation of Jari's accepted direction in `agent-html-artifacts`
(research option C, prototype round 2 "Suora"): an agent in a person's account
offers an HTML file or a small multi-file static prototype, and the person sees
an offer card with two buttons, *Avaa* (right-hand panel beside the
conversation, header like the editor panel's `EditorHeader`) and *Avaa omalle
välilehdelle* (own browser tab). No remembered choice or setting. The content
is served on its own isolated origin, never on the app's or the editor's.

Owner only. Not in this issue: sharing with named people or public links,
live dev-server previews, clipboard and file-open offers. The prototypes in
`issues/agent-html-artifacts/prototypes/viewer*/` are the UI specification.

## Acceptance Criteria

- [x] ADR recording option C's authority split and the shape the prototype
  fixed (written under `agent-html-artifacts`, which closes with it).
- [x] An own-UID agent command offers a workspace file or directory entry as a
  frozen view; the offer reaches the person's open browsers as a card in the
  conversation (or an account-level place when no conversation is known).
- [x] Both buttons work; the content runs sandboxed on a per-view origin with
  the response CSP that also protects a direct open; app and editor cookies
  never reach it.
- [x] Without a configured view origin the feature is not offered (as with the
  editor), so existing installations keep working.
- [x] Focused Go, contract and browser checks; a live check line in
  `KOKEILTAVAA.md` for the test server once the origin is configured there.

