# Result

Run `01m59jkrmqyy52w0c548w7xfgm`. All three are browser-side defects; no daemon or contract code changed.

## 1. "Historiaa ei saada" in a new, empty conversation

**Root cause.** The browser's conversation store turned a confirmed empty window into `error` whenever something told it the window might be out of date, even though nothing had failed to read. `markStale` (used by `markAllStale` when the event stream recovers, by a window's own gap recovery and by reseed failures), `recoverWindow` and `reconnect`'s 404 path all wrote `entries.length ? "stale" : "error"`. The status had just proved that the history was unwritten and the window had nothing shown. After the snapshot, reseed only re-reads windows with entries or still loading, so the `error` stayed. The view then showed the red "Historiaa ei saada" box and, through `visibleRecovery`, the full-width **Tarkista keskustelun tila** button. This matches the screenshot exactly.

**Live evidence (read-only, VM, 2026-10-19).** The conversation was created at 06:43:43 UTC (`POST /conversations` 200). Its native file was born only at the first send, 06:45:14 (`stat` birth time). Pi had been running since creation: `model_change claude-bridge/claude-opus-5-5` at 06:43:50. No history, status or event request failed in the daemon or gateway journals. Fast reads (<250 ms) are not logged, so the journal cannot show which recovery fired in Jari's browser, but none of the paths above needs a failed read. In the synthetic host the exact view is reproduced by one event-stream drop whose resume cursor is refused (409), the common phone/network case (`evidence/before-new-conversation-error.png`).

**Fix** (`web/src/app/conversationStore.ts`). A confirmed empty window (state `empty`, no entries) stays empty when marked stale and owes one quiet tail read instead. The read runs at the next reseed or reconciliation, and `loadTail` already treats a 404 there as still empty. `reconnect` treats `history_missing` on such a window as still empty, and `recoverWindow` keeps it empty. A real read failure of an empty window still shows the error.

**Tests.** `conversationStore.test.tsx`: "keeps an unwritten new conversation empty through stream recovery, then reads once" (fails before: `error`) and "still reports a failed read of an empty window". `browser-conversation.spec.ts` "workspace plus starts one native conversation" now drops the stream with a refused cursor before the first message (fails before: the alert is present).

## 2. Stop missing while a Claude turn runs

**Root cause: presentation, not state.** Commit `d5905dfd` (2026-10-17, "one button primitive sized by role (wip)", included in pilot.231) applied the rule "an icon-only control stays quiet" to Stop as well. The agreed draft (`design-system/drafts/Agentin vuoro.proto.html`, `.c-stop`) and the pre-10-17 code have a filled ink circle with a light icon. After that commit it became a frameless 26 px ink-2 glyph beside Ohjaa / Työn jälkeen, under the field. It is easy to miss and looks as if Stop had "disappeared somewhere".

The state path was checked too. In the synthetic host Stop stayed mounted and enabled, sampled every 150 ms, through a first send, a send held while Pi starts (6 s slow start), a lazy resume of a stopped conversation after a daemon restart, and a follow-up turn. It never flickered. The live journals show nothing that would hold `run_active` false or keep the status stale: no failed status reads, no slow ones. The native turns in Jari's sessions are an ordinary tool loop. A provider-specific state cause therefore remains unproven, but nothing points to one. Hence the live check in KOKEILTAVAA.

**Fix** (`web/src/components/components.css`). `.ah-composer-stop` has a filled round ink surface with a background-colour icon again (hover/pressed ink-2), at the button system's inline role size. The same class gives "Pysäytä: viesti ei lähde" the same look.

**Test.** `lab-conversation.spec.ts` "slow turn explains work…" now asserts that Stop's own surface meets WCAG 1.4.11 non-text contrast (≥ 3:1) against the page. It fails before (1:1, transparent).

## 3. A seven-line own message fades its last line

**Root cause.** `.ah-user-collapsed` always applied `mask-image: linear-gradient(#000 82%, transparent)`. The gradient is relative to the element's own height, so a message shorter than the eight-line clamp faded its bottom ~18%: the last line of real, unclipped text (`evidence/before-seven-line-fade.png`).

**Fix.** The fade applies only when the content actually overflows (`ah-user-clipped`, from the existing overflow check), and then only to the last clamped line: opaque until `100% - 1.6em`, one line at the 1.6 line height. The clamp stays at 12.8em = exactly eight lines, and "Näytä koko viesti" is shown as before.

**Test.** `browser-conversation.spec.ts` "own message shows every line it fits; a clipped one fades only its last" measures rendered pixels per line band, so a fade by any mechanism is caught. Before the fix the last band's ink was 96 against 25 for the first line, and the case fails.

## Evidence

Synthetic lab captures, made with `evidence/capture.mjs` against `scripts/lab.sh` (invented identities, never the live host):
- `evidence/new-conversation-after-stream-recovery.{png,html}`: a new conversation after the stream drop: no alert, no status-check button.
- `evidence/seven-line-message.png`: all seven typed lines fully legible.
- `evidence/long-message-clamped.png`: clamped on a line boundary, only line 8 fades, "Näytä koko viesti".
- `evidence/running-turn-stop.png`: Stop as a filled circle beside Ohjaa / Työn jälkeen.
- `evidence/before-*.png`: the defects in the synthetic browser host before the fix.

## Checks (tree based on 113674f3)

- `./scripts/test-focused.sh --area web`: 28 files / 174 tests passed.
- Playwright (`OH_PORT_BASE=15000`, shared Chromium cache): `browser-conversation`, `new-conversation-placeholder`, `queued-send`, `reconnect-recovery`, `resilience-states`, `native-history`, `lifecycle-frames`, `mutation-layer`, `quiet-work`: 120/120 passed. Lab config `lab-conversation`, `lab-live-turn`, `lab-slow-creation`, `lab-open-at-end`: 19/19. `test:a11y`: 20/20.
- Each new assertion was run against the original sources and failed, then passed with the fix.
- No Go, contract or packaging inputs changed, so no Go/contracts run is claimed. Not verified live; see KOKEILTAVAA.

## Decisions for later review

- **Stop at 26 px, not the draft's 30 px.** Alternatives: restore the old `--ah-composer-stop-size: 30px` token, or keep the quiet glyph. Chosen: keep the button system's inline role size (the lab test already pins it) and restore only the draft's filled surface. The surface is what makes Stop findable, and the role-size decision of 10-17 stays intact.
- **Stop is an exception to "icon-only stays quiet".** The rule fits secondary icons. Stop is the one control that ends running work, and the agreed draft gives it a filled surface. If the button system should express this generally (e.g. a `presentation` for a primary round icon), that is a design-system follow-up.
- **The stale empty window reads the tail, not a bounded reconnect.** A confirmed-empty window has no shared key to meet, so `reconnect` would read up to eight pages. `loadTail` reads one and already treats 404 on an `empty` window as still empty.
- **A last-line fade stays on clipped messages.** The issue allowed "clamp at a line boundary with a clear expand". The one-line fade keeps the continuation cue the design had, never touches lines 1–7, and sits above the explicit expand button.
- **Typed line breaks in own messages** are joined into one paragraph by Markdown soft breaks (visible in the seven-line capture). That is outside this issue, so it was filed unlaned as `user-bubble-joins-typed-lines`.
