# Result

## Change

Returning to a conversation opens it where the reader left it. The place is native identity, not pixels: the first visible row's entry key and its offset from the top of the view, plus the newest entry key the reader had (`ReadingPlace` in `web/src/app/conversationStore.ts`). `useReturnToPlace` (`web/src/app/useReadingPosition.ts`) reads it on every opening, including a remount. If the row is in the window, it hands the place to the view's existing anchor logic. If not, it reads older pages first (at most 60 pages, ending after three reads that change nothing). If the place no longer exists, the view opens at latest and the stale place is dropped. Both the controlled view (BrowserConversation) and the read-only history view (HistoryView) use it.

This reverses part of an earlier rule ("every opening starts at latest", issue `open-at-end-extension-message`, October 2026) for conversations left mid-history. A conversation left at its end still opens at latest from the home card, the sidebar and the workspace page. `lab-open-at-end.spec.ts` now reads up, returns to the end and leaves, then checks that the earlier reading place does not come back.

## Decisions for later review

- **Left at the end → back at the end, still following.** Reaching the end (scroll, the jump-to-latest control, a released press) removes the place. *Alternative:* store the end as a place. *Why:* following has to resume, and an end "place" would freeze the view above replies that arrive later.
- **Left mid-history → back at the same rows even if new replies arrived.** Replies after the stored tail count as new in the existing floating jump-to-latest control (`jump-latest`, with its new-reply count). They count until seen or until the control is used. No new component was needed. *Alternative:* jump to the end when there is something new. *Why:* Jari asked for the place he left. The control already says something is below.
- **Explicit navigation wins.** A ⌘K search hit (the only in-app navigation to a specific message today) skips the place. The hit's own hold then becomes the conversation's place. There are no browser notifications or entry links that open a message, so there was nothing else to route. *Why:* the person asked for that message.
- **Every route back restores**, including the home card's "Avaa" and the workspace page. *Alternative:* treat the home card as "open latest". *Why:* Jari's newer request covers switching back generally, and two rules for the same conversation would surprise him. If he wants the home card to mean "show the newest", that is a one-line `skip`.
- **Across reloads: remembered for this tab** in `sessionStorage` under the signed-in identity (`nah:<identity>:place:<id>`). It is validated on read and holds no content. *Why:* phones discard and reload background tabs, and a reload should not count as leaving. A new tab or another identity starts at latest. `web/AGENTS.md` lists it among what session storage keeps.
- **The reader's own wheel, touch or key input during an older-page read-back cancels the return.** *Why:* their gesture is newer than the stored place.
- A place now outlives its cached window, which is evicted at 50 conversations, because the return can read back to it.

## Evidence

Synthetic browser host (same-UID, fake Pi), not live-host evidence:

- New `web/tests/conversation-return.spec.ts`, 20/20 (4 repeats × 5):
  - leave a long history mid-way → other conversation → back: same row at the same offset, desktop (⌘K) and phone (history back);
  - a place inside a loaded older page survives a reload and is read back from the tail;
  - a controlled conversation keeps its place and shows jump-to-latest; left at the end it returns to the end and follows the next reply;
  - a ⌘K hit wins over the remembered place.
- Ran 3× with `OH_REPLY_DELAY_MS=60` (63/63): `native-history` (including older-page anchoring and warm return from cache), `thread-fill`, `history-first-page`, `switcher-search`.
- Ran 3× (36/36): `lab-open-at-end`, `lab-first-message-flicker`, and `lab-conversation-scroll` except `live row stays at its spacing above the composer`. That case fails on unchanged main as well, depending on machine conditions (7/7 passed at one point, 6/6 failed later), and was filed through intake. Five `browser-conversation.spec.ts` cases fail intermittently on unchanged main as well and were filed through intake. Neither is chased here.
- `./scripts/test-web-fast.sh`: passed. Unit tests in `useReadingPosition.test.tsx` cover return at the place with a new-reply count, end-left following, read-only return, and session-storage validation per identity.

Review level: self-review of the diff. The change is browser view state only: no contract, daemon, session/auth or authorization boundary. One finding was fixed: adopting a place before its row is laid out no longer stops following.

Live check: in a long conversation, read up a few screens, switch to another conversation, then come back (sidebar, ⌘K, home card, or reload). The same text should be at the same height. Go to the end, switch away and back: it opens at the end and follows a new reply.
