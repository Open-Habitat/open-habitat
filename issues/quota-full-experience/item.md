---
created: 2026-10-20
updated: 2026-10-25
type: bug
reporter: jari
status: fixed
priority: high
lane: quota-ux
lane_seq: 1
collision: [quota-ux]
closed: 2026-10-20
---

# Full storage quota shows as raw errors ('Historia on vanhentunut', 'Pi-tila message_error') with no cause

_Source: chat:quota-test-2026-10-20_

## Description

Live test 2026-10-20 12:31–12:36 UTC on the test server: Jari's quota was set to usage+50 MiB; the agent filled it with dd. Result in the browser: 'Historia on vanhentunut — näkyvää sisältöä voi lukea, mutta sen ajantasaisuutta ei voida vahvistaa', a 'Pi-tila message_error' card and 'Tarkista keskustelun tila'. Daemon log: GET /api/v1/agents/{id}/history 503 repeatedly from 12:33:08Z, GET /api/v1/pi/models 503, conversation_title failed model_unavailable — and no mention of quota or EDQUOT anywhere. The agent only learned of it from dd's error and said no warning reached it.
Fix: the daemon recognises EDQUOT/ENOSPC from its own writes and from Pi (session append, auth lock, message persistence) and logs it as such; the browser shows one clear, recoverable state instead of raw states: 'Tallennustilasi on täynnä (599 / 599 Mt)' with ways out (Asetukset › Tallennustila, roskakori, ask the agent to clean up), and a proactive warning near the limit (e.g. 90 %). After space is freed, the conversation recovers without a reload or with one obvious action. Agent-facing notices are deferred to agent-cli. Done: a test with a tiny quota in a distinct-UID or synthetic setup where allowed, browser test of the full and recovered states; live re-check by Jari.

## Implementation result

Preserved quota work is integrated with current main; [result and validation](result.md). Web, complete daemon race suite, contracts and quota recovery/Axe journey pass. Conversation regression has one failure reproduced identically on unchanged main (@immoderately-sloppy-aunt), covered by the explicit baseline exception. Initial model-control regressions were filed as @unusually-acrid-debt; main subsequently fixed them. No push or deployment; conductor owns live recheck. Synthetic captures are deferred under Alder policy.

## Acceptance Criteria

- [x] Show proactive quota pressure, one full-storage explanation, cleanup actions and explicit recovery without message replay.
- [x] Classify daemon/native Pi storage errors as fixed redacted diagnostics; test a synthetic tiny write budget and recovery.
- [x] Focused web, daemon, contracts and quota-browser checks pass; unrelated conversation failure is independently reproduced unchanged and filed.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
