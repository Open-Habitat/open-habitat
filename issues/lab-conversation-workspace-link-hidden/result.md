# Tulos

Vika oli myös tuotteessa, ei vain testissä. Lyhenemisen vaihe 1 piilotti
otsakkeen työtilalinkin, mutta ⋯-valikko tuli näkyviin vasta vaiheessa 3.
Vaiheissa 1–2 (labin oletusleveydellä juuri tämä tilanne) työtilaan ei siis
päässyt otsakkeesta lainkaan, vain sivupalkista.

Korjaus: työpöydällä ⋯ näkyy jo vaiheesta 1 alkaen, ja valikossa on vain se,
mitä rivi ei enää näytä. Vaiheissa 1–2 siinä on pelkkä työtila; vaiheesta 3
alkaen myös Uusi otsikko, Arkistoi ja Tiedot, kuten ennenkin. Puhelimen
valikko on ennallaan (kaikki toiminnot). `useHeaderShortening` kertoo nyt,
onko työtila ja toiminnot siirretty valikkoon; mittaamattomassa DOMissa ja
puhelimessa valikko listaa kaiken.

`lab-conversation` siirtyy työtilaan otsakelinkistä, jos se näkyy, muuten
⋯-valikon työtilarivistä. `lab-desktop-header` tarkistaa nyt, että ilman
vaiheita linkki näkyy ja ⋯ on piilossa, ja vaiheissa 1–2 ⋯ näkyy ja siinä
on vain työtilarivi.

## Tarkistus

- `lab-conversation` kolme kertaa 14/14 (`OH_PORT_BASE=6000`, 2 workeria);
  ennen korjausta 1 epäonnistui.
- Läpi: `lab-desktop-header` 4, `lab-phone-header` 2, `lab-title-generation`
  4, `lab-onboarding` 4, `native-history` 11, `title-regeneration` 3.
- `./scripts/test-focused.sh --area web`: 865 testiä läpi.
- Katselmointi: kohdennettu itsekatselmointi (vain selainkäyttöliittymä, ei
  daemonia, sopimusta, istunnon tilaa eikä valtuuspolkuja).

## Muut testit kapeammilla leveyksillä

`web/tests`:ssä `conversation-workspace`-linkkiä käytti vain tämä testi.
Otsakkeen Arkistoi- ja Uusi otsikko -painikkeita klikataan suoraan
`browser-conversation`-, `native-history`- ja `lab-conversation`-testeissä.
Ne piiloutuvat vasta vaiheessa 3, johon testien oletusleveys ei nyt yllä,
joten ne menevät läpi. Jos oletusleveys kapenee tai otsakkeeseen tulee lisää
siruja, nämä testit hajoavat samalla tavalla, ja ne pitää ohjata ⋯-valikon
kautta.

## Decisions for later review

- **⋯ jo vaiheessa 1, vain piilotetut rivit.** Vaihtoehdot: (a) näyttää
  ⋯ vaiheesta 1 ja siinä kaikki rivit, myös rivillä yhä näkyvät Uusi otsikko,
  Arkistoi ja Tiedot; (b) siirtää työtilan piilotus vaiheeseen 3 ⋯:n
  kanssa; (c) jättää työtila vain sivupalkin varaan. Valitsin, että ⋯ tulee
  vaiheesta 1 ja siinä on vain se, mitä rivi ei näytä. Speksi lupasi, että
  toiminnot löytyvät näkyvistä tai ⋯-valikosta. Kaksoispainikkeet olisivat
  sotkeneet valikkoa, ja (b) olisi muuttanut Jarin hyväksymää
  lyhenemisjärjestystä.
