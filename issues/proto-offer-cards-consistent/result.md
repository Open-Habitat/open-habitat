# Kierros 1: yksi kortti ja yksi avautumispaikka

Kierros: `design-system/prototypes/rounds/2026-11-08-tarjouskortit/`
(`NOTES.md` kertoo sivun, suunnat ja tarkistuksen). Akseli on se, kuinka
paljon kortti itse kantaa. Avautumispaikka on kaikissa suunnissa sama oikean
reunan paneeli, eli sama paikka, jota `proto-conversation-assets` suositteli
keskustelun näkymien ja tiedostojen listalle. Paneelin yläreunan
*‹ Näkymät ja tiedostot* vie siihen listaan. Sisältö on kaikissa sama: yksi
näkymä, CSV, kuva, julkinen näkymä, PDF ja kansio.

- **Nyt**: tuotanto tänään. Näkymä avautuu viereen, tiedosto ikkunaan keskustelun päälle, kansio Tiedostot-paneeliin; kortit ja painikkeet vaihtelevat lajin mukaan.
- **1 Kortti**: koko kortti on yksi painallus, joka avaa kohteen oikeaan paneeliin; lataus ja jakaminen ovat paneelin yläpalkissa.
- **2 Rivi**: jokainen tarjous on yksi rivi, jonka ainoa painike on Avaa (oikea paneeli); lataus ja jakaminen ⋯-valikossa.
- **3 Otsake**: jokaisella kortilla sama tietorivi (laji · koko · kuka näkee) ja samat kaksi painiketta: Avaa (oikea paneeli) ja Lataa.

Kuvat: `evidence/r1-<suunta>-<vaihe>-<leveys>-<teema>.avif`. Vaiheet ovat
`0-oletus`, `0-kortit` (kaikki kuusi korttia korkeassa ikkunassa),
`1-nakyma`, `2-taulukko`, `3-kuva`, `4-asiakirja` ja `5-kansio` (avattuna
kortista), `6-lista` (yläpalkin sirusta) sekä `7-valikko` (Rivin ⋯).

## Mitä suunnat päättävät yhteisesti

Kaikki kolme suuntaa ratkaisevat issuen erot samalla tavalla:

- Johdantoriviä (*Agentti tarjoaa ladattavaksi:*) ei ole.
- Otsikko on aina tavallisella kirjasimella, ja polku näkyy tietorivillä.
- Kuka näkee on merkki: lukko tai maapallo. Sitä muutetaan paneelissa.
- Ensisijainen teko on aina *Avaa*, ei *Lataa*.
- Kaikki avautuu samaan paneeliin, myös kansion tiedostot.

Suunnat eroavat siinä, mitä kortille jää.

## Host-tiedot

Uutta tallennetta ei tarvita. Suunnissa on kaksi kohtaa, joita host ei
tänään tarjoa:

- **Näkymän lataus zipinä** (Otsakkeen *Lataa (.zip)* näkymäkortilla ja
  paneelin ⤓). Näkymä on jäädytetty tiedostojoukko, joten tämä on uusi reitti.
  Ilman sitä näkymäkortin toinen painike olisi *Avaa omalle välilehdelle*.
- **Tiedostoa ei voi tehdä julkiseksi.** Siksi tiedostojen näkyvyysrivi on
  pelkkä teksti *Vain sinulle* ilman kytkintä. Suunnat eivät lupaa
  tiedostojen jakamista.

Tiedoston esikatselu paneelissa korvaa tuotannon esikatseluikkunan
(`AttachmentPreview`). Sama sisältö, joka nyt piirretään ikkunaan
(taulukko, kuva, pdf.js-sivut), piirrettäisiin paneeliin. Data tulee samoista
`inline`- ja `download`-reiteistä. Kansion tiedostolistassa käytetään
nykyistä tarjouksen manifestia.

## Suositus

**1 Kortti.** Se poistaa erot kokonaan, koska kortilla ei ole lajikohtaisia
painikkeita lainkaan. Painikkeet ovat paneelissa, joka on kaikille sama ja
on myös listan paikka. Kortti pysyy tunnistettavana, koska siinä on kuvan
ja kansion pienoiskuvat, toisin kuin Rivissä. Rivi on tiivein, mutta sen
⋯-valikko piilottaa latauksen yhden painalluksen taakse ja kuva katoaa
keskustelusta. Otsake on lähimpänä nykyistä ja pitää Latauksen esillä.
Siinä on kuitenkin edelleen kaksi painiketta jokaisessa kortissa, ja se
tarvitsee näkymän zip-latauksen pysyäkseen yhtenäisenä.

## Kysymykset Jarille

1. Mikä kortti: Kortti (`r1-1-kortti-0-kortit-1440-light`), Rivi
   (`r1-2-rivi-0-kortit-1440-light`) vai Otsake
   (`r1-3-otsake-0-kortit-1440-light`)?
2. Kelpaako sama paneeli myös taulukolle, kuvalle ja PDF:lle
   (`r1-1-kortti-2-taulukko-1440-light`) nykyisen ikkunan sijaan
   (`r1-0-nyt-2-taulukko-1440-light`)?
3. Riittääkö näkyvyydeksi kortilla pelkkä lukko tai maapallo
   (`r1-1-kortti-0-oletus-1440-light`), vai pitääkö *Julkinen*-kytkin olla
   näkymäkortilla kuten nyt (`r1-0-nyt-0-kortit-1440-light`)?

## Ympäristö ja näyttö

Rakennettu tuotannon komponenteista tämän worktreen puusta (pohja
`2e4c7d53e`). Kuvat on otettu Playwright Chromium 153:lla headless-tilassa,
1440 × 900 ja 390 × 844 (kosketus), DPR 2, vaalea ja tumma. `check.mjs`:
534 tarkistuspistettä, konsoli puhdas. Nyt-näkymän PDF-ikkunassa ei ole
esikatselua, koska pdf.js:n worker puuttuu prototyypistä; tuotannossa
esikatselu näkyy.

```
node design-system/prototypes/rounds/2026-11-08-tarjouskortit/build.mjs
open-habitat agent view offer --current --source design-system/prototypes/dist/tarjouskortit/offline.html --title "Tarjouskortit · kierros 1" --idempotency-key 4e756d44-05dc-4762-b044-59493a64182a --json
```
