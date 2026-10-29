# Tulos

Suljetun työvaiheen yhteenvetorivin korostus loppuu nyt samaan oikeaan
reunaan kuin työkalukortit ja vastaus. Rivi alkaa 7 px sarakkeen
vasemmalla puolella, jotta nuoli osuu sisällön reunaan, mutta leveys oli
rajattu sarakkeen levyiseksi, joten oikea reuna jäi 7 px vajaaksi.
Korjaus on tiedostossa `web/src/components/components.css`
(`.ah-turn-stage > button`).

Kuva: `evidence/hover-before-after.avif` (DSF 2, ylempi on ennen ja
alempi jälkeen). Selaintesti `web/tests/turn-work-row.spec.ts` vertaa
rivin oikeaa reunaa vastauksen oikeaan reunaan.
