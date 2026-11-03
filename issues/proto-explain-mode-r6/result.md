# Tulos: selitystilan kaikki kortit (kierros 6)

Prototyyppi: `prototype/selitystila-kortit.html`, Jarin opas
`prototype/NOTES.md`, kuvat `prototype/kuvat/` (AVIF, kerroin 2). Lähde
on `design-system/prototypes/rounds/2026-11-03-selitystila-kortit/`, ja
kortit ovat yhdessä tiedostossa `cards.mjs` suomeksi ja englanniksi.

Kierros 5:n riffi 1 (*Himmennys ja kortti osoittimessa*, koko näyttö) on
piirretty tuotannon oikeiden näkymien päälle: synteettisestä labrasta
kaapatut 22 näkymää työpöydällä (1440) ja puhelimella (390), vaaleana ja
tummana. Tila itse on ennallaan; kierros on teksteistä.

## Inventaario

Jokainen kohta, jonka tila selittää, on kortti tunnuksineen (178 korttia).
Kohta löytyy tuotannon omasta elementistä (testitunniste tai luokka), ei
koordinaateista.

| Alue | Kortit |
|---|---|
| X Selitystila itse (nauha, palkki, Selitä tämä näkymä) | 3 |
| Y Keskustelun yläpalkki ja ⋯ | 16 |
| S Sivupalkki, tilivalikko ja Hiljaisten rajaus | 29 |
| E Etusivu | 7 |
| T Työtilan sivu | 14 |
| A Uuden keskustelun aloitussivu | 5 |
| K Keskustelu ja sen kortit (viestit, työrivi, komento, luettu/kirjoitettu/muokattu tiedosto, prosessi, epäonnistunut vaihe, tiedostolinkki, kaavio, työn tila) | 19 |
| V Viestikenttä ja taustatyön merkit | 11 |
| L Kentän listat ja mallivalitsin | 11 |
| P Paneelit: Git, Tiedot, keskustelun malli, opas, taustatyö | 15 |
| R Pääte | 9 |
| D Editori | 8 |
| W Workerin näkymä | 6 |
| M Asetukset (haku, sulkeminen, jokainen asetussivu, Git-identiteetti, versio) | 25 |

## Suunnat (vain korttien tyyli)

1. **Mitä · tiedä · kokeile**: nimi, yksi lause mitä kohta tekee sinulle,
   yksi lause mitä kannattaa tietää, Kokeile. Noin 25–35 sanaa.
2. **Yksi lause**: nimi ja yksi lause. Noin 10–14 sanaa.
3. **Opastava**: kaksi tai kolme virkettä tilanteesta lähtien, esimerkin
   kanssa. Noin 45–60 sanaa.

Suunnat on näytetty neljällä kohdalla (Pääte Y08, Konteksti Y05, Hiljaiset
S07, komentorivi K05); kaikki 178 korttia on kirjoitettu suunnalla 1.

## Suositus

**Suunta 1.**

- Toinen lause kantaa ne tiedot, joita kierros 4 piti tarpeellisina: miksi
  painike on harmaa (näkyy vain, kun kohta oikeasti on harmaa), mihin ⋯:ssa
  oleva painike on mennyt (vain ⋯:n rivillä) ja mitä säilyy. Suunnasta 2
  ne puuttuvat, ja kortti jää nimen toistoksi.
- Suunta 3 on hyvä ensimmäisellä kerralla mutta raskas, kun liikutat
  osoitinta kohdasta toiseen: 50 sanan kortti ei ehdi tulla luetuksi ennen
  kuin osoitin on jo seuraavassa kohdassa, ja puhelimella se peittää puolet
  näytöstä.
- Kortti ei toista sitä, mikä kohdassa jo lukee. Siksi asetuksissa on yksi
  kortti kullekin asetussivulle, ei jokaiselle riville: rivien kuvaukset
  ovat jo näkyvissä.

Prototyyppi toi esiin kolme toteutuksen asiaa:

- **Avoin lista tai valikko peittää.** Kun Komennot-lista, ⋯, Git-paneeli
  tai Tilivalikko on auki, selittyvät vain sen rivit, eivät alla olevat
  kohdat (778 tällaista tapausta tarkistuksessa). Se vastaa tuotantoa,
  jossa painallus listan ulkopuolelle sulkisi listan.
- **Palkki vie tilan, ei peitä.** Näkymä kutistuu 40 px palkin alle, jotta
  yläpalkki jää selitettäväksi. Toteutuksessa sama: palkki on sovelluksen
  yläpuolella, ei sen päällä.
- **Sisäänkäynti leveällä näytöllä.** Kun kaikki mahtuu yläpalkin riville,
  ⋯ puuttuu, joten *⋯ › Selitä tämä näkymä* ei aina ole olemassa.
  Prototyyppi lisää rivin *Tilivalikko › Selitä tämä näkymä*, joka on
  jokaisessa näkymässä (myös etusivulla ja asetuksissa), ja puhelimella
  lisäksi ⋯:hen.

## Toteutusta varten

- `cards.mjs` on toteutuksen sisältö sellaisenaan: siitä tulee katalogi
  `web/src/text/`-hakemistoon (tunnus, laji, nimi, lause, tiedä, kokeile,
  harmaa, ⋯-huomautus, pikanäppäin arvona). Koska `open-habitat-ui`-viite
  kootaan katalogeista, agentti ja selitystila lukevat samat tekstit.
- Kohdan valitsin on komponentin oma testitunniste tai luokka; toteutus
  merkitsee komponenttien juuret samoin, eikä koordinaatteja tallenneta.
- Kortin rivit *harmaa* ja *⋯* näkyvät vain tilanteessa, jossa ne pitävät
  paikkansa (kohta on harmaa tai kohta on ⋯:n rivi).
- Kokeile puuttuu tarkoituksella arkistoinnista, poistosta ja
  uloskirjautumisesta.
- Tarkistettava toteutuksessa, koska labra ei näytä niitä: milloin
  *Tee tilannekatsaus nyt*, *Arkistoi*, *Avaa GitHubissa* ja *Lähetä*
  ovat harmaita (kortin harmaa-rivi on kirjoitettu koodin perusteella), ja
  pitääkö *Leveys*-raahaus (P13) talteen leveyden.

Kierros ei muuttanut tuotantokoodia.

## Kysymykset Jarille

1. **Suunta 1, 2 vai 3?** Kuvat `01`/`02` (suunta 1), `03` (suunta 2) ja
   `04` (suunta 3) näyttävät saman Pääte-kortin; `23` on suunta 3
   puhelimella. Suosittelen suuntaa 1.
2. **Tilivalikko › Selitä tämä näkymä** (kuva `15`) tilan pysyväksi
   paikaksi kaikilla leveyksillä, ja puhelimella lisäksi ⋯ (kuva `19`)?
   Suosittelen.
3. **Asetuksissa kortti asetussivulle** (kuva `17`, Tekoäly), ei jokaiselle
   asetusriville? Suosittelen sivukohtaista.

## Näyttäminen

```
open-habitat agent view offer --current \
  --source issues/proto-explain-mode-r6/prototype/selitystila-kortit.html \
  --title "Selitystila: kaikki kortit – kierros 6" \
  --idempotency-key "$(uuidgen)" --json
```
