---
created: 2026-11-11
updated: 2026-11-11
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: conductor gate run
source_ref: gate:g14:ea674a66b
---

# Three load-sensitive gate failures on ea674a66b (sign-in composer, github-session cleanup, sign-in beside first pass)

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
