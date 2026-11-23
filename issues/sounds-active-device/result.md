# Tulos: merkkiääni vain käytössä olevalla laitteella (kokeellinen)

Toteutettu kokeellisen ominaisuuden `sounds-active-device` taakse (kortti
Kokeelliset ominaisuudet -sivulla, oletuksena pois). Pois päältä ääni
toimii täsmälleen kuten ennen: selain ei lähetä mitään eikä kysy mitään.

## Miten se toimii

- Jokainen avoin välilehti ilmoittaa omalle daemonilleen
  (`PUT /api/v1/account/active-device`, gatewayn olemassa oleva
  personal-setting-välitys, CSRF kirjoituksissa) näkyykö se ja montako
  millisekuntia sen viimeisestä näppäimistö-, osoitin-, kosketus- tai
  rullasyötteestä on. Ilmoitus lähtee heti tauon jälkeisestä syötteestä,
  jatkuvan syötteen aikana enintään 10 sekunnin välein, näkyvyyden
  muuttuessa, minuutin välein sydämenlyöntinä ja `pagehide`ssa (`left`).
- Daemon pitää tiedot vain muistissa (henkilön oma daemon, joten toisen
  ihmisen laitteista ei tiedetä mitään). Kun ääni on tulossa, välilehti
  kysyy daemonilta, soiko se: tuorein syöte viiden minuutin sisällä voittaa.
  Jos millään välilehdellä ei ole syötettä viiteen minuuttiin, kaikki
  soittavat.
- Hiljaisuudet (pois, mykistys, yö, näkyvä keskustelu) tarkistetaan ensin;
  vasta äänen, joka muuten soisi, kohdalla kysytään daemonilta.
- Välilehti, joka ei saa vastausta 1,5 sekunnissa tai ei saa yhteyttä,
  soittaa.

## Päätökset myöhempää tarkastelua varten

- **Kanava.** Tehtävänanto pyysi käyttämään olemassa olevaa
  läsnäolokanavaa. Keskustelukohtainen `POST .../presence` (recap- ja
  idle-Pi-läsnäolo) on keskustelun, ei välilehden, eikä se palauta mitään;
  sen laajentaminen olisi sekoittanut kaksi asiaa. Valitsin saman
  autentikoidun selain→gateway→daemon-välityksen, jota tilin omat
  asetukset käyttävät (`personalSetting`), uudella polulla. Ei uutta
  kanavaa, ei uutta auktoriteettia: gateway vain välittää, daemon päättää.
  Vaihtoehto: ilmoitukset keskustelun presenceen — hylätty, koska
  välilehti ilman avointa keskustelua ei voisi ilmoittaa.
- **Päätös äänen hetkellä, ei push.** Välilehti kysyy daemonilta vasta
  kun ääni on tulossa (yksi pyyntö), sen sijaan että daemon työntäisi
  aktiivisen välilehden tiedon kaikille. Ei uutta tapahtumatyyppiä
  snapshot-virtaan. Hinta: ääni viivästyy yhden kiertoajan verran.
- **Näkyvyys on vain tasapelin ratkaisija.** Piilotettu välilehti voi
  olla aktiivinen (ihminen kirjoittaa samalla koneella toiseen
  sovellukseen). Alle sekunnin ero syötteissä on tasapeli: näkyvä voittaa
  piilotetun, useampi näkyvä soittaa kaikki (tupla-ääni on parempi kuin
  puuttuva).
- **Suljettu välilehti.** `left` on vain nopeutus: testipalvelimella
  keepalive-`fetch` ei navigoinnissa päässyt perille. Varsinainen turva on
  se, että daemon unohtaa välilehden, josta ei ole kuulunut 150 sekuntiin
  (sydämenlyönti 60 s, piilotetun välilehden ajastimet voivat pyöriä vain
  kerran minuutissa). Pahimmillaan suljettu, viimeksi käytetty laite pitää
  ääntä muilta 150 sekuntia tai kunnes toista laitetta käytetään.
- **Välilehden tunniste säilyy uudelleenlatauksessa** (sessionStorage),
  jotta ladattu sivu ottaa edeltäjänsä paikan eikä jätä haamua. Kopioitu
  välilehti perii tunnisteen; se on sama laite, joten haitta on pieni.
- **Daemonin uudelleenkäynnistys** unohtaa tiedot: kaikki soittavat kunnes
  seuraava syöte kuuluu.
- **Raja:** enintään 32 välilehteä henkilöä kohden; vanhin kuultu putoaa.
- **Ei laitekohtaista käsiasetusta** tässä vaiheessa, kuten sovittu.

## Tarkistukset

- Go: `./internal/daemon` ja `./internal/gateway` (test-focused) vihreät;
  uudet testit `active_device_linux_test.go` (tuorein voittaa, 5 min idle,
  tasapelit, suljettu ja hiljainen välilehti, raja, HTTP-raja).
- Contracts: `validate-contracts.py` ja `check-generated.sh` vihreät.
- Web: `test-focused.sh --area web` vihreä; uusi `activeDevice.test.ts`
  (kuristus, myös hitaalla vastauksella, kysyminen, varasoitto, `left`,
  ominaisuus pois).
- Selain (`OH_BROWSER_WORKERS=2`): `attention-sound.spec.ts`,
  `settings-experimental.spec.ts` ja uusi
  `attention-sound-active-device.spec.ts` (kaksi selainkontekstia samalla
  henkilöllä: syöte B:ssä → vain B soi; 5 min ilman syötettä (fake clock)
  → molemmat soivat; ominaisuus pois → molemmat soivat), uusi spec
  `--repeat-each 3` yhdellä ja kahdella workerilla.
- Katselmointi: `/llm-review` (finder gpt-6-astra, verifier
  claude-fable-5-2) + `/assess-findings`: yksi korjattu (kuristus riippui
  vastauksen saapumisesta), kaksi pudotettu (harvinaisia, korjaus ei
  selkeytä koodia).

Ei tarkistettu: aito kahden laitteen ajo oikealla asennuksella.
