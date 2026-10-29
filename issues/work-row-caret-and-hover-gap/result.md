# Tulos

**Nuoli.** *Näytä työ* -painikkeen ja valmiin vuoron yhteenvetorivin nuoli
ei enää käänny. Auki ollessaan se oikenee pystyviivaksi. Ennen *Näytä työ*
käänsi nuolta 90° oikeaan alakulmaan, joten se osoitti vinosti alas
vasemmalle. Valmiin vuoron rivi taas osoitti alas. Nyt molemmat näyttävät
saman suuntaa vailla olevan merkin. Nuolen kaksi vartta piirretään
erikseen, joten muutos on lyhyt liuku (ilman liikettä, jos
`prefers-reduced-motion` on päällä).

**Väli.** Yhteenvetorivillä on nyt sama 3 px:n väli (`--ah-turn-gap`)
ihmisen omaan viestiin kuin agentin vastaukseen, sekä rivin ylä- että
alapuolella. Ennen väli oli 2 px oman viestin alla ja 8 px oman viestin
yläpuolella, kun vuoro päättyi yhteenvetoriviin (esim. ohjausviestin
kohdalla).

Kuva: `evidence/show-work-open-before-after.avif` (DSF 2, *Näytä työ*
auki, ylempi ennen ja alempi jälkeen). Selaintesti
`web/tests/turn-work-row.spec.ts` mittaa välit rivin ylä- ja alapuolelta
neljässä paikassa (välivastauksen alla, avatun työn yllä, oman viestin
yllä ja alla) ja vertaa niitä vuoron omaan väliin.

## Decisions for later review

- **Merkki on pystyviiva** (Jarin ehdotus). Vaihtoehto oli vaakaviiva
  (miinus). Pystyviiva syntyy, kun nuolen kärki oikenee, joten liike
  näyttää luontevalta. Vaakaviiva olisi tuttu "sulje"-merkki, mutta
  tekstin perässä se näyttäisi ajatusviivalta.
- **Muutos koskee vain vuoron työrivejä.** Sivupalkin, tiedostopuun ja
  muiden avattavien osien nuolet kääntyvät yhä alas, koska niiden sisältö
  avautuu aina alapuolelle.
