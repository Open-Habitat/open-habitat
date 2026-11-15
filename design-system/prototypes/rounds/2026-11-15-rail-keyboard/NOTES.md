# Keskustelusta toiseen näppäimillä – kierros 1

- **1 Suoraan**: ⌥↑/⌥↓ (Alt+↑/↓) avaa sivupalkin edellisen tai seuraavan keskustelun heti, myös kirjoituskentästä. ⌥⇧↓/⌥⇧↑ hyppää seuraavaan tai edelliseen sinua odottavaan, ja Sillä aikaa -rivin näppäimeksi tulee siksi ⌥⇧↓.
- **2 Vaihtaja**: ⌘K / Ctrl+K avaa haun keskustelujen yli. Tyhjällä haulla valmiina on edellinen keskustelu, joten ⌘K Enter vaihtaa kahden välillä. ⌥↓ jää Sillä aikaa -rivin näppäimeksi.
- **3 Selaa ensin**: ⌥↑/⌥↓ vie fokuksen sivupalkkiin viereiselle riville avaamatta sitä. Sen jälkeen pelkät ↑↓ selaavat, Enter avaa ja palauttaa kirjoituskenttään, ja Esc palaa ennalleen.

Issue `proto-rail-keyboard-navigation`. Suunnat, suositus ja päätökset ovat
issuen `result.md`:ssä.

Sivu on tuotannon kehys: `AppShell` ja `WorkspaceRail`, `NowSections`in
osiomerkintä tuotannon `AgentNavItem`-riveillä, `QuietSection`,
`ConversationFrame`, `AgentHeader`, `ConversationTimeline` viesteineen ja
`Composer`. Kierroksen omaa on näppäinten käsittely, ensikäytön vinkki,
vaihtaja, selaustilan nauha, Selitystila-kortti ja `NextRow`.
`NextRow` on tuotannon `NextWaitingRow`-merkintä tuotannon tekstein, mutta
siinä on suunnan oma näppäin. Tuotannon rivi nimeää ⌥↓:n
`navigator.platform`in mukaan, joten se ei seuraisi katselmoinnin
näppäimistövalintaa. Sillä aikaa -rivi näkyy tässä koko ajan. Tuotannossa se
näkyy vain lähetyksen tai saapumisen ikkunassa.

Näppäimet toimivat sivulla oikeasti. Sivupalkin järjestys luetaan sen
näkyvistä riveistä, joten kokoon taitettu Hiljaiset jää pois. Luonnos pysyy
omassa keskustelussaan. Pidetty näppäin etenee riviltä toiselle ja pysähtyy
listan päähän. Katselmoinnin palkissa voi valita näppäimistön (Mac:
⌥ ja ⌘, Windows/Linux: Alt+ ja Ctrl+). Sivu ottaa vastaan molemmat
muuntonäppäimet valinnasta riippumatta. `?kbd=mac|pc`, `?theme=` ja
`?lang=en` valitsevat alkutilan.

## Survey: what Habitat binds today

Read from `web/src` on 15.11.2026. "Page-wide" means a document or window
listener; the rest work only where focus is.

| Key (Mac / others) | Where | What |
| --- | --- | --- |
| Enter, Shift+Enter, ⌥Enter / Alt+Enter | composer | send; new line; send once the other way (steer vs. after the work) |
| Esc | composer | closes an open list; with nothing open, stops what Stop stops |
| `@`, `/`, then ↑↓ Tab Enter ← → | composer | file and command lists |
| ⌘P / Ctrl+P | page-wide (not other inputs) | opens the composer's file tree |
| ⌥↓ / Alt+↓ | page-wide, **only while the Meanwhile row shows** | open the next conversation waiting for you (`NextWaitingDock`) |
| ⌘§ or ⌘⇧Space / Ctrl+§ (the key left of 1) | conversation view | start/stop dictation; Enter, Esc while dictating |
| Ctrl+Alt+T, Ctrl+Shift+Enter (on Mac too) | page-wide, capture | open the terminal, or move between it and its tabs |
| ⌘⌥K / Ctrl+Alt+K | page and editor frame (forwarded) | leave and return to the code editor |
| ⌘S / Ctrl+S, ⌘⌥P or ⌘⇧V / Ctrl+Alt+P or Ctrl+Shift+V | browser editor | save; preview |
| `/`, Esc | Settings | focus the settings search; close Settings |
| Esc, Enter/Space | Explain mode | leave; a waiting card refuses Enter/Space |
| Ctrl+Shift+C, Ctrl+V | terminal | copy, paste |
| Page/arrow keys | history viewport | reading position |

The open-habitat-ui skill (`internal/daemon/ui-skill/references/`) says the
same keys: Alt+Enter, Ctrl+P and `@`, Ctrl+Alt+T and Tab/Esc in the terminal,
Ctrl+Shift+C. No help sheet lists them all. Production's `altKey()` writes
⌥↓ on a Mac and Alt+↓ elsewhere, and this round follows that.

## Collision table

A ✗ marks a key the browser or OS takes before the page or that a page should
not override. A ⚠ marks a key the page can take but that does something
there. "?" means not verified in this round. Check those on real machines
before implementing.

| Key | macOS Safari | macOS Chrome / Brave | macOS Firefox | Win/Linux Chrome / Brave | Win/Linux Firefox | In the composer (textarea) | Terminal (xterm) | Editor iframe (code-server) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ctrl/⌘+Tab, Ctrl+PgUp/PgDn, ⌘/Ctrl+1–9, ⌘⌥←→ | ✗ tabs (⌃Tab) | ✗ tabs | ✗ tabs | ✗ tabs | ✗ tabs | – | – | – |
| ⌥←→ / Alt+←→ | ⚠ page scroll off fields | – | – | ✗ back/forward | ✗ back/forward | ⚠ Mac: move by word | ⚠ word motion in shells | VS Code word nav |
| **⌥↑↓ / Alt+↑↓** | ⚠ page up/down when focus is not in a field | ⚠ same | ⚠ same? | free | free (address bar only) | ⚠ **Mac: caret to paragraph start/end**, ⌥⇧ selects it; others: nothing | ⚠ sends `ESC[1;3A/B`; tmux configs often bind M-Up/Down | VS Code: move line (never reaches the page) |
| ⌥⇧↑↓ / Alt+Shift+↑↓ | ⚠ as above | ⚠ | ⚠ | free | free | ⚠ Mac: select to paragraph edge | ⚠ | VS Code: copy line |
| **⌘K / Ctrl+K** | free? | free | ⚠ web search (overridable) | ⚠ address bar search (overridable, as GitHub and Slack do) | ⚠ web search (overridable) | Mac ⌘K free; **Ctrl+K is kill-line on Mac** (not taken) | ⚠ **Ctrl+K is readline kill-line** | VS Code chord prefix |
| ⌃↑↓ / Ctrl+↑↓ | ✗ Mission Control / App Exposé | ✗ | ✗ | free | free | others: paragraph move in some fields | ⚠ | – |
| Ctrl+Alt+↑↓ | – | – | – | ✗ some Linux desktops switch workspaces; Intel graphics rotate the screen on old Windows | ✗ same | – | – | – |
| ⌘⇧L / Ctrl+Shift+L, ⌘⇧E / Ctrl+Shift+E | ✗ Safari sidebar (⌘⇧L) | ? | ✗ devtools (Ctrl+Shift+E network) | ? | ✗ | – | – | – |
| F6 | ✗ (fn on laptops) | ✗ cycles address bar/panes | ✗ | ✗ | ✗ | – | – | – |
| J/K (no modifier) | – | – | – | – | – | ✗ types letters | ✗ | ✗ |

What follows for this rail:

- **Left/right are out on every platform** (back/forward, word motion), and
  so is Ctrl+↑↓ on a Mac. **Up/down with Alt is the one arrow pair no browser
  takes.** On a Mac it costs paragraph jumps in the composer and Option-page
  scrolling. Slack and Discord accept the same cost.
- **⌘K / Ctrl+K is overridable everywhere** but it means something on every
  browser: the address bar's search. In a shell Ctrl+K is kill-line, so it
  must never be taken inside the terminal.
- **The terminal and the editor keep their keys.** Habitat's handler must leave
  Alt+↑↓ and Ctrl+K alone while focus is in `.ah-terminal-surface`. Ctrl+Alt+T
  already leaves the terminal. The code-server frame never sends these keys
  to the page, and they must not be forwarded, because VS Code uses Alt+↑↓
  to move lines. ⌘⌥K / Ctrl+Alt+K leaves the editor first.
- **Composition:** ignore `isComposing`, as the existing handlers do. **AltGr**
  on Windows arrives as Ctrl+Alt, and an Alt+arrow rule that refuses Ctrl
  never matches it.

## How comparable apps do it (material, not a spec)

Recalled behaviour. "?" marks what may have changed since.

- **Slack**: ⌥↑/↓ (Alt+↑/↓) previous/next channel or DM in sidebar order;
  ⌥⇧↑/↓ previous/next *unread*; ⌘K / Ctrl+K "Jump to"; ⌘[ ] history; F6
  moves between sections.
- **Discord**: Alt+↑/↓ channels; Alt+Shift+↑/↓ unread channels;
  Ctrl/⌘+Alt+↑/↓ servers; Ctrl/⌘+K quick switcher.
- **Linear**: ⌘K command menu; J/K and arrows move in lists outside text
  fields; G-prefixed jumps.
- **VS Code**: ⌘P / Ctrl+P quick open (Habitat already uses this key for
  files); ⌃Tab recent editors; ⌘⇧E focuses the Explorer, where arrows browse
  and Enter opens.
- **ChatGPT / Claude web**: a ⌘K-style search over chats, plus a shortcut
  for a new chat (?). Neither steps through the sidebar with a key (?).

The pattern in chat apps is **Alt+↑↓ for the list in order, Alt+Shift+↑↓ for
the unread or waiting ones, and ⌘K for search.** Direction 1 is the first
two, and direction 2 is the third on its own.

## Discoverability

- **Labels**: ⌥ ⌘ ⇧ on a Mac and Alt+ Ctrl+ Shift+ elsewhere, as production's
  `altKey()` writes them. The review bar switches between them.
- **First-use tip** at the end of the rail. It names the keys and appears
  after the person has changed conversation with the mouse three times. It
  shows on load here so it can be seen, and *Selvä* dismisses it for good.
- **The Meanwhile row** already shows its key cap. It is the place a person
  meets the keys anyway, so direction 1 changes its cap to ⌥⇧↓.
- **Explain mode**: the review bar's checkbox shows the sentence the rail
  would say in Explain mode, which is where a person asking "what is this?"
  learns the keys.
- **Tooltips**: production's row tooltip (`title`) is the row's state, and
  adding keys to every row would be noise. Implementation adds
  `aria-keyshortcuts` to the rail's list so screen readers can announce them.
- **Touch**: on a touch screen (`pointer: coarse`) there is no tip, no key cap
  and no Explain sentence about keys. The phone captures show the rail
  unchanged.

## What the host would need

**Web only.** No daemon, contract, gateway or snapshot change. The rail order
and the waiting list already exist in the browser.

- **Common.** A page-wide keydown listener in the shell (`BrowserShell`,
  capture phase like the terminal key). It reads the rail order from the
  same model `NowSections` and `QuietSection` draw, not from the DOM. It
  skips focus in the terminal surface, other dialogs, Settings' own fields
  and an open composer list. The order must not move under held keys: a
  conversation opened by a key keeps its place until the person leaves it.
  That is production's kept-row rule for a new reply that has been opened.
  Each step opens a conversation. A held key passes several, so loading a
  history the person has already left should be cancelled or ignored, as
  ordinary clicking does.
- **1 Suoraan.** Alt+↑↓ and Alt+Shift+↑↓. `NextWaitingDock` and
  `NextWaitingRow` move to Alt+Shift+↓ (`aria-keyshortcuts`, `altKey`
  label). Keyboard focus stays in the composer when it was there.
- **2 Vaihtaja.** A dialog component (React Aria `ComboBox` or a listbox in a
  `Dialog`) and the previously open conversation, kept in memory. ⌘K is
  taken in the composer and on the page. On Windows/Linux Ctrl+K is left to
  the terminal.
- **3 Selaa ensin.** Roving focus in the rail's links, a temporary band, and
  Esc returning focus to where it came from. The rail rows are links today,
  which suits roving focus; the row's `…` menu and buttons stay reachable
  with Tab.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-15-rail-keyboard/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 500 \
  node design-system/prototypes/rounds/2026-11-15-rail-keyboard/check.mjs \
  design-system/prototypes/dist/rail-keyboard/offline.html <kuvahakemisto>
```

`web/node_modules` tarvitaan lukitiedoston mukaisena (`npm ci --prefix web`).
