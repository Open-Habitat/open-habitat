# Handoff: Pi-keskustelun lohkot (design-pi-event-blocks)

Vedos: [`design-system/drafts/Pi-keskustelun lohkot.dc.html`](design-system/drafts/Pi-keskustelun%20lohkot.dc.html)
Pohja: Pi 0.85.1 -katalogi, `carry-typed-pi-events/result.md`, `Kontrollitilat ja agentin tila.dc.html`, nykyiset tokenit.
Aineisto on synteettistä. Ehdolliset tilat on merkitty vedokseen katkoviivatagilla: ne tarvitsevat faktan, jota host ei vielä välitä.

## Periaatteet

1. **Vuoro on yksi kokonaisuus.** PI-otsake näkyy kerran vuoron alussa. Ajattelu, teksti ja työkalut seuraavat Pi:n järjestyksessä. Vuoron lopputulos näkyy yhdellä alarivillä (TurnFooter), ja vasta kun `agent_settled` on havaittu.
2. **Yksi työkalun käyttö on yksi rivi.** `toolCallId` sitoo toolCallin, `tool_execution_*`-tapahtumat ja `toolResult`-viestin. Tila vaihtuu rivin päässä, ja tallennettu tulos korvaa väliaikaisen samassa kohdassa.
3. **Raja näkyy rajana.** Esikatselun loppu, Pi:n katkaisu, pituusraja (`length`) ja keskeytys (`aborted`) saavat katkoviivan ja sanan. Virhe ei koskaan näytä onnistumiselta.
4. **Elävä ja tallennettu näkymä ovat samat.** Striimaus lisää vain liikkeen ja tilasanan.
5. **Rivin tieto tulee argumenteista, ei työkalun nimestä.** Pääargumentti valitaan järjestyksessä `path` › `command` › `pattern`. Muulle työkalulle näytetään argumenttien määrä. Diffiä tai polkua ei päätellä nimestä.

## Lohkot ja tilavalinnat

| Perhe | Tilat | Perustelu |
|---|---|---|
| Käyttäjän viesti | lyhyt, teksti ja kuvat järjestyksessä, ei-tuettu MIME, pitkä viesti supistettuna (8 riviä, laajennettava), kuva dialogissa | Käyttäjän viestiä ei striimata. Lähetyksen tila kuuluu Kontrollitiloihin. Kuvateksti on "Kuva n · tyyppi", koska Pi ei tallenna tiedostonimeä. |
| Assistentin vastaus | kirjoittuva, `stop`, pitkä vastaus rajatulla esikatselulla, `length`, `aborted`, `error`, `deferred`, päättymistä ei voitu vahvistaa | Vastaus on pääsisältöä, joten se ei supistu. `toolUse` on vuoron sisäinen tila, eikä sitä näytetä loppuna. Raakaa virhetekstiä ei näytetä. Hintaa ei näytetä, vain tokenit. |
| Ajattelu | keskeneräinen (häivytetty häntä), valmis supistettuna, valmis avattuna, pitkä rajattuna, redaktoitu | Redaktoitu ajattelu on yksi hiljainen rivi, ei varoitus. Salattua payloadia ja allekirjoitusta ei esitetä. |
| Työkalun käyttö | muodostuu, ajossa (avattava, elävä häntä), valmis, avattu (argumentit ja rajattu tulos, Alku/Loppu), koko tulos lohkoluvulla, Pi:n katkaisu (ehdollinen), virhe ja exit-koodi, edit argumentteina, kuvatulos, laajennustyökalu, keskeytetty, tila ei tiedossa | Muodostuvaa riviä ei voi avata, koska argumentit eivät vielä jäsenny. Ajossa olevan rivin voi avata (pitkä komento luettavissa). Esikatselun oletuskohta: bash loppu, muut alku, ja valinta muistetaan työkalukohtaisesti. |
| Paikallinen komento | ajossa, exit 0, `!!` + exit 1 + katkaistu, peruttu, exit ei tiedossa | Komento on käyttäjän puheenvuoro (SINÄ · PAIKALLINEN KOMENTO, $-kehote), ei työkalu. Ei suorituskontrollia. `fullOutputPath` ei näy. |
| Tiivistelmät ja merkit | malli, ajattelutaso, nimi, merkintä lisätty ja poistettu, tiivistys supistettuna ja avattuna, haaran tiivistelmä | Merkit näkyvät keskitettynä rivinä. Runtime-projektiosta ei tule toista riviä. Haaraan siirtymistä ei tarjota. |
| Laajennus | `display:true`-viesti, ilmoitus (info, varoitus, virhe), tila ja widget kentän yläpuolella | Tila ja widget kuvaavat nykytilaa eivätkä kuulu historiaan. Sama avain korvaa arvon, tyhjä arvo poistaa sen. Piilotettu sisältö ei näy missään. |
| Saapuva kysymys | select, input ja editor avoimina, confirm vastattuna, input peruttuna, editor aikarajan umpeuduttua, käsittely ei tiedossa | Kysymyksestä jää kirjaus keskusteluun. Avoin kysymys avaa nykyisen dialogin. Pi-kohtaisia uusia kontrolleja ei lisätä. `editor`-tyypin "Vastaa…" on estetty ja syy näkyy. |
| Palautuminen ja työskentely | työskentelyrivi: työkalu, retry, tiivistys, summary retry, asettumisen odotus, keskeytys; uudelleenyritykset loppuneet; jonot; tuntematon lohko | Ohimenevä tila ei jätä historiaan jälkeä, kun se onnistuu. Täysi piste tarkoittaa työtä, ontto rengas odotusta. Tuntematon lohko näytetään hiljaisena paikkana ilman JSONia. |

## Päätökset tältä kierrokselta (Jari, 2026-10-05)

- Peräkkäisten työkalujen ryhmittely historiassa siirtyy **myöhemmäksi omaksi issuekseen**. Yksittäinen ToolUse todennetaan ensin.
- Käyttäjän viesti supistetaan 8 riviin, ja sen voi laajentaa.
- `edit` näyttää muutoksen argumentteina (`oldText`/`newText`). **Diff-näkymä tulee omaksi issuekseen.**
- Esikatselun oletuskohta: bash loppuun, muut alkuun, ja valinta muistetaan työkalukohtaisesti.

## Ehdotetut jatkoissuet

1. Pi-lohkojen toteutus tuotantokomponentteihin ja katalogiin (tämä handoff).
2. Peräkkäisten työkalukäyttöjen ryhmittely historiassa (ToolGroup).
3. Diff-esitys `edit`-työkalulle (vaatii diff-metatiedon, liittyy @extend-tool-views).
4. Hostin datatäydennykset, ks. aukot 1–8 alla.
5. Lab-inventaarion uudet tilat, ks. kattavuus.

## Aukot: data, jota design tarvitsee

1. Työkalun katkaisu: `details.truncation` jätetään kokonaan välittämättä. Ehdotus: välitetään `truncated` ja rivimäärä.
2. Koko sisällön koko: rivimäärä tai tavukoko "rivit 1–12 / 212" -tekstiä varten.
3. bash-työkalun exit-koodi on vain tekstissä ("Command exited with code N"). Ehdotus: host poimii sen tyypitetyksi kentäksi.
4. Virheen turvallinen luokka (raja, verkko, autentikointi) ilman `errorMessage`-tekstiä.
5. Kysymyksen saapumishetki aikarajan laskuria varten.
6. `label.targetId`: kartoitus näkyvään lohkoon.
7. `notify`-ilmoituksen lähde (laajennuksen nimi).
8. Jääkö epäonnistunut assistenttiviesti sessioon retryn jälkeen? Tämä vaikuttaa historian välivirheisiin.

## Inventaarion kattavuus

- `typed-pi-stream`: vedoksen askeleet 1, 3, 4, 6 ja 9 pysäytettyinä.
- `tool-expanded` / `typed-pi-tool-variants`: matriisi työkalu × onnistui, virhe, kuva, pitkä, katkaistu ja laajennus.
- `typed-pi-block-read`: esikatselu → lataus → osittainen → kokonainen sekä vanhentunut revisio.
- `unknown-content`: eristetty fixture.
- `typed-pi-markers` jaetaan neljään osaan: merkit, tiivistelmät, laajennus ja paikallinen komento.
- `typed-pi-recovery`: `length`, `aborted`, `error`, `deferred` sekä retry ennen ja jälkeen `agent_settled`-tapahtuman.
- Uudet tilat: `extension-status-strip` ja `question-record`.
- Vertailufixtureen lisätään yksi epäonnistunut työkalu ja yksi paikallinen komento.

## Nykyesityksen korjattavat kohdat

- Sama työkalu näkyy kahdesti ("▶ Työkalukutsu · read · c" ja erillinen "read · Tulos valmis").
- "PI"-otsake toistuu saman vuoron sisällä.
- Markdown näkyy historiassa raakana (`` `/usr/share/zoneinfo` ``).
- "Kopioi mallin tunniste" on tekstipainike, ja se muutetaan ikoniksi.
- send-uncertain-tilassa bash jää tilaan "ajossa", vaikka sen pitäisi olla "tila ei tiedossa".
- UnpresentedEvents näyttää raakaa JSONia.

## Muutoslista

Kaikki 110 riviä ovat tilassa `UNRESOLVED mapping`. Ryhmäkohtaiset kommentit ovat vedoksen osiossa *Kommentit paketin muutoslistaan*. Pyyntö: `assemble.py` ratkaisemaan kartoitus, jotta seuraava paketti näyttää muutosten sisällön.
