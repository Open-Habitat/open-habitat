# Marraskuun päätöksistä kolme huomion arvoista

Tarkistettu 14.11.2026 suhteessa main-haaraan `175715e0`. Suositus:
**muuta synkronoinnin turvapoikkeusta, täsmennä tiedostojen palautuksen
varoitusta ja säilytä taustaprosessien nykyinen luokittelu.** Alla eivät ole
uudet päätökset vaan Jarin ratkaisua odottavat valinnat.

## 1. Synkronointi voi hetkeksi ohittaa suurten poistojen suojan

**Valinta:** Jos synkronointi pysähtyy siihen, että kansion kaikki tiedostot
muuttuivat, Habitat tarkistaa ensin, ettei kyseessä ole suuri poisto, ja
jatkaa sitten automaattisesti. Jatko ohittaa kuitenkin samalla myös
poistojen suojan. Tarkistus ja varsinainen synkronointi ovat erilliset ajot.

**Ihmiselle:** Pienen kansion kaikkien tiedostojen muokkaaminen ei enää
pysäytä synkronointia pysyvästi. Mutta jos suuri poisto tapahtuu tarkistuksen
ja seuraavan ajon välissä, se voi levitä toiselle puolelle ilman tavallista
pysäytystä. Palautuminen voi silloin vaatia pilvipalvelun roskakoria.
Tämä ei ole havaittu tiedostojen menetys vaan nykyisen ratkaisun tunnettu
aukko suojassa; sen yleisyyttä ei ole mitattu.

**Vaihtoehto:** Automaattinen jatko ohittaa vain kaikkien tiedostojen
muuttumista koskevan tarkistuksen, ei poistojen suojaa. Se vaatii muutoksen
käytettyyn synkronointityökaluun. Siihen asti pysähdys kerrotaan ihmiselle
ja poikkeuksellinen jatko pyydetään häneltä sen riskin kanssa.

**Suositus: muuta — automaattinen korjaus ei saa samalla poistaa toista
suojaa.** Pelkkä uusi vahvistuspainike ei sulje kilpailuikkunaa, mutta
siirtäisi poikkeuksen tietoiseksi valinnaksi siksi aikaa, kunnes rajatumpi
korjaus on mahdollinen. Kansion pieni tiedostomäärä ei yksin poista riskiä.

Tarkistus: `bisync-all-files-changed-abort/result.md`,
`internal/daemon/integrations/passes_linux.go`, `syncLoop` ja
`passObserver.forced`. Nykyinen `--dry-run` päättää erillisen `--force`-ajon.
Jarin 12.11. hyväksyntä koski vian korjaamista; tämä toteutuksen tarkempi
kompromissi kirjattiin vasta työn tulokseen. Microsoft-tiedostojen uusi
haku ei poista jo synkronoitujen kansioiden tätä käytöstä.

## 2. Tiedostojen palautus korvaa myös omat myöhemmät muokkauksesi

**Valinta:** Kokeellisen *Palaa tähän* -toiminnon tiedostovalinta palauttaa
seuratut tiedostot aikaisempaan sisältöön. Se ei erottele agentin jälkeen
tekemiäsi omia muokkauksia. Nykyinen sisältö otetaan ensin talteen, joten
palautuksen voi perua, mutta omien muutosten korvautumisesta ei ole erillistä
selitystä vahvistuksessa.

**Ihmiselle:** Kun haluat perua agentin väärän käänteen, myös sen jälkeen
itse korjaamasi teksti samassa tiedostossa voi kadota näkyvistä. Se ei ole
lopullisesti menetetty: tiedostopalautuksen voi perua tai korvattuun jatkoon
palata tiedostoineen. Nykyiset tekstit puhuvat silti agentin muutoksista,
vaikka palautettava sisältö voi olla myös sinun.

**Vaihtoehto:** Sama palautus ja sama peruminen säilyvät, mutta vahvistus
sanoo suoraan, että myös muiden myöhemmät muutokset näissä tiedostoissa
korvautuvat ja että nykyinen sisältö otetaan talteen. Ei uutta lisäkysymystä
eikä epävarmaa yritystä päätellä, kuka kirjoitti minkäkin rivin.

**Suositus: muuta selitys, säilytä palautustapa.** Tämä tekee seurauksen
ymmärrettäväksi muuttamatta jo hyväksyttyä toimintoa. Git-commitit jäävät
ennalleen kuten nytkin; sitä ei tarvitse päättää uudelleen.

Tarkistus: `rewind-conversation/result.md`, kohta 6;
`internal/daemon/rewind-extension.mjs`, `rewind`, `captureAll` ja
`restoreVersions`; `web/src/components/Rewind.tsx` ja
`web/src/text/rewind.ts`. Myöhempi `rewind-menu-and-commits` lisäsi
committeja koskevan selityksen, ei omien muokkausten selitystä.

## 3. Taustaprosessi lakkaa pitämästä keskustelua Käynnissä-listalla, kun olet jo jatkanut keskustelua

**Valinta:** Agentin aloittama, sille valmistumisestaan ilmoittava
prosessi pitää keskustelun Käynnissä-listalla. Jos kirjoitat sen jälkeen
uuden viestin ja agentti vastaa siihen, vanha prosessi tulkitaan taustalle
jätetyksi palveluksi. Se näkyy yhä, mutta ei yksin pidä keskustelua
Käynnissä-listalla. Työntekijän valmistumisen odottaminen on poikkeus:
se lasketaan edelleen työksi.

**Ihmiselle:** Agentin käynnistämä pitkäikäinen palvelin ei enää näytä
keskustelua loputtomasti keskeneräisenä. Sääntö voi erehtyä toiseen
suuntaan: jos kysyt pitkän käännöstyön aikana ”miten menee?”, agentin
vastauksen jälkeen keskustelu voi siirtyä Sinun vuoroosi, vaikka käännös
jatkuu. Prosessin merkki jää näkyviin eikä työ pysähdy.

**Vaihtoehto:** Agentti ilmoittaa erikseen, mikä prosessi on jatkuva
palvelu ja minkä valmistumista vielä odotetaan. Tällöin luokittelu riippuu
siitä, että agentti tekee merkinnän oikein.

**Suositus: säilytä — tavallinen palvelin ei saa vallata Käynnissä-listaa
pysyvästi, eikä tähän kannata vielä lisätä agentilta vaadittavaa merkintää.**
Nykyinen sääntö on karkea, mutta sen erehdys koskee listan paikkaa, ei
suoritusta. Arvioidaan uudelleen, jos tilannekysymykset käytännössä piilottavat
odotettua työtä.

Tarkistus: `rail-background-service-not-running/result.md`;
`internal/daemon/snapshot_linux.go`, `markWaitsBeforeTurn`-kutsu;
`web/src/components/agentPresentation.ts`, `waitedFor`;
`web/src/app/railNow.ts`. Myöhempi `rail-section-flicker-background`
säilytti säännön ja korjasi vain tilan väliaikaisen katoamisen.

## Mitä käytiin läpi ja miksi muu jäi pois

Lähtömallina olivat `decisions-review-31-10/item.md` ja sen tulos Jarin
14.11. ratkaisuineen. Perushaku tehtiin mainin kohdassa `53fee283` ja kattoi
1.–14.11. muuttuneet `issues/*/result.md`-polut, myös poistetut: 390 polkua.
Viimeisistä sisältöversioista löytyi aikarajan sisällä 275 päätösosiota
254 tulostiedostosta (luvut sisältävät edellisen katselmoinnin yhteenvedon,
jota ei laskettu uutena valintana). Mukana olivat myös suomenkieliset
otsikkovariantit ja saman tuloksen eri prototyyppikierrokset.
Lopputarkistuksessa luettiin lisäksi rinnakkain valmistuneet
`conversation-too-large-explained` ja `code-hygiene-review` tuloksineen
(main `175715e0`): ensimmäinen vahvistaa kokorajan jo poistuneen,
jälkimmäinen jättää siivousehdotukset omaan triageensa. Kumpikaan ei muuta
kolmea suositusta.

Lisäksi tarkastettiin aikavälin vanhemmat sisältöversiot, ei vain viimeistä
versiota: 11 erilaista aiempaa osiotekstiä, joista yksi oli edellisen
katselmoinnin yhteenveto. Ne olivat myöhempien tekstien korvaamia, eivät
kadonneita uusia päätöspyyntöjä. Ennen marraskuuta kirjoitettua tulosta ei
nostettu uudeksi vain siksi, että sen hakemisto poistettiin marraskuussa.
Historialliset lähteet löytyvät polulla `issues/<nimi>/result.md` tai
`issues/<nimi>/item.md` gitistä; yllä olevat nimet eivät ole rikkinäisiä
Markdown-linkkejä.

Kaikki löydetyt päätösosiot luettiin. Jatkoon harkitut valinnat tarkistettiin
nykykoodista ja myöhemmistä issuepäätöksistä. Pois rajattiin erityisesti:

- **Jarin jo ratkaisema:** kirjautumisen jälkeen myös muokattu odottava
  viesti lähtee itse (`ai-sign-in-expired-window`); todistetusti toimittamaton
  viesti lähetetään kerran uudelleen (`resend-proven-undelivered`);
  työtilojen automaattinen luottamus (`pi-project-trust-in-browser`,
  `launcher-trust-prompt`); levyn Oletukseen asettaa nykyisen oletusarvon,
  ei seuraavaa oletusmuutosta (`server-sections-norm`). Näitä ei avata
  uudelleen työntekijän toteutusmuistiinpanon vuoksi.
- **Myöhemmin korjattu:** yhden kirjautumisen lukko vaihtui
  palvelukohtaiseksi (`signin-during-first-sync`); raporttien otsikkoon
  perustuva yhdistely sai lähdepolun ja sivutuksen
  (`assets-chip-view-list-cap`); 20 MiB:n yhteisraja nousi 100 MiB:iin;
  liian suurten valintojen tarkistus siirtyi ennen latausta
  (`attachment-total-checked-late`); epävarman viestin kupla ja pysähtyneen
  agentin uudelleenlähetys muuttuivat (`large-send-stuck-uncertain`).
- **Vanhentunut väite:** `raise-to-your-turn-button` sanoo vastauksen
  katoavan Sinun vuorosi -perusteista daemonin uudelleenkäynnistyksessä.
  Nykyinen `restOf(nil)` muodostaa lepotilan, ja snapshot lukee myös
  lepäävän keskustelun viimeisen vastauksen historiasta. Tuota vanhaa
  rajoitusta ei siis nosteta nykyiseksi puutteeksi. Selaimen oma lukumerkki
  ja uuden selaimen aikaraja ovat edelleen olemassa; niiden synkronointi
  laitteiden välillä jäi tämän koonnin vähäisempiin valintoihin.
- **Jo oma jatkosuuntansa:** Microsoft-tiedostojen haku ja nouto eivät enää
  riipu kaikkien Teams-kirjastojen paikallisesta kopiosta
  (`m365-agent-file-search`, Jari 12.11.). Synkronoinnin kirjastorajat eivät
  siten yksin rajaa agentin hakua. Haettujen tiedostojen takaisinlähetys
  ei kuulu vielä hyväksyttyyn luku- ja hakuvaiheeseen. Vuoron muutosten
  tarkka lähde taas jätettiin nimenomaisesti myöhemmäksi
  (`turn-changes-summary`).
- **Edellisen katselmoinnin ratkaisut:** keskeytynyt työ pysyy näkyvissä ja
  myöhästynyt ohjaus menee uutena vuorona perille. Puuttuvan katsauksen
  korjaus on jo `background-work-reserved-slot`, mukaan lukien Jarin
  14.11. päätös omasta taustatyöpaikasta ja jonon kestämisestä restartin yli.
- **Ei toteutunut valinta:** hylättyjen prototyyppisuuntien painikkeet,
  tutkimusten ehdotukset ja tulevien rajapintojen luonnokset. Esimerkiksi
  avustajan suora Lopeta ja yhdistä -painike ei ole nykyinen toiminto;
  `named-workers-in-habitat` säilyttää pysäytyksen ja yhdistämisen
  pääagentin/Taskfleetin tehtävänä.
- **Vähäinen tai perusteltu toteutusrajaus:** välistykset, kuvakkeet,
  listojen taittuminen, työkaluvihjeet, testien odotusehdot, generointi,
  nimien esitys, lyhyet paikalliset odotukset ja palautettavan näkymätilan
  tallennuspaikka. Myös suurelle kuvalähetykselle annettu pitkä aikabudjetti
  jäi pois: se toteuttaa jo valitun 100 MiB:n rajan, ei uutta kokorajaa;
  sitä ei pidä tulkita lupaukseksi nopeasta lähetyksestä.

## Review and next step

Focused self-review: compared the three retained choices with their source
results, current implementation and later decisions; checked that recommendations
are not presented as approvals, that reversible restore is not described as
permanent loss, and that the sync race is not described as an observed incident.
No product changes, new issues, browser tests or deployment.

**Live check:** No new behavior to deploy. With disposable test files, Jari can
try *Palaa tähän* after making his own edit to a file the agent changed, and
check what the confirmation explains; he can also ask for a progress update
while a background job runs and inspect the rail. Do not provoke a mass-deletion
race on a real cloud library; item 1 is a decision from source evidence.

**Awaiting Jari:** verdicts for items 1–3. The issue stays open with
`preparation: pending`; any change issues are filed only after his verdicts.

## Decisions for later review

No additional product decision was made by this review. Items 1–3 above are
recommendations about existing choices, not authorization to implement them.
