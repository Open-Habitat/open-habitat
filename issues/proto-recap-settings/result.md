# Tulos: tilannekatsauksen asetukset, kierros 2

Prototyyppi on `prototypes/recap-settings-2/index.html`, yksi offline-HTML.
Lähde on `design-system/prototypes/rounds/2026-10-28-tilannekatsaus-asetukset-2/`
(`page.html`, `build.mjs`, `verify.mjs`), ja yhteinen valitsin tulee
kirjastosta `lib/picker.*`. Tuotantokomponenttien bundlea ei käytetty. Jarin opas on
`prototypes/recap-settings-2/NOTES.md`, ja kuvat ovat
`prototypes/recap-settings-2/evidence/` (AVIF, laitteen skaalaus 2).
`verify.mjs` käy läpi 45 ajoitustapausta (vapaa viive × hiljaisuus × tila ×
suunta). Lisäksi se tarkistaa mallivalitsimen (popover, puhelimen arkki,
Fable ja Opus estetty, sama komponentti Oletusmallissa), lukujen rajat,
vastausrajan varoituksen, Palauta oletukset -painikkeen, suunnan 1 taitoksen
ja suunnan 3 tasot. Konsoli on puhdas, verkkopyyntöjä ei ole, ja valitsin
läpäisee `picker-check`in. Kierros 1 (`prototypes/recap-settings/`) on tallessa vertailua
varten. Sen tulos ja host-taulukko löytyvät tämän tiedoston Git-historiasta.

## Jarin päätös, josta kierros lähti (2026-10-28)

Oma osio Asetuksissa. Teksti "Lasketaan viimeisestä viestistä … pisin viive
on 5 min" poistetaan. Viive on vapaasti säädettävä. Osiossa ovat myös pituusparametrit
(tokenit ja viestimäärät). Mallivalitsin on sama kuin muualla, mieluiten
yhteinen standardikomponentti.

## Akseli: miten parametrit ryhmitellään

Kaikissa suunnissa säädöt, rajat ja oletukset ovat samat. Osion alussa on
kortin esikatselu, joka seuraa valittua mallia ja sanamäärää. Kortin ratas
vie osioon (`data-landed`-korostus).

| # | Suunta | Mitä se päättää | Milloin oikea | Mitä se maksaa |
|---|---|---|---|---|
| 1 | **Perus + lisät** | Yksi kortti: Tilannekatsaus, viive, malli ja katsauksen pituus (sanat). Muut seitsemän lukua ovat *Lisäasetukset*-taitoksen takana kolmessa ryhmässä: lukee / kirjoittaa / milloin. Taitoksen otsikossa ovat aina nykyiset luvut ja "N muutettu". Lopussa on yhteenveto ja Palauta oletukset. | Useimmat säätävät vain milloin, millä mallilla ja kuinka pitkä. Tokenit ja viestimäärät ovat turvarajoja, joihin harva koskee. | Luvut ovat yhden klikkauksen takana, mutta otsikko näyttää ne, joten mikään ei muutu huomaamatta. |
| 2 | **Kaikki näkyvissä** | Neljä korttia: Milloin (tila, viive, ensimmäinen katsaus), Malli, Mitä katsaus lukee (viestit, historia, yksi viesti) ja Mitä katsaus kirjoittaa (sanat, Seuraavaksi, vastausraja). Lopussa on yhteenveto ja Palauta oletukset. | Kun luvut halutaan nähdä ja niitä halutaan verrata yhdellä silmäyksellä. | Pitkä sivu pienelle ominaisuudelle (11 riviä). Puhelimessa vieritettävää on paljon. |
| 3 | **Tasot** | Tila, viive ja malli yhdessä kortissa. *Katsauksen laajuus* -kohdassa ovat Lyhyt / Tavallinen / Perusteellinen / Oma, ja valitun tason luvut näkyvät taulukkona (lukee / kirjoittaa). Oma avaa luvut, ja minkä tahansa luvun muuttaminen siirtää valinnan Omaan. | Kun asetuksia käyttää muukin kuin luvuista kiinnostunut (esim. Kaisa): yksi valinta ja sen seuraus nähtävissä. | Tasojen nimet ja arvot ovat uusi tuotelupaus. Kun luku muutetaan, ollaan "Omassa", vaikka muutos olisi pieni. |
| – | **Nykyinen** | Ei osiota: kortti tulee aina 3 min jälkeen. | – | – |

## Säädöt, rajat ja mistä ne tulevat

Oletus on kaikissa nykyinen arvo, joten käyttöönotto ei muuta mitään.

| Säätö | Oletus = nyt | Raja prototyypissä | Miksi juuri tämä raja |
|---|---|---|---|
| Tilannekatsaus | Automaattisesti | Automaattisesti / Kun pyydän / Ei koskaan | Kierroksen 1 kolmas tila säilyi, koska Jari ei kommentoinut sitä. |
| Hiljaisuus ennen katsausta | 3 min | **1–9 min, 30 s välein**, liukusäädin ja arvo | Yläraja: Pi pysäytetään, kun se on ollut 10 min joutilaana ja edellisestä läsnäoloilmoituksesta on kulunut 10 min (`piIdlePeriod`, `internal/daemon/pi_activity_linux.go:253`). Tarkistus tehdään kerran minuutissa (`:254`), ja pysäytys pysäyttää myös katsauksen ajastimen (`:162`). Katsauksen ajastin ja pysäytys lasketaan samoista hetkistä: asettumisesta ja selaimen läsnäoloilmoituksesta (`notePresence`, `internal/daemon/recap_linux.go:417`). Kun katsaus on käynnissä, Pi pysyy hereillä (`s.recapping` `heldActivity`ssä, `pi_activity_linux.go:59`). Siksi kaikki alle 10 min viiveet ehtivät, ja 9 min jättää minuutin varaa. Alaraja: selain ilmoittaa lukemisesta tai kirjoittamisesta 20 s välein ja luonnoksesta 30 s välein (`web/src/app/recapHold.ts:16–17`), ja valmis kortti odottaa vielä 60 s (`recapQuietMs`, `:12`). Alle minuutin viive laukeaisi siis lukemisen aikana. |
| Katsauksen pituus | 40 sanaa | 10–80, 5 välein | Kehotteessa on "at most 40 words" (`PROMPT`, `internal/daemon/recap-extension.mjs:7`), ja kova merkkiraja on 320 (`clean(value?.recap, 320)`, `:74`). Aldern `conversation-recap` käyttää samoja (`RECAP_MAX_CHARS = 320`). |
| Seuraavaksi-rivi | 12 sanaa | 4–25 | Kehote "at most 12 words" (`:7`), merkkiraja 160 (`clean(value.next, 160)`, `:75`). Alder: `RECAP_NEXT_MAX_CHARS = 160`. |
| Luettavat viestit | 64 | 4–128, 4 välein | `messages(branch).slice(-64)` (`:27`). Mukana ovat vain käyttäjän ja agentin tekstiviestit, ei työkaluja. Alder lukee enintään 32 käyttäjän vuoroa (`RECAP_HISTORY_MAX_TURNS`). |
| Luettava historia enintään | ~16 000 tokenia | 2 000–32 000 | Kehote ja historia mahtuvat yhteensä 64 KiB:hen (`64 * 1024`, `:28`), mikä on noin 16 000 tokenia, kun arvioidaan 4 tavua tokenia kohden. Alder: `RECAP_PROMPT_MAX_BYTES = 64 * 1024`. Yläraja tulee ajasta: yritys saa kestää 12 s ja koko katsaus 20 s (`BUDGET_MS`, `ATTEMPT_MS`, `:57`), ja daemon luopuu kehotteesta 25 s jälkeen (`recap_linux.go:389`). 32k tokenia ehtii niissä, enempää ei voi taata. |
| Yhdestä viestistä enintään | ~1 000 tokenia | 250–4 000 | 4096 tavua (`:34`). Alderlla ei ole viestikohtaista rajaa. |
| Vastauksen yläraja | 512 tokenia | 128–2 048, 64 välein, varoitus alle (sanat + seuraavaksi) × 4 + 48 | `maxTokens: 512` (`:65`). Jos raja tulee vastaan, tulos on `model_incomplete`. Laajennuksen kommentin mukaan suomenkielinen JSON voi lähestyä 200:aa. Alder: `maxTokens: 160`. JSON-alueen raja on 2048 merkkiä (`:71`). |
| Ensimmäinen katsaus aikaisintaan | 1 vuoro | 1–10 | **Ei ole OH:ssa**: katsaus tehdään, kun edellisen katsauksen jälkeen on tullut uusi viesti (`:94`). Alderlla `MIN_COMPLETED_TURNS = 3` ja `MIN_TURNS_BETWEEN_RECAPS = 2`. Vuorolaskuri `completedTurns` on jo laajennuksessa (`:17`). |
| Malli | Automaattinen | Automaattinen tai mikä tahansa luettelon malli paitsi Fable- ja Opus-perhe | `backgroundModels` (`internal/daemon/background-model.mjs:36`). |

## Host-tiedot ja mitä kukin suunta tarvitsee

Kaikki kolme suuntaa tarvitsevat saman hostin. Ne eroavat vain ryhmittelyssä
(suunta 3 lisää tasojen nimet, jotka ovat pelkkää selainkoodia).

| Tieto | On nyt? | Missä / mitä puuttuu |
|---|---|---|
| Henkilön tilannekatsausasetus (tila, viive, malli, 7 lukua) | **Ei ole** | Ehdotus pysyy samana kuin kierroksella 1: oma avain Pi:n `~/.pi/agent/settings.json`-tiedostoon (`openHabitat.recap`). Pi sallii vieraat avaimet, ja laajennus lukee ne `pi.getSettings()`-kutsulla. Kirjoitus tehdään Pi:n lukolla Node-apurissa, kuten `internal/daemon/pi_models_helper.mjs:63` jo käyttää SettingsManageria. |
| Sopimus selaimelle (luku ja kirjoitus) | **Ei ole** | `contracts/v1/`-hakemistossa on `recap.schema.json` (kortin luku), `pi-models.schema.json` ja `pi-model-update.schema.json`, mutta ei asetusreittiä. |
| Daemon noudattaa viivettä ja tilaa | **Ei ole** | `delay := 3*time.Minute + time.Millisecond` (`recap_linux.go:213`). `recapIdleDelay` on vain testisauma (`conversation_linux.go:52`). Daemon lukee jo Pi:n asetuksia (`nativeSettingsProvideProcesses`, `recap_linux.go:487`). `recapHold.ts`:n kommentti "three minutes" muuttuu. |
| Viive yli 9 min | **Ei ole** (rajoite) | Vaatii, että joutilaana pysäytys odottaa ajastettua katsausta: joko `heldActivity` laskee odottavan ajastimen, tai `piIdlePeriod` on vähintään viive + 1 min. Tämä pitää Pi:n hengissä pidempään. Prototyyppi ei tarjoa tätä. |
| Laajennus lukee sanat, viestit, tavut ja vastausrajan asetuksesta | **Ei ole** | Kaikki ovat vakioita tiedostossa `recap-extension.mjs` (rivit 7, 27, 28, 34, 65, 74 ja 75). Merkkirajojen (320/160) ja JSON-alueen (2048) on kasvettava sanojen ja vastausrajan mukana, noin 8 merkkiä sanaa kohden. |
| Ensimmäinen katsaus vasta N vuoron jälkeen | **Ei ole** | `completedTurns` on olemassa (`recap-extension.mjs:17`). Tarvitaan ehto ennen `promptFor`-kutsua ja uusi tulos (esim. `too_early`), jonka daemon ohittaa hiljaa. |
| Henkilön mallitoive | **Ei ole** | `backgroundModels(available, conversation)` ei ota toivetta vastaan. Toive kokeillaan ensin, jos se on käytettävissä eikä kuulu Fable- tai Opus-perheeseen. Varalla on edelleen keskustelun oma malli. `title-helper.mjs` käyttää samaa funktiota, mutta sille ei viedä toivetta (päätös alla). |
| Mihin Automaattinen nyt osuu (palveluntarjoajittain) | **Ei ole** | Mallikatalogi on olemassa (`pi_models_linux.go`, `pi_models_helper.mjs`, `web/src/app/PiModels.tsx`). Apurin pitäisi ajaa `backgroundModels` kunkin palveluntarjoajan oletusmallilla ja palauttaa tulos, esim. `background_models: {provider: model}`. Ilman sitä Automaattinen-rivi näyttää vain säännön sanoin. |
| Mallin luettelo ja välilehdet | **On** | `PiModelSelector` (`web/src/app/PiModelSelector.tsx`) ja `ModelPicker` (`web/src/components/ModelPicker.tsx`). |

## Yksi mallivalitsin: mikä on nyt ja mikä muuttuu

Nyt mallin valitsemiseen on **yksi paneeli ja kaksi laukaisinta**.
Paneeli on `PiModelSelector`: palveluntarjoajan välilehdet (`Segmented`),
`ModelPicker`-rivit (radio, nimi, "Ei käytettävissä" torjutulle) ja *Vanhemmat
mallit* -taitos. Lisäksi siinä on ajattelutaso ja `scope`-kohtainen loppu
(`default`, `new`, `recovery`, `conversation`, `empty`).

- *Asetusrivin kenttä*: `DefaultModelRow` (`web/src/components/DefaultModelRow.tsx`).
  Kentässä ovat LetterMark, nimi, reitti, ajattelutaso ja ⇅. Kenttä avaa popoverin
  (470 px) tai puhelimessa arkin (`.dm-pop`, `Settings.css:604–650`).
- *Siru*: `ModelChip` + `ComposerModelPicker` (tyhjän keskustelun kenttä,
  `md-pop-up`). Keskustelun otsikon siru avaa tiedot
  (`ConversationModelInfo`), ei valitsinta.
- Keskustelun `md-new` (`<details>` + `PiModelSelector scope="new"`,
  `BrowserConversation.tsx:1331`) on kolmas, oma laukaisimensa. Dialogit
  (`WorkspacePage.tsx:340`, `NewConversationModelDialog.tsx`) näyttävät saman
  paneelin ilman laukaisinta.

Ehdotettu standardi (prototyypin `mpTrigger`, `mpPanel` ja `mpAnchor`/`mpSheet`):

1. **`ModelField`** = `DefaultModelRow`in kenttä ja säiliö yleistettynä
   (otsikko, arvo, `children`). Sitä käyttävät Oletusmalli ja Tilannekatsaus ›
   Malli. Oletusmallille ei tule näkyvää muutosta.
2. **`ModelPicker`** saa kaksi valinnaista ominaisuutta. `unavailable(m) →
   syy` yleistää nykyisen `refused`-tarkistuksen, ja sama rivi näyttää "Ei
   käytettävissä" ja "ei taustatöihin". `auto` lisää ylimmäksi riviksi
   *Automaattinen* ja kertoo, mihin se nyt osuu.
3. **`PiModelSelector` saa scopen `background`**: ei ajattelutasoa, koska
   `modelRegistry.complete` ei saa sitä (`recap-extension.mjs:65`). Ei
   myöskään Vahvista-painiketta: valinta tallentuu ja paneeli sulkeutuu
   heti, ja kirjoitus menee `onChoice`-kutsulla asetukseen, ei
   `chooseDefault`-kutsuun.
4. **Siru** (`ModelChip` + `ComposerModelPicker`) pysyy kompaktina
   laukaisimena, ja sen paneeli on sama. Keskustelun `md-new`-taitos
   kannattaa vaihtaa `ModelField`iin, jolloin sen ulkoasu muuttuu samaksi
   kuin Asetuksissa. Keskustelun otsikon tietosiru ei muutu.

## Suositus

**Suunta 1, Perus + lisät.** Neljä säätöä, joita oikeasti käytetään (tila,
viive, malli ja pituus), näkyvät heti. Tokenit ja viestimäärät ovat
kustannus- ja aikarajoja, joita useimmat eivät koske. Taitoksen otsikko
näyttää niiden arvot ja muutosten määrän, joten Jari näkee luvut avaamatta
taitosta, eikä mikään muutu huomaamatta. Suunta 2 tekee pienestä
ominaisuudesta Asetusten pisimmän sivun. Suunnan 3 tasot ovat uusi
nimettävä lupaus, ja niiden arvot pitäisi perustella. Jos Kaisan
kaltainen käyttäjä halutaan huomioida, suunnan 3 taso-valinta voidaan
myöhemmin lisätä suunnan 1 taitoksen sisään.

Toteutus kolmessa osassa:

1. Asetus Pi:n `settings.json`-tiedostoon, sopimusreitti ja daemonin
   viive ja tila (1–9 min). Lisäksi osio, liukusäädin ja kortin ratas.
2. Laajennuksen luvut asetuksesta, mukaan lukien merkkirajojen skaalaus ja
   "aikaisintaan N vuoroa". Lisäksi uusi numerokenttä (tuotannossa ei ole
   numero- eikä liukusäädinkomponenttia; `type="range"` ja `type="number"`
   puuttuvat `web/src`istä).
3. Mallitoive `backgroundModels`iin, `background_models` katalogiin ja
   yhteisen valitsimen muutokset (`ModelField`, `ModelPicker`in `auto` ja
   `unavailable`, scope `background`).

## Päätökset myöhempää tarkistusta varten

- **Viive 1–9 min, 30 s välein.** Vaihtoehdot: kokonaiset minuutit, tai
  rajaton viive niin, että Pi pidetään hereillä katsausta varten. Valinnan
  syy: 9 min on pisin, joka toimii nykyisellä joutilaana pysäytyksellä
  muuttamatta sitä, ja puoli minuuttia riittää "vapaaksi" ilman näennäistä
  tarkkuutta, koska läsnäoloilmoitukset tulevat 20–30 s välein.
- **Historia tokeneina, tallennus tavuina.** Laajennus mittaa UTF-8-tavuja.
  Näkymä näyttää tokeneita (tavut / 4) ja sanoo "noin". Vaihtoehdot:
  kilotavut (tarkka, mutta vieras) tai oikea tokenlaskenta (Pi:llä ei ole
  tokenisaattoria jokaiselle palveluntarjoajalle). Valinnan syy: Jari pyysi
  tokenimääriä, ja raja on joka tapauksessa arvio kustannuksesta.
- **Vastausrajaa ei johdeta sanoista, vaan liian pieni raja varoittaa.**
  Vaihtoehto: johtaa raja sanamäärästä ja piilottaa se. Valinnan syy: Jari
  pyysi näkyviin myös vastauksen tokenit. Varoitus kertoo seurauksen
  (katsaus katkeaa) ennen kuin se tapahtuu.
- **"Ensimmäinen katsaus aikaisintaan N vuoron jälkeen" mukana, oletus 1.**
  Vaihtoehto: jättää pois, koska OH:ssa ei ole tätä rajaa. Valinnan syy:
  Aldern laajennuksessa raja on (3), se on Jarin pyytämä "viestimäärä"
  -tyyppinen parametri, ja oletus 1 säilyttää nykyisen käytöksen.
- **Valittu malli koskee vain tilannekatsausta, ei automaattisia nimiä.**
  Vaihtoehto: sama toive myös nimille, kuten kierroksen 1 suunnassa 2.
  Valinnan syy: asetus on nyt tilannekatsauksen omassa osiossa, joten
  vaikutus nimiin olisi piilossa. Nimiapuri ei myöskään lataa
  pi-claude-bridgeä, joten Claude-tilauksen toive ei toimisi siellä.
- **Kolmas tila *Kun pyydän* säilyy kierrokselta 1.** Jari ei
  kommentoinut sitä, ja se on yksi segmentoitu valinta samalla rivillä.
- **Kortissa on ratas, ei valikkoa.** Kierroksen 1 suunta 3 (valikko
  kortissa) jäi pois, koska Jari valitsi oman osion. Ratas vie osioon
  kuten kierroksen 1 suunnassa 2.
- **Viiveriville ei tule selitystekstiä.** Jari pyysi poistamaan väärän
  tekstin. Rajat näkyvät asteikkona (1–9), joten selitystä ei tarvita.
- **Osion oletukset ovat nykyiset arvot.** Osion avaaminen tai
  käyttöönotto ei muuta yhtään katsausta.
- **Malli valitaan heti ja paneeli sulkeutuu.** Oletusmallissa paneeli
  pysyy auki ajattelutason valintaa varten, kuten tuotannossa.
