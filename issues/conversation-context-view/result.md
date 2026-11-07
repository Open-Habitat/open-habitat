# Tulos: kontekstinäkymä ja tiivistys (kokeellinen)

Toteutus noudattaa prototyypin `proto-conversation-context-view` kierroksen 3
suuntaa 2 (*Lista ja tiivistys*) Jarin päätöksen mukaan ilman Avaa-saraketta:
tiedoston nimi avaa tiedoston. Kokeellinen ominaisuus *Kontekstinäkymä ja
tiivistys* korvaa Konteksti-sivulla Pi:n tekniset osiot (osat, tiivistykset,
vuorot); pois päältä sivu on ennallaan.

## Mistä tieto tulee

- **Lista** tulee daemonin nykyisestä kontekstiapurista
  (`internal/daemon/context_detail_helper.mjs`), joka lukee avoimen
  keskustelun Pi-session Pi:n omilla funktioilla. Uusi rajattu lista `items`
  (`contracts/v1/context-detail.schema.json`): yksi rivi tiedostoa, komentoa
  tai työkalun kohdetta kohden aktiivisella haaralla, toimet aikaleimoineen,
  Pi:n arvio siitä, mitä malli näkee nyt sanasta sanaan, ja mitä seuraava
  tiivistys jättäisi. Tiedostot Pi:n omalla säännöllä
  (`extractFileOpsFromMessage`: read/write/edit, myös codemode-skriptien
  kutsut) ja tunnetuista dokumenttien lukukomennoista (`docx2txt`,
  `pdftotext`, `xlsx2csv`). Uutta tietovarastoa ei ole.
- **Vahvistuksen kellonajat ja koko jälkeen** tulevat Pi:n
  `prepareCompaction`ista henkilön asetuksilla, samasta kohdasta kuin sivun
  aiempi ennuste (`next_compaction.from_at`, `through_at`, `kept_from_at`,
  `estimated_tokens_after`).
- **Tiivistys** on Pi:n RPC `compact` ohjeella (`customInstructions`).
  Daemonin uusi reitti `POST /api/v1/conversations/{id}/compact`
  (`internal/daemon/compaction_linux.go`, `contracts/v1/compaction.schema.json`)
  lähettää sen henkilön omalle Pi-prosessille ja palauttaa Pi:n vastauksen.
  Pi:n kieltäytymiset näkyvät sellaisinaan: *juuri tiivistetty* (Pi:n
  `Already compacted`) ja *ei vielä tiivistettävää* (`Nothing to compact`).
  Heti tiivistyksen jälkeen sivu näyttää tilarivin napin sijaan
  (`just_compacted`: haaran viimeinen merkintä on tiivistys, Pi:n oma ehto).

Valtuudet eivät muuttuneet: gateway välittää reitin kuten muutkin
keskustelun ohjaukset (CSRF), daemon toimii henkilön omana käyttäjänä.

## Tarkistus

- Daemon: `TestCompactThroughPinnedPi` ajaa tiivistyksen kiinnitetyllä Pi
  1.3.0:lla synteettistä mallia vasten: kieltäytyminen tyhjässä
  keskustelussa, tiivistys ohjeella (ohje päätyy Pi:n yhteenvetopyyntöön,
  tiivistys sessiotiedostoon), kieltäytyminen heti perään ja kanavan
  käyttö sen jälkeen. `TestContextDetailItems` tarkistaa listan Pi:n
  omasta lukemasta (sama tiedosto suhteellisena ja absoluuttisena polkuna
  yhtenä rivinä, `edit`in rivimäärät patchista, kotihakemiston polku,
  dokumentin lukukomento, kellonajat ja koko jälkeen henkilön asetuksella).
  `TestCompactRefusals`: viesti tiivistyksen aikana pidätetään Pi:lle.
- Gateway: reitti vaatii CSRF:n ja tarkan muodon.
- Selain: `web/tests/conversation-context-view.spec.ts` oikeaa gatewayta ja
  daemonia vasten synteettisellä Pi:llä (lista, Vain tiedostot, tiedoston
  avaus editoriin, vahvistus kellonajoin, tiivistys, tilarivi, puhelin,
  axe). Komponenttitestit `ContextView.test.tsx`, tarina
  *Production/Context view*.

## Päätökset myöhempää katselmointia varten

- **Tiivistys odottaa Pi:n vastausta enintään kymmenen minuuttia, ja
  gatewayn katto reitille on 11 minuuttia.** Pi vastaa vasta, kun yhteenveto
  on kirjoitettu. Vaihtoehto oli vastata heti ja seurata tulosta erikseen,
  mutta silloin Pi:n kieltäytyminen tai epäonnistuminen ei näkyisi
  painalluksen tuloksena. Sivulta poistuminen ei keskeytä Pi:tä.
- **Viesti, joka lähetetään tiivistyksen aikana, pidätetään ja lähtee, kun Pi
  on valmis.** Pi kieltäytyy kehotteesta tiivistyksen aikana; ilman
  pidätystä viesti palaisi hylättynä. Toinen tiivistys, Palaa tähän ja
  automaattinen recap odottavat samoin.
- **Pi:n epäonnistuminen on `409 compaction_failed`, ei 5xx.** Pi yritti
  eikä mitään muuttunut, joten selain voi sanoa varmasti, että keskustelu on
  ennallaan. Pi:n virheteksti jää palvelulokiin (se voi sisältää henkilön
  sisältöä).
- **Lepäävä keskustelu herätetään ennen tiivistystä**, kuten viesti tai
  Palaa tähän herättäisi. Vaihtoehto oli tarjota nappia vain käynnissä
  olevalle keskustelulle, mutta henkilö ei tiedä, onko Pi käynnissä.
- **Tiedoston nimi on linkki samoin ehdoin kuin keskustelun tiedostolinkki**
  (`FileLinkContext`, `parseFileRef`): työtilan suhteellinen polku avautuu
  editoriin; kotihakemiston tai muun absoluuttisen polun tiedosto on tekstiä.
  Puhelimella linkki toimii kuten keskustelussa.
- **Ennuste koosta tiivistyksen jälkeen** on Pi:n arvio säilyvistä
  merkinnöistä, ohjeista ja työkaluista sekä edellisen yhteenvedon koosta
  uuden yhteenvedon sijaisena; uuden yhteenvedon kokoa ei voi tietää
  etukäteen. Sivu sanoo sen noin-lukuna.
- **Rivien sisältö**: kirjoitus näyttää kirjoitettujen rivien määrän,
  muokkaus +/− Pi:n patchista, ja kaikki toimet ryhmitellään verbin mukaan
  (*luki klo 10.02 ja 10.20*). Aiemman päivän toimissa on päivämäärä.
  Muut työkalut kuin tiedostot ja komennot näkyvät *Työkalun tulosteena*
  työkalun nimellä ja kohteella.
- **Lista on rajattu**: näkyvät rivit koon mukaan enintään 200 ja vain
  yhteenvedossa olevat uusimmasta enintään 100; ylimenevä määrä kerrotaan.
- **Kuvat** näkyvät omana rivinään *Kuvat*, kun niitä on kontekstissa.
  Prototyypissä niitä ei ollut.
- **Kortti pitää Pi:n tekniset luvut pois**, kuten kierros 3 päätti; ne
  saa takaisin kytkemällä ominaisuuden pois.
