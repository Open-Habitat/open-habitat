# Palvelinselain: ohjaus ja leikepöytä

## Saatesanat

Kolme suuntaa näyttävät saman kirjautumisnäkymän. **Suosittelen Omaa vuoroa:**
klikkaus ottaa ohjauksen, Valmis-painike palauttaa sen. Ensimmäinen klikkaus ei
vielä paina sivun painiketta. Näppäimistöllä ensimmäinen merkki ottaa ohjauksen
mutta ei päädy sivulle. Kesken olevan agenttitoiminnon kohdalla näkymä kertoo,
että jo lähetetty toiminto voi vielä muuttaa sivua, ja odottaa sen valmistumista.

Tauko-suunnassa kahden minuutin hiljaisuus ehdottaa palautusta. Se ei anna
ohjausta itsestään: käyttäjä voi olla lukemassa kirjautumisohjetta tai hakemassa
vahvistuskoodia. Pyyntö-suunnassa agentin seuraava askel ja jatkolupa näkyvät
omassa sivupaneelissa. Kaikissa paluu on käyttäjän päätös.

Leikepöydälle on tavallinen liittäminen kuvaan, avattava tekstikenttä sekä
Kirjoita tekstinä -varatie. Kopiointi etäsivulta ei saa yllättäen korvata oman
koneen leikepöytää: etäkopion saapuminen ja siirto omalle koneelle erotetaan.
Jos selain estää siirron, teksti jää valittavaksi käsin.

Tämä on toimiva **käyttöliittymäsimulaatio**, ei korjaus palvelinselaimeen.
Salasanakenttä ja kirjautuminen ovat pois käytöstä. Älä kokeile oikeilla tunnuksilla.

## Directions and recommendation

The comparison axis is the return of control, not three competing clipboard
implementations. All three share the same content and clipboard model.

| Direction | Default-view difference | Decision |
| --- | --- | --- |
| Oma / Yours | Ownership strip and explicit Done button | Recommended: quiet, predictable handoff |
| Tauko / Pause | Separate inactivity-policy strip | Offer a return after two idle minutes; never auto-resume |
| Pyyntö / Request | Agent next-step panel beside the page | Ask for continuation in context; person approves |

Source: `design-system/prototypes/rounds/2026-11-22-server-browser-control/`.
Built page: `/var/tmp/agent-keep/server-browser-control-clipboard/prototype.html`.
Synthetic visual evidence: `/var/tmp/agent-keep/server-browser-control-clipboard/screenshots/`.
These local artifacts are not published or tracked.

## Questions for Jari

1. Hyväksytäänkö Oma vuoro: klikkaus ottaa ohjauksen, vain Valmis palauttaa sen?
2. Saako ensimmäinen klikkaus vain ottaa ohjauksen, jotta sivun painike ei
   käynnisty vahingossa? Sama koskee ensimmäistä näppäintä.
3. Riittääkö etäkopion jälkeen näkyvä Kopioi omalle koneelle -painike, jos
   selaimen lupasäännöt estävät yhden näppäinyhdistelmän kopioinnin?
4. Hyväksytäänkö turvarajaus: agentille ei tehdä leikepöydän lukutoimintoa,
   mutta samaa selainta ja Unix-käyttäjää käyttävältä agentilta ei luvata
   salasanan tai kirjautuneen istunnon eristystä?

## Decisions for later review

- **No automatic return**, including loss of focus, tab close or disconnection.
  Alternatives were a timer and agent-initiated takeover. Neither proves the
  person has finished. Direction 2 is deliberately a suggestion, not a countdown
  that resumes work. Two minutes is a reviewable example, advanced by a scenario
  button in the prototype, not a running timer.
- **Consume the takeover click/key.** Replaying it after an asynchronous grant
  can target a changed page. The cost is one extra click once per takeover.
- **Do not replay old agent inputs after human interaction.** Re-observe and
  re-plan instead. This differs from current host buffering and needs explicit
  implementation design; the prototype models the proposed outcome only.
- **Text only initially; propose a 64 KiB UTF-8 limit.** Reject larger or non-text
  payloads visibly rather than silently truncating. Files and rich content need
  separate scope. The prototype exercises text routing, not this transport limit.
- **Explicit clipboard transfer, no continuous synchronization.** A remote site
  must not silently overwrite the person's clipboard. Clear transient paste UI
  and remote-copy UI on handoff. Clearing is hygiene, not secure erasure.
- **Keep the shared-session trust model.** Do not expose clipboard contents as
  agent observations or logs. Isolation from a hostile same-UID process would
  require a separately approved security design, not a clipboard toggle.

## Architecture sketch (English; proposed, not approved implementation)

### What exists at the inspected revision

Inspected base: `763d97b7`. `web/src/app/BrowserViewer.tsx` constructs noVNC,
sets `viewOnly`, focuses on a grant, and handles connection state. It registers
no clipboard listener and does not call `clipboardPasteFrom`. `ServerBrowser.tsx`
derives control from host status and wires explicit take/give-back callbacks.

`internal/daemon/browser_linux.go` starts the browser host through a transient
`systemd-run --user --collect` unit when supported (with a child-process fallback),
and relays authenticated viewer WebSocket traffic to the private VNC Unix socket.
The relay does not parse RFB. `internal/browserhost/host_linux.go` owns Xtigervnc
and Chrome; VNC listens on a mode-0600 Unix socket, not a TCP port. This round
does not change those paths, gateways or Unix-user boundaries.

`internal/browserhost/cdp_linux.go` owns the CDP mux. `fromAgent` holds new
commands while the person has control. `setControl(false)` currently forwards
held commands in order. Already forwarded commands can still complete; taking
control is not an undo operation. `pending` records protocol requests, not a
semantic transaction such as “sign in”. A reliable “mid-action” signal cannot
be invented from a spinner or a quiet framebuffer. The present hold/replay model
is important context for the proposed re-observation policy above.

### Clipboard transport

Use noVNC's existing RFB channel, not a second clipboard service. Its public API
has `clipboardPasteFrom(text)` for client-to-server text and a `clipboard` event
carrying received text. Calling the paste API updates the remote clipboard;
it is not itself a paste keystroke into the focused Chrome field. Coordinate
clipboard update and a remote paste command under the same control grant, and
verify ordering with the pinned versions before promising immediate paste. [1]

Base RFB ClientCutText/ServerCutText uses Latin-1. The negotiated Extended
Clipboard messages provide UTF-8 text support. Test negotiation rather than
assuming Finnish, emoji or non-Latin text survives; visibly refuse unsupported
text rather than corrupting it. TigerVNC's implementation advertises UTF-8
clipboard capability. The deployed build's X clipboard integration still needs
a real-browser qualification; a protocol capability alone proves no Chrome
paste behavior. [2, 3]

In the local viewer, handle a **trusted paste event** on the focused surface
and consume `clipboardData` plain text. Stop noVNC from also forwarding Ctrl+V,
which could paste an old remote value before the new one arrives. Avoid reading
the clipboard on focus, reconnect or ordinary canvas clicks. An explicit paste
button can try `navigator.clipboard.readText()` in a secure, focused context,
but must tolerate permission or activation refusal. The Clipboard specification
allows UA-specific permission policy; browser behavior must be qualified rather
than treated as one universal grant. The explicit paste textarea lets the person
use the browser's native Paste action without a background read. [4]

For remote-to-local copy, receive the remote text into a short-lived buffer.
Offer “Copy to your computer”, invoking `writeText()` in that new local gesture.
A remote copy reply may arrive after the originating key gesture is gone, so
one-key copy cannot be the only route. On denial, keep a readonly selectable
text field and a manual-copy instruction; never announce success until the write
resolves. Do not render received text as HTML. [1, 4]

For “Type this text”, prefer a bounded host-owned CDP `Input.insertText` operation
against the currently selected target and acknowledged person-control generation,
not keyboard-layout-dependent keycodes. Do not append Enter or submit the form.
It avoids the X clipboard but does not hide content from the page, its scripts,
or same-user automation. CDP documents this method specifically as inserting
text rather than synthesizing a key press. Target identity and focus must be
revalidated; report failure instead of sending to another window. [5]

### Control and daemon work needed

The gateway still only authenticates/routes the person; the per-user browser
host remains the owner of Chrome and control arbitration. Proposed additions:

1. A host-authoritative control generation and a takeover-pending state. Fence
   new agent commands before reporting a grant. Expose bounded, non-secret
   pending-work metadata, not command arguments or clipboard text.
2. Distinguish “new commands held” from “already sent work settled”. A sent
   navigation, script or network request cannot generally be rolled back. If a
   completion deadline expires, retain the waiting state and offer cancellation,
   not a false all-clear. The prototype's completion button is a fixture event.
3. Settle outstanding automation promises when human input invalidates them.
   Prefer a recognizable “interrupted by person; re-observe” result instead of
   silently replaying held clicks on a changed page. Integration with the actual
   agent CDP client needs a spike: a transport command is not a whole agent action,
   and rejected calls must not become an endless retry loop.
4. Bind input/text requests to the owning viewer, target, connection and control
   generation. Prevent a late grant, reconnect or second viewer from applying
   stale input. Release pressed modifiers/buttons at transition boundaries.
   Keep control with the person on connection loss; a reconnect re-reads status.
5. Keep RFB clipboard transport in the existing per-user channel. Basic transfer
   requires viewer wiring and real TigerVNC qualification, not a new daemon
   clipboard database. The proposed generation-bound text insertion and pending
   status do need host/daemon commands and contract schemas first. If hard input
   fencing is promised, design how it covers RFB too: changing only CDP state
   cannot establish a viewer-input guarantee across a raw byte relay.
6. Bound text lengths, rates and lifetime; clear local draft/remote buffers on
   transfer, handoff and close. Best-effort clear the remote clipboard after
   confirmed paste, not before Chrome consumed it. Never log payloads in tool
   receipts, errors, tracing or screenshots. Keep metadata-only outcome reporting.

An agent request is a request only, not authority. Idle timers are presentation
prompts. No browser client claim can grant itself host authority. A semantic
“safe to continue” guarantee requires more than counting pending CDP replies.
These are recommendations for an approved implementation issue, not authority
changes in this prototype commit.

### Passwords and shared-agent access

Recommend **no agent clipboard-read API and no clipboard contents in the model
context**. Transfer only following a deliberate user action; do not keep a
clipboard history. Show a concise shared-browser notice, especially on sign-in.

Do not label this “private paste”. The agent and browser run under the same Unix
user, and the agent later uses the authenticated page. A password may remain in
a DOM field, process memory, application clipboard or site script regardless of
whether the X clipboard was used. Clearing the clipboard reduces accidental
reuse; it does not establish a security boundary or erase every copy. Preventing
that access would require isolation of the agent/browser/credentials and an
explicitly different product capability. This round recommends neither such a
new boundary nor a promise the present architecture cannot keep.

### Primary references (checked 2026-11-22)

1. noVNC public API, clipboard event and clipboardPasteFrom:
   `https://github.com/novnc/noVNC/blob/master/docs/API.md`
2. Community RFB protocol, ClientCutText/ServerCutText and Extended Clipboard:
   `https://github.com/rfbproto/rfbproto/blob/master/rfbproto.rst`
3. TigerVNC CConnection clipboard capability/transfer implementation:
   `https://github.com/TigerVNC/tigervnc/blob/master/common/rfb/CConnection.cxx`
4. W3C Clipboard API and events, paste action, async clipboard and permissions:
   `https://www.w3.org/TR/clipboard-apis/`
5. Chrome DevTools Protocol, Input.insertText:
   `https://chromedevtools.github.io/devtools-protocol/tot/Input/#method-insertText`

### Validation and limits

- Built offline with the round's `build.mjs`; no external network requests during
  the check. Shared `picker-check.mjs` passed.
- `check.mjs` passed all 24 FI/EN × light/dark × desktop/phone × direction
  combinations, with clean page/console logs. Tests exercise mouse/keyboard
  takeover, warning/completion, paste routing, field fallback, typing fallback,
  copy denial/success, no idle takeover and no request takeover.
- Inspected desktop FI/light and phone EN/dark screenshots. They are synthetic
  form illustrations, not captures of any installation. Output directory above
  retains the 24 default-view screenshots.
- The first check found a wrapping picker label on phone; shortened the label
  and reran the full round check successfully.
- Review level: focused self-review plus interaction assertions and visual
  inspection. No production sessions, state, contract or authorization code
  changes, so an independent boundary review is not required for this round.
- Production baseline inspected in source and in the synthetic lab, using its
  fake browser host. Opened the viewer, took control through its existing button,
  and captured both states (`baseline.png`/`baseline.html` and
  `baseline-person.png`/`baseline-person.html` beside the built prototype).
  This confirmed the present ownership strip and return button. The fake host
  does not display a real Chrome page; it cannot qualify real clipboard behavior.
- Real VNC clipboard negotiation, real OS clipboard permissions, Safari/Firefox,
  touch keyboard behavior and deployed browser operation are **not qualified** by
  this prototype. Native Xtigervnc/Chrome were not available at the expected
  system paths, and no browser profile was installed; the real-browser lab
  journey was not run. This is not a production-fidelity or live-fix claim.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json` and
  `git diff --check` passed. The doctor reported no findings. Prototype build
  and check were run under a shared scratch lease with bounded timeouts; lab
  startup/build and capture likewise, under umask 077. No full product suite
  was run for this prototype-only change.
- No deployment or test-server change. Acceptance and the security/trust wording
  remain for review before implementation.
