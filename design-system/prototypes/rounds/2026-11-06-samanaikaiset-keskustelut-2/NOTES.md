# Samanaikaiset keskustelut – kierros 2

Issue `proto-live-conversation-limit-setting`. Jari valitsi 6.11. kierroksen 1
suunnan **B Ylläpitäjä**: ylläpitäjä asettaa rajan koko asennukselle ja
tarvittaessa henkilöittäin, ja kieltäytymiskortti kertoo, mitkä pitävät
paikkaa. Tämä kierros riffaa B:tä hänen päätöksensä mukaan:

- *Muokkaa* on poistettu kortista (myös *Tilaa on nyt* -tilasta).
- *Yritä uudelleen* jää.
- *Muuta rajaa (ylläpitäjä)* toimii vain ylläpitäjälle. Yläpalkin
  **Katsoja**-valinta näyttää kortin ylläpitäjälle, muulle niin, että nappi
  on piilossa, ja muulle niin, että nappi näkyy pois käytöstä ja sen alla on
  syy *Vain ylläpitäjä voi muuttaa rajaa.*
- *Mitkä pitävät paikkaa* -lista kolmena riffinä (akseli).

Daemonin oma raja on nyt 32 (`defaultLiveConversations`, b340d017).
Kierroksessa ylläpitäjä on asettanut asennukselle 12, ja kaikki 12 ovat
työssä: kuusi vuoroa, kaksi kysymystä sinulle ja neljä taustaprosessia
(`npm run dev`, `make images`, `python fetch_stars.py`, `rsync …`). Lista on
siis tarpeeksi pitkä näyttämään, miten kukin riffi kestää pituutta.
Ylläpidon osio näyttää muistiarvion (noin 210 Mt keskustelua kohden,
daemonin kommentin luku) ja palvelimen oman oletuksen 32 ylärajana.

Rakennettu tuotannon komponenteista kuten kierros 1 (`AppShell`,
`WorkspaceRail`, `AgentNavItem`, `AgentHeader`, `ConversationTimeline`,
`WaitingMessage`, `Composer`, `ControlButton`, `StatusMark`,
`WarningBanner`, `InlineTextSetting`, `AccountSettings` ylläpidon
Palvelin-osioineen). *Keskustelua ei luotu*, *Yritä uudelleen* ja
sivupalkin tilasanat tulevat tuotannon katalogeista. Kierroksen omia ovat
kortin sisältö, lista, ikkuna, lajien ja työtilojen painikkeet ja ylläpidon
osio. Host on `fetch`-sijainen; kaikki on synteettistä.

## Riffit

Akseli: miten *Mitkä pitävät paikkaa* -lista näytetään ja järjestetään.

- **1 Lajeittain**: kortissa lajit painikkeina (taustaprosessit, odottaa vastaustasi, vuoro käynnissä); painike avaa ikkunan sen lajin kohdalta, taustaprosessit ensin.
- **2 Kortissa**: lista on kortissa itsessään, unohdetuin ensin (milloin kirjoitit viimeksi); kolme näkyy, loput Näytä kaikki -painikkeen takana. Ei ikkunaa.
- **3 Työtiloittain**: kortissa työtilat painikkeina, tämä työtila ensin; ikkunan lista ryhmittyy työtiloittain kuten sivupalkin Käynnissä.

Kaikissa (ero kierrokseen 1): Muokkaa poistettu, Yritä uudelleen jää,
Muuta rajaa (ylläpitäjä); Katsoja näyttää, miltä kortti näyttää muulle kuin
ylläpitäjälle.

## Mitä kussakin tapahtuu

- **1.** Kortti: *Ylläpitäjän asettama raja on 12 yhtä aikaa
  työskentelevää keskustelua, ja kaksitoista keskustelua työskentelee jo.*
  Alla kolme lajipainiketta. Lajipainike tai *Mitkä pitävät paikkaa?* avaa
  ikkunan *Työskentelee nyt · 12/12*; valitun lajin otsikko on alleviivattu
  ja vieritetty esiin. Ryhmät: taustaprosessit (pisimpään käynnissä ensin),
  odottaa vastaustasi, vuoro käynnissä. Rivillä työtila, prosessin komento
  ja kesto, sekä *Pysäytä prosessi* tai *Pysäytä vuoro*. Pysäytetty rivi jää
  näkyviin (*Pysäytetty · paikka vapautui*). *Valmis* palaa korttiin, joka
  sanoo *Tilaa on nyt* ja tarjoaa *Aloita keskustelu*.
- **2.** Kortissa on itse lista, järjestettynä sen mukaan, milloin
  kirjoitit keskusteluun viimeksi (unohdetuin ensin: *Tähtikartan data*,
  kirjoitit 3 h 45 min sitten). Kolme riviä näkyy, *Näytä kaikki 12* avaa
  loput. Yksi pysäytys vaihtaa kortin suoraan *Tilaa on nyt* -muotoon.
- **3.** Kortissa työtilat painikkeina määrineen (*kotisivu 5*,
  *aurinkokello 4*, *muistiinpanot 3*), tämä työtila ensin. Painike avaa
  ikkunan sen työtilan kohdalta; ryhmän sisällä unohdetuin ensin, rivillä
  laji ja komento sekä milloin kirjoitit viimeksi.
- **Katsoja.** *Ylläpitäjä*: *Muuta rajaa (ylläpitäjä)* vie Ylläpito ›
  Palvelin -sivun osioon *Samanaikaiset keskustelut* (oletusraja
  muistiarvioineen ja henkilöiden taulukko, kuten kierroksessa 1).
  *Muu · nappi piilossa*: kortissa vain *Mitkä pitävät paikkaa?* ja *Yritä
  uudelleen*. *Muu · nappi pois käytöstä*: nappi näkyy harmaana ja sen alla
  syy.

Kaikissa listan rivin otsikko avaa keskustelun, jossa vuoro pysähtyy kentän
Stop-painikkeella ja kysymys ja prosessi ilmoituksen painikkeella.
*Alusta* aloittaa alusta.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-06-samanaikaiset-keskustelut-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-samanaikaiset-keskustelut-2/check.mjs \
  design-system/prototypes/dist/samanaikaiset-keskustelut-2/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen riffin läpi 1440 px ja 390 px (kosketus) vaaleana
ja tummana: kieltäytyminen ylläpitäjälle ja kahdella tavalla muulle,
uudelleenyritys täynnä, lista riffin tavalla, pysäytys ja uusi keskustelu
käynnissä; 1:ssä lisäksi ylläpitäjän henkilökohtainen raja. Kuvat
kertoimella 2, konsoli puhdas (280 tarkistuspistettä). `index.html` on sama
ilman upotettuja fontteja glasspadia varten.
