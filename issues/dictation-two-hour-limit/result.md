# Two-hour dictation — 2026-11-23

The browser ceiling is now 7,200,000 ms. The one-minute and ten-second warnings derive from that ceiling; Finnish and English limit notices and the V38 explanation now say two hours. The chaining test drives twelve successive stream handoffs and the final words at the two-hour boundary. The browser journey also verifies that 59 minutes does not show the countdown, then stops at two hours and keeps the dictated text.

## Provider and upload audit

Checked Soniox's primary documentation on 2026-11-23:

- `https://docs.soniox.com/stt/rt/limits-and-quotas`: a real-time stream may last 300 minutes; published defaults are 100 requests/minute and 10 concurrent streams.
- `https://docs.soniox.com/api-reference/auth/create_temporary_api_key`: temporary-key expiry and maximum stream duration are separate; the latter permits up to 18,000 seconds.
- `https://docs.soniox.com/authentication/temporary-api-keys`: expiry only limits opening a stream, not an already-open stream.

The browser sends 100 ms PCM frames directly to Soniox, not an accumulated audio upload through Habitat. Its reconnect buffer stays capped at 30 seconds. There is therefore no one-hour upload-size limit to double. The gateway's 66,000-byte general request cap and the daemon's small key/control JSON limits do not carry microphone audio and are unchanged. The daemon still mints 60-second-lived, single-use keys restricted to 600-second streams; the browser still drains and chains streams around 570–590 seconds. No server, authority, session contract or credential restriction changed.

## Checks

- `./scripts/test-focused.sh --area web`: 258 files / 2,185 tests passed, including the two-hour chained-stream test; lint and TypeScript passed.
- `lab-dictation-hour.spec.ts`: 12/12 passed with `--repeat-each 3`, two workers, reply jitter, both 1440/390 px and Finnish/English. Browser time is accelerated; this is not a two-hour wall-clock recording.
- `dictation-bar.spec.ts`: 5/5 passed on rerun. An earlier combined run had one transient `no box` at its layout helper; disclosed, not presented as a clean first run.
- Generated UI references and `git diff --check` passed. No Go test was needed because no server code changed.
- Synthetic screenshots and static HTML: `/var/tmp/agent-keep/rail-icons-dictation-sounds/dictation-*`; logs are in the same directory. Checked countdown, explanation and retained-text layouts. No live provider recording or deployment was performed.

## Decisions for later review

Keep ten-minute key-scoped streams rather than extending a leaked key's billable lifetime: the existing chaining already supports a longer dictation. No product switch was added.

## Live check

Dictate past one hour: recording continues without the final-minute warning. Near two hours the minute/ten-second warnings occur, the microphone stops, and text remains available to edit or continue. Repeat after a connection interruption. This long real-provider check remains for the operator after deployment.
