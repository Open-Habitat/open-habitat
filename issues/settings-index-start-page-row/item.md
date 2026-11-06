---
created: 2026-11-06
updated: 2026-11-06
type: bug
status: open
priority: normal
provenance: other
provenance_detail: worker browser check
source_ref: taskfleet:01m6s1qfqt2wykr2fb6gc29bj7/spec-failure:settings-search-parity
originating_run: 01m6s1qfqt2wykr2fb6gc29bj7
originating_run_kind: spinoff
lane: settings-index
lane_seq: 1
preparation: ready
---

# Settings index lacks the empty-conversation-start-page experiment row; settings-search parity spec fails

## Description

`web/tests/settings-search.spec.ts` › "every index row is on its section's page and every page row is in the index" fails on a tree whose only change in this area is unrelated (observed 2026-11-06 in the `live-conversation-limit-admin` worktree, base 6b406fb14):

```
- Array []
+ Array [
+   "empty-conversation-start-page",
+ ]
  > 72 |     expect(drawn.filter((id) => !ids.includes(id))).toEqual([]);
```

Settings › Kokeelliset draws a `data-settings-row="empty-conversation-start-page"` (the landed experiment card in `web/src/components/ExperimentalFeatures.tsx`), but `web/src/app/settingsIndex.ts` has no such row under `kokeelliset`, so settings search cannot find it and the index/page parity check fails. Fix: add the row to the index (with its English name in `web/src/text/settingsIndex.ts`) or stop drawing it as a settings row once landed.
