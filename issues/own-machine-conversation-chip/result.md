# Tulos: oma kone keskustelussa ja Windows-ohje

Koko issue tehtiin tässä ajossa, prototyypin `proto-own-machine-access`
Keskustelu-näkymän mukaan.

## Mitä tehtiin

- **Konesiru työkalurivillä.** Kun bash-komento ajaa `ssh <nimi> …` ja nimi on
  yksi ihmisen omista koneista, rivillä on ennen komentoa siru, jossa on
  läppäri-ikoni ja koneen nimi (`ToolRow`, `PiToolUse`, `remoteHost`). Siru
  tulee sekä elävään keskusteluun että historianäkymään. Kohde luetaan
  komennosta (`sshTarget`): lainausmerkit luetaan kuten shell lukee ne, ja
  `ssh` lasketaan vain komennon paikalla (myös `cd x && ssh …`, `timeout 10 ssh …`,
  `FOO=1 env ssh …`). `echo ssh pc`, kommentti, `ssh -G/-V/-Q` ja IP-osoite
  eivät saa sirua.
- **Yhteys auki otsikossa.** Keskustelun otsikkorivillä on vihreä pallo ja
  koneen nimi, kun tämän keskustelun käyttämään koneeseen on SSH-yhteys auki
  (ControlMaster-soketti, daemonin `connection_open`). Puhelimella merkki on
  toisella rivillä, ja kapealla työpöydällä nimi lyhenee pois samassa
  vaiheessa kuin Gitin luvut (pallo jää näkyviin).
- **Lukeminen.** `OwnMachineUseProvider` lukee `/api/v1/own-machines`
  (pelkkä GET) keskustelukohtaisesti vasta, kun jokin komento on ajanut sshn,
  joten ssh:ta käyttämätön keskustelu ei maksa mitään. Uusi ssh-komento ja
  ssh-komennon päättyminen lukevat listan uudelleen. Niin kauan kuin käytetyn
  koneen yhteys on auki, lista luetaan 30 sekunnin välein, kunnes yhteys
  sulkeutuu (ControlPersist 10 min). Käyttölokia ei pidetä.
- **Windows-ohje** (daemon, sopimus, Asetukset › Omat koneet):
  - Windows-laitteet ovat valittavissa (`peer.ssh` on nyt vain
    `possible`/`no`).
  - Myöntö kertoo kuoren (`shell: sh|powershell`). Windowsille tulee
    PowerShell-komento käyttäjän `%USERPROFILE%\.ssh\authorized_keys`ille ja
    `admin_command` tiedostolle `%ProgramData%\ssh\administrators_authorized_keys`.
    Jälkimmäinen ajetaan järjestelmänvalvojana, ja se rajaa tiedoston
    oikeudet Administrators- ja SYSTEM-ryhmille SID:llä, koska ryhmien nimet
    ovat käännettyjä. Molemmat korvaavat vain tämän tilin rivin. Lukuvirhe
    keskeyttää ennen kirjoitusta. Tiedosto luetaan ja kirjoitetaan
    UTF-8:na ilman BOMia, joten muiden rivien ääkköset säilyvät.
  - Vastauksessa on `windows_remove_command` ja
    `windows_admin_remove_command`.
  - Koneen käyttöjärjestelmä tallennetaan koneen
    asetusriville (`os=`), jotta Tailscalesta kadonnut Windows-kone saa
    yhä PowerShell-komennot.
  - Tarkistus ajaa `exit 0` eikä `true`, jotta myös cmd.exe vastaa.
  - Dialogi: OpenSSH-palvelimen asennus (vaihe 3), valinta
    *Järjestelmänvalvoja/Tavallinen käyttäjä* (vaihe 4) ja Windowsin
    sormenjälkikomento (vaihe 5). Kortissa ja poiston jälkeen näkyvät
    PowerShell-poistokomennot.
  - Agentin skill kertoo, että Windows-kone ajaa komennot cmd.exessä, ja
    `docs/operations.md` sanoo OpenSSH 8.2 -vaatimuksen.

## Todisteet

- `go test ./internal/daemon` (koko paketti), `./internal/gateway`, `./internal/cli`
  ja sopimukset vihreät. Uusi `TestOwnMachinesWindowsCommands` ajaa generoidut
  PowerShell-komennot pwsh 7.4.6:lla Linuxissa (icacls on nauhuri). Testi
  käy läpi ensimmäisen asennuksen puuttuvaan hakemistoon, korvauksen, poiston,
  ääkkösrivin ja BOMin säilymisen, ACL-kutsun ja lukuvirheen. Testi ohitetaan
  ilman pwsh:ta, eikä CI:ssä ole pwsh:ta. `TestOwnMachinesWindowsMachineGoneFromTailnet`
  tarkistaa tallennetun käyttöjärjestelmän.
- Web: 952 testiä vihreänä. Uudet: `sshTarget`-tapaukset ja
  `ownMachineUse.test.tsx`, joka kaatuu ilman päättymisen uudelleenlukua.
- Selain: `own-machines.spec.ts`, 4/4 vihreänä. Uudet tapaukset:
  - Windows-kone ja ylläpitäjän valinta, axe;
  - keskustelu, jossa Pi suoratoistaa `ssh alice-macbook …`: otsikon merkki
    näkyy ennen kuin riviä avataan, siru on rivillä, ja yhteyden sulkeuduttua
    ja sivun uudelleenlatauksen jälkeen merkkiä ei ole.

  Lisäksi `tool-header-layout`, `lab-desktop-header` ja `lab-phone-header`
  ovat vihreät. Kuva: `evidence/oma-kone-keskustelussa-1280.png`
  testituloksissa.
- Katselmointi: `/llm-review` kriittisellä tasolla (etsijä GPT-6 Astra,
  kumoaja Claude Fable 5.1) ja `/assess-findings`. Löydöksiä oli neljä. Kaikki
  vahvistettiin paikallisesti, kumoaja piti ne voimassa, ja kaikki korjattiin
  testeineen:
  1. ASCII-kirjoitus muutti muiden avainten ääkköset kysymysmerkeiksi.
  2. Taitetun ssh-komennon päättyminen ei lukenut listaa uudelleen, joten
     myöhemmin auennut yhteys jäi näkymättä.
  3. Jäsennin ei ymmärtänyt lainausmerkkejä eikä komennon paikkaa.
  4. Tailscalesta kadonnut Windows-kone sai POSIX-komennot.

Ei kokeiltu: oikea Windows (PowerShell 5.1, NTFS-oikeudet, Windowsin sshd ja
sen `expiry-time`), oikea tailnet. Ne ovat KOKEILTAVAA-listalla.

## Decisions for later review

1. **"Yhteys auki" vain tämän keskustelun käyttämille koneille.** Soketti on
   tilikohtainen, joten vaihtoehto oli näyttää jokainen auki oleva yhteys
   jokaisessa keskustelussa. Valitsin keskustelukohtaisen, koska merkin
   tehtävä on kertoa, että *tämä* työ koskee konettasi. Lisäksi ssh:ta
   käyttämätön keskustelu ei silloin lue mitään.
2. **Tallennetun historian komentoja ei lueta etukäteen.** Historian
   `toolCall`-lohkoissa ei ole komennon tekstiä. Selain hakee sen vasta, kun
   rivi näytetään. Elävän vuoron komennot lasketaan heti (myös taitettuina).
   Vanhan vuoron kone tunnistetaan vasta, kun rivi avataan, eli sivun
   uudelleenlatauksen jälkeen otsikkomerkki ilmestyy vasta silloin.
   Vaihtoehto olisi ollut lisätä daemonin historiaan komennon esikatselu
   (historiasopimuksen muutos). En tehnyt sitä tämän vuoksi.
3. **Siru vain `ssh`:lle**, ei `scp`/`rsync`/`sftp`:lle. Prototyyppi ja issue
   puhuivat `ssh <nimi>` -riveistä, ja muiden komentojen kohde on
   epäselvempi.
4. **Windowsissa oletuksena *Järjestelmänvalvoja*.** Oman koneen tavallinen
   käyttäjä on Windowsissa yleensä ylläpitäjä. Väärä valinta näkyy
   tarkistuksessa *Kone ei hyväksy avainta*, ja huomautus kehottaa
   kokeilemaan toista.
5. **Kaksi erillistä komentoa eikä yksi itsetunnistava.** Komento olisi
   voinut päätellä ylläpitäjyyden (`whoami /groups`). Valitsin kaksi
   näkyvää ja testattavaa komentoa.
6. **OpenSSH 8.2 -vaatimus kerrotaan, sitä ei kierretä.** `expiry-time` on
   pääsyn rajaus, eikä sitä jätetä pois. Ohje kertoo `ssh -V`:n ja sanoo,
   että Windows 10:n mukana tullut versio voi olla vanhempi. Tarkkoja
   Windows-versioita tai `winget`-pakettia ei luvata, koska niitä ei
   todennettu.
7. **UTF-16-muotoista authorized_keysia ei muunneta.** Sellaisen tekee
   PowerShell 5.1:n `echo >`. Windowsin sshd ei lue sitä muutenkaan, joten
   tiedosto luetaan UTF-8:na (BOM tunnistetaan). Tunnistamaton UTF-16
   näkyy tarkistuksessa hylättynä avaimena.
