# Palvelinselain: ohjaus kuvaa klikkaamalla ja leikepöytä

## Saatesanat

Tein kierroksen uudelleen tyhjästä. Kolme suuntaa näyttävät saman
kirjautumisnäkymän. Käytös on kaikissa sama, ja vain vuoron ja leikepöydän
paikka kuvan ympärillä vaihtuu.

**Suosittelen Palkkia (2).** Nykyinen vuoronauha Valmis-painikkeineen pysyy
yläreunassa, ja agentin pyyntö luetaan siitä. Kuvan alle tulee leikepöytäpalkki
(Liitä…, Kopioi valinta, etäkopio). Kehys (1) säästää tilaa, mutta liittökenttä
jää piiloon juuri silloin, kun pikanäppäin ei toimi. Paneeli (3) vie työpöydällä
kuvalta 320 px leveyttä, ja puhelimessa sen sisältö on kuvan alla
joka tapauksessa.

Ohjaus siirtyy, kun klikkaat kuvaa tai alat kirjoittaa. Jos agentti odottaa,
sama klikkaus tai näppäin menee myös sivulle, joten yksi klikkaus riittää.
Jos agentti on kesken, klikkaus ei mene sivulle vaan kysyy: *Ota ohjaus nyt* /
*Ota, kun se on valmis* / *Peru*. Valmis palauttaa ohjauksen. Kolmen minuutin
tauon jälkeen ohjaus palautuu itsestään vain, jos agentti ei ole pyytänyt sinua.
Kirjautumisen aikana ehdit siis hakea koodin puhelimesta rauhassa.

Liittäminen ⌘/Ctrl+V:llä ei nykyään toimi, koska katselin ei käsittele
leikepöytää lainkaan. Painallus menee etäkoneelle tavallisena näppäilynä ja
liittää etäkoneen tyhjän leikepöydän. Korjaus mahtuu pääosin katselimeen.
Kopiointi etäsivulta ⌘/Ctrl+C:llä menee suoraan koneellesi, kun selain sallii.
Muuten näkyviin tulee *Kopioi koneellesi* -painike. Selaimille, jotka eivät anna
liittää suoraan, on liittökenttä ja *Kirjoita näppäilyinä*. Jälkimmäinen toimii
myös sivuilla, jotka estävät liittämisen.

Rakennettu sivu: `/var/tmp/agent-keep/server-browser-control-clipboard/prototype.html`.
Se on toimiva simulaatio keksityllä sivulla, ei korjaus palvelinselaimeen. Älä
kirjoita siihen oikeita tunnuksia.

## Directions and recommendation

Axis: where turn and clipboard live around the canvas. Content and behaviour
are identical in all three.

| # | Direction | Default view | Decision |
| - | --------- | ------------ | -------- |
| 1 | Kehys / Frame | Canvas border is the state (solid accent = you, dashed = agent); turn + Done on a tab, Clipboard tab opens a popover | Least chrome; the fallback is hidden exactly when the shortcut fails |
| 2 | Palkki / Bar | Production band on top (turn, agent's words, Done); clipboard bar under the canvas | **Recommended**: smallest change to production, discoverable on desktop and phone |
| 3 | Paneeli / Panel | Side panel: turn card, always-open paste field, remote copy | Most explicit; costs canvas width on desktop |

Round source: `design-system/prototypes/rounds/2026-11-22-browser-control-clipboard/`
(`NOTES.md` has the build and check commands). Built page:
`/var/tmp/agent-keep/server-browser-control-clipboard/prototype.html`.
Check screenshots (36 default views and 36 mid-step warnings):
`/var/tmp/agent-keep/server-browser-control-clipboard/check/`. Neither is
tracked.

## Questions for Jari

1. Palkki (2) suunnaksi? Vai jokin muu, tai Palkki Kehyksen reunavärillä?
2. Saako odottavan agentin kohdalla ensimmäinen klikkaus mennä suoraan sivulle
   (yksi klikkaus)? Vaihtoehto on, että ensimmäinen klikkaus vain ottaa
   ohjauksen, mikä on turvallisempaa mutta vaatii joka kerta ylimääräisen
   klikkauksen. Kesken olevan agentin kohdalla klikkaus ei koskaan mene sivulle.
3. Kelpaako automaattinen palautus kolmen minuutin tauon jälkeen, kun agentti
   ei odota sinua? Vai pelkkä Valmis-painike?
4. **Turvallisuus:** suosittelen, että agentille ei anneta leikepöydän
   lukutyökalua. Host estäisi CDP:n leikepöytäoikeuksien myöntämisen, ja
   etäkoneen leikepöytä tyhjennettäisiin, kun annat ohjauksen takaisin.
   Saman Unix-käyttäjän agentti voi silti teknisesti lukea X-leikepöydän tai
   sivun kentän, joten tämä on hygieniaa eikä eristys. Salasanoille suositan
   *Kirjoita näppäilyinä*, joka ei käy leikepöydän kautta lainkaan. Hyväksytkö
   tämän tason?

## Decisions for later review

- **Idle agent: the takeover click/key is delivered.** Alternative: consume it
  (an extra click every time). Delivering is what "clicking takes control"
  means. It is safe only because nothing moves while the agent is idle. The
  viewer buffers the input until the grant returns, then replays it.
- **Busy agent: the click is consumed and asks first.** Alternatives: take
  control silently, or refuse. A click aimed at a page that is changing under
  the agent can land on the wrong thing. "Take when done" covers the common
  case of a step that is about to end.
- **Auto-return after 3 idle minutes, only without an open agent request.**
  Alternatives: never (the discarded round's choice), or always. A person who
  took control uninvited and walked away blocks the agent forever. A person
  answering a request is probably fetching a code. The prototype counts down
  from 0:30 to show what the end of those 3 minutes looks like.
- **Paste confirmation shows a character count, never the text.** A pasted
  password must not be echoed on screen.
- **Remote → local is explicit and per copy.** There is no continuous sync:
  a remote site must not overwrite the person's clipboard on its own. Copying
  is automatic only when the remote copy follows the person's own ⌘/Ctrl+C.
- **Text only, plain text.** Files and rich formats are out of scope.
- **Newlines in the paste field become spaces** in the prototype (single-line
  fields). A real implementation should keep newlines for remote textareas,
  and "type as keystrokes" must warn that Enter may submit a form.
- **Phone shows the same paste field.** It is also the phone's practical text
  input: the canvas cannot raise a soft keyboard. The prototype's
  "⌘/Ctrl+V" hint text should change on touch devices.

## Architecture sketch (English; proposed, nothing here is implemented)

### What exists at `242e26cc`

- `web/src/app/BrowserViewer.tsx` creates noVNC 1.7.0 `RFB` on the gateway's
  WebSocket and toggles `viewOnly` from the host's `control`. It registers no
  `clipboard` listener and never calls `clipboardPasteFrom`.
- noVNC's keyboard handler (`core/input/keyboard.js`) calls `stopEvent` on
  keydown, so **⌘/Ctrl+V never becomes a browser `paste` event**. It is sent to
  Xvnc as a keystroke, and Chrome pastes whatever the remote X CLIPBOARD holds
  (usually nothing). This is the observed bug.
- noVNC ignores both directions while `viewOnly`: `clipboardPasteFrom` returns
  early, and incoming ServerCutText and extended-clipboard messages are dropped.
  So clipboard traffic is naturally bound to having control.
- `internal/browserhost/host_linux.go` starts Xvnc with no clipboard flags,
  i.e. TigerVNC defaults: `AcceptCutText`, `SendCutText`, `SetPrimary` and
  **`SendPrimary` on**. With `SendPrimary`, every remote *selection*, not only
  an explicit copy, is pushed to a connected viewer.
- `internal/browserhost/cdp_linux.go`: while the person has control, agent
  commands are **held**; `setControl(false)` **replays** them in order. The mux
  forwards CDP methods without filtering. The status carries `agent_connected`
  (an operation holds the agent connection) and `pointer` with recent click ages.
- The X cookie lives in the browser host's directory, readable by the person's
  UID. Any process of that UID, the agent included, can read X selections.

### Taking control from the canvas (viewer + existing route)

1. While `viewOnly`, the viewer listens for `pointerdown` and `keydown` on the
   canvas container in the capture phase, ahead of noVNC.
2. If the host status shows the agent mid-operation, the viewer swallows the
   event and shows the warning. Mid-operation means `agent_connected`, or a
   pointer click younger than about 2 s. *Take now* posts
   `control: person`. *Take when done* posts it when `agent_connected` turns
   false.
3. Otherwise the viewer posts `control: person` at once. It buffers that
   pointer or key event (max one click, or a few keys within 1 s), and after the
   grant sets `viewOnly = false` and replays the buffer into noVNC. If the grant
   fails, the buffer is dropped.
4. The honest limit: the host knows about one CLI operation, not the agent's
   plan. Between two steps of a sequence the agent looks idle. The warning is
   "the agent is in the middle of a command", not "of a task".
5. **Held commands should not be replayed.** On give-back, the host fails the
   held commands with a recognisable "person took control" error, so the CLI
   re-inspects the page as the skill already instructs after a timeout.
   Replaying clicks on a page the person has changed is the risky part of
   today's design. This is a `browserhost` behaviour change (no authority
   move), and it needs its own issue and a test in `cdp_linux_test.go`.
6. Auto-return: the viewer tracks the last input. After 3 min with no
   `request` open, it shows the countdown and then posts `control: agent`.
   Closing the sheet keeps control with the person, as today. A lost
   connection never returns control. The host could enforce a ceiling
   independently, but that is not needed for the first version.

### Clipboard: local → remote (paste)

- **Shortcut.** In the capture-phase keydown, ⌘V or Ctrl+V is not passed to
  noVNC and its default is *not* prevented, so the browser fires a trusted
  `paste` event on the focused canvas. Its `clipboardData` gives the text
  without any permission prompt in Chrome, Firefox and Safari, because a
  user-initiated paste is the one path every engine allows. The viewer then
  calls `rfb.clipboardPasteFrom(text)` and sends a remote **Ctrl+V** via
  `rfb.sendKey`. ⌘ is mapped to Ctrl because the remote is Linux Chrome.
  ⌘C, ⌘X and ⌘A need the same mapping.
- **Ordering.** With TigerVNC's extended clipboard (negotiated by noVNC 1.7),
  the client sends *notify*. Xvnc takes ownership of CLIPBOARD and requests the
  data lazily when Chrome asks, so a remote Ctrl+V sent right after the notify
  should get the new text. *To qualify on a real host*, including non-Latin-1
  text (UTF-8 only exists in the extended protocol).
- **Button / field.** "Paste…" opens a plain textarea where the person uses the
  native paste. No `navigator.clipboard.readText()` is needed. That API needs
  a permission prompt (Chrome) or a paste callout (Firefox, Safari) and is not
  worth the friction. Sending uses the same `clipboardPasteFrom` + Ctrl+V path.
- **Type as keystrokes.** The viewer sends each character as keysym down/up via
  `rfb.sendKey`. Xvnc maps unknown keysyms dynamically, so ä, ö and € work.
  This avoids the remote clipboard entirely, works where sites block paste,
  and is the recommended route for passwords. Cap it (e.g. 1,000 characters).
  Map newlines to Enter only after a warning.
- **Limits.** Plain text only, a size cap (e.g. 64 KiB), never logged. The
  viewer clears its field after sending.

### Clipboard: remote → local (copy)

- Set Xvnc `-SendPrimary=0`. Only an explicit copy (CLIPBOARD) should leave
  the remote machine, not every selection.
- The viewer listens for noVNC's `clipboard` event, which arrives only while
  the person has control. If it arrives within about 2 s of the person's own
  ⌘/Ctrl+C or the "Copy selection" button (which sends a remote Ctrl+C), the
  viewer calls `navigator.clipboard.writeText()` straight away. The transient
  user activation from that press normally still holds in Chrome and Firefox.
  Otherwise, or if the write is refused (Safari), it shows "Copy to your
  computer", whose click is a fresh gesture. If even that fails, the text is
  shown selectable.
- A remote clipboard change that the person did not start (a site writing to
  the clipboard by itself) is not offered at all.

### Security: should the agent see what the person pasted?

**Recommendation: no.** The agent gets no clipboard tool and no clipboard
contents in its context, and the clipboard is cleared when control returns:

1. When the person gives back, the viewer calls `clipboardPasteFrom("")`
   (still in control, so noVNC sends it). Xvnc then owns an empty CLIPBOARD.
   If the person pasted, the toast says the remote clipboard was cleared.
2. The CDP mux refuses `Browser.grantPermissions`, `Browser.setPermission`
   for `clipboard-read`/`clipboardReadWrite`, and `Browser.resetPermissions`
   from the agent. That stops the obvious CDP route: grant permission, then
   `navigator.clipboard.readText()` in a page. It is a small, testable filter
   inside `browserhost`, where the mux already routes by method.
3. The skill (`internal/daemon/browser-skill/SKILL.md`) says not to read or
   use the clipboard.
4. Keep `SendPrimary=0` so remote selections do not flow to the viewer.

What this does **not** give, and the UI must not claim: isolation. The agent
runs as the same Unix user. It can read the X cookie and the selection with
any X client, read a password field's value over CDP after control returns,
or read Chrome's profile. While the person holds control, the agent's CDP
commands are held, so it can do nothing in the browser during the sign-in.
The clipboard was the one copy that outlived the sign-in, and clearing it
closes that. That is why the prototype only says "pasted text goes only to the
page; the remote clipboard is cleared when you give control back", next to
the existing truth line. Real isolation of credentials from the agent would
need a different UID or browser and is a separate architecture decision, not
part of this issue.

### What the daemon and host need

| Change | Where | Contract |
| --- | --- | --- |
| Capture-phase takeover, input buffer, ⌘→Ctrl mapping, paste event → `clipboardPasteFrom` + Ctrl+V, `clipboard` event → `writeText`/button, type-as-keystrokes, idle return | `web/src/app/BrowserViewer.tsx`, `ServerBrowser.tsx`, components and texts | none |
| Mid-operation warning | viewer, from existing `agent_connected` + `pointer` | none |
| `-SendPrimary=0` | `internal/browserhost/host_linux.go` Xvnc args | none |
| Fail held commands instead of replaying on give-back | `internal/browserhost/cdp_linux.go` `setControl` | none (CLI error text) |
| Refuse clipboard permission grants from the agent | `cdp_linux.go` `fromAgent` | none |
| Skill sentence on clipboard | `internal/daemon/browser-skill/SKILL.md` | none |

No new daemon route, store or authority. Clipboard bytes stay in the existing
per-user RFB relay, which the daemon does not parse. A clipboard API in the
daemon would be a second path for the same bytes, with no benefit.

### Primary references

- noVNC API (`clipboardPasteFrom`, `clipboard` event, `sendKey`):
  `https://github.com/novnc/noVNC/blob/master/docs/API.md`, and the pinned
  1.7.0 source in `web/node_modules/@novnc/novnc/core/`.
- RFB protocol, ClientCutText/ServerCutText and the Extended Clipboard
  pseudo-encoding: `https://github.com/rfbproto/rfbproto/blob/master/rfbproto.rst`.
- TigerVNC Xvnc options (`AcceptCutText`, `SendCutText`, `SendPrimary`,
  `SetPrimary`): `man Xvnc`.
- W3C Clipboard API and events (paste event, `readText`/`writeText`,
  user activation): `https://www.w3.org/TR/clipboard-apis/`.

## Validation and limits

- Built offline with the round's `build.mjs`. `check.mjs` passed all 36
  combinations (3 directions × fi/en × light/dark/contrast × 1440/390 px). It
  exercised typing on the canvas (and that "1" does not switch direction),
  canvas paste, strict-browser paste field and keystrokes, remote copy
  (automatic and button), Done, takeover from a waiting agent by click and by
  key, all three mid-step choices including Escape, the agent's wish to
  continue, the idle countdown, the picker, containment, axe at 390 px light
  fi, a clean console and no network requests. The shared `picker-check.mjs`
  passed inside it.
- The first runs found and fixed: the Frame tabs covering the page header, a
  zero-width canvas on phone, overlapping tabs in English on phone, a clipboard
  popover covering the phone canvas, and a late async copy result leaking into
  the next scenario (now dropped by a generation counter). That last one is
  also a real-implementation note: a `clipboard` event must be ignored after
  control changes.
- Screenshots inspected: desktop fi light and dark, phone en dark, phone fi
  light, and the mid-step warning.
- **Not qualified:** real Xvnc/Chrome clipboard negotiation and ordering, real
  OS clipboard permissions in Safari/Firefox, touch keyboards. The synthetic lab
  has no real browser host. The facts about current behaviour come from reading
  the source at `242e26cc` and the pinned noVNC 1.7.0, not from a live run.
- Review: focused self-review. Only a prototype round and this issue file
  changed; no production code, contract, session, daemon state or
  authorization boundary did.
