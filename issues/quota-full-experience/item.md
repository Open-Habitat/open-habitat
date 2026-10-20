---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: open
priority: high
lane: quota-ux
lane_seq: 1
collision: [quota-ux]
---

# Full storage quota shows as raw errors ('Historia on vanhentunut', 'Pi-tila message_error') with no cause

_Source: chat:quota-test-2026-10-20_

## Description

Live test 2026-10-20 12:31–12:36 UTC on the test server: Jari's quota was set to usage+50 MiB; the agent filled it with dd. Result in the browser: 'Historia on vanhentunut — näkyvää sisältöä voi lukea, mutta sen ajantasaisuutta ei voida vahvistaa', a 'Pi-tila message_error' card and 'Tarkista keskustelun tila'. Daemon log: GET /api/v1/agents/{id}/history 503 repeatedly from 12:33:08Z, GET /api/v1/pi/models 503, conversation_title failed model_unavailable — and no mention of quota or EDQUOT anywhere. The agent only learned of it from dd's error and said no warning reached it.
Fix: the daemon recognises EDQUOT/ENOSPC from its own writes and from Pi (session append, auth lock, message persistence) and logs it as such; the browser shows one clear, recoverable state instead of raw states: 'Tallennustilasi on täynnä (599 / 599 Mt)' with ways out (Asetukset › Tallennustila, roskakori, ask the agent to clean up), and a proactive warning near the limit (e.g. 90 %). After space is freed, the conversation recovers without a reload or with one obvious action. Agent-facing notices are deferred to agent-cli. Done: a test with a tiny quota in a distinct-UID or synthetic setup where allowed, browser test of the full and recovered states; live re-check by Jari.

## Implementation result

Implementation is committed on the worker branch; [result and validation](result.md). Not landed: the required daemon suite fails in five terminal/tmux cases, reproduced unchanged on the base revision; the wider browser suite also has two model-picker regression failures. The quota browser journey, focused web checks and contract checks passed. Keep this issue open until required checks pass and the conductor can land/deploy it.
