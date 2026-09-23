# Projektin tilanne

**Updated:** 2026-09-23
**Source revision:** `709b6080de4ca01e19a37ed666cdfd9916e365d7`

## Valmis toteutus ja katselmointi

ADR 0001:n Unix-natiivi arkkitehtuuri sekä UI v1:n tuotantodesign ja toteutuspolku on hyväksytty. Go/React-sovelluspohja ja jaettu komponenttikatalogi ovat ajettavia. Ensimmäinen lukevan käyttöliittymän läpileikkaus kulkee GitHubin OAuth-testisyötteestä selaimen web-istuntoon, kiinteään Unix-käyttäjämappaukseen ja käyttäjädaemonin snapshotiin. Linuxin kahden oikean UID:n systemd-reititys ja natiivi `gh` -asennus todettiin [synteettisessä tuote-VM:ssä](../issues/build-workspace-slice/phase-2-native.md). Erillinen [tuotantobuildin selaintesti ja AVIF-kuvat](../issues/build-workspace-slice/visual-acceptance.md) näyttävät kirjautumisen, workspace-navigoinnin ja virhetilat. Tämä issue on Jarin visuaalista hyväksyntää odottavassa `testing`-tilassa; worker ei hyväksy eikä sulje sitä itse. Seuraavaa riippuvaa UI-sliceä ei aloiteta ennen kirjattua päätöstä.

## Rajat

Selain näyttää nyt välittömät `~/src`-hakemistot, mukaan lukien Git- ja ei-Git-kohteet, lähteen tyhjyyden, puuttumisen, katkoksen ja osittaisen havainnon. Valinta ei käynnistä eikä jatka agenttia. Pi-historia, agentin ohjaus, SSE, workspace-kirjoitukset, elinkaari, GitHubin oikea consent ja live-hostin asennus eivät ole tämän näytön piirissä. Go-VM ei ole selainvisuaalinen koe; selaintesti käyttää samaa UID:tä ja deterministisiä synteettisiä peer/provider-saumoja eikä korvaa VM:n todistusta. Aldera tai Fleetrepoa ei muutettu.

Vielä myöhemmin todistettavia ovat Pi:n otsikko, pitkä historia ja streaming, daemon-katkos ja historian asettuminen, GitHubin todellinen consent, Taskfleetin osatulokset, Git- ja poistotoimien polku-/mount-/prosessirajat sekä asennuksen, päivityksen ja rollbackin operaattoripolut. Koko MVP:n hyväksyntä on erillinen katselmointi.

## Dokumentaation katselu

Dokumentaatio on suoraan `docs/`-hakemistossa alkaen `index.md`:stä. Glasspadin nykyversio hylkää hakemiston AGENTS.md/CLAUDE.md-ohjeet, eikä suhteellisia issue-kuvia aina renderöidä oikein. Repon Markdown ja AVIF-tiedostot ovat kanonisia; niitä ei ole julkaistu Glasspadissa.
