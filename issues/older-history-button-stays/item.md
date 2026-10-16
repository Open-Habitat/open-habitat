---
created: 2026-10-16
updated: 2026-10-16
type: bug
reporter: jari
status: open
priority: normal
lane: web
collision: [web/src/app/]
preparation: ready
lane_seq: 13
---

# 'Lataa vanhempi historia' stays after the whole history is loaded

Jari on the test server (pilot.162), 2026-10-16: "Sivulla oleva 'Lataa vanhempi historia' ei katoa, vaikka historia on ladattu loppuun." (In short: the "Lataa vanhempi historia" button does not disappear even when the whole history has been loaded.) An earlier related fix was `history-pager-after-turn` (after a turn, no "Lataa seuraava historiasivu"). Find how the browser decides that older history exists (the snapshot or page cursor from the daemon), and why it stays true at the beginning of the native history.

## Acceptance Criteria
- [ ] The button disappears once the oldest native entry is loaded, and does not reappear after a live turn, a reconnect or a reload; browser test with a short and a long history.

## Comments

### 2026-10-16T13:07:32Z · @jari

Jari 16:06 local (lataa-seuraava-sivu.png): at the end of a read-only conversation, a large teal 'Lataa seuraava sivu' button sits outside the conversation column (left, half-width) between the last reply and the recap. It is out of place, and it should not be there at all once the conversation is at its end. The same pager logic as 'Lataa vanhempi historia'.

### 2026-10-16T15:12:45Z · @jari

Jari 18:11 local, live after 12471b59 (vanhempi-alussa.png): at the very top of a short conversation whose first entries are visible (the Malli / Ajattelu row, then 'Ping' / 'Pong!', then two spinoffs), a big 'Lataa vanhempi historiasivu' button still shows. It can do nothing, because the whole conversation is loaded; something counts wrong. Live conversation: workspace ws_5AKDogIQD9CyV4Mo3nc0CqNZkY9tcr33, conversation pi:7489fcb0-31b8-42db-b088-681a77424f07.

### 2026-10-16T15:14:54Z · @jari

Jari 18:12 local (seuraava-sivu-yha.png): at the end of the same conversation, the big 'Lataa seuraava sivu' button is still there, full thread width and shifted left by that same width, outside the column. Both pagers must be fixed: the older one at the top and the next one at the bottom.

## Reopen Notes — 2026-10-16

Jari's live screenshots still show both paging controls after the earlier fix. The current mapped daemon's oldest response is complete; the served origin bundle does not contain the old footer label shown in the screenshot. See [live investigation and metadata](live-investigation.md). Keep open until a fresh-tab check establishes which code and responses the affected browser is using.
