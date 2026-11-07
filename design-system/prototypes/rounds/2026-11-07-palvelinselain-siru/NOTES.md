# Oma palvelinselain – kierros 3: siru ja palkki

Issue `proto-remote-browser-session`. Jari päätti 7.11.2026 kierroksen 2
jälkeen: keskustelussa on **siru**, josta aukeaa kierroksen 2 suunnan 2
kaltainen **palkki** pienine kuvineen. Agentilla voi olla **useita
selainikkunoita** auki yhtä aikaa, joten siru ja palkki kantavat useita.
**Agentin osoittimen ja klikkausten pitää näkyä** kuvissa ja arkissa.
Henkilön oma selain on **yksi rivi vasemmassa sivupalkissa**: tila, mikä
keskustelu ohjaa, ja painamalla aukeaa arkki. Kierroksista 1 ja 2 säilyvät
Pyydettäessä-arkki, yksi selain henkilöllä yhteisenä hänen agenteilleen ja
*Siirrä tälle*, kun toinen keskustelu haluaa selaimen.

Kierros on rakennettu tuotannon komponenteista (`AppShell`, `WorkspaceRail`,
`AgentNavItem`, `AgentHeader`, `ConversationFrame`, `ConversationTimeline`,
`UserMessage`, `AgentTurn`, `PiToolUse`, `Composer`, `ControlButton`,
react-aria `Modal`). Etäsivut ovat mockeja, kaikki on synteettistä.

## Riffit

- **1 Siru vuorossa**: siru agentin vuoron lopussa avaa palkin keskusteluun; osoitin on nimetty piste, ja selain on sivupalkin ylin rivi.
- **2 Siru kentän yllä**: siru kirjoituskentän yllä kaikissa keskusteluissa avaa palkin kentän päälle; osoitin on nuoli, jonka perässä näkyvät viimeiset klikkaukset, ja sivupalkin rivillä on pieni kuva.
- **3 Siru otsikossa**: siru otsikkorivillä avaa palkin otsikon alle, ja ikkuna, jossa agentti toimii, on siinä isona; osoittimessa lukee keskustelun nimi, ja selain on sivupalkin alin rivi.

Suositus: **1 Siru vuorossa**, osoittimena riffin 2 nuoli ja klikkausten
jälki (issuen `result.md`).

## Sama kaikissa

- Tarina: *Lokakuun ostolaskut* lataa laskuja Netvisorista ja avaa työn
  aikana kaksi ikkunaa lisää (kustannuspaikkaraportti ja AWS:n lasku).
  *Rekrytointi: myyjä* sai vastauksen "selain on toisen keskustelun
  käytössä" ja odottaa vuoroaan. Kesken työn Netvisor pyytää koodia.
  Lopuksi agentti sulkee ylimääräiset ikkunansa, ja selain siirtyy
  odottavalle keskustelulle, joka avaa omat ikkunansa.
- **Siru** on yksi rivi: maapallo, *Selain*, yksi pieni laatikko ikkunaa
  kohden (se, jossa agentti toimii, on korostettu), ikkunoiden määrä ja kuka
  selainta käyttää. Painallus avaa ja sulkee palkin. Oletuksena palkki on
  auki.
- **Palkki** näyttää jokaisen ikkunan pienenä kuvana nimen kanssa. Ikkunan,
  jossa agentti toimii, alla lukee *agentti tässä*. Alla on agentin nykyinen
  toimi, yksi toiminto (*Ota ohjaus*, *Syötä koodi*, *Siirrä tälle* tai
  *Anna takaisin agentille*) ja tieto odottavasta keskustelusta.
- **Osoitin** liikkuu ja klikkaa kuvissa ja arkissa sitä mukaa kuin agentti
  toimii. Viimeisin klikkaus jää renkaaksi, joten pysäytyskuvastakin näkee,
  mitä agentti painoi. Osoitin näkyy vain ikkunassa, jossa agentti toimii, ja
  vain agentin ohjatessa; kun Aino ohjaa, osoitin on hänen omansa.
- **Kuvan painaminen** avaa arkin siihen ikkunaan. Arkissa ikkunat ovat
  välilehtinä, ja *Seuraa agenttia* vaihtaa välilehteä agentin mukana.
  Agentin ohjatessa arkki on vain katseltava. Etänäyttö skaalataan arkkiin
  tasaisesti kuten noVNC tekee, joten osoitin osuu samaan kohtaan kuin
  pienessä kuvassa.
- **Sivupalkin rivi** *Oma selain* kertoo, kuka selainta käyttää ja montako
  ikkunaa sillä on auki, ja avaa arkin. Puhelimessa rivi on valikon takana.

## Mitä riffit päättävät

- **1** pitää sirun siinä keskustelussa, jonka työtä se kuvaa: agentin
  vuoron lopussa. Palkki aukeaa historian sisään ja vierittyy sen mukana.
  Valmiin keskustelun siru jää historiaan (*Valmis klo 10.19*), ja palkissa
  on viimeinen sivu. Odottavassa keskustelussa siru kertoo, kuka selainta
  käyttää, ja palkissa näkyvät sen ikkunat haalistettuina ja *Siirrä tälle*.
  Sivupalkin ylin rivi kertoo saman kaikista keskusteluista.
- **2** tekee sirusta yhteisen selaimen paikan: se on kentän yllä jokaisessa
  keskustelussa ja näyttää selaimen sellaisena kuin se on nyt, käytti sitä
  kuka tahansa. Palkki aukeaa kentän päälle eikä vierity pois. Osoitin on
  järjestelmän nuolen näköinen, ja kaksi edellistä klikkausta näkyvät sen
  perässä haalistuvina pisteinä. Sivupalkin rivillä on pieni elävä kuva.
- **3** nostaa sirun otsikkoriville, jossa se näkyy aina vierityksestä
  riippumatta. Palkki aukeaa otsikon alle, ja ikkuna, jossa agentti toimii,
  on siinä isona (352 × 220 px) ja muut pieninä vieressä. Osoittimen
  nimilappu on keskustelun nimi. Puhelimessa siru on pelkkä maapallo ja
  määrä, koska otsikkorivi on ahdas, ja palkki vie noin puolet näytöstä.
  Sivupalkin rivi on alimpana tilivalikon yllä.

## Ohjaimet

Yläpalkissa ovat teema, keskustelu (sama kuin sivupalkin valinta) ja kolme
kohtausta: **Alusta** (agentti työssä kolmessa ikkunassa, oletus), **Odottaa
sinua** (Netvisor pyytää koodia) ja **Valmis** (ostolaskut valmis, selain
siirtyi rekrytoinnille, joka valmistuu muutaman sekunnin päästä). Agentti
etenee noin 2,4 sekunnin välein. Koodikenttään kelpaa mikä tahansa kuusi
numeroa. Valitsin alhaalla vaihtaa riffiä.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-07-palvelinselain-siru/build.mjs
node design-system/prototypes/rounds/2026-11-07-palvelinselain-siru/check.mjs \
  design-system/prototypes/dist/palvelinselain-siru/offline.html <kuvahakemisto>
```

`build.mjs` tarvitsee `web/node_modules`-hakemiston committoidusta lukosta.
`check.mjs` käy jokaisen riffin tarinan läpi 1440 ja 390 px vaaleana,
oletukset myös tummana, ja kirjoittaa kuvat kertoimella 2.
