---
created: 2026-10-29
updated: 2026-10-29
type: bug
reporter: jari
status: open
priority: normal
lane: ui-polish
lane_seq: 1
collision: [web/src/components/components.css, design-system/]
preparation: ready
---

# Remove coloured left-edge stripes: failed tool row and the same pattern elsewhere

_Source: chat_

## Description

Jari 29.10. (kuvakaappaus `attachments/failed-bash-row.png`): kun agentin
bash-työkalu epäonnistuu, työkalurivillä on punainen reuna vasemmalla. Sitä ei
haluta nähdä: värillinen reunaraita on "vähän niin kuin emdash", tunnistettava
maneeri. Rivillä on jo punainen ✕ ja "paluuarvo 1", aikajanan solmu on punainen
ja vuoron otsikko kertoo "1 epäonnistui", joten raita ei kerro mitään uutta.
Jari torjui saman värillisen vasemman reunan korostuksen myös editorin
tiedostopuusta 22.10.

Lähde: `web/src/components/components.css` `.ah-tool-row.ah-tool-error`
(`border-left: 3px solid var(--ah-err)`). Sama kuvio löytyy ainakin
`Integrations.css` (`border-left: 3px solid var(--ah-err)`, `4px solid var(--ah-accent)`),
`SiteKeySettings.css`, `EditorReplaceNote.css`, `BrowserEditor.css`
(`inset 3px 0 var(--ah-err)`), `Settings.css` (`inset 3px 0 0 var(--ah-accent)`)
ja `ProcessTray.css`.

## Acceptance Criteria

- [ ] Epäonnistunut työkalurivi ilman värillistä reunaraitaa; reunus on sama kuin onnistuneella rivillä, tila näkyy ✕:stä, tekstistä ja solmusta.
- [ ] Muut värilliset vasemman reunan raidat (border-left tai inset-varjo, joka toimii korostuksena) poistettu tai korvattu tavalla, joka ei ole reunaraita; neutraalit 1px jakoviivat paneelien välissä saavat jäädä.
- [ ] Sääntö kirjattu `design-system/`-ohjeeseen, jotta raitaa ei tuoda takaisin.
- [ ] Kuvakaappaukset ennen/jälkeen (DSF 2) result.md:ssä.
