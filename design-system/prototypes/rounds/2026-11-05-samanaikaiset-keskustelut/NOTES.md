# Samanaikaiset keskustelut – kierros 1

Issue `proto-live-conversation-limit-setting`. Jari 5.11.: samanaikaisten
keskustelujen rajasta tehdään asetus; missä se on ja miltä se näyttää.
Tänään daemonin vakio (`maxLiveConversations = 4`) kieltäytyy uudesta
keskustelusta kortilla *Keskustelua ei luotu*, jossa on *Yritä uudelleen*
ja *Muokkaa*. Mikään ei kerro, mitkä neljä pitävät paikkaa. Taustaprosessin
takia varattu keskustelu näkyy sivupalkissa *Odottaa taustatyötä*, ja
kysyvä keskustelu on Sinun vuorosi -osiossa, joten paikkoja on vaikea laskea
itse.

Kierros on rakennettu tuotannon komponenteista (`AppShell`,
`WorkspaceRail`, `AgentNavItem`, `AgentHeader`, `ConversationTimeline`,
`UserMessage`, `AssistantMessage`, `WaitingMessage`, `Composer`,
`InlineNotice`, `StatusMark`, `WarningBanner`, `InlineTextSetting`,
`AccountSettings` Tekoäly-osioineen ja ylläpidon Palvelin-osio). Tekstit
*Keskustelua ei luotu*, *Yritä uudelleen*, *Muokkaa*, nykyinen
kieltäytymisteksti ja sivupalkin tilasanat (*Työskentelee*, *Kysyy
sinulta*, *Odottaa taustatyötä*) tulevat tuotannon katalogeista. Hostin
paikalla on `fetch`-sijainen. Kierroksen omia ovat kieltäytymiskorttien
sisältö, paikkaa pitävien lista, A:n asetuskortti ja sivupalkin mittari,
B:n ikkuna ja ylläpidon osio, sekä taustaprosessin ilmoitus avatussa
keskustelussa (tuotannossa prosessin pysäyttää keskustelun taustatyön
palkki). Asetussivun rivit on sijoitettu tuotannon sivun sisään portaalilla.
Kaikki on synteettistä.

## Suunnat

Akseli: kuka rajan asettaa ja missä ihminen näkee, mikä pitää paikkaa.

- **Nyt**: vakio neljä. Uusi keskustelu kieltäytyy, Yritä uudelleen yrittää samaa, eikä mikään kerro, mitkä neljä pitävät paikkaa.
- **A Oma**: raja on henkilön oma asetus Asetukset › Tekoäly -sivulla. Kieltäytyminen vie sinne; asetuksen alla näkyy, mikä työskentelee nyt, ja sen voi pysäyttää.
- **B Ylläpitäjä**: ylläpitäjä asettaa oletuksen koko asennukselle ja tarvittaessa henkilöittäin (Ylläpito › Palvelin). Kieltäytyminen avaa ikkunan, jossa paikkaa pitävät voi pysäyttää.
- **C Ei lukua**: ei asetusta. Palvelin kieltäytyy vain, kun muisti loppuu, ja kieltäytyminen näyttää itse listan siitä, mikä työskentelee nyt.

Oletusnäkymä on kaikissa sama hetki: olet työtilassa *kotisivu* aloittanut
uuden keskustelun viestillä "Tee etusivulle tumma teema…", ja se ei
käynnistynyt. Nyt-tilassa työskentelee neljä keskustelua (tämän päivän
vakio), suunnissa kuusi: kolme vuoroa, yksi kysymys sinulle ja kaksi
taustaprosessia (`npm run dev`, `make images`). *Alusta* aloittaa alusta.

## Mitä kussakin tapahtuu

- **Nyt.** Kortti sanoo tuotannon tekstin *Neljä keskustelua työskentelee
  jo — odota, että jokin vuoro päättyy, tai pysäytä se.* *Yritä uudelleen*
  kieltäytyy taas. Ihminen avaa sivupalkista keskustelun (*Kesäajan virhe*)
  ja painaa kentän Stop-painiketta; palattuaan *kotisivu*-työtilaan *Yritä
  uudelleen* luo keskustelun.
- **A.** Sivupalkin Käynnissä-otsikossa on mittari *6/6 paikkaa*
  (punainen täynnä). Kortti: *Kuusi keskustelua työskentelee jo, ja
  asetuksissa rajasi on 6.* ja *Rajat ja käynnissä olevat*, joka avaa
  Asetukset › Tekoäly -sivun rivin *Yhtä aikaa työskentelevät keskustelut*
  (oletus 6, palvelin sallii enintään 30). Sen alla *Työskentelee nyt ·
  6/6* ja lista, jonka riviltä voi pysäyttää vuoron tai prosessin ja jonka
  otsikko avaa keskustelun. Rajan nosto tallentuu kentästä poistuttaessa
  tai Enterillä. Asetusten sulkeminen palaa korttiin, joka sanoo nyt *Tilaa
  on nyt* ja *Aloita keskustelu*.
- **B.** Kortti: *Ylläpitäjän asettama raja on 6 yhtä aikaa työskentelevää
  keskustelua, ja kuusi työskentelee jo.* ja lajit merkkeinä (3 vuoroa
  käynnissä, 1 odottaa vastaustasi, 2 taustaprosessia). *Mitkä pitävät
  paikkaa?* avaa ikkunan, jossa on sama lista ja pysäytys; *Valmis*
  palaa korttiin, joka tarjoaa *Aloita keskustelu*. Koska Jari on
  ylläpitäjä, kortissa on myös *Muuta rajaa (ylläpito)*: Ylläpito ›
  Palvelin -sivun loppuun tulee osio *Samanaikaiset keskustelut*:
  oletusraja henkilöä kohden (muistin arvio ohjeena) ja taulukko
  henkilöistä (työskentelee nyt / raja, oletus tai oma, *Muuta*), kuten
  levytilan rajat. Muulle kuin ylläpitäjälle kortti ei näytä tätä
  painiketta.
- **C.** Ei asetusta eikä lukua. Kortti: *Palvelimen muisti ei riitä
  uuteen keskusteluun juuri nyt. Nämä työskentelevät; pysäytä jokin, niin
  paikka vapautuu.* ja lista suoraan kortissa. Yksi pysäytys vaihtaa kortin
  muotoon *Tilaa on nyt* ja *Aloita keskustelu*.

Kaikissa suunnissa listan rivin otsikko avaa keskustelun, jossa vuoro
pysähtyy kentän Stop-painikkeella, kysymys ja prosessi ilmoituksen
painikkeella.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-05-samanaikaiset-keskustelut/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-05-samanaikaiset-keskustelut/check.mjs \
  design-system/prototypes/dist/samanaikaiset-keskustelut/offline.html <kuvahakemisto>
```

`check.mjs` käy Nyt-tilan ja jokaisen suunnan kulun läpi 1440 px ja 390 px
(kosketus) vaaleana ja tummana: kieltäytyminen, pysäytys suunnan paikassa,
A:n rajan nosto, B:n ikkuna ja ylläpitäjän henkilökohtainen raja, ja uusi
keskustelu käynnissä. Kuvat kertoimella 2, konsoli puhdas (184
tarkistuspistettä). `index.html` on sama ilman upotettuja fontteja
glasspadia varten.
