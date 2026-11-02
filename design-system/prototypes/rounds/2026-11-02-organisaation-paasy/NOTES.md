# Pääsy organisaation kautta – kierros 1

Issue `proto-org-admission`. Yksi näkymä: Asetukset › Käyttäjät ja pääsy
ylläpitäjälle, rakennettu tuotannon palasista (`ServerAccess.css`,
`Settings.css`, `ControlButton`, `Segmented`, `StatusMark`, `InlineNotice`,
`Checkbox`, `LoginCard`). Kaikki henkilöt, ryhmät ja ajat ovat synteettisiä.

## Akseli ja suunnat

Akseli: missä ryhmä (GitHub-tiimi tai -organisaatio) elää pääsysivulla.

1. **Ryhmä listassa**: tiimi on yksi rivi henkilölistan alussa, ja jokaisen
   rivin tiedoissa lukee, tuliko hän tiimin kautta.
2. **Lähteet erikseen**: oma Pääsyn lähteet -kortti tiimille ja
   yksittäisille, ja henkilölista jaettu osiin lähteen mukaan.
3. **Syy riveillä**: ei erillistä tiimiosiota; Salli-kenttä ottaa myös
   organisaation tai tiimin, rivien sirut kertovat pääsyn syyt ja lähtijä
   nousee ilmoitukseksi.

Suositus: **Lähteet erikseen**.

## Sama kaikissa suunnissa

- Lähteminen tekee saman kuin nykyinen Poista pääsy: kirjautuminen estyy,
  avoimet istunnot päättyvät ja agentit pysäytetään. Unix-tili ja tiedostot
  jäävät; tilin voi poistaa komentorivillä. Design siis jäädyttää, ei poista.
- Henkilönä sallittu pitää pääsynsä, vaikka lähtisi ryhmästä. Lähtijän
  rivillä on Salli henkilönä.
- Tiimin jäsenen pääsyä ei poisteta Habitatista; rivillä lukee Tiimin jäsen,
  ja hänet poistetaan tiimistä GitHubissa.
- Yhdistämisdialogi: organisaatio ylläpitäjän omista organisaatioista,
  koko organisaatio tai tiimi, seuraukset, ja jo henkilönä sallitut
  ryhmän jäsenet valinnalla Siirrä heidät tulemaan ryhmän kautta.
- Irrottaminen: tiimin kautta tulleiden pääsy päättyy, tai valinnalla heistä
  tulee henkilöinä sallittuja.
- Kirjautumisnäkymä on tuotannon `LoginCard` ilmoituksen kanssa. Vieras ei saa
  tietää ryhmän nimeä; lähtijälle kerrotaan, minkä tiimin kautta pääsy tuli ja
  että tili ja tiedostot ovat tallessa.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-02-organisaation-paasy/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-02-organisaation-paasy/check.mjs \
  design-system/prototypes/dist/organisaation-paasy/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen suunnan läpi vaaleana, tummana ja 390 px:n
levyisenä, tarkistaa oletusnäkymän sisällön, klikkaa yhdistämisen,
irrottamisen, Salli henkilönä -toiminnon ja molemmat kirjautumisnäkymät,
ottaa kuvat kertoimella 2 ja vaatii konsolin puhtaaksi (44 tarkistuspistettä).
