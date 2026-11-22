# Palvelinselaimen paikka · 22.11.2026

Akseli: **mikä ovi palvelinselaimella on ja mihin kukin ovi on tarkoitettu.**
Nykyään selain on sekä sivupalkin ylimpänä rivinä että sirussa kentän yllä
jokaisessa keskustelussa, ja molemmat näyttävät saman koko selaimen.

1. **Siru:** selain asuu kentän yllä jokaisessa keskustelussa, kuten nyt.
   Sivupalkkiin tulee rivi vain, kun ikkuna odottaa sinua, ja rivi kertoo,
   mikä keskustelu pyytää.
2. **Rivi** (suositus): sivupalkin Oma selain on selaimen ainoa ovi.
   Keskustelu, jonka agentti käyttää selainta, näyttää työn omassa
   kulussaan agentin komentojen alla: sen ikkunat, pyynnön ja Ota ohjaus ja
   hoida. Muissa keskusteluissa selainta ei näy.
3. **Kaksi:** sivupalkissa koko selain; siru vain keskustelussa, jonka
   agentti käyttää selainta, ja siinä vain sen ikkunat.

Maailma on sama kaikissa: Aino pyysi keskustelussa *Sähkölaskut 2026*
agenttia hakemaan laskut `energia.example`-palvelusta. Agentti avasi kaksi
välilehteä, joista kirjautumisen vahvistus odottaa Ainoa. Kolmas ikkuna
(`kirjasto.example`) on Ainon oma. Keskustelu *Kevätkokouksen esitys* ei
käytä selainta. Tilanteet: ikkuna odottaa sinua (alkutila), agentti
selaimessa, sinä ohjaat, selain auki ilman agenttia ja selain ei käynnissä.
Keskustelua vaihdetaan sivupalkista tai yläpalkista. Ota ohjaus ja hoida →
Anna takaisin agentille vie tarinan eteenpäin: agentti jatkaa yhdessä
ikkunassa.

Siru, nauha, sivupalkin rivi ja katselunäkymä ovat tuotannon komponentteja
(`web/src/components/ServerBrowser.tsx`), ja ne saavat synteettisen
`BrowserStatus`-tilan. Kierroksen omia osia ovat suunnan 1 huomiorivi,
suunnan 2 kehys aikajanassa, suunnan 3 rajausrivi, ikkunoiden piirretyt
kuvat ja katselunäkymän välilehtikehys noVNC:n tilalla. Keskustelun
ikkunat luetaan keskustelun omista komennoista (`agent browser goto`
palauttaa välilehden ja `agent browser request --window` nimeää ikkunan).
Hostin tila ei kerro keskustelua.

## Rakentaminen ja tarkistus

Riippuvuudet asennetaan lukkotiedoston mukaan komennolla `npm ci --prefix web`.
Komennot ajetaan repositorion juuresta:

```sh
round=design-system/prototypes/rounds/2026-11-22-server-browser-entry-points
out=/var/tmp/agent-keep/server-browser-entry-points
node "$round/build.mjs" "$out"
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 580 \
  node "$round/check.mjs" "$out/offline.html" "$out/check"
```

`offline.html` sisältää fontit, ja `index.html` on sama sivu ilman niitä
sandbox-katselua varten. Kumpaakaan ei commitoida. Tarkistus käy läpi 24
yhdistelmää: 3 suuntaa × 1440/390 px × Päivä/Yö/Kontrasti suomeksi sekä
Päivä englanniksi. Jokaisessa tarkistetaan oletusnäkymä ja toinen
keskustelu. Kulut ajetaan Päivässä ja Yössä sekä englanniksi: ohjaus
pyynnön hoitamiseksi, palautus, Escape, pysähtyneen selaimen avaus suunnan
omasta ovesta ja valmis keskustelu. Lisäksi tarkistetaan
`picker-check.mjs`, vaakaylivuoto, ulkoisten pyyntöjen puuttuminen ja konsoli.
Viimeisin ajo: 531 tarkistusta läpi.
