# Agentin viesti toiselle keskustelulle

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
