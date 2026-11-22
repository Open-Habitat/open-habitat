# Result: paste and keystroke flow in the server browser (prototype round)

## Saatesanat

Kolme suuntaa sille, mitä ⌘V / Ctrl+V palvelinselaimen kuvassa tekee. Kaikissa
on toiveesi 2 ja 3: *Kirjoita näppäilyinä* palauttaa näppäimet sivulle (seuraava
Backspace menee sivulle, ja kuvan kulmassa lukee silloin *Näppäimet menevät
sivulle*), ja piilotetun kentän oikeassa reunassa on silmä.

**Suosittelen suuntaa 1, Kysyy.** ⌘V avaa Leikepöydän, jossa leikepöydän
teksti odottaa piilotettuna, ja mitään ei ole vielä lähetetty. Enter valitsee
*Kirjoita näppäilyinä*, joten tavallinen tapaus on ⌘V, Enter. Tottumus "⌘V
tekee jotain" säilyy, mutta valinta tehdään ennen kuin mitään lähtee.
Suunta 2 vaatii toisen ⌘V:n ja tuntuu ensin rikkinäiseltä. Suunnassa 3
salasana on jo käynyt etäkoneen leikepöydällä, kun vinkki näkyy, joten se ei
täytä toivettasi.

Ohje sanoo rehellisesti, että kummallakin tavalla teksti päätyy sivulle eikä
sitä piiloteta agentilta. Ero kerrotaan vain leikepöydissä: liittäminen käy
etäkoneen leikepöydän kautta (tyhjennetään palautuksessa), näppäilyt eivät,
ja suoraan kenttään kirjoitettu salasana ei jää omaankaan leikepöytähistoriaan.

Kokeile: klikkaa kuvan salasanakenttää, paina ⌘V, paina Enter ja sitten
Backspace. Prototyyppi ei lue oikeaa leikepöytääsi, vaan ⌘V käyttää otsakkeen
keksittyä tekstiä.

## Round

`design-system/prototypes/rounds/2026-11-22-browser-paste-flow/` (NOTES.md has
the details). Axis: what ⌘V / Ctrl+V on the picture does. Designed against the
end state of `server-browser-one-bar` and `server-browser-password-entry-notice`:
one top bar with the turn chip, the Leikepöytä popover, Valmis / Ota ohjaus,
Sulje selain and ×; the canvas border shows who controls.

1. **Kysyy / Ask (recommended):** popover opens with the clipboard text
   pre-filled and hidden; focus on *Kirjoita näppäilyinä* (primary), *Liitä
   sivulle* beside it. Nothing reaches the page until a choice.
2. **Ohjaa / Guide:** popover opens empty with guidance; focus in the field;
   a second ⌘V pastes into the local field only, or the person types.
3. **Vinkki / Hint:** paste goes through as today with a count-only notice that
   carries *Salasanan voit kirjoittaa näppäilyinä*, opening an empty field.

Shared: both send buttons, Escape and Sulje close the popover and return focus
to the picture (brief flash, *Näppäimet menevät sivulle* chip while the picture
has focus); hidden field with the eye / struck-through eye at its right edge
(`aria-pressed`, label *Näytä teksti* / *Piilota teksti*); after *Liitä sivulle*
the popover says how many characters the remote clipboard holds until Valmis
clears it; ⌘V on the picture takes control from a waiting agent first.

Built page (not committed):
`design-system/prototypes/dist/browser-paste-flow/offline.html`, from
`node design-system/prototypes/rounds/2026-11-22-browser-paste-flow/build.mjs`.
A copy and the check screenshots are in
`/var/tmp/agent-keep/server-browser-paste-flow/` (`offline.html`, `screens/`).

## What the view assumes from the host

Nothing new. It uses what the viewer already has: the turn, the remote
clipboard send and clear, keystroke typing, and the trusted `paste` event on
the canvas. For direction 1 the implementation keeps the paste event's text in
the popover instead of forwarding Ctrl+V to the remote; where no paste event
arrives (the existing 400 ms Safari fallback), the popover opens empty, which
is direction 2's behaviour.

## Decisions for later review

- **The prototype never reads the real clipboard.** Alternative: use the paste
  event's text. A reviewer's real copied password would then show on the page;
  a made-up editable sample shows the same flow.
- **Kirjoita näppäilyinä is the primary, focused choice** (Enter sends as
  keystrokes). Alternative: Liitä first, as in the current popover. Keystrokes
  leave nothing on the remote clipboard and work on paste-blocking sites, and
  since the Latin-keyboard fix they cover ordinary text; Liitä stays for emoji
  and other characters keystrokes refuse.
- **The field is hidden every time the popover opens**; the eye state is not
  remembered. A shown password left visible for the next opening is the worse
  surprise.
- **Focus returns to the picture after Escape and Sulje too,** not only after
  sending, so closing the popover never strands keys in Habitat.
- **The Leikepöytä button in the bar opens the popover empty,** with generic
  guidance; only ⌘V pre-fills (direction 1).
- **The guidance is three short lines in the popover itself,** not a separate
  note. Alternative: a "?" disclosure. The honesty line has to be seen where
  the choice is made.
- **The Enter warning for line breaks and the strict-browser copy paths are
  left out** of the prototype; production keeps them unchanged.

## Questions for Jari

1. Suunta 1, 2 vai 3?
2. Pidetäänkö *Kirjoita näppäilyinä* ensisijaisena (Enter) myös tavalliselle
   tekstille, vai pitäisikö Enterin valita *Liitä sivulle*, kun teksti ei näytä
   salasanalta? Ehdotan ensimmäistä: arvaus siitä, mikä on salasana, olisi
   väärässä juuri silloin, kun sillä on väliä.
3. Riittääkö *Näppäimet menevät sivulle* -siru kuvan kulmassa, vai pitäisikö
   se näkyä vain hetken lähetyksen jälkeen?

## Verification

`check.mjs` green: 24 cases (3 directions × fi/en × light/dark × 1440/390 px),
Control+V per direction, focus back on the picture and Backspace on the page,
eye position and state, honest line present and no "agent can't see" claim,
Escape, remote-clipboard note and its clear on Valmis, takeover with ⌘V, picker,
axe at 390 px light fi, no horizontal overflow, clean console, no network.
Real Safari/Firefox and a real Mac keyboard not tried.
