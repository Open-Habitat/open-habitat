# Result

## Cause on the test server

The daemon journal for `maintainer` (pilot on release
`734afe17`, 2026-11-08 16:45–16:47 UTC) shows every
`GET /api/v1/agents/{id}/history` and `/recap` answered 503 after about
850 ms; no other route failed. The conversation's Pi session
(`2026-11-07T11-25-32-973Z_be649ddf-….jsonl`, 82.5 MB) has one record,
line 384, of 80,039,044 bytes: Jari's 18:41 message with twenty 3 MiB PNG
screenshots inlined as base64 (the combined attachment size test). Every
native reader bounded a single record at 64 MiB (`maxNativeLine`), so the
whole history was refused as unreadable, while `attachment-combined-size`
had just started admitting 100 MiB of attachments per message, base64
≈ 133 MiB in one record.

The lone *Tarkista keskustelun tila* during the working turn was the same
failure: its *Historiaa ei saada* notice sat at the top of the timeline,
scrolled out of view, and carried no description.

## Fix

- `maxNativeLine` is now `piFrameLimit` (base64 of `promptAttachmentLimit`
  plus 4 MiB), the same payload Pi echoes on its RPC frame, so any message the
  daemon admits stays readable by every reader (forward stream, tail window,
  tail proof). `TestLargestAdmittedMessageRecordStaysReadable` sends 100 MiB
  in one record, both as the newest record and with a reply after it.
- A failing history read shows a red banner above the composer with the
  reason and *Tarkista keskustelun tila*; pressing it shows *Tarkistetaan…*,
  then either the history (banner gone) or "Tarkistettu: historiaa ei
  vieläkään saada…". The timeline notice gets the same description. Browser
  spec: `failing history read says why and shows its check`.
- A refresh requested while another runs now settles when its queued rerun
  does (review finding), so the check result is not reported early.

The test-server conversation loads again once the release with this commit
is installed. Nothing on the server was changed.

## Measured cost

One history page over Jari's 80 MB record takes about 0.9 s and allocates
about 480 MiB in the daemon, because encoding/json parses the whole record.
That is usable; skipping the image payload while decoding would make it
cheap if it becomes a problem.

## Review

Independent `/llm-review` (gpt-6-astra finder) + `/assess-findings`: no Go
defect; two browser state findings (early "checked" result, stale result
after recovery), both fixed.

## Decisions for later review

- **Raise the read bound rather than lower the send limit.** Alternative:
  cap a message at 64 MiB of base64 (≈ 48 MiB of attachments). Chosen because
  Jari chose 100 MiB today and his existing conversation already holds an
  80 MB record; lowering the send limit would leave it unreadable.
- **Text tells the person to contact the administrator** when the read
  keeps failing, without naming internals. Alternative: suggest continuing in
  a new conversation; rejected because nothing is lost and the cause is on
  the server side.
- **Header details still offer the plain recheck button** (intentional
  manual check when *Tiedot* is open); it now also shows *Tarkistetaan…*.

## Not fixed here

`TestAgentCommandPathIsPerHomeAndInherited` fails on Birch on main too (host
runtime selector adds an `agent-bin` PATH entry); already filed as
`agent-path-test-misses-core-tools`.
