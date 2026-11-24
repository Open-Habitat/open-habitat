# Agentin viesti toiselle keskustelulle

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
