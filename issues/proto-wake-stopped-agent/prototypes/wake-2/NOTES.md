# Pysähtyneen agentin herätys · kierros 2

Avaa `index.html` selaimessa. Se on yksi offline-tiedosto, joka on rakennettu
prototyyppikirjastosta kuten kierroksella 1, ei tuotantokomponenteista.
Rakennus ja tarkistus tehdään komennolla
`node design-system/prototypes/rounds/2026-10-27-agentin-heratys-2/verify.mjs`
(Playwright `web/node_modules`ista). Kuvat ovat `evidence/`-hakemistossa
laitteen skaalauksella 2.

## Mitä otin kierrokselta 1

- **Kirjoittaminen herättää.** Ensimmäinen kirjoitettu merkki käynnistää Pi:n
  ilman vuoroa (”Agentti käynnistyy…”, sitten ”Agentti on hereillä”).
  Lähetetty viesti aloittaa vuoron heti. Herätä-painiketta ei ole.
- **Selostus näkyy ennen herätystä, ja sen kirjoittaa Habitat.** Siinä
  kerrotaan, milloin ja miksi Pi pysähtyi ja mitä sillä välin valmistui.
  Jokaisella työllä on myös Taskfleetin oma yhteenveto: miksi sivutuksen
  testit epäonnistuivat, mihin CSV-viennin yhdistäminen törmäsi ja mikä
  haara on tallessa. Kierroksella 1 nämä tiedot tulivat vasta herätetyn
  agentin vastauksessa. Nyt ne ovat näkyvissä ennen kuin mitään on
  käynnistetty, ja merkki **Habitat** kertoo, että tekstin on kirjoittanut
  host eikä agentti.
- **Agentin vastaus ei kerro yötä uudestaan.** Koska näit selostuksen jo,
  voit vastata siihen suoraan. Vedoksessa kirjoitetaan ”Korjaa sivutuksen
  testi ja yhdistä CSV-vienti uudelleen”, ja agentti käynnistää heti kaksi
  workeria. Agentti saa saman selostuksen viestisi mukana kuin sinä näit.
- **Avaamisen lähtölaskenta on poistettu.** Kytkin *Herätä, kun valmistuu*
  ei ole mukana. Kysyn siitä erikseen kohdassa ”Mitä katsoa”.

## Sama kaikissa suunnissa

Tilanne on kierroksen 1 Birchn yö. Sivupalkissa on kuu ja luku 4, ja
yläpalkissa lukee ”Lepää”. Sivun yläpalkissa on kaksi tarinan ohjainta:

- **Pysähtyi** vaihtaa syyn. Vaihtoehdot ovat jouten (oletus), Habitatin
  päivitys, kaatuminen ja ”Pysäytit itse”. Selostuksen ensimmäinen lause
  muuttuu syyn mukaan.
- **Hakuindeksi valmistuu** päättää yhä käynnissä olevan workerin, kun
  katsot. Selostus päivittyy, mutta agentti ei herää.

**R** tai ↻ aloittaa suunnan alusta.

## 1 Kortti

Selostus on langan lopussa korttina: syy, päättyneet työt yhteenvetoineen ja
yhä käynnissä oleva työ. Kortin alarivi kertoo herätyksen tilan: ”Kirjoita,
niin agentti herää”, ”Agentti käynnistyy” tai ”Agentti on hereillä. Lähetä,
niin se vastaa.” Kun lähetät, kortti jää lankaan merkinnäksi ”Agentti
lepäsi 20.20–07.21” ja sen alle tulee rivi ”Viestisi herätti agentin”.
Suunta on kierroksen 1 Painike-kortti ilman painiketta.

## 2 Aikajana

Samat tiedot ovat langassa tapahtumina omilla kellonajoillaan:
20.12 kontrastikorjaukset, 20.13 alt-tekstit, 20.20 Pi pysähtyi, 20.31
sivutus epäonnistui ja niin edelleen. Lopussa ”nyt”-rivi kertoo herätyksen
tilan. Aikajana näyttää asian, joka kortista ei näy: kaksi työtä valmistui
jo ennen pysähtymistä, mutta kukaan ei odottanut niitä. Juuri siksi
agentti oli jouten ja pysähtyi.

## 3 Liitteenä

Lanka päättyy normaalisti. Selostus on kentän yllä liitteenä: ”Lähtee
agentille viestisi mukana”, ja jokainen työ on siru. Sirua napauttamalla
näet sen yhteenvedon. Kun lähetät, liite siirtyy viestikuplaasi (”Mukana
Habitatin selostus…”). Suunta tekee näkyväksi sen, mitä nykyään tapahtuu
piilossa: kiinnikuromisviesti kulkee agentille sinun viestisi mukana.

## Mitä katsoa

- Missä selostus luontuu: kortissa langan lopussa (1), tapahtumina
  langassa (2) vai seuraavan viestin liitteenä (3)?
- Riittääkö Taskfleetin yhteenveto, vai tarvitsetko jokaiselle työlle
  ”Avaa”-linkin workerin keskusteluun? Merkit-palkki antaa sen jo nyt.
- Selostus pitää pidempää yötä varten rajata, kun töitä on kymmeniä. Kortti
  ja aikajana kasvavat, ja liitteen sirut rivittyvät.
- Kuuluuko kierroksen 1 kytkin *Herätä, kun valmistuu* mukaan? Se on ainoa
  laukaisin, joka jatkaa kierrosta, kun et ole paikalla.

## Mitä vedos ei näytä

Muita keskusteluja ei voi avata. Herätetyn vuoron jälkeen keskustelu ei jatku
pidemmälle, ja vastaus on sama riippumatta siitä, mitä kirjoitat. Jos
kirjoitat ja pyyhit tekstin, esilämmitetty Pi pysähtyy tyhjäkäyntinä
10 minuutissa. Vedos ei näytä tätä.
