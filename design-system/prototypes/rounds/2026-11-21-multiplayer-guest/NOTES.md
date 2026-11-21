# Moninpeli: osallistujan näkymä

- **1 Kaista**: kentän yllä oleva kaista kertoo ennen lähettämistä, mitä
  agentti saa tehdä seuraavalla vuorolla (Vain teksti / Työkalut käytössä),
  ja luettelee odottavat toimet tiloineen.
- **2 Merkki**: jokaisen agentin vastauksen otsikossa on merkki
  `Vain teksti · Ville` tai `Työkalut · Aino`; tekstivastauksen alla on
  rivi "2 tointa odottaa Ainon vahvistusta".
- **3 Kortti** (suositus): tekstivastauksen jälkeen, siinä kohdassa missä
  agentti pysähtyi, on kortti, jossa jokaisella toimella on oma tilansa
  (Odottaa Ainoa, Tehty, Aino hylkäsi). Omistajan näkymä näyttää saman
  kortin painikkeineen.

Issue `multiplayer-conversations`. Suunnat, suositus ja kysymykset Jarille
ovat issuen `result-guest.md`:ssä. Omistajan näkymä on rinnakkainen
kierros `2026-11-21-multiplayer-owner`.

## Sanasto (yhteinen omistajan kierroksen kanssa)

Omistaja / Owner, Osallistuja / Participant, Luotettu / Trusted; vuoron
tila Vain teksti / Text only ja Työkalut käytössä / Tools on; omistajan
vastaukset Voit jatkaa / Go ahead ja Hyväksy yksitellen / Approve one by
one. Tämä näkymä lisää toimen tilan Odottaa Ainoa / Waiting for Aino.
Muutos kirjataan molempiin kierroksiin.

## Maailma

Aino (Omistaja) avasi keskustelun Kevään julkaisu työtilassaan
`seura-sivut`. Sanna on Luotettu, Ville (sinä) Osallistuja, kaikki samalla
palvelimella. Alkutila: Ville pyysi lisäämään kevään tapahtumat ja
julkaisemaan sivut, agentti vastasi vain tekstillä ja kaksi toimea
(`edit src/data/tapahtumat.json`, `npm run deploy`) odottaa Ainoa.
Ainon ja Sannan vuoroilla oli työkalut. Yläpalkin Tila-valinta avaa
kutsun, odotuksen, Voit jatkaa -tilan, yksitellen hyväksynnän ja luotetun
tilan; Aino-painikkeet vastaavat Ainon puolesta. Kutsusta voi liittyä ja
kirjoittaa oman viestin, ja luotettuna kirjoitettu viesti saa
työkaluvuoron. `?theme=light|dark|contrast`, `?lang=en` ja
`?step=invite|pending|continued|perOp|trusted` valitsevat alkutilan.

Sivu koostuu tuotannon osista: `AppShell`, `WorkspaceRail` ja
`AgentNavItem` (Jaettu kanssasi -osio on kierroksen oma osio tuotannon
merkinnällä), `AccountShelf`, `AgentHeader`, `ConversationFrame`,
`ConversationTimeline`, `UserMessage`, `AssistantMessage`, `ToolRow`,
`ToolOutput`, `HabitatMark` sekä tuotannon `Composer`, jonka
`beforeField`-paikassa suunnan 1 kaista on. Kierroksen omia ovat
ihmisten nimet, avatarit (tuotannon `.ah-account-avatar`, värit
`--ah-glyph-*`-tokeneista) ja roolit viesteissä, osallistujarivi otsikon
alla, kutsu, kolme tapaa näyttää työkalutila, Habitatin rivit ja Ainon
vastausten simulointi. Tuotannon `UserMessage` sanoo aina "Sinä";
kierros piilottaa sen CSS:llä ja tuo nimen otsikkoon portaalilla.
Tuotannossa tämä olisi viestin `author`-kenttä.

## Hostin puoli: miten daemon pitäisi tekstivuoron tekstinä

Tekstivuoro pakotetaan Pi:ssä, ei kehotteella. Malli voi ohittaa
kehotteen, ja osallistujan viesti on juuri se syöte, jota ei voi pitää
luotettavana.

1. Daemon tietää, kuka lähetti viestin, koska viesti tulee omistajan
   daemonin vierasreittiä pitkin osallistujan identiteetillä (research.md,
   vaihtoehto a). Daemon päättää jäsenlistasta, onko lähettäjä omistaja,
   luotettu vai osallistuja. Selain ei päätä tilaa.
2. Ennen kuin daemon antaa osallistujan viestin Pi:lle, se asettaa
   vuoron tilaksi Vain teksti Habitatin omalla Pi-laajennuksella:
   `pi.setActiveTools([])`, jolloin mallille ei tarjota työkaluja.
3. Varsinainen raja on saman laajennuksen `tool_call`-koukku. Kun tila on
   Vain teksti, koukku palauttaa jokaiselle kutsulle `{ block: true,
   reason }`. Pelkkä aktiivisten työkalujen tyhjentäminen ei riitä,
   koska Pi:n tyypit sanovat, että `codemode`- ja `deferred`-työkalut
   ovat kutsuttavissa koodista, vaikka niitä ei ole aktivoitu. Koukku
   kattaa myös laajennusten työkalut.
4. Tila on vuorokohtainen. Kun omistaja tai luotettu lähettää viestin,
   daemon palauttaa aktiiviset työkalut ennen kuin viesti menee Pi:lle.
   Jos osallistujan viesti tulee työkaluvuoron aikana steerinä tai
   jonoon, daemon pitää sen jonossa, kunnes vuoro päättyy, koska kesken
   vuoron vaihdettu tila koskisi omistajan jo alkanutta työtä.
5. Hyväksy yksitellen: tekstivuoron lopuksi agentti kirjaa aikomansa
   toimet. Tämä tehdään ehdotustyökalulla, joka ei suorita mitään vaan
   tallentaa toimen. Omistajan hyväksyttyä daemon käynnistää vuoron,
   jossa `tool_call` päästää läpi vain hyväksytyt kutsut. Hylätyt ja
   muuttuneet kutsut estetään.
6. Raja koskee vain uusia kutsuja. Aiempien vuorojen käynnistämät
   prosessit (pi-processes) ja agentin aiemmin kirjoittamat skriptit
   jatkavat. Tämä on research.md:n havainto: vuorokohtainen rajaus saman
   Pi-prosessin sisällä estää osallistujaa ohjaamasta uusia toimia, mutta
   se ei ole Unix-käyttäjien välinen turvaraja. Luotettu-merkintä on
   siksi päätös antaa toiselle omistajan tunnukset.

Prototyyppi ei toteuta näistä mitään. Se olettaa, että daemon kertoo
selaimelle vuoron tilan, sen aloittajan ja toimien tilat.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-21-multiplayer-guest/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 580 \
  node design-system/prototypes/rounds/2026-11-21-multiplayer-guest/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

`<out>` on oletuksena `design-system/prototypes/dist/multiplayer-guest`.
`web/node_modules` vastaa lukkotiedostoa (`npm ci --prefix web`).
Rakennuksen CSS-varoitukset tulevat tuotannon `Controls.module.css`:stä.
Tarkistus: 809 tarkistusta, konsoli puhdas, 1440 ja 390 px Päivässä, Yössä
ja Kontrastissa (kulut Päivässä ja Yössä) sekä englanniksi työpöydällä ja
puhelimessa.
