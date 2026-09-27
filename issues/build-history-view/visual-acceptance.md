# Native history visual acceptance — Jari decision pending

**Exact tested product revision:** `cebc8d4df602e477ef362da77a85516227e5a835` (the screenshots were generated from these product source bytes by the browser command below; evidence-only commit may change HEAD). This is a **testing** checkpoint, not Jari's acceptance.

## Browser and fixtures

Playwright 1.63.0 Chromium 153.0.8010.12 headless on Linux x86_64, 1280×720 light theme; standalone loopback TLS host `https://127.0.0.1:4174`. Production web bundle has `VITE_ENABLE_TEST_FIXTURES` unset. A browser-test-only host makes two synthetic OAuth identities (Alice/Bob), mapped synthetic UDS routes and disposable user-home Pi v3 JSONL files. Fixture server and daemon run under one OS UID; this is **not** two-UID systemd evidence, real GitHub consent, a live host or a manual visual decision. Screenshots were captured as Playwright PNG and converted byte-for-byte visually to committed AVIF with `avifenc -q 75 --speed 6`; assertions are the primary evidence.

## Journeys and screenshots

| State | Assertion and visual artifact |
|---|---|
| Happy/read-only | OAuth login → confirmed workspace → expanded shared rail agent item → `/agents/pi:11111111-1111-4111-8111-111111111111`; 25 ordered native entries, explicit `Vain luku`/unknown process, no write requests during open/page/reopen. [Happy](assets/happy.avif) |
| Empty history | Native header without messages shows "Natiivissa historiassa ei ole vielä viestejä", zero rows, no send affordance. [Empty](assets/empty.avif) |
| Long/paged/unknown | 251 native entries yield 25-entry pages and 11 explicit reads, no duplicate native keys; 80 KiB UTF-8 item continues at a codepoint boundary with a 65,536-byte chunk; unknown Pi event uses shared fallback and hostile `<script>` remains text, no DOM script in history. [Long/unknown](assets/long-unknown.avif) |
| Corrupt/unreadable | Header with malformed JSONL entry: endpoint returns 503, timeline shows error instead of fabricated empty content. [Corrupt](assets/corrupt.avif) |
| Missing | Removing synthetic native file while the deep link remains results in "Keskustelua ei löydy", not another selected agent. [Missing](assets/missing.avif) |
| Same identity/reopen | Browser reload of same agent starts at same `pi:<sessionId>` and first native entry; Go native test asserts same revision/entry keys after reopening, without a host database. |
| Moved cwd/unsafe source | Go fixture moves cwd outside listed workspaces (no association), rejects symlink and stale content revision; no inaccurate fallback to a different workspace. |
| Isolation | Bob's history text differs from Alice's; spoofed `X-Agent-Host-Identity` / display-name request headers cannot alter mapped response. Two real Unix UIDs were not exercised in this browser fixture. |

**Exact command/result:** from repository root,
`PATH=/home/maintainer/Sources/native-agent-host/.tools/go/bin:$PATH PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm run test:e2e --prefix web -- --grep @native-history` — **4 passed, exit 0** (host-backed TLS/UDS fixture; Chromium only). `go test ./internal/daemon -run PiHistory -count=1 -v` passed 2,500-entry ordering, source revision, UTF-8 chunk and branch/model cases. Opt-in native Pi SDK file comparison and probe evidence verifier commands/results are in [result.md](result.md). The full clean CI gate is recorded there after it runs.

**Limits for visual review:** The UI displays native content as escaped plain text rather than rich Markdown/diff or grouped tools; @complete-conversation-ui owns those controls, virtualization, accessibility paging polish and full presentation. There is no running Pi process or live-tail/SSE in this slice; the read-only label is deliberate. Screenshots supplement browser assertions and do not prove a screen-reader pilot, pilot host or two-UID systemd isolation. Jari's dated accept/change decision must be recorded in `item.md` by the conductor before the next `ui-v1` slice is treated as accepted.
