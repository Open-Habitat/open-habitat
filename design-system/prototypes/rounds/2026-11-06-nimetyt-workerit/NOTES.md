# Nimetyt workerit – kierros 1

Issue `proto-named-workers`. Jari 6.11.: nimetty tukiagentti tekee työn,
sen viestit tulevat pääagentin keskusteluun, se jää hiljaa odottamaan, ja
pääagentti tai ihminen voi lähettää sille seuraavan viestin. Mekanismi
suunnitellaan rinnalla (`design-named-workers`). Kierros olettaa siitä vain
workerin, joka raportoi, odottaa ja ottaa vastaan seuraavan viestin.

Tänään workerit ovat kertaworkereita. Worker näkyy kentän yllä olevassa
Workerit-merkissä ja sen paneelissa. Sen valmistuminen tulee keskusteluun
`taskfleet run wait` -merkintänä (*odota … · valmis · herätti agentin*),
ja laskeutunut worker katoaa listalta. Seuraava pyyntö käynnistää uuden
workerin, joka lukee issuen ja aiemmat kierrokset alusta.

Kierros on rakennettu tuotannon komponenteista (`AppShell`,
`WorkspaceRail`, `AgentNavItem` sisennyksineen, `AgentHeader`,
`ConversationTimeline`, `UserMessage`, `AssistantMessage`, `WorkerBrief`,
`WorkerVoice`, `Composer`, `StatusMark`, `ControlButton`). Nyt-tilan
Workerit-merkki ja -paneeli ovat tuotannon `BackgroundStrip`, ja odotuksen
merkintä on `ProcessCompletion`. Hostin paikalla on `fetch`-sijainen.
Kierroksen omia ovat A:n paneeli ja raporttikortti, B:n raporttilinkki ja
workerin keskustelun yläreunan nauha, sekä C:n workerin viesti, viesti
workerille ja Kenelle-valinta. Kaikki on synteettistä.

## Suunnat

Akseli: missä nimetty worker asuu Habitatissa.

- **Nyt**: kertaworkerit. Kierroksen 2 worker laskeutui ja poistui; seuraava pyyntö käynnistää uuden workerin, joka lukee kaiken alusta.
- **A Rivit**: nimetty worker on rivi Workerit-paneelissa: tila, viimeisin viesti, Kirjoita ja Lopeta ja yhdistä. Keskustelussa raportti on tiivis kortti.
- **B Omat keskustelut**: worker on oma pieni keskustelunsa sivupalkissa pääkeskustelun alla. Raportti on keskustelussa linkkinä, ja workerille kirjoitetaan sen omassa näkymässä.
- **C Keskustelussa**: workerin vastaukset tulevat kokonaisina pääkeskusteluun, ja kentän Kenelle-valinta lähettää viestin workerille.

Oletusnäkymä on kaikissa sama hetki. Kapellimestarin keskustelussa
*Rupeama 6.11.* (työtila `open-habitat`) prototyyppari on toimittanut
M365-asetuksen kierroksen 2 (A1 Valikkopala, A2 Valikon järjestyksessä,
A3 Olet nyt; suositus A1), ja pääagentti on kertonut sen. Nimetyissä
suunnissa worker *Prototyyppari: M365-asetus* odottaa viestiä. Seuraava
viesti on *riffaa A1:tä oikeilla kuvakaappauksilla*. *Alusta* aloittaa
alusta.

## Mitä kussakin tapahtuu

- **Nyt.** Ihminen kirjoittaa pyynnön pääagentille. Pääagentti sanoo,
  että edellinen worker on poistunut, ja käynnistää uuden workerin
  *proto-m365-setup-flow: kierros 3*, joka lukee aiemmat kierrokset
  alusta. Kentän yllä näkyy Workerit-merkki, ja paneelissa rivi *agentti
  odottaa*. Valmistuessaan tulee toinen odotusmerkintä ja pääagentin
  yhteenveto, ja merkki katoaa: worker laskeutui itse. Lopetettavaa ei ole.
- **A.** Kentän yllä on auki Workerit-paneeli. Sen rivi *Prototyyppari:
  M365-asetus* kertoo tilan (*Odottaa viestiä*, *Työskentelee*,
  *Yhdistetään työtä…*, *Lopetettu · työ yhdistetty*) ja viimeisimmän
  viestin, ja *Viestit (2)* avaa koko vaihdon riveinä. *Kirjoita* avaa
  rivin sisään kentän, josta viesti lähtee suoraan workerille.
  Keskustelussa viesti näkyy rivinä *Sinä → Prototyyppari* ja raportti
  tiiviinä korttina (*Näytä raportti* avaa sen). Pääagentti kommentoi
  raportin. *Lopeta ja yhdistä* rivissä lopettaa workerin ja yhdistää sen
  haaran; keskusteluun tulee merkintä, ja rivi jää näyttämään tuloksen.
  Työskennellessä Kirjoita ja Lopeta ovat poissa käytöstä ja kertovat
  syyn.
- **B.** Worker on sivupalkissa omana rivinään pääkeskustelun alla
  (sisennettynä) ja siirtyy Käynnissä-osioon työskennellessään.
  Pääkeskustelussa raportti on kortti *vastasi omassa keskustelussaan* ja
  *Avaa prototyypparin keskustelu*. Workerin keskustelussa ovat
  pääagentin tehtävä (*Pääagentti · tehtävä*), workerin vastaukset ja
  ihmisen omat viestit (*Sinä*). Yläreunan nauha vie takaisin
  pääkeskusteluun, kertoo, että viestit näkyvät myös pääagentille, ja
  siinä on *Lopeta ja yhdistä*. Kenttä kirjoittaa workerille.
- **C.** Otsikon alla on rivi *Workerit* ja workerin tila. Workerin
  vastaus tulee pääkeskusteluun kokonaisena omalla nimellään, ja
  viimeisen vastauksen alla ovat *Vastaa prototyypparille* ja *Lopeta ja
  yhdistä*. Kentän yllä on *Kenelle: Pääagentti | Prototyyppari*; Vastaa
  valitsee workerin. Viesti workerille näkyy kuplana *Sinä → Prototyyppari:
  M365-asetus*, pääagentin välittämä katkoviivakehyksessä *Pääagentti →
  …*. Kun worker on lopetettu, valinta poistuu.

Kaikissa nimetyissä suunnissa voi myös pyytää pääagenttia: kenttään
kirjoitettu viesti menee pääagentille, joka sanoo *Välitän tämän
prototyypparille*, ja välitetty viesti näkyy keskustelussa.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-06-nimetyt-workerit/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-nimetyt-workerit/check.mjs \
  design-system/prototypes/dist/nimetyt-workerit/offline.html <kuvahakemisto>
```

`check.mjs` käy Nyt-tilan ja jokaisen suunnan kulun läpi 1440 px ja 390 px
(kosketus) vaaleana ja tummana: odottaa, viesti workerille, työskentelee,
raportti pääkeskustelussa, lopetus ja yhdistäminen. B käy myös
sivupalkin kautta, ja C toisella kierroksella pääagentin kautta. Kuvat
kertoimella 2, konsoli puhdas (244 tarkistuspistettä). `index.html` on
sama ilman upotettuja fontteja glasspadia varten.
