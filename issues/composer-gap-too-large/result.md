# Tulos

Viimeisen viestin ja kirjoituskentän välissä oli kaksi ylimääräistä
väliä:

- Keskustelulistan (`ol.ah-feed`) selaimen oletusmarginaali, noin 14 px
  ylä- ja alapuolella.
- Agentin työn aikana tyhjä listarivi (hyväksytyn lähetyksen kuittaus, joka
  ei piirrä mitään), joka lisäsi vielä yhden 8 px:n listavälin.

Nyt viestin alla on vain keskustelualueen oma reunus (22 px työpöydällä).
Sen alla on tausta-ajonauha ja sitten kenttä. Työn aikana väli lyheni
44 px:stä 22 px:iin ja valmiissa keskustelussa 36 px:stä 22 px:iin.

Kuvat (DSF 2, ylempi ennen, alempi jälkeen): työn aikana
`evidence/working-before-after.avif` ja valmiina
`evidence/settled-before-after.avif`.

`web/tests/thread-fill.spec.ts` tarkistaa nyt, että viimeisen viestin alla
on vain keskustelualueen reunus, sekä valmiissa keskustelussa että työn
aikana. Vanhalla CSS:llä testi kaatuu 22 px:n ylimäärään. Kahdessa
testissä (`thread-fill`, `lab-conversation-scroll`) viimeinen rivi on nyt
viimeinen *piirretty* rivi, koska tyhjä rivi ei enää vie tilaa.

## Decisions for later review

- **Keskustelualueen 22 px:n alareunus jäi ennalleen.** Se on sama
  suunnittelumitta kuin yläreunus (`--ah-column-pad-block`). Poistin vain
  tahattomat välit. Jos väli tuntuu vieläkin suurelta, seuraava askel on
  pienentää alareunusta silloin, kun tausta-ajonauha on näkyvissä.
- **Myös listan ylämarginaali poistui** (`margin-block: 0`). Se näkyy vain
  pitkän keskustelun alussa, 14 px ylempänä.
