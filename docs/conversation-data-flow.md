# Keskustelun tiedon kulku selaimessa

Jari palaa juuri lukemaansa keskusteluun. Selain näyttää muistissa olevan
sisällön heti, vaikka Pi kirjoittaisi parhaillaan toiseen keskusteluun.
Taustalla saapuvat tapahtumat päivittävät kumpaakin keskustelua.

Tämä sivu kuvaa suunnitellun toteutuksen. [ADR 0008](adr-0008-snappy-conversation-switching.md)
kuvaa nopean keskustelunvaihdon tavoitteen ja
[ADR 0009](adr-0009-conversation-state-ownership.md) selaimen tilan työnjaon.

## Tiedon kulku

Pi tallentaa keskustelun omaan JSONL-tiedostoonsa. Käyttäjän Unix-oikeuksilla
toimiva daemon lukee siitä historian ja julkaisee ohjaamansa Pi:n tapahtumat.
Gateway välittää selaimen pyynnöt ja tapahtumayhteyden tämän käyttäjän daemonille.

Selaimeen tulee kahta tietä sisältöä:

- **Historiasivut** tuovat tallennetut merkinnät. Ensimmäinen haku lukee
  uusimman osan; vanhempaa haetaan taaksepäin selattaessa.
- **Yksi tapahtumayhteys välilehteä kohti** tuo kaikkien keskustelujen muutokset.
  Selain päivittää jo avattuja keskusteluja ja seuraa tapahtumien järjestystä
  myös silloin, kun tapahtuma koskee avaamatonta keskustelua.

Muistissa on kaksi `Map`-rakennetta: keskustelujen metatiedot sivupalkkia ja
otsikkoa varten sekä avattujen keskustelujen sisältö. Metatiedot muuttuvat
harvakseltaan, sisältö voi muuttua jokaisesta saapuvasta tekstipalasta.
Erilliset tilaukset antavat keskustelun päivittyä herättämättä sivupalkkia tai
taustakeskustelujen renderöintiä.

Store kuuluu henkilölle tässä välilehdessä. Sama henkilö voi saada uuden
kirjautumisistunnon menettämättä näkymiään. Uloskirjautuminen, istunnon
vanheneminen tai henkilön vaihtuminen tyhjentää ne. Historiaa ei tallenneta
selaimen pysyvään varastoon. Aluksi muistissa pidetään noin 50 keskustelua;
rajan ylittyessä poistetaan vähiten äskettäin katsottu kokonainen keskustelu.
Metatiedot säilyvät. [Muistinkäytön jatkotyö](../issues/tune-conversation-retention/item.md)
käsittelee tavurajat ja vanhojen sivujen vapauttamisen mittausten perusteella.

## Osien vastuut

| Osa | Vastuu ja rajapinnan ydin |
|---|---|
| `conversationJournal.ts` | Omistaa tapahtumayhteyden, globaalin tapahtumakursorin ja katkoista palautumisen. `start`, `resume` ja `stop` ohjaavat yhteyttä; `route` välittää tapahtuman storelle. Ilmoittaa uuden snapshotin tai keskustelun tilan tarpeesta. |
| `conversationPager.ts` | Lukee ja validoi historiasivut. `tail` hakee uusimman osan, `older` vanhemman sivun ja `reconnect` etsii rajatulla määrällä sivuja yhteistä kohtaa aiempaan sisältöön. `cancelAll` peruu lukupyynnöt. |
| `conversationStore.ts` | Omistaa metatiedot ja keskusteluikkunat. `applySnapshot`, `applyPage` ja `applyEvent` sovittavat tiedot yhteen; `view` merkitsee katsotun keskustelun, `markStale` päivitystarpeen ja `dispose` tyhjentää rakenteet. Tarjoaa erilliset luku- ja tilausrajapinnat metatiedoille ja keskusteluille. |
| `App.tsx` ja Redux | Omistavat sovelluksen ja istunnon tilan sekä kytkevät yhteyden, lukijan ja storen toisiinsa. Valinta tulee reitistä. |
| Keskustelunäkymät ja sivupalkki | Tilaavat tarvitsemansa osan `useSyncExternalStore`-rajapinnalla. Näkymät eivät hae historiaa itse. Sekä vain luettava historia että ohjattava keskustelu käyttävät samaa storea. |
| `useReadingPosition.ts` | Säilyttää lukukohdan merkinnän avaimen ja sijainnin avulla. Keskustelun vaihtuessa fokus ja paikalliset avaukset palautetaan tai nollataan kyseisen keskustelun mukaisesti. |

Yhteyden omistus siirtyy pois `App.tsx`:n ja `useConversation.ts`:n erillisistä
EventSourceista. Historian lataus ja sovitus siirtyvät pois `useConversation.ts`:stä
ja `HistoryView.tsx`:stä. Keskustelun vaihtaminen ei enää pura ja rakenna
keskustelukomponenttia uudelleen. Store, reititin ja sivujen sovitus toimivat
ilman Reactia; muuttumattoman tilausvastauksen viite pysyy samana.

Metatieto sisältää myös keskustelun viimeksi havaitun tilan. Reititin ilmoittaa
tilan lukijalle jonon, komennon, kysymyksen tai vuoron päättymisen muutoksista.
Näin tila päivittyy taustalla eikä keskustelun valinta käynnistä statuspyyntöä.

### Historian ja tapahtumien sovittaminen

Yhden keskustelun muistissa oleva historia on yhtenäinen jakso vanhimmasta
ladatusta merkinnästä uusimpaan. Merkinnät tunnistetaan natiivin `entry_key`-avaimen
perusteella: saman avaimen sisältö päivitetään ja uudet merkinnät lisätään
järjestykseen. Sivut yhdistetään yhteisen avaimen ja yhteensopivan järjestyksen
avulla. Jos yhteistä kohtaa ei löydy, vanha jakso korvataan uudella loppuosalla.

Vielä kirjoitettava vastaus pidetään erillään tallennetusta historiasta.
Tallennettu assistant-merkintä korvaa keskustelun väliaikaisen vuoron.
Pelkkä `turn.settled` ei kerro, että vastaus tallentui: jäljelle jäänyt
väliaikainen sisältö näytetään epävarmana ja poistetaan seuraavan vuoron
alkaessa. Historiasivun latauksen aikana saapuvat tapahtumat kerätään talteen
ja sovitetaan sivuun sen saavuttua, jotta vastaus ei katoa tai näy kahdesti.

Vanhemman sivun kursori on raja-merkinnän `entry_key`. Daemon palauttaa
pyydetyn sivun niin, että se sisältää myös rajamerkinnän, jolloin store näkee
yhteisen kohdan ja liittää sivun. Pi lisää merkintöjä vain tiedoston loppuun,
joten lisäys ei vanhenna kursoria. Jos raja-avainta ei enää löydy, selain
lataa uusimman osan uudelleen eikä yritä liittää sivuja arvaamalla.
Tarkat viestimuodot kuuluvat
[sopimuksiin](../contracts/v1/AGENTS.md) ja
[sivutuksen toteutusissueen](../issues/tail-first-history-paging/item.md).

Komennot ja luonnokset säilyttävät nykyisen käsittelynsä. Historian saapuminen
ei korvaa lähetyksen kuittausta: epäselvä lähetys selvitetään komennon
kuittauksesta tai tilasta. `ConversationActions.tsx` vastaa ohjauksesta,
keskustelustore näytettävästä sisällöstä.

## Toiminta eri tilanteissa

| Tilanne | Mitä tapahtuu |
|---|---|
| Ensilataus tai kylmä avaus | Snapshot tuo metatiedot ja tapahtumavirran aloituskohdan. Valitun keskustelun uusin historia ladataan; muiden historiaa ei esiladata. Vahvistettu puuttuva historia näkyy tyhjänä keskusteluna. |
| Paluu muistissa olevaan keskusteluun | Valinta vaihtuu ja näkymä lukee sisällön muistista. Verkkopyyntöä tai uutta tapahtumayhteyttä ei tarvita. Luonnos ja lukukohta seuraavat keskustelua. |
| Pi kirjoittaa vastausta | Tapahtumat päivittävät oikean keskustelun sisältöä myös taustalla. Avaamattomalle keskustelulle ei luoda historiaikkunaa. |
| Lyhyt yhteyskatko | Vanha teksti jää luettavaksi yhteystilan kanssa. Tapahtumien toisto jatkaa viimeisestä cursorista. |
| Pitkä katko tai daemonin uudelleenkäynnistys | Selain hakee uuden snapshotin ja historian loppuosan. Se lukee rajatusti taaksepäin löytääkseen yhteisen kohdan muistissa olevaan historiaan. Jos kohtaa ei löydy, säilytetään uusi loppuosa; vanhempaa voi hakea selaamalla. |
| Keskustelun väliaikainen sisältö katkeaa | `ring_truncated` käynnistää kyseisen keskustelun historian päivityksen. Ehjä yhteinen tapahtumakursori säilyy. |
| Vanhempaan historiaan selaaminen | Lukija hakee edellisen sivun ja store liittää sen historiaan. Lukukohta säilyy. Jos raja-avainta ei löydy, lataus aloitetaan uusimmasta osasta. |
| Uloskirjautuminen tai henkilön vaihtuminen | [Uloskirjautumisen toiminto](../issues/browser-logout-cleanup/item.md) pysäyttää kuuntelijat, peruu pyynnöt ja tyhjentää käyttäjän selainrakenteet. Myöhäiset vastaukset eivät palauta vanhaa sisältöä. |
| Toinen välilehti tai terminaali | Jokaisella välilehdellä on oma store ja yhteys. Daemonin ohjaaman Pi:n muutokset saapuvat tapahtumina. Terminaalista kirjoittava Pi ei julkaise niitä, eikä tämä toteutus seuraa niitä: muutos näkyy, kun keskustelu ladataan uudelleen. Tarve ja ratkaisu (selaimen tarkistus tai daemonin tiedostovahti) pohditaan [omassa issuessaan](../issues/notice-terminal-pi-writes/item.md). |

Daemonin tapahtumien toistoikkuna kasvatetaan 1024 tapahtumaan ja noin
16 MiB:iin, ensin täyttyvän rajan mukaan. Sen ulkopuolelle jäävä kursori
tuottaa yhdistettäessä 409-vastauksen. Tämä on eri tilanne kuin yksittäisen
keskustelun väliaikaisen sisällön `ring_truncated`-ilmoitus.

Toteutuksen työnjako ja testit ovat
[sivutuksen](../issues/tail-first-history-paging/item.md),
[keskustelumuistin](../issues/recent-conversation-windows/item.md),
[tapahtumayhteyden](../issues/one-browser-event-stream/item.md) ja
[uloskirjautumisen](../issues/browser-logout-cleanup/item.md) issueissa.
