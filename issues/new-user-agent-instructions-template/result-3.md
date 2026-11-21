# Prototyyppikierros 3: ohjeiden vaihe lyhyemmin sanoin, tiedosto näytetään lopuksi

## Saatesanat

Jari, vaihe on yhä reitin viimeinen pieni keskustelu, kuten valitsit (A).
Tällä kertaa muutin vain sen, mitä ihmiselle sanotaan, ja sen, miten valmis
tiedosto näytetään. Keskustelussa ei enää puhuta poluista, AGENTS.md:stä,
Pi:stä eikä Claudesta. Jokainen vuoro on yhdestä kahteen lyhyttä lausetta.
Tallenna-painike tulee näkyviin vasta, kun tiedosto on näytetty. Tekniset
tiedot (polut ja kirjoitetut tiedostot) ovat tallennuksen jälkeen suljetun
"Missä ohjeet ovat?" -kohdan takana. Muunnelmia on kolme. **A1 Lyhyesti**
kysyy kaksi asiaa vähin sanoin ja näyttää ohjeet listana selityksineen.
**A2 Muistilappu** perustelee vaiheen sillä, ettei agentti muista
keskusteluja, ja näyttää lapun reunahuomautuksin. **A3 Esittely** kirjoittaa
ihmisen suulla lyhyen tekstin, jota voi muokata itse. Avaa sivu ja vaihda
muunnelmaa alareunasta. **Hyppää valmiiseen tiedostoon** näyttää
tiedostonäkymät suoraan. Keskustelua ei näytetä sivupalkissa koskaan. Se ei
vaadi uutta koodia, koska kotihakemistossa ajettu sessio ei kuulu mihinkään
työtilaan. Suosittelen muunnelmaa **A2 Muistilappu**.

## Sivu

- Rakennettu sivu: `/var/tmp/agent-keep/new-user-agent-instructions-template/round-3/offline.html`
  (fontit upotettuina) ja `index.html` (ilman fontteja Glasspadia varten).
- Ruutukaappaukset (78 kpl; 1440 ja 390 px; Päivä, Yö ja Kontrasti; suomi ja
  englanti; uusi ja olemassa oleva tili):
  `/var/tmp/agent-keep/new-user-agent-instructions-template/round-3/shots/`.
- Lähteet: `design-system/prototypes/rounds/2026-11-21-onboarding-instructions-3/`.
  Rakennus: `node build.mjs <out>`. Tarkistus: `node check.mjs <out>/offline.html <shots>`
  (1096 tarkistusta, konsoli puhdas).
- Sivupalkkipäätöksen perustelu ja yhteiset säännöt: kierroksen `NOTES.md`.

## Akseli ja muunnelmat

Akseli: **millä sanoilla vaihe puhuu ja miten valmis tiedosto näytetään.**
Tiedot, kysymykset ja vastausvaihtoehdot ovat samat kaikissa muunnelmissa.

- **A1 Lyhyesti.** "Kerro agentille itsestäsi. Kaksi kysymystä. Agentti
  muistaa vastaukset jokaisessa keskustelussa." Lopuksi "Ohjeesi" näytetään
  luettavana listana, ja jokaisen otsikon alla lukee harmaalla, mitä kohta
  tarkoittaa ("Tätä agentti ei tee ilman lupaasi"). Tämä on lyhin muunnelma,
  mutta ihmiselle ei kerrota, miksi agentti tarvitsee tätä.
- **A2 Muistilappu.** "Agentti ei muista aiempia keskusteluja. Tehdään sille
  muistilappu, jonka se lukee aina ensin." Agentti kertoo, mitä se otti
  GitHubista, ja kysyy, laitetaanko tieto lappuun (Kyllä, laita / Jätä pois).
  Sen jälkeen se kysyy samat kaksi asiaa. Lappu näytetään kortilla, jonka
  reunahuomautus kertoo kunkin kohdan merkityksen ("Siksi vastaukset tulevat
  suomeksi"). Näytä tiedostona -painike näyttää varsinaisen tekstin polkuineen
  sille, joka haluaa nähdä sen.
- **A3 Esittely.** "Agentti kirjoittaa sinusta lyhyen esittelyn, ikään kuin
  kertoisit itse." Esittelyn alku näkyy jo ensimmäisessä vuorossa. Lopuksi
  tiedosto on tavallista proosaa ("Hei, olen Aino. … Kysy minulta ennen kuin
  julkaiset jotain."), ja sen alla on yksi "Mitä tämä on?" -selitys. Muokkaa
  itse -painike tekee tekstistä muokattavan. Tiedosto on helpoin lukea, mutta
  agentin lisäykset ja myöhemmät muokkaukset eivät enää osu nimettyihin
  kohtiin.

Kaikissa muunnelmissa sama: Tallenna vasta näytetyn tiedoston jälkeen, omin
sanoin kirjoitettu teksti menee heti tiedostoon, tallennuksen jälkeen yksi
selkokielinen lause ja tekniset tiedot suljettuina, olemassa olevan
tiedoston vanha teksti harmaana ja lisäykset merkittyinä, ja Tee myöhemmin
sekä Jätä ennalleen eivät kirjoita mitään.

## Suositus

**A2 Muistilappu.** Uudelle käyttäjälle "ohjeet agentille" on abstrakti
asia. Muistilappu kertoo yhdellä sanalla, miksi vaihe on olemassa: agentti
ei muista, joten sille kirjoitetaan lappu. Lisäksi se tekee näin ennen kuin
kysyy mitään. GitHubin tiedon tarkistus näyttää ihmiselle, mistä agentti
tietää asioita hänestä, ja antaa jättää tiedon pois. Juuri tätä kierroksen 2
rivikohtaiset lähteet yrittivät kertoa, nyt yhdellä kysymyksellä. Kortin
reunahuomautukset vastaavat kysymykseen "mitä tämä tarkoittaa?" ilman, että
tiedostoa tarvitsee osata lukea. Raaka tiedosto on silti yhden painalluksen
päässä, joten mitään ei piiloteta. Tiedosto pysyy otsikoituna listana, joten
agentti ja Asetusten näkymä voivat lisätä siihen kohtia myöhemmin. A3:n
proosa ei tätä tue.

## Päätökset myöhempää katselmointia varten

- **Keskustelua ei näytetä sivupalkissa koskaan.** Vaihtoehdot olivat
  arkistointi tallennuksen jälkeen tai näyttäminen `~`-ryhmänä. Daemon
  liittää sivupalkkiin vain sessiot, joiden `cwd` on työtila. Kotihakemiston
  sessio ei siksi näy nytkään, joten piilottaminen ei vaadi uutta koodia, ja
  arkistointi olisi turha kirjoitus näkyvyystilaan. Sessio jää tavalliseksi
  Pi-historiaksi (`pi --resume` kotihakemistossa). Lopputulokseen pääsee
  Asetuksista tai pyytämällä agenttia.
- **Tallenna näkyy vasta, kun tiedosto on näytetty.** Vaihtoehto oli pitää
  painike näkyvissä koko ajan, kuten kierroksessa 2. Jari halusi tiedoston
  näkyviin ennen reitin loppua, ja tämä takaa sen.
- **Tekniset tiedot ovat tallennuksen jälkeen suljetun kohdan takana, eivät
  poissa.** Vaihtoehdot olivat jättää ne kokonaan pois tai näyttää aina.
  Aloittelija ei tarvitse polkuja. Kokenut käyttäjä haluaa tietää, mihin
  kirjoitettiin, ja design-järjestelmä edellyttää, että tunnisteet
  näytetään sellaisinaan.
- **Tiedoston johdanto on tavallista kieltä, eikä siinä mainita Pi:tä tai
  Claudea.** Ihminen avaa tiedoston myöhemmin, ja selitys siitä, mikä ohjelma
  sen lukee, on hänelle teknistä tietoa.
- **Kysymykset ovat yhden valinnan pikavastauksia (kaksi, A2:ssa kolme).**
  Pikavastaukset hyväksyttiin kierroksella 2.
- **Huutomerkkejä ei käytetä ("Hei Aino.").** Design-järjestelmä pitää kielen
  rauhallisena. Lämpö tulee nimestä ja lyhyydestä.

## Kysymykset Jarille

1. Kelpaako A2 Muistilappu? Vai tuntuuko A1:n lyhyys tai A3:n oma ääni
   paremmalta?
2. Saako vaihe käyttää sanaa "muistilappu", vaikka Asetuksissa kohdan nimi on
   "Ohjeet agentille"? Vai nimetäänkö myös Asetusten kohta ja reitin vaihe
   muistilapuksi?
3. Riittääkö, ettei keskustelu koskaan näy sivupalkissa, kun sen ainoa jälki
   on tiedosto ja natiivi Pi-historia?
4. A3:ssa tiedosto on proosaa. Hyväksytkö, että agentti ja Asetukset eivät
   silloin voi lisätä kohtia nimettyihin otsikoihin? (Tämä koskee vain A3:a,
   jos se valitaan.)
