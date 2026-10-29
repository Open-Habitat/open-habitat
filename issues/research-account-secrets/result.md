# Result: SOPS, age and SSH keys on a Habitat account (29.10.2026)

## Jarille

**Suositus: molemmat, ohuina.** Tuote toimittaa työkalut ja opettaa agentin.
Lisäksi asetuksiin tulee pieni avainsivu, josta julkisen avaimen voi kopioida
luotettavasti. SOPS-käyttöliittymää salaisuuksien selaamiseen tai
avaamiseen ei tehdä.

Päätöksesi 29.10. pysyy: samat salaisuudet saavat olla Habitat-tilillä kuin
läppärillä. Tämä vastaa siihen, miten ne sinne tuodaan.

- **Mitä tilille tarvitaan.**
  - Avaimet tehdään tilillä. age-avain tehdään komennolla `age-keygen`, ja
    Linuxissa SOPS löytää sen ilman ympäristömuuttujaa. SSH-avain tehdään
    komennolla `ssh-keygen`.
  - Organisaation ylläpitäjä lisää ne uutena laitteena:
    - SSH-avain: Northwindilla `ssh-keys.sh add` + `deploy`, esimerkiksi
      `ville-habitat`, jonka voi jo nyt rajata `servers:`-listalla
      tiettyihin palvelimiin;
    - age-avain: `.sops.yaml`-tiedoston tasoille ja `updatekeys`.
  - Kaikki tämä on Northwindin omaa työtä, ja heidän työkalunsa tukevat sitä jo.
    GitHubiin SSH-avainta ei tarvita, koska HTTPS kulkee `gh`:n kautta.
- **Runtime-profiili.** `age` on jo operations-profiilissa, `sops` ei ole.
  Ubuntu 24.04:ssä ei ole sops-pakettia.
  - Lisätään `sops` 3.13.3 tarkkana upstream-artefaktina amd64:lle ja
    arm64:lle, kuten `gog` ja `glab`.
  - Nimetään `openssh-client` profiiliin. Se on koneilla jo nyt, mutta mikään
    profiili ei mainitse sitä.
  - 1Passwordin ja Bitwardenin CLI:t jätetään pois, kunnes jokin organisaatio
    niitä tarvitsee.
- **Miksi myös käyttöliittymä eikä pelkkä skill.** Julkinen avain ratkaisee,
  kenet ylläpitäjä lisää salaisuuksien vastaanottajaksi.
  - Jos ihminen kopioi "julkisen avaimensa" agentin vastauksesta, prompt
    injectionin harhauttama agentti voi näyttää siinä hyökkääjän avaimen.
    Ylläpitäjä antaisi silloin pääsyn hyökkääjälle.
  - Asetussivu lukee julkisen osan suoraan natiivista tiedostosta, eikä
    agentti ole välissä. Sivu näyttää myös sormenjäljen, jota ylläpitäjä voi
    verrata.
  - Agentin pitää myös oppia, ettei se tulosta `keys.txt`-tiedostoa
    keskusteluun. Tulostettu avain jäisi Pi:n historiaan ja menisi
    mallipalvelulle.
- **Avainsivu, ensin prototyyppinä.** Asetuksissa näytetään tilin SSH- ja
  age-avainten julkiset osat, sormenjälki, kopiointipainike ja lyhyt teksti
  "anna tämä ylläpitäjälle". Mahdollisesti myös "Luo avain", kun avainta ei
  vielä ole.
  - Ei yksityisiä avaimia, ei tuontia, ei salaisuuksien avaamista eikä
    vastaanottajien muokkausta.
  - Oman koneen yhteys (`proto-own-machine-access`) tarvitsee saman SSH-avaimen
    näkymän, joten **yksi sivu palvelee molempia**.
- **Agentin ohje.** Agentin skilliin tulee lyhyt osio:
  - avaimet tehdään tilillä;
  - julkinen osa haetaan komennolla `age-keygen -y` tai `*.pub`-tiedostosta;
  - yksityistä avainta tai avattua salaisuutta ei koskaan tulosteta
    keskusteluun;
  - julkinen avain kopioidaan avainsivulta;
  - palvelinten host-avaimet otetaan luotettavasta lähteestä;
  - käyttöönotto ja poisto ovat ylläpitäjän työtä.
- **Hylätyt vaihtoehdot.**
  - SOPS-selain tai -editori selaimessa: näyttäisi salaisuudet selväkielisinä
    ja tekisi daemonista salaisuuksia palauttavan välittäjän.
  - Läppärin yksityisen avaimen tuonti: avain lähtisi laitteeltaan, eikä
    laitteen pääsyä voisi enää poistaa erikseen.

**Päätät:**

1. **Kumpi:** UI + skill (suositus), pelkkä skill vai pelkkä UI?
2. **Avainsivun "Luo avain" -toiminto.** Saako daemon kirjoittaa uuden avaimen
   oletuspolkuun (`~/.ssh/id_ed25519`, `~/.config/sops/age/keys.txt`) vain,
   jos tiedostoa ei ole? Uutta auktoriteettia ei synny: daemon toimii
   ihmisen omana käyttäjänä, kuten Soniox-avaimen kanssa. Vaihtoehto on, että
   sivu vain näyttää ja agentti luo.
3. **Yhdistetäänkö avainsivu `proto-own-machine-access`-prototyyppiin** vai
   tehdäänkö se omana kierroksenaan samalla komponentilla?
4. **Kerrotaanko Northwindille kaksi asiaa?**
   - Heidän ohjeensa väite, että rotaatio estää vanhan git-historian
     avaamisen, ei pidä. Vain salaisuuksien arvojen vaihto auttaa.
   - Pilotin root olet sinä, ja tilin avaimet ovat myös `/home`-varmuuskopioissa.

## What was done

- `report.md` covers:
  - laptop vs account inventory;
  - Northwind's per-device enrolment (`.sops.yaml`, `authorized_keys.yaml`,
    `ssh-keys.sh`) and Fleetrepo's copied-identity model;
  - risks specific to a server account;
  - the native tools (age, sops including SSH recipients, OpenSSH, `gh`,
    1Password/Bitwarden CLIs, age plugins);
  - what the runtime ships;
  - the options compared, the recommendation and sources.

  The proposed follow-ups are in its `spinoff_proposals`. None were filed.
- A disposable spike on Birch, with throwaway keys and a scratch `HOME` that
  was deleted afterwards, confirmed three things:
  - Linux default identity lookup;
  - `age-keygen -y`;
  - SOPS decryption through an `ssh-ed25519` recipient.
- Not done:
  - no access to the Northwind pilot;
  - no test of `from=` through `ssh-keys.sh`;
  - no real secret decrypted or private key read;
  - no external model review.
