# Kierros: GitLab Koodipalveluihin

Tällä kierroksella GitLab yhdistetään Asetukset › Koodipalvelut -sivulla
(gitlab.com tai yrityksen oma GitLab), ja sen projektit tuodaan työtiloiksi
Uusi työtila -sivun yhteisestä listasta. Pohjana ovat jo hyväksytyt
Gitea-ratkaisut: yhdistämislomake, jonka virhe näkyy yläreunassa, sekä
yhteinen lista nykyisessä valintanäkymässä. Prototyyppi käyttää tuotannon
komponentteja ja tyylejä (`GiteaCard`, `ControlButton`, `Segmented`,
`ClonePage.css`, `Integrations.css`), joten se näyttää samalta kuin sovellus.
GitLabin omat osat on tehty kierroksen sisällä samalla kaavalla.

## Mitä valitset

Valitsimen kolme suuntaa eroavat yhdessä asiassa: **miten GitLabin
sisäkkäinen ryhmäpolku näkyy yhteisessä listassa**. Esimerkkinä on
`konepaja/verkkokauppa/infra/terraform`. Yhdistäminen, Koodipalvelut-kortti,
virheet ja tuonti ovat kaikissa suunnissa samat.

1. **Koko polku.** Jokainen ryhmä ja aliryhmä on oma osionsa, esimerkiksi
   `konepaja/verkkokauppa/infra`, ja rivillä on vain projektin nimi. Tämä on
   pienin muutos nykyiseen listaan, jossa osio on omistaja. Syvästä
   ryhmäpuusta tulee kuitenkin pitkä jono pieniä osioita, ja saman
   asiakkaan projektit hajoavat moneen kohtaan.
2. **Pääryhmä.** Osio on ylin ryhmä, esimerkiksi `konepaja`, ja rivillä näkyy
   polku sen alla: `verkkokauppa/infra/terraform`. Osioita on yhtä vähän
   kuin GitHubin organisaatioita, ja polku on luettavissa joka riviltä.
   Isossa ryhmässä tarvitaan Näytä kaikki -painiketta, kuten nykyisessäkin
   listassa.
3. **Ryhmäsuodatin.** Kuten Pääryhmä, ja lisäksi Ryhmä-valinta, joka
   rakennetaan projektien poluista (erillistä ryhmähakua GitLabista ei
   tehdä). Kun valitset esimerkiksi `verkkokauppa (4)`, lista näyttää vain
   sen alipuun. Tämä on uusi kontrolli, jonka Gitea-päätöksen mukaan pitää
   hyväksyä erikseen.

**Suositukseni on Pääryhmä.** Se pitää listan muodon samana kuin GitHubilla
ja Gitealla. Lisäksi haku löytää jo nyt ryhmän nimellä (kokeile `asiakkaat`),
joten suodatin toisi lisää vain hyvin suurissa ryhmissä. Suodattimen voi
lisätä myöhemmin, jos joku todella hukkuu listaan.

## Näin kokeilet

Prototyypin yläpalkissa on kolme kokeiluvalintaa:

- **Esimerkkihenkilö** määrää lähtötilanteen:
  - *Ei GitLabia*: GitHub ja oma Gitea ovat jo yhdistettyinä.
  - *gitlab.com*: GitLab on yhdistetty.
  - *Myös oma GitLab*: lisänä on `gitlab.yritys.fi`, jonka tunnus vanhenee
    9 päivän päästä ja jonka `external_url` on väärin.
  - *Tunnus vanhentunut*: gitlab.comin tunnus on vanhentunut.
- **Koetilanne** määrää, mitä GitLab vastaa, kun painat Yhdistä tili.
  Vaihtoehtoina ovat onnistuminen eri oikeuksilla ja jokainen virhe.
- **Teema** ja **390 px** vaihtavat teeman ja puhelinleveyden.

Kokeile ainakin näitä:

1. *Ei GitLabia* → Koodipalvelut → GitLab **Yhdistä…**. Osoitteessa on
   valmiina `https://gitlab.com`. **Luo tunnus GitLabissa** avaa GitLabin
   tunnussivun valmiiksi täytettynä (nimi Open Habitat, oikeudet `read_api` ja
   `write_repository`), joten sinun tarvitsee valita vain vanhenemispäivä.
   Kirjoita osoitteeksi oma palvelin ilman `https://`-alkua. Alku lisätään,
   kun poistut kentästä, ja linkki vaihtuu osoittamaan sinne.
2. Vaihda Koetilanne ja paina Yhdistä tili. Virhe ilmestyy otsikon alle, ja
   täyttämäsi kentät säilyvät.
3. *Onnistuu: vain read_api* yhdistää tilin, mutta valmisnäkymä kertoo, ettei
   push onnistu. Kortissa lukee **Vain luku**. *api-oikeus* toimii, mutta
   näkymä kertoo, mitä se antaa agenteille. *Hienojakoinen tunnus* antaa
   pushin tilaksi **ei tiedossa**.
4. *Myös oma GitLab*: kortissa näkyvät vanhenemispäivä,
   vanhenemisvaroitus ja Vaihda tunnus… -painike sekä external_url-huomautus.
5. Uusi työtila: vaihda suuntaa valitsimesta ja vertaa listoja. Valitse
   `terraform` ja kloonaa se. Kloonaa sitten `pankki-oy/digi/mobiilisovellus`:
   se epäonnistuu, koska pankki-oy vaatii SSO-istunnon. `aino.virtanen/notes`
   näyttää nimiristiriidan: `~/src/notes` on jo GitHubin työtila.
6. *Tunnus vanhentunut*: lista kertoo, miksi gitlab.comin projekteja ei
   näy, ja Koodipalvelut kertoo, mitkä työtilat eivät synkronoi.

Näppäimet **1–3** ja nuolet vaihtavat suuntaa. Kaikki tieto on keksittyä,
eikä prototyyppi ota yhteyttä GitLabiin.

## Kuvat

`screenshots/` sisältää kuvat tarkkuudella 2×. Tiedostonimi kertoo näkymän,
leveyden (desktop tai phone) ja teeman (light tai dark):

- `1`: Koodipalvelut ennen GitLabia
- `2`: varmennevirhe lomakkeen yläreunassa
- `3`: vain lukuoikeus
- `4`: vanheneva tunnus ja väärä external_url
- `5`: vanhentunut tunnus
- `6-lista-1…3`: suunnat 1–3
- `7`: sisäkkäisen projektin tiedot
- `9`: SSO-virhe kloonauksessa

## Toistaminen

```
cd web && npm ci        # kertakäyttöinen node_modules
node design-system/prototypes/rounds/2026-10-27-gitlab-yhdistys/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node \
  design-system/prototypes/rounds/2026-10-27-gitlab-yhdistys/check.mjs \
  design-system/prototypes/dist/gitlab-yhdistys/offline.html <kuvahakemisto>
```

`offline.html` sisältää oikeat fontit. `index.html` on Glasspadia varten, ja
siinä käytetään järjestelmäfontteja. Tarkistus käy läpi kaikki kolme suuntaa
vaaleana ja tummana sekä työpöytä- ja puhelinleveydellä (56 tarkistuspistettä,
konsoli puhdas, `screenshots/checks.json`).
