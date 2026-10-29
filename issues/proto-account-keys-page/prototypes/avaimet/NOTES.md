# Tilin avaimet

Avaa `index.html` selaimessa. Se on yksi offline-tiedosto, joka on kirjoitettu
käsin eikä rakennettu tuotantokomponenteista. Lähde on `page.html` tässä
hakemistossa. Tiedosto rakennetaan ja tarkistetaan komennolla
`node issues/proto-account-keys-page/prototypes/avaimet/verify.mjs`.
Komento tarvitsee Playwrightin `web/node_modules`ista, tai `OH_WEB_PACKAGE`
osoittaa toisen checkoutin `web/package.json`iin. Kuvat ovat
`evidence/`-hakemistossa AVIF-muodossa laitteen skaalauksella 2.

## Mistä on kyse

Asetuksiin tulee uusi osio **Avaimet**. Siinä näkyvät tilin SSH-avaimen ja
age-avaimen (SOPS) julkiset osat, sormenjälki ja Kopioi-painike. Sivu kertoo
myös lyhyesti, mitä avain antaa ylläpitäjälle. Kun avainta ei ole, sivu voi
luoda sen. Yksityistä avainta ei näytetä, eikä sitä voi tuoda. Salaisuuksia
ei avata, eikä vastaanottajia muokata.

Syy sivulle: jos kopioit julkisen avaimen agentin vastauksesta, harhautettu
agentti voi näyttää siinä hyökkääjän avaimen. Sivu lukee avaimen tilin
tiedostosta, joten agentti ei kirjoita sitä, mitä kopioit.

## Sivun ohjaimet

- **Alareunan valitsin**: kolme suuntaa. Näppäimet 1–3 ja nuolet vaihtavat.
  Nykyistä ei ole vertailuna, koska tuotannossa ei ole avainsivua.
- **Tilillä**: mitä tilillä on valmiiksi.
  - *Ei avaimia*: uusi tili.
  - *Vain SSH*: `~/.ssh/id_ed25519` on, age-avainta ei.
  - *Molemmat*: SSH- ja age-avain.
  - *Agentin uusi avain*: lisäksi `~/.ssh/deploy_ed25519`. Agentti teki sen
    tänään, etkä ole nähnyt sitä tällä sivulla.
- **Ikkuna**: Oma, 1280 tai Puhelin. **Teema**: Tumma tai Vaalea.
- Oikeassa yläkulmassa näkyy, mitä tilillä on nyt ja mitä palvelin osaa
  tänään.

## Mikä on kaikissa suunnissa samaa

- **Mitä näytetään**: SSH-avaimesta koko julkinen rivi, sormenjälki
  (`SHA256:…`, sama kuin `ssh-keygen -lf` tulostaa), kommentti ja luontipäivä.
  age-avaimesta vastaanottaja `age1…`. Lisäksi tiedostopolku ja tieto, että
  yksityinen osa pysyy tilillä.
- **Missä avainta käytetään**: rivi kertoo esimerkiksi, että
  `~/.ssh/config` käyttää avainta kahdelle palvelimelle tai että työtilan
  `.sops.yaml` mainitsee sen. Tieto on päätelty tiedostoista, eikä se kerro,
  toimiiko pääsy.
- **Kopioi**: painike muuttuu muotoon *Kopioitu*. Viereen tulee muistutus:
  lähetä avain ylläpitäjälle ja kerro sormenjälki erikseen.
- **Ylläpitäjälle**: SSH-avaimen ylläpitäjä tarkistaa ajamalla
  `ssh-keygen -lf` saamastaan rivistä ja vertaamalla sormenjälkeä. Sinä luet
  sormenjäljen hänelle eri kanavaa pitkin, esimerkiksi puhelimessa.
  age-avaimella ei ole sormenjälkeä, joten ylläpitäjä vertaa koko riviä.
  Vertailun helpottamiseksi rivi on ryhmitelty neljän merkin ryhmiin.
- **Luo**: painike näkyy vain, kun oletustiedostoa (`~/.ssh/id_ed25519` tai
  `~/.config/sops/age/keys.txt`) ei ole. Olemassa olevaa avainta ei
  koskaan korvata. Luonti kestää hetken, ja uusi avain tulee näkyviin
  merkinnällä *Luotu juuri*.
- **Uusi avain, jota et ole nähnyt**: jos tilille on ilmestynyt avain, jota
  ei luotu tällä sivulla, se merkitään. Merkinnässä kerrotaan, milloin avain
  ilmestyi, ja sinua neuvotaan kysymään agentilta, jos et pyytänyt avainta.
  *Tunnistan tämän* poistaa merkinnän.

## Suunnat (akseli: miten avaimet listataan ja luodaan)

1. **Kortit**: SSH- ja age-avaimet ovat omina ryhminään. Jokainen avain on
   oma korttinsa, jossa kaikki on näkyvissä: koko rivi, sormenjälki, käyttö
   ja ylläpitäjän tarkistus. Puuttuvan avaimen kortissa on selitys ja
   *Luo*-painike.
2. **Taulukko**: kaikki tilin julkiset avaimet ovat yhdessä taulukossa
   (avain, lyhennetty sormenjälki, luontipäivä, Kopioi). Rivin avaamalla
   näet koko avaimen ja ylläpitäjän tarkistuksen. Puuttuvat avaimet ovat
   taulukon alla omilla riveillään *Luo*-painikkeineen. Puhelimessa taulukko
   muuttuu listaksi.
3. **Ohjattu**: sivu alkaa tehtävästä *Liitä tämä tili organisaatioosi*.
   1. Mitä ylläpitäjä tarvitsee: pääsyn palvelimille, salaisuudet vai
      molemmat?
   2. Avaimet: olemassa oleva näytetään, puuttuva luodaan tässä. Jos
      SSH-avaimia on useita, valitset yhden.
   3. Valmis viesti ylläpitäjälle: siinä ovat avaimet, sormenjälki ja
      ehdotettu laitenimi `jari-habitat`. Viestin voi kopioida kerralla.

   Alla ovat kaikki tilin avaimet lyhyenä listana.

## Kokeile näin

1. Valitse **Ei avaimia** ja käy suunnat läpi. Paina *Luo SSH-avain* ja sitten
   *Luo age-avain*. Painike häviää eikä tule takaisin.
2. Valitse **Molemmat**. Paina *Kopioi*, tai suunnassa 3 *Kopioi viesti*.
   Lue Ylläpitäjälle-teksti. Kertooko se tarpeeksi henkilölle, joka ei ole
   tehnyt tätä ennen?
3. Valitse **Agentin uusi avain**. Etsi merkintä ja paina *Tunnistan tämän*.
   Suunnassa 3 valitse vaiheessa 2 `deploy_ed25519`. Viestin sormenjälki
   vaihtuu.
4. Suunnassa 2 avaa rivi. Vertaa sitä korttiin suunnassa 1.
5. Vaihda **Puhelin** ja **Vaalea**.

## Mitä sinun pitäisi päättää

- Mikä suunta? Suosittelen suuntaa 1, Kortit, ja siihen suunnan 3 valmista
  viestiä (perustelu on tiedostossa `result.md`).
- Missä *Tunnistan tämän* -tieto säilyy? Suosittelen selainta. Silloin agentti
  ei voi merkitä omaa avaintaan nähdyksi, mutta merkintä näkyy kerran
  jokaisella laitteella.
- Onko Avaimet oma osio Laitteiden jälkeen, vai kuuluuko se Tilin alle?
- Kerrotaanko sivulla organisaatiokohtaisia asioita, esimerkiksi
  Northwindin `ssh-keys.sh add`? Ehdotan, ettei kerrota: sivu on sama kaikille
  organisaatioille.
