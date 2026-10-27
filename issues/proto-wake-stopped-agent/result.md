# Tulos: pysähtyneen agentin herätys, kierros 2

Prototyyppi on `prototypes/wake-2/index.html`, ja se on rakennettu
kierroksesta `design-system/prototypes/rounds/2026-10-27-agentin-heratys-2/`.
Kirjaston build tuottaa yhden offline-tiedoston kuten kierroksella 1, eikä
siinä ole tuotantokomponenttien bundlea. Opas on `prototypes/wake-2/NOTES.md`,
ja kuvat ovat `prototypes/wake-2/evidence/`-hakemistossa laitteen
skaalauksella 2. `verify.mjs` käy läpi kolme suuntaa työpöydällä ja
puhelimessa, vaaleana ja tummana. Se tarkistaa, että selostus (aika, syy,
yhteenvedot ja tallessa oleva haara) näkyy ennen Pi:n käynnistystä. Lisäksi
se tarkistaa, että kirjoittaminen käynnistää Pi:n, lähetys herättää sen
kerran, vastaus ei kerro yötä uudestaan, valmistuva työ päivittää selostuksen
herättämättä agenttia, syyn vaihto muuttaa selostuksen ja konsoli ja verkko
pysyvät puhtaina. Kierroksen 1 vedos on yhä `prototypes/wake/`-hakemistossa.

Jarin valinnat kierrokselta 1 ovat mukana kaikissa suunnissa. Kirjoittaminen
herättää: ensimmäinen merkki käynnistää Pi:n ilman vuoroa, ja lähetys aloittaa
vuoron. Painike-kortin selostus näkyy ennen herätystä, ja sen kirjoittaa
host omista tiedoistaan eikä herätetty agentti. Avaamisen lähtölaskenta on
poistettu, eikä Herätä-painiketta ole.

## Akseli: missä hostin selostus on ennen herätystä

| # | Suunta | Missä selostus on | Milloin se on oikea | Mitä se maksaa |
|---|---|---|---|---|
| 1 | Kortti | Langan lopussa korttina. Lähetyksen jälkeen kortti jää lankaan merkinnäksi ”Agentti lepäsi 20.20–07.21”. | Jos selostus halutaan yhteen paikkaan ja yhdellä silmäyksellä luettavaksi. Tämä on lähin jatke Painike-kortille, josta pidit. | Kortti on pitkä, kun töitä on paljon, ja vie puhelimessa näytön. |
| 2 | Aikajana | Langassa tapahtumina omilla kellonajoillaan, pysähtyminen mukaan lukien. Lopussa on ”nyt”-rivi. | Jos syy ja seuraus pitää nähdä: töitä valmistui jo ennen pysähtymistä, mutta kukaan ei odottanut niitä. | Lanka saa uudenlaisen, hostin kirjoittaman rivin, ja pitkä yö venyttää sitä. |
| 3 | Liitteenä | Kentän yllä liitteenä, joka lähtee agentille seuraavan viestin mukana. Sirua napauttamalla näkee yhteenvedon, ja lähetyksen jälkeen liite on viestikuplassa. | Jos halutaan tehdä näkyväksi se, mitä nykyään tapahtuu piilossa: kiinnikuromisviesti kulkee viestisi mukana. | Yksityiskohta vaatii napautuksen, ja puhelimessa liite työntää lankaa ylöspäin. |

## Host-tiedot, joita suunnat tarvitsevat

Kaikki suunnat tarvitsevat samat tiedot. Ero on vain esityksessä.

| Tieto | Onko olemassa |
|---|---|
| Onko keskustelun Pi käynnissä | **On**: snapshotin `process` ja `capabilities.agent_resume`. |
| Milloin ja miksi Pi pysähtyi (jouten, päivitys tai daemonin uudelleenkäynnistys, kaatuminen vai ihmisen Stop) | **Ei ole.** Tieto on vain daemonin journalissa (`conversation_idle_stop`). Daemonin pitää tallentaa aika ja syy keskustelun tilaan. Tämä on selostuksen ensimmäinen lause ja kaikkien suuntien uusi edellytys. |
| Päättyneet omat ajot tiloineen, päättymisaikoineen ja yhteenvetoineen | **On**: `spinoffs.schema.json` antaa ajon `state`-, `ended_at`-, `summary`-, `branch`- ja `preserved`-kentät. Yhteenveto on Taskfleetin oma, eli workerin raportti, eikä Habitat tai agentti kirjoita sitä. |
| Mitkä ajot ovat päättyneet sen jälkeen, kun agentti viimeksi kuuli niistä | **Osittain.** Rajauksen laskee nyt vain Pi:n laajennus (`readSpinoffs` ja `reported`-joukko tiedostossa `internal/daemon/process-extension.mjs`), ja vasta Pi:n käynnistyessä. Daemonin pitää laskea sama Pi:n ollessa pysähdyksissä, samalla `run_id:state`-avaimella ja haaran viimeisen merkinnän ajasta. Muuten selostus ja agentin kiinnikuromisviesti voivat erota toisistaan. |
| Katkenneet taustaprosessit (päivitys tai kaatuminen) | **Osittain.** Laajennus laskee ne (`processes` tiedostossa `catchUpMessage`) ja vasta käynnistyksessä. Sama siirto daemonille. Vedos näyttää vain syyn lauseen eikä prosessiriviä. |
| Pi:n käynnistys ilman vuoroa (kirjoitettaessa) | **On**: `POST /api/v1/conversations/<id>/continue`. Käyttämätön Pi pysähtyy tyhjäkäyntinä 10 minuutissa. |
| Kiinnikuromisviesti viestin mukana | **On**: `before_agent_start`. Sisältö pitää kuitenkin muuttaa vastaamaan näytettyä selostusta (syy, yhteenvedot, haara), jotta ihminen ja agentti aloittavat samasta kohdasta. |
| Liitteen tallennus viestiin (suunta 3) | **Osittain.** Kiinnikurominen on jo natiivissa istunnossa custom-merkintänä (`display: true`, `details`). Kupla tarvitsee sen viestin yhteyteen eikä erilliseksi merkinnäksi. |
| Elävien Pi:den raja | **On**: neljän raja ja `makeRoom`. Kirjoittaminen, joka ei mahdu, kertoo syyn eikä pysäytä kiireistä keskustelua. |

Tämä kierros ei tarvitse herätysvuoroa ilman ihmisen viestiä, eli ADR 0020:n
muutosta, jonka Jari jo hyväksyi. Se tulee tarpeelliseksi vasta, jos
*Herätä, kun valmistuu* -kytkin otetaan mukaan.

## Suositus

**Kortti (1).** Se on suora jatke sille, mistä Jari piti. Selostus on yhdessä
paikassa, ja se jää lankaan merkinnäksi, joten myöhempi lukija näkee, mitä
agentti tiesi herätessään. Lisäksi se vaatii vähiten uutta käytöstä. Aikajana
on paras selittäjä, mutta se tuo lankaan uudenlaisen rivin, joka kasvaa
pitkänä yönä. Liitteenä on rehellisin kuva tiedon kulusta, mutta se piilottaa
yksityiskohdat napautuksen taakse juuri silloin, kun ne pitäisi nähdä ennen
kirjoittamista.

Toteutusjärjestys, jos tämä valitaan:

1. Daemon tallentaa pysähtymisen ajan ja syyn keskustelun tilaan.
2. Daemon laskee ”agentille kertomattomat” ajot ja katkenneet prosessit
   samalla säännöllä kuin laajennus ja tuo ne snapshotiin. Kiinnikuromisviesti
   tehdään samasta lähteestä.
3. Kortti, lepotilan merkki sivupalkissa ja yläpalkissa sekä kortin
   jääminen merkinnäksi.
4. Esilämmitys ensimmäisestä merkistä `continue`-reitillä.

## Kysymykset Jarille

1. Mikä suunta: Kortti, Aikajana vai Liitteenä? Suositus on Kortti.
2. Riittääkö Taskfleetin yhteenveto selostukseksi, vai tarvitaanko myös
   linkki workerin keskusteluun? Merkit-palkki antaa linkin jo nyt.
3. Otetaanko kierroksen 1 *Herätä, kun valmistuu* -kytkin mukaan nyt,
   myöhemmin vai ei ollenkaan?
