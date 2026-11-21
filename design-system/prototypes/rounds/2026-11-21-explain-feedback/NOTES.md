# Selitystilan palaute

Jari 21.11.: selitystila valmistuu tavalliseksi ominaisuudeksi, ja siitä
halutaan palautetta. Kierros näyttää, miten ihminen antaa palautteen
selityksestä selitystilassa ollessaan ja mitä hän näkee sen jälkeen.
Toisena näkymänä se näyttää, minne palaute menee ja kuka sen lukee.

Akseli: **missä kohtaa palaute annetaan.**

- **A Kortin alarivi**: jokaisen kortin alla on ”Auttoiko selitys?” ja
  Auttoi / Väärin / Puuttuu jotain. Auttoi tallentuu yhdellä painalluksella.
  Väärin ja Puuttuu jotain avaavat lyhyen huomiokentän, ja kortti pysyy
  paikallaan, kunnes tallennat tai perut. Työpöydällä kortti ottaa siksi
  osoittimen vastaan (tuotannossa `pointer-events: none`).
- **B Palkin Palaute**: selitystilan palkissa on Palaute-painike. Se avaa
  ikkunan, jossa valitaan ensin, mistä äsken nähdystä kortista on kyse
  (viimeisin on valmiiksi valittuna), sitten valinta ja huomio. Kortit
  pysyvät tuotannon kaltaisina.
- **C Lopuksi**: kortit ovat ennallaan. Lopeta-painallus kysyy kerran
  niistä korteista, jotka näit. Merkitset vain ne, joista on sanottavaa, ja
  voit lopettaa kysymättä tai kieltää kysymyksen kokonaan.

Kaikissa suunnissa palaute tallentuu omalle tilille, ja ”Minne tämä
menee?” vie näkymään, jossa ovat omat palautteet, valmiiksi täytetty
GitHub-teksti, joka lähetetään itse, ja vertailu kolmesta mahdollisesta
vastaanottajasta.

Sivu käyttää tuotannon `ExplainMode.css`:ää, `ControlButton`ia ja
`Icon`ia, ja korttien tekstit ovat tuotannon `text/explainMode.ts`:stä
(kortit X05, Y03–Y06, V01, V02, V06). Keskustelu selitystilan alla on
keksitty, ja selityskerros on yksinkertaistettu kopio `ExplainLayer`ista:
siinä ei ole odottavia painalluksia eikä tilakorttia. Palautteet ovat vain
sivun muistissa.

Katselmointipalkki: Tilanne (Palaute auki / Osoittaa korttia / Palaute
annettu), Näkymä (Selitystila / Minne palaute menee), teema ja kieli.
`?s=giving|pointing|done`, `?view=where`, `?theme=dark|contrast` ja
`?lang=en` valitsevat alkutilan.

Issue `explain-mode-feedback`. Suunnat, suositus ja kysymykset ovat issuen
`result.md`:ssä.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-21-explain-feedback/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 900 \
  node design-system/prototypes/rounds/2026-11-21-explain-feedback/check.mjs \
  design-system/prototypes/dist/explain-feedback/offline.html <kuvahakemisto> [--quick]
```

Rakennus kirjoittaa `design-system/prototypes/dist/explain-feedback/`:een
`offline.html`:n (fontit upotettuina) ja `index.html`:n (ilman fontteja).
`check.mjs`:n alku kertoo, mitä se tarkistaa. `--quick` ajaa vain 1440 px:n
Päivä-teeman.
