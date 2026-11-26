---
created: 2026-11-26
updated: 2026-11-26
type: bug
status: untriaged
priority: high
provenance: other
provenance_detail: release driver gate
source_ref: taskfleet:01m8b78ckjycq9km1mxd7zcdkp/gate:f698d5366
originating_run: 01m8b78ckjycq9km1mxd7zcdkp
originating_run_kind: spinoff
---

# Gate red at f698d5366: dictation's warm AudioContext fails attention-sound spec; views_linux_test.go unformatted

## Description

The clean gate of `f698d5366` (the planned v0.1.9 source) is red for two deterministic reasons, so the release stopped before the cut.

1. `web/tests/attention-sound.spec.ts:253` "a non-open reply after preview" (all three variants: same-workspace, other-workspace, night-quiet) fails 3/3 when run alone:

   ```
   expect(received).toEqual(expected)
     Array [
       "running",
   +   "suspended",
     ]
   at web/tests/attention-sound.spec.ts:344
   ```

   It passes at `f452b86a8` and fails at `7650cd0d2` (`fix(dictation): listen visibly only once the microphone captures; ready audio ahead of the press`). Dictation now readies its own `AudioContext` when the composer gets focus (the spec's `fill("työ")`), and without a user gesture it stays `suspended`. The spec counts every `AudioContext` the page creates and expects exactly one running one (the attention sound's). Whether the spec should look only at the sound's context, or dictation should share or defer its context, is the decision to make; `c29b8b832` ("one warm audio graph per page") is the related follow-up.

   Rerun: `scripts/test-focused.sh --area browser --spec attention-sound.spec.ts --tag "a non-open reply after preview"`

2. `internal/gateway/views_linux_test.go` is not gofmt-formatted (the map literal in `newViewDesk`, since `f7c761b08`/`d93aa1844`, offered-html-file), so the gate's formatter changes the tree and the final check fails with "green gate changed the clean tree". `gofmt -w internal/gateway/views_linux_test.go` fixes it.

Load flakes in the same gate that passed when rerun alone: `internal/daemon` (10 min package timeout under load; 3/3 alone, ~255 s), `attachments.spec.ts` (2 tests), `browser-conversation.spec.ts:459`; intermittent alone: `browser-terminal.spec.ts:175` (1/3 pass, run outside tmux) and `loading-landing.spec.ts:249` (2/3).
