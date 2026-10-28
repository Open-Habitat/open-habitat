---
created: 2026-10-28
updated: 2026-10-28
type: task
reporter: jari
status: open
priority: normal
lane: proto-github-warning
preparation: ready
provenance: chat
source_ref: chat:2026-10-28/proto-github-connection-warning
---

# Prototype: warn when the GitHub connection is broken, where GitHub is needed and as a banner

Jari 2026-10-28 (Northwind, pilot.13, kuvakaappaus liitteenä): Lisää oletusrepo -valitsin sanoi vain 'Repolistaa ei saatu GitHubista. Voit silti kirjoittaa repon nimen muodossa omistaja/repo', eikä Jari saanut valittua repoa, joten asetusta ei voinut tehdä. Syy oli, että Jarin GitHub-yhteys oli poikki. Kun GitHub-yhteys puuttuu tai on rikki, sen pitää näkyä selvästi siellä, missä GitHubia tarvitaan (repovalitsin, kloonaus, oletusrepot, worktree-agentit), ja yleisemmin bannerivaroituksena, josta pääsee korjaamaan yhteyden (<origin>/auth/github/start tai Asetukset › Koodipalvelut). Prototyyppikierros (design-system/prototypes -menetelmä: 2–3 suuntaa yhdellä akselilla, tuotantokonteksti, työpöytä ja puhelin, vaalea ja tumma, synteettinen data, yksi offline-tiedosto): missä varoitus näkyy, miten se erottaa syyt (ei yhdistetty, tunnus vanhentunut tai peruttu, GitHub ei vastaa, organisaatio estää OAuth-sovelluksen), mitä kohdassa voi silti tehdä ja milloin banneri poistuu. Selvitä samalla koodista, miksi kirjoitettu omistaja/repo ei kelvannut valinnaksi, kun lista puuttui, ja kirjaa se result.md:hen (erillinen bugi, jos se on vika). Jari valitsee; toteutus on myöhempi issue.
