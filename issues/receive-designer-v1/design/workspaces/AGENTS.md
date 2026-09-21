# Handoff: Agent Host — palvelin, workspacet ja agenttilista (suunnittelupaketti 1)

## Yleiskuvaus

Natiivin Agent Host -työpöytäsovelluksen päänäkymä: vasemmalla yhden palvelimen
workspacet ja niiden agentit, oikealla aina yksi valittu agentti. Paketti kattaa
saapumisen ja kirjautumisen, workspace-listan kaikki tilat, workspacen luonnin
(tyhjä / Git / GitHub-haku), workspacen asetukset, worktreen luonnin, agenttien
käynnistyksen, lopetuksen ja arkiston, yhteyskatkokset sekä agentin lisätiedot.

Keskustelunäkymän sisältö (viestijono, työkalukutsut, diffit) EI kuulu tähän
pakettiin — se on suunnittelupaketti 2 (tunnukset B1–B12). Tässä vedoksessa
keskustelualue on tarkoituksellisesti raidoitettu paikanpitäjä.

## Suunnittelutiedostoista

Tämän paketin HTML-tiedostot ovat **suunnitteluviitteitä**: prototyyppejä, jotka
näyttävät tavoitellun ulkoasun ja käyttäytymisen. Ne eivät ole tuotantokoodia
eikä niitä ole tarkoitus kopioida sellaisenaan.

Tehtävä on **toteuttaa nämä näkymät kohdekoodikannan omassa ympäristössä** sen
vakiintuneilla kirjastoilla ja käytännöillä (React, Vue, SwiftUI, natiivi…). Jos
ympäristöä ei vielä ole, valitse projektille sopivin ja toteuta näkymät siellä.
Prototyypin oma toteutustapa (inline-tyylit, yksi luokka, simuloidut ajastimet)
on vedoksen tekniikkaa, ei suositus arkkitehtuuriksi.

Kaikki vedoksen data on **kuvitteellista**. Palvelinnimi Alder, käyttäjä jari,
repo-nimet ja agenttien synopsikset ovat esimerkkejä. Mikään vedoksessa näkyvä
kenttä ei todista, että adapteri tosiasiassa palauttaa sen tiedon — katso
"Avoimet kysymykset".

## Fideliteetti

**Hi-fi.** Värit, typografia, välistykset ja vuorovaikutus ovat lopullisia
ehdotuksia. Toteuta käyttöliittymä pikselintarkasti kohdekoodikannan omilla
komponenteilla. Alla on tarkat arvot.

---

## Design-tokenit

Kaksi teemaa, molemmat toteutettava. Arvot ovat CSS-muuttujina vedoksessa.

### Vaalea teema

| Token | Arvo | Käyttö |
|---|---|---|
| `--bg` | `#f6f7f8` | Sovelluksen tausta, oikean palstan pohja |
| `--surface` | `#ffffff` | Kortit, dialogit, yläpalkki, viestikenttä |
| `--surface-2` | `#fbfcfd` | Hover-tausta, lisätietoruudukko, dialogin osiot |
| `--rail` | `#f1f3f5` | Vasen palkki |
| `--line` | `#e2e6e9` | Reunaviivat |
| `--line-soft` | `#eef0f3` | Sisäiset erottimet, agenttikortin reuna |
| `--ink` | `#16191d` | Ensisijainen teksti |
| `--ink-2` | `#3d434b` | Leipäteksti |
| `--muted` | `#61676f` | Toissijainen teksti |
| `--faint` | `#6b7178` | Aikaleimat, himmennetyt valikkorivit |
| `--acc` | `#2b7f8c` | Korostus: aktiivinen, ensisijainen painike, käynnissä |
| `--acc-ink` | `#1d5f69` | Korostusteksti |
| `--acc-soft` | `#e6f1f3` | Korostustausta |
| `--acc-line` | `#cfe3e6` | Korostusreuna |
| `--ok` | `#2f7a55` | Yhteys kunnossa |
| `--err` | `#a3412b` | Virhe |
| `--err-soft` | `#fdf1ee` | Virhetausta |
| `--err-line` | `#f3d7d0` | Virhereuna |
| `--scrim` | `rgba(16,24,40,.32)` | Dialogin taustahimmennys |

### Tumma teema

| Token | Arvo |
|---|---|
| `--bg` | `#14171a` |
| `--surface` | `#1b1f23` |
| `--surface-2` | `#171a1e` |
| `--rail` | `#171a1e` |
| `--line` | `#2a3036` |
| `--line-soft` | `#232830` |
| `--ink` | `#e6e9ec` |
| `--ink-2` | `#c5cad0` |
| `--muted` | `#98a0a8` |
| `--faint` | `#949ca6` |
| `--acc` | `#4fa6b4` |
| `--acc-ink` | `#9fd4dd` |
| `--acc-soft` | `#173137` |
| `--acc-line` | `#2c4a52` |
| `--ok` | `#8fcfa8` |
| `--err` | `#e8a08a` |
| `--err-soft` | `#261c1b` |
| `--err-line` | `#4a2e28` |
| `--scrim` | `rgba(0,0,0,.5)` |

### Typografia

- **Instrument Sans** (400/500/600) — koko käyttöliittymä.
- **JetBrains Mono** (400/500) — polut, resume-ID:t, exit-koodit, repo-osoitteet,
  branch-nimet, poiston vahvistuskenttä. **Yhtään teknistä tunnistetta ei käännetä.**

Kokoasteikko (px): 10.5 näppäinvihje · 11 versaalietiketit ja aikaleimat · 11.5
apuselitteet · 12 valikkorivit · 12.5 listan leipä · 13–13.5 painikkeet ja
dialogin leipä · 14 viestikenttä · 15.5 agentin otsikko ja dialogin otsikko ·
17 tyhjän näkymän otsikko · 20 kirjautumisen otsikko.

Versaalietiketit: `500 11px`, `letter-spacing:.07em`, `text-transform:uppercase`,
väri `--muted`. **Poikkeus:** poiston vahvistusetiketti ei ole versaali, koska
siinä näkyy kirjainkokoherkkä hakemiston nimi.

### Muut arvot

- Pyöristykset: 5 px pienet lätkät · 6–7 px valikko- ja ikonipainikkeet ·
  8 px painikkeet ja syötteet · 9 px agenttikortit ja ilmoituslaatikot ·
  10 px dialogin osiot · 12 px sovelluskehys ja luontikortti · 999 px pillerit ja pisteet.
- Välistys 4 px:n ruudukolla.
- Varjot: sovelluskehys `0 1px 2px rgba(16,24,40,.05), 0 10px 30px rgba(16,24,40,.06)`;
  dialogi `0 12px 40px rgba(16,24,40,.18)`; valikko `0 6px 18px rgba(16,24,40,.10)`.
- Fokusrengas: `2px solid #2b7f8c`, `outline-offset:2px`, vain `:focus-visible`.

### Animaatio

- `@keyframes p` — opacity 1 → .3 → 1. Sykkivä piste **vain kun jotain on
  käynnissä**: agentti työskentelee (1.6 s), lataus (1.4 s), yhdistäminen (1.2 s),
  listan päivitys (1 s).
- `@keyframes apr` — opacity 0 + translateY(-4px) → paikalleen, 160–200 ms.
  Yläpalkki, lisätietoruudukko, dialogi.
- `prefers-reduced-motion: reduce` pysäyttää kaiken liikkeen.

---

## Näkymät

### 1. Kirjautuminen

**Tarkoitus:** käyttäjä kirjautuu palvelimelle, jonka osoite määräytyy
sovelluksen URL:sta.

**Asettelu:** keskitetty kortti, leveys enintään 440 px, `--surface`, 1 px
`--line`, pyöristys 12 px, sisennys 26 px, pystysuunnassa 16 px välit.

**Sisältö ylhäältä:**
1. Versaalietiketti "Native Agent Host".
2. Palvelimen nimi, `600 20px`, `letter-spacing:-.01em`.
3. Osoite, `400 12.5px` monospace, `--muted`.
4. Selite (13.5 px / 1.6, `--ink-2`): "Osoite määrää palvelimen. Kirjautuminen
   antaa käyttöoikeuden siihen Linux-tunnukseen, jonka ylläpitäjä on liittänyt
   sinuun tällä palvelimella; tunnusta ei valita täältä."
5. Tilariippuvainen toiminto.

**Tilat:**
- `idle` — ensisijainen painike "Kirjaudu palvelimelle", `--acc` / `--on-acc`,
  sisennys 11×18, hover `#246b76`.
- `pending` — painike himmennetty (.45) tekstillä "Kirjaudutaan…", alla sykkivä
  piste ja "Odotetaan gatewayn vastausta ja käyttäjädaemonin tilaa."
- `error` — virhelaatikko (`--err-soft` / `--err-line`): otsikko
  "✕ Kirjautuminen epäonnistui", selite "Gateway ei löytänyt Linux-käyttäjä­mappausta
  tälle web-identiteetille palvelimella Alder.", tekninen rivi monospacena
  `gateway: no_user_mapping · HTTP 403`. Alla "Yritä uudelleen" ja huomautus,
  ettei toista Unix-tunnusta voi valita täältä.

Autentikointitapaa (SSO, tokenit) **ei oteta kantaa** vedoksessa.

### 2. Sovelluskehys

Pystysuunnassa: valinnainen tilapalkki → sisältö. Sisältö vaakaan: vasen palkki
(296 px kiinteä, tai 46 px kutistettuna) → oikea palsta (joustava).

**Tilapalkki (koko sovelluksen laajuinen):** 9×16 sisennys, taustaväri tilan
mukaan, alareunassa 1 px viiva. Rakenne: merkki + otsikko lihavana, selite
`--ink-2`, oikeassa laidassa valinnainen toimintopainike. Käytetään
katkokselle, uudelleenyhdistykselle, istunnon vanhenemiselle, käynnistyksen
epäonnistumiselle ja onnistumisvahvistuksille. Onnistumispalkit katoavat itsestään.

### 3. Vasen palkki

**Kutistettuna (46 px):** ylhäältä alas — avauspainike "›", yhteyspiste,
ja pyöreä merkki, jossa vastausta odottavien agenttien määrä (`--acc-soft`
tausta, `--acc` reuna, `--acc-ink` teksti, 22×22).

**Avattuna (296 px):**

*Otsikko-osa* (sisennys 11/10/9, alla `--line-soft`):
- Rivi 1: palvelimen nimi `600 13.5px` + yhteystila (8 px piste + lyhyt teksti,
  värit `--ok` / `--acc` / `--err`) + piilotuspainike "‹" oikeassa laidassa.
  **Palvelimen osoitetta ei toisteta tässä.**
- Katkoksen aikana alle lisärivi: "Tilat ovat viimeksi saatuja."
- Suodatinkenttä ("Suodata") ja sen vieressä 30×30 päivitysikoni "↻", joka sykkii
  latauksen ajan.
- Tiiviste "N agenttia · M workspacea" ja oikealla "Avaa kaikki" / "Sulje kaikki".

*Lista* (vieritettävä, sisennys 8/8/14):
- Mahdollinen tilalaatikko (lataus, tyhjä, virhe, katkos).
- Workspace-lohkot.
- "Piilotetut (N)" -rivi, jos piilotettuja on.
- "+ Uusi workspace" katkoviivakortti.

*Näppäinvihje* omalla rivillään: "⌘↑↓ agentti · ⌘K suodata · ⌘N uusi".

*Alarivi:* käyttäjätunnus monospacena ja "Kirjaudu ulos".

**Workspace-lohko:**
- Lohkojen välissä 1 px `--line` viiva, 10 px yläsisennys, 6 px marginaali —
  tämä erottaa otsikot agenttikorteista.
- Otsikkorivi: kolmio "▾"/"▸" 11 px `--muted` (11 px leveä paikka), nimi
  `600 13.5px` `--ink` `letter-spacing:-.01em`, valinnainen tiiviste
  ("2 odottaa" / "1 työssä" pisteen kanssa, `--acc-ink`), sitten "⋯" ja "+".
- Agenttikortit 6 px sisennettynä, 4 px välein.

**Agenttikortti** — tarkoituksella niukka:
- 1 px reuna (`--line-soft`, valittuna `--acc`), tausta `--surface`
  (valittuna `--acc-soft`), pyöristys 9 px, sisennys 9×10, hover `--acc-line`.
- Sisältö vasemmalta: 8 px tilapiste · synopsis `12.5px` (valittuna 600,
  yksi rivi, ellipsi) · suhteellinen aika `11px` `--faint`.
- **Ei tilatekstiä eikä worktree-merkintää kortissa.** Tila on pisteen väri ja
  hover-vihje; koko tila ja worktree näkyvät oikean puolen otsikossa.
- Worktree-agentit 14 px lisäsisennyksellä emoagentin alla.
- Aikamuoto on suhteellinen ja suomeksi: "juuri nyt", "2 min", "6 min", "3 t",
  "eilen".

**Tilapisteet ja järjestys** (ylin ensin):

| Tila | Teksti | Piste | Sykkii |
|---|---|---|---|
| `ask` | Odottaa vastaustasi | `--acc` | ei |
| `work` | Työskentelee | `--acc` | kyllä |
| `ready` | Odottaa viestiä | `--muted` | ei |
| `off` | Ei käynnissä | `--line` | ei |
| `seen` | Vain havaittu | `--faint` | ei |
| `stale` | Ei tiedossa (vain katkoksessa) | `--faint` | ei |

Emoagentti järjestetään sen kiireellisimmän lapsen mukaan, jotta odottava
aliagentti nostaa koko ryhmän ylös. Lapset järjestetään keskenään samoin.

**Suodatin:** osuma workspacen nimeen näyttää koko lohkon; muuten näytetään vain
osuvat agentit. Workspace, jolla ei ole yhtään osumaa, piilotetaan kokonaan.
Suodattaessa lohkot ovat auki riippumatta niiden omasta tilasta.

### 4. Listan tilat

| Tila | Palkissa | Oikealla |
|---|---|---|
| normaali | lohkot | valittu agentti |
| latautuu | "Luetaan workspaceja" + neljä luurankopalkkia (70/52/64/44 %) | edellinen sisältö |
| tyhjä `~/src` | neutraali laatikko, "Luo workspace" + "Päivitä lista" | "Ei yhtään workspacea" + "Luo workspace" |
| `~/src` puuttuu | "Hakemistoa ~/src ei löytynyt", sama pari | vastaava teksti |
| lukuvirhe | punainen laatikko, `daemon: HTTP 503 · GET /workspaces` | "Tietoja ei voitu lukea" |
| yhteys poikki | punainen laatikko + "Yritä yhdistää" | agentti luettavana, lähetys estetty |

### 5. Workspacen luonti

Dialogi, enintään 520 px, otsikko "Uusi workspace", alaotsikko "Luodaan
palvelimelle Alder."

Kaksi välilehteä: **Luo uusi** ja **Hae GitHubista**.

**Luo uusi:**
1. **Nimi** — ensimmäisenä ja suurimpana (`14.5px`, sisennys 10×12). Apuselite:
   "Näkyy listassa. Nimen voi muuttaa myöhemmin." **Hakemistoista ei puhuta.**
2. **Versionhallinta** — valintaruutu (17×17, pyöristys 5, valittuna `--acc`
   tausta ja ✓), oletuksena päällä, apurivi "Git-repo tälle workspacelle."
3. Sen alla, sisennettynä 26 px, versionhallinnan asetukset:
   - GitHub kytkettynä: valintaruutu "Luo myös GitHub-repo" ja sen alla
     Yksityinen / Julkinen.
   - GitHub kytkemättä: selite "GitHub-tiliä ei ole kytketty tähän tunnukseen.
     Repo luodaan paikallisena, kunnes kytket tilin." ja painike "Kytke GitHub-tili".

**Hae GitHubista:**
- Kytkettynä: hakukenttä "Etsi repoa tai liitä osoite" ja vieritettävä lista
  (enintään 236 px) repoista — koko nimi, kieli ja muokkausaika, oikealla
  yksityinen/julkinen. Valittu rivi `--acc-soft`. Hakukenttään voi liittää myös
  koko osoitteen (`omistaja/repo` tai `https://github.com/...`).
- Kytkemättä: oma tila ja ensisijainen painike "Kytke GitHub-tili".

**Toiminnot:** ensisijainen painike ("Luo workspace" / "Hae <repo>"), "Peruuta",
ja vain tarvittaessa huomautus ("Samanniminen workspace on jo olemassa.").
**Ajettavaa komentoa ei näytetä käyttäjälle.**

Onnistuessa: workspace lisätään listaan, se avataan, **sille käynnistetään
automaattisesti ensimmäinen agentti** ja fokus siirtyy sen viestikenttään.

### 6. Workspacen asetukset (⋯ → Asetukset…)

- **Näyttönimi** — muokattava. Apuselite kertoo, että tallennus kirjoittaa
  tiedoston `.agent-host/workspace.json` workspacen sisään eikä hakemiston nimi muutu.
- **Vain luku -ruudukko** (auto-fit, min 200 px): Hakemisto · Git (branch tai
  "ei versionhallintaa") · Etärepo · Agentteja.
- **Versionhallintalohko**, joka etenee tilan mukaan:
  1. Ei Gitiä → selite + "Ota Git käyttöön" (`git init`).
  2. Git ilman etärepoa → näkyvyysvalinta + "Luo GitHub-repo"
     (`gh repo create … --source … --push`).
  3. Etärepo olemassa → "origin → github.com/…" pelkkänä tietona.
- Tallennuspainike aktivoituu vain kun nimi on muuttunut. Huomautus muistuttaa
  `.git/info/exclude` -merkinnästä.

Workspacen tietomalli on tarkoituksella minimaalinen: **vain pysyvä ID ja
näyttönimi**. Ei tunnuksia, ei ajonaikaista tilaa, ei Git-faktoja (ne luetaan
Gitistä), ei komponenttien konfiguraatiota (Pi:n malli konfiguroidaan Pi:ssä).

### 7. Uusi worktree (⋯ → Uusi worktree…)

Vain Git-workspaceille; muuten valikkorivi on himmeä tekstillä
"Uusi worktree — ei Git-repo".

Kentät: **Nimi** (apuselite "Uusi branch samalla nimellä", duplikaatti estetään)
ja **Lähtökohta** (branch tai "Nykyinen tila"). Painike "Luo worktree ja agentti".

Onnistuessa worktree ilmestyy listaan emoagentin alle, **sille käynnistyy uusi
agentti ja fokus siirtyy siihen.**

### 8. Workspacen piilotus ja poisto

- **Piilota listasta** — pelkkä näkymäsuodatin. Piilotetut kerätään listan alle
  riville "▸ Piilotetut (N)", joka avaa ne takaisin näkyviin.
- **Poista…** — punainen dialogi. Selite kertoo, että hakemisto ja sisältö
  poistetaan palvelimelta eikä sitä voi perua. Jos workspacessa on agentteja,
  punainen laatikko kertoo montako lopetetaan. Vahvistus vaatii hakemiston nimen
  kirjoittamisen **täsmälleen oikeassa kirjainkoossa** (etiketti ei ole versaali).
  Dialogissa on myös kevyempi ulospääsy "Piilota sen sijaan".

### 9. Agenttinäkymä (oikea palsta)

**Otsikko** (`--surface`, sisennys 13×20, alla 1 px `--line`):
- Rivi 1: synopsis `600 15.5px` + tilapilleri (pyöristys 999, 2×10, 7 px piste,
  värit ja teksti taulukon mukaan).
- Rivi 2 (12 px, `--muted`, kääriytyvä): workspacen nimi lihavana · worktreen
  lätkä `⑂ <nimi>` `--acc-soft`/`--acc-line`/`--acc-ink` · "aliagentti ·
  <emoagentin synopsis>" · aikaleima.
- Oikealla "Lisätiedot" / "Piilota lisätiedot".

**Lisätiedot** (`--surface-2`, auto-fit-ruudukko min 220 px): Natiivi ID ·
Harness · Polku · Havaittu execution root · Git · tmux · Taskfleet. Puuttuva
tieto on "ei tiedossa" `--faint`-värillä. **Polkuja ei näytetä listassa,
ainoastaan täällä.**

**Estoselite** näytetään sisältöalueen yläosassa silloin kun ohjaus ei ole
käytettävissä:
- Yhteys poikki → "Ohjaus ei ole käytettävissä" + "Yritä yhdistää".
- Istunto vanhentunut → "Kirjautuminen vanheni" + "Kirjaudu uudelleen".
- `seen` → "Prosessi on havaittu tmuxissa, mutta selaimesta liittymistä ei ole
  todennettu. Löytyminen listasta ei tarkoita ohjattavuutta." Ei toimintoa.
- `off` → "Avaaminen ei resumoinut agenttia." + "Resumoi keskustelu".

**Keskustelualue** on paketin 2 paikanpitäjä: katkoviivakehys, raidoitettu
tausta ja merkintä "keskustelualue · viestijono, työkalurivit, diffit —
suunnittelupaketti 2". Palstan enimmäisleveys 960 px.

**Viestikenttä** (`--surface`, yläpuolella 1 px `--line`):
- Valinnainen vihjelaatikko uudelle keskustelulle: "Keskustelu saa nimen
  automaattisesti, kun sillä on viestejä." Oikealla "Älä näytä enää" ja "✕".
  Vihje katoaa itsestään, kun keskustelu on nimetty.
- Kolmirivinen tekstialue, placeholder "Kirjoita viesti agentille…" (estettynä
  "Lähettäminen ei ole käytettävissä").
- Alarivi: **Lähetä** vasemmalla, syy estolle sen vieressä (vain kun estetty tai
  kun agentti työskentelee), **Lopeta ja arkistoi** oikeassa laidassa.

**Fokus:** viestikenttä saa fokuksen aina kun agentti vaihtuu — kortista
napsauttamalla, ⌘↑/⌘↓:lla, uuden agentin tai worktreen luonnista sekä arkistosta
jatkettaessa. Käytä `focus({preventScroll:true})`, muuten sivu vierii.

### 10. Agentin lopetus ja arkisto

Agenttirivillä **ei ole** omaa ⋯-valikkoa. Ainoa lopetustoiminto on
"Lopeta ja arkistoi" viestikentän oikeassa laidassa: se lopettaa prosessin ja
siirtää keskustelun workspacen arkistoon, jolloin se poistuu listasta.

**Arkisto** avataan workspacen ⋯-valikosta. Dialogi listaa arkistoidut
keskustelut (synopsis, worktree, "arkistoitu · <aika>") ja kunkin kohdalla
"Jatka", joka palauttaa keskustelun listaan, käynnistää sen ja siirtää fokuksen
siihen. Tyhjänä: "Tässä workspacessa ei ole arkistoituja keskusteluja."

### 11. Uuden agentin käynnistys

Workspace-otsikon "+" tai agentittoman workspacen "Avaa agentti" -kortti (saman
levyinen ja muotoinen kuin agenttikortit, katkoviivareuna).

Kesken: sisennetty rivi "Käynnistetään Pi…" sykkivällä pisteellä.
Onnistuu: uusi agentti avautuu, synopsis "Uusi keskustelu".
Epäonnistuu: tilapalkki "Käynnistys epäonnistui", selite
"Pi: oletusmallia ei ole määritelty harnessin konfiguraatiossa (exit 1). Malli
asetetaan Pi:ssä, ei Agent Hostissa." ja "Yritä uudelleen".

---

## Vuorovaikutus ja käyttäytyminen

### Näppäinkomennot

Kaikki oikotiet ovat ⌘ (tai Ctrl) -etuliitteen takana, koska kohdistus on
oletuksena viestikentässä.

| Näppäin | Toiminto |
|---|---|
| ⌘↓ / ⌘↑ | Seuraava / edellinen agentti näkyvässä listassa |
| ⌘K | Avaa palkki ja siirrä fokus suodattimeen |
| ⌘N | Uusi agentti nykyiseen workspaceen |
| ⌘B | Näytä/piilota palkki |
| Esc | Sulkee valikon → dialogin → poistuu kentästä → tyhjentää suodattimen |

Esc on ainoa ilman etuliitettä. Oikotiet eivät laukea dialogin ollessa auki
(paitsi Esc).

### Yhteystilat

`ok → down` yhdellä toiminnolla ("Katkaise yhteys"). `down → reconnecting →
ok` itsestään noin 1,8 sekunnissa; onnistumispalkki katoaa noin 2,6 sekunnin
kuluttua. Uudelleenyhdistys käynnistyy vain "Palauta yhteys"- tai
"Yritä yhdistää" -toiminnoista.

Katkoksen aikana:
- Kaikki agentit näytetään tilassa "Ei tiedossa" ja ajat merkitään
  "· viimeksi saatu". **Tilaa ei esitetä pysähtyneenä vaan vanhentuneena.**
- Lähetys, käynnistys, worktreen luonti, arkistointi, poisto ja nimen tallennus
  estetään. Valikkorivit näkyvät himmeinä ja perusteltuina ("— ei yhteyttä"),
  eivät piilotettuina tai hiljaa toimimattomina.
- "Uusi workspace" -kortti piilotetaan.

Sama esto koskee vanhentunutta istuntoa.

### Ohjattavuus vs. näkyvyys

Keskeinen sääntö: **agentin löytyminen listasta ei tarkoita, että sitä voi
ohjata.** `seen`-tilan agentti (havaittu tmuxissa) näytetään listassa, mutta
lähettäminen on estetty ja syy kirjoitetaan auki. Sitä ei voi myöskään lopettaa
käyttöliittymästä.

### Muut säännöt

- Agentin avaaminen **ei** resumoi sitä. Resumointi on erillinen, nimetty toiminto.
- Viestiluonnos säilyy muistissa agenttikohtaisesti agenttia vaihdettaessa.
- Onnistumispalkit katoavat itsestään; virhepalkit jäävät kunnes ne kuitataan.

---

## Tilamalli

Toteutuksen ei tarvitse noudattaa vedoksen rakennetta, mutta nämä käsitteet
tarvitaan.

**Palvelintason tila**
- `conn`: `ok` | `reconnecting` | `down`
- `listState`: `ready` | `loading` | `empty` | `nosrc` | `error`
- `expired`: boolean (istunto vanhentunut)
- `ghLinked`: boolean (GitHub-tili kytketty käyttäjätunnukseen)

**Workspace**
- `id` (pysyvä), `dir`, `label` (näyttönimi tai tyhjä), `branch`, `remote`
- Näkymätila: `open` (avattu), `hidden` (piilotettu listasta)

**Agentti**
- `id`, `ws`, `parent` (aliagentille), `worktree`, `synopsis`, `st`, `time`,
  `rel` (suhteellinen aika), `root`, `tmux`, `task`
- Näkymätila: `stopped`, `resumed`, `archived`

**Johdettu tila**
- Efektiivinen tila: katkos → `stale`; pysäytetty → `off`; resumoitu → `work`;
  muuten agentin oma tila.
- Järjestys: emoagentti perii kiireellisimmän lapsensa sijan.
- `canAct = conn !== 'down' && !expired` — portti kaikille kirjoittaville
  toiminnoille.

**Palvelinkutsut, joita näkymä edellyttää**
- Listaa workspacet (hakemistot `~/src`) branchin ja etärepon kera.
- Listaa agentit workspacea kohti, tila ja synopsis mukaan lukien.
- Luo workspace: hakemisto / `git init` / `gh repo create` / `git clone`.
- Kirjoita ja lue `.agent-host/workspace.json`.
- Luo worktree ja käynnistä agentti.
- Käynnistä, resumoi, lopeta ja arkistoi agentti; listaa arkisto.
- Poista workspace.
- GitHub: onko tili kytketty, listaa käyttäjän repot.

---

## Tarkoituksella rajattu pois

- **Keskustelun sisältö** — viestijono, työkalukutsut, diffit, hyväksynnät.
  Suunnittelupaketti 2 (B1–B12).
- **Useampi palvelin samassa näkymässä.** Sovelluksen osoite määrää palvelimen,
  joten näkymä on yhden palvelimen näkymä. Aiempi monen palvelimen malli on
  poistettu; jos se palaa, se on ikkunatason valinta, ei listan taso.
- **Synopsiksen sisältösääntö.** Synopsis on tekoälyn generoima otsikko; mitä se
  tiivistää ja millä tahdilla päivittyy, ratkaistaan MVP-kehityksessä.
  Käyttöliittymän vaatimukset: yksi rivi ellipsillä, "Uusi keskustelu" ennen
  nimeämistä, katkoksen aikana viimeksi saatu arvo.

## Avoin kysymys, joka kannattaa ratkaista ennen toteutusta

**Huomiointi.** Kun agentti siirtyy odottamaan vastausta eikä se ole näkyvissä
(palkki piilossa tai toinen agentti auki), ainoa signaali on listan järjestyksen
muutos ja kutistetun palkin lukumäärä. Natiivisovelluksessa tämä tarkoittaa
käyttöjärjestelmän ilmoitusta ja sovelluskuvakkeen merkkiä. Tämä ratkaisee,
toimiiko monen agentin rinnakkaisajo käytännössä — vedoksessa sitä ei ole.

## Muut toteutuksessa tarkistettavat oletukset

- Kertooko adapteri agentin havaitun tilan ja ohjattavuuden erikseen?
- Voiko terminaalissa käynnistettyyn agenttiin liittyä lainkaan?
- Palauttaako daemon workspacen Git-branchin ilman erillistä kutsua?
- Miten execution root, tmux- ja Taskfleet-viitteet havaitaan?
- Kuinka pitkään viimeksi saatua tilaa on mielekästä näyttää katkoksen aikana?
- Säilyykö viestiluonnos välilehden uudelleenlatauksen yli?

---

## Assetit

Ei kuva- tai ikoniasseteja. Kaikki merkit ovat Unicode-merkkejä:
`▾ ▸ ‹ › ⋯ + ✓ ✕ ↻ ⑂ ⃠ · ↑ ↓ ⌘`. Fontit ladataan Google Fontsista
(Instrument Sans, JetBrains Mono).

## Tiedostot

| Tiedosto | Sisältö |
|---|---|
| `Agenttilista vasemmalla.dc.html` | Päävedos: kaikki yllä kuvatut näkymät ja tilat |
| `Yhteenveto A1-A9.dc.html` | Yhteenveto ja vedoskartta, A-tunnusten kartoitus |
| `support.js` | Vedosten ajoympäristö — **ei osa suunnittelua**, ei toteutettava |

Avaa `Agenttilista vasemmalla.dc.html` selaimessa. Yläreunan painikerivi
simuloi poikkeustilat: kirjautuminen, yhteyskatkos, listan tilat, käynnistyksen
ja luonnin epäonnistuminen, GitHub-tilin kytkentä, istunnon vanheneminen sekä
teeman vaihto. Painike "Alusta uudelleen" palauttaa alkutilan.
