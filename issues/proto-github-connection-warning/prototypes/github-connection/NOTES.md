# Rikkinäinen GitHub-yhteys

Avaa `index.html` selaimessa. Se on yksi offline-tiedosto, kirjoitettu käsin
eikä rakennettu tuotantokomponenteista. Lähde on
`design-system/prototypes/rounds/2026-10-28-github-yhteys/`. Tiedosto
rakennetaan ja tarkistetaan komennolla
`node design-system/prototypes/rounds/2026-10-28-github-yhteys/verify.mjs`
(Playwright `web/node_modules`ista). Kuvat ovat `evidence/`-hakemistossa
laitteen skaalauksella 2.

## Mistä on kyse

Northwindin palvelimella Lisää oletusrepo sanoi vain "Repolistaa ei saatu
GitHubista. Voit silti kirjoittaa repon nimen…". Kirjoitettu nimi ei
kuitenkaan kelvannut, koska sen tarkistus tarvitsee saman GitHub-yhteyden kuin
lista (bugi on selitetty tiedostossa `result.md`). Syy oli GitHub-yhteytesi,
mutta mikään näkymä ei kertonut sitä. Tämä kierros näyttää, miten
yhteysongelma näkyy kohdissa, joissa GitHubia tarvitaan, ja kuinka paljon se
näkyy muualla sovelluksessa.

## Sivun ohjaimet

- **Alareunan valitsin**: kolme suuntaa ja vertailuna **Nykyinen** (tuotanto
  nyt). Näppäimet 1–4 ja nuolet vaihtavat suuntaa.
- **Näkymä**: Keskustelu (agentin push epäonnistuu), Uusi työtila
  (kloonaussivu), Lisää oletusrepo (sinun tapauksesi) ja Asetukset ›
  Koodipalvelut.
- **Syy**:
  - Ei yhdistetty
  - Vanhentunut tai peruttu
  - GitHub ei vastaa
  - Organisaatio estää
  - Kunnossa

  Oikeassa yläkulmassa lukee, tunnistaako palvelin syyn jo nyt. Kaksi
  ensimmäistä se tunnistaa, kaksi seuraavaa ei.
- **Ikkuna**: Oma, 1280 tai Puhelin. **Teema**: Tumma tai Vaalea.

## Mikä on kaikissa suunnissa samaa

Jokainen kohta, joka tarvitsee GitHubia, kertoo syyn omassa ilmoituksessaan
ja tarjoaa sen korjauksen. Yhdistä uudelleen palauttaa samalle sivulle.
Kun GitHub ei vastaa, korjausnapin tilalla on Yritä uudelleen, koska uusi
kirjautuminen ei auttaisi. Kun organisaatio estää, ilmoituksessa on
"Pyydä hyväksyntää GitHubissa". Lisää oletusrepo -ikkunassa kirjoitetun
nimen voi lisätä **tarkistamatta**, koska jokaisen uuden henkilön pääsy
tarkistetaan joka tapauksessa hänen omalla tilillään. Kun yhteys on korjattu,
näkyy hetken "GitHub yhdistetty käyttäjänä …", ja varoitukset poistuvat.

## Suunnat (akseli: kuinka paljon varoitus näkyy muualla kuin tarvekohdassa)

1. **Aina näkyvä**: koko sovelluksen yläreunassa on banneri niin kauan kuin
   yhteys on poikki tai vanhentunut. Sitä ei voi sulkea.
2. **Väistyvä**: sama banneri, mutta siinä on Myöhemmin. Sen jälkeen
   varoitus pienenee sivupalkin alareunan riviksi (puhelimessa valikkonapin
   pisteeksi). Banneri palaa uudessa istunnossa.
3. **Vain tarvittaessa**: banneria ei ole. Sivupalkissa on koko ajan hiljainen
   rivi, ja varoitus näkyy kokonaan vasta kohdassa, joka tarvitsee GitHubia.

Banneri tai rivi näkyy vain, kun korjaus on sinun käsissäsi (Ei yhdistetty tai
Vanhentunut). Kun GitHub ei vastaa tai organisaatio estää, varoitus näkyy vain
kohdassa, johon se vaikuttaa.

## Kokeile näin

1. Valitse **Lisää oletusrepo**, syy **Vanhentunut tai peruttu** ja käy läpi
   Nykyinen, 1, 2 ja 3. Kirjoita hakuun `northwind/pilot-materiaalit`. Nykyisessä
   tulee "GitHubiin ei saatu yhteyttä", eikä valittavaa ole. Suunnissa nimen
   voi lisätä tarkistamatta.
2. Valitse **Keskustelu** ja suunta 2. Paina Myöhemmin, niin näet, mihin
   varoitus siirtyy. Paina sivupalkin riviä, niin pääset Koodipalveluihin.
3. Paina missä tahansa **Yhdistä uudelleen**. Matka GitHubiin on simuloitu,
   ja palaat samalle sivulle varoitusten poistuttua.
4. Kokeile syitä **GitHub ei vastaa** ja **Organisaatio estää** Uusi
   työtila- ja Koodipalvelut-näkymissä. Näitä palvelin ei vielä tunnista.
   Ne näyttävät, mitä saisit, jos palvelimelle lisätään tieto
   (`result.md`).
5. Vaihda **Puhelin** ja **Vaalea**.

## Mitä minun pitäisi päättää

- Mikä suunta (1, 2 vai 3)? Suosittelen suuntaa 2 (perustelu tiedostossa
  `result.md`).
- Saako oletusrepon lisätä tarkistamatta, kun yhteys ei toimi?
- Tehdäänkö palvelimelle tiedot "GitHub ei vastaa" ja "organisaatio estää"
  nyt vai myöhemmin?
