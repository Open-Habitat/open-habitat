# Workerin näkymä · Kierros 1

Worker on Taskfleetin käynnistämä Pi- tai Claude Code -agentti omassa
worktreessään. Tänään se avautuu taustatyön palkista joko spinoffin vain luku
-sivuna, jossa historia on litistetty tekstiksi
(`evidence/nykytila-1440-light.avif`), tai päätepaneelin vain luku -välilehtenä.
Tässä kierroksessa workerin oma keskustelu näytetään samoilla
keskustelukomponenteilla kuin pääkeskustelu: ajattelu, työkalut ja vastaukset
näkyvät, kirjoituskenttää ei ole. Suunnat eroavat kahdessa asiassa: kuinka
vahvasti näkymä kertoo olevansa worker ja missä se avautuu.

Keskustelun merkintä ja CSS on kopioitu tuotannosta. `baseline.mjs` tallensi
synteettisestä labista oikean keskustelun DOMin ja tyylit, ja
`extract.py` erotteli niistä `captured/`-tiedostot. Kierroksen omaa
ulkoasua ovat vain workerin tunniste, tuloskortti, kehote, sivupaneeli ja
keskustelun sisäinen kortti (`round.css`). Kaikki nimet, polut ja luvut ovat
keksittyjä.

## Neljä suuntaa

| Suunta | Missä avautuu · workerin vihje | Vahvuus | Hinta |
| --- | --- | --- | --- |
| **1 Hiljainen** | Pääkeskustelun paikalla, kuten tänään. Otsikkorivillä katkoviivainen **Worker**-merkki ja profiili. Kirjoituskentän tilalla on nykyinen vain luku -alapalkki: ”Tätä workeria ohjaa keskustelu …” ja **Pääkeskusteluun**. | Pienin muutos: nykyinen vain luku -keskustelu ja yksi merkki lisää. | Vihje on heikko. Kun alapalkki on vierityksen ulkopuolella, näkymä näyttää tavalliselta keskustelulta. Pääkeskustelun nimi näkyy vasta alhaalla. |
| **2 Kehys** | Pääkeskustelun paikalla. Yläreunassa on pysyvä worker-kaista: **Worker**, ← pääkeskustelun nimi, issue, Pi · profiili, ja välilehdet **Keskustelu \| Pääte**. Kehyksellä on vasemmalla aksenttiviiva, ja vastaukset on nimetty ”Worker · vastaus”. Lopussa on tuloskortti. Sivupalkissa worker näkyy pääkeskustelun alla tilapisteen kanssa. | Kenen worker ja mitä se tekee näkyy heti ja pysyy näkyvissä vierittäessä. Pääte on saman näkymän toinen välilehti eikä erillinen paikka. | Kaista vie yhden rivin. Sivupalkin sisennys on uusi navigaatiokäsite: monta workeria pidentää listaa, ja päättyneiden poistumisaika pitää päättää. |
| **3 Sivupaneeli** | Pääkeskustelu jää paikalleen kirjoituskenttineen, ja worker avautuu oikealle paneeliin. Puhelimessa paneeli on koko ruudun arkki, jossa on ← takaisin. | Workeria voi seurata ja samalla kirjoittaa pääagentille. Konteksti on itsestään selvä, koska pääkeskustelu on vieressä. | Kumpikin kaventuu. Leveillä tuloksilla ja työkalutulosteilla on ahdasta. Puhelimessa suunta on käytännössä sama kuin Hiljainen. Editori ja HTML-näkymät kilpailevat samasta tilasta. |
| **4 Keskustelussa** | Worker on kortti pääkeskustelun aikajanalla siinä kohdassa, jossa se käynnistettiin. Kortti näyttää tilan ja viimeiset askeleet tai lopputuloksen. **Avaa workerin keskustelu** avaa sen paikalleen murupolun kanssa. | Pääkeskustelusta näkee ilman siirtymää, miten worker etenee. Odottava kehote näkyy siellä, missä ihminen jo on. | Kahden keskustelun sekoittuminen. Kortin paikka aikajanalla vaatii tiedon, jota hostilla ei ole (alla). Koko näkymä on silti Hiljaisen kaltainen. |

Kaikissa suunnissa on sama sisältö ja samat neljä tilaa. Tehtävän antaa
**Pääagentti · tehtävä** -kupla (katkoviiva), ei ”Sinä”. Kirjoituskenttää ei
ole. Päätteen saa auki aina, ja Claude Code -workerilla se on ainoa näkymä.

## Kokeile

Avaa tiedosto selaimessa:

```
issues/proto-worker-view/prototypes/worker-view/index.html
```

Sivu toimii yhdestä tiedostosta ilman verkkoa (CSP estää kaikki pyynnöt).
Suunta vaihtuu valitsimesta tai näppäimillä **1–4** ja **←/→**. Yläpalkissa:

- **Tila**: Työskentelee, Odottaa päätteessä, Valmis ja laskeutunut,
  Epäonnistui ja tallessa.
- **Worker**: Pi, jonka historia on luettavissa, tai Claude Code, jonka
  historiaa ei tänään saada (näkymä vaihtuu päätteeseen ja kertoo syyn).
- **Tumma / Vaalea**.

Kokeile näitä:

1. Avaa vaiheet (”Ajattelu · 3 työkalua”) ja työkalurivit, joissa on tuloste.
   Ne ovat tuotannon komponenttien merkintää.
2. **Odottaa päätteessä**: workerin `git fetch` on jäänyt SSH-kehotteeseen.
   Keskustelussa näkyy kehotteen teksti ja **Näytä pääte**. Puhelimessa pääte
   täyttää ruudun, kuten tuotannossa.
3. **Tiedot** (ⓘ) näyttää pääkeskustelun, tehtävän ja issuen, agentin ja
   profiilin, tilan, haaran ja run-tunnisteen.
4. Kehys: välilehti **Pääte**. Sivupaneeli: sulje paneeli ja avaa se uudelleen
   kirjoituskentän yllä olevasta workermerkistä. Keskustelussa: kortin
   **Avaa workerin keskustelu** ja murupolun paluu.
5. Pääkeskustelun linkit näyttävät vain ilmoituksen. Prototyyppi ei siirry
   minnekään eikä lähetä mitään.

URL-parametrit `?v=2&state=waiting&harness=claude&theme=dark` avaavat
suoraan halutun yhdistelmän. Kuvat ovat hakemistossa `evidence/`: jokainen
suunta jokaisessa tilassa 1440 px vaaleana ja 390 px tummana, Claude-varahaara
1440 px:ssä sekä nykytila vertailuun.

## Mitä hostin pitää tietää

| Tieto | Mistä | Onko tänään |
| --- | --- | --- |
| Workerin oma historia rakenteisena (ajattelu, työkalut, vastaukset), **Pi** | Taskfleetin `node_transcripts`: harness, `session_id` ja istuntotiedoston polku. Daemon lukee tiedoston jo (`readSpinoffTranscript`). | **Osittain.** Ajo osataan yhdistää istuntotiedostoon, mutta daemon litistää historian tekstiksi (user/assistant/tool) ja pudottaa ajattelun, työkalujen argumentit ja tulokset. Tarvitaan sama historiasopimus ja dekooderi kuin keskusteluille. |
| Sama **Claude Code** -workerille | Taskfleet | **Ei.** Taskfleet ilmoittaa Claude-solmulle `support: unsupported` ja `session_id: null` (havaittu tämän kierroksen omasta Claude-ajosta 25.10.2026). Habitatissa ei myöskään ole Claude Code -historian lukijaa. Siksi Claude-worker näyttää päätteen. |
| Tila: työskentelee / odottaa pääagenttia / mergetty / ei mergetty / tuntematon | `spinoffState` | **On.** |
| ”Odottaa päätteessä” | Taskfleetin `awaiting_input` | **Taskfleetissä on**, daemon ei välitä sitä. |
| Kehotteen teksti keskustelussa | Vain workerin tmux-paneelissa | **Ei.** Vaatisi paneelin lopun lukemisen (capture-pane). Ilman sitä näkymä sanoo ”odottaa päätteessä” ja tarjoaa päätteen. |
| Pääkeskustelu | `created_by_session`; spinoffit luetaan jo pääkeskustelun kautta | **On** (Pi-pääkeskustelu). |
| Otsikko, run, haara, worktree, lähtöhaara, tallessa oleva työ, raportin yhteenveto | Spinoffs-sopimus | **On.** |
| Profiili, harness ja malli | Taskfleetin `manifest.selection` (profiili, harness, komennon `--model`) tai workerin oma istunto | **Taskfleetissä on**, sopimuksessa ei. Malli on luotettavammin istunnosta kuin argv:stä. |
| Issue | Ei kenttää. Ajojen otsikot alkavat usein slugilla (`kello-dst: …`). | **Ei luotettavasti.** Joko otsikkosopimus tai kenttä jätetään pois. |
| Laskeutumisen commit | Taskfleetin `landed`/`landed_method` kertovat että, eivät mitä | **Ei.** Kortti voi näyttää ”laskeutui” ilman SHA:ta, tai SHA haetaan gitistä. |
| Raaka pääte | Daemon listaa Taskfleetin ikkunat paneelin hakemiston perusteella ja liittyy vain luku -tilassa. Taskfleetin `attach.identity` antaa tarkan ikkunan. | **On**, mutta pääte avataan päätepaneelista eikä workerin näkymästä. Yhdistäminen on uutta kytkentää, ei uutta hostitietoa. |
| *Kehys:* workerit sivupalkissa pääkeskustelun alla | Spinoffit luetaan nyt vain avoimelle keskustelulle | **Ei.** Tarvitaan workerit kaikille listatuille keskusteluille (snapshot-kenttä tai lisää kyselyjä). Kaistan voi ottaa ilman sivupalkkia. |
| *Keskustelussa:* kortin paikka pääkeskustelussa | Pääagentin `taskfleet run create` -kutsu ja sen tuloste | **Ei.** Ajo ei ole sidottu työkalukutsuun; paikan voi arvioida `created_at`-ajasta. |

## Avoimet kysymykset

- Riittääkö Hiljaisen heikko vihje, vai tarvitaanko Kehyksen kaista, jotta
  workeria ei sekoita omaan keskusteluun?
- Kuuluvatko workerit sivupalkkiin pääkeskustelun alle, vai riittääkö
  nykyinen taustatyön palkki?
- Claude Code -workerit näkyvät, kunnes Taskfleet ja Habitat osaavat lukea
  niiden istunnon, päätteenä. Hyväksytkö tämän, vai pitäisikö Claude-historia
  nostaa omaksi työkseen?
