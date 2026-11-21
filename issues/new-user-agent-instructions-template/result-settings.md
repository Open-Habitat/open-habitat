# Prototyyppikierros: Asetukset › Tili › Ohjeet agentille

## Saatesanat

Jari, tässä on näkymä, josta vanha tili löytää omat ohjeensa. Se on
Asetusten Tili-sivulla, Git-identiteetin alla, ja näyttää tiedoston, jota
agentti lukee jokaisen keskustelun alussa. Näkymässä kerrotaan, mistä ohjeet
tulevat (yksi tiedosto, jota Pi lukee ja Claude lukee viittauksen kautta), ja
siinä on painike Muokkaa agentin kanssa. Painike avaa tavallisen
keskustelun, jossa agentti on jo lukenut ohjeet, ehdottaa muutosta ja
tallentaa sen, kun sanot. Sen jälkeen pääset takaisin asetuksiin ja näet
päivittyneet ohjeet. Valitse ylhäältä **Tilanne**: Käyttöönotossa
kirjoitetut, Ei vielä ohjeita tai Itse kirjoitetut. Viimeisessä agentti ei
kirjoita oman tekstisi päälle, ja näkymä kertoo, ettei Claude lue ohjeita.
Agentti tarjoutuu korjaamaan sen. Suunta valitaan alareunasta. Suosittelen
suuntaa **A Luku**.

## Sivu

- Rakennettu sivu: `/var/tmp/agent-keep/new-user-agent-instructions-template/settings/offline.html`
  (fontit upotettuina) ja `index.html` (ilman fontteja Glasspadia varten).
- Ruutukaappaukset (44 kpl; 1440 ja 390 px; Päivä ja Yö; kaikki suunnat ja
  tilanteet sekä kulut; englanti):
  `/var/tmp/agent-keep/new-user-agent-instructions-template/settings/shots/`.
- Lähteet: `design-system/prototypes/rounds/2026-11-21-instructions-settings/`.
  Rakennus: `node build.mjs <out>`, tarkistus: `node check.mjs <out>/offline.html <shots>`
  (551 tarkistusta, konsoli puhdas). Rakenne ja tilanteet: kierroksen `NOTES.md`.

## Akseli ja suunnat

Akseli: **miten ohjeet näytetään ja muutetaan ensimmäisessä näkymässä.**

- **A Luku**: ohjeet luettavana tekstinä ja yksi painike, Muokkaa agentin
  kanssa. Muutokset tehdään aina agentin kanssa, samalla tavalla kuin
  käyttöönotossa.
- **B Teksti**: tiedosto sellaisenaan tasalevyisenä. Muokkaa agentin kanssa
  -painikkeen vieressä on Muokkaa tekstinä, joka avaa tiedoston
  tekstikenttään (Tallenna, Peru). Ilman tiedostoa B tarjoaa myös
  vaihtoehdon Kirjoita itse.
- **C Osiot**: ohjeet pohjan osioina riveinä (Kuka olen, Kieli, Miten
  vastaat, Kysy ensin, Muuta). Rivin Muuta tai Lisää avaa keskustelun juuri
  siitä osiosta. Agentti lainaa nykyisen rivin ja tarjoaa osion omat
  vaihtoehdot. Itse kirjoitettua tiedostoa ilman osioita C ei osaa jakaa, ja
  se näytetään sellaisenaan.

Kaikille yhteistä:

- Lähdeosa: tiedoston polku, "Pi lukee tämän tiedoston", lukeeko Claude sen
  (tuontirivi `~/.claude/CLAUDE.md`:ssä vai ei), muokkauspäivä ja
  "Päivitetty juuri" palattaessa.
- Rivi "Voit myös sanoa agentille missä tahansa keskustelussa: ’Lisää
  ohjeisiini, että…’".
- Keskustelu: avautuu kotihakemistoon (`Koti`, otsikko Ohjeet agentille).
  Pikavastaukset ehdottavat muutoksen, ehdotus näkyy `+`/`−`-muutoksena, ja
  Tallenna näyttää tuotannon tool-rivin. Oma teksti menee kohtaan Muuta.
  Itse kirjoitettuun tiedostoon tulee vain lisäyksiä. Clauden tuontirivin
  lisääminen on oma pikavastauksensa.
- Tiedostoa ei ole: tyhjä tila kertoo, että agentti kysyy pari asiaa ja
  tietää jo nimen ja kielen. Kirjoitus luo molemmat tiedostot.

## Suositus

**A Luku.** Näkymä näyttää ohjeet sellaisina kuin agentti ne lukee, ja
muuttaminen tapahtuu yhdellä tavalla, samoin kuin käyttöönotossa.
Keskustelu hoitaa myös vaikeat tapaukset, joita lomake tai tekstikenttä ei
hoida: itse kirjoitetun tiedoston, josta ei saa kirjoittaa päälle, ja
Clauden puuttuvan viittauksen. A ei myöskään tarvitse uutta valtuutta, koska
kirjoittajana on aina agentti ihmisen omana käyttäjänä. B:n Muokkaa tekstinä
on hyödyllinen niille, jotka haluavat kirjoittaa itse, mutta se vaatii
daemonille uuden kirjoitusoperaation kotihakemistoon (kysymys 2). C näyttää
siistiltä vain niin kauan kuin tiedosto noudattaa pohjaa. Ensimmäinen itse
tehty muutos voi pudottaa sen tilaan, jossa tiedosto näytetään sellaisenaan.

## Mitä host-tietoja näkymä olettaa

- **Luku**: näkymä lukee tiedostot `~/.pi/agent/AGENTS.md` ja
  `~/.claude/CLAUDE.md` (onko tuontirivi `@~/.pi/agent/AGENTS.md` mukana)
  sekä muokkausajan. Tämä on uusi daemonin lukuoperaatio ihmisen omana
  käyttäjänä, joka lukee vain nämä kaksi kiinteää polkua. Tila luetaan aina
  tiedostoista, eikä Habitat tallenna niistä mitään.
- **Muokkaa agentin kanssa**: luo tavallisen selainkeskustelun
  kotihakemistoon samalla operaatiolla kuin muutkin keskustelut, ja viesti
  lähtee julkaisun mukana tulevan ohjetaidon kanssa (sama taito kuin
  käyttöönoton vaiheessa). C:n osiopainike lisää viestiin osion nimen. Agentti
  kirjoittaa omilla työkaluillaan kierroksen 2 säännöillä: uusi tiedosto
  luodaan `O_EXCL`:llä, olemassa olevaan tehdään vertaa ja vaihda -muutos, ja
  itse kirjoitettuun tiedostoon vain lisätään.
- **B:n Muokkaa tekstinä**: vaatisi daemonille kirjoitusoperaation samaan
  kiinteään polkuun ihmisen omana käyttäjänä. Tallennus onnistuisi vain, jos
  tiedosto on yhä sama kuin luettaessa. Tätä ei ole nyt.

## Päätökset myöhempää katselmointia varten

- **Lohko on Tili-sivulla Git-identiteetin alla omana otsikkonaan, ei oma
  osionsa sivupalkissa.** Vaihtoehdot olivat oma osio (esimerkiksi
  Tekoälyn alla) tai "Tiedot agenteille". Jari nimesi polun Tili › Ohjeet
  agentille, ja ohjeet kertovat ihmisestä, eivät mallista.
- **Muokkaa agentin kanssa aloittaa aina uuden keskustelun eikä jatka
  käyttöönoton keskustelua.** Vaihtoehto oli "Jatka edellistä keskustelua".
  Agentti lukee joka kerta tiedoston, joten jatkuvuus tulee tiedostosta eikä
  vanhasta keskustelusta. Silloin käyttöönoton keskustelua ei tarvitse
  arkistoida eikä löytää uudelleen, ja se voi jäädä historiaan muiden
  joukkoon (kierroksen 2 päätös pysyy).
- **Ohjeiden alkuperää (käyttöönotto vai itse kirjoitettu) ei tallenneta.**
  Vaihtoehtona oli merkintä tiedostoon tai Habitatin tilaan. Näkymä ja agentti
  päättelevät tilanteen tiedoston sisällöstä: pohjan osiot tai vapaa teksti.
  Erillinen merkintä olisi toinen paikka, jossa totuus voisi erota
  tiedostosta. Prototyypissä "Itse kirjoitetut" -huomautus näytetään
  tilanteen perusteella. Tuotannossa sen näyttämisen ehto on, ettei
  tiedostossa ole pohjan osioita.
- **Ehdotus näytetään keskustelussa koko tiedostona, jossa muutokset on
  merkitty.** Vaihtoehto oli näyttää vain muuttuneet rivit. Koko tiedosto
  kertoo, missä kohdassa muutos on. Pitkässä tiedostossa muutos voi jäädä
  vierityksen alle, joten tuotannossa ehdotus vieritetään ensimmäiseen
  muutokseen.
- **Tyyliä koskeva valinta korvaa vanhan rivin, ja muut valinnat lisäävät
  rivin.** Itse kirjoitettuun tiedostoon vain lisätään.
- **"Kysy ennen pushia" ja muut pikavastaukset ovat samat kuin
  käyttöönotossa.** Tuotannossa taito antaa ne.
- **Teemoista mukana ovat Päivä ja Yö.** Kontrasti jäi pois, koska
  tehtävässä pyydettiin vain Päivä ja Yö.

## Kysymykset Jarille

1. Kelpaako A Luku, eli ohjeita muutetaan Asetuksista vain agentin kanssa?
2. Tarvitaanko B:n Muokkaa tekstinä? Se vaatii daemonille uuden
   kirjoitusoperaation `~/.pi/agent/AGENTS.md`:hen ihmisen omana käyttäjänä
   (vertaa ja vaihda). Ilman sitä itse kirjoittava voi käyttää
   terminaalia tai editoria. Editori ei tosin nyt ylety kotihakemistoon.
3. Saako Asetukset lukea nämä kaksi tiedostoa uudella daemonin
   lukuoperaatiolla (kiinteät polut, vain luku)? Tämä tarvitaan kaikissa
   suunnissa.
4. Riittääkö, että Muokkaa agentin kanssa aloittaa aina uuden keskustelun,
   jolloin käyttöönoton keskustelua ei tarvitse jatkaa eikä arkistoida?
5. Kun Claude ei lue ohjeita (oma `CLAUDE.md` ilman viittausta), riittääkö
   että näkymä kertoo sen ja agentti tarjoutuu lisäämään viittauksen? Vai
   pitäisikö Asetuksissa olla siihen oma painike?
