---
created: 2026-10-21
updated: 2026-10-21
type: bug
reporter: jari
status: open
priority: normal
lane: conversation-title
lane_seq: 1
related: ['@title-regenerate-broken']
collision: [web/conversation-title]
preparation: ready
size: S
---

# Regenerating a conversation title still fails on the test server

## Description

Jari 2026-10-21 ~20:33 on the test server: tried to regenerate a conversation's title; the conversation shows 'Otsikkoa ei voitu luoda — Tarkista tila ennen uutta yritystä.' (web/src/app/BrowserConversation.tsx titleError). title-regenerate-broken (fixed 20.10., d3409c48) addressed regeneration for stopped conversations through native history; this failure happened after that fix, so either another path fails (e.g. a running or idle controlled conversation, provider/model selection for the title call, a daemon error) or the fix regressed. The generic message also hides the cause from the person. Find the actual failure: reproduce in the lab across conversation states, and read the test server's daemon/gateway logs for the request around 20:33 (Fleetrepo owns the route; see AGENTS-WORKFLOW.md and Fleetrepo's infra/open-habitat-test/ docs; never copy private workspace content into the repo). Fix the cause, and make the notice say what the person can do when the cause is known. Screenshot: /var/tmp/oh-shots/retitle-error.png on Alder.
