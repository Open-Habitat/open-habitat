# Linux-tilin lukitus ja Open Habitat

**Yhteenveto:** Linuxissa ei ole yhtä kaikkialle vaikuttavaa tililukkoa. Testipalvelimella lukittu salasana salli SSH-avainkirjautumisen (`UsePAM yes`), tilin vanheneminen esti uuden kirjautumisen, ja `nologin` esti komentotulkin mutta ei PAMin account-tarkistusta. Mikään näistä muutoksista ei pysäyttänyt jo käynnissä olevaa koetilin prosessia tai user manageria. Habitatin koodi ei tarkista shadow-vanhenemista; salasanalukko ja oletuksena oleva `nologin` ovat sen normaali lähtötila, eivät pääsynpoisto. Suosittelen erottamaan salasanan, palvelukohtaisen pääsyn ja koko tilin vanhenemisen: vain viimeisestä olisi perusteltua tehdä Habitatin uusi pääsyeste. **Tutkimus on osittainen:** natiivikokeet ja koodianalyysi tehtiin, mutta oikean kertakäyttöisen GitHub-käyttäjän selainkirjautuminen, selainistunnon jatkuminen sekä Pi/tmux/editori-kokeet ovat vielä tekemättä. Niitä ei tässä esitetä mitattuina eikä issuea suljeta.

## Rajaus ja näytön laatu

- **Koe:** testipalvelin Fleetrepon dokumentoidun Alder → pinnattu root-SSH -reitin kautta, 31.10.2026. Ei muutoksia Birchn tai pilotin oikeisiin käyttäjiin.
- **Koodi:** tämän worktreen lähtötila `6f81ff22`; testipalvelimen tuote `0.0.0-pilot.561`, commit `da18101644e37aaff5e8e9b1e6ffe345a5118064`.
- **Lähde:** alla nimetty upstream-versio tai dokumentti. Palvelimen todellinen PAM-pino voi poiketa upstreamista.
- **Päättely:** lähteestä tai koodista johdettu odotus, jota ei todistettu kyseisen tuotepolun kokeella.

Cockpit-vertailun oppi 3 (`issues/benchmark-cockpit/report.md`) oli liian laaja: ”lukittu tili estää SSH:n” ei pidä sellaisenaan paikkaansa. Lisäksi `pam_nologin` (järjestelmän nologin-tiedosto) ja käyttäjän `/usr/sbin/nologin`-shell ovat eri mekanismit. Habitatin asennusopas jo erottaa salasanalukon ja SSH:n `UsePAM`-asetuksen kohdassa *SSH login into a Habitat account*.

## Mitä kukin kielto tarkoittaa

Taulukon SSH tarkoittaa **uutta avaimella avattua yhteyttä**. Jo avatun yhteyden sulkeminen on erillinen toimi. ”PAMista riippuva” ei tarkoita automaattisesti estettyä: kyseisen palvelun on kutsuttava oikeaa PAM-vaihetta ja sen pinossa on oltava kieltävä moduuli oikealla ohjauslipulla.

| Mekanismi | Merkitys | SSH-avain | su | cron | systemd/user manager ja linger |
|---|---|---|---|---|---|
| `passwd -l`, `usermod -L` | Shadow-salasanan eteen `!`; salasanaa ei voi käyttää. Ei tilin yleinen sulku. | PAM käytössä ja tavallinen pam_unix account: avain toimii. Ilman PAMia OpenSSH voi torjua lukitun tilin ennen avainta; koe vahvisti molemmat. | Tavallisen käyttäjän salasanatodennus epäonnistuu; root voi ohittaa auth-vaiheen. Koetilin root-su onnistui. | Tavallinen account-tarkistus ei yksin kiellä; koe palautti onnistumisen. Varsinaista cron-ajoa ei kokeiltu. | Käynnissä oleva manager jatkoi. `User=` ei ole salasana-autentikointi. |
| `usermod -e`, `chage -E`, shadow `sp_expire` | Koko tilin päättymispäivä (päiviä Unix-epookista). Tyhjä = ei rajaa; älä käytä nollaa poistamiseen, sen tulkinta vaihtelee. | PAM account torjui kokeessa. Ei poista avaimia eikä sulje olemassa olevaa yhteyttä. | Root-su torjui kokeessa account-vaiheessa. | PAM account torjui kokeessa; työn käynnistys riippuu cronin PAM-toteutuksesta. | Käynnissä oleva manager ja prosessi jatkoivat. Uusi manager riippuu `PAMName`-pinosta, ei linger-tiedoston olemassaolosta yksin. |
| `sp_lstchg`, `sp_max`, `sp_inact` | Salasanan ikä, enimmäisikä ja sen jälkeinen käyttämättömyysraja. `lstchg=0` vaatii vaihdon; nämä eivät ole sama asia kuin `sp_expire`. | Voi vaatia salasanan vaihdon myös avaimen jälkeen. Kokeen ei-PTY-komento epäonnistui. `no_pass_expiry` voi muuttaa PAM-tulosta. | Kokeessa root-su ei onnistunut vanhentuneella salasanalla. | PAM voi palauttaa `PAM_NEW_AUTHTOK_REQD`, jota eräajo ei pysty ratkaisemaan. | Käynnissä olevia prosesseja ei lopeteta. Uuden managerin pinosta ei voi päätellä vain SSH:n tuloksen perusteella. |
| `/usr/sbin/nologin` shell | Suoritettava ohjelma, joka ilmoittaa ettei tili ole käytettävissä ja poistuu. | Tavallinen shell/exec epäonnistuu autentikoinnin jälkeen. Ei yksin luotettava esto porttiohjauksille tai `internal-sftp`:lle. | Oletusshell epäonnistuu; rootin `su -s /bin/bash` onnistui kokeessa. | Ei yleinen cron-kielto; cron käyttää omaa shell-valintaansa. | `User=`-palvelu ja manager eivät tarvitse login-shelliä. |
| `AllowUsers` / `DenyUsers` | sshd:n palvelukohtainen käyttäjä-/osoitepolitiikka | Torjuu uudet kyseiseen sshd:hen tulevat yhteydet. | Ei vaikutusta | Ei vaikutusta | Ei vaikutusta |
| `pam_access` | PAM account -moduulin käyttäjä-, ryhmä- ja lähdekontekstiin perustuva sääntö | Vaikuttaa jos sshd:n account-pino käyttää sitä; SSH:n etäosoite on osa kontekstia. | Oma PAM-palvelu ja konteksti | Oma PAM-palvelu ja konteksti | Vain käytössä olevan PAM-pinon kautta; ei jatkuva prosessivalvoja. |
| `pam_faillock` | Epäonnistuneiden autentikointien laskuri, lukitusaika ja pinon preauth/authfail/authsucc/account-kytkentä | Pelkkä password-auth-pinon kytkentä ei välttämättä koske avainta. Account-kytkentä voi koskea. | Riippuu pinosta ja root-poikkeuksista | Riippuu pinosta | Ei itsestään pysäytä manageria; rootin ja paikallisten käyttäjien poikkeukset ovat asetuksia. |

`linger` tarkoittaa, että user manager voidaan käynnistää ilman aktiivista kirjautumisistuntoa ja jättää käyntiin uloskirjautumisen jälkeen. Se ei ole todistus kirjautumisen luvallisuudesta eikä lukituskomennon kumoaja. Prosessilla jo oleva UID ei katoa shadow-tiedoston muuttuessa.

## Turvallinen palvelinkoe

Koe loi vain käyttäjän `oh-lock-3627`, väliaikaisen avaimen ja localhostiin porttiin 22289 sidotun erillisen sshd:n. Se ei muokannut tuotannon sshd-konfiguraatiota tai PAM-pinoja. Tilillä oli useraddin oletuksena lukittu salasana, `/bin/bash`, väliaikainen linger ja yksi `systemd-run --property=User=oh-lock-3627 /usr/bin/sleep 600` -palvelu. Eri tilojen välissä palautettiin tilin expiry, shell ja salasanan ikä. Avaimen testi käytti pinnattua paikallista host-avainta; PAM yes/no vaihdettiin vain erillisen sshd:n asetuksessa. Tämä ei testannut salasanalukon siirtymää toimivasta salasanasta, vaan lukitun lähtötilan käyttäytymistä.

Palvelimen paketit: `openssh-server 1:9.6p1-3ubuntu13.20`, `libpam-modules 1.5.3-5ubuntu5.7`, `systemd 255.4-1ubuntu8.18`.

| Tila | SSH PAM yes (exit) | SSH PAM no (exit) | Root `su -s /bin/bash -c true` | `pam_acct_mgmt`: sshd / su / cron / systemd-user | Jo käynnissä oleva palvelu / manager |
|---|---:|---:|---:|---|---|
| Lukittu salasana | 0 | 255 | 0 | 0 / 0 / 0 / 0 | active / active |
| Tilin expiry 1970-01-02 | 255 | 255 | 1 | 7 / 7 / 7 / 7 | active / active |
| Salasanan lstchg=1, max=1 | 1 | 255 | 1 | 12 / 12 / 12 / 12 | active / active |
| Nologin-shell | 1 | 255 | 0 | 0 / 0 / 0 / 0 | active / active |

PAM 0 = onnistuminen, 7 = `PAM_PERM_DENIED`, 12 = `PAM_NEW_AUTHTOK_REQD`. Tilin vanhenemisen sisäinen moduulitulos voi olla `PAM_ACCT_EXPIRED`; koko pinon palauttama 7 on tässä havaittu tulos, ei oletus. PAM-kokeessa kutsuttiin `pam_start` ja `pam_acct_mgmt` ilman autentikointia, keskustelua tai `PAM_RHOST`-asetusta. Näin mitataan vain paikallista account-pinoa, ei oikeaa cron-ajoa tai systemdin käynnistyspolkua. `UsePAM no` -sarakkeessa salasana pysyi lukittuna kaikissa riveissä: sarake **ei eristä** expiry- tai shell-tekijän vaikutusta.

Havaitut SSH-viestit olivat vastaavasti tyhjä onnistuminen, `Your account has expired`, `Password change required but no TTY available` ja `This account is currently not available`. Ilman PAMia kaikki päättyivät `Permission denied (publickey)`.

**Siivous:** ensimmäinen `userdel -r` osui vielä poistuvaan käyttäjäprosessiin. Kolmen sekunnin odotuksen jälkeen prosessilista oli tyhjä ja poisto onnistui. Varmistettiin erikseen passwd-tietueen, kotihakemiston, linger-merkinnän ja `/var/tmp/oh-lock-umfi76zo`-koehakemiston puuttuminen. Väliaikainen sshd ja palvelu pysäytettiin. Mitään oikean käyttäjän prosessia ei lopetettu. Koekoodi ja raakadata ovat raportin vieressä; koodi on kertakokeen tallenne, ei ylläpito-operaattori.

**Puutteet:** `AllowUsers/DenyUsers`, `pam_access`, `faillock`, `sp_inact` sekä suljetun user managerin uudelleenkäynnistys jäivät lähdepohjaisiksi. `/etc/pam.d/systemd-user`-tiedoston erillinen lukuyritys epäonnistui, eikä vendor-PAM-polun jatkoluku onnistunut komentolainauksen takia. Todellinen user@-unit kuitenkin luettiin: siinä on `PAMName=systemd-user`. Managerin uutta käynnistystä ei siis väitetä testatuksi eikä upstreamin PAM-pinoa samaksi kuin palvelimen.

## Mitä Habitat tekee nykyään

**Koodihavainnot:**

- `internal/provision/executor_linux.go`: `account` käyttää `useradd` ilman salasanaa. `accountRecord` lukee NSS:n passwd/group-tietueet, UID:n, GID:n, kodin ja lisäryhmät; `identity` vertaa shelliä rootin julistukseen. Shadow-tietuetta ei lueta tässä tarkistuksessa.
- `internal/gateway/auth.go`: callback tekee brokerin `ensure`- ja `authorize`-kutsut ennen istunnon antamista. Ei paikallista PAM-todennusta.
- `internal/gateway/session.go`: `authenticated` tarkistaa evästeen, oman estotilan, istunnon iät ja access-email-sidonnan. Ei joka pyynnön shadow- tai PAM-tarkistusta.
- `systemd/open-habitat-daemon@.service`: daemon käyttää `User=%i`, ei `PAMName`-asetusta.
- `internal/daemon/terminal_linux.go`: selaimen shell on nimenomaisesti `/bin/bash`; tmux käynnistetään käyttäjän manageriin, kun se on käytettävissä. Passwd-shellin nologin ei siis ole selainterminaalin kielto.
- `internal/daemon/editor_linux.go` sekä asennusoppaan editorikuvaus: code-server käyttäjän managerissa tai daemonin lapsena. Tällä ei tehdä uutta paikallista salasanakirjautumista.

| Muutos | Uusi Habitat-kirjautuminen (koodista päätelty) | Nykyinen selainistunto (koodista päätelty) | Daemon, Pi, tmux ja editori |
|---|---|---|---|
| Salasanalukko | Ei estettä tästä; normaali lähtötila | Ei tämän vuoksi peruutusta | Ei tämän vuoksi pysäytystä |
| Tilin tai salasanan vanheneminen | Ei suoraa shadow-estettä; muu käynnistysriippuvuus voi silti epäonnistua | Ei tämän vuoksi peruutusta | Jo käynnissä olevien odotetaan jatkuvan; uuden user managerin PAM voi vaikuttaa uusiin työkaluihin |
| Julistettu nologin | Sallittu ja oletus | Sallittu | Selainbash ei käytä sitä |
| Shell muutettu vastoin julistusta | Broker hylkää identiteettidriftin | Istunto ei itse tarkista shelliä; myöhempi daemon/socket-käynnistys voi epäonnistua | Ei pidä sekoittaa prosessien tappamiseen |
| sshd Allow/Deny | Ei suoraa vaikutusta | Ei suoraa vaikutusta | Ei suoraa vaikutusta |
| pam_access / faillock | Ei Habitatin omaa PAM-kutsua; palveluiden käynnistyspinot erikseen | Ei suoraa peruutusta | Ei jatkuvaa tarkistusta |

**Kaikki tämän taulukon Habitat-tulokset ovat päättelyä, eivät selaimessa mitattuja tuloksia.** Tavallisen `sleep`-palvelun jatkuminen osoittaa Linuxin käyttäytymistä, ei tuotteen Pi-, tmux- tai editoripolun hyväksyntää.

Täysi koe tarvitsee kertakäyttöisen, oikeasti OAuthilla sidotun testihenkilön ja hänen luvallisen selainistuntonsa. Pelkkä `useradd` ei kelpaa: broker ei adoptoi olemassa olevaa tiliä. Tutkimukselle ei ollut annettu tällaista GitHub-identiteettiä/istuntoa, eikä oikeiden käyttäjien istuntoja tai tokeneita lainattu. Broker-ledgeriä tai gatewayn istuntotiedostoa ei kirjoitettu testitodisteen valmistamiseksi. Siksi tehtävän ”establish by experiment” -osa on kesken.

Jatkokokeessa tarvitaan per mekanismi sekä uusi callback että jo avoimen selainistunnon HTTP, tapahtumavirta, Pi:n uusi viesti, tmux-input ja editorin HTTP/WebSocket. Ensin säilytetään käynnissä olevat prosessit, sitten kokeillaan uudet käynnistykset erikseen. Kaikki tilimuutokset palautetaan myös epäonnistumisessa. Faillock- ja access-kokeet on rajattava koetiliin/palveluun; koko testipalvelimen PAM- tai SSH-kieltoa ei tarvita.

## Vertailu: Cockpit ja JupyterHub

**Cockpit (lähde):** `src/session/session.c` kutsuu uuden istunnon normaalissa root-polussa `pam_acct_mgmt`; salasanan vaihtovaatimus ohjataan `pam_chauthtok`-kutsuun ja muu kielto estää istunnon. Samana käyttäjänä ajettavassa erityispolussa uuden PAM-istunnon avaus voidaan ohittaa. Tämä on konkreettinen esimerkki account-vaiheen erottamisesta autentikoinnista, **ei** todiste jokaisen jo avatun Cockpit-istunnon välittömästä peruuttamisesta. Lukittu Unix-salasana estää salasanakirjautumisen, mutta ulkoinen todennus ja sen jälkeinen account-tarkistus on arvioitava erikseen.

**JupyterHub 5.2.1 (lähde):** `PAMAuthenticator.authenticate` tekee `pamela.authenticate` ja oletuksena `check_account=True` myös `pamela.check_account`. `open_sessions` on oletuksena **False**, koska PAM-istuntojen elinkaari on ongelmallinen. PAM-autentikaattorin käytös ei kuvaa kaikkia OAuth-autentikaattoreita. Account-tarkistus autentikoinnissa ei todista käynnissä olevan notebook-palvelimen välitöntä pysähtymistä. Tämä varoittaa kopioimasta ”PAM käytössä” kokonaisena suunnitteluratkaisuna: auth, account, session sekä jo annetut evästeet/tokenit ovat eri kysymyksiä.

**systemd (lähde + koe):** upstream v255:n `systemd-user.in` käyttää `pam_unix.so no_pass_expiry`-moduulia `sufficient`-lipulla ja sen jälkeen `pam_permit.so`-moduulia. Siksi edes account-moduulin sisällyttäminen pinoon ei yksin tarkoita kiellon pakottamista. Testipalvelimen suoran PAM-kutsun tulos oli erilainen; distro-/paikallispino on tutkittava, jos managerin uutta käynnistystä käytetään hyväksymiskriteerinä.

## Suositus (ei päätös eikä toteutus)

1. **Älä estä Habitatia salasanalukon, salasanan iän tai julistetun nologin-shellin vuoksi.** Ne koskevat eri todennuskanavaa ja kaksi ensimmäisistä normaaleista tiloista on nykyisen selainkäytön lähtökohta. Salasanaton OAuth-tili ei tarvitse paikallista salasananvaihtodialogia.
2. **Suosittele koko tilin vanhenemista natiiviksi yhteiseksi pääsyesteeksi.** Uusi Habitat-kirjautuminen pitäisi torjua, ja nykyisen selainvaltuuden pitäisi päättyä määritellyssä ajassa. Epäselvä tilan luku ei saa avata uutta pääsyä. Tämä tarvitsee ADR:n ja täyden kokeen ennen toteutusta.
3. **Älä lainaa sshd:n sääntöjä.** `DenyUsers` voi tarkoituksella sulkea SSH:n mutta sallia selaimen. Älä myöskään tulkitse faillock-laskuria yleiseksi käyttäjän sulkemiseksi. Jos operaattori tarvitsee PAM-palvelukohtaisia sääntöjä myös selaimelle, määrittele erillinen Habitat account -palvelu ja sen konteksti; älä kutsu sshd:n pinoa tekaistulla etäosoitteella.
4. **Erota pääsyn sulku työn tappamisesta.** Expiry tai Habitatin withdraw ei saa hiljaisesti luvata tai tehdä kaikkien Pi-, SSH-, tmux-, editori- ja user-palveluiden lopettamista. Turvallisuuspoikkeaman täydellinen tilin eristäminen on rootin erillinen operaatio. Selaimen relay-yhteydet pitää sen sijaan sulkea, jos niiden valtuus perutaan.

### ADR:ssä ratkaistavat kysymykset

- Hyväksytäänkö `sp_expire` Habitatin natiiviksi yleiseksi pääsyesteeksi, ja pidetäänkö password expiry/inactivity erillään? Pelkkä geneerinen `pam_acct_mgmt` ei automaattisesti toteuta suositeltua erottelua.
- **Suositeltu vastuunjako:** broker lukee root-valtuutta vaativan natiivin tilan vain todennetulle sidonnalle; gateway panee selainvaltuuden päättymisen toimeen; daemon ei saa toisten identiteettien valvonta- tai shadow-lukuvaltuutta. Laajentaako tämä brokerin hyväksyttyä tehtävää, ja valitaanko rajattu shadow-tarkistus vai erillinen PAM account -palvelu?
- Miten muutos saavuttaa olemassa olevan istunnon: tarkistusväli, revokaatiosignaali, pitkät HTTP/WebSocket-yhteydet, editori, näkymät ja julkiset view-linkit? Kirjautumistarkistus yksin jättää nykyiset valtuudet eloon.
- Mitä tapahtuu tarkistuspalvelun katkossa, ja miten kielto erotetaan tilan lukemisen epäonnistumisesta? Millä viiveellä eston on viimeistään toteuduttava?
- Estääkö lukitus vain uuden selainkäytön vai myös natiivin agent CLI:n? Suositus ei tee paikallisesti jo ajavasta saman UID:n prosessista luotettua pääsynvalvojaa.
- Miten operaattorille kerrotaan, että tilin avaaminen uudelleen ei palauta vanhoja peruttuja selainvaltuuksia tai pysähtyneitä töitä automaattisesti?

## Lähteet

Suorat HTTPS-haut onnistuivat; yleistä verkkohakua ei tarvittu. Versiopinnatut lähteet ovat vertailua, eivät väite palvelimen Ubuntu-patchien täydellisestä vastaavuudesta.

- [shadow(5)](https://man7.org/linux/man-pages/man5/shadow.5.html): salasanakenttä ja erilliset ikä-/expiry-kentät.
- [passwd(1)](https://man7.org/linux/man-pages/man1/passwd.1.html): `--lock` lukitsee salasanan, ei välttämättä tiliä; SSH-avain mainitaan erikseen.
- [OpenSSH 9.6p1 auth.c](https://github.com/openssh/openssh-portable/blob/V_9_6_P1/auth.c), `allowed_user`: `!options.use_pam && platform_locked_account`, shellin olemassaolo/suoritettavuus sekä Allow/Deny-säännöt.
- [Linux-PAM 1.5.3 pam_unix_acct.c](https://github.com/linux-pam/linux-pam/blob/v1.5.3/modules/pam_unix/pam_unix_acct.c) ja [support.c](https://github.com/linux-pam/linux-pam/blob/v1.5.3/modules/pam_unix/support.c): account-vaihe ja shadow-vanhenemisen käsittely.
- [pam_access(8)](https://man7.org/linux/man-pages/man8/pam_access.8.html) ja [pam_faillock(8)](https://man7.org/linux/man-pages/man8/pam_faillock.8.html): moduulien vaiheet ja asetukset.
- [systemd v255 systemd-user.in](https://github.com/systemd/systemd/blob/v255/src/login/systemd-user.in): upstream-PAM-pino. Testipalvelimen `systemctl cat user@.service` vahvisti `PAMName=systemd-user`.
- [Cockpit session.c](https://github.com/cockpit-project/cockpit/blob/main/src/session/session.c): haetun tiedoston SHA-256 `5f42f73d5c4fec319303346ee140d0a2ea7335dd3b5577f425073260e4211eda` (main voi liikkua).
- [JupyterHub 5.2.1 auth.py](https://github.com/jupyterhub/jupyterhub/blob/5.2.1/jupyterhub/auth.py): PAMAuthenticator, check_account ja open_sessions.
- Repo: `docs/operations.md`, `internal/AGENTS.md`, yllä nimetyt koodipolut ja aiempi `issues/benchmark-cockpit/report.md`. Git-lähtörevision avulla havainnot voi toistaa myös tiedostojen muuttuessa.
- Fleetrepo (Alderlla): `infra/open-habitat-test/{AGENTS,PROVISIONING,ADMIN,QUALIFICATION-VM}.md` ja `infra/machines/open-habitat-test.md`: sallittu koeympäristö, pinnattu yhteys ja koneen identiteetti. Yksityisiä avaimia ei siirretty Alderlta.
