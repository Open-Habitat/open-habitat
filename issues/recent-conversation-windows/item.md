---
created: 2026-10-02
updated: 2026-10-02
type: task
status: done
priority: normal
provenance: other
source_ref: taskfleet:01m3x4p1t2nr61qyw6cz2cwrcm/implementation-slice:windows
originating_run: 01m3x4p1t2nr61qyw6cz2cwrcm
originating_run_kind: technical-decision
lane: client-history
lane_seq: 30
blocked_by: ['@tail-first-history-paging']
closed: 2026-10-02
closed_by: taskfleet
---

# Keep bounded recent conversation windows in browser

## Goal

Return to a recently viewed conversation immediately for both read-only and browser-controlled histories. Implement the two-map external store and window reconciliation in the [data-flow design](../../docs/conversation-data-flow.md). **Implementation order (prose only):** blocked_by @tail-first-history-paging for final pager integration; @one-browser-event-stream is blocked by this store contract. Do not change metadata/lane/status yet.

## Scope and interface

Create `conversationStore.ts`: one store per `web_identity_id` per tab, metadata Map for catalog/header and window Map for opened content, stable `useSyncExternalStore` snapshots with separate subscriptions. Keep Redux in `store.ts` for app/session state. Move `useConversation.ts`'s entries/live/history reconciliation into pure logic; use `conversationEvents.ts` for validated deltas and @tail-first-history-paging's `HistoryPager` for cold open, older and recovery reads. Expose `applySnapshot`, `applyPage`, `applyEvent`, `markStale`, `view`, `dispose` and read/subscribe APIs to @one-browser-event-stream and `App.tsx`. No stream connection or history protocol work here.

Merge by native `entry_key`, replace the matching saved content and provisional agent tail on persisted assistant output. One contiguous window only: overlap joins after verifying order; no overlap replaces; a long break reads backward from newest up to a bound, then drops old range if no shared key. A missing boundary key leads to a tail reload. Keep stale content visible with explicit state, don't imply a completed answer from `turn.settled`. Placeholder eviction: about 50 least-recently-viewed whole windows, metadata retained, no byte/per-page release. Later tuning has its own unlaned issue.

Create a loading window on view, buffer page-racing events, and represent a confirmed missing native history as an empty window; clear unpersisted provisional text when the next turn begins. Keep the most recent controlled-conversation status in metadata and trigger its update on router notifications, not on route changes. Pi writes from a terminal produce no journal event and are out of scope here (@sync-terminal-pi-across-browsers); no visibility listener or background polling.

`BrowserConversation.tsx`, `HistoryView.tsx`, `WorkspaceRailView.tsx` and `useReadingPosition.ts` subscribe/render their own slice; remove conversation-ID `key` remount in `App.tsx`, explicitly reset/preserve local UI states per id. Keep `ConversationActions.tsx`'s pending/accepted/uncertain write outcomes and sessionStorage drafts separate. `@browser-logout-cleanup` calls `dispose` and fences late responses.

## Acceptance Criteria

- [x] Warm switch has zero HTTP requests and immediate first paint without remount; background deltas do not re-render sidebar.
- [x] Deterministic tests cover page/event races, confirmed missing history, append during scroll-back, read-only observation changes, saved/provisional replacement, gap/restart, identity change, 51st window and anchored scroll-back.
- [x] Cold open, eviction and far-back scroll can load and display a spinner; stale data never silently claims to be current.
- [x] Measure click-to-paint, requests and memory against the synthetic baseline and large outputs; TESTING.md checks pass.

## Comments

### 2026-10-02T06:01:26Z · @codex

Tiedonkulkusivun tekstikierrokselta toteutuksen testikonteksti: testaa myös saman natiiviavaimen päivittyminen, ristiriitainen järjestys ja rajaan osumaton sivu. Pitkän katkon rajattu taaksepäin haku joko löytää yhteisen avaimen tai korvaa vanhan jakson uudella taililla. Selainkokeessa säilyvät lukukohta ja komennon epävarman kuittauksen erillinen esitys. Vertailumittaus: issues/design-snappy-conversation-switching/measurements.md.

## Resolution

### 2026-10-02T09:07:51Z · @taskfleet

Implemented and verified browser windows for read-only and controlled histories; full clean gate passed on 01433ec and subsequent test-only/issue commits do not alter runtime behavior. Per-conversation EventSource replacement belongs to @one-browser-event-stream.

## Test server (pilot.17, 2026-10-02)

`0.0.0-pilot.17` (source `a3a3f127`) is installed on the test VM; operator and route checks passed. Jari: reload and try instant warm returns without spinner or request, long-history scroll-back and preserved reading position, then reload and logout. Real authenticated browser/GitHub/Pi use is still unverified; also retry pilot.16 browser fixes, Pi dialogs and large clone progress.
