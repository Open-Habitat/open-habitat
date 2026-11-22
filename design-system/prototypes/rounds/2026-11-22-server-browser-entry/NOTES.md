# Palvelinselaimen paikka — 22.11.2026

Akseli: mistä oma selain avataan suhteessa keskusteluun.

1. **Siru:** keskustelun kentän yllä on pysyvä ovi selaimeen. Sivupalkkiin
   ilmestyy ovi vain, kun ikkuna tarvitsee ihmistä.
2. **Rivi:** selain avataan aina sivupalkista. Keskustelu kertoo agentin
   selaintyöstä yhdellä tekstirivillä, ei toisella avauspainikkeella.
3. **Molemmat (suositus):** sivupalkki avaa kaikki omat ikkunat, siru vain
   tämän keskustelun kaksi ikkunaa. Asiaan liittymättömässä keskustelussa
   sirua ei ole. Henkilön oma kolmas ikkuna löytyy koko selaimen näkymästä.

Oletus on suunta 3 ja kirjautumisvahvistusta odottava ikkuna. Kaikkien suuntien
sisältö on sama. Tilannevalitsimella kokeillaan myös tavallista selaintyötä ja
suljettua selainta. Sivupalkin toinen keskustelu näyttää, mitä tapahtuu, kun
pyyntö ei kuulu luettavaan keskusteluun. Puhelimessa sivupalkin avauspainike
kantaa huomiomerkin. Katselu ei ota ohjausta; ohjaus ja sen palautus kokeillaan
erillisillä painikkeilla. Vahvistus on nimenomaisesti simulaatio.

## Rajaus

Tämä on tokenien päällä tehty esityskielen kopio, ei React-tuotantokomponenttien
uusi toteutus. Nykyiset komponentit ja niiden tilanomistus luettiin, ja
nykyistä sivupalkkia ja katselunäkymää katsottiin synteettisessä labissa.
Tuotannon noVNC-kuvaa ei jäljitellä valokuvalla: ikkunakuvat ovat keksittyjä
HTML-pintoja. Ei palvelinkutsuja, kirjautumisia, tallennusta tai uusia riippuvuuksia.

**Keskustelukohtaisuus on ehdotus.** Nykyinen `BrowserStatus` kertoo ikkunat,
agenttimerkin ja pyynnön, mutta ei niiden keskustelua. Ikkunan omistajaa ei saa
päätellä näkyvissä olevasta keskustelusta. Toteutuksen tiedontarve ratkaistaan
vasta suunnan valinnan jälkeen; prototyyppi ei muuta sopimusta tai auktoriteettia.

Kierros käyttää yhteisiä `lib/picker.css`- ja `lib/picker.js`-tiedostoja sekä
`picker-check.mjs`:ää. Omaa kirjastomuutosta ei tarvita; kierroksen CSS antaa
valitsimelle vain sen sisällön mukaisen leveyden puhelinta varten.
Briefissä mainittu terminal-settings-2 ei ollut tässä lähtöpuussa. Erillisen
build/check/NOTES-kierroksen mallina oli 2026-11-21-offer-title-copy.

## Rakentaminen ja tarkistus

Repojuuresta, lukitiedoston mukaiset `web/node_modules` asennettuina:

```sh
node design-system/prototypes/rounds/2026-11-22-server-browser-entry/build.mjs
PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" timeout 240 \
  node design-system/prototypes/rounds/2026-11-22-server-browser-entry/check.mjs \
  design-system/prototypes/dist/server-browser-entry/offline.html \
  /var/tmp/agent-keep/server-browser-entry-points/check
```

Build hyväksyy ensimmäiseksi argumentiksi vaihtoehtoisen tuloshakemiston.
HTML sisältää tokenit, fontit, tyylit ja skriptit; se avautuu suoraan tiedostona.
Osoitevalinnat: `?v=1|2|3&lang=fi|en&theme=light|dark|contrast`.
Linuxissa aja komennot scratch-leasen alla, yksityisellä TMPDIR:llä ja
`umask 077`:llä kuten repositoryn työohjeessa.

Check käy 36 yhdistelmää läpi: kolme suuntaa, kaksi kieltä, kolme teemaa,
1440 ja 390 px. Se klikkaa avausreitit, tarkistaa rajauksen kahteen/kolmeen
ikkunaan, vieraan keskustelun, pyynnön poistumisen, ohjauksen, palautuksen,
suljetun selaimen käynnistämisen, Escape-sulkemisen ja suuntavalitsimen.
Kontrollit ja sivu eivät vuoda vaakasuunnassa; konsoli on puhdas ja kaikki
HTTP-pyynnöt on estetty. Axe tarkistaa sovellusalueen jokaisessa suunnassa
390 px:n vaaleassa suomenkielisessä näkymässä. Kuvia tallennetaan ihmisen
arvioitavaksi, ei automaattisena pikselivertailuna.
