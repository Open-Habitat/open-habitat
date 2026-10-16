---
created: 2026-10-16
updated: 2026-10-16
type: bug
reporter: jari
status: fixed
priority: normal
lane: web
collision: [web/src/app/]
preparation: ready
closed: 2026-10-16
---

# 'Lataa vanhempi historia' stays after the whole history is loaded

Jari on the test server (pilot.162), 2026-10-16: "Sivulla oleva 'Lataa vanhempi historia' ei katoa, vaikka historia on ladattu loppuun." (In short: the "Lataa vanhempi historia" button does not disappear even when the whole history has been loaded.) An earlier related fix was `history-pager-after-turn` (after a turn, no "Lataa seuraava historiasivu"). Find how the browser decides that older history exists (the snapshot or page cursor from the daemon), and why it stays true at the beginning of the native history.

## Acceptance Criteria
- [x] The button disappears once the oldest native entry is loaded, and does not reappear after a live turn, a reconnect or a reload; browser test with a short and a long history.

## Comments

### 2026-10-16T13:07:32Z · @jari

Jari 16:06 local (lataa-seuraava-sivu.png): at the end of a read-only conversation, a large teal 'Lataa seuraava sivu' button sits outside the conversation column (left, half-width) between the last reply and the recap. It is out of place, and it should not be there at all once the conversation is at its end. The same pager logic as 'Lataa vanhempi historia'.
