# Result

Implemented direction **2 Tunnin ketju** in the production composer, without an experimental switch. One dictation lasts up to an hour. The final minute shows a countdown and warning; quiet Web Audio cues sound at −60 seconds, −10 seconds and microphone shutdown. A persistent live region changes only at those thresholds. The end notice says the microphone is off and offers **Jatka sanelua** after the kept text.

Planned seams stop routing audio to the old socket, keep capturing into memory, drain the old final tokens, then open the next socket and submit each queued frame once. Late retired-socket replies cannot duplicate text. Stops during a handoff flush queued audio before returning the transcript, with bounded waits when the connection cannot recover. Cancellation retains its existing explicit discard meaning. A terminal network drop keeps the best available transcript, sounds the end cue and offers continuation.

## Verification

- `./scripts/test-focused.sh --area web`: 219 files / 1,721 tests passed, including 23 dictation-engine tests. Static, catalog and TypeScript checks passed.
- `speech-input.spec.ts`: all 14 host-backed synthetic cases passed, including scripted trailing tokens across a seam, the complete seven-session hour, warning transitions, exactly five scheduled tone notes, and final text in the composer.
- `lab-dictation-hour.spec.ts`: four cases passed: Finnish and English at 1440 and 390 pixels, three themes, reduced motion, composer axe checks, Explain card V38 and continuation after the limit.
- Both browser specs passed **three consecutive runs**, with two workers and a dedicated port range. The production constants remain unchanged in tests; Playwright compresses elapsed wall time instead of shipping a shortened-limit test switch.
- Generated UI references and `git diff --check` passed. No daemon implementation or contract changed; Go/contract suites were not needed.

Screenshots and static HTML were inspected for the warning, countdown, end notice and Explain card. Synthetic visual evidence and the review/assessment are retained outside git at `/var/tmp/agent-keep/dictation-hour-chain-01m7g49152gecy0cbepbxprk01/`; the lab spec regenerates image/HTML pairs with `OH_VISUAL_CAPTURE=1`. Large rendered copies are not added to repository history.

## Provider and daemon constraints

Read `internal/daemon/speech_linux.go`: temporary keys are single-use, expire for opening after 60 seconds, allow a 600-second connection, and are limited to ten mints per minute. No authority or contract change is needed. Each replacement key is minted only after the old drain, not speculatively; an ordinary hour needs seven keys because switching happens before the ten-minute cap.

The provider's current primary documentation confirms that an empty **text** frame ends a stream, followed by terminal responses and closure, and that temporary keys can cap connection duration. Sources checked: `https://docs.soniox.com/api-reference/stt/websocket-api` and `https://docs.soniox.com/api-reference/auth/create_temporary_api_key`. The older documentation URLs in the prototype were unavailable through the fetch tool; the current URLs were found through the provider documentation search.

## Review

Focused self-review plus `claude-fable-5-2` finding candidates and `gpt-6-astra` verifying repairs. Assessment: five fixes, one dropped classification suggestion, no follow-up issues. Fixed recovery of unsent seam audio, paragraph timing across timestamp resets, unused minting when stopping an empty drain, warning reset and keepalive margin. Self-review additionally bounded Stop while a replacement mint is stalled. Deterministic regressions cover the changes. The review establishes transport/state behavior, not real recognition accuracy at a phoneme boundary.

## Decisions for later review

- **Drain sequentially, rather than run two recognizers concurrently.** Audio continues to be captured while the old stream finishes. This preserves token order without a second response queue and avoids pre-minting a key that might expire or go unused. The trade-off is a short delay in displayed transcription at a seam, not a capture gap.
- **Prefer a 300 ms pause after 9:30; force rollover by 9:50.** This leaves time to drain before the provider's 10-minute cap. Continuous speech still has an unavoidable recognition-context boundary; synthetic tests establish no transport loss or transcript duplication, not perfect recognition.
- **Bound network recovery.** Keep the existing 30-second pending-audio budget and one automatic recovery attempt, replenished after a healthy planned seam, rather than the prototype notes' proposed 120-second repeated retry loop. A second unrecovered failure stops audibly and offers continuation; the client no longer silently evicts buffered speech. This follows the worker brief's preserve-and-offer-continuation behavior and avoids prolonged apparently live recording without a working provider.
- **Stop at precisely one hour.** Capture stops immediately; final tokens can finish arriving afterwards. The limit cue and announcement occur when capture stops, not when the provider eventually replies. Ordinary browser tab muting applies to the page's Web Audio output; reduced motion does not suppress sound.

## Live check

**Not performed with a real microphone/provider in this worker.** On the test server, dictate for more than ten minutes, pause near the handoff, then continue a sentence and press Valmis: check that words on both sides appear once and in order. For the hour check, listen for one tone at 59:00, two at 59:50 and the falling pair at 60:00; confirm microphone shutdown, kept text and Jatka sanelua. Also try a muted tab and a screen reader. These remain human live checks; the accelerated synthetic tests are not evidence that they were performed.
