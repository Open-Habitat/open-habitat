# Verkkosivun etusivu – kolme avointa suuntaa (19.11.2026)

Jari katsoi kiireessä rakennetun etusivun 19.11.: merkin viiden tilan
paneeli otsikon vieressä pois, muiden työkalujen vertailu pois, ja sivu
prototyypataan avoimin mielin. Akseli on siis koko sivu: millä se alkaa ja
miten se on rakennettu. Kulma on README:n: kyvykkäät agentit koko tiimille,
joka ei ole teknistä; yksi ihminen pystyttää palvelimen, muut kirjautuvat
selaimella. Sivut ovat englanniksi, valitsin suomeksi, teema Päivä.

1. **Kuva edellä.** Iso tuotekuva heti otsikon alla, sitten kuvakierros
   (kuusi isoa kuvaa vuorotellen, teksti kuvatekstinä) ja viiden kortin
   galleria. Tavanomaisin ja turvallisin; teksti on README:n.
2. **Perustelu edellä.** Avautuu pelkällä väitteellä ilman kuvaa ("The most
   capable AI tools run on a real computer. Almost nobody gets to use one."),
   ja neljä numeroitua askelta perustelevat tuotteen; kuvat ovat todisteita.
   Askel 3 on agentin puoli ja ihmisen puoli rinnakkain. Asennus on "yksi
   viesti koodausagentillesi".
3. **Tiimin päivä.** Example Studion maanantai aikajanana: perjantaina Sam
   asennuttaa palvelimen agentillaan, maanantaina Alice ja Bob käyttävät sitä
   kellonajoittain, ja jokainen kuva on kohtaus. Rajat ja asennus lopussa
   ("Your team's Monday starts with one server").

Kaikissa: asennus ja agentille annettava linkki, julkaisulinja 0.1
(`v0.1.N`-esijulkaisut), agentti toimii omistajanaan, root on root,
ylläpitäjä tarvitaan, sivu ei lataa mitään muualta. Muita tuotteita ei
nimetä. Merkki on vain logona ja aikajanan solmuina. Ihmiset ovat
kuvakaappausten synteettisiä (Example Studio, Alice, Bob; `people.png`:n
anna, ben, chen) ja keksitty Sam.

Teksti on kirjoitettu `round.js`:ään eikä luettu `Landing.astro`sta, koska
nykyinen sivu on juuri se, josta luovutaan; väitteet ovat README:n ja
`docs/operations.md`:n.

## Rakentaminen ja tarkistus

```
TMPDIR=<oma scratch> node design-system/prototypes/rounds/2026-11-19-verkkosivun-etusivu/build.mjs <out.html>
PROTO_WEB=<web-hakemisto, jossa node_modules> \
  node design-system/prototypes/rounds/2026-11-19-verkkosivun-etusivu/check.mjs <out.html> <kuvahakemisto>
```

`build.mjs` pienentää README:n kuvat WebP:ksi ImageMagickilla (`convert`)
ja upottaa kaiken; tulos on noin 1,4 Mt. `check.mjs` käy jokaisen suunnan
1440 ja 390 px:n leveydellä: valitsin (`picker-check.mjs`), oma kuvausrivi
merkitty, ei vaakavieritystä, ei verkkopyyntöjä, konsoli puhdas, tekstit ja
kuvat eivät mene päällekkäin, ja vaihto seuraavaan suuntaan toimii.
