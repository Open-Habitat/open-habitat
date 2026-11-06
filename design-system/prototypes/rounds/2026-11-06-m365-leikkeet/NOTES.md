# Microsoft 365: aseta tunnukset – kierros 3 (riffit A1:stä)

Issue `proto-m365-setup-flow`. Kierroksella 2 (`../2026-11-06-m365-riffi/`)
Jari valitsi **A1 Valikkopalan**: A:n neljä vaihetta, ja jokaisessa vaiheessa
pala Entran oikeaa sivua. Tällä kierroksella on kolme riffiä A1:stä. Näkymä on
Asetukset › Palvelinintegraatiot ja Microsoft 365:n *Aseta tunnukset…*
rekisteröinnistä tallennukseen, työpöydällä (1440) ja puhelimessa (390),
vaaleana ja tummana. Kaikki on synteettistä, eikä sivulta lähde pyyntöjä.

## Suunnat yhdellä rivillä

- **A1a Vieressä**: ohjeen vieressä leike koko Entran sivusta. Tehtävät kohdat on kehystetty ja numeroitu samoilla numeroilla kuin ohjeen rivit. Tummassa teemassa leike on valkoisella paspiksella.
- **A1b Kaistale**: ohjeen yläpuolella leveä kaistale Entran sivua, ja kohdevalo on yhdessä kohdassa kerrallaan. Rivin silmänappi siirtää valon. Tummassa teemassa kuva on himmennetty.
- **A1c Rivissä**: koko sivua ei näytetä. Jokaisessa ohjeen rivissä on sen napin tai kentän leike Entran omassa koossa, ja koko sivun saa auki pyydettäessä.

## Muutokset, jotka ovat mukana kaikissa kolmessa

- **Palat ovat oikeita leikkeitä Jarin kuvakaappauksista**, eivät enää
  piirroksia: Register an application, App registrations, Overview,
  Authentication (Preview) ja API permissions. `crops.py` leikkaa ne ja maalaa
  läpinäkymättömän harmaan laatikon jokaisen tenant-, client- ja object ID:n
  päälle sekä domainin päälle (*Single tenant only - …* ja *Grant admin
  consent for …*). Laatikot maalataan alkuperäiseen kuvaan ennen
  pienennystä. App registrations -listasta peitetään lisäksi muiden
  sovellusten nimet. Puuhun tallennetaan vain pienennetyt AVIF-leikkeet
  (`crops/`, 28–55 kt, 60 % koosta), alkuperäisiä ei koskaan. `crops.json`
  kirjaa jokaisen leikkeen rajauksen, peitot, kohteet ja sha256:n.
- **Oikeuksien edessä ei ole valintaruutuja.** Jokainen oikeus on yhä oma
  rivinsä ja sillä oma kopiointinappinsa. Rivin alla lukee *9 oikeutta ·
  User.Read on siellä valmiina*.
- Ohjeessa domainin paikalla lukee `<domain>`, koska host ei tiedä sitä.
  Ensimmäinen vaihe kertoo, että se on organisaation domain ja että kuvissa
  se on peitetty.
- Kierroksen 2 ohjeteksti on muuten ennallaan: ainoa linkki on ensimmäisessä
  vaiheessa (*Avaa App registrations*), myöhemmät vaiheet nimeävät
  sovelluksen vasemman valikon kohdan, ja Entran järjestys on redirect ensin
  ja *Settings* sen jälkeen. Rivit, joihin kuvassa on kohta, on nyt
  nimetty Entran sanoin: *Authentication (Preview)*, *Add Redirect URI*,
  *Settings*, *API permissions*, *Add a permission*, *Grant admin consent
  for*, *Overview* ja kaksi tunnusriviä.

## Mitä kukin riffi päättää

- **A1a Vieressä**: Dialogi on leveämpi (1160 px), jotta leikesarake (470
  px) on luettava. Vaihe näyttää kaikki ne leikkeet, joihin sen rivit
  viittaavat. Rekisteröinnissä niitä on kaksi (lista ja lomake) ja
  viimeisessä vaiheessa kaksi (API permissions ja Overview). Kehys on
  pehmeä korostepinta ja täysi 2 px:n viiva, ja numero on kehyksen oikeassa
  yläkulmassa, jotta se ei peitä Entran tekstiä. Puhelimessa leikkeet ovat
  ohjeen yläpuolella.
- **A1b Kaistale**: Kaistale on dialogin levyinen ja leikattu niin, että
  teksti näkyy suunnilleen Entran omassa koossa. Kohdevalo on aukko
  harmaassa verhossa. Ensimmäinen kohta on valaistuna valmiiksi; rivin
  silmänappi ja kaistaleen nuolet vaihtavat kohtaa, ja valaistu rivi saa
  saman korostepinnan. Puhelimessa kaistale rajataan kohteen ympäriltä
  kapeammaksi, jotta teksti ei kutistu.
- **A1c Rivissä**: Rivissä on vain se nappi tai kenttä, jota rivi
  tarkoittaa, puolikkaana kuvakaappauksen pikseleistä eli samankokoisena
  kuin Entrassa. Ylläpitäjä tunnistaa siis napin näöltä, ilman että hänen
  pitää etsiä sitä koko sivun kuvasta. *Näytä koko sivu (n kuvaa)* avaa
  vaiheen sivuleikkeet, joissa kohdat on kehystetty rivien järjestyksessä.

## Tumma teema ja vaalea kuvakaappaus

Entra on kuvissa vaalea, ja kukin riffi kehystää sen eri tavalla:

- A1a: valkoinen 6 px:n paspis ja ohut viiva sen ulkopuolella. Kuva näyttää
  tulosteelta, eikä sen reuna osu suoraan tummaan pintaan.
- A1b: kuvaa on himmennetty (`brightness(0.82)`), ja verho on tummempi.
- A1c: leikkeet ovat pieniä, joten niiden kehykseksi riittää vahvempi viiva.

## Yläpalkki

*Taso* (Täysi pääsy, Luonnokset, Vain luku) vaihtaa sovelluksen nimen ja
oikeudet ja aloittaa alusta. Palkissa ovat myös *Teema* ja *Alusta*, ja
alhaalla oleva valitsin vaihtaa riffiä. *Minulla on jo sovellus* vie kaikissa
riffeissä listan hakukentän kautta tunnuksiin.

## Leikkeiden tekeminen uudelleen

```
uv venv "$TMPDIR/venv" && uv pip install -p "$TMPDIR/venv" pillow
"$TMPDIR/venv/bin/python" design-system/prototypes/rounds/2026-11-06-m365-leikkeet/crops.py
```

Skripti lukee alkuperäiset kuvat hakemistosta
`~/.local/state/oh-conductor/m365-shots/`. Peitot ja kohteet ovat sen
alussa, alkuperäisen kuvan pikseleinä.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-06-m365-leikkeet/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-m365-leikkeet/check.mjs \
  design-system/prototypes/dist/m365-leikkeet/m365.html <kuvahakemisto>
```

`check.mjs` tarkistaa ensin leikkeet. Jokainen `crops/`-tiedosto on oltava
kirjattuna `crops.json`iin samalla sha256:lla. Yhdelläkään ei saa olla
alkuperäisen kuvan kokoa, PNG-tiedostoja ei saa olla, ja selaimessa
purettuna jokaisen peiton sisällä on vain peittoväriä. Paljas tunnus tai
alkuperäinen kuva leikkeen tilalla kaataa tarkistuksen. Sen jälkeen se käy
jokaisen riffin läpi tallennukseen asti 1440 ja 390 px vaaleana ja tummana
(kerroin 2) ja tarkistaa seuraavat asiat: valikkopolku on leipätekstin
kokoinen ja täyttä mustetta, linkki on vain ensimmäisessä vaiheessa,
oikeuksilla ei ole valintaruutuja ja jokainen kopioi yhden nimen, ja jokainen
kehys on kuvansa päällä. Riffikohtaisesti se tarkistaa, että A1a:n
rivinumerot vastaavat kuvan numeroita eikä leike ole tekstin päällä, että
A1b:n silmänapit valaisevat kukin oman kohtansa ja että A1c:ssä on yksi
leike jokaista kohteellista riviä kohden ja koko sivu aukeaa kaikkine
kehyksineen. Vain luku -tasolla rivejä on 8 ja *Microsoft Graph (9)*.
Tarkistuspisteitä on 991, ja konsoli pysyy puhtaana.
