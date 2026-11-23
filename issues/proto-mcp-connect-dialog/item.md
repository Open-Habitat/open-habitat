---
created: 2026-11-20
updated: 2026-11-23
type: task
reporter: jari
status: open
priority: normal
lane_seq: 1
provenance: chat
source_ref: chat:2026-11-20/proto-mcp-connect-dialog
lane: mcp-connect-proto
preparation: pending
---

# Prototype: Atlassian and Trello connect dialog and re-consent

## Description

Jari 20.11.2026: Atlassianin (Jira, Confluence) ja Trellon
yhdistämisdialogi on sekava ja ruma, ja Trellon yhteyden Workspacea tai
oikeuksia ei pysty korjaamaan, jos kirjautuessa valitsi väärin.
Prototypoidaan kunnolla AGENTS-WORKFLOW.md:n mukaan: dialogi ja
tilikortin jälkitila samassa kierroksessa, koska korjaus kulkee saman
dialogin kautta.

### 1. Dialogi (Asetukset › Tiedot agenteille › Yhdistä tili: Trello / Atlassian)

`Intro` + `LevelWarning` + `ApprovalRequest` in
`web/src/components/Integrations.tsx`, tekstit `web/src/text/trello.ts`,
`atlassian.ts` ja `integrations.tsx` (`levels.trello`, `levels.atlassian`).
Havainnot nykyisestä dialogista:

- **Sama teksti kahdesti.** MCP-palvelun `LevelWarning` näyttää valitun
  tason `sum`-tekstin, joka on jo valitun tasokortin kuvaus. Vain luku
  -tasolla koko kappale ("Pyydä vain lukuoikeuksia. Pi pyytää lupaa…")
  toistuu heti kortin alla punaisessa laatikossa.
- **Varoitussävy väärässä paikassa.** Punainen laatikko näkyy turvallisimmalla
  valinnalla (vain luku), ja sen sisältö on tasokuvaus, ei varoitus.
- **Ylläpitäjän pyyntö näkyy heti, kaikille.** "Jos kirjautuminen odottaa
  ylläpitäjän hyväksyntää" ja sen pitkä pyyntöteksti (loopback-osoite
  `http://127.0.0.1:*/**`, IP-sallintalista, Connectors-polku) on dialogin
  suurin osa jo ennen kuin mitään on yritetty. Kierroksen
  2026-11-02-atlassian-trello suositus oli näyttää pyyntö odotustilassa,
  ei aloitusnäkymässä. Pyyntö toistuu vielä paluuosoitteen liittämisvaiheessa.
- **Tekstiä on liikaa ja se on teknistä**: "Pi pyytää lupaa, mutta ei voi
  rajata sitä", "Atlassianin MCP-asetukset", "natiivi loopback-paluuosoite".
  Tavallinen käyttäjä tarvitsee kolme asiaa: mitä agentit saavat tehdä, mitä
  Trello/Atlassian kysyy seuraavaksi (Workspace, oikeudet) ja että lopuksi
  aukeava virhesivu on odotettu.

### 2. Workspacen tai oikeuksien korjaaminen jälkikäteen

Trellon suostumussivulla valitaan Workspace (yksi per yhteys) ja
hyväksyttävät oikeudet. Trellon ohje: jos haluaa muuttaa valintaa,
"disconnect Trello MCP and reconnect it". Habitatissa tähän ei ole polkua:

- *Kirjaudu uudelleen* (`integration-reauth`) näkyy tilikortilla vain, kun
  kirjautuminen on vanhentunut, tai Googlella myöntämättä jääneille
  oikeuksille.
- *Vaihda tasoa* ei salli samaa tasoa (`Intro`:n jatkopainike on pois
  käytöstä, kun `level === current`), joten väärän Workspacen voi korjata
  vain poistamalla yhteyden ja lisäämällä uuden, eikä sitä kerrota missään.
- Pi käyttää vakaata asiakastunnusta (Client ID Metadata Document,
  `https://pi.dev/oauth/…/client.json`), mutta sen authorize-pyynnössä on
  `prompt=consent`, joten Atlassianin pitäisi näyttää suostumussivu ja
  Workspace-valinta joka kerta. Tämä varmistetaan oikealla tilillä.

Sama koskee Atlassiania (Jira/Confluence-sivuston valinta).

### 3. Pyydetty kirjoitus, myönnetty vain luku

Kokeillessa valittiin Trellolle *Luku ja muokkaus*, mutta yhteys näytti
*Vain luku*. Selvitys 20.11.:

- Habitat pyytää kirjoitustasolla kirjoitusscopet
  (`trelloWriteScopes` in `internal/daemon/integrations/trello_linux.go`
  → Pi:n `mcp.json` `oauth.scope`), ja kirjautuminen alkaa puhtaalta
  pöydältä (`pi mcp logout` ennen uutta lupaa). Pi lähettää konfiguroidun
  scopen authorize-pyynnössä (`pi-mcp` `sign-in.js` `mergeScopes`).
- *Vain luku* luetaan Trellon tokenivastauksen `scope`-kentästä: siinä ei
  ollut yhtään `write:`-scopea. Trello siis myönsi vähemmän kuin pyydettiin.
  Syitä on kaksi tunnettua: suostumussivulla jätettiin kirjoitus
  hyväksymättä (Trello antaa valita oikeudet), tai organisaation
  Enterprise-ylläpitäjä on estänyt `write_trello`-oikeuden (Connectors ›
  Atlassian MCP server › Permissions).
- Tarkistettu oikealta asennukselta 20.11.: yhteyden `mcp.json`-scopessa
  oli kaikki kolme kirjoitusscopea, ja Pi:n authorize-osoitteessa ne ovat
  mukana (`scope=…write:board:trello+write:member.inbox:trello+
  write:member.planner:trello`, `prompt=consent`). Myönnetyssä tokenissa
  oli vain lukuscopet. Saman henkilön Atlassian-yhteys (Jira, Confluence)
  sai kirjoitusscopet, joten kirjoitusta ei ole estetty kokonaan.
  Pyyntö oli siis oikea, ja rajaus tapahtui Trellon suostumuksessa tai
  Trellon tuotekohtaisessa ylläpitoasetuksessa.
- Tilikortin *Myönnetyt oikeudet* -lista (kortin alareunan avattava
  kohta) näyttää tämän: kirjoitusscopet näkyvät siinä merkinnällä
  "pyydettiin, ei myönnetty". Kohta on niin huomaamaton, ettei sitä
  löytänyt.

Käyttöliittymä ei kuitenkaan auta tässä:

- Trellolle näytetään `narrowedSelf`-ilmoitus, jonka teksti puhuu Google
  Workspacen ylläpitäjästä ja kehottaa kirjautumaan uudelleen, mutta
  Trellon kortilla ei ole *Kirjaudu uudelleen* -painiketta.
- Ilmoitus ei kerro Trellon kahta todellista syytä (oma valinta
  suostumussivulla tai organisaation esto) eikä sitä, että korjaus on uusi
  suostumus (kohta 2).

## Prototyypin rajaus

Yksi kierros: Asetukset › Tiedot agenteille, Trello- ja Atlassian-yhteyden
kulku dialogista tilikortin jälkitilaan. Tilat vähintään: uusi yhteys
(molemmat tasot), paluuosoitteen liittäminen, odottaa ylläpitäjää,
yhdistetty pyydetyllä tasolla, yhdistetty kapeammalla luvalla kuin
pyydettiin, väärä Workspace / valinnan korjaus. Synteettinen henkilö,
sivusto ja Workspacet. Suunnat erottuvat oletusnäkymässä.

## Acceptance Criteria

- [x] Prototyyppikierros, jossa dialogi ei toista tasokuvausta, ylläpitäjän
      pyyntö näkyy vasta kun sitä tarvitaan, ja teksti on tavallisen
      käyttäjän kieltä.
- [x] Prototyypissä on polku Workspacen ja oikeuksien uudelleenvalintaan
      samalla tasolla, ja se kertoo, mitä Trello/Atlassian kysyy.
- [x] Prototyypissä kapeampi myönnetty lupa kerrotaan Trellon ja
      Atlassianin omin syin, ja siinä on toimiva korjauspolku.
- [ ] Tarkistettu oikealla tilillä, mitä Trellon suostumussivu näyttää
      kirjoitusoikeudesta (onko se oletuksena pois) ja kysyykö se Workspacen
      uudelleen; tulos kirjattu tähän.

## Decisions

### 2026-11-23T14:22:44Z · @jari

Jari 23.11.2026 on round 1: postponed until Jari has set up a Trello connection, taken screenshots of the real consent pages and tried it. For now direction 3 Kuitti looks best; with real screenshots parts of the others may come in. Questions 1–3 stay open.
