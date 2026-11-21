# Selitystilan palaute, kierros 2

Jari 21.11.: kortin alarivi (kierros 1, A) on luultavasti oikea, mutta se
pitää kokeilla oikeasti, koska selityskortti on hover. Tämä kierros toimii
hiirellä kuten tuotannon selitystila ja näyttää, miten kortti saadaan
pysymään paikallaan, jotta sen alariville ehtii.

Akseli: **miten kortti pysyy paikallaan palautetta varten.**

- **A Kulkureitti**: alarivi näkyy jokaisessa kortissa. Kortti ottaa
  osoittimen vastaan vain, kun osoitin tulee sen omasta kohdasta: kohdan ja
  kortin välinen kaista (kohdan reunasta kortin reunaan) pitää kortin, vaikka
  kaistalla olisi muita kohtia. Muualta kortin päälle tultaessa se päästää
  osoittimen läpi kuten tuotannossa, ja naapurikohta vaihtaa kortin heti.
- **B Nasta**: kortti on tuotannon (`pointer-events: none`). Sen kohtaa
  kohti olevalla reunalla, osoittimen kohdalla, on pieni nasta, joka ulottuu
  kortin ja kohdan väliin. Nastan painallus pysäyttää kortin, ja vasta silloin
  alarivi tulee näkyviin. Puhelimella nastan paikalla on Anna palautetta.
- **C Asettuminen**: kun osoitin on ollut kohdan päällä 0,6 s paikallaan,
  kortti asettuu: ohut viiva täyttyy, valinnat ilmestyvät, ja kortti ottaa
  osoittimen. Asettunut kortti vaihtuu vain, kun osoitin pysähtyy toisen
  kohdan päälle 0,25 s:ksi, joten ohi kulkeminen ei vie sitä. Puhelimella
  valinnat näkyvät heti.

Kaikissa: Väärin tai Puuttuu jotain avaa huomion, siirtää kohdistuksen
siihen ja pitää kortin, kunnes tallennat tai perut. Klikkaus muualle
kirjoitetun huomion aikana ei hukkaa tekstiä, vaan kortti nytkähtää ja
pyytää tallentamaan tai perumaan. Tyhjä huomio sulkeutuu klikkauksella.
Ensimmäinen Esc peruu palautteen, toinen lopettaa tilan. Näppäimistöllä
kohdistettu kohta selittää itsensä, ja F siirtää kohdistuksen kortin
alariville. Tallennuksen jälkeen kortissa on "Kiitos · Lähetä kehittäjille
›", joka avaa lähetyksen yhdellä askeleella: valmiin GitHub-issuen koko
teksti, avattava osoite, julkisuus, rivi "Ei GitHub-tiliä?" ja Avaa
GitHubissa. Palkin Omat palautteet · n vie listaan, jossa samat toiminnot.

Pointing on uskollinen kopio tuotannon `ExplainLayer`ista
(`web/src/components/ExplainMode.tsx`): liikkeet kuvaruuduittain,
`hit()` `elementsFromPoint`illa, pienin näkyvä kohta, kortti kohdan alla
osoittimen kohdalla (yläpuolella, jos tila loppuu), viipyminen tyhjän päällä,
odottavat painallukset, kosketuksen ensimmäinen napautus selittää, Esc
lopettaa. CSS on tuotannon `ExplainMode.css`, kortin tekstit, tyypit ja
näppäimet tuotannon `text/explainMode.ts`:stä ja `explainParts.ts`:stä.
Erot: kohdat löytyvät synteettisen näkymän `data-card`-attribuutista,
`contentBox()` puuttuu, tilakorttia ei ole, ja kohdistettu kohta selittää
itsensä (tuotannossa korttiin ei pääse näppäimistöllä). Yläpuolelle
sijoitettu kortti riippuu alareunastaan, jotta avautuva huomio kasvaa ylös
eikä ruudun ulkopuolelle. Palautteet ovat vain sivun muistissa.

Katselmointipalkki: Näkymä (Selitystila / Omat palautteesi), Alku (Kortti /
Huomio auki / Tallennettu), teema ja kieli. `?s=card|note|thanks`,
`?view=mine`, `?theme=dark|contrast`, `?lang=en` ja `?v=1..3` valitsevat
alkutilan.

Issue `explain-mode-feedback`; suunnat, suositus ja kysymykset ovat sen
`result-2.md`:ssä.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-21-explain-feedback-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 900 \
  node design-system/prototypes/rounds/2026-11-21-explain-feedback-2/check.mjs \
  design-system/prototypes/dist/explain-feedback-2/offline.html <kuvahakemisto> [--quick]
```

Rakennus kirjoittaa `design-system/prototypes/dist/explain-feedback-2/`:een
`offline.html`:n (fontit upotettuina) ja `index.html`:n (ilman fontteja).
`check.mjs`:n alku kertoo, mitä se tarkistaa; sen hiiripolut kulkevat
suoraviivaisesti kohdasta alarivin valintaan ja lukevat kortin joka
askeleella. `--quick` ajaa vain 1440 px:n Päivä-teeman.
