# Vastaa agentin viestiin

## Kierros 1

Kierros: `design-system/prototypes/rounds/2026-11-22-reply-to-message/`
(`NOTES.md` kertoo rakenteen, rakennuskomennon ja tarkistuksen). Sivu on
rakennettu tuotannon komponenteista ja tokeneista (sivupalkki, otsake,
viestit, työkalurivit, aikajana, kenttä); kierroksen omia ovat vain
vastausnuoli, lainaus, kieleke ja kohdan korostus.

Kaikissa suunnissa on sama perusta:

- Jokaisen agentin vastauksen oikeassa yläkulmassa on pieni ↩-painike
  *Vastaa tähän viestiin*. Työpöydällä se näkyy osoittimen alla tai
  fokuksessa kuten Palaa tähän -valikko, puhelimessa aina. Vastattavan
  viestin painike jää korostetuksi niin kauan kuin vastaus on kesken.
- Painallus vie lainauksen kentän yläpuolelle ja fokuksen kenttään.
- Lainauksen painaminen vierittää alkuperäisen viestin näkyviin ja
  korostaa sen hetkeksi; vähennetyllä liikkeellä vieritys on välitön ja
  korostus on liikkumaton reunus. Sama toimii lähetetyn viestin
  lainauksesta.
- ✕ poistaa lainauksen; luonnos jää kenttään.
- Lähetetty viesti kantaa viittauksen, ja agentti saa viestin
  natiivin tunnisteen ja lainatun otteen (ks. alla).

Akseli: kuinka paljon viestistä viittaus kantaa ja kuinka raskaana se
istuu kentässä ja lähetetyssä viestissä.

1. **A Lainaus**: kentän yllä kortti, jossa viestin alku kahdella rivillä
   (*Vastaat agentin viestiin · klo 9.20*). Lähetetyn viestin alussa on
   sama lainaus.
2. **B Kohta**: kuten A, mutta tekstiä voi valita vastauksesta, ja
   valinnan yllä on *Vastaa tähän kohtaan*. Lainaukseen tulee vain
   valittu kohta lainausmerkeissä, ja kohta pysyy alkuperäisessä
   korostettuna, kunnes lähetät. Kulmapainike lainaa koko viestin.
3. **C Kieleke**: yksi rivi kiinni kentän yläreunassa (*↩ Agentti 9.20
   Kaksi tapaa: …*). Lähetetyn viestin yllä on vain linkkirivi
   *Vastaus agentin viestiin klo 9.14* ilman otetta.

Oletusnäkymässä vastaus klo 9.20 viestiin on kesken ja historiassa on yksi
lähetetty vastaus, joten suuntien ero näkyy heti. Sivun yläreunassa on
jokaisesta suunnasta yksi rivi ja suositus. *Näytä, mitä agentti saa*
näyttää jokaisen vastauksen alla tekstin, jonka natiivi istunto saisi.

**Suositus: A.** Se on WhatsAppista tuttu, eikä se vaadi puhelimessa
tekstin valintaa, joka on kosketusnäytöllä hankalaa ja kilpailee
selaimen oman valintavalikon kanssa. Lainaus näkyy myös lähetetyssä
viestissä, joten keskustelua myöhemmin lukeva näkee, mihin vastattiin.
C on kevyin, mutta lähetetystä viestistä ei näe, mihin vastattiin,
ellei hyppää. B:n kohdan valinnan voi lisätä myöhemmin samaan korttiin
työpöydän lisänä.

### Tarkistus

`check.mjs` kävi kaikki kolme suuntaa Päivä-, Yö- ja Korkea kontrasti
-teemassa 1440 ja 390 px:n leveydellä: oletusnäkymä, hyppy kentän
lainauksesta ja lähetetyn viestin lainauksesta, ✕, uusi vastaus
kulmapainikkeesta, B:n kohdan valinta, lähetys ja agentille menevä
teksti. 306 tarkistusta meni läpi, ja konsoli pysyi puhtaana.
Kuvakaappaukset (DPR 2) ovat tallessa repositorion ulkopuolella
hakemistossa `/var/tmp/agent-keep/reply-to-agent-message/`.

## Kierros 2: lainaus design systemin kielellä

Kierros: `design-system/prototypes/rounds/2026-11-23-reply-to-message-2/`
(`NOTES.md` kertoo rakenteen, rakennuskomennon ja tarkistuksen). Jarin
päätös 23.11.: A on pohja, mutta ilman vasemman reunan värillistä palkkia tai
muuta design systemille vierasta. Kierroksen 1 kortissa oli juuri se
(`border-left: 3px solid var(--ah-accent)`), ja lähetetyssä lainauksessa sama
ohuempana.

Akseli: minkä olemassa olevan pinnan lainaus lainaa, ja mikä kulmapainikkeen
paikka ja alkuperäisen merkintä sopivat sen pariksi. Missään suunnassa ei ole
uutta tokenia tai vierasta pintaa; lainauksen tunnistaa sanoista *Vastaat
agentin viestiin*, kellonajasta ja ↩-kuvakkeesta, ei väristä.

1. **A Liite**: lainaus on luonnoksen liitekortin näköinen (`.ah-attachment-chip`:
   `--ah-line`, `--ah-r-md`, `--ah-surface`) kentän yllä, jossa liitteetkin
   ovat. ↩ on viestin oikeassa yläkulmassa `actions`-paikassa kuten Palaa tähän
   -valikko; työpöydällä se näkyy osoittimen alla tai fokuksessa ja jää
   näkyviin, kun viestiin vastataan. Alkuperäinen ei ole merkitty, mutta hyppy
   välähdyttää sen.
2. **B Kentän sisällä**: lainaus on kentän laatikon ensimmäinen rivi, upotettu
   pinta kuten Markdownin frontmatter (`--ah-sunken`, `--ah-line-soft`), sisennetty
   laatikon reunasta, joten laatikon oma reuna ja fokusrengas pysyvät ehjinä.
   ↩ on Kopioi-painikkeen vieressä samassa esitystavassa ja aina näkyvissä
   kuten Kopioi. Alkuperäinen on samaa upotettua pintaa, kunnes vastaus
   lähtee.
3. **C Jonon rivi**: lainaus on jonon oma otsake (*VASTAAT AGENTIN VIESTIIN*, ✕
   oikealla) ja yksi rivi (`.ah-queue-items li`: `--ah-accent-soft`,
   kellonaika ensin). *↩ Vastaa* on tekstipainike viestin alla. Alkuperäinen
   pysyy jonon rivin sävyssä, kunnes vastaus lähtee.

Kaikissa: lainauksen painaminen vierittää alkuperäisen näkyviin ja
välähdyttää sen (vähennetyllä liikkeellä liikkumaton fokusreunus), ✕ poistaa
lainauksen ja luonnos jää kenttään, ja lähetetyn viestin lainaus on samaa
pintaa kuin kentässä ja hyppää samoin. Oletusnäkymässä vastaus klo 9.20
viestiin on kesken, ja historiassa on yksi lähetetty vastaus, joten erot
näkyvät heti. Sivun yläreunassa on jokaisesta suunnasta yksi rivi ja suositus.

**Suositus: B.** Lainaus on osa kenttää eikä uusi kortti sen päällä, joten
alakerta ei kasva uudella kerroksella, ja se kertoo, mihin kirjoitettava teksti
liittyy. ↩ on samassa paikassa ja samaa kokoa kuin Kopioi, eli viestin omat
toiminnot ovat yhdessä rivissä eivätkä piiloudu osoittimen taakse, mikä auttaa
myös kosketusta ja näppäimistöä. Sama upotettu pinta alkuperäisessä näyttää
ilman hyppyä, mihin vastataan, kun alkuperäinen on näkyvissä. A on lähin
kierroksen 1 korttia, mutta kortti kentän päällä näyttää liitteeltä, ja
liitteiden kanssa niitä olisi kaksi samannäköistä. C:n yksi rivi on kevein,
mutta jonon pinta tarkoittaa tuotteessa odottavaa viestiä, ja kaksi saman
näköistä merkitystä menisi sekaisin, kun jonossa on jotain.

### Tarkistus

`check.mjs` kävi kaikki kolme suuntaa Päivä-, Yö- ja Korkea kontrasti
-teemassa 1440 ja 390 px:n leveydellä: lainauksen paikka (A ja C kentän yllä,
B laatikon sisällä, kaikki kentän levyisiä), ettei lainauksen vasen reuna ole
muita leveämpi tai eri värinen, painikkeen paikka (A kulmassa kellonajan
jälkeen, B Kopioin ja kellonajan välissä, C viestin alla), alkuperäisen
merkintä (B ja C merkitsevät, A ei), hyppy kentän lainauksesta ja lähetetyn
viestin lainauksesta, ✕ luonnoksen säilyessä, uusi vastaus toisen viestin
painikkeesta, lähetys ja natiivin istunnon teksti. 396 tarkistusta meni läpi,
ja konsoli pysyi puhtaana. Kuvakaappaukset (DPR 2) ovat repositorion
ulkopuolella hakemistossa `/var/tmp/agent-keep/reply-to-agent-message-2/`
(`<suunta>-1-oletus-<leveys>-<teema>.png` ja niin edelleen).

## Kierros 3: kulmapainike, pitkä lainaus ja otteen pituus

Kierros: `design-system/prototypes/rounds/2026-11-23-reply-to-message-3/`
(`NOTES.md` kertoo rakenteen, rakennuskomennon ja tarkistuksen). Jarin päätös
23.11.: painike on oikeassa yläkulmassa, lainaus kentän sisällä (kierroksen 2
B) ja vaihtoehto 1 hyväksytty. Kierros riffaa kolmea asiaa, ja sivun
yläreunassa on kustakin yksi rivi suuntaa kohden ja suositus.

Sivu on yksi vierivä dokumentti, joka toimii Habitat-näkymänä: ei kehyksiä,
ei siirtymiä, ei verkkoa. Valitsimen suunta vaihtaa elävän keskustelun
painikkeen ja lainauksen; sen alla osiot näyttävät kaikki muunnelmat
rinnakkain, joten painikkeen ja lainauksen voi valita eri suunnista. Elävän
keskustelun vieressä on koko ajan näkyvissä, mitä agentti saisi kustakin
kolmesta otteesta.

### 1 Kulmapainike

Kaikki kolme ovat kortin `actions`-paikassa kellonajan jälkeen, kuten Palaa
tähän -valikko. Matriisi näyttää kunkin levossa, osoittimen alla, fokuksessa,
vastattaessa ja puhelimessa (levossa ja vastattaessa), Päivä- ja Yö-teemassa.

1. **A Kopioin pari**: Kopioi-painikkeen esitystapa sellaisenaan (32 px
   neliö, ei reunaa eikä sävyä, korostuksen väri), aina näkyvissä.
   Vastattaessa painettu pinta. Puhelimessa 40 px kuten muut rivin toiminnot.
2. **B Rajattu ja hiljainen**: pienempi neliö (26 px), ohut erotinviiva,
   vaimea väri. Työpöydällä se näkyy osoittimen alla tai fokuksessa kuten
   Palaa tähän, ja vastattavassa viestissä se pysyy näkyvissä. Puhelimessa se
   on aina näkyvissä (32 px).
3. **C Sävytetty pilleri**: ↩ ja sana *Vastaa* korostuksen vaaleassa
   sävyssä, aina näkyvissä. Vastattaessa täysi korostusväri. Puhelimessa vain
   ↩ samassa sävyssä (32 px pyöreä).

**Suositus: A.** Viestin toiminnot näyttävät yhdeltä perheeltä, kun ↩ on samaa
kokoa ja väriä kuin Kopioi. Aina näkyvä painike löytyy ilman osoitinta, ja
kosketus ja näppäimistö toimivat samoin. B on siistein työpöydällä, mutta
toive tuli henkilöltä, joka ei tiennyt toiminnosta, ja piilossa oleva painike
on juuri se, mitä hän ei löytäisi. C erottuu parhaiten, mutta joka viestissä
oleva sävytetty pilleri vetää katsetta pois tekstistä.

### 2 Pitkän viestin lainaus kentässä

Lainattuna on viesti, jossa on kaksi kappaletta, koodilohko ja lista. Lainaus
on kentän laatikon ensimmäinen rivi, upotettu pinta kuten kierroksen 2 B:ssä.
Napautus lainauksen tekstiin vie kaikissa suunnissa alkuperäiseen ja
välähdyttää sen. ✕ poistaa lainauksen, ja luonnos jää kenttään.

1. **A Kaksi riviä**: viestin alku pelkkänä tekstinä kahdella rivillä, ja
   loppu katkeaa kolmeen pisteeseen. Ei avausta. Kenttä kasvaa aina saman
   verran.
2. **B Avattava viesti**: koko viesti muotoiltuna, kolme riviä ja häivytys.
   *Näytä koko viesti* avaa sen kentän sisään enintään kolmanneksen
   keskustelun korkeudesta ja vierii siinä.
3. **C Sama kuin agentille**: lainaus on täsmälleen agentille lähtevä ote
   (osion 3 valinta, oletuksena c) rakenteineen: koodi tasalevyisenä ja lista
   listana. Neljä riviä ja häivytys. *Näytä koko ote* avaa loput otteesta, ja
   koska ote on rajattu, avattukaan lainaus ei vieri.

**Suositus: C.** Kentässä näkyy juuri se, mitä agentin vastaukseen lähtee, eikä
mitään piilossa olevaa, joten ihminen voi tarkistaa viittauksen ennen
lähettämistä. Kenttä kasvaa enintään neljä riviä, ja koko viestiin pääsee
napauttamalla. B näyttää kentässä enemmän kuin agentti saa, joten se antaa
väärän kuvan. A on kevein, mutta koodilla alkavasta viestistä se näyttää
litistettyä koodia.

### 3 Otteen pituus

Neljä viestiä (lyhyt, pitkä, alkaa koodilla, lista) ja kolme sääntöä
rinnakkain: *Agentti saa* on `<reply-to>`-lohko täsmälleen sellaisena kuin se
lähtee Pi:lle ja jää natiiviin istuntoon, ja *Kentässä* on lainaus, jonka
ihminen näkee.

1. **a 280 merkkiä**: teksti yhdeksi riviksi (välilyönnit normalisoitu) ja
   katkaistu sanan kohdalta 280 merkkiin. Kierroksen 2 arkkitehtuurin sääntö.
2. **b Ensimmäinen virke**: teksti ensimmäiseen pisteeseen, huutomerkkiin tai
   kysymysmerkkiin, enintään 280 merkkiä.
3. **c Alku rakenteineen**: viestin oma Markdown kokonaisina riveinä noin 280
   merkkiin. Viimeinen proosarivi katkaistaan virkkeen (tai sanan) kohdalta,
   avoin koodilohko suljetaan, ja erillinen `…`-rivi kertoo, että viesti
   jatkuu.

Mitä ero tekee:

- **Lyhyt** (78 merkkiä): a ja c ovat samat, koko viesti. b antaa vain
  *Korjaa. …*, koska ensimmäinen virke on yksi sana.
- **Pitkä** (819 merkkiä): a katkeaa kesken toisen kappaleen (*Korjaus on
  siirtyä …*). b pysähtyy lyhenteeseen *esim.* keskellä ensimmäistä virkettä.
  c antaa koko ensimmäisen kappaleen.
- **Alkaa koodilla**: a ja b litistävät koodin yhdeksi riviksi
  (```` ```python def test_dst_march(): ts = … ````), ja b:n "virke" on koodi
  ja selitys yhdessä. c pitää koodilohkon koodina ja sen jälkeen selityksen.
- **Lista**: a litistää numeroidun listan riviksi. b antaa *Kaksi tapaa: 1.
  …*, koska johdanto päättyy kaksoispisteeseen ja ensimmäinen piste on
  numeron jäljessä. c pitää johdannon ja molemmat kohdat listana.

**Suositus: c.** Se on yhtä lyhyt kuin a (enintään noin 280 merkkiä, noin
60–100 tokenia), mutta lista pysyy listana ja koodi koodina, joten malli ja
terminaalista lukeva ihminen ymmärtävät otteen. Ote ei myöskään katkea
lyhenteeseen tai pelkkään johdantoon kuten b. Ote ratkaisee silloin, kun
alkuperäinen on tiivistetty mallin kontekstista pois, ja juuri silloin
litistetty koodi tai *Korjaa. …* ei kerro mallille, mihin vastataan.
Daemonin sääntö muuttuu vaihtoehto 1:n sisällä: välilyöntejä ei
normalisoida, vaan rivit säilyvät. Lohkon muoto, `</reply-to`-jonon
poistaminen ja jäsennin pysyvät ennallaan, joten sopimus ei muutu.

### Tarkistus

`check.mjs` tarjoilee sivun gatewayn näkymän hiekkalaatikon CSP:llä
(läpinäkymätön alkuperä, ei yhteyksiä, ei kehyksiä) ja epäonnistuu, jos sivu
pyytää mitään muuta kuin itsensä, sisältää kehyksen tai vaihtaa osoitettaan.
Se kävi kaikki kolme suuntaa Päivä-, Yö- ja Korkea kontrasti -teemassa 1440 ja
390 px:n leveydellä: rivit, painikkeen paikka kulmassa ja koko (32/26/26 px
työpöydällä, 40/32/32 px puhelimessa), B:n piilotus levossa vain
työpöydällä, C:n sana vain työpöydällä, ettei lainauksen vasen reuna ole muita
leveämpi, oletusnäkymässä näkyvä kulmapainike ja valitsimen pysyminen kentän
ulkopuolella, avaus ja sen raja, hyppy, ✕ luonnoksen säilyessä, uusi vastaus,
lähetys ja sivupaneelin lohko, painikematriisin tilat molemmissa teemoissa ja
otetaulukko (lohkon muoto, pituus, a litistää koodin, c pitää koodin ja
listan, b pysähtyy lyhenteeseen). 714 tarkistusta meni läpi, ja konsoli pysyi
puhtaana. Kuvakaappaukset (DPR 2) ovat repositorion ulkopuolella hakemistossa
`/var/tmp/agent-keep/reply-to-agent-message-3/`
(`<suunta>-1-oletus-<leveys>-<teema>.png`, `s1-painike-…`, `s2-lainaus-…`,
`s3-ote-…`).

## Mitä agentille lähtee

Kaikissa vaihtoehdoissa tämä pysyy sovelluskerroksen ja daemonin asiana: oma
viesti omaan istuntoon kuten nyt. Gateway ja provisiointi eivät muutu, eikä
mikään auktoriteetti siirry.

### Nykyinen polku

1. **Selain.** Kenttä lähettää `send(id, message, commandId, csrf, choice?)`
   (`web/src/app/conversations.ts:891`): `POST
   /api/v1/conversations/<id>/send` (tai `steer`/`follow_up`) ja runko
   `{"message", "command_id", "first_choice"?}`
   (`contracts/v1/pi-message.schema.json`, `additionalProperties: false`).
2. **Gateway** tarkistaa reitin, metodin, istunnon ja kirjoitusoikeuden
   (`internal/gateway/conversation_linux.go:11–50`) ja välittää rungon käyttäjän
   daemonille koskematta siihen.
3. **Daemon.** `admitMessage` (`internal/daemon/conversation_linux.go:916`)
   purkaa rungon tiukasti (`decodeControl`, `DisallowUnknownFields`, `:576`),
   joten uusi kenttä on lisättävä sinne. Pidätetyt viestit liitetään yhdeksi
   kehotteeksi `"\n\n"`-erottimella (`:1068`). `finishPrompt` laajentaa
   liiterivit (`promptAttachments`, `:1130`), kertoo perutut herätykset
   (`tellCancelledWakes`, `:1147`) ja lähettää tekstin Pi:n RPC:lle
   (`s.rpc.request("prompt"|"steer"|"follow_up", expanded, …)`, `:1149`).
   Daemon muokkaa siis viestiä jo nyt ennen kuin Pi saa sen.
4. **Pi** kirjoittaa natiiviin istuntotiedostoon `{"type":"message",
   "id":"<8 heksaa>", "parentId":…, "message":{"role":"user","content":…}}`.
   Tämä `id` on historian `entry_key` (`internal/daemon/history_linux.go:94`),
   jota haku (`search_linux.go:102`) ja Palaa tähän jo käyttävät.
5. **Takaisin näkymään.** Historian jäsennin projisoi merkinnät
   (`history_blocks_linux.go`). Ennakkotapaus tekstiin upotetusta,
   jäsennettävästä lohkosta on jo olemassa: Pi:n oma `<skill name=…>`-lohko
   käyttäjän viestin alussa luetaan kentäksi `skill`, ja näkyvä teksti on vain
   argumentit (`projectUserSkill`, `skill_linux.go:125`;
   `history_blocks_linux.go:84`). Ennakkotapaus rakenteisesta merkinnästä on
   companionin `oh-participant-message` (`process-extension.mjs:782`, luetaan
   `shared_facts_linux.go:133`), ja `deliverAs: 'nextTurn'` on jo käytössä
   perutun herätyksen ilmoituksessa (`process-extension.mjs:1248`).
6. **Claude-silta** (pi-claude-bridge 0.12.0, pinnattu) rakentaa oman Claude
   Code -transkriptinsa Pi:n LLM-kontekstista (`src/convert.ts`: käyttäjän
   viestit tekstinä) ja pitää Pi:n historiaa auktoriteettina
   (`process-extension.mjs:492–518`). Mitä Pi:n malli näkee, sen näkee Claude.

Kaikissa alla olevissa vaihtoehdoissa esimerkki on sama: vastaus klo 9.20
viestiin, jonka natiivi tunniste on `b81e04d6`.

### Vaihtoehto 1 (suositus): tekstilohko käyttäjän viestin alussa

**Selain → daemon.** Runkoon tulee valinnainen kenttä:

```json
{"message": "Mennään ensimmäisellä. Windows ei ole meillä käytössä.",
 "command_id": "6f1c…",
 "reply_to": {"entry_key": "b81e04d6"}}
```

`entry_key` noudattaa samaa kuviota kuin haun osuma, `^[A-Za-z0-9_-]{1,128}$`.
Selain ei lähetä otetta, koska daemon lukee sen natiivista istunnosta. Ote on
siis aina se, mitä istunnossa lukee, eikä selaimen käsitys siitä.

**Daemon** tarkistaa, että merkintä on istuntotiedoston nykyisellä haaralla
(juuresta lehteen, myös tiivistyksen ohittamalla osalla), että sen `role` on
`assistant` ja että siinä on tekstiä. Muuten pyyntö hylätään ennen kuin
mitään lähtee (`409 reply_target_gone`). Daemon muodostaa otteen viestin
tekstilohkoista (ei ajattelua eikä työkalukutsuja): välilyönnit
normalisoidaan, ote katkaistaan sanan kohdalta enintään 280 merkkiin ja
loppuun lisätään ` …`. Otteesta poistetaan mahdollinen `</reply-to`-jono, jotta
lohko ei voi päättyä kesken. Lohko liitetään viestin alkuun ennen
`promptAttachments`ia.

**Pi saa RPC:ssä** (`prompt`, `steer` tai `follow_up`) täsmälleen tämän tekstin:

```
<reply-to entry="b81e04d6">
Kaksi tapaa: zoneinfo: lasketaan paikallinen aika aikavyöhykkeen mukaan. Toimii kaikkialla, mutta vaatii tzdata-paketin Windowsissa. Kiinteä siirtymä: lisätään tunti maaliskuun ja lokakuun välille. Yksinkertainen, mutta oikein …
</reply-to>

Mennään ensimmäisellä. Windows ei ole meillä käytössä.
```

**Natiivi istunto kirjaa** yhden tavallisen käyttäjän viestin:

```json
{"type":"message","id":"e5a1c3f0","parentId":"c2a9f810","timestamp":"2026-11-23T09:40:12.031Z",
 "message":{"role":"user","content":[{"type":"text","text":"<reply-to entry=\"b81e04d6\">\nKaksi tapaa: … oikein …\n</reply-to>\n\nMennään ensimmäisellä. Windows ei ole meillä käytössä."}]}}
```

Viittaus elää vain tässä tekstissä. Erillistä tietuetta ei ole, eikä kahta
merkintää tarvitse sovittaa yhteen.

**Muut lukijat.** `pi --resume` terminaalissa näyttää lohkon tekstinä
sellaisenaan, ja se on luettava ilman companionia. Claude-silta saa saman
tekstin käyttäjän viestinä. Haku löytää myös otteen sanat; sen projektio
poistaa lohkon samoin kuin historian (alla).

**Takaisin näkymään.** Historian projektio tunnistaa vain viestin alussa
olevan, hyvin muodostetun lohkon, jonka `entry`-arvo vastaa kuviota, kuten
`projectUserSkill` tunnistaa `<skill>`-lohkon. Merkintä saa kentän
`reply_to: {entry_key, excerpt}` (`contracts/v1/history.schema.json`,
`entry`), ja `content` on teksti ilman lohkoa. Sama kenttä tulee
tapahtumavirran käyttäjän viestiin (`events_linux.go`) ja Pi:n jonon riveihin,
jotka daemon projisoi samalla funktiolla. Hyppy etsii `entry_key`n ladatusta
historiasta ja hakee vanhempia sivuja, kunnes merkintä löytyy. Jos merkintä
ei ole enää nykyisellä haaralla (Palaa tähän on vienyt sen sivuun), lainaus
näkyy, mutta hyppy on estetty ja syy kerrotaan: *Viesti ei ole enää tässä
jatkossa*.

**Kun alkuperäinen on kontekstin ulkopuolella tai tiivistetty.** Pi:n
tiivistys poistaa vanhat merkinnät mallin kontekstista, mutta ne jäävät
istuntotiedostoon. Daemon lukee otteen tiedostosta, joten vastaaminen toimii,
ja malli ymmärtää vastauksen otteesta, vaikka se ei enää näe alkuperäistä.
Tämän takia ote on mukana eikä pelkkä tunniste: tunniste ei kerro mallille
mitään, mutta se säilyy historiassa näkymää ja hyppyä varten. Tiivistetty
vastaus itsessään (lohko mukaan lukien) tiivistyy kuten mikä tahansa viesti.

**Hinta:** noin 60–100 tokenia vastausta kohden. Mallille tunniste on
merkityksetön mutta harmiton. Käyttäjä voi kirjoittaa lohkon itse, jolloin
näkymä näyttää sen lainauksena. Se on hänen oma tekstinsä hänen omassa
istunnossaan, eikä hyppy voi viedä toisen istuntoon, joten rajaa ei ylitetä.

### Vaihtoehto 2: companionin näkyvä Habitat-viesti viestin edellä

Runko kuten vaihtoehdossa 1. Daemon pyytää ennen RPC-kehotetta companionilta
op:n `reply_to` (samaan tapaan kuin `tellCancelledWakes`). Companion kutsuu:

```js
pi.sendMessage({
  customType: 'oh-reply-to', display: true,
  content: '[Open Habitat] The person\'s next message replies to your message b81e04d6, which began:\n"Kaksi tapaa: zoneinfo: … oikein …"',
  details: { schema_version: 1, entry: 'b81e04d6' },
}, { deliverAs: 'nextTurn' });
```

**Pi:n malli näkee** kaksi peräkkäistä käyttäjäroolin viestiä (Pi muuntaa
custom-viestin käyttäjän viestiksi): Habitatin rivin ja koskemattoman tekstin
*Mennään ensimmäisellä. …*. **Natiivi istunto kirjaa** `custom_message`-merkinnän
(`customType: "oh-reply-to"`, `details.entry`) ja sen jälkeen tavallisen
käyttäjän viestin ilman lohkoa. Käyttäjän teksti pysyy puhtaana haulle,
otsikoille ja kopioinnille, ja viittaus on rakenteinen kenttä eikä jäsennettyä
tekstiä.

Heikkoudet: `nextTurn` koskee vain seuraavaa kehotetta, joten ohjaukseen ja
jatkoon tarvitaan oma ajoitus (`deliverAs: 'steer'`/`'followUp'`), ja kahden
kirjoituksen järjestys ja pari on sovitettava, kuten
`oh-turn-mode`-merkintöjen kanssa (`process-extension.mjs:1053`). Jos
kehote hylätään Habitat-rivin jälkeen, rivi jää orvoksi. Terminaalin
`pi --resume` näyttää rivin erillisenä viestinä. Claude-silta saa sen yhtenä
käyttäjän tekstinä lisää. Vaatii companionin, mutta selaimen käynnistämässä
Pi:ssä se on aina mukana.

### Vaihtoehto 3: Markdown-lainaus tekstissä ja piilotettu viittaus

Daemon liittää viestin alkuun luettavan lainauksen ilman tageja:

```
> Agentin viesti klo 9.20: Kaksi tapaa: zoneinfo: … oikein …

Mennään ensimmäisellä. Windows ei ole meillä käytössä.
```

Lisäksi companion kirjoittaa juuri ennen käyttäjän viestiä piilotetun
merkinnän `pi.appendEntry('oh-reply-to', {schema_version: 1, entry:
'b81e04d6', quote_bytes: 131})`. Se ei mene mallin kontekstiin, kuten
`oh-turn-mode`. Malli näkee luonnollisen lainauksen ilman merkityksetöntä
tunnistetta. Historian projektio lukee tunnisteen ja lainauksen pituuden
piilomerkinnästä. Jos sitä ei ole (terminaali, kaatuminen kirjoitusten
välissä), teksti on silti luettava, mutta näkymä ei tiedä, mihin hypätä.

Heikkoudet: kaksi totuutta, jotka voivat erota (teksti ja piilomerkintä), sama
parinmuodostus kuin vaihtoehdossa 2, ja Markdown-lainauksen voi kirjoittaa
myös käyttäjä itse, joten ilman piilomerkintää sitä ei erota omasta
tekstistä.

### Suositus: vaihtoehto 1

Yksi kirjoitus, joka on atominen viestin kanssa: viesti ja viittaus joko
menevät Pi:lle yhdessä tai eivät mene lainkaan. Ohjaus, jatko ja pidätetty
viesti toimivat samalla tavalla, koska ne kaikki kulkevat saman tekstin
kautta. Lohko on luettava kaikkialla, missä natiivi istunto luetaan
(terminaali, Claude-silta, tiivistyksen jälkeen), eikä se tarvitse companionia.
Jäsentäminen on jo tuttu malli, sama kuin Pi:n `<skill>`-lohkossa. Vaihtoehto
2 on parempi vain, jos käyttäjän tekstin pitää pysyä natiivissa istunnossa
täsmälleen kirjoitetun mukaisena. Silloin hinta on companionin ajoitus ja
orpojen rivien käsittely.

### Sopimusmuutos (vaihtoehto 1)

- `contracts/v1/pi-message.schema.json`: valinnainen `reply_to: {entry_key}`
  (`additionalProperties: false`). Sama runko kelpaa `send`-, `steer`- ja
  `follow_up`-reitille.
- `contracts/v1/history.schema.json` `entry`: valinnainen
  `reply_to: {entry_key, excerpt}` käyttäjän merkinnälle. Sama tapahtumavirran
  käyttäjän viestissä ja jonon riveissä.
- Virhekoodi `reply_target_gone` (409) `pi-message.schema.json`:n kuvaukseen; koodit luetellaan reittien skeemojen kuvauksissa, ja yhteinen kirjekuori (`error.schema.json`) pysyy ennallaan.
- Generoidut tyypit päivittyvät (`scripts/check-generated.sh`). Gateway ja
  `internal/provision` eivät muutu.
- Pidätetyt viestit: lohko muodostetaan jo vastaanotettaessa pidätettyyn
  tekstiin. Vastausta ei liitetä muihin pidätettyihin (`:1068`), vaan se
  lähtee omana kehotteenaan, jotta lohko pysyy viestin alussa.

## Päätökset myöhempään katselmointiin

- **Vastattavat viestit**: vain agentin valmiit vastaukset. Vaihtoehdot:
  myös omat viestit, työkalurivit tai kesken oleva vastaus. Toive koski
  agentin viestejä, ja kesken olevalla vastauksella ei vielä ole
  lopullista tekstiä lainattavaksi.
- **Yksi lainaus kerrallaan**: uusi painallus korvaa edellisen. Monta
  lainausta kerralla olisi raskaampi sekä näkymässä että Pi:lle.
- **Otteen pituus** (kierros 3): suositus on c, Markdown kokonaisina riveinä
  noin 280 merkkiin, kunnes Jari valitsee. Raja pysyy samana kuin
  kierroksessa 2. Pidempi ote kuluttaisi kontekstia, ja ote on vain
  tunnistamista varten.
- **c:n tarkat säännöt**: tyhjien rivien jonot supistetaan yhteen, avoin
  koodilohko suljetaan (raja voi ylittyä sulkevan rivin verran), ja
  keskeneräinen koodirivi jätetään pois eikä katkaista. Vaihtoehtona oli
  katkaista myös koodi merkin kohdalta, mutta puolikas koodirivi johtaisi
  mallia harhaan.
- **Napautus lainaukseen hyppää, avaus on erillinen painike** (kierros 3):
  briefin "expand on tap" olisi voinut tarkoittaa, että napautus avaa.
  Hyppy on kuitenkin sama ele kuin lähetetyn viestin lainauksessa ja
  kierroksissa 1–2, joten avaus sai oman *Näytä koko …* -painikkeen.
- **Puhelimen painike** (kierros 3): kaikki muunnelmat näkyvät kosketuksella
  aina, koska puhelimessa ei ole osoitinta. Pitkä painallus viestiin olisi
  vaihtoehto, mutta sitä ei löydä ilman ohjetta, ja se kilpailee selaimen
  oman tekstinvalinnan kanssa.
- **Vastattavan alkuperäisen merkintä** (kierros 3): kierroksen 2 B:n
  upotettu pinta säilytettiin kaikissa suunnissa, koska kierros ei riffannut
  sitä.
- **Kierroksen 3 näkymä**: painikkeen ja lainauksen muunnelmat näkyvät myös
  irrallisina tuotantokomponentteina matriisissa, koska ilman kehyksiä
  puhelimen media-ehdot eivät toteudu työpöydällä. Puhelinsarake käyttää
  kosketuksen sääntöjä suoraan, ja oikean puhelinasettelun näkee samasta
  sivusta puhelimella.
- **Ote daemonilta eikä selaimelta**: ote vastaa aina istuntoa, ja selain
  ei voi laittaa agentin suuhun sanoja, joita tämä ei sanonut.
- **Vaihtoehto 1:n tagi**: `<reply-to entry="…">` ilman kellonaikaa tai roolia.
  Rooli on aina `assistant`, ja kellonaika löytyy merkinnästä. Kierroksen 1
  luonnoksessa oli `role="assistant"`, mutta se ei kerro mallille mitään.
- **Pidätetty vastaus lähtee omana kehotteenaan**: vaihtoehto oli liittää se
  muihin, jolloin lohko jäisi tekstin keskelle eikä jäsennin löytäisi sitä.
- **Kohteen tarkistus**: vain nykyinen haara, myös tiivistetty osa.
  Sivuhaaran viestiin vastaaminen olisi Pi:lle sekavaa, koska se ei ole
  enää keskustelussa.
- **Jaetun keskustelun osallistujat**: osallistujan viesti kulkee omaa
  polkuaan (`oh-participant-message`). Vastaaminen rajataan tässä omistajan
  omiin viesteihin; osallistujien vastaukset ovat erillinen päätös.
- **B:n ↩ aina näkyvissä**: Kopioin tavoin. A:ssa se on osoittimen alla kuten
  Palaa tähän. Puhelimessa kaikki ovat aina näkyvissä.
- **Kierroksen paikka**: lähteet ovat `design-system/prototypes/rounds/`
  -hakemistossa kuten muillakin kierroksilla, ja issuessa on vain tämä
  tiedosto.

## Kysymykset Jarille

1. Kulmapainike: A Kopioin pari, B Rajattu ja hiljainen vai C Sävytetty
   pilleri? Suositus A.
2. Pitkä lainaus kentässä: A Kaksi riviä, B Avattava viesti vai C Sama kuin
   agentille? Suositus C.
3. Ote: a 280 merkkiä, b ensimmäinen virke vai c alku rakenteineen?
   Suositus c.
