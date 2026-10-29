# Tulos: Asetukset › Avaimet (Taulukko)

Toteutettu prototyypin suunta 2, Taulukko. Kuvat ovat hakemistossa
`evidence/` (AVIF, laitteen skaalaus 2): työpöytä vaalea ja tumma sekä
puhelin, jossa rivi on auki.

## Mitä tehtiin

- **Daemon** (`internal/daemon/account_keys_linux.go`, reitti
  `/api/v1/account/keys`):
  - **Luku.** Daemon lukee SSH-avaimet hakemistosta `~/.ssh` (jokainen
    salaamaton OpenSSH-muotoinen yksityinen avain) ja age-identiteetit
    tiedostosta `~/.config/sops/age/keys.txt`. Julkinen osa rakennetaan
    yksityisestä tiedostosta:
    - ed25519: siemenestä;
    - RSA: tarkistetaan `p·q = n`;
    - ECDSA: tarkistetaan `d·G = Q`;
    - age: X25519 ja bech32 Go:n standardikirjastolla.

    Tiedostoa, joka vain käärii jonkun muun julkisen avaimen, ei näytetä.
    `.pub`-tiedostoa ei lueta.
  - **Luonti.** `ssh-keygen` tai `age-keygen` ajetaan ihmisenä
    väliaikaishakemistoon, jota pidetään auki omalla kuvaajallaan. Valmis
    tiedosto linkitetään paikalleen `linkat`illa, joka ei koskaan korvaa
    mitään. Vastaus kertoo luodun avaimen (`created`).
  - **Ei yksityistä materiaalia vastauksessa.** Vastauksessa ei ole kenttää,
    johon yksityinen osa voisi päätyä.
  - **Käyttö muualta.** `readAccountKeys` ja `createAccountKey` ovat pieni
    rajapinta, jota `own-machine-access` voi kutsua.
- **Gateway** välittää reitin istunnolla. Luonti vaatii lisäksi CSRF:n ja
  Originin, kuten muutkin omat asetukset.
- **Sopimus.** Uusi `contracts/v1/account-keys.schema.json` ja esimerkit. Se
  hylkää yksityisen kentän, age-identiteetin vastaanottajan paikalla,
  absoluuttisen polun ja tuntemattoman luontipolun.
- **Selain:**
  - Asetuksiin tulee osio *Avaimet* Laitteiden jälkeen
    (`/settings/keys`), ja haku löytää sen.
  - Taulukossa ovat avain, lyhennetty sormenjälki, muutospäivä, *Kopioi* ja
    avautuva rivi. Avattu rivi näyttää koko rivin, sormenjäljen, lajin,
    kommentin, ohjeen ylläpitäjälle ja muistutuksen, että yksityinen osa
    pysyy tilillä.
  - Puuttuvalle oletusavaimelle on rivi *Luo*-painikkeella.
  - Näkemätön avain merkitään, ja *Tunnistan tämän* poistaa merkinnän.
    Puhelimessa sama rakenne pinoutuu.
- **Agentti.**
  - Agentin skilliin (`internal/cli/agent/SKILL.md`) tuli osio *Account
    keys: SSH, age and SOPS*:
    - avaimet tehdään tilillä eikä olemassa olevan päälle;
    - `keys.txt`-tiedostoa, yksityistä avainta tai `sops -d`:n tulostetta
      ei koskaan tulosteta;
    - julkinen avain annetaan ylläpitäjälle avainsivulta;
    - organisaatio lisää tilin uutena laitteena;
    - host-avaimet otetaan luotettavasta lähteestä.
  - `host-context.md` nimeää `/settings/keys`.
- **Runtime-profiili:**
  - `sops` 3.13.3 on integrations-profiilissa tarkkana upstream-binäärinä
    amd64:lle ja arm64:lle. Digestit vastaavat julkaisun `checksums.txt`ia,
    ja Go-moduulien huomautukset on tehty komennolla `go-binary-notices.py`.
    Sulkeuman tarkistus vaatii sen.
  - Ytimen Ubuntu-vaatimuksiin tulivat `openssh-client` ja `age`, koska
    daemon ajaa niiden työkaluja. `age` poistui operations-profiilista,
    jossa se olisi ollut päällekkäin.

## Tarkistukset

- **Go:**
  - `go test` paketeille `./internal/daemon` (koko paketti),
    `./internal/gateway`, `./internal/host`, `./internal/cli` ja
    `./test/browser-host`.
  - Uudet testit vertaavat sormenjälkiä ja julkisia osia ohjelmien
    `ssh-keygen -y/-lf` ja `age-keygen -y` tuloksiin. Mukana ovat RSA-,
    ECDSA- ja ed25519-avaimet, väärennetty kääre ja vaihdettu `.pub`.
  - Testit kattavat myös kilpailun, jossa agentti kirjoittaa oletusavaimen
    työkalun ajon aikana (sivu ei korvaa sitä), symlinkit, ryhmäkirjoitettavan
    hakemiston ja puuttuvan työkalun.
- **Sopimukset:** `validate-contracts.py` ja `check-generated.sh`.
- **Web:** `test-focused.sh --area web` (lint, tyypit, 938 yksikkötestiä,
  build).
- **Selain:** `account-keys.spec.ts` (2), `settings-search.spec.ts` (4) ja
  `settings-close.spec.ts` (5). Aineisto on oikea gateway ja oikea daemonin
  käsittelijä, ja `ssh-keygen` kirjoittaa synteettiseen kotiin.
  `settings-search`in yksi tapaus epäonnistui ensimmäisellä ajolla ja meni
  läpi kahdella uusinnalla. Sitä ei tutkittu tarkemmin.
- **Profiili:** `build-profile-runtime.sh integrations` ja
  `test-integrations-runtime.py` arm64:llä (sops ajettu, huomautukset
  tarkistettu). amd64-koontia ei voi tehdä Birchlla. Sen binäärin digesti on
  tarkistettu upstreamin listasta.
- **Katselmointi:** riippumaton `/llm-review` (löytäjä GPT Astra,
  tarkistaja Claude Fable) ja `/assess-findings`.
  - Löytyi kolme vahvistettua löydöstä, ja kaikki korjattiin tässä työssä:
    1. julkinen osa otettiin otsakkeesta tarkistamatta yksityistä osaa;
    2. väliaikaishakemiston siivous kulki polun kautta;
    3. luonnin jälkeen selain merkitsi nähdyksi minkä tahansa avaimen
       oletuspolussa.
  - Tarkistaja vahvisti kaikki kolme alkuperäisessä koodissa ja korjatuiksi
    uudessa.

## Testipalvelin

Muutos ei lisää systemd-yksiköitä eikä socketteja, joten julkaisuvahti ei
hylkää sitä arkiston tarkastuksessa. Fleetrepon
`infra/open-habitat-test` ei luettele profiilin työkaluja.

Päivitys asentaa ytimen uudet Ubuntu-vaatimukset (`age`; `openssh-client` on
koneilla jo) hostin aptilla. Testikoneella ja pilotilla tarvitaan siis
apt-yhteys, kuten aina vaatimusten muuttuessa.

## Päätökset myöhempää tarkistusta varten

1. **Vain tarkistettavat SSH-avaimet näytetään.**
   - Vaihtoehdot:
     - näyttää myös salasanalla suojatut ja laitteistoavaimet (`sk-`)
       merkinnällä "ei tarkistettu";
     - lukea julkinen osa otsakkeesta, kuten ensimmäinen versio teki.
   - Miksi: sivun lupaus on, että näytetty avain on se, jonka yksityinen
     osa on tilillä. Salattua avainta ei voi tarkistaa ilman salasanaa, eikä
     tilillä ole SSH-agenttia, joten agentti ei voisi sitä käyttää.
     Laitteistoavain ei voi olla palvelintilillä.
2. **Kommentti tulee yksityisestä tiedostosta.**
   - Vaihtoehto: `.pub`-tiedoston kommentti, jos sen avain täsmää.
   - Miksi: `.pub`ia ei tarvitse lukea lainkaan, ja salaamattomassa
     avaimessa kommentti on yksityisessä osassa.
3. **Luodun avaimen kommentti on `<Unix-käyttäjä>@<sivuston julkinen
   isäntänimi>`**, esimerkiksi `jari@habitat.example.org`. Isäntänimi
   luetaan tiedostosta `site-origin.json`. Jos sitä ei ole, kommentti on
   `<käyttäjä>@open-habitat`.
   - Vaihtoehdot:
     - prototyypin `jari@birch` (sivuston lyhyt nimi, jota daemon ei
       tiedä);
     - `ssh-keygen`in oletus `käyttäjä@isäntänimi`, joka paljastaa VM:n
       sisäisen nimen.
   - Huomio: kommentti on ihmisen omaa tiedostosisältöä, ja siinä näkyy
     Unix-käyttäjänimi, kuten `ssh-keygen`in oletuksessakin. Se ei ole
     identiteettikenttä.
4. **Muutospäivä on tiedoston `mtime`.**
   - Vaihtoehto: age-keygenin `# created:` -kommentti.
   - Miksi: SSH-avaimella ei ole luontiaikaa, ja kumpikin arvo on agentin
     muutettavissa. Otsikko on siksi *Muutettu*, ei *Luotu*.
5. **"Missä käytössä" jätettiin pois.** Prototyypin tuloksen mukaan se oli
   valinnainen, ja se olisi vaatinut tiedostojen `~/.ssh/config` ja
   `.sops.yaml` jäsentämisen.
6. **Taulukossa sormenjälki ja muutospäivä ovat samassa sarakkeessa.**
   - Vaihtoehto: prototyypin neljä saraketta.
   - Miksi: asetussivun 720 px:n leveydellä erillinen päiväsarake puristi
     avaimen nimen muutaman merkin levyiseksi.
7. **Rivi avataan nuolipainikkeesta, ei klikkaamalla riviä.**
   - Vaihtoehto: koko rivi klikattavana, kuten prototyypissä.
   - Miksi: klikattava `div` ei ole saavutettava ilman toista painiketta,
     ja nuolipainike on näppäimistön reitti.
8. **Sivu lukee avaimet uudelleen, kun ikkuna saa kohdistuksen.**
   - Vaihtoehto: luku vain avattaessa.
   - Miksi: avain, jonka agentti tekee sivun ollessa auki, on yhtä lailla
     uutinen kuin avausta edeltänyt.
9. **`age` siirtyi ytimen Ubuntu-vaatimukseksi.**
   - Vaihtoehto: pitää se operations-profiilissa, jolloin age-avaimen luonti
     puuttuisi asennuksista, joissa sitä profiilia ei ole. Sivu osaa silti
     sanoa *Tällä palvelimella ei ole ohjelmaa age-keygen*.
   - Miksi: daemon ajaa `age-keygen`iä, ja SOPS-käytön oletus on, että age
     on mukana.
10. **`sops` ei ole tiedoston `integrations.json` `tools`-osassa.**
    - Vaihtoehto: julkaista se sinne kuten `tea`.
    - Miksi: daemonin katalogi ei aja `sops`ia. Agentti löytää sen polusta,
      jonka skill nimeää. Lisäys `tools`-osaan olisi vaatinut myös
      cloud-qualifyn muutoksen.
11. **Luonnin rinnakkaisuus on rajattu yhteen kerrallaan.** Toinen pyyntö
    saa vastauksen `409 key_creation_running`, ja puuttuva työkalu
    `409 key_tool_unavailable` (selvä kieltäytyminen, ei epävarma 503).
