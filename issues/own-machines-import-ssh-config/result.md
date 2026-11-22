# Tulos: prototyyppikierros, Omat koneet näyttää ~/.ssh/config:n yhteydet

Kierros: `design-system/prototypes/rounds/2026-11-22-omat-koneet-ssh-config/`
(`NOTES.md` kertoo rakennuksen ja tarkistuksen). Tuotantokoodiin,
sopimukseen tai daemoniin ei koskettu.

## Akseli ja suunnat

Akseli: **missä ~/.ssh/config:sta löytyneet yhteydet ovat Omat koneet
-sivulla.** Sisältö on kaikissa sama: viisi konetta (yksi `Include`n
kautta), neljä ohitettua (`github.com`, `Host *`, `Host *.lan`,
`Match`-lohko) ja sama tieto koneesta (HostName, User, Port, IdentityFile
ja onko tiedosto olemassa, ProxyJump, Tailscale-nimi, tiedosto ja rivi).

1. **Oma ryhmä** (suositus): koneiden alla ryhmä *Löytyi ~/.ssh/config:sta*.
   Jokainen yhteys on rivi, jossa on *Näytä omana koneena* ja *Piilota*.
   Näytetty yhteys siirtyy Koneet-listaan korttina.
2. **Yksi lista:** jokainen config-yhteys on heti kone listassa
   `~/.ssh/config`-merkillä. Ainoa toiminto on *Piilota sivulta*.
3. **Läpikäynti:** sivun alussa on yksi rivi ja *Käy läpi*. Dialogi
   näyttää yhteydet valintaruutuina, ja valitut tulevat koneiksi.

**Suositus 1.** Se näyttää heti, mitä löytyi, mutta pitää erillään kaksi
erilaista asiaa. Habitatin ohjatun lisäyksen koneet on rajattu Habitatin
itse rakentamaan pääsyyn: `restrict`-rivi, kiinnitetty isäntäavain ja oma
Tailscale-laite. Config-yhteyksien avaimen, reitin ja known_hostsin
ihminen on tehnyt itse. Suunnassa 2 kaikki näyttäisi samanarvoiselta, eikä
sivu kertoisi ihmisen valinnasta mitään. Suunta 3 piilottaa löydetyt
dialogin taakse, ja oletusnäkymä jää lähes tyhjäksi.

Kaikille yhteistä:

- Konetta **ei tarkisteta itsestään**. Kortissa lukee *Ei tarkistettu*,
  kunnes ihminen painaa *Tarkista yhteys*. Tarkistus avaa oikean
  SSH-yhteyden ihmisen omilla asetuksilla. Se voi herättää 2FA-kehotteen,
  hälytyksen tai ProxyJump-ketjun, joten sivun avaaminen ei saa tehdä sitä.
- Ilman yhteyttä tiedettävät asiat näkyvät heti merkkeinä: *Avaintiedosto
  puuttuu*, *nas:n kautta* (ProxyJump) ja *Tailscale-nimi*.
- Tarkistuksen tulokset: *Vastaa*; *Ei vastaa* (ProxyJumpissa nimetään
  hyppykone); *Nimi ei ratkea*, joka Tailscale-nimellä ohjaa kohtaan
  *Lisää kone*, koska Habitatin oma Tailscale-laite pääsee koneeseen eikä
  config-riviä muuteta; *Isäntäavain hyväksymättä*, jolloin ihminen ajaa
  kerran päätteessä `ssh <nimi>`, koska Habitat ei hyväksy avainta;
  *Kirjautuminen ei onnistu*, joka nimeää puuttuvan avaintiedoston tai
  kertoo, että salasana tai tunnuslause vaaditaan.
- Tyhjä tila: "~/.ssh/config:ssa ei ole muita koneita. Kun lisäät sinne
  Host-rivin, se näkyy tässä." Suunnassa 3 riviä ei näytetä lainkaan.
  Lukukelvoton tiedosto (esim. yli 1 Mt) saa oman huomautuksensa. Kun
  kaikki on käyty läpi, rivi kertoo sen, ja piilotetut näkyvät kohdassa
  *Piilotetut n* (*Näytä taas*).

Todisteet (DPR 2, kaikki suunnat × Päivä/Yö/Kontrasti × 1440/390 px sekä
Päivässä kulku, tarkistukset, Habitatin kone rinnalla, tyhjä ja
lukukelvoton): `/var/tmp/agent-keep/own-machines-import-ssh-config/shots/`
(44 PNG) ja rakennettu sivu
`/var/tmp/agent-keep/own-machines-import-ssh-config/prototype-offline.html`.
`check.mjs`: 183 tarkistusta vihreinä, konsoli puhdas, ei verkkoa.

## Hostin puoli (luonnos)

### Lukeminen: vain luku, oma jäsennin

Daemon lukee käyttäjänä `~/.ssh/config`in omalla Go-jäsentimellä eikä
`ssh -G`:llä. `ssh -G` ajaa `Match exec` -komennot jo jäsennyksessä, ja
sivun avaamisen pitää olla sivuvaikutukseton.

- **Tuetaan:** `Host`-lohkot ja `Include` (suhteellinen polku `~/.ssh/`ista,
  glob, sisäkkäisyys enintään 16 tasoa kuten OpenSSH:ssa, kokoraja kuten
  `includePresent`issa 1 Mt per tiedosto ja tiedostomäärän raja). Linkki
  seurataan, koska dotfiles-linkki on tavallinen ja lukeminen on
  vaaratonta. Avainsanat ovat kirjainkoosta riippumattomia, `=`-muoto
  hyväksytään ja lainausmerkit puretaan.
- **Listataan** jokainen `Host`-rivin kuvio, joka ei sisällä merkkejä
  `*`, `?` tai `!`. Yksi alias on yksi kone. Kentät saavat arvon
  OpenSSH:n "ensimmäinen arvo voittaa" -säännöllä kaikista lohkoista, joihin
  alias osuu, myös jokerilohkoista (`Host *` antaa esim. Userin). Näin
  näytetty arvo vastaa sitä, mitä `ssh <alias>` käyttää, `Match`-lohkoja
  lukuun ottamatta.
- **Luetaan:** HostName, User, Port, IdentityFile (`~`, `%d`, `%h`, `%r`
  ja `%u` puretaan; muu %-merkki näytetään sellaisenaan), ProxyJump,
  ProxyCommand (näytetään vain merkki "oma välityskomento", ei komentoa).
  IdentityFilestä tarkistetaan vain, onko tiedosto olemassa (`fstatat`).
  Avainta ei avata.
- **Ohitetaan ja kerrotaan, miksi:** jokerikuviot ja negaatiot,
  `Match`-lohkot (niitä ei tulkita; kortti kertoo, että arvot voivat
  poiketa), tunnetut Git-palvelut (`github.com`, `gitlab.com`,
  `codeberg.org`, `bitbucket.org`, `ssh.dev.azure.com` sekä aliakset,
  joiden HostName on jokin näistä), Habitatin omat
  `~/.ssh/config.d/habitat-*.conf`-koneet (ne ovat jo sivulla) ja
  `/etc/ssh/ssh_config` (palvelimen yhteinen, ei ihmisen oma).
- Tunnistetaan Tailscale-nimi (`*.ts.net`) ja `100.64.0.0/10`-osoite.

### Mitä Habitat ei koskaan kirjoita

`~/.ssh/config`iin kirjoitetaan vain ohjatun lisäyksen olemassa oleva
`Include ~/.ssh/config.d/habitat-*.conf` -rivi. Sitä ei muuteta tämän
ominaisuuden takia, eikä mitään config-yhteyttä kirjoiteta, korjata tai
siirretä `habitat-*.conf`iin. Habitat ei koskaan kirjoita `known_hosts`ia
(isäntäavainta ei hyväksytä ihmisen puolesta), ei luo, kopioi tai muuta
IdentityFile-avaimia eikä käynnistä tai muuta ssh-agenttia.

### Kun yhteys näytetään omana koneena

Nykyinen oma kone on `habitat-<nimi>.conf` merkkirivillä
`# habitat-machine name= user= address= …`. Config-yhteys ei mahdu siihen:
sillä on oma avain, reitti ja known_hosts, ja tiedoston kopiointi tekisi
toisen totuuden, joka ajautuisi erilleen alkuperäisestä. Siksi näyttäminen
tallentaa vain **aliaksen nimen** ihmisen omaan Habitat-asetukseen
`~/.config/open-habitat/preferences.json` (`ssh_config_machines:
{shown: [...], hidden: [...]}`). Kaikki muu luetaan joka kerta configista.
Jos alias katoaa configista, se katoaa myös sivulta. Näyttäminen antaa
kolme asiaa:

- kortin sivulla ja tarkistuksen pyydettäessä;
- agentin skillin osion *The person's own machines* lisäyksen: listatut
  aliakset ovat ihmisen omia koneita samoilla säännöillä (kerro ensin, älä
  kokeile toista reittiä tai avainta, älä hyväksy isäntäavainta);
- keskustelun konesirun (`own-machine-conversation-chip`) tunnistamaan
  myös `ssh <alias>`.

Sopimukseen (`contracts/v1/own-machines.schema.json`) tulisi
`ssh_config: {state: ok|empty|unreadable, files: [...], hosts: [...],
skipped: [...]}` ja toiminnot `show|hide|unhide|check_config` aliaksella.

**Tarkistus** ajaa ihmisen oman asetuksen mukaan
`ssh -o BatchMode=yes -o ConnectTimeout=10 -o ConnectionAttempts=1 <alias> exit 0`.
Erona tämän päivän `probe`en se ei käytä `-F /dev/null`ia, koska juuri
ihmisen config on se, mitä testataan. `StrictHostKeyChecking=yes` estää
known_hostsin muuttumisen. Lisäksi asetetaan `ControlMaster=no`, jotta
tarkistus ei jätä yhteyttä auki. Tulos luokitellaan stderr-tekstistä samoin
kuin nykyisessä `probe`ssa, ja lisäluokkia ovat `unresolved` ("Could not
resolve hostname") ja `hostkey_unknown` ("Host key verification failed"
ilman "CHANGED"-tekstiä).

### Yksityisyys

Daemon toimii ihmisen omana Unix-käyttäjänä ja lukee vain hänen tiedostonsa.
Agentit lukevat saman tiedoston jo nyt, joten sen näyttäminen omalla sivulla
ei avaa uutta pääsyä. Selaimelle annetaan aliakset, osoitteet, käyttäjät,
portit, avainten **polut** ja tiedostojen nimet, ei avainten sisältöä eikä
ProxyCommandin komentoa. Tieto menee vain ihmisen omaan istuntoon
(gateway välittää istunnolla ja CSRF:llä kuten nyt). Sitä ei lokiteta eikä
näytetä vieraalle moninpelissä tai palvelimen ylläpidolle.
Tunnistemuutoksia ei tarvita.

## Päätökset myöhempään katselmointiin

- **Ei automaattista tarkistusta.** Vaihtoehto: kaikki tarkistetaan sivun
  avautuessa. Peruste: oikea SSH-yhteys voi laukaista 2FA:n, hälytyksen tai
  pitkän ProxyJump-ketjun ihmisen huomaamatta.
- **Näyttämisen tila `preferences.json`issa.** Vaihtoehdot: kommentti-
  tiedosto `~/.ssh/config.d/habitat-…conf` (se törmäisi
  konenimikuvioon `habitat-<nimi>.conf` ja olisi Habitatin kirjoitus
  `.ssh`:hen ilman SSH-merkitystä) tai ei tilaa lainkaan (suunta 2).
  Peruste: ihmisen valinta ei ole SSH-asetus, ja olemassa oleva
  henkilökohtainen asetusdokumentti riittää.
- **Git-palvelut ohitetaan.** Vaihtoehto: listataan muiden mukana.
  Peruste: ne eivät ole koneita, ja Koodipalvelut-osio hoitaa ne.
- **ProxyCommandin sisältöä ei näytetä.** Siinä voi olla tokeneita tai
  polkuja. Merkki "oma välityskomento" riittää.
- **Sivun johdanto muuttuu.** Tuotannon teksti sanoo "oman
  Tailscale-verkkosi kautta". Config-koneiden kanssa se pitää yleistää,
  esim. "SSH:lla, oman Tailscale-verkkosi kautta tai omilla
  SSH-asetuksillasi". Prototyyppi jättää tuotannon tekstin ennalleen.
- **Tarkistus vain näytetyille (suunta 1).** Löydetyn rivin painikkeita
  pidetään kahdessa puhelinleveyden takia. Vaihtoehto: *Tarkista* jo
  löydetyllä rivillä.
- **Vain suomeksi.** Englanninkieliset tekstit tehdään toteutuksessa.

## Kysymykset Jarille

1. Suunta 1, 2 vai 3?
2. Saako näytetty config-kone tulla agentin skillin "omat koneet"
   -listaan, eli kerrotaanko agentille, että se on ihmisen oma kone samoin
   säännöin? Vai pelkkä näkyvyys sivulla?
