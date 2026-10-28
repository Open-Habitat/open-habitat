# Tulos: tilannekatsauksen asetukset

Prototyyppi on `prototypes/recap-settings/index.html`, yksi offline-HTML. Se on
käsin kirjoitettu sivu
(`design-system/prototypes/rounds/2026-10-28-tilannekatsaus-asetukset/page.html`),
jonka `build.mjs` täydentää tokeneilla, upotetuilla fonteilla ja yhteisellä
valitsimella (`lib/picker.*`). Tuotantokomponenttien bundlea ei käytetä, koska
se jää Habitatin näkymissä tyhjäksi. Jarin opas on
`prototypes/recap-settings/NOTES.md`, ja kuvat ovat `evidence/`-hakemistossa
AVIF-muodossa (laitteen skaalaus 2, muunnos ffmpeg:llä). `verify.mjs` tarkistaa 36 sijoittelutapausta
(4 suuntaa × 3 tilaa × 3 hiljaisuutta). Lisäksi se klikkaa läpi seuraavat:
Luo katsaus, Asetuksissa tehdyn muutoksen näkyminen keskustelussa, suunnan 2
ratas ja mallivalinta (Fablea ja Opusta ei voi valita) sekä suunnan 3 valikko,
Esc, muutosrivi ja Kumoa. Konsolivirheitä ja verkkopyyntöjä ei ollut, ja
valitsin läpäisee `picker-check`in.

Nykytila on luettu koodista, eikä labia ajettu. Kortin ulkoasu ja paikka on
otettu tiedostoista `RecapCard.tsx` ja `components.css` (`.ah-recap`) ja
Asetusten rakenne tiedostoista `Account.tsx` ja `Settings.css`.

## Nykytila: mitä voi säätää nyt

Ei mitään. Automaattinen katsaus ajastetaan daemonissa kiinteällä
kolmen minuutin viiveellä, ja malli valitaan kiinteällä säännöllä.
Selaimessa on vain kortin sulkeminen (`localStorage`-avain
`oh:recap-dismissed:<keskustelu>`) ja Päivitä katsaus.

## Host-tiedot

| Tieto | On nyt? | Missä / mitä puuttuu |
|---|---|---|
| Automaattisen katsauksen ajastus | **On**, kiinteä | `scheduleAutomaticRecap`, `recap_linux.go:206`. Viive on `3*time.Minute` (`:213`). Kenttä `recapIdleDelay` on vain testisauma (`conversation_linux.go:52`). |
| Mistä hiljaisuus lasketaan | **On** | Natiivista asettumisesta ja selaimen läsnäoloilmoituksista. Selain ilmoittaa enintään 20–30 s välein, kun henkilö kirjoittaa tai lukee (`recapHold.ts:16`). Valmis automaattinen kortti odottaa vielä 60 s kirjoittamisen tai lukemisen jälkeen (`recapQuietMs`, `recapHold.ts:12`). |
| Viiveen yläraja | **On** rajoite | Pi:n lapsiprosessi pysäytetään 10 minuutin hiljaisuuden jälkeen (`piIdlePeriod`, `pi_activity_linux.go:253`). Katsaus ajetaan saman Pi-lapsen komentona (`/oh-conversation-recap automatic`), joten viiveen on oltava selvästi alle 10 min. Siksi valinnat ovat 1, 3 ja 5 min. |
| Pyydetty katsaus (Luo / Päivitä katsaus) | **On** | `POST …/agents/<id>/recap` (`requestRecap`, `conversations.ts`), trigger `manual`. "Kun pyydän" -tila ei tarvitse uutta palvelinta varten. |
| Hiljaisuuden alkuhetki selaimessa | **On** | `latest_message_at` katsauksen lukuvastauksessa (`recap.schema.json`). Selain voi itse päättää, milloin *Luo katsaus* -rivi näytetään. |
| Asetus "tila" (auto / kun pyydän / ei) ja viive | **Ei ole** | Daemonin on luettava asetus ennen ajastusta: `ask`- ja `off`-tiloissa ajastinta ei käynnistetä, ja viive tulee asetuksesta. Selain tarvitsee lukureitin (sopimus `contracts/v1/`), jotta se näyttää oikean rivin ja Asetukset. |
| Mallin valintasääntö | **On** | `backgroundModels`, `background-model.mjs`: keskiluokka (sonnet, luna, flash, medium, mini) keskustelun palveluntarjoajalta, varalla keskustelun oma malli, Fable ja Opus suljettu pois myös varalta. Sama sääntö on automaattisilla nimillä (`title-helper.mjs`). Nimiapuri ei kuitenkaan lataa pi-claude-bridgeä, joten nimet voi tehdä eri malli kuin katsauksen (kommentti `background-model.mjs`:ssä). |
| Mikä malli katsauksen teki | **Ei selaimelle** | Laajennus raportoi mallin daemonille, mutta tieto päätyy vain journaliin (`recap_linux.go:247`). Kirjoitetussa merkinnässä (`appendEntry`, `recap-extension.mjs:110`) ja sopimuksessa ei ole mallia. |
| Mitä mallia käytettäisiin (Asetuksissa näytettäväksi) | **Ei ole** | Pi:n mallikatalogi saadaan jo apurilla (`pi_models_linux.go`, `pi_models_helper.mjs`). Saman apurin pitäisi ajaa `backgroundModels` oletusmallilla ja palauttaa tulos, esimerkiksi kenttänä `background_model`. Suunnat 1–3 tarvitsevat tämän. |
| Henkilön valitsema malli (suunta 2) | **Ei ole** | `backgroundModels` ei ota toivetta vastaan. Toive kokeiltaisiin ensin, jos se on käytettävissä eikä kuulu Fable- tai Opus-perheeseen. Varalla olisi edelleen keskustelun oma malli. Valinta koskisi myös nimiä. |
| Natiivi paikka asetukselle | **On**, avain puuttuu | Pi 1.3.0:ssa ei ole tilannekatsaus- eikä taustamalliasetusta (`compaction.modelOverrides` koskee vain tokenimääriä). Pi:n `settings.json` sallii omat avaimet (`additionalProperties: true`, `settings-schema.js:290`) ja säilyttää ne kirjoittaessaan, koska vain muutetut kentät yhdistetään (`persistScopedSettings`, `settings-manager.js:449`). Laajennus lukee ne `pi.getSettings()`-kutsulla (`extensions/types.d.ts:1286`), ja daemon lukee tiedostoa jo nyt (`nativeSettingsProvideProcesses`, `recap_linux.go:487`). SettingsManagerissa ei ole setteriä omalle avaimelle, joten kirjoitus tehdään Pi:n omalla tiedostolukolla (`settings.json.lock`) Node-apurissa, kuten `pi_models_helper.mjs` jo käyttää SettingsManageria. |
| Natiivi TUI:n tilannekatsaus | **Tuntematon** | `recap-extension.mjs:15` mainitsee natiivin TUI-laajennuksen vuorolaskurin. Laajennusta ei löytynyt tästä reposta eikä tämän koneen Pi-asetuksista, joten ei tiedetä, noudattaisiko se samaa avainta. |
| Etusivun katsaukset | **On** | `HomeWorkspaces.tsx` näyttää jo tehdyt katsaukset. "Ei koskaan" -tilassa uusia ei synny, joten etusivu tyhjenee vähitellen ilman muutosta. |
| Valtuudet | Ei muutosta | Daemon ajaa henkilön omana Unix-käyttäjänä ja lukee ja kirjoittaa vain hänen kotihakemistonsa tiedostoa. Gateway ja provision eivät osallistu. |

## Akseli: missä tilannekatsausta säädetään

Kaikissa suunnissa säädettävää on sama: tila (Automaattisesti / Kun pyydän /
Ei koskaan) ja hiljaisuus (1 / 3 / 5 min). Malli näkyy kaikissa suunnissa,
mutta valita sen voi vain suunnassa 2. "Kun pyydän" näyttää hiljaisuuden
jälkeen kortin paikalla ohuen katkoviivarivin *Luo katsaus*, eikä mallia
käytetä ennen painallusta. Asetus koskee henkilöä, ei selainta eikä
keskustelua.

| # | Suunta | Mitä se päättää | Milloin oikea | Mitä se maksaa |
|---|---|---|---|---|
| 1 | **Tekoälyn alla** | Asetukset › Tekoäly saa *Taustatyöt*-kortin: Tilannekatsaus, Hiljaisuus ennen katsausta ja Malli (näytetään). Keskustelun kortti ei muutu. | Kun säätöä tarvitaan harvoin, ja riittää, että se löytyy mallien vierestä. | Kortissa ei ole vihjettä siitä, että katsausta voi säätää. Ärsyyntynyt henkilö sulkee kortin joka kerta eikä löydä asetusta. |
| 2 | **Oma osio** | Uusi Asetusten kohta *Tilannekatsaus*: esikatselu, Milloin ja Malli-luettelo, josta valitaan (Fable ja Opus harmaina, perusteluna "ei taustatöihin"). Kortissa on ratas, joka vie riville. Tekoäly-osiossa on rivi, joka vie tänne. | Kun mallin valinta halutaan henkilölle ja tilannekatsaus nähdään omana ominaisuutenaan. | Uusi osio pieneen asiaan. Mallivalinta laajentaa sääntöä toiveella, ja valinta koskee myös nimiä, mikä ei näy osion nimestä. Kortissa on neljäs kuvake. |
| 3 | **Kortista** | Asetuksissa ovat samat rivit kuin suunnassa 1. Kortin `⋯`-valikossa ovat viive, *Vain kun pyydän*, *Ei tilannekatsauksia*, malli tekstinä ja *Kaikki asetukset…*. Muutoksen jälkeen kortin paikalle tulee rivi "…kaikissa keskusteluissasi", ja rivillä ovat Kumoa ja Asetukset. | Kun säätö halutaan siihen hetkeen, jolloin kortti häiritsee tai tulee liian aikaisin. | Kortin kevyeen otsikkoon tulee valikko. Valinta kortista muuttaa kaikkien keskustelujen asetusta, ja vain muutosrivi kertoo sen. |
| – | **Nykyinen** | Ei asetusta: kortti tulee aina 3 min jälkeen. | – | – |

## Mitä host-tietoja kukin suunta tarvitsee

| Tieto | On nyt? | 1 | 2 | 3 |
|---|---|---|---|---|
| Tila ja viive henkilön asetuksena, daemon noudattaa | **Ei ole** | tarvitaan | tarvitaan | tarvitaan |
| Asetuksen luku ja kirjoitus selaimesta (sopimus) | **Ei ole** | tarvitaan | tarvitaan | tarvitaan |
| Pyydetty katsaus ja `latest_message_at` | **On** | Kun pyydän | Kun pyydän | Kun pyydän |
| Malli, jota sääntö nyt käyttäisi (`background_model`) | **Ei ole** | näytetään | Automaattinen-rivi | valikossa |
| Henkilön mallitoive sääntöön | **Ei ole** | – | tarvitaan | – |
| Kortin tekijämalli merkinnässä ja sopimuksessa | **Ei ole** | – | (esikatselu käyttää valintaa) | – |

## Suositus

**Suunta 3, Kortista.** Tilannekatsauksen säätöä tarvitaan juuri silloin, kun
kortti tulee liian aikaisin tai häiritsee, ja kortti on silloin silmien
edessä. Suunnassa 1 asetus on olemassa, mutta kukaan ei löydä sitä kortista
käsin. Suunta 3 sisältää myös suunnan 1 Asetus-rivit (Tekoäly ›
Taustatyöt), joten kohta asetuksissa on, kuten Jari pyysi. Muutosrivi ja Kumoa
estävät sen, että yksi napautus muuttaa kaikki keskustelut huomaamatta.

Mallin valintaa ei kannata antaa vielä (suunta 2). Jarin sääntö (keskiluokka,
ei koskaan Fable tai Opus, varalla keskustelun oma malli) on juuri päätetty,
ja sen tavoite on suojata kalleinta kiintiötä. Kun malli näkyy, henkilö tietää,
mitä tilausta katsaus kuluttaa. Toive voidaan lisätä myöhemmin ilman, että
mikään tässä muuttuu.

Toteutus kahdessa osassa:

1. Asetus `openHabitat.recap = { mode: "automatic" | "ask" | "off",
   idleMinutes: 1 | 3 | 5 }` Pi:n `settings.json`-tiedostoon, kirjoitus Pi:n
   lukolla. Daemon lukee asetuksen ennen ajastusta, ja selaimelle tulee luku-
   ja kirjoitusreitti. Lisäksi tarvitaan Tekoäly › Taustatyöt, "Kun pyydän"
   -rivi ja kortin valikko.
2. `background_model` mallikatalogin vastaukseen, jotta malli näkyy
   Asetuksissa ja valikossa. Siihen asti malliriviä ei näytetä.

## Päätökset myöhempää tarkistusta varten

- **Kolmas tila "Kun pyydän".** Vaihtoehto: pelkkä Päällä/Pois. Valinnan
  syy: pois kytkemisen syy on usein kiintiö, ei itse katsaus. Rivi *Luo
  katsaus* antaa katsauksen silloin, kun sitä tarvitsee, eikä kuluta mallia
  muulloin. Lisäksi tuotannosta puuttuu nyt kokonaan tapa pyytää katsausta, kun
  korttia ei ole näkyvissä.
- **Viiveet 1, 3 ja 5 min.** Vaihtoehto: vapaa minuuttimäärä tai 10 min ja
  enemmän. Valinnan syy: Pi lepää 10 minuutin kohdalla, ja katsaus tarvitsee
  elävän Pi:n. Pidempi viive vaatisi Pi:n käynnistämistä uudelleen pelkkää
  katsausta varten.
- **Asetus koskee henkilöä, ei selainta eikä keskustelua.** Vaihtoehdot:
  selaimen `localStorage` (kuten teema ja Agentin työ) tai keskustelukohtainen
  asetus. Valinnan syy: daemon käyttää mallia, vaikka selain ei olisi auki, joten
  vain henkilön asetus voi estää kulutuksen. Keskustelukohtaista tarvetta ei ole
  näytetty.
- **Tallennus Pi:n `settings.json`-tiedostoon omalla avaimella.**
  Vaihtoehto: oma tiedosto Pi:n hakemistossa (kuten pi-claude-bridgen
  `~/.pi/agent/claude-bridge.json`), joka on helpompi kirjoittaa ilman Pi:n
  lukkoa. Valinnan syy: asetus pysyy henkilön natiivissa Pi-asetuksessa, jonka
  laajennus lukee suoraan `pi.getSettings()`-kutsulla, ja natiivi käyttäjä
  löytää sen samasta paikasta kuin oletusmallin. Pi säilyttää vieraat avaimet.
  Kirjoitus Pi:n lukolla on toteutuksen ehto.
- **Malli näytetään, mutta sitä ei valita.** Vaihtoehto: suunnan 2
  valintaluettelo. Valinnan syy: sääntö on Jarin tuore päätös
  (`recap-model-spends-fable`), ja varalla oleva malli hoitaa loppuneen
  kiintiön.
- **Taustatyöt-otsikko Tekoälyn alla.** Vaihtoehto: oma osio. Valinnan syy:
  Tekoäly-osio kertoo jo, mitä malleja ja tilauksia on. Taustatyöt
  (katsaus ja nimet) käyttävät samoja tilauksia, ja otsikon alle mahtuu
  myöhemmin automaattisten nimien säätö.
- **Muutos kortista koskee kaikkia keskusteluja ja kertoo sen.** Vaihtoehto:
  kortin valinta vain tähän keskusteluun. Valinnan syy: sama kuin henkilön
  asetuksessa. Kumoa korjaa vahingon.
