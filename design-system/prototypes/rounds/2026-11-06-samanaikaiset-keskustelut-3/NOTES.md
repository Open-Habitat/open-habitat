# Samanaikaiset keskustelut – kierros 3

Issue `proto-live-conversation-limit-setting`. Jari valitsi 6.11. kierroksen 2
listaksi **Työtiloittain**. Hän halusi, että *Muuta rajaa* näkyy tavallisille
käyttäjille harmaana ja ylläpitäjälle merkinnällä "(ylläpitäjä)". Ylläpitäjä
saa nostaa rajan yli 32:n, ja rajoille voi olla henkilökohtaisia poikkeuksia.
Tämä kierros näyttää kortin sellaisena ja riffaa ylläpitäjän näkymää
kolmella tavalla.

Ylläpitäjän näkymä on uusi osio **Keskustelut** palvelimen omalla alueella
(`server-settings-own-area`, tuotannossa kokeellisen ominaisuuden takana;
kierros kytkee sen päälle). Alue, sen linkit, *‹ Omat asetukset* ja
puhelimen välilehtirivi ovat tuotannon `AccountSettings`. Kierros lisää
osion linkin Käyttäjät ja pääsy -linkin perään ja piirtää osion sisällön.

## Riffit

Akseli: miten ylläpitäjä näkee ja asettaa asennuksen rajan ja
henkilökohtaiset poikkeukset.

- **1 Kaikki henkilöt**: raja kentässä ja taulukko kaikista henkilöistä kuten Levytila: työssä nyt, raja (oletus tai oma) ja Muuta riviltä.
- **2 Vain poikkeukset**: raja kentässä ja lista vain niistä, joilla on oma raja; Lisää poikkeus valitsee henkilön. Henkilökohtaista käyttöä ei näytetä.
- **3 Muisti edellä**: ylhäällä palvelimen muisti nyt ja jos jokainen käyttää koko rajansa; raja ja jokaisen henkilön raja säätimillä, jotka päivittävät arvion heti.

Kaikissa sama kortti: kierroksen 2 Työtiloittain. *Muuta rajaa (ylläpitäjä)*
vie osioon. Tavalliselle käyttäjälle *Muuta rajaa* näkyy harmaana ilman
merkintää. Syy on kortin lauseessa (*Ylläpitäjän asettama raja on 12 …*), ja
painike viittaa siihen `aria-describedby`llä. Raja saa olla 1–128.

## Mitä kussakin tapahtuu

Lähtötilanne on synteettinen: palvelimella on 16 Gt muistia ja kuusi
henkilöä. Asennuksen raja on 12, villella on oma raja 40 ja ainolla 4.
Työssä on nyt yhteensä 45 keskustelua.

- **1.** Kentässä on muistiarvio (*12 keskustelua vie enintään noin 2,5 Gt
  henkilöä kohden*). Yli 32:n arvoon tulee lisäys *Yli palvelimen oman
  oletuksen 32: varmista, että muisti riittää.* Arvo 200 hylätään
  (*Kokonaisluku 1–128*). Taulukossa on jokainen henkilö palkkeineen
  (*12 / 12*), raja *Oletus (12)* tai *Oma: 40* sekä *Muuta*, joka avaa
  kentän riville (tyhjä palauttaa oletuksen). Kapeassa sarakkeessa
  tuotannon taulukko pinoutuu korteiksi, kuten Levytilassakin.
- **2.** Kentän alla on *Poikkeukset: henkilöt, joilla on oma raja. Muut 4
  käyttävät rajaa 12.* Rivillä on henkilö, raja ja tarvittaessa *yli 32*
  sekä painikkeet *Muuta* ja *Poista*. *Lisää poikkeus* avaa henkilön
  valinnan ja luvun; *Tallenna* on pois käytöstä, kunnes luku on annettu.
  Lopussa yksi rivi koko palvelimesta: *Työssä nyt koko palvelimella 45
  keskustelua*.
- **3.** Ylhäällä on muistipalkki, jossa näkyy kaksi asiaa: työssä nyt
  (45 · 9,2 Gt) ja tilanne, jossa jokainen käyttää koko rajansa (92 · 18,9
  Gt). Jälkimmäinen ylittää 16 Gt, joten palkki punertuu ja alle tulee
  varoitus. Asennuksen raja ja jokaisen henkilön raja ovat säätimiä.
  Henkilön säätimen siirtäminen pois oletuksesta tekee poikkeuksen, ja
  *Oletukseen* poistaa sen. Arvio päivittyy jokaisella painalluksella.
- **Kortti.** Ylläpitäjä näkee kortissa *Muuta rajaa (ylläpitäjä)*. Kun hän
  nostaa rajan osiossa ja sulkee asetukset, kortti sanoo *Tilaa on nyt* ja
  *Aloita keskustelu* käynnistää uuden keskustelun. Tavalliselle
  käyttäjälle (*Katsoja*) *Muuta rajaa* näkyy harmaana. Työtilapainike
  avaa ikkunan sen työtilan kohdalta, ja yksi pysäytys vapauttaa paikan.

*Alusta* aloittaa alusta. Ylläpitäjä aloittaa osiosta, koska riffien ero
näkyy siellä. Tavallinen käyttäjä aloittaa kortista.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-06-samanaikaiset-keskustelut-3/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-samanaikaiset-keskustelut-3/check.mjs \
  design-system/prototypes/dist/samanaikaiset-keskustelut-3/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen riffin läpi 1440 px:n ja 390 px:n (kosketus)
leveydellä, vaaleana ja tummana. Se tarkistaa ensin osion: oma linkki on
nykyinen ja Yleiset ei, ja riffin oma muutos tehdään. Sen jälkeen se käy
kortin läpi ylläpitäjänä (osioon ja takaisin, *Tilaa on nyt*, keskustelu
käynnissä) ja tavallisena käyttäjänä (harmaa painike, ikkuna, pysäytys).
Kuvat otetaan kertoimella 2, ja konsolin pitää pysyä puhtaana (440
tarkistuspistettä). Korttikuvat otetaan vain riffissä 1, koska kortti on
kaikissa sama. Host on `fetch`-sijainen, ja kaikki data on synteettistä.
