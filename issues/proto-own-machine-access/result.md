# Tulos: oma kone agentin käyttöön, kierros 1

Prototyyppi on `prototypes/oma-kone/index.html`, yksi offline-HTML. Lähde on
saman hakemiston `page.html`; `build.mjs` upottaa tokenit, fontit ja yhteisen
valitsimen (`design-system/prototypes/lib/picker.*`), ja `verify.mjs` rakentaa
ja tarkistaa sen. Jarin opas on `prototypes/oma-kone/NOTES.md`, ja 67 kuvaa
ovat hakemistossa `prototypes/oma-kone/evidence/` (AVIF, laitteen skaalaus 2).
Tuotantokoodiin ei koskettu.

`verify.mjs` tarkistaa seuraavat asiat:

- Jokainen suunta vie läpi koko polun: Tailscale-kirjautuminen, kone, avainrivi
  ensin hylättynä ja sitten hyväksyttynä, ja koneen tunnisteen vahvistus.
- Vanhentunut pääsy uusitaan ilman uutta tunnistevaihetta.
- Väärä sormenjälki pysäyttää polun.
- Poistossa ihmistä pyydetään poistamaan rivi myös koneelta.
- Jokainen tila piirtyy kaikissa kolmessa näkymässä, eikä missään tarjota taukoa.
- Molemmat suorat lauseet ovat näkyvissä ennen tallennusta.
- Avainrivi ei ole koskaan agentin viestissä.
- Konsoli on puhdas, verkkopyyntöjä ei ole, ja valitsin läpäisee
  `picker-check`in.

## Lähtökohta

Arkkitehtuuri tulee `research-own-machine-access`-tutkimuksesta:

- jokaisella ihmisellä on oma `tailscaled` käyttäjäyksikkönä;
- Habitat liittyy ihmisen omaan tailnetiin;
- agentti käyttää tavallista SSH:ta;
- koneelle lisätään yksi rivi `restrict,from=,expiry-time=`.

Jarin päätökset 29.10.:

1. Agentti saa koneella kaiken, mitä ihmisen käyttäjä saa.
2. Palvelimen root voi teknisesti käyttää pääsyä.
3. Taukonappia ei ole.
4. Birchn koko koneen tailnet on tarkoituksellinen, mutta se ei ole tuotteen
   malli.

Kierroksen aikana tuli Jarin rajaus: tilin avainsivu tehdään omana
kierroksenaan (`proto-account-keys-page`). Siksi se poistettiin täältä, ja
näkymässä on vain koneelle asennettava rivi ja koneen oma avain.

## Akseli: miten ihminen viedään käyttöönoton läpi

Kaikissa suunnissa ovat samat tilat, sama sisältö ja samat kolme suoraa
lausetta (kaikki mitä käyttäjäsi saa, palvelimen root, katkaisu koneella).
Myös työkeskustelu, jossa agentti käyttää konetta, on sama kaikissa.

| # | Suunta | Mitä se päättää | Milloin oikea | Mitä se maksaa |
|---|---|---|---|---|
| 1 | **Ohjattu** | *Lisää kone* avaa viisivaiheisen dialogin: Tailscale, Kone, Etäkirjautuminen, Avainrivi, Vahvistus. Seuraava aukeaa vasta, kun vaihe on todettu valmiiksi. Asetussivu on yhteenveto. Uusi pääsy avaa dialogin avainrivin kohdalta. Lauseet näytetään viimeisessä vaiheessa ennen tallennusta. | Kun käyttöönotto on harvinainen ja ihminen haluaa yhden polun alusta loppuun. | Tila ja vianetsintä ovat eri paikassa kuin käyttöönotto. Kun rivi vanhenee tai peruttuu, asetussivu kertoo sen, mutta korjaus on taas dialogissa. Dialogin "seuraava"-logiikka tarvitsee jokaiselle vaiheelle todennettavan tilan. |
| 2 | **Tilasivu** | Kaikki on yhdellä asetussivulla. Tailscale-kortissa ovat sen tilat. Koneen kortti on neljän kohdan tarkistuslista: kone verkossa, etäkirjautuminen / SSH-palvelin, avainrivi ja koneen tunniste. Kohdat kuittautuvat Habitatin tarkistuksista, ja ensimmäinen virheellinen tai keskeneräinen on auki. Lauseet ovat sivulla aina. | Kun sama näkymä palvelee käyttöönottoa, tilaa ja korjausta. Vanhentunut tai peruttu rivi näkyy punaisena kohtana, ja korjaus on samassa paikassa. | Ensimmäisellä kerralla sivu on pidempi kuin dialogin yksi vaihe. Puhelimessa pitkä komento on raskas, mutta niin se on kaikissa suunnissa. |
| 3 | **Agentin kanssa** | Painike avaa keskustelun. Agentti selittää ja vastaa kysymyksiin. Kentän yllä on Habitatin oma tilakortti, jossa ovat linkki, konelista, komento, Tarkista ja sormenjälki. Avainrivi on vain kortissa, ja kortti lukee sen tiedostosta. | Kun ihminen ei tunne SSH:ta tai Tailscalea ja haluaa kysyä matkan varrella ("voiko ylläpitäjä käyttää tätä?"). | Tarvitaan uusi komponenttiluokka: hostin oma kortti keskustelussa. Agentti tarvitsee tilanluvun, ja jokainen käyttöönotto kuluttaa mallin vuoroja. Agentin selitys voi myös erota kortin tilasta. Sama kortti tarvitaan silti, joten suunta 3 sisältää suunnan 2 tiedot ja lisää keskustelun niiden ympärille. |

## Suositus

Suosittelen **suuntaa 2 (Tilasivu)**, koska se on rehellisin tapa näyttää tämä
pääsy:

- Jokainen tarkistuslistan kohta on yksi natiivi fakta, jonka daemon toteaa
  ihmisen omana käyttäjänä: Tailscalen peer-tila, sshd:n vastaus, avaimen
  hyväksyntä ja tallennettu isäntäavain.
- Sama lista selittää myöhemmin, miksi agentti ei pääse koneelle. Se kuuluu
  tuotteen periaatteeseen, että natiivi tila on ainoa totuus.
- Suunta 1 piilottaa tilan käyttöönoton jälkeen. Suunta 3 tarvitsee saman
  tiedon ja lisäksi uuden keskustelukortin ja agentin tilanluvun, mikä on
  enemmän rakennettavaa ja toinen paikka, jossa totuus voi erota.

Suunnasta 3 kannattaa ottaa mukaan halpa osa: sivulle linkki "Kysy agentilta",
joka avaa tavallisen keskustelun ilman korttia.

## Host-tiedot, joita näkymä olettaa

Tuotteessa ei vielä ole mitään Tailscaleen liittyvää (`grep -ri tailscale`
ei löydä mitään `internal/`-, `web/src/`- eikä `runtime/`-hakemistosta).
Kaikki alla oleva tehdään ihmisen omana käyttäjänä daemonissa. Gatewayn,
daemonin ja provisionin työnjako ei muutu.

| Tieto / toiminto | Tarvitsee | On nyt? | Missä / mitä puuttuu |
|---|---|---|---|
| Asetusosio *Omat koneet* | 1, 2, 3 | Ei | Rivi `web/src/app/settingsIndex.ts`:ään (tiedosto on olemassa). |
| `tailscale`/`tailscaled` palvelimella; tila "Ei palvelimella" | 1, 2, 3 | Ei | `runtime/profiles/`-hakemistossa ei ole `tailscale`-profiilia (tutkimuksen S1). Daemon toteaa binaarin puuttumisen. |
| Käyttäjäyksikkö `~/.config/systemd/user/habitat-tailscale.service`, soketti `$XDG_RUNTIME_DIR/habitat-tailscale/ts.sock`, `--shields-up` | 1, 2, 3 | Ei | Daemon kirjoittaa ja käynnistää yksikön. Malli on tutkimuksen raportissa (§2). |
| Kirjautumislinkki (AuthURL) selaimeen; odottaa / yhdistetty | 1, 2, 3 | Malli on olemassa | Linkin välitys selaimeen: `internal/daemon/claude_login_linux.go`. Tailscalen LocalAPI-luku puuttuu. |
| QR-koodi työpöydällä | 1, 2, 3 | On | `web/src/components/DeviceLink.tsx` (`uqr`). |
| Laite, verkko, oma osoite ja shields up (LocalAPI `status`, `prefs`) | 1, 2, 3 | Ei | Uusi daemon-luku soketista. |
| Konelista: nimi, käyttöjärjestelmä, paikalla / viimeksi nähty | 1, 2, 3 | Ei | LocalAPI-peerit. Tila "Kone ei vastaa" tulee peerin `Online`/`LastSeen`-tiedosta. |
| Koneen oma avain `~/.ssh/habitat_<kone>` ja `.pub` sekä sormenjälki | 1, 2, 3 | Ei | Daemon kutsuu `ssh-keygen`iä ihmisenä, kuten tallentaa Soniox-avaimen (`internal/daemon/speech_linux.go`). |
| Rivi `restrict,from="<oma 100.x>",expiry-time="<pvm>"` ja asennuskomento | 1, 2, 3 | Ei | Tehdään selaimessa tai daemonissa avaimen, osoitteen ja keston perusteella. |
| SSH-asetus `~/.ssh/config.d/habitat-<kone>.conf`, `Include` ja `ProxyCommand tailscale --socket=… nc` | 1, 2, 3 | Ei | Tämä tiedosto on konelista; muuta rekisteriä ei tehdä. Vanhenemispäivä talletetaan sen kommenttiriville (päätös alla). |
| Yhteyskokeilu `ssh -o BatchMode=yes <kone> true`; luokat: hylätty avain, ei vastaa, isäntäavain | 1, 2, 3 | Ei | Uusi daemon-toiminto. "Peruttu koneelta" tarkoittaa, että avain hylätään ennen vanhenemispäivää. |
| Isäntäavaimen sormenjälki ennen tallennusta ja tallennus `known_hosts`-tiedostoon | 1, 2, 3 | Ei | Avain luetaan yhteyden aikana ja tallennetaan vasta ihmisen Täsmää-painalluksen jälkeen. |
| Poisto (avain, asetus, tunniste) ja Irrota (`tailscale logout`, yksikkö pois) | 1, 2, 3 | Ei | Daemon. |
| Konesiru komentoriveillä | 1, 2, 3 | Osittain | `web/src/components/BashToolCard.tsx` on olemassa. `ssh <nimi>`-komentojen tunnistus asetustiedoston nimistä puuttuu. |
| "Yhteys auki" keskustelun otsikossa | 1, 2, 3 | Ei | `ControlMaster`-soketin olemassaolo hakemistossa `$XDG_RUNTIME_DIR`. Lokia ei pidetä, joten "viimeksi käytetty" -tietoa ei näytetä. |
| Agentin ohje koneista | 1, 2, 3 | Malli on olemassa | Generoitu skill kuten `internal/daemon/integrations/skill_linux.go`. |
| `openssh-client` runtime-profiilissa | 1, 2, 3 | Ei nimetty | Asiakas on koneilla jo nyt, mutta mikään profiili ei nimeä sitä (myös tilin salaisuuksia koskeva tutkimus huomasi tämän). |
| Dialogi | 1 | On | `web/src/components/Overlays.tsx`. |
| Tarkistus toistuu, kun sivu on auki | 2 | Ei | Sama daemon-luku kuin yllä; uutta tallennetta ei tarvita. |
| Tuotteen aloittama keskustelu ja hostin tilakortti keskustelussa | 3 | Osittain | Kortin paikka on samanlainen kuin `web/src/components/RecapCard.tsx`:ssä. Hostin omaa korttia keskustelussa ei ole. |
| Agentin tilanluku käyttöönoton aikana | 3 | Ei | Komento tai skill, joka lukee saman tilan kuin kortti. |

## Decisions for later review

- **Konekohtainen avain `~/.ssh/habitat_<kone>`, ei tilin `id_ed25519`.**
  - Vaihtoehto oli käyttää tilin avainta.
  - Tilin avain annetaan ylläpitäjille (palvelimet, SOPS), ja se elää omaa
    elämäänsä.
  - Konekohtaisen avaimen Habitat voi poistaa koskematta muuhun, ja koneen
    rivi rajaa juuri sen.
- **Oma asetusosio *Omat koneet* Tiedot agenteille -osion jälkeen.**
  - Vaihtoehto oli rivi Tiedot agenteille -osiossa.
  - Konetta ei voi esittää yhdellä integraatiokortilla, koska siihen kuuluu
    Tailscale, useita koneita ja kolme suoraa lausetta.
- **Kesto 7, 30 tai 90 päivää, oletus 30. Ilman vanhenemista ei voi valita.**
  - Tutkimus suositteli 30 päivän oletusta.
  - Ikuinen rivi rikkoisi lupauksen, että unohtunut pääsy päättyy itsestään.
- **QR vain työpöydällä, puhelimessa pelkkä painike.**
  - Tutkimuksen teksti sanoi "QR on phone".
  - Puhelin ei voi skannata omaa näyttöään. Työpöydällä QR antaa
    kirjautua puhelimen tunnistautumisella.
- **Asennuskomento poistaa ensin saman tilin aiemman Habitat-rivin**
  (`sed '/ habitat:<tili>@<sivusto>$/d'`).
  - Vaihtoehto oli pelkkä lisäys.
  - Uusiminen korvaa vanhan rivin, eikä vanhoja rivejä kerry. Poisto osuu vain
    riveihin, joiden kommentti on täsmälleen Habitatin.
- **Koneen tunniste vahvistetaan vertaamalla sormenjälkeä**
  (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` koneella).
  - Vaihtoehto oli hiljainen ensimmäisen yhteyden luottamus.
  - Tämä on ainoa kohta, jossa väärä kone tailnetissä paljastuisi. Uusimisessa
    vertailua ei toisteta.
- **Windows on myöhemmin** (näkyy harmaana välilehtenä).
  - Brief rajasi kohteiksi macOS:n ja Linuxin.
  - Windowsin ylläpitäjähaara (`administrators_authorized_keys`) tarvitsee
    oman ohjeensa.
- **"Peruttu koneelta" päätellään** siitä, että avain hylätään ennen
  vanhenemispäivää.
  - Vaihtoehto oli yleinen "ei yhteyttä".
  - Ihminen näkee, että pääsy loppui koneelta, mikä on oikea katkaisu, ja
    agentti sanoo, ettei yritä muuta reittiä.
- **Vanhenemispäivä talletetaan SSH-asetustiedoston kommenttiin.**
  - Vaihtoehto oli oma tallenne.
  - Rivi on koneella eikä palvelimella, joten päivä on pidettävä jossain.
    Natiivi asetustiedosto on jo konelista, eikä toista tallennetta tarvita.
- **Ei "viimeksi käytetty" -tietoa**, vain "yhteys auki" ControlMaster-soketista.
  - Vaihtoehto oli oma käyttöloki.
  - Lokia ei tehdä (AGENTS.md: ei rinnakkaisia tallenteita).
- **"Irrota Habitat verkostasi" poistaa kaikki koneet.**
  - Vaihtoehto oli irrottaa vain Tailscale.
  - Ilman Tailscalea mikään kone ei ole tavoitettavissa, joten jäljelle
    jäävät kortit olisivat harhaanjohtavia.
- **Kolmas lause: poisto Habitatista ei yksin riitä.**
  - Vaihtoehto oli olla mainitsematta asiaa.
  - Agentti toimii samana käyttäjänä ja on voinut kopioida avaimen
    (tutkimuksen §3), joten varma katkaisu on koneella. Tämä korvaa
    taukolauseen, jonka Jari poisti.
