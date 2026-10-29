# Tulos

Avainrivin avausnuoli on nyt rivin alussa, avainmerkin vasemmalla puolella,
kuten natiivissa puunäkymässä: kiinni osoittaa oikealle, auki alas. Kopioi
jää yksin rivin oikeaan reunaan. Vika oli myös asettelussa: nimisarake oli
vähintään 150 px, joten neljän sarakkeen ruudukko oli työpöydällä 7 px
kortin sisäaluetta leveämpi ja nuoli valui kortin reunan päälle. Nimisarake
saa nyt kutistua (`minmax(0, 1fr)`), ja avattu rivi tasautuu yhteiseen
sisennykseen (`--ak-indent`).

`web/tests/account-keys.spec.ts` tarkistaa, että avattu rivi mahtuu
korttiinsa 1280 px leveydellä; vanhalla asettelulla se ylitti 7 px.

## Decisions for later review

- **Nuoli rivin alkuun.** Vaihtoehdot: nuoli Kopioi-painikkeen vasemmalle
  puolelle oikeaan reunaan, tai koko rivi klikattavaksi ilman nuolta.
  Alkuun, koska se on tuttu avattavan rivin merkki eikä kilpaile Kopioin
  kanssa, ja näkyvä painike säilyy näppäimistölle.
