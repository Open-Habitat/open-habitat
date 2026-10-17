---
created: 2026-10-17
updated: 2026-10-17
type: bug
reporter: jari
status: in-progress
priority: normal
lane: conversation-live
lane_seq: 1
collision: [web/src/app/BrowserConversation.tsx]
preparation: ready
---

# Transient missing-events banner, status flicker, slow queued handover

Jari on the test server, 2026-10-17 ~17.45, three live observations in conversation flow. Live conversation for the first two: workspace `ws_HNLrrcHzMzGyXmfDJyKuYn2N`, conversation `pi:8cbfd64d-74e6-4cca-b491-a48f051283e4` (mapped user `maintainer`). Never read conversation content; read metadata, event sequence numbers, gateway/daemon `http_request` records (ADR 0022) and the browser's content-free diagnostics.

1. **Transient "missing events" banner.** "Tässä keskustelussa tuli tällainen virheilmoitus … jossa sanottiin että jotakin viestejä puuttui … hetken aikaa oli sellaiset tilat, ettei ollut kaikki viestit tai tapahtumat siinä … sitten se katosi." The gap notice (e.g. "Tapahtumia jäi väliin") appeared with a temporarily incomplete timeline, then recovered by itself. Find from evidence what triggered the gap (cursor, stream reconnect, history catch-up race) and either prevent the false gap or make recovery silent when it heals within the same view.
2. **Conversation status flickers when starting a second spinoff.** "Sitten tässä vilahtelee tarkasta keskustelun tila kun rupesin käynnistämään toista spinoffia." The top-bar status alternates while the agent starts a second spinoff. Find the competing sources of the state (turn state, waiting_on, spinoff inventory) and make it stable.
3. **Slow handover from queued bubbles (B1/B2).** Sending to a new conversation: "oli pitkä tauko siinä kun katkoviivaääriviivoilla olevat viestit katosivat ja oikea viesti tuli tilalle" — after the dashed queued bubbles disappear there is a long gap before the real message appears; the queued bubble should stay until the native message replaces it. Sending to a stopped old conversation: "jokin ? laatikko siinä mielestäni vilahti alhaalla" — a `?` box flashes at the bottom (probably the Prosessit `?` pill that `queued-send-unreachable-notice` removed for the waiting state; it seems to appear in a later transitional state).

## Acceptance Criteria
- [ ] Each item has its cause with evidence in result.md (live where available, lab reproduction otherwise) and a fix with a browser test; item 1 says plainly if the live cause could not be attributed.
