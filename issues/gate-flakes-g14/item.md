---
created: 2026-11-11
updated: 2026-11-11
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: conductor gate run
source_ref: gate:g14:ea674a66b
lane: gate-load-flakes
lane_seq: 6
preparation: ready
closed: 2026-11-11
---

# Load-sensitive gate failures on ea674a66b and 32cd76a0a (sign-in composer, github-session cleanup, sign-in beside first pass, terminal selection)

## Description

Clean gate on `ea674a66b` (Birch, 11.11.2026 ~10.25, gate's own load ~14,
no other workers) failed in three places that all pass alone on the same tree
(specs ×3, Go test -count=3):

1. `web/tests/ai-sign-in-window.spec.ts:61` line 122: after the Claude sign-in
   repair the composer still holds "Kirjaa tunnit. Kiitos!" (expected empty);
   the call log shows `data-working` flipping true→false while the value stays.
2. `web/tests/github-session.spec.ts:6`: test timeout in the `finally` cleanup
   `page.request.get("/fixture/pi-state?value=missing")` (line 74).
3. `internal/daemon/integrations` `TestSignInWithoutFilesRunsBesideFirstPass`
   (`progress_linux_test.go:352`): "removal beside the pass" got 503
   `native_unavailable`.

The previous two gates on the same product tree failed instead in
`workspace-editor.spec.ts:317` (`race-tooltip-escape-under-load`). Raw output:
`~/.local/state/oh-gate/g14.json` on Birch. Each needs reproducing under the
ordering detector / CPU throttle and a cause fix, not a timeout.

## Recurrence on 32cd76a0a (pilot.28 release gate 1)

Clean gate on `32cd76a0a` (Birch, 11.11.2026 ~10.45, gate's own load 8–13,
no other workers) failed in two browser specs, both passing alone on the same
tree:

- `web/tests/ai-sign-in-window.spec.ts:61` line 122 again (item 1 above):
  composer keeps "Kirjaa tunnit. Kiitos!" after the repair. Alone ×3: pass.
- `web/tests/browser-shell.spec.ts:241` line 297 (new): after the Shift
  selection in the terminal, `.xterm-selection div` never appears within 5 s.
  Alone: failed 1 of 3, then passed 10 of 10.

Raw output: `~/.local/state/oh-gate/pilot28-g1.json` on Birch.
- Gate 2 on the same tree (~11.05) failed only in
  `web/tests/pi-onboarding-slow.spec.ts:7` line 51: the `pi-code-copy` button
  never appears within 18 s. Alone ×5: pass. Raw output:
  `~/.local/state/oh-gate/pilot28-g2.json`.
- Gate 3 on the same tree (~11.18) failed only in
  `web/tests/ai-sign-in-window.spec.ts:61` line 122 again (third gate in four
  today, the same composer value). Alone ×5: pass. Raw output:
  `~/.local/state/oh-gate/pilot28-g3.json`.
- Gate 4 on the same tree (~11.20) failed only in the lab suite,
  `web/tests/lab-slow-creation.spec.ts:4` ("home +" case) line 51:
  `reply.json()` raised "Response body is not available for a response that
  was navigated away from" (the test reads the body after the click navigated).
  Alone ×5 (all three cases): pass. Raw output:
  `~/.local/state/oh-gate/pilot28-g4.json`.

Four clean gates on `32cd76a0a` each failed in one different load-sensitive
spec, so pilot.28 could not get a receipt; with about one flake per gate the
gate cannot pass on Birch until these are fixed.
