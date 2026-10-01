# Comparison first

Paired synthetic-lab screenshots and offline HTML are in [`pairs/`](pairs/). Match files by state/theme/width: `*-draft.avif` is the designer's frame; `*-lab.avif` and `*-lab.html` are the host-backed synthetic implementation. See especially `read-only-light-1440-*`, `completed-light-1440-*`, `new-light-1440-*` and `disconnected-dark-390-*`. These are not live-host evidence.

**Working frame is blocked:** the test-only fake Pi's slow mode finishes before the comparison journey can enqueue two items and capture a stable running turn. `conversations-reset` does not remove generated JSONL sessions; the lab sidebar can show previous fake runs. A deterministic fixture change in `test/browser-host/` is requested in `item.md` and cannot be made by this worker. `working-*` pairs from this attempt are not representative and must not be accepted. The draft's tool-command metadata is not projected by the native history contract; no fabricated command, duration or exit status is shown.

## Scope and checks

Changed production presentation in `web/src/components/{Conversation,Navigation}.tsx`, `components.css`, and `web/src/app/{BrowserConversation,HistoryView}.tsx`. No changes to `internal/`, `contracts/`, or `test/browser-host/`. Preserve the native session binding, command IDs, uncertain-send no-retry behavior, queue order, and continuation eligibility. Queue rows and full-title disclosure now have direct component/browser assertions. The read-only footer links to the workspace's existing new-conversation entry rather than resuming native history.

Browser evidence uses the standalone synthetic host on `NAH_PORT_BASE=21000`; it does not prove separate Linux UID isolation or real Pi/provider behavior. Visual captures use `NAH_PORT_BASE=21000 ./scripts/lab.sh start` and `PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node web/lab/compare-v2.mjs --without-working` after a fresh lab start.

The focused independent final-diff review (Claude Fable 5.1 finder, GPT-6 Astra verifier) found six defects in the first pass and three more on the final pass; all nine were repaired. One further final-pass claim was refuted against the render predicate. Source inspection does not substitute for browser testing. Local assessment is in ignored `history/assessment-restore-v2-conversation.{json,md}`; no review residual is independently issue-worthy.

**Capture limitation:** the latest 28 supported pairs cover light/dark desktop
and phone, but the disconnected lab route is empty rather than holding the
illustrated prior conversation. Together with the missing two-item working
capture, these are not frame-by-frame evidence for the required states. The
visual comparison remains incomplete; this worker will not merge it as done.

## Final verification and handoff

The committed implementation at `d6f3088` passed
`NAH_PORT_BASE=21000 ./scripts/ci-local.sh --clean --json` (including 109
browser-host and 12 lab Playwright tests). `issuectl doctor --json` and
`git diff --check` also passed. The earlier clean-gate attempts failed first
because the comparison lab occupied port 21001 and then because three older lab
assertions described controls removed by this presentation change; the lab
assertions were updated to check the same user-facing behavior and all 12
passed. No production fixture/contract files were changed.

This issue remains **in progress, not merge-ready**. The required two-item
working frame and hydrated disconnected/uncertain-send frame have not been
compared against the drafts. The synthetic fixture limitations and native
history metadata gap remain recorded in `item.md` for follow-up. A green gate
does not supply missing visual evidence.
