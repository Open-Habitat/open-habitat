# Keskustelun konteksti – kierros 3

Issue `proto-conversation-context-view`. Jari (6.11.) piti kierroksen 2
(`2026-11-06-kontekstinakyma-2/`) riffejä sekavina: epäselvää, mitä
painikkeista tapahtuu, mistä "ennusteet" tulevat ja mitä "Ohje riviltä"
tarkoittaa. Tämä kierros yksinkertaistaa **B Koko**n kierroksen 2
tutkimuksen todellisilla toiminnoilla: jokainen näkyvä tieto ja painike
sanoo tavallisin sanoin, mitä se on ja mitä painallus tekee, ja kaikki,
mitä ei voi selittää yhdellä lauseella, on jätetty pois. Jokaisen tiedon ja
painikkeen lähde on issuen `result.md`:ssä (kierros 3).

Rakennettu tuotannon komponenteista (`AppShell`, `WorkspaceRail`,
`AgentNavItem`, `AgentHeader`, `ContextRing`, `ContextPage`,
`ConversationTimeline`, `AgentTurn`, `PiToolUse`, `BashToolCard`,
`FileToolCard`, `Composer`, `Segmented`, `ControlButton`,
`DisclosureButton`, `TextArea`). Kierroksen osio tulee tuotannon
`ContextPage`-sivulle otsikon alle ja korvaa sen yläosan; tuotannon osat,
tiivistykset ja vuorot ovat piilossa (suunnassa 1 avattavissa). Kaikki on
synteettistä: Contoso, Aino Virtanen, Keskon viikkoraportti, 16 vuoroa, yksi
tiivistys.

## Akseli ja suunnat

Akseli: kuinka paljon sivulla on.

- **1 Selitetty**: neljä toimintoa (Tiivistä nyt ohjeella, Palaa ennen tätä, Lue uudelleen, Avaa), jokaisen vieressä lause siitä, mitä se tekee; Pi:n omat luvut avattavina lopussa.
- **2 Lista ja tiivistys**: sama lista, mutta toimintoina vain Tiivistä nyt ohjeella ja tekstitiedoston Avaa; ei Pi:n omia lukuja.
- **3 Pelkkä lista**: luku ja lista; ainoa nappi on Tiivistä nyt ilman ohjetta, eikä riveillä ole nappeja.

Suositus: **2 Lista ja tiivistys** (result.md).

## Sama kaikissa suunnissa

- Lause siitä, mitä konteksti on, luku (62 %, 124 900 / 200 000 tokenia),
  yksi palkki ja viiva automaattisen tiivistyksen kohdalla, ja lause siitä,
  mitä token ja viiva tarkoittavat.
- **Tiivistä nyt…** ja sen vieressä lause siitä, mitä se tekee. Vahvistus
  kertoo kellonajoin, mitkä viestit tiivistyvät ja mitkä jäävät (ja miksi),
  mitä jäävissä on, ja koon tiivistyksen jälkeen. Heti tiivistyksen jälkeen
  nappi vaihtuu tilariviksi, koska Pi ei tiivistä uudelleen ennen kuin
  keskustelu jatkuu.
- **Mihin tila kuluu**: kaksi ryhmää, *Agentti näkee kokonaan* (koko
  tokeneina, suurin ensin) ja *Vain yhteenvedossa* (ei vie tilaa), kummallakin
  yhden lauseen selitys. Rivillä nimi, lähde ja mitä agentti teki
  kellonaikoina (ei vuoronumeroita).
- Suodatin **Kaikki / Vain tiedostot**: kaikki tiedostot, jotka agentti luki
  tai muutti, myös vain yhteenvedossa olevat; lause kertoo, ettei skriptillä
  kirjoitettu tiedosto näy muutettuna.
- Pois kierroksesta 2: ennustesarake ja "Tiivistyy seuraavaksi" -ryhmä,
  Mainitse/Ohita, toinen kokopalkki, "Erittelemätön", vara- ja
  säilytysluvut, vuoronumerot, "komennolla"-merkintä.

## Yläpalkin ohjaimet

- *Teema*: Vaalea / Tumma.
- *Alusta* palauttaa tarinan alkuun: ei tiivistystä, ei paluuta, viestikenttä tyhjä.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-06-kontekstinakyma-3/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-kontekstinakyma-3/check.mjs \
  design-system/prototypes/dist/kontekstinakyma-3/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen suunnan läpi 1440 ja 390 px vaaleana: oletus (mitkä
napit on ja mitkä ei), Vain tiedostot, tiivistysikkuna ja tiivistetty tila;
suunnassa 1 lisäksi Lue uudelleen, Palaa ennen tätä ja Pi:n omat luvut.
Oletukset myös tummana. Kuvat kertoimella 2, nimet
`r3-<suunta>-<vaihe>-<leveys>-<teema>`. `index.html` on sama ilman upotettuja
fontteja glasspadia varten.
