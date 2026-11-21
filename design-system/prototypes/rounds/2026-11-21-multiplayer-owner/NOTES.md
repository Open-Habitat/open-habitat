# Moninpeli: omistajan näkymä

- **1 Kaista**: kentän yllä oleva kaista kertoo tilan (Vain teksti /
  Työkalut käytössä) ja kenen viesti sen määräsi. Kun pyyntö odottaa,
  kaistalla ovat Voit jatkaa ja Hyväksy yksitellen. Yksitellen hyväksyntä
  tapahtuu ikkunassa toimi kerrallaan.
- **2 Merkki**: jokaisen agentin vastauksen otsikossa on tilamerkki
  (Vain teksti, Työkalut käytössä, luotettu, yksitellen). Tekstivastauksen
  alla ovat Voit jatkaa ja Hyväksy yksitellen. Yksitellen hyväksyntä
  tapahtuu ikkunassa.
- **3 Kortti** (suositus): agentti pysähtyy korttiin, joka luettelee
  aiotut toimet (työkalu ja kohde). Omistaja sallii kaikki kerralla
  (Voit jatkaa (kaikki)) tai rivi kerrallaan (Salli / Älä salli).
  Ratkaistu kortti jää historiaan päätöksineen.

Issue `multiplayer-conversations`. Suunnat, suositus ja kysymykset Jarille
ovat issuen `result-owner.md`:ssä. Osallistujan näkymä on rinnakkainen
kierros `2026-11-21-multiplayer-guest`.

## Sanasto (yhteinen osallistujan kierroksen kanssa)

Omistaja / Owner, Osallistuja / Participant, Luotettu / Trusted; vuoron
tila Vain teksti / Text only ja Työkalut käytössä / Tools on; omistajan
vastaukset Voit jatkaa / Go ahead ja Hyväksy yksitellen / Approve one by
one. Osallistujan kierros lisää toimen tilan Odottaa Ainoa. Muutos
kirjataan molempiin kierroksiin.

## Maailma

Aino Laine (sinä, Omistaja) avasi keskustelun Kevätkokouksen sivu
työtilassaan `yhdistys-sivut`. Ville Virtanen ja Maija Koski ovat
Osallistujia samalla palvelimella, ja molemmat ovat paikalla. Pekka
Korhonen on palvelimella, mutta ei keskustelussa. Alkutilassa Ainon
vuorolla oli työkalut (`edit`, `npm run build`). Ville pyysi lisäämään
ilmoittautumislinkin ja julkaisemaan sivun, ja agentti vastasi vain
tekstillä. Kaksi toimea odottaa (`edit content/events/kevatkokous.md` ja
`bash npm run deploy`).

Kulut ovat seuraavat:

- **Voit jatkaa** lähettää Ainon viestin "Voit jatkaa.", joten tavallinen
  sääntö pätee: viimeisin viesti on omistajan, ja agentti tekee toimet
  työkaluilla.
- **Hyväksy yksitellen** ratkaisee toimet yksi kerrallaan. Sen jälkeen
  Villen pyyntö jatkuu vuorolla, jossa ovat vain sallitut toimet. Estetty
  toimi näkyy yliviivattuna rivinä, jonka tila on Et sallinut.
- **Ainon oma viesti** (luonnos valmiina kentässä) ratkaisee odottavan
  pyynnön, ja agentilla on taas kaikki työkalut.
- **Osallistujat** avautuvat otsikon alla olevasta rivistä (avatarit,
  läsnäolo ja luotetut). Paneelissa voi merkitä luotetuksi
  (vahvistusikkuna kertoo, mitä lainataan), poistaa luottamuksen ja poistaa
  osallistujan keskustelusta.
- **Kutsu** avaa ikkunan, jossa on palvelimen ihmiset. Kutsuttu näkyy
  rivissä katkoviivaisella läsnäolomerkillä.
- **Ville kirjoittaa** ja **Maija kirjoittaa** yläpalkissa simuloivat
  osallistujan viestin. Luotetun Villen viesti saa työkaluvuoron. Maijan
  kysymykseen riittää tekstivastaus, joten pysähdystä ei synny.

`?theme=light|dark|contrast` ja `?lang=en` valitsevat alkutilan.

Sivu koostuu tuotannon osista: `AppShell`, `WorkspaceRail`,
`AccountShelf`, `AgentHeader`, `ConversationFrame`, `ConversationStream`,
`ConversationTimeline`, `UserMessage`, `AssistantMessage`, `ToolRow`,
`HabitatMark`, `ControlButton`, tuotannon dialogirakenne (react-aria
`ModalOverlay`/`Modal`/`Dialog`, `HelperArchive.css`) sekä tuotannon
`Composer`. Suunnan 1 kaista on Composerin `beforeField`-paikassa.
Kierroksen omia osia ovat nimet, avatarit ja roolit viesteissä, vastauksen
"vastaus: Ville", tilamerkit, vapautuskontrollit, osallistujarivi ja sen
paneeli sekä kutsu- ja luottamusikkunat. Tuotannon `UserMessage` sanoo
aina "Sinä". Kierros piilottaa sen CSS:llä ja tuo nimen otsikkoon
portaalilla, kuten osallistujan kierros. Tuotannossa tämä olisi viestin
`author`-kenttä. Valitsimen otsikot pidetään yhdellä rivillä kierroksen
omalla säännöllä (`white-space: nowrap`), koska 390 px:n leveydellä ne
muuten rivittyivät.

## Hostin puoli: miten daemon pitäisi tekstivuoron tekstinä

Lyhyesti: työkalut otetaan pois Pi:n tasolla tältä vuorolta, ei
kehotteella. Osallistujan viesti on juuri se syöte, joka voi yrittää
ohittaa kehotteen. Osallistujan kierroksen NOTES.md kuvaa mekanismin
tarkemmin, ja tämä näkymä olettaa saman.

1. Daemon tietää lähettäjän vierasreitin identiteetistä ja päättää
   omasta jäsenlistastaan, onko tämä omistaja, luotettu vai osallistuja.
   Selain ei päätä tilaa. Daemon kertoo selaimelle vuoron tilan, sen
   aloittajan ja odottavat toimet.
2. Ennen kuin osallistujan viesti annetaan Pi:lle, Habitatin oma
   Pi-laajennus (sama tapa, jolla daemon jo lataa `process-extension`- ja
   `rewind-extension`-laajennukset) asettaa `pi.setActiveTools([])`.
   Mallille ei silloin tarjota työkaluja.
3. Raja on saman laajennuksen `tool_call`-koukku. Vain teksti -tilassa se
   palauttaa jokaiselle kutsulle `{ block: true, reason }`, koska
   aktiivisten työkalujen tyhjentäminen ei yksin kata codemode- ja
   deferred-kutsuja.
4. Omistajan viesti, myös Voit jatkaa, palauttaa työkalut ennen kuin
   viesti menee Pi:lle. Luotetun viesti tekee saman.
5. Hyväksy yksitellen on jatkovuoro. Tekstivuorossa agentti kirjaa
   aikomansa toimet. Omistajan päätösten jälkeen daemon käynnistää
   vuoron, jossa `tool_call` päästää läpi vain hyväksytyt kutsut.
   Kortin rivit ovat nämä kirjatut toimet.
6. Rajoitus: tämä estää uudet kutsut, mutta ei aiempien vuorojen
   prosesseja eikä agentin aiemmin kirjoittamia skriptejä. Se ei ole
   Unix-käyttäjien välinen turvaraja (research.md). Siksi luotetuksi
   merkitseminen kerrotaan omistajalle tunnusten lainaamisena.

Prototyyppi ei toteuta näistä mitään.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-21-multiplayer-owner/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 580 \
  node design-system/prototypes/rounds/2026-11-21-multiplayer-owner/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

`<out>` on oletuksena `design-system/prototypes/dist/multiplayer-owner`.
`web/node_modules` vastaa lukkotiedostoa (`npm ci --prefix web`).
Rakennuksen CSS-varoitukset tulevat tuotannon `Controls.module.css`:stä.
Tarkistus: 868 tarkistusta ja puhdas konsoli 1440 ja 390 px:n
leveydellä Päivässä, Yössä ja Kontrastissa (kulut Päivässä ja Yössä)
sekä englanniksi työpöydällä ja puhelimessa.
