---
created: 2026-10-12
updated: 2026-10-12
type: bug
status: open
priority: normal
lane: signin-fix
lane_seq: 7
collision: [web/]
---

# New conversation view shows false errors and scattered actions

_Source: chat_

Jari, 2026-10-12, pilot.22, a new Pi conversation in the freshly cloned `issuectl` workspace (14.24 and 14.28 local). The conversation itself worked: the daemon and Pi were running and the session file was being written, so every error-looking state below appeared without an actual failure.

Conversation view:
1. A "Tilannekatsaus" box ("Pyydä lyhyt katsaus ennen kuin jatkat", disabled "Luo katsaus", "Yhteys tai ohjaus ei ole käytettävissä", red "Katsausta ei voitu tarkistaa. Lataa sivu uudelleen.") appears immediately in the first second of an empty conversation. It has no place in a new, empty conversation, and its error lines show while control is still being established.
2. "Arkistoi" sits as a full-width bordered strip above the composer and is easy to mistake for something else. Archiving/closing a conversation belongs in a top bar as a button.
3. The "? Tila ei tiedossa" pill next to the title is odd for a new conversation; the state is known (new/idle) or the pill should not render until it is.
4. "Luo uusi otsikko" is unnecessary in an empty conversation and is styled as a link. Jari's direction: give the conversation a top bar with actions as real buttons — title, archive, and details ("Tiedot") as a button there.

Sidebar:
5. Under the expanded workspace, the new conversation row shows "Uusi keskustelu ×  Historia ei luettavissa", the status text floating next to the row. History of a new conversation is not "unreadable"; the row should show the conversation normally, and a genuine history failure needs its own clear placement.

Check the design (design-system/, `review-browser-design-v2`) for the intended top bar and states, and verify each state in the lab on desktop and phone.

Sidebar after a couple of messages (Jari, 14.37):
6. The conversation row now reads "Checking the Connection" with "○ Tila ei tiedossa" on a second line. After completed turns the state is known; "unknown" must not be the normal state of a settled conversation. Find why the sidebar has no state for it (the conversation view knew the turn had completed).
7. The row wraps onto two lines and its white backgrounds are offset from each other and from the workspace row above. A conversation row is one line: title truncated with an ellipsis, a compact state indicator at the right, aligned with the workspace rows.
8. The generated title is in English although the conversation was in Finnish (check against `generate-conversation-titles`: the title should follow the conversation's language).
9. Jari: each workspace row in the sidebar gets a "+" button after the repository name that starts a new conversation in that workspace (an icon button with an accessible label, visible on hover/focus on desktop and always on touch).
