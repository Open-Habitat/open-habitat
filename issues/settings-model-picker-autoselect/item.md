---
created: 2026-10-16
updated: 2026-10-16
type: bug
reporter: jari
status: open
priority: high
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
lane_seq: 5
---

# Settings model picker auto-selects on tab switch; slow, Claude selectable, Pi heading, no version

Jari on the live test server (pilot.166/167), 2026-10-16 17:50 local, in Asetukset → Agentit (screenshots 1–4 in this directory):
1. **Auto-selection.** At first the picker looks right (`1-alussa.png`). He opens the Claude-tilaus tab (`2-claude.png`) and returns to ChatGPT-tilaus (`3-takaisin.png`): now "Vanhemmat mallit" is open, and focus **and the selection** have moved there by themselves (to GPT-5.6 Luna). Switching tabs must never select or save a model. This is the likely cause of today's refused `gpt-5.3-codex-spark` default that disabled every + (see `plus-live-cause`).
2. Clicking GPT-6.1 Sol: at first it is disabled; after a couple of clicks it becomes selected and the Vanhemmat group closes.
3. **Slow.** Selections, and the thinking-level change, are slow. If they take time, the UI must handle that visibly (pending state on the control, then confirmed or failed), not freeze or lag.
4. The Claude-tilaus option must not be selectable while Claude is not enabled (no sign-in). Show it as unavailable with the reason and a link to Yhteydet.
5. The "Pi" heading in Agentit (`4-pi-otsikko.png`) is unnecessary: there is only one harness, Pi, so it does not need to be named.
6. **Server version.** Show the running server version somewhere, as many sites do: at least in the server settings (Palvelin), and possibly as a small line at the bottom of the settings.

## Acceptance Criteria
- [x] Tab switching never changes the selection or the saved default; browser test.
- [x] Every enabled model is selectable with one click; Vanhemmat opens only by the user's action, or when the current choice is in it.
- [x] A pending, confirmed or failed state for model and thinking changes, with no frozen UI; a test with a slow host response.
- [x] Claude is unavailable without a sign-in, and the Pi heading is gone.
- [x] The server version is visible in the server settings; lab screenshots.

## Reopen Notes — 2026-10-16

_Add rationale for reopening here._

## Comments

### 2026-10-16T16:05:00Z · @jari

Live on pilot.180 (installed 18:43 local, contains this fix), Jari ~19:05: the Pi heading is still shown; returning to the OpenAI models, the "Vanhemmat mallit" menu still opens by itself and the choice selects (saves) itself. The running server version is not visible anywhere in Settings, so whether his tab ran the fixed bundle cannot be told. A tab opened before 18:43 would be stale: next attempt must first establish the bundle version (`server-version-reload` makes it visible), then reproduce live.
