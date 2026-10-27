# Tulos: GitLab Koodipalveluihin, kierros 1

Kierros: `design-system/prototypes/rounds/2026-10-27-gitlab-yhdistys/`.
[NOTES.md](NOTES.md) on Jarin opas, ja kuvat (2×) ovat hakemistossa
`screenshots/`. Rakennus: `node design-system/prototypes/rounds/2026-10-27-gitlab-yhdistys/build.mjs`
tekee tiedostot `design-system/prototypes/dist/gitlab-yhdistys/offline.html` ja `index.html`.

## Akseli ja suunnat

**Akseli: miten GitLabin sisäkkäinen ryhmäpolku näkyy yhteisessä repolistassa.**
Suunnat eroavat vain tässä. Yhdistämislomake, kortti, virheet ja tuonti ovat
kaikissa samat, koska niiden muoto seuraa jo hyväksytyistä Gitea-päätöksistä.

| Suunta | Mitä se päättää | Hinta |
|---|---|---|
| **Koko polku** | Osio on projektin koko nimiavaruus (`konepaja/verkkokauppa/infra`), ja rivillä on projektin nimi. Ryhmittelyfunktio vaihtuu, mutta listan malli pysyy samana. | Syvästä ryhmästä tulee monta pientä osiota, eivätkä saman asiakkaan projektit ole vierekkäin. |
| **Pääryhmä** | Osio on ylin ryhmä (`konepaja`), ja rivillä on polku sen alla (`verkkokauppa/infra/terraform`). | GitHubin ja Gitean rivillä on edelleen `omistaja/` (tuotannon tapa), mutta GitLabin rivillä polku alkaa osion alta. Iso ryhmä tarvitsee Näytä kaikki -painikkeen. |
| **Ryhmäsuodatin** | Kuten Pääryhmä, ja lisäksi Ryhmä-valinta. Se on puu, joka rakennetaan projektien `namespace.full_path`-kentistä ja jossa näkyvät määrät. Valinta rajaa listan alipuuhun, ja osion otsikkona on valittu ryhmä. | Uusi kontrolli. Gitea-päätöksen mukaan uusi suodatin vaatii oman hyväksyntänsä. |

**Suositus: Pääryhmä.** Osioiden määrä pysyy samassa mittakaavassa kuin
GitHubin organisaatioilla, ja polku on jokaisella rivillä. Haku kattaa jo
ryhmäpolun (`asiakkaat` löytää kolme projektia), joten suodatin auttaa vain
hyvin suurissa ryhmissä. Sen voi lisätä myöhemmin todellisen tarpeen mukaan.
Koko polku on toinen vaihtoehto, jos halutaan pienin muutos: `arrange()`
ryhmittelee nimiavaruuden mukaan, eikä rivi muutu.

## Kaikille yhteinen (ehdotus speksiksi)

- **Koodipalvelut.** GitLab-kortti on Gitea-kortin rakenteella:
  - tunnus `käyttäjä · palvelin` ja painikkeet Tarkista, Vaihda tunnus… ja Irrota…
  - rivi **Git-repot**, jonka tila on *Push toimii*, *Vain luku* tai *Push ei
    tiedossa*
  - rivi **Pääsytunnus**, jossa näkyvät oikeudet ja voimassaolon päättymispäivä.
    Kun päättymiseen on 30 päivää tai vähemmän, rivillä näkyvät *Vanhenee N pv:n
    päästä*, ohje ja Vaihda tunnus… -painike. Vanhentuneesta tunnuksesta näytetään
    *Vanhentunut*, ja tuotujen työtilojen kohdalla kerrotaan, etteivät pull ja
    push toimi.

  `api`-oikeudesta näytetään agenttihuomautus. Väärästä `external_url`-asetuksesta
  näytetään oma huomautuksensa: montako projektia jäi pois ja mikä osoite.
  Jos GitLabia ei ole yhdistetty, sivulla on laatta *GitLab · gitlab.com tai
  yrityksen oma GitLab*. Yhdistämisen jälkeen tarjotaan *Lisää toinen GitLab-palvelin*.
- **Lomake.** Lomake on Gitean hyväksytty lomake, ja virhe näkyy yläreunassa.
  - Osoitteessa on valmiina `https://gitlab.com`. `https://` lisätään, kun
    kentästä poistutaan.
  - Linkki **Luo tunnus GitLabissa** avaa esitäytetyn tunnussivun
    (`/-/user_settings/personal_access_tokens?name=Open+Habitat&scopes=read_api,write_repository`)
    ja seuraa kirjoitettua osoitetta.
  - Mistä saan tunnuksen? -ohje kertoo, mihin oikeuksia tarvitaan, mitä `api`
    tarkoittaa ja että myös ryhmän ja hienojakoinen tunnus kelpaavat.
  - Lomakkeessa on agenttihuomautus.
- **Virheet** näytetään yläreunassa, ja virheellinen kenttä merkitään
  `aria-invalid`-määritteellä:
  - ei GitLab (osoite)
  - palvelin ei vastaa (osoite; mainitaan egress)
  - varmenne ei kelpaa (osoite; tarkistusta ei ohiteta, ylläpitäjä voi lisätä
    CA:n)
  - tunnus hylätty (tunnus)
  - tunnus vanhentunut (tunnus)
  - `read_api` puuttuu (tunnus)
  - palvelimella on jo tili (osoite; glabissa yksi tili palvelinta kohden)

  Puuttuva write-oikeus ei ole virhe. Yhteys syntyy, ja valmisnäkymä kertoo,
  ettei push onnistu.
- **Valmisnäkymä** kertoo projektien määrän, pushin tilan ja voimassaolon
  päättymispäivän. Siinä on painike *Uusi työtila…*.
- **Lista ja tuonti** toimivat kuten yhteisessä listassa:
  - Rivin lähdemerkintä on palvelimen nimi (`gitlab.com`, `gitlab.yritys.fi`).
  - Merkinnät *tyhjä* ja *arkistoitu*.
  - *koko ei tiedossa*, kun GitLab ei kerro kokoa.
  - Tiedoissa näytetään Ryhmä (`konepaja › verkkokauppa › infra`), näkyvyys
    *Sisäinen* (GitLabin `internal`), *Viimeisin toiminta* ja Push.
  - Kohde on `~/src/<projektin nimi>`.
  - Nimiristiriita toisen lähteen työtilan kanssa estää kloonauksen.

  Kloonausvirheet näytetään kiinteinä teksteinä, esimerkiksi SSO-istunnon
  puuttuminen ryhmässä, joka vaatii sen. Vanhentunut lähde näkyy listassa
  virheenä ja linkittää Koodipalveluihin. Kloonaus on silloin estetty, ja syy
  kerrotaan.

## Host-tiedot, joita näkymä olettaa

Tila *on* tarkoittaa, että tieto on jo GitLabin API:ssa tai glabissa ja
selvitys todensi sen. *Ei vielä* tarkoittaa, että toteutus (`gitlab-integration`)
tuottaa tiedon. *Avoin* tarkoittaa, että asia on kokeiltava Jarin tilillä.

| Tieto | Mistä | Tila |
|---|---|---|
| Käyttäjänimi (`user`) | `GET /user` | on |
| Tunnuksen oikeudet ja `expires_at` | `GET /personal_access_tokens/self` | avoin: toimiiko pelkällä `read_api`:lla (selvityksen testi 1). Jos ei toimi, kortti ei voi näyttää päättymispäivää eikä *Vain luku* -tilaa. |
| Pushin valmius kyllä/ei/ei tiedossa | päätellään oikeuksista; hienojakoisen tunnuksen tila on ”ei tiedossa” | ei vielä (päättely toteutuksessa) |
| Vanhentuneen tunnuksen erottaminen hylätystä | 401-vastauksen `error_description` (”Token is expired”) | avoin: varmistettava vastauksen muoto |
| Yksi tili palvelinta kohden | glabin `hosts`-avain | on (glab 1.124, kokeiltu) |
| Projektilista, sisäkkäinen polku ja `namespace.kind` | `GET /projects?membership=true` + keyset | on (dokumentaatio ja julkinen API) |
| `archived`, `empty_repo` | täysi vastaus (ei `simple=true`) | on |
| `visibility` = `internal` | projektivastaus | on |
| Koko (`statistics.repository_size`) | `statistics=true`, vaatii vähintään Reporter-roolin | avoin: kuinka usein puuttuu. Prototyyppi näyttää *koko ei tiedossa*. |
| Viimeisin toiminta | `last_activity_at` (ei pushin aika) | on |
| Pois jätetyt projektit (väärä `external_url`) ja esimerkkiosoite | adapterin oma laskenta | ei vielä |
| SSO-virhe kloonauksessa | Gitin 401/403. SSO:ta ei voi erottaa muista syistä ilman GitLabin viestiä. | avoin (selvityksen testi 3/4). Jos syytä ei voi erottaa, teksti on yleinen: ”tunnus ei kelpaa tai SSO-istunto puuttuu”. |
| Ryhmäpuu suodattimeen (suunta 3) | projekteista, ei `/groups` | on |
| Tuodun työtilan GitLab-lähde Koodipalveluissa | `gitea_origin`-vastine snapshotissa | ei vielä |
| Kohdehakemiston nimi syvästä polusta | viimeinen segmentti | on (sama sääntö kuin nyt). Huomaa törmäysriski: `api` ja `web` ovat yleisiä nimiä. |

Lisäksi prototyypistä puuttuu GitLabin `omistaja/repo`-suorahaku. GitHubin
tarkka nimihaku koskee nyt vain GitHubia, ja GitLabilla haku kattaa vain
listatut projektit.

## Kysymykset Jarille

1. Valitaanko suunnaksi **Pääryhmä**, **Koko polku** vai **Ryhmäsuodatin**?
2. Näytetäänkö vanhenemisvaroitus 30 päivää ennen päättymistä (prototyypin
   raja) vai lähempänä?
3. Näytetäänkö arkistoidut projektit listassa merkittyinä, kuten Gitealla
   (prototyypissä näkyvät), vai jätetäänkö ne pois?
