# Selain kolmessa paikassa · 22.11.2026

Issue `server-browser-entry-points`, kierros 3. Pohjana on kierroksen 2
suunta 2 Rivi: selain asuu sivupalkissa, eikä toisen keskustelun pyyntö
näy jokaisen kentän yllä. Jari: keskustelussa näkyvä osa on aivan liian
iso. Tällä kierroksella selaimen pyyntö ja agentin selaintyö näkyvät
siististi kolmessa paikassa, jotka kaikki näkyvät sivun oletusnäkymässä:

1. **Sivupalkin Oma selain.** Tavallinen rivi kuten Tuotokset, ei kortti.
   Sillä on oma ikkunakuvake, kun taas Tuotokset pitää maapallon
   (`rail-icons-tuotokset-oma-selain`). Rivin lopussa on lyhyt tila: *1
   ikkuna* / *agentti · 2 ikkunaa* / pilleri *odottaa sinua* / *sinä
   ohjaat* / *ei auki*.
2. **Keskustelun oma rivi sivupalkissa.** Rivin lopussa on selainmerkki
   ajan tilalla. Kun agentti työskentelee, merkki on hiljainen
   ikkunakuvake. Kun keskustelu odottaa sinua selaimessa, merkki on
   rajattu ikkunakuvake ja sana *selain*, ja se erottaa rivin
   tavallisesta Sinun vuorosi -rivistä. Kun ohjaat itse, merkki on henkilökuvake ja sana *ohjaat*. Valmiista
   keskustelusta merkki poistuu.
3. **Keskustelussa** on akseli: koko ja muoto. Kaikki kolme päättyvät
   hyväksyttyyn käyntikorttiin (`browser-visit-record`, 2 Kortti), joten
   ne ovat samaa perhettä.

Paikat 1 ja 2 ovat samat kaikissa suunnissa, jotta vertailu pysyy yhdellä
akselilla. Osat ovat siirrettäviä: kukin on yksi komponentti, joka saa
saman tilan. Sivupalkin rakenteesta päätetään erikseen
(`rail-space-small-screens`, `ui-structure-free-round`).

| Suunta | Työssä | Odottaa sinua | Sinä ohjaat | Valmis | Korkeus 1440 / 390 px (odottaa) |
| --- | --- | --- | --- | --- | --- |
| 1 Rivi | rivi: *Agentti selaimessasi · energia.example · 1 sivu* + Katso | rivi: *Odottaa sinua selaimessa: …* + Hoida, Katso ensin | rivi + Avaa, Anna takaisin | Selain-kortti | 28 / 72 |
| 2 Kortti (suositus) | kortti *Selain nyt* + Katso | sama kortti, korostettu reuna, pyyntö otsikossa + Ota ohjaus ja hoida, Katso ensin | sama kortti + Avaa, Anna takaisin | sama kortti on käynnin merkintä | 56 / 90 |
| 3 Ikkuna | kortti, jossa 96 px kuva agentin ikkunasta | kuva odottavasta ikkunasta | kuva yhtenäisellä reunalla | Selain-kortti ilman kuvaa | 76 / 96 |

Kierroksen 2 suunnan 2 kehys aikajanassa oli yli 300 px.

Kortin voi avata kaikissa tiloissa, jolloin näkyy käynnin luettelo
(sivut sivustoittain, lataukset, painallukset). Valmiissa merkinnässä on
lisäksi rivi *Sinä selaimessa: ohjasit 9.16–9.18 agentin pyynnöstä*.
Katselunäkymä noudattaa ohjauskierroksen suuntaa 1 Kehys: katkoviiva
tarkoittaa, että agentti ohjaa, ja yhtenäinen reuna, että sinä ohjaat.
Vuoro ja Valmis ovat reunan kielekkeessä.

## Kokeile

Tilavalitsimesta (Ei auki → Lepo → Agentti työssä → Odottaa sinua → Sinä
ohjaat → Valmis) tai **Seuraava →**, joka kulkee tarinan mukaan.
Anna takaisin vie tilaan, jossa agentti jatkaa, ja sieltä Valmiiseen.
Paina keskustelun **Ota ohjaus ja hoida**, sitten katselunäkymän
**Valmis**. *Monta ikkunaa* lisää kaksi omaa ikkunaa. Puhelimessa
sivupalkin avaa **Sivupalkki** tai valikkopainike, jossa on merkki.
Osoitevalinnat: `?state=working|ask|…&theme=dark&lang=en&many=1`.

## Rajaus

Tuotannon komponentteja ovat sovelluskehys, sivupalkki ja sen rivit
(`AgentNavItem` `NowSections`in kautta), vuoro (`AgentTurn`,
`PiToolUse`, `BashToolCard`), Muutokset (`TurnChanges`) ja kenttä.
Kierroksen omia ovat kolmen paikan osat, ikkunakuvake (ehdotus
`Icon.tsx`:n nimeksi `browser`), Kehys-katselunäkymä noVNC:n tilalla ja
piirretyt sivut. Keskustelurivin merkki lisätään tuotannon rivin DOMiin
(`.ah-nav-link`), ja se korvaa rivin ajan. Toteutuksessa se olisi
`AgentNavItem`in prop. Keskustelun selainikkunat luetaan keskustelun omista
komennoista kuten kierroksessa 2. Hostin tila ei kerro keskustelua.
Kokonaan synteettinen.

## Rakentaminen ja tarkistus

Riippuvuudet asennetaan komennolla `npm ci --prefix web`. Komennot ajetaan
repositorion juuresta. Linuxissa ne ajetaan scratch-leasen alla,
yksityisellä TMPDIR:llä ja `umask 077`:llä.

```sh
round=design-system/prototypes/rounds/2026-11-22-server-browser-places
out=/var/tmp/agent-keep/server-browser-entry-points/round-3
node "$round/build.mjs" "$out"
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 580 \
  node "$round/check.mjs" "$out/offline.html" "$out/check"
```

`offline.html` sisältää fontit, ja `index.html` on sama sivu ilman niitä.
Kumpaakaan ei commitoida. Tarkistuksessa on 24 yhdistelmää: 3 suuntaa ×
1440/390 px × Päivä/Yö/Kontrasti suomeksi sekä Päivä englanniksi.
Jokaisessa tarkistetaan valitsin, oletusnäkymän kolme paikkaa
(pyyntö näkyy kaikissa), sivupalkin korjaus (eri kuvake, sama reuna ja
korkeus kuin Tuotokset-rivillä) ja toinen keskustelu, jossa selainta ei
näy. Kontrasti-fi-yhdistelmiä lukuun ottamatta ajetaan lisäksi kaikki
kuusi tilaa kolmessa paikassa, kulku Ota ohjaus → Valmis → Escape →
Valmis, palautus keskustelusta, katselu, joka ei ota ohjausta,
sammuneen selaimen avaus sivupalkista, avattu merkintä ja monta
ikkunaa. Työpöydällä tarkistetaan myös järjestys rivi < kortti < ikkuna
ja että osa on enintään 90 px korkea. Korkeudet tallentuvat tiedostoon
`sizes.json`. Lopuksi tarkistetaan, ettei ole vaakaylivuotoa eikä
ulkoisia pyyntöjä ja että konsoli on puhdas. Viimeisin ajo: 1255
tarkistusta läpi.
