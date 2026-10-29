---
created: 2026-10-29
updated: 2026-10-29
type: bug
status: open
priority: normal
provenance: other
provenance_detail: agent test run
source_ref: taskfleet:01m63y2324hs9yb1p9ym2btx17/spec-failure:browser-conversation-openai-unknown
originating_run: 01m63y2324hs9yb1p9ym2btx17
originating_run_kind: spinoff
lane: gate-health
preparation: ready
lane_seq: 150
---

# browser-conversation spec: OpenAI credential row stays unknown in settings (fails on main)

## Description

`web/tests/browser-conversation.spec.ts:963` ("settings does not recheck the Pi gate; returning and foreground clicks do not revalidate") fails on main at ba2a660e. It fails both in this worktree and in a clean detached worktree of that commit, on Birch, with `--tag "settings does not recheck the Pi gate"`.

Symptom: at line 983, `openai-credential-state` has `data-state="unknown"`, while the test expects `signed_in|api_key|missing`. Either the OpenAI row in Asetukset › Tekoäly no longer resolves its native credential state in the synthetic browser host before the 5 s timeout, or `unknown` has become a legitimate state the test does not allow.

The other 73 tests in the spec pass. Found while running touched specs for `experimental-features-section`, which does not touch the Tekoäly section.
