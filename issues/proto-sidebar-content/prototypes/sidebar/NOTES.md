# Sivupalkin sisältö · Kierros 1

Nykyinen sivupalkki on `~/src`-työtilojen lista, ja keskustelut ovat
työtilojen alla (`web/src/components/Navigation.tsx`). Etusivu on
paluunäkymä: ensin Odottaa sinua, sitten Käynnissä, sitten muut keskustelut.
Tässä kierroksessa kokeillaan, mitä varten sivupalkki on. Ulkoasu ei ole
kierroksen aihe: värit, fontit ja mitat tulevat `design-system/tokens/`-
tiedostoista, ja tilamerkit ovat samat kuin tuotannossa (● uusi vastaus,
sykkivä piste = työskentelee, ○ odottaa, ✓ valmis), kysymykselle on lisäksi
merkki ?. Nimet, polut ja tekstit ovat keksittyjä.

Synteettisessä datassa on kahdeksan työtilaa. Niistä neljässä on tällä
hetkellä työtä:

- `kirjasto-api`: agentti odottaa spinoffiaan. Spinoff työskentelee
  worktreessä `wt/muistutus-pohja`, ja toinen spinoff on jo yhdistetty.
- `kotisivu`: agentti kysyy sinulta WebP vai AVIF, ja toinen agentti odottaa
  `npm test` -prosessia.
- `budjetti-2027`: valmistunut raportti, jossa on lukematon vastaus.
- `mokki-varaukset`: agentti odottaa viestiä, ja siihen liittyy ilmoitus.

Lopuissa neljässä ei ole käynnissä mitään. Yhdessä niistä, `opinnaytetyo`,
ei ole keskusteluja eikä Git-repoa.

## Ideat ennen rakentamista

1. **Nyt.** Sivupalkin yläosassa on se, mikä vaatii sinua, ja sen alla se,
   mikä on käynnissä. Työtilat ovat alempana tiiviinä listana.
2. **Saapuneet.** Sivupalkki on postilaatikko. Rivi on tapahtuma
   (kysymys, vastaus, yhdistäminen tai ilmoitus) eikä keskustelu, ja sen voi
   kuitata pois.
3. **Työpuu.** Agentit näytetään puuna: kuka käynnisti kenet, missä
   worktreessä ja missä Taskfleet-ajossa. Työtiloja näkyy vain niiltä osin,
   kuin niissä on työtä.
4. **Työtila kerrallaan.** Sivupalkin yläreunassa on työtilan vaihtaja, ja
   alla on yhden työtilan koko sisältö: keskustelut, worktreet, Git,
   tiedostot ja terminaali. Muiden työtilojen huomio näkyy merkkinä.
5. **Kiinnitetyt.** Ylimpänä on haku, sen alla lyhyt Nyt-lista ja
   kiinnitetyt työtilat ja keskustelut. Kaikki työtilat ovat yhden avauksen
   takana.
6. *Aikajärjestys.* Keskustelut kaikista työtiloista viimeisimmän
   tapahtuman mukaan, kuten viestisovelluksessa. **Ei rakennettu.** Host ei
   tiedä keskustelun viimeistä tapahtumaa eikä avausaikaa (vain
   `started_at`), ja nykyinen paluunäkymäkin sanoo, ettei järjestystä
   keksitä. Ilman tätä tietoa idea on sama kuin Nyt.
7. *Ei sivupalkkia.* Etusivu on ainoa keskus, ja muualle siirrytään
   komentopaletilla (Ctrl+K). **Ei rakennettu.** Puhelimessa ja kosketuksella
   paletti on heikko, ja kaistan pikanäkymä katoaisi. Työtila kerrallaan
   -idean kapeassa muodossa on tämän idean ”ikonikaista”.
8. *Työtilakuvakkeiden kaista (Discord/Slack).* Kapea sarake
   työtilakuvakkeita, ja valitun työtilan sisältö on sen vieressä. Tämä on
   sisällytetty Työtila kerrallaan -idean kapeaan muotoon.

Ideat 1–5 rakennettiin, koska ne vastaavat eri kysymyksiin:
1 kysyy, mikä on käynnissä, 2 mitä minun pitää tehdä, 3 miten työ haarautuu,
4 missä olen ja 5 mihin palaan usein.

## Viisi muunnelmaa

| # | Sivupalkki | Ei-aktiivinen työtila | Kapea kaista | Puhelin | Etusivu | Vahvuus | Hinta |
|---|---|---|---|---|---|---|---|
| 1 Nyt | Sinun vuorosi (kysymys, uusi vastaus) → Käynnissä (spinoff sisennettynä vanhempansa alle, worktree näkyy) → Työtilat-lista, jossa on suodatin ja huomio- ja käynnissä-määrät | Aina näkyvissä listan lopussa, ja suodatin löytää sen | Huomioagentit, käynnissä olevat agentit ja kuvake, joka levittää työtilalistan | Laatikossa sama sisältö. Valikkopainikkeessa on merkki, jos jokin odottaa sinua | Muuttuu työtilojen yleiskuvaksi (kortit, Git-tila), koska elävä lista on jo palkissa | Tärkein ylimpänä ilman avaamista. Kaikki tieto on jo olemassa. Lähin nykyistä, joten pieni muutos | Kun käynnissä on paljon työtä, lista kasvaa ja työtilat valuvat alas |
| 2 Saapuneet | Välilehdet Saapuneet / Taustalla / Työtilat. Saapuneissa on kortteja: Kysyy, Uusi vastaus, Ilmoitus, Yhdistetty, ja kunkin voi kuitata ✓ | Työtilat-välilehti | Kolme kuvaketta määrineen | Laatikossa välilehdet | Pysyy paluunäkymänä (käynnissä olevat ja viimeisimmät) | Kertoo mitä tehdä eikä vain missä jotain on. Tyhjä laatikko on selvä ”kaikki hoidettu” | Kuittaus on uusi käsite. Lukemattomuus on nyt välilehden muistissa: uudelleenlataus tai toinen laite ei tiedä kuittauksia. Yhdistämis- ja ilmoitustapahtumia ei kerätä yhteen listaan |
| 3 Työpuu | Työtilan nimi on pieni otsikko, ja sen alla on juurikeskustelu ja spinoffit puuna. Haarassa näkyy worktree, +ahead/yhdistetty ja Taskfleet-ajon tila. Muut työtilat ovat taitettuna | ”Muut työtilat” levitetään auki, ja siinä on suodatin | Juuriagentit merkkeineen | Laatikossa puu | Ennallaan | Näyttää spinoffien ja worktreeiden rakenteen, josta paluunäkymä ei kerro mitään. Tieto on olemassa | Tiheä, eikä se korosta sinua odottavaa yli muun. Hyödyllisin, kun käytetään Taskfleetiä |
| 4 Työtila kerrallaan | Vaihtaja (merkki: muualla odottaa 2) → työtilan keskustelut, Uusi keskustelu, Valmiit → Git, worktreet, Tiedostot, Terminaali → Muualla odottaa | Vaihtajan haku | Työtilakuvakkeiden sarake (Discord-tyyli), jossa on huomiomerkit | Laatikossa vaihtaja ja sisältö | Ainoa näkymä kaikkien työtilojen yli: Odottaa sinua ja työtilakortit | Selkein, kun työskentelee yhdessä repossa pitkään. Worktreet ja Git ovat kaistassa | Kahden työtilan välillä vaihtaminen vaatii aina vaihtajan. Agenttien seuraaminen ristiin heikkenee, ja se on juuri se, mistä Jari puhui |
| 5 Kiinnitetyt | Haku (työtilat ja keskustelujen otsikot) → Nyt (enintään 5) → Kiinnitetyt ★ → Kaikki työtilat | Haku tai Kaikki työtilat. Kiinnitettynä myös aina näkyvissä (`opinnaytetyo`) | Nyt-merkit, kiinnitettyjen kirjaimet ja haku | Laatikossa sama | Paluunäkymä ja kaikki työtilat | Ihminen päättää, mikä on lähellä. Toimii myös hiljaiselle työtilalle | Kiinnitys on uusi tallennettava tieto. Sitä ei ole hostilla, ja se olisi uusi tietovarasto. Nyt-listan katto piilottaa työtä |

## Mitä tietoja kukin tarvitsee

Tieto, joka on jo olemassa (`contracts/v1/snapshot.schema.json`, agentti):
`activity`, `run_active`, `pending_question`, `waiting_on` (prosessi tai
`taskfleet_wait` ja `run_ids`), `spinoffs_working`, `parent`
(`parent_agent_id`, `taskfleet_run_id`), `worktree_id`, `started_at`, otsikko.
Työtilasta: nimi, `git_summary` (haara, ahead/behind, dirty) ja `worktrees`.
Agentin ilmoitukset tulevat `notice.schema.json`-tiedostosta.

- **Nyt**: kaikki tieto on olemassa. Lukematon vastaus on selaimen muistissa
  (`conversationStore` asettaa `attention: "new"` vasta, kun tämä välilehti
  näkee natiivin tapahtuman). Se riittää korostukseen, kuten nyt.
- **Saapuneet**: kysymys, uusi vastaus ja worktreen `merged` ovat olemassa,
  samoin agenttikohtainen ilmoitus. **Puuttuu:** pysyvä kuittaus, joka
  säilyisi uudelleenlatauksen yli ja näkyisi myös muilla laitteilla, sekä
  yhdistämisen ja ilmoitusten keruu yhdeksi tapahtumalistaksi. Kuittauksen
  paikka olisi arkkitehtuuripäätös, koska se olisi uusi tietovarasto.
- **Työpuu**: kaikki tieto on olemassa (`parent`, `worktree_id`,
  työtilan worktree-paikkojen `git_summary`, `waiting_on.run_ids`).
  Taskfleet-ajon tilasana (”työskentelee”, ”yhdistetty”) johdetaan
  spinoffin aktiivisuudesta ja Gitin `merged`-tiedosta. Taskfleetin omaa
  ajon tilaa host ei lue.
- **Työtila kerrallaan**: kaikki tieto on olemassa. Valittu työtila on
  osoitteessa, kuten nyt.
- **Kiinnitetyt**: **puuttuu** kiinnitys. Haku osuu vain otsikoihin, jotka
  ovat jo snapshotissa.

## Kokeile

Avaa tiedosto selaimessa:

```
issues/proto-sidebar-content/prototypes/sidebar/index.html
```

Sivu toimii yhdestä tiedostosta ilman verkkoa. **1–5** tai **←/→** vaihtaa
ideaa, ja valinta säilyy osoitteen `?v=`-parametrissa. **«** kaventaa
sivupalkin kaistaksi. Kapealla ikkunalla (≤ 800 px) sivupalkki on laatikko,
joka avataan ☰-painikkeesta. **Tumma** vaihtaa teeman ja **Alusta** palauttaa
lähtötilan.

Kokeile jokaisessa:

1. Mistä näet, että `kotisivu` kysyy sinulta jotain? Avaa se.
2. Pääsetkö `opinnaytetyo`-työtilaan, jossa ei ole mitään käynnissä?
3. Löydätkö spinoffin `wt/muistutus-pohja` ja sen vanhemman?
4. Kavenna kaista. Riittääkö se kertomaan, mihin pitää palata?
5. Paina **Kotipalvelin**. Mitä etusivu tekee tämän sivupalkin rinnalla?

Saapuneissa ✓ kuittaa kortin. Kiinnitetyissä ★ irrottaa ja ☆ kiinnittää, ja
haku etsii myös keskustelujen otsikoista. Työtila kerrallaan -idean
vaihtaja avautuu työtilan nimestä.

## Rakentaminen ja tarkistus

```sh
python3 issues/proto-sidebar-content/prototypes/sidebar/build.py
npm ci --prefix web --ignore-scripts   # jos Playwright puuttuu
PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" node issues/proto-sidebar-content/prototypes/sidebar/check.mjs
```

`check.mjs` käy läpi viisi ideaa 1440 ja 390 px:n leveydellä sekä
vaalealla ja tummalla teemalla. Se avaa ei-aktiivisen työtilan ja odottavan
kysymyksen, kokeilee kapean kaistan ja puhelimen laatikon (avaus, Escape,
navigointi) ja varmistaa, ettei sivu lataa mitään verkosta eikä vieritä
vaakasuunnassa. Kuvat tallentuvat hakemistoon `evidence/` nimillä
`<idea>-<leveys>-<teema>-<tila>.png`.
