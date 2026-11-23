# Atlassian- ja Trello-yhteyden dialogi ja uudelleenvalinta

## Kierros 1: nykytila ja kolme suuntaa

Kierros: `design-system/prototypes/rounds/2026-11-23-mcp-connect-dialog/`
(`NOTES.md` kertoo sivun rakenteen, rakentamisen ja tarkistuksen).
Rakennettu sivu: `design-system/prototypes/dist/mcp-connect-dialog/offline.html`.

Sivu on tuotannon Asetukset › Tiedot agenteille (`IntegrationsOverview`)
muuttamattomana. Yläpalkissa valitaan *Palvelu* (Trello tai Atlassian) ja
*Tilanne*:

- uusi yhteys, vain luku (oletus);
- uusi yhteys, luku ja muokkaus;
- paluuosoitteen liittäminen;
- odottaa ylläpitäjää;
- yhdistetty pyydetyllä tasolla;
- myönnettiin vähemmän kuin pyydettiin (dialogin lopputila);
- tilikortti, kun lupa on kapeampi;
- väärä Workspace tai sivusto: valitse uudelleen.

*Teema*, *Liike* ja *Kieli* vaihtavat vaalean ja tumman, vähennetyn liikkeen
ja suomen ja englannin. Kulut toimivat painamalla: väärä ja oikea
paluuosoite, ylläpitäjän pyyntö, uudelleenvalinta kortilta ja kapeamman
luvan korjaus. Henkilö, sivusto (`contoso-demo.atlassian.net`) ja
Workspacet (`Kotiremontti`, `Contoso Markkinointi`) ovat synteettisiä.

Akseli: **missä Trellon ja Atlassianin suostumussivun valinnat
(Workspace tai sivusto, oikeudet) selitetään: ennen sivua, omana
vaiheenaan vai jälkeenpäin kuittina.** Sivun yläreunassa on jokaisesta
suunnasta yksi rivi. Oletustilanteessa dialogi on auki, joten ero näkyy
heti.

0. **Nyt**: tuotannon dialogi ja kortti. Vain luku -tason kuvaus toistuu
   punaisessa laatikossa, ylläpitäjän pyyntö on dialogin suurin osa jo
   ennen yritystä, ja *Vaihda taso…* ei salli samaa tasoa.
1. **Esikatselu**: tasokortit ja niiden alla kaavio siitä, mitä palvelu
   kysyy: tili, Workspace tai sivusto pudotusvalikkona, oikeudet
   valintaruutuina. Luku ja muokkaus -tasolla muokkausoikeus on korostettu
   (*Pidä valittuna*), vain luku -tasolla se on harmaana (*Ei pyydetä*).
   Kaavio on merkitty: *Kaavio, ei palvelun oikea sivu*. Kortin
   *Vaihda taso…* on *Muuta…*, joka avaa saman dialogin nykyinen taso
   valittuna.
2. **Vaiheet**: dialogissa on neljä vaihetta (Taso · Trellossa · Paluuosoite
   · Valmis), ja tuotannon `ig-steps` näyttää ne. Ensimmäisessä vaiheessa
   valitaan vain taso. Toisessa vaiheessa luetellaan palvelun kolme
   valintaa ennen *Avaa Trello* -painiketta. Kortilla on oma rivi: *Väärä
   Workspace tai oikeudet? Valitse ne uudelleen samalla tasolla.*
3. **Kuitti**: alussa on vain tasokortit ja yksi lause. Lopussa on kuitti:
   *Pyysit* ja *Trello myönsi* rivi riviltä (luku ja haku, muokkaus; Atlassianissa
   kirjoitus Jiraan ja Confluenceen erikseen), puuttuva rivi korostettuna,
   ja valittu Workspace tai sivusto nimeltä. Sama kuitti jää tilikortille.

### Sama kaikissa kolmessa suunnassa

- **Tason kuvaus näkyy kerran**, tasokortissa, tavallisin sanoin (*Lukevat
  ja hakevat tauluja, kortteja ja kommentteja. Eivät muuta mitään.*).
  Punaista laatikkoa ei ole. Sivun yleinen varoitus agenttien oikeuksista
  jää ennalleen.
- **Ylläpitäjän pyyntö näkyy vasta, kun palvelu vaatii sitä.**
  Paluuosoitevaiheessa on linkki *Trello sanoo, että ylläpitäjän pitää
  hyväksyä*. Se avaa lyhyen pyynnön, *Kopioi pyyntö* -painikkeen ja
  *Aloita alusta* -painikkeen. Pyyntö näkyy myös kapeamman luvan kohdalla
  (*Pyyntö ylläpitäjälle*). Tekniset tiedot, kuten loopback-sääntö ja
  IP-sallintalista, ovat pyynnön tekstissä, koska se on ylläpitäjälle.
- **Kolme asiaa kerrotaan**: mitä agentit saavat tehdä (taso), mitä palvelu
  kysyy seuraavaksi (tili, Workspace tai sivusto, oikeudet), ja että
  lopuksi aukeamaton sivu on odotettu (*Se on odotettu: kopioit sen
  osoitteen tänne.*).
- **Uudelleenvalinta samalla tasolla.** Dialogin otsikko on *Valitse
  uudelleen: Trello*. Nykyinen taso on valittuna ja merkitty (*nykyinen*),
  ja jatkaa voi samalla tasolla. Dialogi kertoo, että *Trello kysyy
  Workspacen ja oikeudet uudelleen*, ja että vanha lupa poistuu, kun
  jatkaa.
- **Kapeampi lupa kerrotaan palvelun omin syin.** Trello: *Trello myönsi
  vain luvun. Pyysit myös muokkausta. Syitä on kaksi: suostumussivulla jäi
  muokkaus hyväksymättä, tai organisaatiosi ylläpitäjä on estänyt Trellon
  muokkauksen.* Korjaus on *Valitse oikeudet uudelleen*, ja Luku ja
  muokkaus on silloin valmiiksi valittuna. Jos Trello myöntää taas vain
  luvun, syy on ylläpitäjän asetus. Atlassian: Jira sai kirjoituksen,
  Confluence ei. Syy on yleensä ylläpitäjän MCP-asetus tai oma
  Confluence-oikeus. Googlen sanoja ei näy missään.
- Tilikortin *Myönnetyt oikeudet* -lista säilyy, ja siinä näkyy
  *pyydettiin, ei myönnetty*.

### Suositus

**Esikatselun dialogi ja kortti, ja dialogin lopputilaan Kuitin
pyydetty/myönnetty-taulukko ilman Workspacen nimeä.**

- Esikatselu estää ongelman ennen kuin se syntyy. Kirjoitusta pyytänyt
  käyttäjä näkee ennen Trellon sivua, mikä oikeus ratkaisee tason, ja
  että Workspace valitaan yksi kerrallaan. Kaaviossa on vähemmän tekstiä
  kuin nykyisessä dialogissa, vaikka se kertoo enemmän.
- Vaiheet selittää saman, mutta vaatii yhden painalluksen lisää, eikä
  kertomisesta tule selvempää. Ensimmäinen vaihe näyttää pelkältä
  tasovalinnalta, ja Workspace jää toiseen ruutuun.
- Kuitin taulukko tekee kapeamman luvan näkyväksi juuri silloin, kun sen voi
  korjata, ja se nojaa tietoon, jonka host jo antaa (`grant.granted` ja
  `not_granted`). Workspacen tai sivuston nimi taas vaatisi uuden
  hostin lukutavan (alla), joten se on erillinen päätös.
- Kortilla *Muuta…* korvaa *Vaihda taso…* -painikkeen MCP-palveluissa:
  sama dialogi korjaa sekä tason että Workspacen, eikä kortille tarvita
  toista riviä. Jos *Muuta…* osoittautuu liian huomaamattomaksi väärän
  Workspacen korjaukseen, Vaiheiden selittävä rivi on vaihtoehto.

Kuvat ovat issuen ulkopuolella
`/var/tmp/agent-keep/proto-mcp-connect-dialog/round-1/` (127 kpl,
`r1-<n>-<suunta>-<palvelu>-<tapaus>-<leveys>-<teema>.png`). Kansiossa ovat
kaikki tilanteet kaikissa suunnissa molemmille palveluille 1440 vaaleana.
`uusi-kirjoitus`, `kapeampi` ja `korjaus` ovat Trellolle myös 1440 tummana
sekä 390 vaaleana ja tummana, ja `odottaa` Atlassianille 390 vaaleana.
Lisäksi kansiossa ovat kulut `uusi-tulos`, `uudelleen`, `kapeampi-pyynto`
ja Nytin `vaihda-taso` (jatka pois käytöstä) sekä englanniksi
`kapeampi-en`. Tarkistus: 812 tarkistusta, konsoli puhdas.

## Host: mitä on jo ja mitä tuotanto tarvitsee

- **Uudelleenvalinta samalla tasolla toimii daemonissa jo.**
  `start`-komento (`provider`, `address`, `level`) päätyy
  `StartLevelLogin`iin (`internal/daemon/integrations/relay_linux.go`).
  `piMCP.startLogin` (`pi_mcp_linux.go`) tekee aina uuden luvan, kun taso
  on annettu (`fresh := level != "" || created`): se kirjoittaa tason
  scopet `mcp.json`iin, ajaa `pi mcp logout` ja aloittaa uuden
  kirjautumisen. Esteenä on vain selain: `Intro` poistaa jatkopainikkeen
  käytöstä, kun `level === current` (`web/src/components/Integrations.tsx`).
  Tuotantoon riittää käyttöliittymän muutos, joka lähettää valitun tason
  myös silloin, kun se on sama.
- **Pelkkä *Kirjaudu uudelleen* (taso puuttuu) ei kelpaa korjaukseen.**
  Se säilyttää vanhan scopen ja jättää `pi mcp logout`in tekemättä
  (`fresh` on epätosi). Pi voi silloin uusia vanhan luvan kysymättä.
  Korjauspolun pitää siksi aina lähettää taso.
- **Pyydetty ja myönnetty ovat jo sopimuksessa**:
  `Account.grant.granted/not_granted`, `services[].access` ja `level`.
  Trellossa kirjoitusscopet ovat `write:board:trello`,
  `write:member.inbox:trello` ja `write:member.planner:trello`, ja
  Atlassianissa `write:jira:agent-interface` ja
  `write:confluence:agent-interface` tuotekohtaisesti. Kuitin rivit
  saadaan näistä suoraan.
- **Workspacen tai sivuston nimeä host ei tiedä.** Tili on Pi:n natiivi
  nimi (`open_habitat_trello`, `open_habitat_trello_2`,
  `open_habitat_atlassian`). Nimen näyttäminen vaatisi, että joku lukee
  sen palvelusta henkilön tunnuksella: Trellon MCP:n jäsen- tai
  Workspace-työkalulla tai Atlassianin accessible-resources-kutsulla.
  Daemon käyttäisi silloin Pi:n tallentamaa tunnusta tai kutsuisi Pi:n
  työkalua. Tämä on authority-muutos, joka kuuluu issueen tai
  Discussioniin ennen koodia, ei tämän kierroksen toteutukseen.
- **Ylläpitäjän odotusta ei voi havaita.** Host näkee vain `access_denied`in
  (`permission_refused`). Odotustila on siksi henkilön oma ilmoitus
  (*… sanoo, että ylläpitäjän pitää hyväksyä*). `permission_refused`-tilan
  `FailedStep` näyttää nyt pelkän tekstin. Tuotannossa sen kannattaa
  näyttää sama pyyntö ja *Aloita alusta*.
- **Kortin nykyiset puutteet.** `GrantNotice` käyttää kaikille paitsi
  Microsoftille `narrowedSelf`-tekstiä, joka puhuu Google Workspacesta.
  Trellolle ja Atlassianille tarvitaan omat tekstit. *Kirjaudu
  uudelleen* näkyy kapeammalla luvalla vain Googlella. Esikatselussa
  korjauspainike on kapeamman luvan ilmoituksessa itsessään.

## Decisions for later review

- *Muuta…* korvaa *Vaihda taso…* -painikkeen Trellolla ja Atlassianilla, ja
  sama dialogi korjaa tason, Workspacen ja oikeudet. Muut palvelut
  pitävät nykyisen *Vaihda taso…* -painikkeen, jossa sama taso on pois
  käytöstä.
- Ylläpitäjän pyyntö näytetään vain, kun henkilö kertoo palvelun vaativan
  hyväksyntää, kapeamman luvan kohdalla ja `permission_refused`-tilassa.
  Aloitusnäkymästä se poistuu (kuten kierroksen 2026-11-02-atlassian-trello
  suosituksessa).
- Vain luku -tasolla ei enää sanota, että Pi ei voi rajata lupaa. Sen
  tilalla on lause: *Trello voi tarjota enemmän kuin pyydettiin; näet
  lopuksi, mitä se myönsi.* Lopputila näyttää myönnetyn tason, ja
  tuotanto lukee jo minkä tahansa `write:`-scopen kirjoitukseksi.
- Workspacen tai sivuston nimi ei kuulu suositukseen, koska se vaatii
  hostille uuden lukutavan (ks. yllä).
- Kierros olettaa, ettei Atlassianin suostumussivulla voi poistaa
  yksittäisiä oikeuksia. Siksi Atlassianin kapeampi lupa selitetään
  ylläpitäjän asetuksella tai omalla tuoteoikeudella. Oletus tarkistetaan
  oikealla tilillä (kysymys 1).

## Kysymykset Jarille

1. **Oikean tilin tarkistus (hyväksymiskriteeri 4, ei tehty):** näyttääkö
   Trellon suostumussivu kirjoitusoikeuden oletuksena pois valittuna?
   Kysyykö se Workspacen uudelleen, kun yhteys kirjaudutaan uudelleen samalla
   nimellä (`prompt=consent`)? Kysyykö Atlassian sivuston uudelleen, ja voiko
   sen sivulla jättää yksittäisiä oikeuksia hyväksymättä? Vastaukset
   päättävät kaavion (Esikatselu) ja syytekstien sanamuodon.
2. Käykö suositus, eli Esikatselun dialogi ja kortti sekä Kuitin taulukko
   lopputilassa? Vai valitsetko yhden suunnan sellaisenaan?
3. Onko Workspacen tai sivuston nimi kortilla niin arvokas, että hostin
   lukutavasta kannattaa avata arkkitehtuuri-issue? Ilman nimeä väärän
   Workspacen huomaa vasta, kun agentti ei löydä taulua.
