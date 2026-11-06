# Tulokset

## Kierros 1 (6.11.2026)

Kierros: `design-system/prototypes/rounds/2026-11-06-palvelinselain/`
(NOTES.md kertoo tarinan, ohjaimet ja mikä on yhteistä). Akseli: missä
henkilön palvelinselain asuu Habitatissa. Sisältö on kaikissa sama: agentti
pyytää Ainoa kirjautumaan Netvisoriin, Aino luovuttaa selaimen, agentti
lataa laskut, Netvisor pyytää koodia uudelleen kesken työn, Aino syöttää sen
ja antaa selaimen takaisin, ja ohjauksen voi ottaa milloin tahansa.

- **1 Rinnakkain**: selain avautuu keskustelun viereen kuten editori; yläpalkin Selain-painike, ohjaus ja agentin nykyinen toimi paneelin alalaidassa.
- **2 Oma näkymä**: selain on sivupalkissa omana kohtanaan ja avautuu koko näkymäksi; vieressä Agentin toimet -loki kaikista keskusteluista.
- **3 Pyydettäessä**: selainta ei näy ennen kuin sitä tarvitaan; se avautuu arkkina keskustelun päälle, ja agentin työ näkyy keskustelussa pienenä elävänä kuvana.

Kuvat: `evidence/r1-<suunta>-<vaihe>-<leveys>-<teema>.avif`. Suunnat
`1-rinnakkain`, `2-oma-nakyma`, `3-pyydettaessa`. Vaiheet: `0-oletus`
(myös tummana), `1-suljettu` (sisäänkäynti), `2-koodi`, `3-kirjautunut`,
`4-agentti`, `5-otit` (ohjaus otettu takaisin), `6-pyytaa` (MFA kesken työn),
`7-vahvistettu`, `8-valmis`; suunnassa 2 myös `9-keskustelu`.

### Mitä kukin suunta päättää

| | 1 Rinnakkain | 2 Oma näkymä | 3 Pyydettäessä |
|---|---|---|---|
| Avaaminen | yläpalkin maapallo tai agentin pyyntökortti | sivupalkin *Oma selain* tai kortti | vain agentin kortti tai elävä kuva |
| Etänäkymä | paneeli keskustelun vieressä, puhelimessa peittää sen | koko pääalue, keskustelu taustalla | modaali arkki, puhelimessa alhaalta |
| Luovutus | *Valmis, agentti jatkaa* paneelin alalaidassa (ja kortissa) | sama näkymän alalaidassa | sama arkissa; arkki sulkeutuu |
| Mitä agentti tekee | elävä paneeli, osoitin, toimi alalaidassa; rivit keskustelussa | sama näkymässä + loki kaikista keskusteluista | pienoiskuva keskustelussa + rivit |
| Ohjaus takaisin | *Ota ohjaus* paneelissa | *Ota ohjaus* näkymässä | *Ota ohjaus* pienoiskuvan vieressä |
| MFA kesken työn | kortti keskustelussa, sivu näkyy paneelissa | kortti keskustelussa; rivi sivupalkissa *Odottaa sinua* | kortti *Syötä koodi* avaa arkin |

Yhteistä: ohjaus on yhdellä kerrallaan ja sanotaan sanoin. Agentin
käyttäessä selainta etänäkymä on vain katseltava. *Valmis* on käytössä
vasta, kun sivu näyttää kirjautuneen tilan. Agentti päättelee kirjautumisen
itse sivulta, ja sulkeminen ei kirjaa ulos.

## Suositus

**1 Rinnakkain.** Selain on samassa paikassa ja samalla eleellä kuin editori
ja agentin näkymät, joten Habitat ei saa uutta navigointikäsitettä. Henkilö
näkee agentin työn livenä sen keskustelun vieressä, jossa hän antoi tehtävän,
ja *Ota ohjaus* on aina samassa kohdassa. Puhelimessa paneeli toimii kuten
muutkin näkymät.

- **2** tekee selaimesta henkilön oman paikan, mikä on totta (yksi selain
  per henkilö), mutta sen loki kokoaa kaikkien keskustelujen selaintoimet.
  Se on joko uusi tietovarasto tai kaikkien Pi-sessioiden luku ristiin.
  Toimet ovat jo keskusteluissaan, joten loki on toinen paikka samalle
  totuudelle. Sivupalkin tilarivi on hyvä, ja sen voi lainata ykköseen.
- **3** on kevyin, mutta selainta ei voi avata itse ilman agenttia
  (esimerkiksi kirjautuakseen etukäteen), ja modaali arkki peittää
  keskustelun juuri silloin, kun agentin pyyntöä pitäisi lukea. Pienoiskuva
  keskustelussa on silti hyvä tapa näyttää työ paneelin ollessa kiinni.

## Host-tiedot (oletuksia)

Rinnakkainen selvitys `research-remote-browser-session` ei ollut vielä
mainissa, joten nämä ovat uskottavia oletuksia. Raportin pitää vahvistaa tai
kumota ne.

- **Selain** on henkilön oma Chromium omassa user-palvelussaan
  virtuaalinäytöllä (Xvnc/KasmVNC tai headless Wayland). Profiili on
  henkilön kodissa (0700), joten evästeet ovat hänen tunnuksiaan. Selain
  käynnistyy pyydettäessä ja jää päälle näkymän sulkemisen jälkeen.
- **Etänäkymä** kulkee kuten editori ja shell: gateway todentaa selaimen ja
  välittää yhteyden henkilön daemonille per-käyttäjän Unix-socketin kautta.
  TCP-portteja ei ole. Näkymän koko seuraa katsojaa (puhelimessa kapea).
- **Agentin pääsy** käyttää Chrome DevTools Protocolia
  `--remote-debugging-pipe`-putken kautta. Putken omistaa henkilön oma
  apuri, eikä localhost-porttia ole. Pi saa natiivin työkalun (laajennus tai
  CLI-taito), jonka jokainen kutsu on tavallinen työkalurivi `selain`
  keskustelussa. "Mitä agentti teki" on siis natiivi historia, ei uusi
  varasto.
- **Ohjaus** on daemonin muistissa oleva tieto siitä, kenellä selain on
  (henkilö tai agentti). Kun henkilö ohjaa, agentin työkalu odottaa ja
  vastaa "henkilö ohjaa". Kun agentti ohjaa, etänäkymän syöte pudotetaan
  (vain katselu). Yksi tila, ei tallennusta.
- **Kirjautumisen tunnistaminen**: daemon ei lue evästeitä. *Valmis* on
  tavallinen viesti/vastaus agentille, ja agentti varmistaa kirjautumisen
  itse sivun sisällöstä. Valmis-painikkeen harmaus (vain kirjautuneena) on
  prototyypin yksinkertaistus. Hostissa painike on aina käytössä, ja agentti
  kertoo, jos kirjautuminen puuttuu.
- **MFA kesken työn**: agentin työkalulla on "pyydä henkilöä" -kutsu. Se
  näkyy keskustelussa pyyntökorttina (kuten Pi:n natiivi kysymys), siirtää
  ohjauksen henkilölle ja palaa, kun henkilö antaa selaimen takaisin.

## Kysymykset Jarille

1. **1, 2 vai 3?** `r1-1-rinnakkain-4-agentti-1440-light`,
   `r1-2-oma-nakyma-4-agentti-1440-light`,
   `r1-3-pyydettaessa-4-agentti-1440-light`. Suositus 1.
2. **Näytetäänkö agentin selaintyö keskustelussa pienoiskuvana silloin, kun
   paneeli on kiinni?** `r1-3-pyydettaessa-4-agentti-1440-light`. Ehdotan sitä
   ykköseen paneelin rinnalle; ilman sitä ainoa merkki on piste yläpalkin
   painikkeessa.
3. **Tarvitaanko kaikkien keskustelujen selainloki?**
   `r1-2-oma-nakyma-8-valmis-1440-light`. Suosittelen ei: toimet ovat jo
   keskusteluissaan, ja loki olisi toinen paikka samalle tiedolle.

## Näyttäminen

```
node design-system/prototypes/rounds/2026-11-06-palvelinselain/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/palvelinselain/offline.html \
  --title "Oma palvelinselain – kierros 1" \
  --idempotency-key "$(uuidgen)" --json
```

## Tarkistus

`check.mjs`: 194 tarkistuspistettä, konsoli puhdas. Kaikki suunnat ajettiin
1440 ja 390 px vaaleana koko tarinan läpi (avaaminen, kirjautuminen
koodeineen, luovutus, vain katseltava näkymä agentin työn aikana, ohjauksen
ottaminen ja agentin pysähtyminen sen ajaksi, MFA kesken työn, valmis).
Oletukset ajettiin myös tummana. Kuvat ovat kertoimella 2 (AVIF). Kyse on
synteettisestä komponenttilabrasta, jota ei ole ajettu hostia vasten.
Kierros ei muuttanut tuotantokoodia.

## Päätökset myöhempää katselmointia varten

- **Netvisor esimerkkinä.** Valittu, koska Contosoin tutkimus käsittelee sitä.
  Sivu on yleinen mock eikä jäljittele palvelun ulkoasua.
- **Etäsivu on aina vaalea.** Etäselain näyttää sivuston sellaisenaan, joten
  tumma teema koskee vain Habitatin kehystä.
- **Agentin osoitin nimettynä pisteenä.** Henkilö näkee, mihin agentti
  osoittaa. Tämä edellyttää, että työkalu kertoo kohteen koordinaatit; ilman
  niitä osoitin jää pois.
- **Puhelimessa suunnan 2 loki on välilehtenä.** Selain ja loki eivät mahdu
  rinnakkain.
