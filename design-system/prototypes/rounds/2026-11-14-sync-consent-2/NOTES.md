# Synkronoinnin pysähdys keskustelussa – kierros 2

Issue `bisync-force-needs-consent`. Suunnat, suositus ja päätökset ovat
issuen `result.md`:ssä. Kierros 1 (`2026-11-14-sync-consent`) on yhä puussa,
ja sen laskelma, sidonta ja "What the host would need" pätevät tähänkin.
Tämä kierros muuttaa vain paikan ja agentin roolin.

Sivu on tuotannon keskustelu: `AppShell`, `WorkspaceRail` ja `AgentNavItem`
(aiheuttaneen keskustelun rivillä tuotannon `attentionLabel`-merkki),
`AgentHeader` ja sen `StatusBell`, `ConversationTimeline`, `AgentTurn`
(`PiToolUse`, `FileToolCard`, `BashToolCard`), `TurnChanges` ja `Composer`
(C käyttää sen `beforeField`-paikkaa, jossa tuotanto pitää taustatyön
palkkia). Kierroksen omat palat ovat kortti (A, B), Habitatin rivi agentille
(B), rivi kentän yllä (C) ja kierroksen 1 laskelma, ikkuna ja painikkeet.

Suunnat: A Kortti (Habitatin kortti aikajanalla vuoron jälkeen), B Agentti
kertoo (Habitat kertoo agentille, agentti selittää ja laskee, lupa on
Habitatin kortti vastauksen alla) ja C Kentän yllä (kiinteä rivi kentän yllä,
laskelma ikkunassa). Kaikissa sama: sivupalkin merkki, kello koko tilille ja
varapaikka, kun mikään keskustelu ei aiheuttanut pysähdystä.

`?s=pysahtyi|lasketaan|laskettu|kaynnissa|valmis|torjuttu|epaonnistui|muualla|eikeskustelua`,
`?data=few|many` ja `?theme=dark` valitsevat alkutilan. `few` on keskustelu,
jossa agentti muokkasi 14 muistiinpanon otsikot ja lisäsi 2 pohjaa; `many`
on keskustelu, jossa agentin `mv` siirsi 212 raporttia kansion sisällä,
jolloin OneDrive näkee 212 poistoa ja 212 uutta. Laskelmat ovat keksittyjä.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-14-sync-consent-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 590 \
  node design-system/prototypes/rounds/2026-11-14-sync-consent-2/check.mjs \
  design-system/prototypes/dist/sync-consent-2/offline.html <kuvahakemisto>
```

`web/node_modules` lukitiedoston mukaan (`npm ci --prefix web`). Tarkistus käy
kolme suuntaa, yhdeksän tilannetta ja molemmat laskelmat 1440 ja 390 px:n
leveydellä vaaleana ja tummana, ja klikkaa jokaisen suunnan katso–laske–
jatka–valmis-, peru-, torjunta- ja paljon poistoja -polut, Kysy agentilta
-luonnoksen, kellon, sivupalkin merkin ja varapaikan sekä englannin. Konsoli
on puhdas.

## What the host would need

Kierroksen 1 osat pysyvät: automaattinen `--force` poistuu, pysähdys toistuu,
kunnes ihminen päättää, laskelma tehdään pyynnöstä (`sync-check`), ja
pakotettu ajo (`sync-force`) vaatii laskelman kertakäyttöisen `check_id`:n ja
torjuu pyynnön, jos listaus on muuttunut. Uutta on kolme asiaa.

**Kuka pysähdyksen aiheutti.** Daemon lukee jo Pi-istuntojen natiivihistoriaa
(historia, `TurnChanges`). Kun ajo pysähtyy `all_changed`iin, daemon käy läpi
saman käyttäjän keskustelut, joiden historiaan on tullut työkalukutsuja
edellisen onnistuneen ajon jälkeen, ja etsii kirjoituksia synkronoituun
kansioon:

- `edit`- ja `write`-kutsut, joiden polku (työtilan juureen ratkaistuna, kuten
  `turnChanges` jo tekee) on kansion sisällä. Tämä on varma.
- `bash`-kutsut, joiden työhakemisto on kansion sisällä tai joiden komento
  nimeää kansion polun (`commandFiles`). Tämä on todennäköinen, ei varma:
  komento voi kirjoittaa minne tahansa, eikä komentoriviltä näe kaikkea.

Pysähdys liitetään keskusteluun, jos sen kirjoitukset kattavat kansion
muuttuneet tiedostot kokonaan tai lähes (vertailu kuivaharjoituksen
polkuihin, kun laskelma tehdään; pysähdyshetkellä riittää, että kirjoituksia
on ja muita ehdokkaita ei ole). Jos ehdokkaita on useampi, pysähdys liitetään
siihen, jolla on eniten osumia, ja kortti sanoo "tämän ja toisen
keskustelun". Daemon ei voi liittää pysähdystä keskusteluun, kun muutos tuli
muualta (toinen laite, OneDriven web-käyttöliittymä, ihmisen oma
pääteistunto, Claude Code tai muu agentti, jonka historiaa daemon ei lue),
kun kirjoitukset ovat vain epävarmoja `bash`-osumia, jotka eivät selitä
muutosta, tai kun historiaa ei voi lukea. Silloin käytetään varapaikkaa:
kello ja tilin kortti. Arvaus ei kelpaa, koska väärään keskusteluun liitetty
kortti kertoisi ihmiselle väärän syyn.

Liitos on daemonin muistissa oleva havainto (palvelu, kansio, keskustelun
tunniste, varmuus), kuten pysähdyskin. Snapshotin integraatiotila saa
kentän `cause: {conversation_id, certainty}` tai ei mitään. Muutos alkaa
skeemasta `contracts/v1/`. Uudelleenkäynnistyksen jälkeen seuraava ajo
pysähtyy taas ja liitos lasketaan uudelleen historiasta.

**Miten selain näyttää sen.** A: selain lisää kortin keskustelun aikajanalle
sen vuoron jälkeen, jonka kirjoitukset aiheuttivat pysähdyksen (vuoron
viimeinen osuva `entry_key` tulee liitoksen mukana). Kortti ei ole
natiivihistoriaa vaan hostin tila, joka näkyy niin kauan kuin pysähdys on
voimassa ja valmistumisen jälkeen yhden rivin kuittauksena, kunnes keskustelu
avataan uudelleen. Sivupalkin merkki on tuotannon `attentionLabel` samasta
kentästä, ja kello saa tilin tason kohdan kuten muutkin tilin tilat
(`useStatusItems`).

**Miten agentti saa tietää, ja mitä se saa tehdä.** A ja C eivät kerro
agentille mitään itsestään. Kysy agentilta kirjoittaa kenttään viestin, jonka
ihminen lähettää tai ei. B tarvitsee tiedon perille: daemon antaa sen
keskustelun omalle agentille samaa tietä kuin taustaprosessin päättymisen ja
herätyksen (`process-extension.mjs`, `wake_linux.go`). Jos agentti on
työssä, viesti menee ohjauksena vuoroon. Jos se odottaa, viesti käynnistää
oman vuoronsa kuten herätys, enintään kerran pysähdystä kohden. Jos Pi ei
ole käynnissä, B toimii kuten A, koska vuoroa ei voi aloittaa ihmisen
puolesta ilman hänen viestiään. Viesti kirjataan haaraan, joten se näkyy
aikajanalla Habitatin rivinä ("Habitat kertoi agentille …").

Agentti saa:

- pyytää laskelman (`habitat sync check onedrive`, sama daemon-komento kuin
  selaimen) ja selittää sen sekä oman osuutensa;
- vastata ihmisen kysymyksiin siitä, mitä se teki.

Agentti ei saa pyytää pakotettua ajoa, ei `habitat`-komennolla eikä
`rclone --force`lla. Lupa on Habitatin painike kortissa, jonka laskelma on
sidottu `check_id`:hen. "Kyllä, jatka" keskustelussa ei ole lupa; agentti
vastaa siihen, että painike on kortissa. Kierroksella 1 agentti sai pyytää
pakotetun ajon ihmisen myöntävän vastauksen jälkeen. Kierros 2 poistaa tämän
Jarin ohjeen mukaisesti ("lupa on oikea painike, ei agentin sana").
CLI ei siis tarjoa `force`-komentoa, ja `personal-data`-taito sanoo saman.

**Ei muutoksia valtarajoihin.** Agentti ajaa samana Unix-käyttäjänä, joten
se voisi teknisesti puhua daemonin socketille tai ajaa rclonea itse. Daemon
ei voi erottaa selaimen painiketta agentin kutsusta, eikä kierros väitä
toisin. Rajaus on tuotteen tapa kysyä (CLI ja taito), ei turvaraja, kuten
kierroksella 1. Kaikki tapahtuu käyttäjän omassa daemonissa. Gateway
välittää komennot kuten muutkin integraatiokomennot, eikä provision ole
mukana.
