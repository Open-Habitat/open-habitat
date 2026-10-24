# Tulos: kuka omistaa käyttöönoton, pääsyn ja sivuston AI-avaimen

## Tiivistelmä Jarille

Tämä on päätösehdotus. ADR:ää ei ole hyväksytty, eikä mitään ole toteutettu.
Koko ehdotus on tiedostossa [plan.md](plan.md). Se korvaa 23.10. version,
joka rakentui kutsujen varaan ja oli kirjoitettu ennen kierroksia 2–6.

Ehdotus lyhyesti:

- **Käyttöönoton asetukset** (repojen tapa ja oletusrepot, integraatiot, AI-tilin
  tarjous) tallennetaan gatewayn ylläpitotilaan, samaan paikkaan kuin palvelimen
  nimi ja oletuskiintiö. Niitä muokataan selaimesta tai `admin onboarding`
  -komennolla. Daemon ei lue asetustiedostoa. Gateway antaa sille vain sen,
  mitä kukin pyyntö tarvitsee. Asetuksilla ei voi laajentaa henkilön oikeuksia,
  koska haut tehdään hänen omalla GitHub-tunnuksellaan hänen omaan kotiinsa.
- **Pääsy:** broker pitää kahta listaa. `site.json` on rootin lista kuten nyt.
  Toinen on ajonaikainen lista, johon selaimen ylläpitäjä voi lisätä ja josta
  hän voi poistaa. Brokerin vahvistus on se "palvelin vahvistaa", jonka
  prototyyppi näyttää. Poistossa gateway estää ensin henkilön ja sulkee hänen
  istuntonsa, ja vasta sitten broker poistaa pääsyn. Näin mikään katkos ei jätä
  pääsyä auki. Palautettu henkilö palaa samalle Unix-tilille.
- **Sivuston AI-avain** säilytetään gatewayn omassa suojatussa tiedostossa. Se
  kopioidaan uuden henkilön Pi-tunnuksiin kerran, sillä kirjautumisella, jolla
  broker luo hänen tilinsä. Kopio ei koskaan korvaa henkilön omaa avainta.
- **Oletusrepot** hakee henkilön oma daemon hänen omalla GitHub-tunnuksellaan
  ensimmäisellä kirjautumisella, vain kerran. Gateway tarkistaa ensin, mihin
  henkilöllä on pääsy, joten repon nimi, johon pääsyä ei ole, ei päädy hänen
  Unix-tililleen lainkaan.
- **Ylläpitäjän näkemä tulos** ("2/3 oletusrepoa · ei pääsyä: X") on kuitti, joka
  syntyy henkilön ensimmäisellä kirjautumisella ja tallentuu gatewayhin. Kukaan
  ei lue henkilön kotihakemistoa, eikä daemon vastaa ylläpitäjän kyselyihin.

## Kysymykset

1. **Saako selaimen ylläpitäjä päästää palvelimelle uusia ihmisiä?** Tämä on
   gatewayn uusi valta. Jos gateway murretaan, hyökkääjä voi luoda tilejä, jotka
   jäävät palvelimelle murron korjaamisen jälkeenkin. Tavallisten käyttäjien
   koteihin murrettu gateway pääsee jo nyt daemonien kautta. **Suositus: kyllä,**
   mutta vain kun `site.json`issa on `runtime_admission: true`. Oletus on pois,
   ja testipalvelimella se on päällä.
2. **Ketään `site.json`in sallimaa ei voi poistaa selaimesta, ei ylläpitäjiä
   eikä muitakaan, ja selaimen ylläpitäjäroolin muokkaus poistetaan.** Nykyään
   selain voi myöntää roolin, mutta seuraava `host apply` perii sen takaisin.
   **Suositus: kyllä.**
3. **Saako gateway säilyttää sivuston AI-avaimen?** Tämä on poikkeus sääntöön,
   jonka mukaan palvelin ei säilytä tunnuksia. Gateway ei välitä avainta käytön
   aikana. Se vain kopioi sen kerran uudelle henkilölle. Tiedoksi: jokainen uusi
   henkilö ja hänen agenttinsa voivat lukea avaimen omasta tiedostostaan, eikä
   kopioita saa takaisin. Käytön voi lopettaa vain mitätöimällä avaimen
   palveluntarjoajalla, ja silloin se lakkaa toimimasta kaikilta kerralla.
   **Suositus: kyllä.** Ainoa vaihtoehto, jolla avaimen voisi perua henkilöltä,
   olisi oma välityspalvelu, ja se on juuri se credential broker, jota emme
   rakenna.
4. **Saako gateway käyttää henkilön kirjautumistokenia oletusrepojen pääsyn
   tarkistukseen,** jotta repon nimi, johon henkilöllä ei ole pääsyä, ei
   päädy hänen Unix-tililleen? Yksinkertaisempi vaihtoehto on, että daemon
   tarkistaa pääsyn. Silloin nimet eivät näy käyttöliittymässä, mutta
   henkilön omalla tilillä ajettu ohjelma voi lukea ne. **Suositus: gateway
   tarkistaa,** koska kierroksella 5 sovittiin, että vain ylläpitäjä näkee nimen.
5. **Riittääkö käyttäjälistaan kirjautumishetken kuitti?** Se ei kerro, onko haku
   valmistunut, eikä päivity, jos pääsy annetaan myöhemmin. Siksi teksti
   olisi "2/3 oletusrepoa · ei pääsyä: X" eikä "haettu". Elävä tieto vaatisi,
   että ylläpitäjä kysyy jokaisen henkilön daemonilta. **Suositus: kuitti riittää.**
6. **Avaimen asentaminen jo liittyneille** (`admin ai-key seed`, vain root,
   ei koskaan henkilön oman avaimen päälle): **suositus: tehdään myöhemmin
   erillisenä työnä**, ei ensimmäiseen versioon.

## Review

`/llm-review` (finder gpt-6-astra, verifier claude-fable-5-1, 2 calls, high-risk
surface). Five findings were confirmed locally and by the verifier, and all were
folded into the plan:

- the withdrawal crash window relied on a broker epoch the gateway cannot
  observe; replaced by a durable gateway-side deny before `withdraw`;
- restore could revive a cookie left by a crashed withdrawal; restore now
  removes leftover sessions first;
- the daemon-side access check put inaccessible repository names into the
  person's UID; the check moved to the gateway (question 4);
- seeding through the personal save path could overwrite a key saved by a
  concurrent login; the seed is now write-if-absent under Pi's lock;
- the receipt had no `unknown` state, and the AI-step fallback now follows
  native Pi status rather than the receipt.

## Validation and limits

Documentation-only proposal: no Go, browser, contract or deployment change, so
no tests were run. Claims about current code were checked against
`internal/gateway/{administration,auth,revoke,live,session}.go`,
`internal/host/apply_control_linux.go`, `internal/provision/{protocol,installation_linux}.go`,
`internal/transport/transport_linux.go` and
`internal/daemon/pi_credentials_helper.mjs`. The issue stays in-progress with
preparation pending until Jari answers.
