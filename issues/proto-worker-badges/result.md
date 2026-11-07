# Kierros 1: yksi merkistö workerin tilalle ja odotukselle

Kierros: `design-system/prototypes/rounds/2026-11-07-workerimerkit/`
(`NOTES.md` kertoo nykyisen merkistön, suunnat ja tarkistuksen).
Akseli on merkistö: miten Workerit-siru, paneelin rivi ja sivupalkki
kertovat workerin oman tilan ja sen, odottaako agentti sitä.

- **Nyt**: tuotanto tänään. Odotettu = rengas ja keskus, ei odotettu = katkoviivarengas; muut tilat omilla merkeillään, sivupalkki ei erota odotusta.
- **1 Pallot**: workerin merkki on sivupalkin pallo (työ sykkii, vuorosi keltainen, valmis vihreä, kesken punainen salmiakki); odotettu saa ympärilleen kehän.
- **2 Kotelo**: merkki kertoo vain workerin tilan; odotetut kootaan sirussa, paneelissa ja sivupalkissa yhteen koteloon, jonka alussa on yläpalkin odotusmerkki.
- **3 Täyttö**: elävä worker on aina rengas (pyörii = työssä, keltainen = vuorosi, ohut = odottaa pääagenttia); täytetty keskus = agentti odottaa, tyhjä = ei.

## Nykytilan havainnot

Katkoviivarengas on väite (*kukaan ei odota*), joten tunnistamaton odotus
näkyy väärin; 7.11. tapaus on sivulla Odotus-valinnalla. Merkki näyttää
vain yhden asian (odotettu worker, joka odottaa sinua, menettää
odotusmerkin), työskentely ei näy merkissä, *odottaa pääagenttia* ja
*tila ei tiedossa* ovat sama harmaa rengas, *odottaa sinua* on sirussa
aksenttiväri mutta sivupalkissa keltainen, päättyneillä on neljä muotoa,
ja sivupalkin haaraikoni on sama odotetulle ja odottamattomalle.
Sivupalkissa sinua odottava worker näkyy vihreänä *valmis*-pallona.

## Host-tiedot

Suunnat 1 ja 2 käyttävät vain nykyisiä tietoja: ajon tila
(`working`/`idle`/`waiting_parent`/`unknown`, päättyneet), `preserved`,
pyynnön vaihe keskustelusta sekä agentin herättävän odotuksen
`run_ids` ja `wakes_agent` prosessirajapinnasta. Odottamaton worker on
niissä merkki ilman kehää tai koteloa, joten tunnistamaton odotus ei
tarvitse uutta tietoa eikä näytä väärää. Suunta 3 tarvitsee tiedon
*agentti odottaa, kohdetta ei saatu luettua* (harmaa keskus), koska tyhjä
keskus väittää, ettei kukaan odota; se voitaisiin johtaa nykyisestä
prosessitietueesta (`wakes_agent` ja tyhjä `run_ids`), mutta kuuluu
silloin daemonin sanottavaksi, ei selaimen päättelyksi. Sivupalkin workermerkki selviää snapshotin nykyisistä kentistä
(`waiting_on`, `spinoffs_working`, `spinoffs_idle`, `failure`).

## Suositus

**1 Pallot.** Yksi sanasto koko sovellukseen: sama pallo tarkoittaa samaa
sivupalkissa ja workerin rivillä, ja odotettu työskentelevä worker on
täsmälleen yläpalkin *Odottaa taustatyötä* -merkki. Odotus lisätään eikä
poissaolo väitä mitään, joten 7.11. kaltainen tunnistusvirhe ei enää
näytä valheelliselta. Kotelo kertoo selvimmin, ketä odotetaan, mutta vie
sirussa ja paneelissa tilaa ja toistaa odotuksen kahdesti rivillä
(lohko ja Lopeta odotus). Täyttö on pienin muutos, mutta 9 px:n renkaat
erottuvat toisistaan huonosti, ja tyhjä keskus on yhä väite.

## Kysymykset Jarille

1. Pallot (suositus), Kotelo vai Täyttö?
2. Saako *ei odoteta* olla merkin puuttumista (1 ja 2), vai pitääkö sen
   näkyä omana merkkinään kuten 26.10. Pisteet-päätöksessä, jotta
   unohtunut odotus näkyy suljetusta sirusta?
3. Käykö, että *odottaa sinua* on kaikkialla sivupalkin vuoroväri
   (keltainen) eikä sirun aksenttirengas?

## Ympäristö ja näyttö

Tehty Birchlla (`maintainer`), Chromium 1243 headless, Playwright
`web/node_modules`ista (päächeckoutin, sama lukko). Lab-palvelinta ei
käynnistetty: Nyt-näkymä on tuotannon komponentit muuttamattomina samalla
synteettisellä tilalla. `check.mjs`: 224 tarkistuspistettä, konsoli puhdas.
Kuvat `evidence/r1-<suunta>-<vaihe>-<leveys>-<teema>.avif`
(laitekerroin 2; vaiheet `0-oletus`, `0-lahi`, `1-tunnistamaton`,
puhelimessa myös `2-merkisto` ja `3-sivupalkki`).

```
node design-system/prototypes/rounds/2026-11-07-workerimerkit/build.mjs
open-habitat agent view offer --current --source design-system/prototypes/dist/workerimerkit/offline.html --title "Workerien merkit · kierros 1" --idempotency-key e8457854-9ae5-4686-b7bd-55631176c822 --json
```
