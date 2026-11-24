# Agentin viesti toiselle keskustelulle

## Kierros 3

Kierros: `design-system/prototypes/rounds/2026-11-24-agent-agent-message-3/`
(rakennus ja tarkistus: `NOTES.md`). Malli ja host-tiedot:
[design.md](design.md). Sivu on rakennettu tuotannon komponenteista.

Valitsit kierroksella 2 A Kirjeet, joten tuleva viesti on sellaisenaan
kierroksen 2 A. Tämä kierros miettii lähtevää viestiä lähettäjän puolella:
näytetäänkö se aina omana kuplanaan vai vain silloin, kun agentin teksti ei
kerro lähettäneensä sitä, ja minkä muotoisena. Tarina on kierroksen 2 viisi
vaihetta. Vaiheet 6–7 jatkavat vaihtoa silmukaksi, jossa agentit vaihtavat
kuvaajan selitteen muotoa edestakaisin, kunnes vahti pysäyttää sen ja sinä
jatkat.

Akseli: lähtevän viestin paikka ja muoto lähettäjän puolella.

- **Nyt (kierroksen 2 A).** Katkoviivakupla on aina siinä kohdassa, josta
  viesti lähti, ja agentti kertoo lisäksi tekstissään lähettäneensä sen.
  Sama asia tulee siis kahdesti: kuplana ja lauseena.
- **A Peili.** Viesti on aina oma kuplansa, tulevan kirjeen peilikuva
  agentin puolella. Pinta ja reuna ovat samat, ja otsikossa lukee *Tämä
  agentti › Kaaviot*. Molemmat suunnat näyttävät samalta, mutta lause ja
  kupla toistavat yhä toisiaan.
- **B Rivi.** Viesti näkyy aina, mutta tiiviinä rivinä agentin vastauksen
  alla: kenelle, viestin alku ja tila, ja rivin saa auki. Ennen vastausta
  rivi on vuoron lopussa. Silmukassa B vie vähiten tilaa.
- **C Upotettu.** Kun agentin vastaus linkittää viestin (*kerroin
  Kaavioille*), viesti on vastauksen sisällä lainauslohkona, eikä omaa
  kuplaa ole. Vain jos mikään vastaus ei mainitse sitä, lohko on omana
  rivinään siinä kohdassa, josta viesti lähti. Vaiheessa 2 näkyy tämä:
  Kaavioiden viesti on omana lohkonaan, kunnes vastaus tulee vaiheessa 3,
  ja siirtyy sitten vastaukseen.

**Suositus: C Upotettu.** Agentti kertoo joka tapauksessa lähettäneensä
viestin, joten viesti kuuluu siihen kohtaan eikä toiseksi kuplaksi. Näet
sanatarkasti, mitä lähti, siinä missä agentti sanoo lähettäneensä sen, eikä
mitään toisteta. Lohko ei ole agentin omaa tekstiä, vaan Habitat piirtää
sen CLI:n tuloksesta, joten agentti ei voi kuvata viestiä toisin kuin se
lähti. A on johdonmukaisin, mutta jättää toiston. B on siistein, mutta
viestin sisältö jää aina avattavaksi, vaikka juuri sitä tarkistaisit.
C:n hinta on se, että lohko siirtyy, kun vastaus tulee, ja pitkä viesti
pidentää vastausta.

### Karkaamisvahti hyppyrajan sijaan

Kysyit, miksi agentit eivät saisi puhua enempää. Hyppyrajalle ei ole muuta
syytä kuin silmukka, jota kukaan ei katso: kaksi agenttia vastaa toisilleen
loputtomiin (*vaihdanko senkin?* – *vaihda, ja tarkista samalla tämä*), ja
jokainen viesti käynnistää kokonaisen vuoron työkaluineen ja tokeneineen.
Siksi ehdotan kiinteän rajan tilalle vahtia:

- Agentit saavat vaihtaa viestejä vapaasti.
- Daemon laskee, monta agentin viestiä peräkkäin on kulkenut sen jälkeen,
  kun kirjoitit viimeksi jompaankumpaan keskusteluun. **Kun luku ylittäisi
  10:n**, viesti ei lähde vaan odottaa sinua.
- Kummassakin keskustelussa näkyy sama kortti: *Agentit odottavat sinua.
  Kvartaaliraportti ja Kaaviot ovat vaihtaneet 10 viestiä peräkkäin ilman,
  että kirjoitit kumpaankaan.* Kortissa on *Jatka* ja lähettäjän puolella
  *Älä lähetä*, vastaanottajan puolella *Näytä viesti*. Pidätetyssä
  viestissä lukee *Odottaa sinua*.
- *Jatka* lähettää viestin, ja lasku alkaa alusta. Kumpikin keskustelu saa
  Habitat-rivin *Jatkoit klo 10.06*. Jos kirjoitat itse jompaankumpaan
  keskusteluun, lasku alkaa alusta, mutta pidätetty viesti odottaa yhä
  *Jatka*-painiketta, koska kirjoittamasi voi olla "lopettakaa".

Luku 10 on ehdotus. Kierroksen 2 tarina, jossa oli oikea korjaus, tarvitsi
viisi viestiä, joten kymmenen jättää tilaa kaksinkertaiselle vaihdolle ja
pysäyttää silmukan kymmenen vuoron ja muutaman minuutin jälkeen. Lasku
seuraa viestiketjua eikä keskusteluparia, joten se pysäyttää myös kolmen
keskustelun kehän. Vaiheessa 6 Nyt-suunta näyttää vertailuksi kierroksen 2
hyppyrajan: lähetys hylätään heti, kun Kaavioiden viesti saa vastauksen.

Host tarvitsee tätä varten (yksityiskohdat design.md:ssä, "The runaway
guard"): lohkoon laskurin `count` hyppyjen tilalle, pidätyksen daemonin
muistiin samaan tapaan kuin pysähtyneen keskustelun viestille, pidätyksen
molempien keskustelujen snapshotiin (`agent_message_hold`), selaimelle
omistajan komennot `release` ja `discard`, CLI:n tilan `held_for_person`
ja lopputuloksen Habitat-rivin kumpaankin keskusteluun nykyistä
keskustelurivin polkua pitkin. Uutta tallennuspaikkaa ei tule.

### Tarkistus

`check.mjs` kävi kaikki neljä suuntaa Päivä-, Yö- ja Korkea kontrasti
-teemassa 1440 ja 390 px vähennetyllä liikkeellä suomeksi, ja lisäksi
englanniksi 1440 Päivä ja 390 Yö. Mukana olivat kaikki seitsemän vaihetta,
merkintä (ei koskaan sinun kuplaasi), kunkin suunnan muoto ja paikka (B
vastauksen alla, C vastauksen sisällä ja yksin vain ennen vastausta),
lainaukset, linkit paneelien välillä, vahti kummassakin keskustelussa,
*Jatka*, *Älä lähetä*, hyppyraja Nyt-suunnassa ja Pi:n saama teksti.
1472 tarkistusta meni läpi, ja konsoli pysyi puhtaana. Rakennettu sivu
näkymäksi tarjottavaksi on
`/var/tmp/agent-keep/agent-agent-message/round-3/offline.html`, ja kuvat
(DPR 2) ovat sen vieressä hakemistossa `shots/`.

### Decisions for later review

- Upotettu lohko tulee tyypitetystä `sent_agent_message`-tiedosta. Habitat
  liittää sen vastaukseen, jonka linkissä on viestin tunniste
  (`message_url`), eikä jäsennä agentin sanoja.
- Ennen kuin vastaus linkittää viestin, lohko on omana rivinään, ja kun
  vastaus tulee, lohko siirtyy siihen. Viesti ei siis ole koskaan
  näkymättä.
- Vahdin lasku seuraa ketjua, eli sitä vuoroa, jonka viesti aloitti, eikä
  keskusteluparia. Ajastetun herätyksen vuoro lasketaan omistajan vuoroksi,
  ja osallistujan vuoro ei lähetä lainkaan.
- Pidätys on daemonin muistissa. Uudelleenkäynnistyksen jälkeen viesti
  näkyy lähettäjällä tilassa *Ei lähtenyt*, ja teksti säilyy työkalun
  tuloksessa.
- Kun pidätys odottaa, seuraavat viestit samojen keskustelujen välillä
  hylätään (`agent_message_held`). Jonoa ei synny.
- *Jatka* ja *Älä lähetä* ovat vain omistajan. Jaetussa keskustelussa
  osallistuja näkee kortin ilman painikkeita.

### Kysymykset Jarille

1. Kelpaako C Upotettu, vai haluatko viestin aina omana kuplanaan (A) tai
   rivinä (B)?
2. Kelpaako vahti hyppyrajan tilalle, ja onko 10 viestiä peräkkäin sopiva
   raja?
3. Riittääkö *Jatka* yhdeksi napsautukseksi, vai haluatko kortissa myös
   *Jatka ilman rajaa* -valinnan tälle keskusteluparille?

## Kierros 2

Kierros: `design-system/prototypes/rounds/2026-11-24-agent-agent-message-2/`
(rakennus ja tarkistus: `NOTES.md`). Malli ja host-tiedot:
[design.md](design.md). Sivu on rakennettu tuotannon komponenteista;
kierroksen omia ovat kirjeet, säie, osoitinrivi ja nauharivi.

Lähtökohta on päätöksesi kierroksesta 1: kahden agentin välillä ei ole
pyyntöä ja vastausta, vaan tasavertaisia viestejä kuin kahden ihmisen
välillä. Vastaanottaja näyttää viestin A Kirjeen tapaan, ja lähettäjän
puoli on virta ajassa. Sivulla on sama tarina viitenä vaiheena, jotka
kertyvät: *Kvartaaliraportti* lähettää *Kaavioille* viestin ja jatkaa
taulukoita (1), Kaaviot kertoo kuvaajan valmistuneen (2), Kaaviot huomaa
syyskuun puuttuvan, ja viesti tulee, kun Kvartaaliraportti kirjoittaa
johdantoa, joten se odottaa jonossa lähettäjä nimettynä (3), viesti
tulee perille vuoron jälkeen ja agentti kysyy sinulta, korjataanko (4),
ja korjausviesti lainaa syyskuuviestiä ja Kaavioiden seuraava viesti
lainaa korjausta (5). Keskustelun nimi viestissä avaa toisen keskustelun
samasta viestistä, ja lainaus näyttää alkuperäisen. Sivun alla näkyy,
mitä kummankin Pi sai viimeksi. Aikaleimoja ei suunniteltu
(`times-conversations-prototype`).

Akseli: miltä edestakainen vaihto näyttää ajan mittaan kummallakin
puolella.

- **Nyt.** Lähettäjällä on bash-rivi ja UUID. Vastaanottaja näyttää
  viestin sinun kuplanasi, ja kun Kaaviot kirjoittaa takaisin, viesti
  näkyy Kvartaaliraportissakin sinun kuplanasi. Kumpikaan agentti ei
  tiedä, kenen kanssa puhuu.
- **A Kirjeet.** Jokainen viesti on oma kuplansa siinä kohdassa, jossa
  se lähti tai tuli. Tuleva on sinun viestisi muotoinen (oikealla), mutta
  otsikossa on agentin kuvake ja lähettävän keskustelun nimi linkkinä.
  Lähtevä on agentin puolella katkoviivakuplana, *Lähetetty keskusteluun
  Kaaviot*, ja se korvaa bash-rivin. Lainaus on kuplan yläreunassa
  tuotannon lainauspinnalla. Agentin reaktio on heti viestin alla.
- **B Säie.** Vaihto yhden keskustelun kanssa kootaan yhdeksi säikeeksi
  siihen kohtaan, josta se alkoi, ja säikeessä tulevat ovat oikealla ja
  lähtevät vasemmalla. Myöhempi viesti jättää aikajanaan Habitat-rivin
  (*Kaaviot kirjoitti · ote · säikeessä*), joka vie säikeeseen.
- **C Nauha.** Jokainen viesti on tiivis rivi (suunta, keskustelu,
  lainauksen viite, alku), jonka saa auki. Vaihto kulkee työn seassa ja
  vie vähiten tilaa.

**Suositus: A Kirjeet.** Viesti on viesti molempiin suuntiin, eikä mitään
tarvitse yhdistää pyyntöön, joten malli on sama kuin päätöksessäsi.
Viesti, joka aloittaa agentin työn, on siinä, missä työ alkaa, ja
lainaus kertoo, mihin se viittaa, ilman säiettä. B kokoaa vaihdon
luettavaksi, mutta erottaa viestin siitä työstä, jonka se käynnisti:
jokainen uusi viesti on rivi, ja sisältö on ylempänä. Säikeen voisi
lisätä A:n päälle myöhemmin, jos vaihtoja alkaa olla paljon. C säästää
tilaa, mutta piilottaa juuri sen tekstin, johon agentti tarttui, ja
lainaus on tiiviinä vain viite.

### Host-tiedot, joita näkymä olettaa

Nykytila on kierroksen 1 mukainen ([design.md](design.md), osio 1).
Kierroksen 2 malli (design.md, "Messages back, several messages and
quotes") lisää kierroksen 1 suunnitelmaan seuraavat:

- Pyyntö- ja vastauskorrelaatiota ei tehdä, koska mikään ei tarvitse
  sitä. Kierroksen 1 C:n tila *Vastattu* ja palaava vastauksen alku
  jäävät pois.
- Viestin tunniste on lähettävän komennon `command_id`. Se on jo
  lohkossa (`message=`) ja palaa CLI-tuloksessa, joten molemmat
  historiat sisältävät sen. Tunnisteella on kaksi käyttöä: lainaus ja
  linkki toisen keskustelun samaan viestiin
  (`?conversation=pi:…&message=<id>`). Kohdenäkymä etsii tunnisteen omasta
  historiastaan.
- Lähettäjän puolen kupla tulee CLI:n tyypitetystä tuloksesta
  (`agent_message_sent`: tunniste, kohde, otsikko, `conversation_url`,
  toimitus, tila, teksti ja lainaus). Historia tunnistaa työkalukutsun
  tuloksesta eikä komentoriviä jäsentämällä. Teksti palautetaan, koska
  se tulee stdinistä. Näkyvä tila on se, jonka tulos kertoi
  (*Jonossa*), eikä näkymä seuraa toista keskustelua.
- Lainaus: `message create --quote <id>`. Daemon etsii tunnisteen
  lähettäjän omasta historiasta, ottaa ensimmäisen virkkeen (enintään
  160 merkkiä) kuten vastausviittaus, ja kirjoittaa lohkoon
  `<quote message="…" from="pi:…">ote</quote>`. Pi lukee otteen
  tekstistään, historia antaa sen näkymälle tyypitettynä, ja tuntematon
  tunniste hylätään (`quote_not_found`).
- Kesken vuoron tuleva viesti on aina `follow-up`, ja jonon rivi nimeää
  lähettäjän. Se ei koskaan ohjaa sinun käynnissä olevaa suuntaasi.
- Kierroksen 1 yhden hypyn raja estäisi kaikki viestit takaisin, joten
  sen korvaa hyppyraja (lohkossa `hop`, daemon laskee sen lähettäjän
  vuoron aloittaneesta merkinnästä).

### Tarkistus

`check.mjs` kävi kaikki neljä suuntaa Päivä-, Yö- ja Korkea kontrasti
-teemassa 1440 ja 390 px vähennetyllä liikkeellä suomeksi, ja lisäksi
englanniksi 1440 Päivä ja 390 Yö. Mukana olivat kaikki viisi vaihetta,
merkintä (suunnissa ei koskaan sinun kuplaasi), kunkin suunnan muoto,
jono kesken vuoron, lainaukset ja niiden alkuperäiset, linkit paneelien
välillä sekä Pi:n saama teksti. 808 tarkistusta meni läpi, ja konsoli
pysyi puhtaana. Kuvat (DPR 2) ovat repositorion ulkopuolella
`/var/tmp/agent-keep/agent-agent-message/round-2/`.

### Decisions for later review

- Viesti takaisin kulkee samaa reittiä kuin ensimmäinen viesti, eikä
  sillä ole viittausta pyyntöön. Viestin tunniste on olemassa vain
  lainausta ja linkkiä varten.
- Hyppyraja on 2: viestiin voi tulla yksi tai useampi viesti takaisin
  ilman sinua, mutta niihin vastataan viestillä vasta, kun kirjoitat.
  Osallistujan vuoro ei lähetä. Ajastetun herätyksen vuoro lasketaan
  omistajan vuoroksi.
- Lähtevä viesti näytetään CLI-tuloksen perusteella eikä Habitat kirjoita
  sitä lähettäjän natiiviin historiaan, koska käynnissä olevaan Pi:hin
  ei voi kirjoittaa erillistä merkintää.
- Lainattava viesti on oltava lähettäjän omassa historiassa, joten agentti
  ei voi liittää sanoja viestiin, jota sen keskustelussa ei ole.
- Viesti takaisin ei ohjaa (`steer`) käynnissä olevaa vuoroa, ellet ole
  pyytänyt keskeytystä.
- Ohje käskee olemaan lähettämättä pelkkää kuittausviestiä.

### Kysymykset Jarille

1. Riittääkö hyppyraja 2 (viestiin voi tulla viestejä takaisin, mutta
   niihin vastataan viestillä vasta, kun kirjoitat), vai saavatko agentit
   jatkaa keskenään pidempään, esimerkiksi neljä hyppyä?
2. Kelpaako A Kirjeet, vai haluatko B:n säikeen, joka kokoaa vaihdon
   yhteen paikkaan?
3. Kuuluuko lähtevä viesti näyttää aina kuplana, vai vain silloin, kun
   agentti ei itse kerro tekstissään lähettäneensä sen?

## Kierros 1

Kierros: `design-system/prototypes/rounds/2026-11-24-agent-agent-message/`
(rakennus ja tarkistus: `NOTES.md`). Suunnitelma ja host-tiedot:
[design.md](design.md). Sivu on rakennettu tuotannon komponenteista;
kierroksen omia ovat saapuvan viestin kortti, Habitat-rivit ja lähetetyn
viestin kortti.

Sivulla on kaksi keskustelua rinnakkain: vasemmalla *Kvartaaliraportti*,
jossa pyydät agenttia kertomaan Q3-luvuista *Kaaviot*-keskustelulle, ja
oikealla *Kaaviot*, joka saa viestin ja vastaa. Yläpalkista voi vaihtaa
vastaanottajan tilan (Vapaa, Kesken, Pysähtynyt, Arkistoitu), vaiheen
(Lähetetty, Vastattu), kielen ja teeman. Sivun alla näkyy, mitä
vastaanottava Pi saa.

Akseli: kuinka paljon vaihdosta näkyy kummallakin puolella.

- **Nyt.** Lähettäjän puolella näkyy bash-rivi ja UUID. Vastaanottaja
  näyttää viestin sinun kuplanasi ("Sinä"), ja sen Pi vastaa kuin olisit
  kirjoittanut sen itse.
- **A Kirje.** Saapuva viesti on oma korttinsa agentin puolella: lähettävän
  työtilan kuvake, *Agentin viesti keskustelusta Kvartaaliraportti* linkkinä,
  teksti ja *Kirjoitti agentti, ei sinä*. Lähettäjän agentti kertoo
  lähettäneensä viestin ja linkittää sen keskusteluun. Vastaus jää
  vastaanottajalle.
- **B Rivi.** Kummallakin puolella on Habitatin rivi. Lähettäjän puolella
  *Viesti lähti keskusteluun Kaaviot · otettu vastaan* korvaa komentorivin,
  ja vastaanottajan puolella on *Keskustelun Kvartaaliraportti agentti
  kirjoittaa* sekä teksti hillittynä lainauksena.
- **C Kierto.** Saapuva viesti on kortti kuten A:ssa. Lähettäjän puolella
  on lähetetyn viestin kortti, jonka tila vaihtuu (Odottaa, Jonossa, Otettu
  vastaan, Vastattu 9.42), ja vastauksen alku palaa korttiin. Vastaus on
  merkitty vastaanottajan puolella.

**Suositus: A.** Uutta on vähiten: yksi kortti ja agentin oma linkki
CLI-tuloksen `conversation_url`:sta. Lisäksi A näyttää täsmälleen sen,
mitä host tietää. B on hiljaisin, mutta pyyntö katoaa järjestelmärivien
joukkoon, vaikka se on oikea pyyntö, johon agentti tarttuu. C:n palaava
vastaus vaatisi lähettäjän näkymää seuraamaan toisen keskustelun
historiaa. Lisäksi se näyttää keskustelulta kahden agentin välillä, mitä
suunnitelma juuri välttää.

### Host-tiedot, joita näkymä olettaa

Tiedot on luettu koodista, ja yksityiskohdat ovat [design.md](design.md):n
osiossa 1. Nykyään `message create` kulkee samaa `admitMessage`-polkua
kuin selaimen lähetys, ja Pi saa tekstin tavallisena käyttäjän viestinä
ilman lähettäjää. Varattu kohde kieltäytyy `send`-lähetyksestä, ja
`follow-up` menee jonoon. Pysähtynyt selainkeskustelu pidätetään ja
käynnistetään viestistä. Arkistoitu kieltäytyy (`control_uncertain`), ja
päätteessä aloitettu keskustelu on `read_only_history`. Suunnat A–C
olettavat suunnitelman lisäykset: daemonin `<agent-message>`-lohko,
historian ja jonorivin `agent_message`-tieto, `conversation_url` ja
`agent_message_chain`-raja. Labia ei käynnistetty tällä kierroksella.

### Tarkistus

`check.mjs` kävi kaikki neljä suuntaa Päivä-, Yö- ja Korkea kontrasti
-teemassa 1440 ja 390 px vähennetyllä liikkeellä suomeksi, ja lisäksi
englanniksi 1440 Päivä ja 390 Yö. Mukana olivat merkintä, linkit
paneelien välillä, vaiheet, varattu, pysähtynyt ja arkistoitu kohde sekä
Pi:n saama teksti. 756 tarkistusta meni läpi, ja konsoli pysyi puhtaana.
Kuvat (DPR 2) ovat repositorion ulkopuolella
`/var/tmp/agent-keep/agent-agent-message/`.

### Decisions for later review

- Merkintä on daemonin rakentama tekstilohko eikä erillinen custom message,
  jotta pidätetyt, jonotetut ja ohjatut viestit kulkevat nykyisiä polkuja
  (sama malli kuin `reply-to`). Lohko kertoo lähettäjän eikä ole
  turvaraja, koska saman Unix-käyttäjän prosessi voi kirjoittaa natiivin
  tiedoston suoraan.
- Agentin reitti merkitsee jokaisen viestin. Ilman käynnistyskontekstia
  lähettäjä on "agentti Habitatin keskustelun ulkopuolelta", joten
  agentin reitiltä ei koskaan tule viestiä, joka näyttäisi sinun
  kirjoittamaltasi.
- Vastaanottavalla vuorolla on työkalut kuten omistajan vuorolla. Ohje
  käskee kysymään sinulta ennen peruuttamatonta tai julkaisevaa tekoa.
- `agent_message_chain`: vuoro, jonka aloitti agentin tai osallistujan
  viesti, ei voi lähettää eteenpäin. Ajastetun herätyksen vuoro voi.
- Jaetun keskustelun osallistujat näkevät viestin tulleen "omistajan
  toisesta keskustelusta" ilman otsikkoa ja linkkiä.
- Taskfleet-workerit käyttävät Taskfleetin kanavaa (`run message`,
  `node ask`/`run answer`) eivätkä `message create` -komentoa.
- Myöhemmin harkittavia: `@`-maininta keskustelun valintaan kentässä ja
  `message create --wait`, joka palauttaa asettuneen vastauksen.

### Kysymykset Jarille

1. Kelpaako A Kirje, vai haluatko C:n tavoin nähdä vastauksen palaavan
   lähettäjän puolelle?
2. Saako vastaanottava agentti toimia viestin perusteella työkaluilla
   (suositus), vai pitäisikö sen kuten osallistujan viestissä vastata ensin
   pelkällä tekstillä, kunnes hyväksyt?
3. Riittääkö yhden hypyn raja, eli voiko agentti, jolle viesti tuli,
   koskaan lähettää viestiä eteenpäin, jos et itse pyydä?
