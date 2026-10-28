---
created: 2026-10-28
updated: 2026-10-28
type: task
reporter: jari
status: done
priority: normal
lane: proto-github-warning
preparation: pending
provenance: chat
source_ref: chat:2026-10-28/proto-github-connection-warning
closed: 2026-10-28
---

# Prototype: warn when the GitHub connection is broken, where GitHub is needed and as a banner

Jari 2026-10-28 (Northwind, pilot.13, kuvakaappaus liitteenä): Lisää oletusrepo -valitsin sanoi vain 'Repolistaa ei saatu GitHubista. Voit silti kirjoittaa repon nimen muodossa omistaja/repo', eikä Jari saanut valittua repoa, joten asetusta ei voinut tehdä. Syy oli, että Jarin GitHub-yhteys oli poikki. Kun GitHub-yhteys puuttuu tai on rikki, sen pitää näkyä selvästi siellä, missä GitHubia tarvitaan (repovalitsin, kloonaus, oletusrepot, worktree-agentit), ja yleisemmin bannerivaroituksena, josta pääsee korjaamaan yhteyden (<origin>/auth/github/start tai Asetukset › Koodipalvelut). Prototyyppikierros (design-system/prototypes -menetelmä: 2–3 suuntaa yhdellä akselilla, tuotantokonteksti, työpöytä ja puhelin, vaalea ja tumma, synteettinen data, yksi offline-tiedosto): missä varoitus näkyy, miten se erottaa syyt (ei yhdistetty, tunnus vanhentunut tai peruttu, GitHub ei vastaa, organisaatio estää OAuth-sovelluksen), mitä kohdassa voi silti tehdä ja milloin banneri poistuu. Selvitä samalla koodista, miksi kirjoitettu omistaja/repo ei kelvannut valinnaksi, kun lista puuttui, ja kirjaa se result.md:hen (erillinen bugi, jos se on vika). Jari valitsee; toteutus on myöhempi issue.

## Decisions

### 2026-10-28T11:29:01Z · @jari

Jari 2026-10-28: suunnat näyttävät samalta; varoitus tarvitaan. Riffikierros 2 yleisestä varoituksesta, myös chat-näkymässä. Jari kysyy, vaatiiko tämä todella käyttäjän painalluksen: yritetään ensin tehdä (esim. tunnuksen uusiminen tai uudelleenyritys automaattisesti) ja vasta epäonnistuessa näytetään varoitus. Kierros selvittää samalla, miten painalluksen tarpeesta päästään eroon: mitkä syyt host voi korjata itse (refresh token, uudelleenyritys, GitHubin tilapäinen katko) ja mitkä vaativat ihmisen (peruttu sovellus, organisaation esto).

### 2026-10-28T17:37:22Z · @jari

Jari 2026-10-28, kierros 2: suunta 2 Näkyvä yritys, kentän päällä. Vasemman laidan korostusraita pois; tilalle jokin muu, muun tyylin kanssa johdonmukainen tyylittely. Tästä varoitusbannerista otetaan meille yleinen varoitusbannerin tyyli. Toteutus: github-connection-warning (osa 1) ja github-connection-classify (osa 2).
