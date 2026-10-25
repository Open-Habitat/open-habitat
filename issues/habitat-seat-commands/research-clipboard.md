# Clipboard from a Habitat agent without a native client

## Suomeksi lyhyesti

Kyllä onnistuu, ilman natiiviasiakasta, mutta vain napin kautta. Selain antaa
sivun kirjoittaa leikepöydälle vain, kun ihminen on juuri painanut jotain sivulla
ja sivu on etualalla. Chromium sallii sen aktiiviselle välilehdelle, Firefox ja
Safari vain painalluksen yhteydessä. Agentti ei siis voi itse laittaa mitään
leikepöydälle. Se voi tarjota tekstin, ja Habitat näyttää kortin, jossa on
Kopioi-nappi. Painallus kopioi tekstin. Jos selain kieltäytyy, kortti näyttää
tekstin valittuna, ja ihminen kopioi sen itse (Ctrl+C).

Salaisuuksia (tokeneita) varten teksti ei saa päätyä Pi-historiaan, lokeihin
eikä daemonin tapahtumajonoon, joka toistetaan uudelleen yhdistäville
välilehdille. Suosittelen, että daemon pitää tekstin vain muistissa lyhyen ajan
(esim. 10 min). Tapahtuma kertoo selaimelle vain, että tarjous on olemassa,
ja sen otsikon ja pituuden. Teksti haetaan vasta Kopioi-painalluksella, ja
tarjous vanhenee. Tätä en toteuttanut tässä ajossa, koska se tarvitsee uuden
muistinvaraisen salaisuusvaraston ja uuden selainreitin. Ehdotan sille omaa
issueta (alla).

## What the browsers require (October 2026)

All three engines expose `navigator.clipboard.writeText` and
`navigator.clipboard.write` only in a secure context (Habitat is HTTPS). Reading
is a separate, stricter permission and is not needed here.

| | Chromium (Chrome, Edge, Brave) | Firefox | Safari / WebKit |
|---|---|---|---|
| Write gate | `clipboard-write` permission **or** transient user activation; the permission is granted automatically to the active tab | transient user activation, every write | user gesture, every write; outside one the promise rejects at once |
| Focus | document must be focused (`NotAllowedError: Document is not focused`) | page must be active | page must be active |
| Async work before the write | works only while activation lasts (about 5 s); safer to call `write` synchronously | same, activation expires (about 5 s) | must be in the gesture; data may arrive later as a `Promise` inside a `ClipboardItem` |
| Permissions API | `clipboard-write` / `clipboard-read` supported | not supported, not planned | not supported, not planned |
| In an iframe | needs `allow="clipboard-write"` (Permissions-Policy) | — | — |

Consequences for Habitat:

- **The agent can never write the clipboard by itself.** The daemon runs on the
  server, and the person's browser writes only when the person presses something
  on the page that is in front of them. Chromium's background write allowance for
  the active tab is not a route Habitat should rely on. An unprompted write while
  the person is typing elsewhere in the page would surprise them even when it
  works, and Firefox and Safari refuse it.
- **A Copy button on a card, run by the trusted app in its own click handler,
  works in all three.** The app origin is top level, not framed, so no
  Permissions-Policy is involved. The view origin's sandboxed frames (ADR 0032)
  must never get clipboard access: agent HTML would otherwise copy on any click.
- **The text should be in hand at the click, or the write should be started
  synchronously.** The portable pattern is
  `navigator.clipboard.write([new ClipboardItem({"text/plain": promise})])`
  called synchronously in the handler, with the promise resolving to the fetched
  text. Safari accepts this, and current Chromium and Firefox do too.
  `writeText(await fetch…)` works in Chromium and Firefox within the activation
  window but fails in Safari.
- **The fallback is manual selection.** If the write rejects (old browser, focus
  lost, policy), the card shows the text in a read-only field, selected, and says
  "press Ctrl+C / ⌘C". `document.execCommand("copy")` is deprecated and not
  worth adding.
- **Phones:** the same rules hold in mobile Safari and Chrome; the button is the
  gesture.

Habitat already writes the clipboard this way from its own UI: `BashToolCard`,
`OutputBox`, `FileToolCard`, `WorkspaceActions`, `PiDeviceSignIn`,
`ServerIntegrations` and the terminal all call `navigator.clipboard.writeText` in
a click handler. An agent clipboard offer adds no new browser capability. What it
adds is a new source of the copied text and a secrecy requirement.

## Is it a new authority?

No new authority over the person's machine. The agent runs as the person. Its
text already reaches the browser as conversation output, which the person can
select and copy, and its commands already get Copy buttons on tool cards. An
offer card with Copy is the same act with an explicit label, and it never
happens without the press. The pastejacking concern (the person pastes something
into their own terminal that they did not read) applies equally to copying a
command from a tool card. The card mitigates it by labelling what the text is
for and offering "Näytä" before copying. It should never auto-copy.

The real decision is about **secrecy, not authority**. `tw clipboard copy -` is
used to hand over a token without echoing it. Habitat must therefore not place
the text where the product keeps things:

- not in Pi's native history (a conversation notice is persisted there, so the
  text cannot ride on a notice as the editor and view offers do);
- not in the daemon's event journal frames, an in-memory ring replayed to any
  reconnecting tab of the person for as long as the frame stays in the ring;
- not in the CLI reply, in daemon or gateway logs, or in argv (stdin or a file
  only, as other agent credentials already enter);
- not in browser storage; React state only, dropped on reload.

## Recommended design (proposed, not built)

1. `open-habitat agent clipboard offer --text-file - --label "GitHub-token"
   [--current|--conversation pi:UUID] --idempotency-key UUID [--ttl 10m]`. The
   text comes from stdin or a 0600 file, at most 64 KiB, valid UTF-8. The reply
   carries `offer_id`, label, byte count and expiry, never the text.
2. The daemon keeps the text **in memory only**, keyed by an unguessable
   `offer_id`, until it expires (default 10 min, at most 1 h), is copied once
   (single-use by default, `--reusable` for non-secrets), is withdrawn
   (`agent clipboard withdraw`), or the daemon restarts. This store is
   deliberately not persisted.
3. A `clipboard.offered` user event (or a notice without the text when a
   conversation is named) carries only `offer_id`, label, length, `expires_at`
   and an optional conversation. The browser shows a card: label, "Kopioi",
   "Näytä", dismiss.
4. On "Kopioi" the app calls `navigator.clipboard.write` synchronously with a
   `ClipboardItem` whose promise is a `POST /api/v1/clipboard/<offer_id>/take`
   (CSRF, same-origin, the gateway's ordinary per-request proxy to the person's
   own daemon). The daemon returns the text once and marks it taken. On rejection
   the card falls back to the selected read-only field using the text it already
   received. The card then says "Kopioitu" or "Kopioi itse". The agent can learn
   only `taken`, never what happened on the device.
5. Logging: the take route is not logged per request, like the editor relay and
   view export. Responses are `no-store`.

What it costs: one in-memory map in the daemon, one agent route, one browser
route through the existing gateway proxy, one event kind, a card, and tests
(expiry, single use, no text in journal frames, history or replies, Safari-style
promise write, fallback). This is about the size of the editor offer, but it
needs the secrecy decisions above confirmed. That is why it was not built in
this run.

## Sources

- MDN, Clipboard API, security considerations (per-browser rules, permissions,
  iframes): https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API
- WebKit, "Async Clipboard API" (gesture requirement, `ClipboardItem` promises):
  https://webkit.org/blog/10855/async-clipboard-api/
- web.dev, "Unblocking clipboard access" (Chromium's active-tab grant):
  https://web.dev/articles/async-clipboard
- W3C, Clipboard API and events (`clipboard-write` and user activation):
  https://www.w3.org/TR/clipboard-apis/
- "The await that silently breaks writeText" (activation expiry after async
  work): https://dev.to/parsajiravand/the-await-that-silently-breaks-navigatorclipboardwritetext-10oe
