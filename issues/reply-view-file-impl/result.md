# Vastaa näkymään tai tiedostoon: toteutus

Toteutettu kokeellisen `reply-to-message`-kytkimen taakse kierroksen 1
suunnan C mukaan, lainauksessa vain otsikko (Jari 27.11.2026).

## Mitä tehtiin

- **Sopimus:** `pi-message.schema.json`:n `reply_to` sai valinnaisen
  `path`-kentän (yksi tiedosto usean tiedoston tarjouksesta), ja historian
  `replyTo` sai valinnaisen `offer`-kentän (`kind`: `view`, `file` tai
  `files`, `title`, `path`).
- **Daemon** (`internal/daemon/reply_linux.go`, `reply_offer_linux.go`):
  vastauksen kohde haetaan keskustelun nykyiseltä haaralta. Se voi olla
  agentin viesti tai `oh-agent-notice`-merkintä, jossa on näkymä tai
  tiedostotarjous. Tarjouksen tiedot luetaan henkilön omasta
  tarjousvarastosta. Kohde hylätään (409 `reply_target_gone`), jos se ei
  ole tällä haaralla, tarjous on poistettu, polkua ei ole tarjouksessa tai
  polku annetaan viestille tai näkymälle. Huonosti muodostettu polku saa
  vastauksen 400.
- **Lohko** (`internal/replyblock/offer.go`): sama `<reply-to entry="…">`,
  rungossa englanniksi esim. `File "henkilosto.csv" in the files you
  offered as "Liitteet" (offer_id …)` ja `Source: liitteet/henkilosto.csv ·
  CSV table · 18 KB`. Otsikko ja polku ovat Go-lainattuja, joten lainausmerkit
  tai rivin omat sanat nimessä eivät muuta, mitä rivi nimeää. Historia lukee
  ensimmäisen rivin takaisin `offer`-kentäksi.
- **Selain:** ↩ on aina näkymä- ja tiedostokortin oikeassa yläkulmassa
  (`OfferCard`:n `reply`), ja kansion jokaisella tiedostorivillä on oma ↩
  (`OfferFolder`:n `rowReply`). Puhelimessa rivin ↩ sulkee paneelin ja vie
  kenttään. Kentän lainaus näyttää vain otsikon: "Vastaat
  näkymään/tiedostoon/tiedostopakettiin", enintään kaksi riviä ja "…". Myös
  lähetetyn viestin lainaus näyttää otsikon ("Agentin näkymä/…"), ja sen
  napautus vie korttiin. Paneeli on keskustelupuun ulkopuolella, joten
  keskustelu antaa vastaustoiminnon pienen tilan kautta (`app/offerReply.ts`).
  Lähetyspolun kohde on nyt `{entry_key, path?}` eikä pelkkä avain.
- **Testi-isäntä:** valekumppani osaa `notice`-operaation, ja näkymä- ja
  tiedostofixtureilla on `native=1`-tila, joka kirjoittaa ilmoituksen
  natiiviin istuntoon samaa reittiä kuin agentin tarjous.

## Tarkistus

`umask 077` -ajona `./scripts/test-focused.sh` alueille go, contracts ja web
meni läpi. Selainspeksit `reply-view-file` (näkymäkortti, tiedostokortti ja
kansion yksi tiedosto 1440 ja 390 px:n leveydellä, kytkin pois),
`reply-to-message`, `agent-file-offers`, `agent-views`, `agent-notices`,
`settings-experimental`, `multiplayer` ja laboratorion tarjousspeksit
menivät läpi. UI-viitteet on generoitu uudelleen.

Kohdennetussa riippumattomassa katselmoinnissa (gpt-6-astra) löytyi kolme
vikaa, jotka kaikki on korjattu ja testattu:

- Lainausmerkin sisältävä polku jäsentyi takaisin väärin, ja liian pitkä
  otsikko olisi kaatanut koko historiasivun skeematarkistuksen.
- Kaksi samannimistä lähdettä (`client/dist` ja `server/dist`) antoi
  arvatun lähteen.
- Polun reunavälilyönnit leikattiin pois, joten lohko saattoi nimetä toisen
  tiedoston.

## Live check

Ei vielä testikoneella. Kokeiltava ohje on rivinä KOKEILTAVAA.md:n kohdassa
Työn alla: kytkin päälle, agentti tarjoaa näkymän, yhden tiedoston ja kansion,
sitten vastaukset kortteihin ja kansion riville, myös puhelimella. Kysy
agentilta, mihin vastasit: sen pitää nimetä oikea tarjous ja tiedosto.

## Päätökset myöhempään katselmointiin

- Historian `offer` luetaan lohkon ensimmäiseltä riviltä eikä etsitä
  ilmoitusta samasta istuntotiedoston läpikäynnistä, kuten kierros
  ehdotti. Sivutettu historialuku ei näe ilmoitusta aina samalla sivulla, ja
  näin terminaali, Claude-silta ja tiivistetty konteksti lukevat saman
  viittauksen. Jos henkilö kirjoittaa saman muotoisen lohkon itse, se
  harhauttaa vain häntä itseään, kuten viestin lohkokin.
- Pakettitiedoston rivillä polku on lainausmerkeissä (`File "polku" in the
  files you offered as "…"`), toisin kuin kierroksen luonnoksessa.
- Kohteen omistajuuden ratkaisee ilmoitus nykyisellä haaralla. Tarjouksen
  `conversation_id`:tä ei verrata, joten haarautetun keskustelun kortteihin
  voi vastata.
- Myös näkymään vastaaminen vaatii, että näkymän manifesti on yhä
  varastossa. Poistettu näkymä hylätään samoin kuin poistettu tiedosto.
- Tiedoston ↩ näkyy vain, kun tarjouksen ilmoitus on keskustelun ladatussa
  historiassa. Vain juuri saapunut ilmoitus, jota ei vielä ole natiivissa
  historiassa, saa ↩:n vasta historian päivittyessä.
- Jos kahdella lähteellä on sama nimi, lähdepolku jätetään pois eikä sitä
  arvata.
- Kokeellisen ominaisuuden kuvaus (`internal/experimental/catalog.json`)
  mainitsee nyt kortit ja tiedostorivit.
- Testi-isännän valekumppani kuuntelee nyt myös silloin, kun
  `reply-to-message` on päällä, ei vain moninpelissä.
