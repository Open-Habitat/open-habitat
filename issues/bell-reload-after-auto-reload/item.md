---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: bell-reload
lane_seq: 1
---

# Bell still asks to reload after the page already reloaded into the new release

## Description

Jari 7.11.2026 (testikone, päivitys pilot.614 → uudempi kesken keskustelun):
päivityksen jälkeen agentti oli levossa ja ylös tuli yhteyspalkki. Kun Jari
latasi sivun (tai sivu latautui itse yhteyden palatessa), sivu latautui, mutta
kellovalikkoon jäi silti *Uusi versio · Lataa uudelleen*. Jari painoi sitä ja
sivu latautui toisen kerran. Epäselvää, latasiko ensimmäinen lataus vanhan
version (välimuisti, vanha `index.html` tai vanhat osat) vai jäikö kellon
kohta väärin näkyviin uudesta versiosta huolimatta.

Selvitä kumpi: vertaa, mitä versiota sivu ajaa latauksen jälkeen ja mihin
kellon *Lataa uudelleen* -kohta vertaa (`server-version-reload`,
`reconnect-after-version-change`, kellon tila `notification-bell-status`).
Yhden latauksen jälkeen sivun pitää ajaa uutta versiota eikä kelloon saa jäädä
päivityskehotusta.

## Acceptance Criteria

- [ ] syy löydetty; päivitys kesken istunnon → yksi lataus → uusi versio eikä kellon kehotusta; selaintesti

## Decision (Jari 2026-11-07)

**A**: kun yhteys palaa ja palvelimella on uusi versio, sivu latautuu itsestään
uuteen versioon, jos henkilö ei ole kirjoittamassa tai kesken lähetystä;
luonnos säilyy. Muuten yhteyspalkin tilalle *Palvelin päivitettiin · Lataa
uudelleen*. Kellon kehotus poistuu latauksen myötä.
