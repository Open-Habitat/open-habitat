# pbcopy ja pbpaste joka asennukseen: suunnitelma

## Tiivistelmä (Jarille)

Habitat-palvelimella ei ole leikepöytää. Sinun leikepöytäsi on laitteessa,
jonka selaimessa Habitat on auki. `pbcopy` ja `pbpaste` ovat siksi pyyntöjä
selaimelle, ei paikallisia komentoja.

- **`pbcopy`** tarjoaa tekstin leikepöydällesi. Keskustelussa näkyy kortti,
  jossa on teksti ja *Kopioi*. Yksi painallus riittää kaikissa selaimissa,
  ja kortti säilyy, joten voit kopioida myöhemmin tai toisella laitteella.
  Komento palaa heti ja kertoo agentille rehellisesti, että teksti on
  *tarjottu*, ei vielä kopioitu.
- **`pbpaste`** pyytää leikepöytääsi. Keskustelussa näkyy kortti *Agentti
  pyytää leikepöytääsi*. Mitään ei lueta ennen kuin painat *Liitä
  leikepöydältä* (tai ⌘V kortissa). Sen jälkeen näet tekstin, ja vasta *Anna
  agentille* lähettää sen. Avaimen tai salasanan näköisestä tekstistä tulee
  varoitus, koska teksti menee myös mallin tarjoajalle. Komento odottaa
  enintään 10 minuuttia ja palauttaa sitten selvän virheen.
- **Terminaalissa** `pbcopy` kirjoittaa OSC 52 -sekvenssin. Habitatin
  terminaali tarjoaa sen jo nyt Kopioi-toimintona, ja sama komento toimii
  SSH:n yli omassa terminaalissasi. `pbpaste` pyytää leikepöydän siinä
  terminaalipaneelissa, josta se ajettiin.
- **Ilman selainta tai ihmistä** (Taskfleet-worker, cron, SSH ilman
  Habitatia) `pbpaste` epäonnistuu heti omalla exit-koodillaan eikä jää
  odottamaan. `pbcopy` vie tekstin workerin luoneeseen keskusteluun.
- `xclip`-, `xsel`- tai `wl-copy`-nimisiä aliaksia ei tehdä (perustelu
  alempana).

Prototyyppikierros 1 vertaa, missä tämä näkyy: A kortti vuorossa (suositus),
B kentän luona ja C sivuilmoitus. Tulos ja kysymykset ovat
[result.md](result.md):ssä.

## Host facts this design rests on

**PATH.** `internal/daemon/agent_path_linux.go` gives every native process
the daemon starts the same PATH: `~/.local/bin`, `~/.cargo/bin`, the system
directories, the release directory (the `open-habitat` binary), Claude
Code's directory and last the core runtime's `agent-bin`
(`runtime/core/agent-bin`, today only `pi`, plus `taskfleet` and `workmux`
from the build). This holds for browser-started Pi conversations
(`conversation_linux.go`), the browser terminal and editor shells
(`terminal_linux.go`, `editor_linux.go`, through the product's own tmux
server), and everything Pi starts, including Taskfleet's Pi workers in tmux.
A command placed in `agent-bin` therefore reaches all of them, and a
person's own `pbcopy` earlier on PATH wins. The release closure
(`internal/host/release_closure_linux.go`, `CoreAgentTools`) refuses
anything in `agent-bin` it does not list, so the two commands are added
there with the `agent-launcher` component, like `pi`.

**Who is asking.** A browser-started Pi has `OPEN_HABITAT_CONVERSATION_ID`,
`OPEN_HABITAT_WORKSPACE_ID` and `OPEN_HABITAT_LAUNCH_GENERATION`
(`pi_rpc_linux.go`), which `open-habitat agent … --current` already checks
against the daemon (`internal/cli/agent_linux.go`). Taskfleet workers get
`TASKFLEET_CREATOR_SESSION=pi:<creator>` but not the launch triple. Browser
terminals get neither. Nothing in the terminal's environment says which
panel it is today.

**Existing agent → browser paths.** `open-habitat agent notice create`
(daemon `notices_linux.go`) appends a `notice.created` event to the
conversation journal, and the browser draws an `AgentNoticeCard`. File and
view offers ride the same journal. Native questions (`NativeQuestion`,
`SupportedQuestion` in `web/src/components/Conversation.tsx`) already model
a turn that waits for the person, including `resolvedElsewhere` and
`expired`. The page notice stack (`NoticeStack`, `WarningBannerView`) is
presentation only.

**The terminal's clipboard today** (`web/src/components/Terminal.tsx`).
xterm.js registers an OSC 52 handler. tmux's own selection arrives as
OSC 52 and becomes the selection's Copy action. The decoder accepts up to
1.4 MB of base64 and ignores the `?` read query. Ctrl/⌘+V pastes through a
paste event, and a multi-line paste asks first ("Liitetäänkö n riviä?").
The composer already takes pasted images as attachments.

**Browser Clipboard API** (behaviour as of late 2026. Implementation must
re-verify it on a device matrix):

| | write (`writeText`) | read (`readText`) | paste event (⌘V) |
|---|---|---|---|
| Chromium | secure context and focused document; no gesture needed | `clipboard-read` permission prompt once per origin, then silent while focused | always, gives the text |
| Firefox | needs transient user activation (a click or key) | since 125: needs activation, then shows its own "Paste" button every time | always |
| Safari (macOS, iOS) | needs user activation, called synchronously in the handler | needs activation, then shows its own "Paste" callout | always |

An `<iframe>` needs `allow="clipboard-read; clipboard-write"`. Habitat's
sandboxed views have neither, so the bridge lives in the app itself, never
in a view. Over plain `http` (not localhost) `navigator.clipboard` is
missing, but the paste event still works. So **the press is the only path
that works in every browser.** Chromium's silent read after permission is
exactly what this design must not use.

## Model

### pbcopy

`pbcopy` reads stdin (UTF-8 text) and asks the daemon to offer it to the
person. The daemon is reached through the same per-user socket as
`open-habitat agent`. Where it appears:

1. **Conversation context** (launch triple valid): a copy card in that
   conversation's journal, attributed to the command row that made it.
   Persisted like a notice, so it survives reload, shows on every device
   and can be pressed later.
2. **Taskfleet worker** (`TASKFLEET_CREATOR_SESSION`, no triple): the card
   goes to the creator conversation, labelled with the worker's name.
3. **Terminal** (stdout or `/dev/tty` is a terminal, no conversation
   context): write OSC 52 to `/dev/tty`. The Habitat terminal's existing
   handler turns it into the Copy action, and iTerm2, kitty, WezTerm or
   tmux with `set-clipboard` do the same over SSH. Nothing reaches the
   daemon.
4. **None of these**: exit 3, `no_person`.

The command returns as soon as the offer is recorded. It does not wait for
the press. Its stderr says so in words an agent will repeat correctly:
`pbcopy: offered 10 lines (412 bytes) to the person in this conversation; it
is on their clipboard once they press Copy. Do not tell them it is already
copied.`

Writing without a press (direction B) is possible only in Chromium with
the conversation focused. It would overwrite whatever the person had
copied, without asking, so the recommendation keeps the press everywhere.
See question 1 in result.md.

### pbpaste

`pbpaste` asks for the person's clipboard and blocks until there is an
answer:

1. **Conversation context**: a request card in the conversation. The
   header and the rail say *Odottaa sinua*, as with a native question, so
   the existing attention and sound paths apply. The card has *Liitä
   leikepöydältä* (calls `readText` inside the press; Firefox and Safari
   then show their own Paste button, Chromium asks permission once) and
   accepts ⌘V/Ctrl+V while focused (paste event, works everywhere). After
   reading, the card shows the text, its size and a key warning if
   relevant, with *Anna agentille* and *Älä anna*. Only *Anna* sends it.
   Nothing is read before the first press, and nothing leaves before the
   second.
2. **Terminal**: the request shows on that terminal panel and the paste
   handler routes the next paste there instead of to the shell. This needs
   the daemon to set an `OPEN_HABITAT_TERMINAL_ID` in the panel's shell
   environment.
3. **Taskfleet worker, cron, SSH without Habitat**: exit 3 at once. An
   unattended worker should not hold a turn for a person who may not be
   watching. It asks in its report instead.

Several devices: the request belongs to the conversation, so every open
tab shows it. The first device to give or refuse resolves it, and the
others show *Annettu toisella laitteella*. A copy card is pressed per
device, since every device has its own clipboard.

Without an open browser: the request waits (default `--timeout 10m`,
maximum 60 min). The person sees it when they open the conversation. On
expiry the card becomes a line *Pyyntö vanheni*, and the command exits 4.
The attention signal is the existing one for a waiting turn. No new
push channel is added.

What reaches the agent is exactly the text on stdout, with no added
newline. The text also enters the conversation's native history as the
tool result, so it is in Pi's session file like any other output. The card
says the text goes to the model provider.

### Exit codes and messages

Each message is one line on stderr. It names the code and tells the agent
what to do next.

| exit | code | when | message ends with |
|---|---|---|---|
| 0 | – | text on stdout (pbpaste) or offer recorded (pbcopy) | – |
| 1 | `clipboard_declined` | the person pressed *Älä anna* | "do not ask again in this turn; ask them to paste what you need into the conversation" |
| 2 | `usage` | unknown flag, non-UTF-8 input | the accepted flags |
| 3 | `no_person` | no conversation, terminal or creator to ask | "nobody can answer here (unattended or outside Habitat); ask in your report" |
| 4 | `clipboard_timeout` | no answer before the timeout | "the person may be away; ask them to paste it into the conversation" |
| 5 | `clipboard_empty` | the clipboard had no text (image, file) | "ask them to attach it instead" |
| 6 | `too_large` | over the limit | the limit, and "offer a file with `open-habitat agent file offer`" |

Flags kept to what the macOS commands imply: none needed. `pbpaste
--timeout DURATION` and `--json` are the only additions. `--json` puts
`{text, bytes, lines}` or the error object on stdout, following the CLI
canon.

### Sizes

- `pbcopy`: up to 1 MiB of UTF-8, which matches the terminal's OSC 52
  decoder limit. The card shows the first lines, and the full text is
  copied.
- `pbpaste`: up to 256 KiB. Anything larger is refused in the card before
  it is sent (*Liian pitkä, anna se tiedostona*) and gives exit 6. A
  model's context is the real limit, and a file attachment is the honest
  route for logs.

### No xclip, xsel or wl-copy aliases

Scripts that call `xclip -selection clipboard -o` or `wl-paste -n` pass
flags whose meanings we would have to emulate partially. A partial
emulation fails in surprising ways, while a missing command fails
honestly. `agent-bin` is last on PATH, so an `apt install xclip` would
shadow the alias with a real xclip that fails for lack of a display. The
agent guide in the launch context (`launchContext` in `pi_rpc_linux.go`)
instead says: "The person's clipboard is reached with `pbcopy` and
`pbpaste`; there is no X or Wayland clipboard." Revisit if agents keep
reaching for the Linux names.

### Authority

No authority moves. The daemon records the offer or request in the
conversation journal, as it does for notices, and holds the waiting CLI
call. The browser answers through a new command in `contracts/v1/`,
checked against the conversation and the request id, like a question
answer. The gateway only relays. The clipboard text never touches the
gateway's own state. This is a new wire command, so implementation starts
in the schema.
