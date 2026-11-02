---
created: 2026-11-02
updated: 2026-11-02
type: bug
reporter: claude
status: cannot-reproduce
priority: normal
provenance: other
provenance_detail: gate r54b failure, investigated in gate-load-flakes-waiting-search
source_ref: taskfleet:01m6dz07qv6skkqyr2csfgx9p1/gate-r54b:next-waiting-row-266
originating_run: 01m6dz07qv6skkqyr2csfgx9p1
originating_run_kind: spinoff
closed: 2026-11-02
---

# Open conversation can keep a finished turn's working status: Stop stays (next-waiting-row :266)

## Description

Seen once in the second clean gate on main `dbe63514` (2.11., Birch, log
`~/.local/state/oh-conductor/gate-r54b/stdout.json`, failure 1):
`next-waiting-row.spec.ts:266` waited 30 s for `composer-stop` to go after
the fixture released the held turn, and the Stop button stayed.

The error context shows the page held a status from *before* the released
turns ended, while the turns themselves had reached the page:

- the transcript has "own turn" answered and the steered "queued" delivered
  and answered ("Selvä. Kysyit: "queued"."), which arrives through the
  store's `history.entry` events;
- yet the composer still lists "queued" under "Odottaa agenttia ·
  seuraavassa välivaiheessa", and the header and the rail say
  "Työskentelee". Both read `metadata.statuses`, and that queue
  comes only from a status read, so no status read was applied after the
  fake Pi popped the steer (it emits `queue_update` with an empty queue
  then, and `agent_settled` after the turn).

So events reached the page while `useConversation.refresh` applied no status.
`refresh` is serialized by `pending.current`: if one of its awaits
(`status()`, `sendReceipt()`, `store.reconnect()`) never settles, every
later refresh is only queued, and the view keeps its last status until a
reload. None of these reads has a deadline. The open view then shows a
working conversation that has finished, which a person would see as a stuck
Stop button.

Not reproduced: 0 failures at line 266 in 30 heavy-load runs of the case,
18 at mild load, 32 runs of the whole spec file at heavy load, 12 with
status replies delayed 0–1.5 s after fetching (reordered), and 12 with the
page CPU-throttled 8×. Ruled out: a fake-Pi line interleave (`emit` is
locked), cross-case scenario writes (one host per case), Playwright leaving a
request unrouted (it continues requests that arrive after `unrouteAll`), and a
`generation` bump discarding a read (only open, start and archive bump it).
Not ruled out: a status, receipt or history read that never settles, and
the daemon status itself staying "working". The synthetic host serves
HTTP/1.1 only (`httptest` `StartTLS`), with Chrome's six connections per host;
the probe saw six requests in flight at peak, but none long-lived.

What would settle it: a trace of a failing run (the conductor keeps only
`error-context.md`), or a probe that records, at the failure, the page's
in-flight requests and one direct `GET …/status` result.

## Resolution

### 2026-11-02T15:09:51Z · @claude

A mechanism that fits this is fixed in race-status-merge (the status stays cannot-reproduce, Jari 2.11.): the view's refresh applied every status read unconditionally, so a read taken before the turn ended could land after a newer one (for example the store's own read on command.changed) and leave Stop up with no later event to correct it. Status replies now carry the journal position read under c.mu, and the store drops an older one; pinned in conversationStore.test.tsx ('status reads that come back in either order'). The browser case itself was never reproduced.
