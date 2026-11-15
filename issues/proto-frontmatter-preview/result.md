# Kierros 1: sisäkkäisen front matterin ja YAMLin esikatselu

## Yhteenveto

Editorin esikatselu luovuttaa nyt ensimmäisen tason jälkeen. Ylätason
tekstiarvot näkyvät luettelona, mutta kaikki sisäkkäinen, kuten start pagen
`goals`, jää yhdeksi YAML-lähdelohkoksi. Pelkillä `.yaml`/`.yml`
-tiedostoilla ei ole esikatselua lainkaan. Kierros näyttää kolme suuntaa
tuotannon editorikehyksessä kolmella synteettisellä tiedostolla
(aloitussivu, jossa kolme tavoitetta, kuuden tason front matter ja CI-workflow).

**Suositus: 3 Sivuna aloitussivulle ja sen pohjana 1 Sisäkkäin kaikelle
muulle, myös `.yml`:lle.** Aloitussivu kannattaa esittää niin kuin
työtilan sivu sen näyttää, oppaat ja kelpoisuus mukaan lukien. Muut
tiedostot näytetään kokonaan auki sisäkkäisenä luettelona, jossa olioiden
listat ovat kortteja ja monirivinen teksti on lainauslohko.
**Aloitussivu pysyy `.md`-tiedostona**: runko on oikeaa sisältöä
(työtilan kuvaus ja esittely), muoto on sama kuin taidoilla, ja kipu oli
esikatselussa, ei muodossa (perustelut ja siirtymän hinta `NOTES.md`:ssä).

Kierros: `design-system/prototypes/rounds/2026-11-15-frontmatter-preview/`.
`NOTES.md` kertoo sivun, nykytilan, suosituksen ja YAML-kysymyksen.
Sivu ja ruutukaappaukset (skaala 2) ovat hakemistossa
`~/src/open-habitat-dev/worker-results/01m7g4xevp2hytw3cymvnjv12t/`
(`offline.html`, `shots/`), eivät gitissä.

## Suunnat (akseli: miten sisäkkäinen rakenne esitetään)

- **Nyt**: tuotanto tänään; `goals` YAML-lähteenä, `.yml` ilman esikatselua.
- **1 Sisäkkäin**: kaikki auki sisäkkäisenä luettelona. Olioiden listat
  ovat kortteja, merkkijonolistat siruja tai luetteloita, monirivinen
  teksti on lainauslohko ja tyhjät arvot on nimetty. Sisennys lakkaa
  kasvamasta neljännen tason jälkeen.
- **2 Puu**: kaksi tasoa auki, syvemmät kiinni määrineen, Avaa kaikki /
  Sulje kaikki. Samanmuotoiset oliot ovat taulukon rivejä, ja rivi
  avautuu.
- **3 Sivuna**: aloitussivu tuotannon `WorkspaceIntro`-näkymänä, alla
  tavoitteiden oppaat (milloin, mitä saat, vaiheet, pyyntö täytettävä
  kohta korostettuna, taito, heti lähtevä, keskustelun nimi) ja
  kelpoisuus: kelpaa ja tavoitteiden määrä, tai mikä tavoite ja kenttä
  estää sivun. Muut tiedostot kuten 1:ssä.

Kuvat: `shots/<n>-<suunta>-<tiedosto>-<leveys>-<teema>.png`; tiedostot
`start`, `deep`, `yaml`, lisäksi `deep-open`, `row-open`, `goal`, `broken`
ja `start-en`. Jokainen suunta on aloitussivulla 1440 ja 390, Päivä, Yö ja
Kontrasti.

## Host-tiedot ja mitä toteutus olettaa

- Esikatselu seuraa puskuria, joten YAML jäsennetään selaimessa. Nykyinen
  käsin kirjoitettu lukija (`frontmatter.ts`) ei tue sisäkkäisyyttä.
- Suunta 3:n kelpoisuus toistaa daemonin säännöt (`parseStartPageDocument`).
  Tallennettu sivu kertoo nyt vain `needs_update`, ei syytä.
- Tunnistus on polku `.agents/start-page.md` työtilan juuressa, sama jota
  daemon lukee. Muita tunnettuja tiedostoja ei ole.

## Päätökset myöhempää katselmointia varten

- **YAML-jäsennin selaimeen (Jarin päätös, merkittävä riippuvuus).**
  Ehdotus: `yaml`-paketti laiskasti esikatselun mukana, core-skeema, ei
  omia tageja, alias-raja. Vaihtoehdot: oman lukijan laajentaminen
  sisäkkäiseen (iso ja virhealtis), `js-yaml` (pienempi) tai daemonin
  jäsennys (ei seuraa puskuria ilman uutta rajapintaa). Valitsin `yaml`:n,
  koska sen dokumenttimalli kertoo jokaisen arvon lähdekohdan, ja
  esikatselu ja teksti voivat avautua samasta kohdasta kuten
  Markdown-otsikoilla nyt.
- **Kelpoisuuden lähde.** Valitsin vedokseen selaimen kopion daemonin
  säännöistä. Vaihtoehto on daemonin endpoint, joka jäsentää annetun
  tekstin samalla funktiolla (yksi totuus, ei uutta valtaa, koska
  käyttäjän oma daemon lukee käyttäjän tekstin), tai kelpoisuuden
  jättäminen pois. Suosittelen daemonia, kun suunta 3 toteutetaan, koska
  kopio ajautuisi erilleen säännöistä.
- **`.yaml`/`.yml` saa esikatselun.** Nykyinen perustelu (”folding already
  shows their structure”) pitää puun osalta, minkä vuoksi suositus ei ole
  2 Puu. Pitkät merkkijonot, tyhjät arvot ja olioiden listat ovat silti
  luettavampia piirrettyinä. Vaihtoehto on jättää YAML ennalleen ja korjata
  vain front matter.
- **Puhelimen oletus** on editori koko leveydellä (keskustelu piilossa),
  koska 40 %:n editorikaistale ei riitä esikatseluun. Tämä on vain
  vedoksen alkutila, ei ehdotus tuotannon muutokseksi.
- **Aloitussivu `.md`:nä**, ks. yllä ja `NOTES.md`.

## Kysymykset Jarille

1. Kelpaako suositus (3 + 1), vai riittääkö pelkkä 1 myös aloitussivulle?
2. Hyväksytkö `yaml`-paketin selaimeen laiskasti ladattuna?
3. Saako `.yml` esikatselun, vai pidetäänkö YAML vain tekstinä?

## Tarkistus

`check.mjs`: 197 tarkistusta läpi, konsoli puhdas (1440 ja 390, kolme
teemaa, suomi ja englanti, tiedostot, rivin avaus, tavoitteen valinta,
virheellinen sivu, teksti- ja esikatselunäkymän vaihto). Itsearvio:
kohdennettu, koska kierros ei muuta tuotantokoodia.

Live check: ei mitään testipalvelimella, koska kierros on vedos. Jari
avaa `offline.html`:n ja vaihtaa palkista tiedoston (aloitussivu / syvä
front matter / pelkkä YAML) ja aloitussivun tilan (Kelpaa / Virhe
tavoitteessa 2).

## Summary (English)

Today's preview gives up after the first level: nested values such as a
start page's `goals` stay one YAML source block, and `.yaml`/`.yml` files
have no preview. Round 1 shows Nested (everything open, lists of objects as
cards), Tree (two levels open, uniform lists as expandable tables) and As
page (the start page rendered with production `WorkspaceIntro`, goal guides
and validity; other files as Nested). Recommendation: As page for the start
page with Nested as the general renderer, `.yml` included. It needs a
browser YAML parser (`yaml`, lazy-loaded), which is a dependency decision
for Jari. Keep `start-page.md`: its Markdown body is the workspace
description, and the format matches SKILL.md.
