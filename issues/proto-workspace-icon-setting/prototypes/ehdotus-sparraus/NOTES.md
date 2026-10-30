# Kuvake-ehdotukset mallin kanssa: kokeiluohje

Avaa `ehdotus-sparraus.html`. Se toimii ilman verkkoa. Suunta valitaan
alareunan valitsimesta (*Sirut*, *Keskustelu*, *Valitsimessa*), näppäimillä
1–3 tai nuolilla. Yläpalkista valitaan repo, mallin tila, näkymä (*Kone*,
*Puhelin*) ja teema. *Alkutila* peruu valinnat.

Kaikissa suunnissa on sama pohja, jonka valitsit 30.10.: otsikon kuvake avaa
valitsimen, ja valinta kirjoitetaan `.open-habitat.yaml`:iin ja
commitoidaan heti, ilman kysymystä tai ilmoitusta. Otsikon alla on
*Ehdotus*-rivi niin kauan kuin konffissa ei ole kuvaketta. Malli ehdottaa
kuvakkeita heti, kun rivi tulee näkyviin. Vastauksen viive on simuloitu
realistiseksi, noin 2–3 sekuntia. Suunnat eroavat siinä, miten mallin kanssa
sparrataan.

Mallin vastaukset ovat valmiiksi kirjoitettuja, mutta ne reagoivat toiveisiin:
kokeile esimerkiksi *leikkisämpi*, *asiallisempi*, *kettu*, *pöllö*,
*sininen*, *kirjaimet*, *logo*, *toisia* tai *lataa kuva netistä*.

## Repot

- **open-habitat**: README, aloitussivu ja logo. Logo on ehdotuksista ensimmäinen.
- **hapanjuuri** (`hapanjuurikirja`): README ja aloitussivu, ei logoa.
- **tailspin** (`tailspin-monorepo`): vain lyhyt README.
- **ei Gitiä** (`muistiinpanot`): hakemisto ilman Gitiä. Valinta kirjoittaa
  tiedoston, mutta committia ei tehdä.
- **asetettu** (`fleetrepo`): kuvake on jo konffissa, joten riviä ei näy.

## Mallin tila

- **toimii**: vastaus 2–3 sekunnissa.
- **hidas**: noin 8 sekuntia. Kolmen sekunnin jälkeen näkyy laskuri.
- **ei kirjautumista**: yhteenkään mallipalveluun ei ole kirjauduttu. Rivi
  sanoo sen, tarjoaa *Avaa asetukset* -linkin ja näyttää vaihtoehdot ilman
  mallia (katkoviivaiset: logo, kirjaimet ja nimestä arvotut emojit).
- **15 s**: malli ei vastaa, ja daemon katkaisee pyynnön 15 sekunnin kohdalla
  samoin kuin otsikoinnissa. Tämä kestää oikeasti 15 sekuntia.

## Suunnat

1. **Sirut.** Koko sparraus on otsikon alla. Rivillä on viisi sirua, ja
   jokaisessa on perustelu (*pesä agenteille*). Lisäksi on toivekenttä ja
   pikatoiveet *Leikkisämpi*, *Asiallisempi*, *Kirjaimet* ja *Toisia*. Uusi
   vastaus korvaa rivin, ja aiempiin kierroksiin pääsee nuolilla. Sirun
   klikkaus ottaa kuvakkeen käyttöön, ja rivi katoaa.
2. **Keskustelu.** Rivi on yksi rivi kolmella kuvakkeella. *Sparraa…* avaa
   pienen keskustelun, jossa malli vastaa ruuduilla ja perusteluilla ja sinä
   vastaat sanoin (*kettu*, *tummempi*). Puhelimessa keskustelu avautuu
   alapaneeliin. Minkä tahansa kierroksen ruutu kelpaa valinnaksi.
3. **Valitsimessa.** Rivi on samanlainen kuin Keskustelussa, mutta *Lisää
   ehdotuksia…* ja otsikon kuvake avaavat saman valitsimen. Sen ensimmäinen
   välilehti on *Ehdotukset* (ruudut, toive, pikatoiveet ja kierrokset), ja
   toinen on *Valitse itse* (kierroksen 1 valitsin).

Hyväksymisen jälkeen avaa Git-siru: siinä näkyy commit `Työtilan kuvake: 🦫
(open-habitat)`, eikä sivu ole ilmoittanut siitä mitään. Kuvake vaihtuu myös
sivupalkissa. Kun kuvake on asetettu, mallilta saa uusia ehdotuksia otsikon
valitsimesta (*Ehdotuksia mallilta…* tai *Sparraa mallin kanssa…*).

Jokaisen ehdotuksen alla lukee, mitä malli näkee: nimi, README:n alku,
aloitussivu, kielijakauma ja logon polku. Muuta malli ei näe.

## Suositukseni lyhyesti

**Valitsimessa.** Rivi pysyy yhtenä hiljaisena rivinä, jossa on kolme
ehdotusta. Kaikki kuvakkeen valinta on yhdessä paikassa, otsikon valitsimessa.
Lyhyeen sparraukseen (1–3 toivetta) riittää toivekenttä, eikä
keskusteluhistoriaa tarvita. Perustelut ja kysymykset ovat issuen
`result.md`:n kohdassa *Kierros 2*.
