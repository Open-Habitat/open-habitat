---
created: 2026-11-14
updated: 2026-11-14
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: observed while verifying gate-load-flakes-bundle
source_ref: taskfleet:01m7cwhrde7wwwthz6aab2hrfs/main-failure:browser-conversation-three
originating_run: 01m7cwhrde7wwwthz6aab2hrfs
originating_run_kind: spinoff
---

# Three browser-conversation cases fail on main: rail mark and uncertain-send notice not found

## Description

## Observed failure

Three `@browser-conversation` cases in `web/tests/browser-conversation.spec.ts`
fail deterministically on current `main` (a50a74fd) on an idle host, run alone
with the focused runner (`OH_BROWSER_WORKERS=2`, default 0–60 ms reply jitter):

- `new controller stays calm and shares settled state with navigation`:
  `.ah-agent-item` last row has no `.ah-nav-mark` (line 103).
- `a lost accepted send resolves on reload without another write`:
  `send-uncertain` never appears after the send whose status reads are routed
  away (line 2742).
- `lost accepted reply recovers on HTTP snapshot without an event`:
  `send-uncertain` never appears with `data-state="failed"` (line 2963).

Reproduce from the repository root:

    umask 077; OH_BROWSER_WORKERS=2 OH_PORT_BASE=<free base> \
      ./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts \
      --tag "new controller stays calm|lost accepted send resolves on reload|lost accepted reply recovers on HTTP"

3/3 failed in each of three runs (twice on a branch, once on a clean `main`
checkout). Not investigated further: whether the rail mark and the uncertain-send
notice moved (product change) or the specs are stale.
