# Tulos

Tuotannon sivupalkki on nyt hyväksytty Nyt + Aakkoset -malli
(`proto-sidebar-content`, kierrokset 1–2):

- **Sinun vuorosi**: kysymys tai lukematon vastaus, kaikista näkyvistä
  työtiloista. Kysymyksellä on oma ?-merkki.
- **Käynnissä**: muut elävät keskustelut – työskentelee, odottaa viestiä,
  odottaa taustatyötä (prosessi tai worker, ja mitä odotetaan). Rivi on
  kaksirivinen: otsikko, sitten työtila · tila · odotettu.
- **Työtilat** aakkosjärjestyksessä (`localeCompare(…, "fi")`), suodatin,
  työtilakohtainen vihje (huomiomäärä, työskentelypiste, taustatyön rengas,
  ○) ja arkistoidut taitettuna lopussa; suodatin avaa arkistoidut, kun niistä
  löytyy osuma. Työtilan alla ei ole keskusteluja; rivi vie työtilan sivulle.
- **Kapea kaista**: Nyt-rivit työtilan kirjaimina ja tilamerkkeinä, sitten
  kansiopainike, joka levittää palkin.
- **Puhelin**: laatikossa sama sisältö; valikkopainikkeessa on Sinun vuorosi
  -määrä.

Logiikka on `web/src/app/railNow.ts` (yksikkötestit `railNow.test.ts`),
komponentit `NowSections` ja `WorkspaceNavRow` (`Navigation.tsx`).
`docs/product.md` "Työhön palaaminen ja navigointi" on päivitetty.

## Todisteet

`evidence/` (laitteen skaalaus 2, vaalea ja tumma): työpöydän etusivu,
työtilasivu, suodatin arkistoidun osumalla, kapea kaista, puhelimen
työkalupalkki ja laatikko (myös vieritettynä työtiloihin). Kuvat on otettu
synteettisestä labista komennolla
`node web/lab/capture-sidebar-now-aakkoset.mjs`; labin päättyneet
terminaalikeskustelut saavat elävät tilat ja keksityt lisätyötilat
snapshotin langalla (sama sauma kuin `lab-workspace-page.spec.ts`),
lukematon vastaus on aito (toinen välilehti lähettää viestin).

Selaintestit: uusi `rail-now.spec.ts` (aakkosjärjestys, suodatin löytää
arkistoidun, elävä keskustelu Käynnissä-lohkossa eikä työtilan alla, kapea
kaista ja levitys, axe), uudistettu `rail-unread.spec.ts` (lukemattomat
Sinun vuorosi -lohkossa, avaus näppäimistöllä siirtää Käynnissä-lohkoon,
puhelimen merkki). Testit, jotka avasivat päättyneen terminaalikeskustelun
sivupalkista, avaavat sen nyt etusivun kortista.

## Decisions for later review

1. **Viestiä odottava elävä keskustelu on Käynnissä, ei Sinun vuorosi**, kuten
   prototyypissä. Palkki kutsuu sitä "Odottaa viestiä", vaikka muualla
   (kortit, yläpalkki) sama tila on "Odottaa sinua". Muuten jokainen auki
   oleva keskustelu olisi Sinun vuorosi -lohkossa.
2. **Worker on omana rivinään** (Jari, proto-worker-view: ei sisennystä);
   vanhemman rivin worker-merkki säilyy.
3. **Agentti, jonka worker työskentelee vaikka agentin oma ajo on päättynyt**
   (esim. daemonin uudelleenkäynnistyksen jälkeen), pysyy Käynnissä-lohkossa
   tilalla "Worker työskentelee". Kun worker valmistuu, rivi poistuu.
4. **Arkistoitujen työtilojen keskustelut eivät näy Nyt-lohkoissa**, kuten
   ennenkään sivupalkissa tai etusivulla.
5. **Työtilasivua ei muutettu** prototyypin Sinun vuorosi / Käynnissä /
   Aiemmat -ryhmittelyyn. Nykyinen sivu (Avoimet-kortit huomion mukaan ja
   Valmiit taitettuna) näyttää jo kaikki työtilan keskustelut. Ryhmittely
   on mahdollinen jatkoissue.
6. **Päättynyt terminaalikeskustelu ei ole sivupalkissa lainkaan**; sille
   pääsee etusivulta tai työtilan sivulta.
7. **"1 uusi vastaus" -linkki ja Etusivun käynnissä-merkki poistettiin**:
   Sinun vuorosi ja Käynnissä korvaavat ne.
8. **Ryhmien sisällä luettelojärjestys** (ei aktiivisuusjärjestys): host ei
   tiedä viimeisintä tapahtumaa, ja paikallaan pysyvään riviin on helpompi
   osua.
9. **Työtilan nimet pysyvät tuotannon tasalevyisessä fontissa** (prototyypissä
   tavallinen fontti), ja rivin piilotettu +-painike (uusi keskustelu) säilyi.
10. **Työtilan rivi on valittuna myös, kun sen keskustelu on auki**, jotta
    paikka näkyy palkissa, vaikka keskustelu ei ole Nyt-lohkoissa.
11. `design-system/` (vedokset ja design.md) kuvaa vielä vanhan
    sivupalkin; seuraava design-paketti tuo uuden designerille.
