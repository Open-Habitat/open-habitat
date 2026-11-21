# Prototyyppikierros 2: ohjeet agentille käyttöönoton viimeisenä vaiheena

## Saatesanat

Jari, ohjeet ovat nyt osa itse käyttöönottoa. Reitin vaiheet ovat GitHub,
Repot, AI-tili ja viimeisenä **Ohjeet agentille**. Uusi vaihe näkyy reitin
edistymisessä samalla tavalla kuin muut ja piirtyy samaan tuotannon
vaihekorttiin. Avaa sivu, niin näet viimeisen vaiheen, ja valitse suunta
alareunasta. **Alkuun kirjautumisesta** klikkaa koko ketjun läpi
kirjautumisesta lähtien. Viimeisessä vaiheessa agentti kertoo, mitä se jo
tietää sinusta (nimi ja kuvaus GitHubista, kieli Habitatin kielestä), ja kysyy
kaksi puuttuvaa asiaa: millaisia vastauksia haluat ja mitä se ei saa tehdä
kysymättä. Tallenna ohjeet kirjoittaa tiedoston `~/.pi/agent/AGENTS.md`, ja
Clauden `~/.claude/CLAUDE.md` saa siihen tuontirivin. Tee myöhemmin ei kirjoita
mitään, ja reitti päättyy silti. Tili-valinnalla näet tilanteen, jossa ohjeet
ovat jo olemassa: vanhan tekstin päälle ei kirjoiteta, vaan sen perään
ehdotetaan merkittyjä lisäyksiä. Suosittelen suuntaa **B Tiedosto**.

## Sivu

- Rakennettu sivu: `/var/tmp/agent-keep/new-user-agent-instructions-template/round-2/offline.html`
  (fontit upotettuina) ja `index.html` (ilman fontteja Glasspadia varten).
- Ruutukaappaukset (104 kpl; 1440 ja 390 px; Päivä, Yö ja Kontrasti; suomi ja
  englanti; uusi ja olemassa oleva tili): `/var/tmp/agent-keep/new-user-agent-instructions-template/round-2/shots/`.
- Lähteet: `design-system/prototypes/rounds/2026-11-21-onboarding-instructions-2/`.
  Rakennus: `node build.mjs <out>`, tarkistus: `node check.mjs <out>/offline.html <shots>`
  (1072 tarkistusta, konsoli puhdas).
- Pohja, hostin puoli ja Clauden tuontirivi: kierroksen `NOTES.md`.

## Akseli ja suunnat

Akseli: **missä muodossa viimeinen vaihe kokoaa ohjeet.** Agentti kirjoittaa
ohjeet kaikissa suunnissa ja kysyy samat kaksi asiaa.

- **A Keskustelu**: vaihekortissa on pieni keskustelu. Agentti esittelee,
  mitä se tietää, näyttää luonnoksen keskustelussa ja kysyy puuttuvat asiat
  yksi kerrallaan pikavastauksina. Omin sanoin kirjoitettu teksti menee
  Muuta-osioon. Tämä on kierroksen 1 suositus siirrettynä vaiheen
  asetteluun. Vaihe tuntuu agentilta, mutta tiedosto vierii keskustelun
  mukana pois näkyvistä.
- **B Tiedosto**: vaihe näyttää tiedoston, sellaisena kuin se kirjoitetaan.
  Jokaisen tunnetun rivin vieressä lukee, mistä tieto tuli (GitHubista,
  GitHub-kuvauksesta, Habitatin kielestä). Puuttuvat kohdat valitaan
  napeilla suoraan tiedostosta. Agentin pieni keskustelu on vieressä, ja
  sille voi kirjoittaa omin sanoin. Agentti kuittaa, kun tiedosto on valmis.
- **C Lomake**: lyhyt ohjattu lomake, jonka kentät on täytetty valmiiksi
  GitHubin tiedoilla. Jokaisessa kentässä on Kysy agentilta -apu, jonka
  ehdotuksen saa käyttöön yhdellä painalluksella. Valmiin tiedoston saa
  näkyviin. Nopein täyttää, mutta muistuttaa asetussivua, ja agentti on
  vain apuna.

Kaikille suunnille yhteistä:

- Tallenna ohjeet: reitin viimeinen vaihe merkitään valmiiksi
  ("Tallennettu"), ja kortti näyttää `write`-rivit kummallekin tiedostolle,
  tiedoston sisällön ja painikkeen Siirry Habitatiin.
- Tee myöhemmin: mitään ei kirjoiteta. Vaihe merkitään ohitetuksi
  ("Myöhemmin"), ja reitti päättyy. Työtilat-sivulla on muistutus, jonka
  Tee nyt -painike avaa saman vaiheen Asetuksiin (Tili → Ohjeet agentille).
- Olemassa oleva tiedosto: vanha teksti on ensin harmaana, lisäykset on
  merkitty, kieltä ei kysytä, ja Lisää ehdotukset tekee kumpaankin
  tiedostoon `edit`-muutoksen. Jätä ennalleen ei kirjoita mitään
  ("Ennallaan").

## Suositus

**B Tiedosto.** Vaihe kertoo jo ensimmäisessä näkymässä, mitä tapahtuu:
tämä tiedosto, tähän paikkaan, ja jokaisen rivin alkuperä näkyy. Ihminen ei
joudu arvaamaan, mitä agentti tekee hänen puolestaan. Kaksi valintaa riittää,
ja koska ne tehdään tiedostossa, tulos näkyy heti oikeassa kohdassa. Agentti
on vieressä niitä varten, jotka haluavat sanoa jotain omin sanoin, eikä
pakota keskustelemaan niitä, jotka haluavat vain jatkaa. Käyttöönoton
vaiheena B myös sopii reitin muihin vaiheisiin (valitse ja jatka) paremmin
kuin keskustelu. A on hyvä varavaihtoehto, jos rivikohtaiset lähteet ja
tiedostoon upotetut valinnat osoittautuvat tuotannossa raskaiksi: se toimii
myös pelkällä vapaalla tekstillä.

## Mitä host-tietoja näkymä olettaa

- Reitissä on uusi vaihetunnus (`OnboardingStepId`), ja sen nimi tulee
  `onboardingFrameText`-tekstiluetteloon. Prototyyppi paikkaa rakennuksen
  aikana juuri tämän kohdan, joten kaikki vaiheet piirtyvät tuotannon
  kehyksellä.
- Vaihe tulee AI-tilin jälkeen, koska agentti tarvitsee käyttökelpoisen
  mallin. Vaihe käynnistää tavallisen Pi-session kotihakemistossa (`cwd = ~`)
  julkaisun mukana tulevalla taidolla. Daemonin operaatio on sama kuin
  minkä tahansa selainkeskustelun, ja vain esitys on vaiheen oma. Sessio jää
  natiiviksi historiaksi.
- Agentti kirjoittaa tiedostot ihmisen omana Unix-käyttäjänä omilla
  työkaluillaan: luonti `O_EXCL`:llä, lisäys vertaa ja vaihda -säännöllä ja
  `rename`llä. Uutta valtuutta ei tarvita.
- "Valmis, myöhemmin tai ennallaan" on käyttöönoton oma merkintä samaan
  tapaan kuin `finishFirstRoute`. Ohjetiedoston olemassaolo luetaan
  tiedostosta.

## Päätökset myöhempää katselmointia varten

- **Vaihe tulee AI-tilin jälkeen.** Vaihtoehto oli sijoittaa se ennen
  AI-tiliä ja käyttää determinististä pohjaa. Agentti tarvitsee mallin, ja
  Jari pyysi vaihetta ketjun viimeiseksi.
- **Agentti käyttää tavallista Pi-sessiota, ja vaihe piirtää sen omaan
  asetteluunsa.** Vaihtoehdot olivat `pi -p`-kertakutsu uudella
  daemon-operaatiolla tai pohja, jonka daemon kirjoittaa ilman mallia.
  Tavallinen sessio ei tarvitse uutta valtuutta ja jää natiiviksi
  historiaksi.
- **Vaiheen sessio näkyy myöhemmin historiassa (`~`, "Ohjeet agentille").**
  Vaihtoehto oli arkistoida se heti. Piilottaminen olisi ristiriidassa sen
  kanssa, että selain näyttää natiivin tilan.
- **Tallennuksen jälkeen näytetään valmis-kortti.** Vaihtoehto oli siirtyä
  suoraan Habitatiin. Kortti näyttää, mitkä tiedostot kirjoitettiin ja
  minne. Se maksaa yhden painalluksen, ja muut vaiheet päättyvät
  tuotannossa heti.
- **Puhuttelunimeksi ehdotetaan etunimeä (A ja B), ja C:ssä on valmiina koko
  GitHub-nimi.** C näyttää, mitä GitHub sanoo, ja apu ehdottaa etunimeä.
- **B:n Kysy ensin -kohta on monivalinta, A:n yksi valinta.** A:n
  keskustelussa yksi vastaus kerrallaan on luontevampi.
- **AI-vaiheen kirjautuminen ohitetaan prototyypissä painikkeella.** Vaihe
  on tuotannon osista koottu, mutta oikeaa laitekoodia ei ole.

## Kysymykset Jarille

1. Kelpaako B Tiedosto viimeiseksi vaiheeksi, vai tuntuuko A:n keskustelu
   enemmän siltä, että agentti tekee työn?
2. B:n riveittäiset lähteet ja tiedostoon upotetut valinnat edellyttävät, että
   agentti palauttaa luonnoksen rakenteisena (taidon määräämä lohko tai Pi:n
   kysymystyökalu), ja selain piirtää sen. Hyväksytkö tämän, kun malli
   kirjoittaa ja vahvistaa tiedoston? Vai pidetäänkö vaihe A:n kaltaisena
   vapaan tekstin keskusteluna?
3. Saako vaiheen sessio jäädä näkyviin historiaan (`~`, "Ohjeet
   agentille"), vai arkistoidaanko se tallennuksen jälkeen?
4. Näytetäänkö tallennuksen jälkeen valmis-kortti, jossa näkyvät kirjoitetut
   tiedostot, vai siirrytäänkö suoraan Habitatiin kuten muissa vaiheissa?
5. Tili, joka on jo käynyt reitin läpi, ei näe reittiä uudelleen.
   Prototyypin "Ohjeet jo olemassa" on uusi Habitat-käyttäjä, jonka
   Unix-tilillä tiedosto on jo valmiina. Riittääkö vanhoille tileille
   Asetukset → Tili → Ohjeet agentille, vai tarvitaanko kertaluonteinen
   kehotus?
