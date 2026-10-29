# Tulos: tilin avainsivu (kierros 1)

Prototyyppi on `prototypes/avaimet/index.html`, yksi offline-HTML. Se on
rakennettu käsin kirjoitetusta sivusta `prototypes/avaimet/page.html`.
`build.mjs` lisää siihen tokenit, upotetut fontit ja yhteisen valitsimen
(`design-system/prototypes/lib/picker.*`). Jarin opas on
`prototypes/avaimet/NOTES.md`. Kuvat ovat `prototypes/avaimet/evidence/`-hakemistossa
AVIF-muodossa (laitteen skaalaus 2, `scripts/screenshots-to-avif.py`,
41 kuvaa).

`verify.mjs` tarkistaa jokaisessa suunnassa kaikilla neljällä tilillä,
työpöydällä ja puhelimessa:

- sivulla ei ole yksityistä avainta, latausta eikä *Näytä yksityinen*
  -painiketta;
- *Luo* näkyy täsmälleen silloin, kun oletustiedosto puuttuu;
- näkemättömän avaimen merkintä näkyy täsmälleen silloin, kun agentin avain
  on tilillä.

Lisäksi se tarkistaa nämä:

- luonti: ensin *Luodaan…*, sitten uusi avain ja sormenjälki, eikä
  *Luo*-painike palaa;
- kopiointi: *Kopioitu* ja muistutus; suunnan 3 viestissä ovat SSH-rivi,
  sormenjälki ja age-vastaanottaja;
- suunta 3: kun tarve poistetaan, rivi poistuu viestistä; kun mitään ei ole
  valittu, vaihe 3 odottaa; valittu SSH-avain vaihtaa viestin sormenjäljen;
- *Tunnistan tämän* poistaa merkinnän ja sen merkin;
- suunnan 2 rivin avaaminen työpöydällä ja puhelimessa.

Konsolivirheitä ja verkkopyyntöjä ei ollut, ja valitsin läpäisee
`picker-check`in. Labia ei ajettu, koska tuotannossa ei ole avainsivua.
Asetusten kehys on luettu koodista. Avaimet ovat synteettisiä mutta oikean
muotoisia: ed25519-blobit ja bech32-vastaanottajat on johdettu kiinteistä
siemenistä, ja sormenjäljet on laskettu blobeista samalla tavalla kuin
`ssh-keygen -lf` ne laskee.

## Akseli: miten avaimet listataan ja luodaan

| Suunta | Mitä se päättää | Milloin se voittaa | Hinta |
| --- | --- | --- | --- |
| 1 Kortit | Avainlaji on ryhmä, ja jokainen avain on kortti, jossa kaikki näkyy kerralla. Puuttuvan avaimen tilalla on kortti, jossa on selitys ja *Luo*. | Sivulla käydään harvoin, eikä kävijä ole tehnyt tätä ennen. Mitään ei tarvitse avata, ja ylläpitäjän tarkistus on avaimen vieressä. | Pitkä sivu. Kolme avainta vie jo kaksi näyttöä. |
| 2 Taulukko | Kaikki tilin julkiset avaimet ovat yhdessä luettelossa. Rivi avataan, ja puuttuvien avainten luonti on luettelon alla. | Avaimia on monta, esimerkiksi agentin tekemiä avaimia organisaatioittain. Kävijä on tekninen. | Koko rivi ja tarkistusohje ovat piilossa. Puhelimessa taulukko on toinen komponentti (lista). |
| 3 Ohjattu | Sivu alkaa tehtävästä: mitä ylläpitäjä tarvitsee, avaimet, valmis viesti. | Ensimmäinen liittyminen organisaatioon. Ihminen ei tiedä, kumpaa avainta pyydetään, ja viesti kulkee yhtenä kappaleena. | Toisella käynnillä vaiheet ovat turhia. Sivu, jota käytetään myös viitteenä, tarvitsee lisäksi oman avainlistan. |

Sama sisältö kaikissa suunnissa:

- julkinen rivi, sormenjälki, kommentti ja luontipäivä;
- päätelty käyttö (`~/.ssh/config` ja `.sops.yaml`);
- yksityisen osan polku;
- ylläpitäjän tarkistusohje;
- *Kopioi* → *Kopioitu*;
- *Luo* vain puuttuvalle oletustiedostolle;
- näkemättömän avaimen merkintä.

## Host-tiedot

- **Ei avainsivua nyt.** `web/src/app/settingsIndex.ts` luettelee osiot
  (Tili, Laitteet, Tekoäly, Tilannekatsaus, Sanelu, Koodipalvelut, Tiedot
  agenteille, Ulkoasu, Editori, Tallennustila, Kokeelliset ominaisuudet).
  Navigaatio rakennetaan siitä tiedostossa
  `web/src/components/Account.tsx:567`. Uusi osio tarvitsee rivin
  `settingsIndex.ts`:ään hakusanoineen. Haku ja selaintesti lukevat sen.
- **Daemon kirjoittaa ihmisen tiedostoja ihmisenä.** Esikuva on
  `internal/daemon/speech_linux.go`:
  - `writeSpeechKey` kirjoittaa ensin satunnaisnimisen tiedoston
    (`O_EXCL|O_NOFOLLOW`, `0600`), synkronoi sen ja nimeää sen sitten
    lopulliseksi;
  - `readSpeechKey` hylkää tiedoston, joka ei ole tavallinen tiedosto, ei ole
    oma tai jonka oikeudet ovat liian väljät;
  - `personalDir` (`internal/daemon/account_preferences_linux.go:113`)
    avaa hakemistopolun ilman symlinkkejä ja tarkistaa omistajan ja
    oikeudet.

  Avaimen luonti tarvitsee saman: tiedosto tehdään väliaikaishakemistoon ja
  siirretään paikalleen korvaamatta (`renameat2` + `RENAME_NOREPLACE` tai
  `linkat`). Pelkkä "katso ensin, kirjoita sitten" ei riitä, koska agentti
  voi kirjoittaa samaan aikaan.
- **Raakoja tunnuksia ei palauteta** (`internal/AGENTS.md`, agenttikuuntelijan
  kohta). Julkinen osa ja sormenjälki eivät ole tunnuksia. Vastauksessa ei
  kuitenkaan saa olla kenttää, johon yksityinen osa voisi päätyä.
- **Työkalut.**
  - `age` on vain operations-profiilissa
    (`runtime/profiles/operations/ubuntu-packages.json`), ei ytimessä.
    `age-keygen -y` puuttuu siis palvelimelta, jolla ei ole operations-profiilia.
  - `openssh-client` ei ole missään profiilissa, mutta se on koneilla.
  - `sops` ei ole mukana.
  - Go-moduulissa ei ole `golang.org/x/crypto`a. SSH-sormenjäljen voi
    laskea standardikirjastolla (base64 → SHA-256 → base64 ilman täytettä).
    age-vastaanottajan voi johtaa yksityisestä avaimesta paketeilla
    `crypto/ecdh` (X25519) ja pienellä bech32-funktiolla. Kumpikaan ei
    tarvitse ulkoista ohjelmaa.
- **Daemonilla ei ole SSH-agenttia**
  (`internal/daemon/workspace_git_fetch_linux.go:35`). Tilin avaimet ovat
  siksi salasanattomia `0600`-tiedostoja, kuten tutkimus totesi. Sivun
  luoma avain tehdään ilman salasanaa (`-N ""`).
- **Agentti on sama Unix-käyttäjä.** Se voi kirjoittaa tiedostot
  `~/.ssh/id_ed25519.pub` ja `keys.txt`. Väite "sivu lukee avaimen suoraan
  tiedostosta, ei agentin vastauksesta" pitää vain osittain:
  - Sivu poistaa agentin *keskusteluvastauksen* luottamusketjusta.
  - Tiedoston vaihtoa se ei estä. Siksi kaksi asiaa kuuluu toteutukseen:
    1. Julkinen osa johdetaan yksityisestä tiedostosta (`ssh-keygen -y`, tai
       Go suoraan), ei `.pub`-tiedostosta. Näytetty avain on silloin aina se,
       jonka yksityinen osa on tilillä. Pelkän `.pub`-tiedoston vaihto ei
       mene läpi.
    2. *Uusi avain, jota et ole nähnyt* tunnistetaan sormenjäljestä, ja
       tieto nähdyistä sormenjäljistä on paikassa, johon agentti ei
       kirjoita (ks. päätökset). Merkintä näkyy myös silloin, kun
       oletusavain on vaihtunut, ei vain kun uusi tiedosto ilmestyy.
- **Ehdotettu laitenimi `jari-habitat`** noudattaa Northwindin käytäntöä
  `<nimi>-habitat` (tutkimuksen `report.md`). Se on vain viestin teksti,
  ei mikään asetus.

## Mitä host-tietoja kukin suunta tarvitsee

Kaikki suunnat tarvitsevat saman daemon-reitin:

- **luku**: tilin SSH-avaimet (yksityiset tiedostot, joilla on `.pub`-pari
  hakemistossa `~/.ssh`), kunkin julkinen rivi, sormenjälki, kommentti ja
  muutosaika; age-vastaanottaja tiedostosta
  `~/.config/sops/age/keys.txt` ja sen muutosaika; päätelty käyttö
  tiedostosta `~/.ssh/config` (`Host` ja `IdentityFile`) ja työtilojen
  `.sops.yaml`-tiedostoista;
- **luonti**: laji `ssh` tai `age`, vain oletuspolkuun ja vain jos
  tiedostoa ei ole.

Suunta 3 ei tarvitse muuta. Viesti kootaan selaimessa samasta luvusta.
Suunta 2 tarvitsee saman luvun lajiteltuna. "Missä käytössä" on
kaikissa suunnissa valinnainen, ja sen voi jättää ensimmäisestä
toteutuksesta pois.

## Suositus

**Suunta 1, Kortit, ja siihen suunnan 3 valmis viesti napiksi** (*Kopioi
viesti ylläpitäjälle* sivun alkuun, kun molemmat avaimet ovat olemassa).

- Avainsivulla käydään muutaman kerran tilin elinaikana. Silloin ihminen ei
  muista, mikä SSH- ja age-avain ovat. Kortti näyttää kaiken avaamatta
  mitään, ja tarkistusohje on avaimen vieressä. Taulukko piilottaa juuri sen
  tekstin, jota harvoin käyvä tarvitsee.
- Ohjatun suunnan vahvin osa on viesti, jonka voi kopioida kerralla. Vaiheet
  sen sijaan ovat turhia toisella käynnillä ja kun avaimet ovat jo
  olemassa, ja sivu tarvitsee niiden lisäksi oman listan. Viesti mahtuu
  korttisuuntaan yhdeksi painikkeeksi.
- Taulukko kannattaa vasta, kun tileillä on tavallisesti monta avainta. Nyt
  oletus on yksi SSH-avain ja yksi age-avain.
- Kortit sopivat myös oman koneen yhteyteen
  (`proto-own-machine-access`): sama SSH-kortti voi näkyä siinä näkymässä
  sellaisenaan, ilman taulukon kontekstia.

## Päätökset myöhempää tarkistusta varten

1. **Osion paikka: oma osio *Avaimet* Laitteiden jälkeen.**
   - Vaihtoehdot: Tilin alle, tai Koodipalveluiden alle.
   - Miksi: avaimet koskevat tiliä eivätkä yhtä palvelua, ja
     Laitteet-osio puhuu jo "uudesta laitteesta". Tilin alla ne
     hukkuisivat profiilin ja Git-identiteetin sekaan.
2. **Mistä avaimista kerrotaan: ed25519-SSH-avaimet hakemistosta `~/.ssh`
   (yksityinen tiedosto, jolla on `.pub`-pari) ja oletus-age-identiteetti.**
   - Vaihtoehto: kaikki `*.pub`-tiedostot.
   - Miksi: pelkkä `.pub` voi olla jonkun toisen avain (esimerkiksi
     kopioitu ylläpitäjän avain). Sivun lupaus on "tämän tilin avaimet".
   - RSA- ja ECDSA-avaimet näytetään samalla kortilla, jos niitä on. Sivu luo
     vain ed25519-avaimia.
3. **Luonnin kommentti: `<käyttäjä>@<sivuston nimi>`**, esimerkiksi
   `jari@birch`.
   - Vaihtoehto: `ssh-keygen`in oletus `käyttäjä@isäntänimi`, joka paljastaisi
     VM:n sisäisen nimen.
   - Miksi: ylläpitäjä tunnistaa avaimen rivistä.
4. **Luonti ilman vahvistusikkunaa.**
   - Vaihtoehto: "Luodaanko avain?" -kysymys.
   - Miksi: luonti ei korvaa mitään eikä anna kenellekään pääsyä. Avain ei
     ole missään käytössä ennen kuin ylläpitäjä lisää sen.
5. **Näkemättömän avaimen tieto säilyy selaimessa (`localStorage`,
   sormenjäljittäin).**
   - Vaihtoehdot: `~/.config/open-habitat/preferences.json`, joka näkyisi
     kaikilla laitteilla mutta jota agentti voi kirjoittaa ja jolla agentti
     siis voisi merkitä oman avaimensa nähdyksi; gatewayn tila, joka toisi
     tilin tietoa gatewayhin ja siirtäisi auktoriteettia.
   - Miksi: merkintä on ainoa kohta, jossa sivu havaitsee agentin tekemän
     vaihdon, joten sen tiedon ei pidä olla agentin muokattavissa. Hinta on,
     että merkintä näkyy kerran jokaisella laitteella. Ensimmäisellä
     käynnillä kaikki olemassa olevat avaimet ovat "nähtyjä", ettei sivu
     hälytä turhaan.
6. **Teksti ei väitä agentin luoneen avainta.** Sivu tietää vain, ettei
   avainta luotu tällä sivulla ja milloin tiedosto muuttui. Siksi teksti on
   "ilmestyi tilille … eikä sitä luotu tällä sivulla".
7. **Ylläpitäjän tarkistus ei mainitse organisaatiokohtaisia työkaluja**
   (Northwindin `ssh-keys.sh`, `.sops.yaml`-tasot). Sivu kertoo vain
   natiivit asiat: `ssh-keygen -lf` ja koko `age1…`-rivin vertailun.
8. **age-vastaanottaja ryhmitellään neljän merkin ryhmiin vain
   vertailukohdassa.** Kopioitava rivi on aina yhtenäinen.
9. **"Missä käytössä" on päätelty, ja teksti sanoo sen.** Lähteinä ovat
   `~/.ssh/config` ja työtilojen `.sops.yaml`. Rivi ei väitä, että pääsy
   toimii.
10. **Ei poistoa eikä vaihtoa sivulta.** Tehtävänanto rajasi ne pois.
    Avaimen poistaa ihminen terminaalissa tai agentti, ja käyttöoikeuden
    poistaa ylläpitäjä.

## Kysymykset Jarille

- Mikä suunta? Suositus: 1 ja suunnan 3 viesti painikkeena.
- Hyväksytkö, että nähdyt avaimet muistetaan selaimessa, jolloin agentti ei
  voi kuitata niitä (päätös 5)?
- Kuuluuko `age` ytimeen? Avainsivu toimii ilman `age-keygen`iä, jos daemon
  johtaa vastaanottajan itse. Agentti tarvitsee sitä silti avaimen
  tekemiseen, kun se ei käytä sivua.
