# Projektin tilanne

**Updated:** 2026-09-24
**Source revision:** `89dfe4b4f569e862042b0dc570fc488e92a371b5`

## Valmis toteutus ja katselmointi

ADR 0001:n Unix-natiivi arkkitehtuuri sekä UI v1:n tuotantodesign ja toteutuspolku on hyväksytty. Go/React-sovelluspohja ja jaettu komponenttikatalogi ovat ajettavia. Ensimmäinen lukevan käyttöliittymän läpileikkaus kulkee GitHubin OAuth-testisyötteestä selaimen web-istuntoon, kiinteään Unix-käyttäjämappaukseen ja käyttäjädaemonin snapshotiin. Linuxin kahden oikean UID:n systemd-reititys ja natiivi `gh` -asennus todettiin [synteettisessä tuote-VM:ssä](../issues/build-workspace-slice/phase-2-native.md). Erillinen [tuotantobuildin selaintesti ja AVIF-kuvat](../issues/build-workspace-slice/visual-acceptance.md) näyttävät kirjautumisen, workspace-navigoinnin ja virhetilat. Jari hyväksyi korjatut kuvat ja erikseen koko `build-workspace-slice`-palasen automaattisten testien perusteella ilman interaktiivista tuotetestiä 2026-09-24. Päätös ja sen rajat on kirjattu issueen; seuraava UI-pala on Pi:n natiivihistorian lukeminen. Tämä ei ole live-kirjautumisen tai testipalvelimen hyväksyntä.

## Rajat

Selain näyttää nyt välittömät `~/src`-hakemistot, mukaan lukien Git- ja ei-Git-kohteet, lähteen tyhjyyden, puuttumisen, katkoksen ja osittaisen havainnon. Valinta ei käynnistä eikä jatka agenttia. Pi-historia, agentin ohjaus, SSE, workspace-kirjoitukset, elinkaari, GitHubin oikea consent ja live-hostin asennus eivät ole tämän näytön piirissä. Go-VM ei ole selainvisuaalinen koe; selaintesti käyttää samaa UID:tä ja deterministisiä synteettisiä peer/provider-saumoja eikä korvaa VM:n todistusta. Nykyistä sovellusversiota ei ole julkaistu testipalvelimelle. Ensimmäisen kirjautumisen Linux-tilin luova JIT-palvelu ja gatewayn dynaaminen OAuth-reitti ovat keskeneräisiä; testipalvelimen turvallinen TLS/OAuth-sisääntulo, numeeriset GitHub-ID:t ja live-todistus puuttuvat. Fleetrepon vanhempi testipaketti ei ole tämän sovellusversion deploy.

Vielä myöhemmin todistettavia ovat Pi:n otsikko, pitkä historia ja streaming, daemon-katkos ja historian asettuminen, GitHubin todellinen consent, Taskfleetin osatulokset, Git- ja poistotoimien polku-/mount-/prosessirajat sekä asennuksen, päivityksen ja rollbackin operaattoripolut. Koko MVP:n hyväksyntä on erillinen katselmointi.

## Dokumentaation katselu

Dokumentaatio on suoraan `docs/`-hakemistossa alkaen `index.md`:stä. Glasspadin nykyversio hylkää hakemiston AGENTS.md/CLAUDE.md-ohjeet, eikä suhteellisia issue-kuvia aina renderöidä oikein. Repon Markdown ja AVIF-tiedostot ovat kanonisia; niitä ei ole julkaistu Glasspadissa.
