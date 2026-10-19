# Result: room for the workspace editor (Editori), round 2

Round directory `design-system/prototypes/rounds/2026-10-19-editorin-tila/`. Build it in
`design-system/prototypes/` with `node build.mjs rounds/2026-10-19-editorin-tila` and open
`dist/2026-10-19-editorin-tila.html`. Keys 1–3 switch direction, and `R` replays the turn.
Screenshots of each direction's key states are in [shots/](shots/). Names carry the width and
theme: `l1366` is a light 1366-px laptop, `d2560` is a dark 2560-px monitor, and `puhelin`
is the phone.

The round keeps everything from `proto-file-viewing` that Jari did not question: the same
conversation, the same link recognition (only workspace paths become links), and the same
VS Code stand-in with its own look and English UI. Only the space changes. Two causes of the
cramped first round were removed in every direction:

- The prototype stage had a 1080-px cap. This round's stage uses the whole browser width, so
  1366, 1920 and 2560 look as they would in the product.
- The app sidebar (about 300 px) and VS Code's explorer (250 px) together left the code about
  480 px. Now, while the editor is open, the app sidebar steps aside in every direction.

## Common to all directions

- **Start.** The first open shows "Käynnistetään VS Code" for a moment. The research measured
  3.4 s to a ready workbench. After that the editor stays running until it has been idle for
  half an hour (`--idle-timeout-seconds`), and later opens are instant.
- **A link keeps the reading place.** The link that opened the editor keeps a mark, and the
  conversation does not jump. When the conversation column changes width, the line the reader
  was at stays at the same height (asserted in the Playwright pass). A reader at the bottom
  stays at the bottom.
- **Keys inside the editor belong to VS Code**, including Esc and arrows. The app's only
  keystroke is **Ctrl+Alt+K** (Keskustelu). VS Code, Chrome and Firefox do not bind it by
  default, and Ctrl+Option+K is free on a Mac.
- **Phone.** VS Code's workbench does not run on a phone (Monaco: "Is the editor supported in
  mobile browsers? No."). So on a phone there is no editor button, and a file link opens a
  read-only peek under the link: the lines, Tiedosto/Muutokset, and the note "Muokkaus ja
  koko työtila ovat VS Codessa tietokoneella". This is the previous round's Kurkistus without
  its page or editing.

## Axis: how the editor and the conversation share the window

| # | Direction | How they share it | When it wins | Its cost |
|---|---|---|---|---|
| 1 | **Rinnakkain** | Side by side. The editor is on the left and the conversation is a column on the right. Drag the divider, or focus it and use the arrows, to set the width. The width is remembered, and a double-click resets it. Until the first drag the column is about a third of the window: 440 px on a laptop, 640 px at most. Enter on the divider or the top-bar button hides the conversation into a 40-px strip that shows Pi's state and a new-reply dot. Ctrl+Alt+K moves focus between editor and composer, and brings a hidden conversation back first. The app sidebar opens over the editor from ☰. | You talk to Pi while you edit: you read the reply, see the lines it names and type the next message, all without switching. At 1920–2560 both sides have plenty of room. | On a 1366 laptop the code gets about 650 px beside a 440-px conversation, or about 1000 px with the conversation hidden. The app's top bar (48 px) stays above the editor. A narrow column reflows wide tool output. |
| 2 | **Laatikko** | The editor fills the window. The only app chrome is a 38-px bar with "Sulje editori", where you are, and a Keskustelu button that shows Pi's state ("Pi työskentelee", "Odottaa sinua", "Uusi vastaus"). Ctrl+Alt+K or the button slides the conversation in as a 500-px drawer over the editor, at the same reading place with focus on the link you came from. Esc, Ctrl+Alt+K or a press in the editor puts it away. A link in the drawer opens the file and the drawer steps aside. | Long focused editing where the conversation is consulted now and then. This gives the most room inside our app, almost the whole window at every width. | While the drawer is open it covers part of the code, so you cannot read Pi's reply and the named lines side by side unless the lines are on the left. One more state to learn: whether the drawer is open. |
| 3 | **Oma välilehti** | Separate. VS Code is its own browser tab on its own origin (`open-habitat-test-code.example.test`). The app stays a conversation app with a "VS Code ↗" button. A link switches to the editor tab at the line. Going back is the browser's own tab switching, or two windows side by side on a big screen. The prototype draws the browser's tabs and address bar to show this. | The editor gets the whole browser window, and on two monitors the conversation and editor each get a screen. This is the research's recommended first slice: no iframe, no `frame-ancestors`, and no keyboard capture across frames. It is the cheapest to build. | Our app has no hold on the editor: there is no Pi state beside the code, and Ctrl+Alt+K cannot work. A link can switch to the tab only if the app holds the window it opened; after a reload the tab may not come forward (unverified). It is the closest to the first round's view switch, only with more room. |

## Recommendation

**Rinnakkain.** Jari's actual pattern is talking to Pi about code, and a file link means
"look at these lines while you read this reply". Rinnakkain is the only direction where the
reply, the named lines and the composer are visible at once. The room problem of the first
round came mostly from the 1080-px cap and the app sidebar, not from sharing the window. With
both gone, a laptop gives the code about 650 px (an 80-column Go file fits), and one keystroke
or the divider's Enter gives it about 1000. On 1920–2560 screens there is room for both.
Laatikko is the alternative if editing sessions are long and the conversation is only
glanced at. It shares the same pieces (editor host, keystroke, state chip), so a later
"maximise" in Rinnakkain could become Laatikko's drawer. Oma välilehti is the cheapest and
is worth keeping as a "pop out to its own tab" action whichever direction is chosen, but as
the main answer it gives up what the product adds: links and Pi's state next to the code.

## What Jari decides

1. **The direction:** Rinnakkain, Laatikko or Oma välilehti, or a riff around one.
2. **Architecture (his decision, if Rinnakkain or Laatikko): VS Code in a frame inside the
   app.** The research recommended a new tab first *because* a frame needs more:
   - The editor host must send `frame-ancestors https://open-habitat-test.example.test`. The
     app keeps `frame-ancestors 'none'` for itself, so the app cannot be framed.
   - The editor-scoped session cookie would be a third-party cookie inside the frame. The two
     hosts are same-site siblings, so `SameSite=Lax` cookies are still sent to a same-site
     frame, but this has to be verified in Safari and Firefox.
   - A cross-origin frame takes all keys when it has focus. For Ctrl+Alt+K to work from inside
     the editor, code-server needs a keybinding that posts a message to the app, which means
     a small built-in extension or product configuration. Without it, the button and the
     divider still work, and the key works once focus is outside the editor. **Unverified.**
   - Opening `path:line` in the running window: the app posts to the frame (or the daemon
     uses code-server's IPC socket), not by reloading the frame. **Unverified**, as it was in
     round 1.
   - Dragging the divider over an iframe needs a pointer shield during the drag (the
     prototype disables the editor's pointer events while dragging).
3. **Phone without a built-in viewer?** The common phone answer needs a small read-only file
   API in the daemon: read a file and its `HEAD` version, inside the workspace root. That was
   proposed in round 1 and is not yet decided. The alternative is that links do nothing on a
   phone, which needs no new API.

## Host facts the view assumes

- A code-server per person, started by the daemon on demand, with an idle timeout. The
  start state assumes the browser can tell "starting" from "ready".
- A way to open `path:line` (and a diff) in the running editor.
- Pi's state (working, waiting, new reply), which the app already has.
- For the phone peek: file content, `HEAD` content and whether the file differs from `HEAD`.

## Decisions for later review

- **The app sidebar hides while the editor is open (Rinnakkain, Laatikko).** The alternative
  was to keep it at 1920 and above. Hiding it is the same at every width and gives the editor
  the room that was missing; ☰ (Rinnakkain) or "Sulje editori" (Laatikko) brings it back.
- **The conversation column defaults to 30 % of the width, between 440 and 640 px, and the
  dragged width is remembered per browser.** The alternative was to store it on the server.
  The width is a per-device preference, and a server store would be new state with no need
  behind it. The product would keep it in the browser's local storage.
- **Dragging the divider far to the right hides the conversation**, as in VS Code's panels.
  Dragging back brings it back.
- **Laatikko's drawer is a fixed 500 px and is not resizable.** It is an overlay, and
  resizing would bring Rinnakkain's divider into it. If Jari wants it resizable, the divider
  code is shared.
- **A link opened from the drawer closes the drawer.** The alternative was to keep it open,
  but it would then cover the lines just opened.
- **Ctrl+Alt+K** is the one keystroke. Ctrl+J (Chrome's downloads, VS Code's panel),
  Ctrl+` (the browser shell's terminal toggle, decided in `proto-browser-shell`) and
  Ctrl+Shift+K (Firefox's console) were taken.
- **In Oma välilehti, closing the editor tab leaves code-server running** until its idle
  timeout, and a toast says so. Stopping it on tab close would lose unsaved state and the
  terminals that the research measured surviving a closed browser.
- **The browser chrome in Oma välilehti is drawn by the prototype** and marked as such. The
  real tab switching (Ctrl+Tab) belongs to the browser, so the prototype shows a toast for
  Ctrl+Alt+K instead of intercepting browser keys.

## Library proposal

None. The round reuses round 1's code: the fixture, recognition, VS Code stand-in and peek
are copied, not shared. When a direction is chosen, the VS Code stand-in and the link
recognition move into `lib/files.*` and round 1 goes to history.

## Checks run

- `node build.mjs rounds/2026-10-19-editorin-tila` builds (441 kB, 3 directions).
- `check.mjs`: desktop light and dark and phone for all three directions, with a clean
  console.
- A round-specific Playwright pass (scratch script, not committed) took the 21 screenshots in
  `shots/` at 1366×768, 1920×1080 and 2560×1440 and at phone width. It asserted the following:
  - Enter on a focused link opens the editor with focus in it (all three directions).
  - The opened link is marked and stays at the same height when the column narrows
    (Rinnakkain).
  - The divider's arrows resize the column, and Enter hides it into the strip.
  - Ctrl+Alt+K brings the conversation back to the composer, and a second press returns to
    the editor.
  - A dragged width survives a reload.
  - In Laatikko, Ctrl+Alt+K opens the drawer at the same reading place with focus on the
    link. Esc returns to the editor. A link in the drawer opens a new tab and closes the
    drawer. A reply that arrives while the drawer is away shows "Uusi vastaus".
  - In Oma välilehti, returning to the app tab puts focus on the link.
  - On a phone there is no editor button, and a link opens the peek in all directions.
  - The console was clean.
- Reduced motion turns off the drawer, sidebar and start-state animations. This was not
  separately screenshotted.
- No production code changed.
