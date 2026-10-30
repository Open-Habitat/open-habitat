# Sanelu heti painalluksesta, Enter ja pikanäppäin: tulos

Toteutettu 2026-10-30. Muutokset ovat selaimessa (`web/src/app/dictation.ts`,
`web/src/components/composer/Dictation.tsx`, `Composer.tsx`) ja selainhostin
synteettisessä Sonioxissa (`test/browser-host/soniox.go`: `mint-delay`).
Gatewayn ja daemonin koodi ei muuttunut.

## Mihin käynnistysviive meni

Ennen tätä sanelu eteni painalluksesta peräkkäin: mikrofoni
(`getUserMedia`), äänimoottori (AudioContext ja AudioWorklet), väliaikaisen
avaimen haku (selain → gateway → daemon → Sonioxin API) ja vasta sitten
WebSocket Sonioxiin. Painike näytti *Yhdistetään…*, kunnes striimi oli auki.
Ääni puskuroitiin jo mikrofonin avauduttua, mutta käyttäjä odotti merkkiä.

Mitattu 30.10.:

| Vaihe | Aika | Miten mitattu |
|---|---|---|
| Väliaikaisen avaimen luonti Sonioxin API:ssa (US-alue) | 155–176 ms, kylmä yhteys 645 ms | Birchlta Sonioxiin Jarin sivustoavaimella, 3 kertaa |
| WebSocket auki Sonioxiin | 442–490 ms | sama, TLS-kättely joka kerta uusi, kuten selaimessa |
| Ensimmäinen vastaus avauksen jälkeen | 147–177 ms | sama |
| `getUserMedia` | 1–14 ms | headless Chromium, valelaite: tämä on vain alaraja |
| AudioWorklet ja ensimmäinen kehys | 2–3 ms | sama |

Oikean Macin mikrofonin avausaikaa ei voitu mitata Birchlta (ei
istuinta eikä laitetta). Sisäänrakennetulla mikrofonilla se on tyypillisesti
satoja millisekunteja ja Bluetooth-kuulokkeilla enemmän; luku jää
todettavaksi KOKEILTAVAA.md:ssä. Selaimen ja gatewayn välinen edestakainen
matka lisää avaimen hakuun yhden kierroksen.

Puhepalvelun osuus oli siis noin 0,6–1,1 s (avain ja striimi peräkkäin), ja
se tuli mikrofonin jälkeen. Kokonaisuus vastaa Jarin havaitsemaa 1–2 s:a.

## Mitä tehtiin

- **Avain haetaan mikrofonin rinnalla.** Avaimen haku alkaa painalluksesta
  eikä odota mikrofonia. Jos mikrofonin lupakysely kestää yli 30 s, avain
  (elinikä 60 s) haetaan uudelleen ennen käyttöä. Puuttuva tai hylätty avain
  näkyy heti, vaikka selain vielä kysyisi mikrofonia, ja myöhemmin saatu
  mikrofoni suljetaan.
- **Kuuntelee heti.** Painike näyttää *kuuntelee* ja kenttä *Puhu, teksti
  tulee tähän…* painalluksesta. Ääni puskuroidaan siitä hetkestä, kun
  mikrofoni on auki, ja lähetetään striimin auettua. Kesto lasketaan
  mikrofonin avautumisesta, ja 10 minuutin katto lasketaan samasta
  hetkestä. Katto tulee siis hiukan aikaisemmin kuin Sonioxin oma.
- **Valmis ennen kuin striimi on auki** pysäyttää mikrofonin, odottaa
  striimiä enintään 5 s, lähettää puskuroidun äänen ja odottaa viimeiset
  sanat kuten ennenkin. Sama koskee pysäytystä uudelleenyhdistyksen aikana.
  Jos striimi ei aukea, näkyy aloitusvirhe kuten ennen.
- **Enter sanelun aikana = Valmis.** Teksti jää kenttään eikä mitään lähetetä.
  Enter otetaan kiinni ennen kentän omaa käsittelyä, myös silloin kun
  piilotettu kenttä jää kohdistetuksi (Safari). Toisella rivin painikkeella,
  kuten *Lähetä*, Enter tekee edelleen sen painikkeen asian. Esc ennallaan.
- **Pikanäppäin ⌘⇧välilyönti (Mac) / Ctrl+Shift+välilyönti (muut)**
  aloittaa ja lopettaa (Valmis) sanelun mistä tahansa keskustelunäkymästä,
  paitsi toisesta tekstikentästä tai dialogista. Se näkyy *Sanele*-painikkeen
  vihjeessä ja `aria-keyshortcuts`-attribuutissa, ja kuuntelupainikkeen
  vihje luettelee Enterin, Escin ja pikanäppäimen.
- Ulkoasu ei muuttunut. Ainoa ero on, että lyhyt *Yhdistetään…*-vaihe
  näyttää nyt kuuntelutilalta.

## Testit

- `web/src/app/dictation.test.ts`: avain haetaan ennen mikrofonin vastausta,
  kuuntelu alkaa ennen striimiä, Valmis ennen striimiä lähettää puskurin ja
  odottaa sanat, vanhentunut avain vaihdetaan, puuttuva avain ei odota
  mikrofonia, ja ennen avautumista hylätty striimi on aloitusvirhe myös
  pysäytyksen jälkeen.
- `web/tests/speech-input.spec.ts`: kaksi uutta speciä. Ensimmäisessä Enter
  lopettaa sanelun lähettämättä ja pikanäppäin aloittaa ja lopettaa, minkä
  jälkeen Enter lähettää. Toisessa avain viipyy 2 s (synteettinen Soniox):
  painike kuuntelee heti, ja Valmis ennen striimiä vie silti vähintään
  sekunnin ääntä Sonioxille. Olemassa olevat specit odottavat nyt striimin
  avautumista eivätkä enää *live*-tilaa, koska tila tulee ennen striimiä.
- Ajettu: web-tarkistukset (990 testiä), `speech-input.spec.ts` (11) ja
  `lab-composer-area.spec.ts` (10), `go vet ./test/browser-host`.
  Katselmointi: kohdennettu itsekatselmointi (vain selain ja testifikstuuri).

## Decisions for later review

- **Pikanäppäin on ⌘⇧välilyönti / Ctrl+Shift+välilyönti.** Selaimet
  (Chrome, Safari, Firefox, Edge), macOS ja Windows eivät käytä sitä.
  Välilyönti on sama kaikilla näppäimistöasetteluilla. VS Coden *parameter
  hints* käyttää samaa yhdistelmää, mutta editori on omassa kehyksessään,
  joten sen näppäimet eivät tule meille. Hylätyt vaihtoehdot:
  - ⌥/Alt+kirjain: Macilla se kirjoittaa merkin (⌥M = µ), Windowsilla avaa
    selaimen valikon.
  - ⌘/Ctrl+Shift+M: Firefoxin responsiivinen tila, Chromen profiilivalikko.
  - ⌘/Ctrl+Shift+S: Firefoxin ja Edgen kuvakaappaus.
  - Ctrl+välilyönti: syöttölähteen vaihto macOS:ssä ja IME Windowsissa.
  - ⌘⌃välilyönti: macOS:n emojivalitsin.
  - F5 / Fn-tuplapainallus: macOS:n oma sanelu, eikä selain saa sitä.
  - Win+H: Windowsin oma puhekirjoitus.
- **Shift+Enter lopettaa sekin sanelun.** Rivinvaihdolla ei ole sanelun
  aikana merkitystä. Alt/Ctrl/⌘+Enter jätettiin ennalleen, eli niitä ei
  otettu Valmiiksi.
- **Lyhyt mikrofonin avausvaihe näytetään kuuntelutilana**, vaikka ääntä
  kerätään vasta `getUserMedia`n jälkeen. Lupakyselyn aikana selaimen oma
  kysely on edessä, ja ilman kyselyä vaihe on lyhyt; *Yhdistetään…*-välähdys
  olisi ollut juuri se odotuksen merkki, josta Jari valitti.
- **Avainta ei esihaeta hoveroinnista tai kentän kohdistuksesta.** Rinnakkain
  haettuna ja puskuroinnin kanssa puhepalvelun viive ei enää näy
  käyttäjälle. Esihaku vaatisi välimuistin ja kuluttaisi daemonin rajaa
  (10/min) avaimilla, joita ei käytetä.
- **Pikanäppäin ei toimi toisessa tekstikentässä eikä dialogin päällä**,
  samalla säännöllä kuin ⌘/Ctrl+P.

## Puhepalvelun osuus, jota ei voi piilottaa

Ensimmäinen teksti näkyy kentässä vasta, kun striimi on auki ja Soniox on
käsitellyt puskuroidun äänen. Mittauksen mukaan se on noin 0,6–1,1 s
painalluksesta (avain ja WebSocket US-alueelle) plus Sonioxin oma
tunnistusviive. Puhe ei katoa, mutta teksti tulee tämän verran jäljessä.
EU-alueen avaimella WebSocket-kättely on Suomesta todennäköisesti nopeampi,
mutta sitä ei mitattu, koska Birchlla on US-alueen avain.
