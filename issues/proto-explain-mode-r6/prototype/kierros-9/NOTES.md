# Selitystila, kierros 9: miten tilakorttiin pääsee

Avaa `selitystila-tilakortti.html`. Se on yksi offline-sivu eikä käytä verkkoa.
Kaikki kuvat ovat tuotannon näkymiä synteettisestä labrasta, ja niiden päälle on
piirretty selitystila sellaisena kuin valitsit sen kierroksella 8 (riffi 1
*Kuten aina*, kohta selittyy vain näkyvän sisältönsä päällä).

## Mikä tilakortti on

Tilakortti on kierroksen 7 kortti, joka kertoo keskustelun tilanteen:
otsikkona tila (esim. *Odottaa sinua*), yksi lause siitä, mitä tapahtuu, yksi
asia, joka kannattaa tietää, ja *Voit nyt* -rivit, joiden painallus tekee
asian. Kuva `r9-04` näyttää sen.

**Kaikissa suunnissa** Selitä-painike (?) avaa tilan, ja ensimmäisenä näkyy
tilakortti (kuvasarjan rivi K). Tilakortti pysyy, kunnes osoitat jotain
kohtaa. Suunnat eroavat vain siinä, miten tilakortin saa takaisin kesken tilan.

## Suunnat

- **A Selitä-painike**: Selitä (?) yläpalkissa tuo tilakortin takaisin myös
  kesken tilan; tila päättyy Esc:llä tai Lopeta-painikkeella.
- **B Tyhjä kohta**: napsautus (puhelimella napautus) keskustelun tyhjään
  kohtaan tuo tilakortin; Selitä lopettaa tilan.
- **C Palkin tilanne** (suositus): selitystilan palkki kertoo tilanteen
  sanoin (esim. *Odottaa sinua*), ja sen painallus tuo tilakortin; Selitä
  lopettaa tilan.

C on se kolmas tapa, jonka brief salli. Palkki kertoi tilanteen jo
kierroksella 8 (”Tilanne: Odottaa sinua.”), mutta siitä ei päässyt
eteenpäin. Nyt se on painike.

## Kuvasarjat

Sivu aukeaa kohdasta **Kuvasarjat**. Ylimpänä on rivi K (kaikille sama),
sen alla rivi kullekin suunnalle. Jokainen rivi alkaa samasta hetkestä:

1. **A1, B1, C1**: selitystila on päällä, ja olet osoittanut viestiäsi, joten
   sen kortti näkyy.
2. **A2, B2, C2**: teko. Osoitin ja rengas näyttävät, mihin painetaan.
3. **A3, B3, C3**: tilakortti on taas esillä.

Napsauta kuvaa, niin se suurenee. Valitsimesta (näppäimet 1–3) korostat
suunnan. *Tilanne*-valinta vaihtaa kaikkien kuvien keskustelun tilan
(Odottaa sinua, Työskentelee, Pysäytit vuoron, Vuoro epäonnistui, worker
taustalla, Ei vielä alkanut): tilakortti on eri, mutta tie siihen on sama.
*Laite* vaihtaa puhelimeen, *Teema* tummaan.

Voit vastata osoittamalla kuvan tunnusta, esim. ”C2”.

## Kokeile itse

**Kokeile itse** on sama näkymä elävänä. Osoita kohtia, ja hae tilakortti
takaisin valitun suunnan tavalla. Muiden suuntien teot eivät tuo sitä:
A:ssa tyhjän kohdan napsautus ei tee mitään, B:ssä ja C:ssä Selitä lopettaa
tilan. Painallukset toimivat kuten kierroksella 7: esim. *6 työkalua* avaa
työn, ja tila pysyy päällä. Puhelimella napauta.

## Mitä kuvista näkyy

- **A** muuttaa Selitä-painikkeen merkitystä kesken tilan: se ei enää
  lopeta tilaa. Siksi painikkeen oma kortti kertoo sen (A2). Tilan
  lopettaminen jää Esc:lle ja Lopetalle.
- **B** ei näy missään. Palkki kertoo tavan sanoin, mutta itse tyhjässä
  kohdassa ei ole mitään, mitä painaa. Puhelimella keskustelu on lähes
  kokonaan sisältöä: tyhjää on vain kapea reunus viestien vieressä (`r9-18`).
  Jos napautus osuu tekstiin, tilakortin sijaan selittyy viesti.
- **C** on aina näkyvissä selitystilan ajan, sama työpöydällä ja
  puhelimella, ja sen sana on tila itse. Selitä toimii kuten ennenkin.
  Kun tilakortti on auki, palkin painike näkyy painettuna.

## Rajat

- Tilakortin paikka on kaikissa suunnissa sama, joten kuvista näkyy, että
  kortti on sama kortti, tuli se mistä tahansa.
- Palkki on prototyypissä sivun eikä näkymän osa, joten C:n osoitin ja
  rengas on piirretty palkin päälle sivun puolella.
- *Ei vielä alkanut* -tilassa ei ole viestiä. Siinä rivin ensimmäinen kuva
  osoittaa työtilan esittelyä.

Kuvat ovat issuen `evidence/`-hakemistossa etuliitteellä `r9-`. Suositus ja
kysymykset ovat issuen `result.md`:ssä.

## Rakentaminen ja tarkistus

Lähde on `design-system/prototypes/rounds/2026-11-06-tilakortin-tie/`. Kortit
ovat kierroksen 6 `cards.mjs`:ssä, tilat kierroksen 8 `state.mjs`:ssä, ja
suunnat sekä Selitä-painikkeen kortit suunnittain ovat tämän kierroksen
`state.mjs`:ssä.

```
OH_PORT_BASE=6574 scripts/lab.sh start && PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-tilakortin-tie/capture.mjs
node design-system/prototypes/rounds/2026-11-06-tilakortin-tie/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-tilakortin-tie/shoot.mjs issues/proto-explain-mode-r6/evidence
python3 scripts/screenshots-to-avif.py issues/proto-explain-mode-r6/evidence
```

Tarkistus käy läpi jokaisen kuvan jokaisessa tilassa, molemmilla leveyksillä
ja *Odottaa sinua* -tilassa molemmilla teemoilla (154 kuvaa). Jokaisesta
kuvasta se varmistaa, että siinä näkyy kuvatekstin kertoma asia: osoitetun
kohdan kortti, teon merkki tai tilakortti, ja että kortti pysyy näkymän
sisällä. Elävässä näkymässä se kokeilee jokaisen suunnan jokaisella teolla
työpöydällä ja puhelimella (18 yhdistelmää). Oma teko tuo tilakortin, eikä
muiden suuntien teko tuo sitä. Lisäksi se tarkistaa, että Selitä lopettaa
tilan B:ssä ja C:ssä, että Esc lopettaa tilan, että painallus avaa työn tilan
pysyessä päällä ja että kuvan suurennus toimii. Valitsin on tarkistettu
yhteisellä tarkistuksella. Tulos: virheitä 0, konsoli puhdas.
