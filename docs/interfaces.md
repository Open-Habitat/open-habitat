# Järjestelmän rajapinnat

Sovittu yhteys on JSON/HTTP ja yksi käyttäjän tapahtumia yhdistävä SSE-virta
palvelinta kohti. Selain hakee tilannekuvan, lähettää komennot HTTP:llä ja seuraa
muutoksia tapahtumavirrasta. [Arkkitehtuuri](architecture.md) määrittää
komponenttien vastuut. Tarkkoja viesti- ja komentomuotoja ei ole vielä valittu.

| Raja | Mitä siinä kulkee | Mitä pitää vielä määritellä |
|---|---|---|
| Selain → gateway | Kirjautuminen, kyselyt, komennot ja tapahtumayhteys | Istunto, vanheneminen, alkuperän tarkistus ja virheet. |
| Gateway → käyttäjän daemon | Varmennettuun Linux-käyttäjään reititetty yhteys | Kuljetus, luottamus ja väärän/puuttuvan mappingin torjunta. |
| Daemon → Pi | Natiivihistoria, discovery ja tuetut ohjausoperaatiot | Identiteetti, prosessiomistajuus, resume, ohjauskyvyt ja tapahtumat. |
| Daemon → tiedostot/Git/GitHub | Workspace- ja worktree-operaatiot sekä GitHub-yhteys | Polkurajat, oikeudet, pienet annotaatiot ja osittaiset tulokset. |

[Rajapintatyö](../issues/define-host-contracts/item.md) täydentää tähän:

- Snapshotin ja SSE:n liittymisen ilman tapahtumien hukkaamista.
- Viestin vastaanoton, Pi:n hyväksynnän ja suorituksen eron.
- Epävarman lähetyksen, uusinnan, katkoksen ja resnapshotin käyttäytymisen.
- Historian, prosessitilan ja ohjattavuuden erillisen esityksen.
- Virheet ja osittaiset onnistumiset, kuten worktree ilman käynnistynyttä agenttia.
- Esimerkkivaihdot ja linkit valitun tekniikan koneellisiin sopimuksiin.

Natiivi resume-ID ja natiivihistoria pysyvät lähdetietoina. Tämän sivun myöhempi
tarkennus ei saa huomaamatta luoda uutta workspace- tai historiatietokantaa.
Katso [päätökset](decisions.md) ja [kriittiset oletukset](assumptions.md).
