# Tulos: arkistoinnin ilmoitus ylhäällä, ilme (kierros 2)

Jari valitsi kierroksen 1 suunnan **Ylhäällä** (28.10.2026). Kierros 2 riffaa
sen ilmettä. Prototyyppi on `prototypes/archive-notice-2/index.html`, ja se on
rakennettu kierroksesta
`design-system/prototypes/rounds/2026-10-28-arkistoinnin-ilmoitus-2/`. Se on
yksi offline-HTML prototyyppikirjastosta, eikä siinä ole tuotantokomponenttien
bundlea. Opas Jarille on `prototypes/archive-notice-2/NOTES.md`, ja kuvat ovat
`prototypes/archive-notice-2/evidence/`-hakemistossa laitteen skaalauksella 2.
Kierros 1 on vertailua varten tallessa hakemistossa `prototypes/archive-notice/`.

`verify.mjs` käy läpi kaikki kolme ilmettä työpöydällä (1440 px) ja puhelimessa
(390 px), vaaleana ja tummana. Jokaisessa yhdistelmässä se tarkistaa, että:

- arkistoinnin jälkeen kuittaus on yläpalkin alla ja fokus jää muualle;
- seuraavassa keskustelussa kenttä, Lähetä-painike ja uusin vastaus jäävät
  vapaiksi eikä vastaus leikkaudu, myöskään Otsakerivissä, joka siirtää lankaa;
- fokus pysyy kentässä ja Esc kentässä ei sulje kuittausta;
- kolme ilmoitusta pinoutuu ilmeen omalla tavalla: Kortin pakassa luku on +2 ja
  takana odottavan kello on pysähdyksissä, Nauhassa näkyy kolme riviä, ja
  Otsakerivissä näkyy +2, joka avaa muut;
- pino ei peitä kenttää edes avattuna, ja Palauta toimii pinosta;
- kesken jäänyt poisto pysyy auki ilman kelloa;
- kukin ilme poistuu itsestään elinaikansa jälkeen eikä ennen (8, 10 ja 20 s);
- valitsin vastaa kirjaston määrittelyä (`picker-check.mjs`), ja konsoli ja verkko
  pysyvät puhtaina.

Kirjaston `check.mjs`ää ei ajettu, koska se hakee Playwrightin tämän worktreen
`web/node_modules`ista, jota ei ole. `verify.mjs` tekee samat tarkistukset ja
lisäksi kierroksen omat.

## Akseli: kuittauksen ilme ja paino yläpalkin alla

| # | Ilme | Elinaika | Pinoaminen | Milloin se on oikea | Mitä se maksaa |
|---|---|---|---|---|---|
| 1 | **Kortti**: tuotannon tumma pilleri kompaktina korttina, kelluu keskellä yläpalkin alla | 8 s | Pakka: uusin näkyy, takana pilkistää kaksi reunaa ja +N. Odottavien kellot ovat pysähdyksissä. Osoitin tai fokus levittää pakan. | Kun halutaan pienin muutos tuotantoon ja huomiota herättävä kuittaus | Peittää sen, mikä sivun yläreunassa on. Työtilasivulla, jolle arkistointi vie, se on sivun otsikko (puhelimessa kokonaan). Pakassa kumoaminen voi jäädä myöhemmän ilmoituksen taakse. |
| 2 | **Nauha**: ohut koko sarakkeen levyinen harmaa nauha kiinni yläpalkin alareunassa, kelluu langan päällä | 10 s | Jokainen ilmoitus on oma rivinsä, ja kaikilla on oma kellonsa. Mitään ei jää piiloon. | Kun useita ilmoituksia tulee usein ja jokaisen kumoamisen pitää näkyä heti | Peittää koko sarakkeen yläreunan, työtilasivulla otsikon ja *Uusi keskustelu* -painikkeen. Kolme riviä vie puhelimessa noin 120 px. |
| 3 | **Otsakerivi**: hiljainen rivi yläpalkin sisällä, ilman taustaa ja varjoa | 20 s | Uusin rivi näkyy, ja +N avaa muut. Avaamattomien kellot ovat pysähdyksissä. | Kun mikään ei saa peittää mitään millään sivulla | Lanka siirtyy rivin verran alas. Uusin vastaus pysyy paikallaan, koska lanka on ankkuroitu alareunaan. Kuittaus on hiljaisin, joten sen voi ohittaa katseella. Jokainen sivun yläpalkki tarvitsee paikan rivikseen. |

Kaikille ilmeille yhteistä: kuittaus ei ota fokusta, Esc sulkee sen vain sen
sisältä, ja osoitin tai fokus ilmoitusalueella pysäyttää kellot. Kesken oleva
tai epäonnistunut toiminto pitää kuittauksen auki. Saman lajin uusi ilmoitus
korvaa vanhan. Pitkä tai virheen sisältävä teksti rivittyy, ja kapealla
näytöllä sen toiminnot siirtyvät omalle rivilleen.

## Saman lajin ilmoitukset koodissa

Kaikki nämä käyttävät nyt `ArchiveNotice`a (`web/src/components/ArchiveNotice.tsx`),
jonka paikka on `.ah-archive-notice` (`web/src/components/components.css`,
`position: fixed; bottom: 20px`). Valittu ilme koskee niitä kaikkia:

| Ilmoitus | Missä | Huomio |
|---|---|---|
| Keskustelun arkistointi, *Arkistoitu … Palauta* | `web/src/app/App.tsx`, `archiveNotice` `overlays`-propissa | Kiireinen, kunnes host vahvistaa. Palautus navigoi kohtaan `archiveNotice.route`. |
| Työtilan roskakori: *Siirretty roskakoriin*, *Ei poistettu kokonaan:*, *Poistettu pysyvästi* | `web/src/app/TrashNotice.tsx` (App.tsx `trashOutcome`) | Sisältää linkin *Roskakori*. Osittainen tai korvattu tulos jää auki (`problem`). |
| Tilanvaihto: *Yksi työtila jäljellä …* | App.tsx `modeNotice`, `wrap` | Ei kumottavaa. Yhdistyy roskakorin ilmoitukseen, kun molemmat syntyvät samasta poistosta. |
| Työtilan arkistointi tai piilotus, *… Kumoa* | `web/src/app/WorkspacePage.tsx` (`hideNotice`) | Piirretään sivun sisällä eikä `#overlays`-kerroksessa, mutta se on sama kiinteä elementti. |

Samaa lajia, mutta eri komponentti: päätenäkymän `ToastRegion`
(`web/src/components/Status.tsx`, `.ah-toast`, oikea alakulma, 4 s, ei
toimintoja; `web/src/app/BrowserShell.tsx`). Se on kelluva ja ohimenevä ilmoitus,
joten ehdotan sille samaa ilmettä ja paikkaa (ks. päätökset). Paikallaan pysyvät
tilarivit (`PendingNote`, kentän `ah-composer-notice`, lomakkeiden
`role="alert"`-rivit) eivät ole kelluvia ilmoituksia, joten ne jäävät ennalleen.

## Host-tiedot, joita ilmeet tarvitsevat

Mikään ilme ei tarvitse daemonin, gatewayn tai provisionin muutosta, eikä uutta
tietoa hostilta. Kaikki on selaimen rakennetta.

| Tieto tai rakenne | Onko olemassa |
|---|---|
| Ilmoitus säilyy navigoinnin yli | **On**: `#overlays` (`web/src/components/Navigation.tsx:240`) on sisältöalueen ulkopuolella, ja siksi kuittaus seuraa työtilasivulta keskusteluun. |
| Arkistoinnin vahvistuksen odotus ja kumoaminen | **On**: App.tsx `changeArchive` sekä `busy` agentin `archive`-tilasta. |
| Elinaika ja tauko osoittimen tai fokuksen ajaksi | **On, yhdelle ilmoitukselle**: `ArchiveNotice` (8 s, `remaining`-ref). Ilmekohtainen aika ja koko ilmoitusalueen yhteinen tauko puuttuvat. Ilmoitusalueen pitää tietää kaikki näkyvät ilmoitukset. Nyt ne ovat erillisiä elementtejä App.tsx:ssä ja WorkspacePage.tsx:ssä. |
| Pino ja korvaaminen lajin mukaan | **Ei ole.** Ilmoitukset piirtyvät nyt samaan kohtaan päällekkäin. Tarvitaan yksi ilmoitusalue (lista ja laji per ilmoitus), jonka kautta kaikki neljä käyttäjää kulkevat. Kaikki ilmeet tarvitsevat tämän. |
| Esc vain ilmoituksen sisältä | **Ei ole**: `ArchiveNotice` kuuntelee Esciä `document`-tasolla. Rajaus on pieni muutos. |
| Yläpalkin alareuna (Kortti, Nauha) | **Osittain.** Keskustelussa yläpalkin korkeus on `--ah-header-height` (`web/src/components/ConversationFrame.tsx`), mutta vain kehyksen sisällä. Työtilasivulla otsake on `.ah-workspace-page-head` (`WorkspacePage.tsx`), joka on sivun sisältöä. `#overlays`-kerros pitää ankkuroida sisältösarakkeen yläreunaan, ja sivupalkin leveys on huomioitava. |
| Paikka yläpalkin sisällä (Otsakerivi) | **Ei ole.** Jokainen sivun yläpalkki (`.ah-agent-header`, työtilasivun otsake, asetus- ja etusivu) tarvitsee paikan ilmoitusalueen riville, esimerkiksi portaalikohteen. Keskustelussa `--ah-header-height` mittaa jo yläpalkin, ja `composer.css` käyttää sitä, joten kasvava yläpalkki näkyy niissä laskuissa ilman uutta mittausta. Lanka pitää pitää alareunaan ankkuroituna, kun yläpalkki kasvaa. |
| Näppäimistöjärjestys | **Osittain.** `#overlays` on DOM:n lopussa, joten Kortin ja Nauhan Palauta tulee Tab-järjestyksessä viimeisenä. Otsakerivi on DOM:ssa yläpalkin jälkeen, joten se tulee Tab-järjestyksessä heti otsikon jälkeen. |

## Suositus

**Otsakerivi (3).** Ilmeistä vain se ratkaisee Jarin ongelman kokonaan: se ei
peitä mitään millään sivulla. Kortti ja Nauha siirtävät peittämisen kentästä
sivun yläreunaan, ja työtilasivulla, jolle arkistointi juuri vie, siellä on
sivun otsikko ja *Uusi keskustelu* -painike. Otsakerivi ei myöskään tarvitse
elinajan viivaa eikä varjoa. Siksi sen 20 s elinaika on mahdollinen, ja
kumoamiselle jää aikaa, vaikka katse olisi kentässä. Pinossa kumoaminen ei
koskaan katoa kokonaan, koska +N on samalla rivillä.

Otsakerivin hinta on toteutuksessa: jokainen yläpalkki tarvitsee paikan
rivilleen. Rivin hiljaisuus on myös riski. Jos Jari kokee rivin liian
huomaamattomaksi, toinen vaihtoehto on Kortti. Se on lähimpänä tuotantoa ja
pienin muutos (CSS ja pakka). Sen hinta on työtilasivun otsikon peittyminen 8
sekunniksi.

Toteutus, jos Otsakerivi valitaan:

1. Yksi ilmoitusalue (konteksti tai tila App.tsx:ssä), jonka kautta arkistointi,
   roskakori, tilanvaihto ja työtilan arkistointi kulkevat. Saman lajin uusi
   korvaa vanhan.
2. Portaalikohde jokaisen sivun yläpalkkiin. `ArchiveNotice`n tilalle tulee rivi
   ja +N-painike. Kesken tai virheessä oleva ilmoitus pysyy auki.
3. Esc rajataan ilmoitukseen, elinaika on 20 s, ja tauko koskee koko
   ilmoitusaluetta.
4. Myöhemmin päätteen `ToastRegion` siirretään samaan alueeseen.

## Päätökset myöhempää tarkistusta varten

- **Elinaika riippuu ilmeestä (8, 10, 20 s).** Vaihtoehto oli 8 s kaikille,
  kuten tuotannossa. Valitsin ilmekohtaiset ajat, koska peittävän kortin pitää
  väistyä nopeasti, mutta mitään peittämätön rivi voi antaa kumoamiselle enemmän
  aikaa.
- **Pinossa odottavien kellot ovat pysähdyksissä (Kortti ja Otsakerivi).**
  Vaihtoehto on, että kaikki kellot käyvät. Valitsin pysäytyksen, koska muuten
  myöhempi ilmoitus kuluttaisi piilossa olevan kumoamisajan.
- **Osoitin tai fokus ilmoitusalueella pysäyttää kaikkien kellot**, ei vain sen
  ilmoituksen, jonka päällä osoitin on. Tuotannossa tauko koskee yhtä
  ilmoitusta. Pakkaa levitettäessä yhden ilmoituksen tauko jättäisi muut
  katoamaan käden alta.
- **Uusin ilmoitus on lähimpänä yläpalkkia.** Vaihtoehto on aikajärjestys
  ylhäältä alas. Valitsin tämän, koska juuri tehty toiminto on se, joka
  todennäköisimmin kumotaan.
- **Virheen sisältävä ilmoitus rivittyy ja jää auki ilman viivaa.** Tuotannossa
  `problem` pitää ilmoituksen auki mutta katkaisee tekstin. Puhelimessa
  katkaistu virhe ei kerro mitään.
- **Päätteen `ToastRegion` saa saman ilmeen ja paikan** (ehdotus, ei osa tätä
  kierrosta). Vaihtoehto on jättää se oikeaan alakulmaan. Kaksi kelluvaa
  ilmoitusjärjestelmää näyttäisivät samanlaisen asian kahdessa paikassa.
- **Esc rajataan ilmoituksen sisälle**, kuten kierroksessa 1. Jari ei ole vielä
  vastannut tähän (kierroksen 1 kysymys 3).
- **Työtilasivu on vedoksessa tiivistetty.** Tuotannon `WorkspacePage` sisältää
  enemmän, mutta otsikon peittyminen näkyy jo tiivistetyssä versiossa.

## Kysymykset Jarille

1. Mikä ilme: Kortti, Nauha vai Otsakerivi? Suositus on Otsakerivi.
2. Jos Otsakerivi: huomaatko sen kirjoittaessasi, vai onko se liian hiljainen?
3. Saako Esc sulkea ilmoituksen mistä tahansa, vai vain silloin, kun fokus on
   ilmoituksessa? (Avoinna kierroksesta 1.)
