# Result: basic context indicator, round 1

Prototype: [prototypes/context-basic/index.html](prototypes/context-basic/index.html)
(one offline file). Jari's notes: [prototypes/context-basic/NOTES.md](prototypes/context-basic/NOTES.md).
Source round: `design-system/prototypes/rounds/2026-10-25-kontekstin-mittari/`
(the library's app frame, top bar and composer).

## What the round compares

The axis is **form and place** of the always-visible indicator. Behaviour is
the same in every direction and follows Pi's own rules: attention colour
above 70 %, error colour above 90 % (Pi's footer thresholds), and
auto-compaction when fewer than `reserveTokens` (default 16 384) remain,
which is about 94 % of 272k and 98 % of 1M. While Pi compacts, the indicator
says so. Right after a compaction it shows "?" until Pi's next reply, because
Pi's `getContextUsage()` returns `null` there. Before the first reply it
shows nothing. With an unknown window it shows tokens without a
percentage. Each indicator is a button that opens the place where
`proto-context-detail` will live.

| Direction | Form and place |
| --- | --- |
| Rengas | Ring and percentage in the top bar, before the model chip; ring only on phone below 70 % |
| Sirussa | Percentage inside the model chip; the chip's background fills |
| Kentässä | Fill line on the composer's top edge and `92k / 272k` under it |
| Sanoin | Quiet text under the composer that becomes a sentence near the limit |

## Facts the indicator needs, and whether the host has them

Pi computes the number itself. `get_session_stats` returns `contextUsage
{tokens, contextWindow, percent}` from the last assistant `usage` after the
latest compaction, with `null` tokens right after one. The host should ask
Pi for it, not recompute it. Today the host has none of it:
`get_session_stats` is not in the daemon's RPC allow-list, `usage` is not
forwarded from history or the live stream, and `contextWindow` (in
`get_state`'s model and Pi's registry) does not reach the browser. Compaction
start and end already reach the browser as `pi.marker` with the reason, but
without `tokensBefore`. The threshold tick also needs `autoCompactionEnabled`
(from `get_state`) and `compaction.reserveTokens`, which lives in Pi's
settings and is not exposed over RPC. The tick is optional, and Sirussa does
without it. Claude models run through Pi here, so Pi's `usage` covers them.
Claude Code transcripts record `message.usage` but no window, and the host
does not read them.

Open for the implementation sketch: a conversation whose Pi is not running
(archived or closed). Either read the last post-compaction `usage` and the
model's window from the session file, or show no indicator.

## Recommendation: Rengas

The indicator answers a glance question ("how full is it?") many times per
session. A shape answers that faster than text, and the top bar is where the
model and thinking level already live, which together determine the window.
Rengas keeps that relationship without overloading the model chip.
Sirussa's chip already opens the model information, and merging context into
it would blur the two popovers that `proto-context-detail` must keep apart.
Rengas is also the only direction that stays legible on a phone without
taking a composer row: the ring alone below 70 %, the number from 70 % up.
Its separate button is a clean entry point for the detailed level. Its cost
is one more element in a crowded top bar. If Jari prefers the context to sit
where he writes, Sanoin is the second choice: it explains compaction in words
instead of making him infer it from a colour.

## Questions for Jari

- Which direction, and does the threshold tick earn its place (it needs Pi's
  reserve setting) or is the number enough?
- Should the indicator appear for a conversation whose Pi is not running?

## Verification

`verify.mjs` builds the page and checks 4 directions × 12 scenes × 1440/390 px
× light/dark (192 cases). It checks for no horizontal overflow, that the
popover takes and returns focus, that the replay goes through compaction and
back with announcements, that reduced motion stops the animations, the
picker contract, and that the page logs no console errors and makes no
network requests. Screenshots are in `prototypes/context-basic/evidence/`.
No production code changed.
