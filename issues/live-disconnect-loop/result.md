# Result

## Live cause

The browser never saw the event stream open, so its 8 s watchdog
(`conversationJournal.ts`, added in c23cec8c on 2026-10-16 15:29) closed every
stream and the tab cycled through "Yhteys katkesi" forever.

Evidence, all read-only:

- Alder `journalctl -u cloudflared`, 03:09–03:21 UTC: `/api/v1/events` was
  "canceled by remote" in pairs 5 s apart (the EventSource at the 8 s
  watchdog, then the 5 s probe abort), with gaps growing 11, 14, 17, 20, 23,
  26, 29 s. That is exactly `8 s + 3000 ms × failures`. Since `failures` resets
  only in `onopen`, no attempt ever opened, and the probe `fetch` never got a
  response head within 5 s either.
- The guest daemon's socket sends `200` and its headers at once
  (`curl --unix-socket … /api/v1/events`), and the gateway flushes them. The
  first body bytes came only with the 20 s heartbeat.
- Route (Fleetrepo `OMEGA-ACCESS.md`): browser → Cloudflare Tunnel → cloudflared
  → SSH forward → gateway. On this route the head reaches the browser only
  together with body bytes, so an idle stream "opened" only at 20 s, after the
  watchdog had already fired.
- cloudflared's hourly event-stream failure counts rise from 2026-10-16 15h,
  when the watchdog shipped. The 2026-10-17 03h burst is Jari's report.

The 409 at 03:06:58 was the normal daemon-instance change after a release;
recovery from it worked (later streams carry the new instance's cursor). The
`pi/models` reads every 60 s are `PiModels.tsx`'s own refresh, not a loop. The
gateway restarts at 03:16, 03:17 and 03:19 are the release watcher deploying
new `main` commits.

## Fix

`internal/daemon/events_linux.go` writes an SSE comment (`: open`) right
after the header flush, so the first body bytes, and with them the head, go
out at once. EventSource ignores comments; the contract is unchanged.

## Tests

- `web/tests/reconnect-recovery.spec.ts` "@reconnect an idle stream opens
  before the watchdog behind an edge that holds the response head". The new
  lab fixture `/fixture/edge-hold-head` (`test/browser-host/main.go`) holds
  the event stream's status and headers until the first body byte, as the live
  edge does. Before the fix the stream never opened (failed). After it, the
  stream opens and stays open past the watchdog (passes).
- `TestEventStreamOpensBeforeFirstHeartbeat` now requires body bytes, not just
  headers; the two replay tests skip the open comment.
- A lab run of `/fixture/daemon-restart`, `/fixture/upgrade` and
  `/fixture/gateway-restart` without the held head stayed connected even
  before the fix. The lab could not show the bug until the edge's behaviour was
  modelled.

## Decisions for later review

- The fix sends the bytes the edge needs rather than lengthening the browser
  watchdog. The watchdog still catches a proxy that never answers.
- `lab-conversation` "combined stream reconciles a forced gap" is a known
  intermittent. It asserts `streamReads === 1` while recovery may already have
  legitimately reopened at an equal cursor. Over a few runs it failed 1/4
  without this change and 3/4 with it, probably because the stream now opens
  sooner. The test's race is worth fixing separately.
