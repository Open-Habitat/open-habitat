# Aloitussivun kehityssuunnat — ideointi

Ideointikierros, ei toteutusta. Tuotantokoodi ei muuttunut. Jari valitsee,
mitä prototypoidaan.

## Jarille lyhyesti

Ulkopuolisen kehittäjän kolme havaintoa koskevat yhtä tilannetta: mitä
tapahtuu sen jälkeen, kun tavoite on valittu. Nykyinen sivu ohjaa hyvin
tavoitteen *valintaan*. Aloita kaataa kuitenkin koko agenttipyynnön
viestikenttään raakatekstinä, ja opas katoaa näkyvistä heti, kun keskustelu
alkaa.

**Suosittelen yhtä prototyyppikierrosta: ”Tavoite mukana keskustelussa”.**
Aloita lisää viestikenttään sirun, jossa näkyy tavoitteen nimi; pitkä pyyntö
aukeaa sirusta luettavaksi ja muokattavaksi. Oppaan vaiheet jäävät
sivupaneeliin keskustelun viereen. Paneelin komponentti on jo olemassa
taitopaneelissa. Suunnat vertailisivat, mihin pyyntö ja vaiheet sijoittuvat.
Seuraaviksi kierroksiksi sopivat lomakemainen aloitus (suunta 3) ja tavoitteen
aiemmat keskustelut (suunta 5).

Yksi asia vaatii päätöksesi jo ennen toteutusta: **säilyykö tieto tavoitteesta
lähetetyssä viestissä?** Pi tallentaa natiivisti vain taitokutsun
(`<skill name=…>`), ei prompt templatea eikä Habitatin omaa sirua. Jos siru
halutaan näkyviin myös historiaan, sivupaneeli halutaan takaisin sivun
uudelleenlatauksen jälkeen tai tavoitteen alle halutaan keskustelut, kantavan
tiedon on oltava natiivi taitokutsu. Silloin aloitussivutaito kirjoittaa
pitkästä pyynnöstä repoon taidon. Tämä ei siirrä valtuuksia, mutta muuttaa
aloitussivun muotoa ja taidon tehtävää.

## Lähtötilanne

Luin koodin ja issuet ennen ulkoisia lähteitä:

- `internal/daemon/start_page_linux.go`: daemon lukee
  `.agents/start-page.md`-tiedoston henkilön oikeuksin työtilan juuresta
  (`os.OpenRoot`, ei selaimen antamaa polkua). Tiedoston pitää olla
  tavallinen tiedosto ja henkilön UID:n omistama, enintään 32 KiB. Daemon
  validoi YAML-rungon ja poistaa `skill`-viittauksen, jota Pi:n
  komentolistassa ei ole.
- `internal/daemon/start-page-skill/SKILL.md`: muoto on `title`, runko ja
  0–8 tavoitetta. Kullakin tavoitteella on `title`, `what`, `when`, `steps`
  (1–8), `prompt` (enintään 2 KiB) ja valinnainen `skill`. Pyynnössä voi olla
  yksi `[paikkamerkki]`.
- `web/src/components/StartHere.tsx` ja `GoalGuide.tsx`: tavoiteotsikot
  näkyvät listana, ja otsikko avaa oppaan (Mitä saat / Milloin käytät / Näin
  etenet / Näytä pyyntö). Aloita (ylhäällä ja alhaalla) muodostaa luonnoksen
  `goalDraft`-funktiolla: valinnainen `/skill:nimi`, pyyntö, aiempi luonnos ja
  lopuksi valittuna oleva paikkamerkki. Mitään ei lähetetä.
  `GuideArticle` on yhteinen taitokutsun sivupaneelin kanssa.
- Aloitussivu näkyy vain uuden, tyhjän keskustelun tyhjässä tilassa
  (`PendingConversation.tsx`, `BrowserConversation.tsx`). Työtilasivulla on
  keskustelulista mutta ei tavoitteita.
- Kaksi oikeaa aloitussivua: tämän repon oma ja yksi yksityinen
  liiketoimintarepo. Jälkimmäisessä on viisi tavoitetta, joiden pyynnöt ovat
  pitkiä ja ohjaavat agentin alikansioiden `AGENTS.md`-ohjeisiin. Kolmessa on
  paikkamerkki. Juuri tällaisessa repossa raakapyyntö viestikentässä tuntuu
  raskaalta ihmiselle, joka ei ohjelmoi.
- **`proto-start-page-presentation` on käytännössä valmis.** Kierros 2:n
  Opas toteutui issuessa `implement-start-page-guides`, ja sitä hiottiin
  issueissa `start-page-guide-polish`, `start-page-placeholder-selection` ja
  `start-page-invalid-file-and-hint` (kaikki suljettu). Itse issue on yhä
  `in-progress`/`pending`. Kaikki alla olevat suunnat rakentavat Oppaan päälle
  eivätkä kilpaile sen kanssa. Ehdotan, että proto-issue suljetaan, kun tämä
  valinta on tehty.
- Historiassa näkyvä taitosiru (`internal/daemon/skill_linux.go`) syntyy
  Pi:n natiivista kääreestä `<skill name="…" location="…">`. Tämä on ainoa
  natiivi jälki siitä, mistä viesti sai alkunsa.
- Keskustelun otsikko voi tulla natiivista istuntonimestä (`session_info`) tai
  ensimmäisestä viestistä (`first_message_fallback`). Daemon lukee siis jo
  ensimmäisen viestin.
- Habitat näyttää Pi-laajennusten `select`/`input`/`confirm`-kysymykset
  (`pi_events_linux.go`, `PiQuestion.tsx`). Habitat ei kuitenkaan tarjoa
  mallille työkalua, jolla se voisi itse esittää valintakysymyksen.

### Mitä kokeilin ja mikä on dokumentaation varassa

**Kokeiltu** (birch, Pi 1.3.0, kertakäyttöinen repo `/var/tmp`:n alla):
projektin `.pi/prompts/korjaa.md` näkyy `pi --mode rpc --no-session`
-komennon `get_commands`-vastauksessa (`"source":"prompt"`,
`"scope":"project"`) projektin taitojen rinnalla. Habitatin komentolistassa
on jo tyyppi `"prompt"` (`web/src/app/composerReads.ts`). Mallikutsuja en
tehnyt, joten en ole tarkistanut, miten template kirjautuu istuntoon.

**Dokumentaation varassa** (Pi:n mukana tulleet `docs/`-tiedostot ja
ulkoiset ensilähteet, luettu 2026-10-26):

- Pi `prompt-templates.md`: template on `/nimi`-komento, jolla on
  `description`, `argument-hint` sekä argumentit `$1`, `$@` ja `${1:-oletus}`.
  ”Pi expands the template before the resulting text enters the agent.”
  Istuntoon jää siis laajennettu teksti, ei templaten nimeä (päätelty
  dokumentaatiosta, ei kokeiltu).
- Pi `skills.md`: `/skill:nimi`-komennon perässä olevat argumentit liitetään
  ohjeisiin käyttäjän pyyntönä. `disable-model-invocation: true` piilottaa
  taidon mallin automaattiselta valinnalta.
- Pi `session-format.md` ja `rpc-commands.md`: istuntonimi
  (`session_info`, `--name`, `set_session_name`) ja merkinnät (`label`).
- Pi `rpc-extension-ui.md`: laajennuksen dialogit `select`, `confirm`,
  `input` ja `editor` sekä vastausta odottamattomat `setWidget` ja
  `set_editor_text`.
- [VS Code prompt files](https://code.visualstudio.com/docs/copilot/customization/prompt-files):
  `${input:variableName:placeholder}` ja `argument-hint` (”Hint text shown in
  the chat input field”). Tämä on lähin ennakkotapaus lomakemaiselle
  aloitukselle uudelleenkäytettävässä kehotteessa.
- [Claude Code skills/commands](https://code.claude.com/docs/en/slash-commands):
  nimetyt argumentit (`arguments: [issue, branch]`), `argument-hint`,
  `disable-model-invocation` ja `user-invocable: false`.
- Kierros 2:n lähteet (Legora, Harvey, Linear, GitHub prompt-file-kirjasto)
  ovat `proto-start-page-presentation/result.md`:ssä. En hakenut niitä
  uudelleen. Harveyn ”Preview the plan, adjust the scope, and approve” tukee
  suuntaa 1/2, Linearin lomakepohjat suuntaa 3.
- OpenAI:n GPT-ohjeen ”conversation starters” -sivu palautti 403. En käyttänyt
  sitä, enkä väitä mitään sen sisällöstä.

## Kehityssuunnat

Arvio: **hyöty** ihmiselle, **hinta** toteutuksena, **suhde** Oppaaseen ja
**valtuudet** (gateway / daemon / provision).

### 1. Pyyntö sirussa, ei raakatekstinä

Aloita lisää viestikenttään sirun (”Korjaa havaittu ongelma ›”) ja
mahdollisen paikkamerkin; oma teksti kirjoitetaan sirun perään. Sirusta
aukeaa koko pyyntö luettavaksi. ”Muokkaa” purkaa sen tavalliseksi tekstiksi.
Tämä vastaa suoraan havaintoon ”vakiokehote piilotetaan tai sitä voi
muokata”.

Toteutuksia on kaksi, ja ero näkyy historiassa:

- **1a, pelkkä esitys:** siru on luonnoksen tilaa, ja lähetys lähettää koko
  tekstin. Hinta on pieni: vain web ja `goalDraft`. Historiaan jää kuitenkin
  raakateksti, ja lähetetty viesti näyttää erilaiselta kuin luonnos.
  Sivupaneelia (2) ja keskusteluja tavoitteen alla (5) ei voi palauttaa ilman
  arvailua.
- **1b, tavoite on taito:** aloitussivutaito kirjoittaa pitkästä pyynnöstä
  repoon taidon (`.agents/skills/<tavoite>/SKILL.md`,
  `disable-model-invocation: true`). Aloitussivun `prompt` lyhenee
  argumentiksi tai paikkamerkiksi. Habitatin olemassa oleva Siru näkyy
  historiassa natiivisti, ja sama siru voidaan näyttää jo luonnoksessa. Hinta
  on keskikokoinen: muodon tarkennus, taidon ohjeet ja viestikentän
  sirueditori. Taidot näkyvät myös `/`-listassa ja terminaalin Pi:ssä. Sitä
  voi pitää etuna, koska sama tavoite toimii SSH:n yli, tai haittana, koska
  `/`-lista kasvaa.

Suhde Oppaaseen: jatke, eikä se muuta opassivua. Valtuudet: ei muutoksia.
Daemon tarkistaa jo nyt taidon olemassaolon komentolistasta.

### 2. Vaiheet keskustelun vierellä

Aloita avaa oppaan vaiheet sivupaneeliin (työpöydällä vasemmalla tai
oikealla, puhelimessa yläpalkin painikkeesta), ja ne pysyvät näkyvissä koko
keskustelun ajan. Tämä on kehittäjän ”vasemmalla tehtävän vaiheet”.

Vaiheet ovat ohjetekstiä, eivät edistymistä. Habitat ei tiedä, missä
vaiheessa agentti on. Rastit tai ”vaihe 2/4” olisivat joko arvausta tai uusi
tilavarasto, mikä rikkoisi juuriohjeen periaatteen. Rehellinen edistyminen
vaatisi natiivin lähteen, esimerkiksi agentin itse päivittämän Pi-laajennuksen
`setWidget`-tiedon. Se olisi oma, myöhempi päätös.

Hinta on pieni: `GuideArticle` ja taitopaneeli ovat olemassa. Kytkös
keskusteluun on joko välilehden muistissa (katoaa uudelleenlatauksessa) tai
natiivi taitokutsu (1b), jolloin paneelin voi avata myöhemminkin. Suhde
Oppaaseen: sama sisältö uudessa paikassa. Valtuudet: ei muutoksia.

### 3. Lomakemainen aloitus

Opas näyttää 1–3 nimettyä kenttää (”Mikä muuttui?”, ”Lähde”), ja Aloita
kokoaa niistä pyynnön. Nyt sallitaan yksi `[paikkamerkki]`, joka valitaan
viestikentässä. Ennakkotapauksia ovat VS Coden `${input:nimi:vihje}`, Claude
Coden nimetyt argumentit ja Linearin lomakepohjat.

Hyöty on suurin ei-teknisille ja toistuville tehtäville (”kuvaa muutos ja sen
lähde”), koska ihminen ei joudu muotoilemaan pyyntöä itse. Hinta on
keskikokoinen: muoto saa `inputs`-kentän, ja tarvitaan validointi ja kentät.
Riskinä on kasvu lomakemoottoriksi, jossa on pakollisuudet, tyypit ja
valintalistat. Kevyempi vaihtoehto on sallia useampi paikkamerkki ja siirtyä
niiden välillä sarkaimella koodieditorin snippetin tapaan, jolloin uusia
kenttiä ei tarvita. Suhde Oppaaseen: lisäys opassivuun, joka korvaa
paikkamerkkilogiikan. Valtuudet: ei muutoksia, koska kaikki on luonnoksen
tilaa.

### 4. Aloita klikkaamalla, agentti kysyy

Kehittäjän ”ihminen klikkailee ensin liikkeelle ennen kuin kirjoittaa”.
Tavoite lähettää pyynnön heti, ja agentti kysyy puuttuvat tiedot
valintakysymyksinä. Habitat näyttää jo laajennusten `select`/`input`-dialogit,
mutta malli tarvitsisi niiden esittämiseen työkalun eli Pi-laajennuksen.

Tämä on ristiriidassa aiemman päätöksesi kanssa: **Aloita ei koskaan
lähetä.** Lisäksi Habitatin toimittama, mallin käytössä oleva työkalu on uusi
riippuvuus. Siksi en suosittele tätä nyt. Lomake (3) tuottaa saman hyödyn
ilman lähetystä.

### 5. Aiemmat keskustelut tavoitteen alla

Oppaan alaosassa lukisi ”Aiemmin tällä tavoitteella”: kolme tuoreinta
keskustelua ja valinta *jatka* tai *aloita uusi*. Samaa tietoa voisi käyttää
työtilan keskustelulistan ryhmittelyssä.

Pohjaksi kelpaa vain natiivi lähde. Daemon lukee jo ensimmäisen viestin
otsikkoa varten. Taitokutsun nimi (1b) on luotettava tunniste, kun taas
pyynnön tekstin vertaaminen hajoaa heti, kun aloitussivua muokataan. Hinta on
keskikokoinen: daemon lukee ensimmäisen viestin kääreen ja sopimus saa uuden
kentän tai suodattimen. Selaimelle ei synny uutta tallennetta. Valtuudet:
daemon lukee henkilön omia istuntoja, joten muutosta ei tule. Toisen
henkilön keskusteluja ei näytetä: tiimikaveri näkee vain omat keskustelunsa,
koska Unix-käyttäjä on raja.

### 6. Toistuvat työt

**6a, ”Tee uudelleen”:** tämä on suunta 5 ilman uutta mekanismia. Hinta on
pieni, jos 5 toteutetaan.

**6b, ajastettu tavoite** (”joka maanantai: kokoa viikon muutokset”): daemon
tai järjestelmän ajastin käynnistäisi agentin ilman, että ihminen on paikalla.
Tämä on **arkkitehtuurimuutos**. Agentti käyttäisi henkilön tunnuksia ja
tilausta ilman istuntoa, ja jonkun pitäisi päättää, kuka ajon hyväksyy, mihin
tulos menee ja mitä tapahtuu virheessä. Natiivi vaihtoehto on henkilön oma
`systemd --user`-ajastin tai `cron`, joka ajaa `pi -p` SSH:n kautta, eli se
toimisi ilman Habitatia. En suosittele tätä aloitussivun yhteyteen. Jos
ajastetut agentit halutaan, ne tarvitsevat oman issuen ja ADR:n.

### 7. Ei-teknisen käyttäjän aloitus

Kolme pientä parannusta:

- Ohjeteksti ”Luo aloitussivu kirjoittamalla `/open-habitat-start-page`”
  muuttuu painikkeeksi, joka lisää taitokutsun luonnokseen.
- Aloitussivutaito saa ohjeen ihmisille, jotka eivät ohjelmoi: ei
  tiedostopolkuja vaiheissa, pyynnöt taitoihin (1b) ja paikkamerkit
  tavallisin sanoin.
- Sivun alaosaan tulee ”Päivitetty 12.10., päivittäjä X” Gitin historiasta
  sekä painike ”Ehdota päivitystä”. Ylläpito näkyy, ja tieto tulee natiivista
  Gitistä.

Hinta on pieni. Valtuudet: ei muutoksia, koska daemon lukee Gitiä jo muissa
näkymissä.

Laajempi kysymys on, mitä ihminen näkee **ennen kuin hänellä on repoa**.
Silloin tarvittaisiin henkilön oma (`~/.agents/start-page.md`) tai koko
palvelimen yhteinen aloitussivu. Henkilön oma on daemonin luettavissa ilman
muutoksia. **Palvelimen yhteinen on valtuuskysymys:** yhden käyttäjän
tiedostoa ei saa lukea toisen puolesta, joten sivu olisi asennuksen tai
ylläpitäjän juuren omistama mallitiedosto (Fleetrepon asennus). Daemonin
UID-tarkistus vaatii nyt henkilön omistajuuden. Tämä on sinun päätöksesi, jos
suunta valitaan.

### 8. Tavoitteet työtilasivulla

Tavoitteet näkyvät myös työtilasivun keskustelulistan yläpuolella. Klikkaus
avaa uuden keskustelun valmiilla luonnoksella. Tällöin henkilön ei tarvitse
ensin avata tyhjää keskustelua, mikä vastaa klikkaamalla liikkeelle
lähtemiseen ilman lähettämistä. Hinta on pieni tai keskikokoinen: sama luku
toiseen paikkaan ja luonnoksen välitys luontiin. Valtuudet: ei muutoksia.

## Vertailu

| Suunta | Hyöty | Hinta | Valtuudet | Suositus |
| --- | --- | --- | --- | --- |
| 1 Pyyntö sirussa | suuri, vastaa suoraan palautteeseen | 1a pieni / 1b kesk. | ei muutosta | **prototyyppi nyt** |
| 2 Vaiheet vierellä | suuri pitkissä tehtävissä | pieni | ei muutosta | **samaan prototyyppiin** |
| 3 Lomakemainen aloitus | suuri ei-teknisille | kesk. | ei muutosta | seuraava kierros |
| 4 Agentti kysyy | kesk. | kesk. + uusi työkalu | ei, mutta kumoaa ”Aloita ei lähetä” -päätöksen | ei nyt |
| 5 Keskustelut tavoitteen alla | kesk., kasvaa käytön myötä | kesk. | daemonin natiivi luku | seuraava kierros, jos 1b valitaan |
| 6a Tee uudelleen / 6b ajastus | 6a pieni / 6b suuri | 6a pieni / 6b suuri | 6b on arkkitehtuuripäätös | 6a suunnan 5 mukana; 6b ei nyt |
| 7 Ei-tekninen aloitus | kesk. | pieni | palvelimen yhteinen sivu on päätös | pienet osat suoraan toteutukseen |
| 8 Tavoitteet työtilasivulla | kesk. | pieni/kesk. | ei muutosta | myöhemmin |

## Valtuudet: mikä vaatii Jarin päätöksen

Suunnat 1, 2, 3, 5, 7 (henkilön oma sivu) ja 8 pysyvät nykyisessä jaossa.
Daemon lukee henkilön oikeuksin natiivit tiedostot, istunnot ja Gitin.
Gateway ei saa uutta tietoa eikä provision uutta tehtävää. Mikään suunta ei
tuo uutta tallennetta.

Päätöstä vaativat:

1. **Ajastetut tavoitteet (6b):** agentti käynnistyy ilman ihmistä. Kuka
   valtuuttaa, missä ajastus asuu (henkilön `systemd --user` vai daemon) ja
   miten tulos näytetään. Tarvitsee oman ADR:n.
2. **Palvelimen yhteinen aloitussivu (7):** muun kuin henkilön omistama
   lähde. Lukeminen pitää rajata asennuksen omistamaan polkuun, eikä se saa
   koskaan tulla toisen käyttäjän kotihakemistosta.
3. **Aloita lähettää (4):** tuotepäätös, ei valtuuskysymys. Mainitsen sen,
   koska se kumoaisi aiemman päätöksesi.

Lisäksi suunnan 1 kohdalla valitaan joko 1a tai 1b. Tämä on muotopäätös, ei
valtuuspäätös.

## Suositus

**Prototypoi yksi kierros: ”Tavoite mukana keskustelussa” (suunnat 1 ja 2).**
Kierros jatkaa nykyistä tuotannon Opasta samalla synteettisellä datalla kuin
`proto-start-page-presentation`. Mukaan otetaan työpöytä ja puhelin sekä
vaalea ja tumma teema. Vertailtava akseli on, missä pyyntö ja vaiheet ovat
Aloitan jälkeen:

- **A, siru ja paneeli:** viestikentässä on tavoitesiru, josta pyyntö
  aukeaa; vaiheet ovat sivupaneelissa koko keskustelun ajan, ja paneelin voi
  sulkea.
- **B, siru ilman paneelia:** siru kuten A:ssa, ja vaiheet näkyvät sirusta
  avautuvassa kortissa vain pyydettäessä.
- **C, raakateksti ja paneeli:** nykyinen raakateksti säilyy (näkyvä ja
  muokattava), mutta vaiheet tulevat paneeliin. Tämä on vertailukohta sille,
  riittääkö pelkkä paneeli.

Prototyyppi näyttää myös lähetetyn viestin historiassa sirulla, jolloin 1b:n
vaikutus näkyy. Jos valitset A:n tai B:n, toteutus kulkee 1b:n kautta:
aloitussivutaito kirjoittaa pitkästä pyynnöstä taidon. Se avaa samalla tien
suunnalle 5.

Kierros 3 (lomakemainen aloitus) ja suunnan 7 pienet osat (painike tyhjässä
tilassa, päivityspäivä Gitistä) kannattaa ottaa seuraaviksi. Suunnan 7 pienet
osat eivät tarvitse prototyyppiä.
