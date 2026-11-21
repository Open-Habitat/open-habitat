# Prototyyppikierros: käyttöönoton ensimmäinen keskustelu kirjoittaa omat ohjeet

## Saatesanat

Jari, tässä on kolme tapaa, joilla uusi ihminen päätyy käyttöönoton lopuksi
keskusteluun. Siinä agentti kirjoittaa hänen omat ohjeensa
tiedostoon `~/.pi/agent/AGENTS.md`, ja Clauden `~/.claude/CLAUDE.md` tuo saman
tiedoston yhdellä `@`-rivillä. Avaa sivu, valitse suunta alhaalta ja
napsauta kulku läpi: pikavastaukset ja oma teksti toimivat, samoin luonnoksen
muuttaminen, tallennus ja Asetukset-näkymä, jossa ohjeita voi myöhemmin lukea
ja muokata. **Alkuun käyttöönoton lopusta** näyttää kulun alusta, eli
käyttöönoton viimeisestä kortista. **Tili: Ohjeet jo olemassa** näyttää
tilanteen, jossa tiedosto on jo olemassa: agentti ei kirjoita sen päälle vaan
ehdottaa merkittyjä lisäyksiä. Tiedostoon ei tule mitään siitä, minkä
Habitatin oma ympäristökuvaus jo kertoo, vain ihminen itse: nimi, kieli, mitä
hän tekee, miten vastataan ja mitä ei tehdä kysymättä. Suosittelen suuntaa 2.
Siinä agentti näyttää heti valmiin luonnoksen siitä, mitä se jo tietää, ja
kysyy vain kaksi puuttuvaa asiaa.

## Sivu

- Rakennettu sivu: `/var/tmp/agent-keep/new-user-agent-instructions-template/offline.html`
  (fontit upotettuina) ja `index.html` (ilman upotettuja fontteja Glasspadia
  varten).
- Ruutukaappaukset (68 kpl, 1440 ja 390 px, Päivä, Yö ja Kontrasti, suomi ja
  englanti): `/var/tmp/agent-keep/new-user-agent-instructions-template/shots/`.
- Lähteet: `design-system/prototypes/rounds/2026-11-21-onboarding-instructions/`.
  Rakennus: `node build.mjs <out>`, tarkistus: `node check.mjs <out>/offline.html <shots>`
  (396 tarkistusta, konsoli puhdas). Lähdecommit `c57737cf`.
- Kysymykset sanatarkasti, pohja ja hostin puoli: kierroksen `NOTES.md`.

## Akseli ja suunnat

Akseli: **miten agentti saa tiedot ihmiseltä.**

- **1 Haastattelu**: kuusi lyhyttä kysymystä yksi kerrallaan (nimi, kieli,
  mitä teet, vastaustyyli, kysy ensin, muuta). Jokaisessa on pikavastaukset,
  Ohita ja vapaa teksti. Tuntuu eniten keskustelulta, mutta on pisin: kuusi
  vuoroa ennen kuin ihminen näkee, mitä niistä syntyy.
- **2 Luonnos ensin**: agentti kertoo, mitä se tietää ja mistä (nimi
  GitHubista, kieli Habitatin kielestä, työ GitHub-kuvauksesta), ja sanoo
  suoraan, ettei kirjoita yhdistettyjä tilejä tai työtiloja ohjeisiin, koska
  näkee ne aina ajantasaisina. Luonnos näkyy heti. Puuttuvat kaksi asiaa
  (vastaustyyli ja kysy ensin) kysytään pikavastauksina, ja jokainen vastaus
  päivittää luonnoksen. Tallennus käy kortista tai vastauksella "Näyttää
  hyvältä, tallenna".
- **3 Lomake**: keskusteluun tulee lomakekortti, jossa ovat samat asiat
  kenttinä. Se on nopein täyttää, mutta muistuttaa asetussivua eikä
  keskustelua. Lähetetty lomake jää historiaan lukittuna, ja lähetys näkyy
  ihmisen viestinä.

Kaikille yhteistä:

- luonnoskortti: polku, Uusi tiedosto / Lisäys nykyiseen, Clauden viittaus,
  "kirjoitan vain, jos tiedosto on yhä sama", Tallenna / Muuta vielä; vanha
  luonnos merkitään korvatuksi
- tallennus näkyy tuotannon tool-riveinä (`write` tai `edit` kummallekin
  tiedostolle)
- käyttöönoton loppurivi: Siirry työtiloihin / Näytä ohjeet asetuksissa
- kentän yllä käyttöönoton kaista ja sen **Tee myöhemmin**, joka ei kirjoita
  mitään ja jättää Työtilat-sivulle muistutuskortin

## Suositus

**2 Luonnos ensin.** Ihminen näkee jo ensimmäisessä näkymässä, millainen
tiedosto on ja mihin se tallentuu, joten "ohjeet agentille" muuttuu
konkreettiseksi ennen yhtäkään kysymystä. Agentti kertoo myös, mistä kukin
tieto tuli, joten se ei arvaa ihmisen puolesta. Kysymyksiä on kaksi, ja
muutokset käyvät napilla tai omin sanoin. Jos agentti tietää vähän (ei
GitHub-kuvausta), suunnan 2 kulku voi pudota suunnan 1 kysymyksiin
puuttuvien kohtien osalta. Lomake (3) sopii paremmin Asetukset-näkymän
"Muokkaa tekstinä" -toiminnon rinnalle kuin ensimmäiseen keskusteluun.

## Mitä host-tietoja näkymä olettaa

- Käyttöönoton viimeinen kortti tulee AI-tilin jälkeen (`OnboardingFrame
  step="done"`), ja Aloita keskustelu luo tavallisen selainkeskustelun
  kotihakemistoon (`cwd = ~`). Keskustelu alkaa julkaisun mukana tulevalla
  taidolla (esimerkiksi `/skill:open-habitat-instructions`), joka sisältää
  kysymykset, pohjan ja kirjoitussäännöt.
- Agentti kirjoittaa tiedostot omilla työkaluillaan ihmisen Unix-käyttäjänä.
  Uutta valtuutta tai daemon-operaatiota keskustelukulku ei tarvitse.
- Tiedoston olemassaolo luetaan tiedostosta. "Tehty tai myöhemmin" on
  käyttöönoton merkintä samaan tapaan kuin `finishFirstRoute`.
- Asetukset → Tili → Ohjeet agentille lukee tiedoston. Sen Muokkaa
  tekstinä -toiminto tarvitsisi daemonilta uuden lukemis- ja
  kirjoitusoperaation (ihmisen omana käyttäjänä, vertaa ja vaihda). Tämä on
  kysymys alla.

## Päätökset myöhempää katselmointia varten

- **Keskustelu kotihakemistossa (`~`), ei työtilassa.** Vaihtoehdot:
  ensimmäinen kloonattu työtila tai oma piilotettu työtila. Ohjeet koskevat
  koko tiliä eivätkä yhtä repoa. Uudella ihmisellä ei myöskään välttämättä
  ole yhtään työtilaa.
- **Kortti `step="done"`, ei neljäs reittivaihe.** Vaihtoehto: oma vaihe
  "Ohjeet" reitille. Vaihe olisi pakollisen näköinen, vaikka tämä on
  vapaaehtoinen. Reitin vaihetyyppi on myös suljettu (`OnboardingStepId`).
- **Clauden viittaus `@~/.pi/agent/AGENTS.md`-tuontirivinä, ei symlinkkinä.**
  Symlinkki korvaisi ihmisen oman `CLAUDE.md`:n. Tuontirivi säilyttää sen.
- **Clauden tiedosto kirjoitetaan aina, vaikka ihminen ei olisi kirjautunut
  Claudeen.** Rivi on pieni ja harmiton, ja myöhemmin kirjautuva saa
  ohjeet heti. Vaihtoehtona olisi kirjoittaa se vasta Claude-kirjautumisen
  yhteydessä.
- **Tiedosto kirjoitetaan keskustelun kielellä.** Agentti lukee sen
  kummallakin kielellä.
- **Kaistan "kysymys n/N" on prototyypin oma.** Tuotannossa luku vaatisi
  agentilta rakenteista tietoa. Vaihtoehto on jättää laskuri pois ja pitää
  kaistassa vain "Käyttöönotto · Tee myöhemmin".
- **Pikavastaukset ovat kierroksen oma osa.** Tuotannossa ne vaativat
  tavan, jolla agentti tarjoaa vaihtoehtoja. Pi:n kysymystyökalu tai
  vastaava on arkkitehtuurikysymys.

## Kysymykset Jarille

1. Kelpaako suunta 2 (luonnos ensin), ja pudotaanko siinä haastatteluun,
   kun agentti tietää vähän?
2. Tarvitaanko pikavastauksia tuotannossa? Ne vaativat keskusteluun uuden
   "agentti tarjoaa vaihtoehdot" -osan (ehkä Pi:n kysymystyökalu). Ilman niitä
   kulku toimii vapaalla tekstillä, mutta on raskaampi aloittelijalle.
3. Saako Asetuksiin tulla "Muokkaa tekstinä" (daemon kirjoittaa
   `~/.pi/agent/AGENTS.md`:n ihmisen omana käyttäjänä)? Vai riittääkö "Muuta
   keskustelemalla" ja editori, joka ei nyt yllä kotihakemistoon?
4. Mitä olemassa oleva tili näkee? Prototyypissä käyttöönotto tarjoaa samaa
   keskustelua ja Asetukset näyttää tiedoston. Tarvitaanko vanhoille tileille
   kertaluonteinen ilmoitus, vai riittääkö Asetukset?
5. Pitäisikö keskustelun näkyä sivupalkissa omana työtilanaan (`~`) vai
   arkistoitua tallennuksen jälkeen?
