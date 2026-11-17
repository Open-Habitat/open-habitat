# Google: kenen tilit voivat yhdistää – ylläpitäjän ohje, kierros 1

> **Saatesanat.** Tämä on kierroksen työohje: miten sivu rakennetaan ja
> tarkistetaan. Suunnat, suositus ja kysymykset sinulle ovat issuen
> `google-personal-accounts` `result-admin.md`:ssä.

## Mitä sivu näyttää

Taustalla on tuotannon `ServerIntegrations`-lista synteettisillä tiedoilla.
Ohje on kierroksen oma, ja se on rakennettu tuotannon primitiiveistä
(`ControlButton`, `Segmented`, `TextField`, `Badge`, `Icon`) ja tuotannon
ohjeen `.si-*`-säännöistä. Tuotannon Google-rivin *Aseta tunnukset…* ja
*Tunnukset*-valikko avaavat kierroksen ohjeen tuotannon ohjeen sijaan.
Ehdotettu tuotantopaikka vanhan asiakkaan polulle on Google-rivin valikon
uusi kohta, esimerkiksi *Kohdeyleisö…*; prototyyppi ei lisää kohtaa
tuotannon valikkoon.

Valitsimen suunnat (akseli: miten ohje esittää kohdeyleisön valinnan ja sen
seuraukset): **A Kysymys ensin**, **B Yksi sivu** ja **C Vertailu ensin**.
Yläpalkin valinnat ovat yhteisiä: tilanne (uusi asennus / tunnukset jo
asetettu), kohdeyleisö, vaihe, Googlen julkaisutila, teema ja kieli. Kuusi
*Näytä*-painiketta vievät tutkimuksen kuuteen tilaan. Alkutilan valitsevat
myös `?s=existing`, `?a=org|personal`, `?step=<vaihe>`, `?p=production`,
`?lang=en` ja `?theme=dark`.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-17-google-admin-audience/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 900 \
  node design-system/prototypes/rounds/2026-11-17-google-admin-audience/check.mjs \
  design-system/prototypes/dist/google-admin-audience/offline.html <kuvahakemisto>
```

Rakennus kirjoittaa `design-system/prototypes/dist/google-admin-audience/`:aan
`offline.html`:n (fontit upotettuina) ja `index.html`:n (ilman fontteja).
Tarkistus käy kolme suuntaa ja kuusi tilaa 1440 ja 390 px:n leveydellä
vaaleana ja tummana, englannin, A:n koko polun tallennukseen ja kokeiluun
asti, organisaatiopolun, vanhan asiakkaan polut, B:n sisällysluettelon ja
tallennuksen, C:n sarakevalinnan ja yhteenvedon sekä tuotannon rivin, joka
avaa ohjeen. Konsolin virheet ja varoitukset kaatavat tarkistuksen. `--quick`
ajaa vain 1440 px vaalean.

## Mitä host-tietoja näkymä olettaa

Ei uusia. Habitat ei tiedä Googlen kohdeyleisöä, julkaisutilaa, vahvistusta,
käyttäjärajaa eikä Workspace-luottamusta (`GoogleApp` sisältää vain client
id:n ja salaisuuden). Siksi ohje kysyy, mitä Googlessa lukee, eikä näytä
tilaa. Ylläpitäjän valintaa ei tallenneta; se on kysymys Jarille.
Tallennus on synteettinen.
