# HTML-näkymät · Kierros 1

Keskustelussa Pi tarjoaa kahta HTML-raporttia ja käynnissä olevaa
prototyyppiä. Näkymää ei avata ilman painallusta. Tässä vertaillaan
**raportin paikkaa**, ei jakamista, käyttöoikeuksia tai palvelinratkaisua.
Kaikki nimet, polut ja luvut ovat keksittyjä.

## Kolme suuntaa

| Suunta | Akseli ja vahvuus | Hinta |
| --- | --- | --- |
| Editorin tapaan | Raportti vasemmalla, keskustelu oikealla. Sivupalkki väistyy. Vastaa nykyisen editorin tilankäyttöä; keskustelun voi taittaa kaistaleeksi. Puhelimessa raportti on yllä ja keskustelu alla. | Keskustelu siirtyy oikealle. Puhelimessa kaksi matalaa vieritysaluetta, kuten editorissa. |
| Oikealla | Keskustelu säilyy vasemmalla, raportti avautuu säädettävään oikeaan paneeliin. Molempia voi lukea ja keskustelua jatkaa rinnakkain. Puhelimessa raportti korvaa keskustelun, Sulje palauttaa sen. | Raportin leveys kilpailee keskustelun kanssa. Puhelimessa ei rinnakkaislukua. |
| Katselutila | Raportti saa lähes koko leveyden, keskustelu jää oikean reunan kaistaleeksi. Sopii leveisiin raportteihin. Kaistale avaa keskustelun takaisin rinnalle; puhelimessa se aukeaa raportin alle. | Keskusteluyhteys heikkenee, kun viestit ovat piilossa. Keskustelun jatkaminen tarvitsee yhden lisäpainalluksen. |

Editoriviite on `web/src/components/EditorSplit.tsx`, `EditorSplit.css` ja
`EditorHeader.tsx`, ei oletus siitä, että editori olisi oikealla.
Yhteiset värit, fontit, välit ja kontrollikoot tulevat `design-system/tokens/`-
tiedostoista. Raportin sisällä on tarkoituksella järjestelmäfontti: agentin
sisältö ei ole Habitatin tuotantokomponentti.

## Kokeile

Alderlla, kun kierros on yhdistetty:

```sh
tw browser-open ~/Sources/open-habitat/issues/agent-html-artifacts/prototypes/viewer/index.html
```

Sivu toimii yhdestä tiedostosta ilman verkkoa. Valitsin: **1–3**, **←/→**,
**R** aloittaa suunnan uudelleen. Valinta säilyy osoitteen `?v=`-parametrissa.

1. Paina **Avaa**. Fokus siirtyy näkymän otsikkoon. Vaihda toiseen raporttiin
   sen nimipainikkeella. Raportin **Eurot / Tilaukset** toimii oikean
   sandbox-iframe:n sisällä.
2. **Sulje** palauttaa fokuksen siihen Avaa-painikkeeseen, josta tulit.
   Escape toimii Habitatin omissa kontrolleissa. Iframe:n sisällä Escape ei
   ylitä selainrajaa: Shift+Tab vie raportin ensimmäisestä painikkeesta
   näkymän välilehtipainikkeisiin, joista Sulje on saavutettavissa.
3. Kahdessa rinnakkaissuunnassa vedä välijakajaa tai käytä sen nuolinäppäimiä.
   Home/End vie ääriasentoon, kaksoisnapsautus palauttaa leveyden. Jakaja ei
   näy puhelimessa. Editorin tapaan ja Katselutila antavat taittaa keskustelun.
4. **Hylkää** poistaa tarjouksen toiminnot; **Palauta tarjous** on kokeen
   palautus, ei ehdotus tuotantoon. Yläpalkin Näkymät-valinta näyttää
   vanhentuneen tarjouksen tai palvelimen offline-tilan ilman toimivaa Avaa-painiketta.
5. **Avaa omalle välilehdelle** avaa aina uuden sivun, ei koskaan paneelia.
   Kokeile myös yläpalkin pysähtynyt- ja osoite ei vastaa -tiloja. Ne eivät
   tarjoa avauslinkkiä eivätkä käynnistä palvelinta selaimesta.

## Ratkaisuja myöhempää arviointia varten

- **Puhelin ei ole pienennetty työpöytä.** Editorin tapaan säilyttää nykyisen
  editorin pinoamisen; Oikealla käyttää yhden tehtävän koko ruudun näkymää;
  Katselutila tarjoaa raportin ja paluukaistaleen. Tämä on tarkoituksellista
  eroa arvioitavaksi, ei vielä valittu tuotantokäytäntö.
- **Vaihtaminen tapahtuu nimetyillä painikkeilla samassa kehyksessä**, ei
  useilla sisäkkäisillä ikkunoilla. Tarjouksen aloituspainike säilyy
  fokuspalautuksen kohteena myös toiseen raporttiin vaihdettaessa.
- **Eristyksestä kerrotaan kevyellä apurivillä.** Ei varoitusdialogia eikä
  turvallisuuslupausta. Raportti on tässä oikeasti `sandbox="allow-scripts"`
  -iframe:ssa ilman same-origin-oikeutta ja ilman verkkoyhteyksiä.
- **Erillisen välilehden osoite on simulaatio.** Offline-tiedosto ei voi
  luoda DNS-nimeä tai kirjautumista. Selain avaa itsenäisen `blob:`-sivun
  `noopener noreferrer` -linkillä. Sivu näyttää selvästi keksityn osoitteen
  `https://oh-view-jaana-demo.example.invalid/tilannekuva/` ja kertoo sen
  simulaatioksi. Osoite ei ole oikea palvelu eikä jaettava linkki; omistajuuden,
  origin-reitityksen ja käyttöoikeuksien toteutusta ei väitetä testatuksi.
- **Avauspyyntö ei tarkoita näyttämisen kuittausta.** Keskustelukortti sanoo
  ”Avaus pyydetty”, koska selain voi estää välilehden. Se ei väitä sisällön
  näkyvän tai palvelimen pysyvän käynnissä. Koetilan valitsin on ainoa
  palvelimen tilan lähde.
- Tarjouksen sulkeminen ei ole hylkäys. Kokeessa raportin saa avata uudelleen;
  katselun tilaa ei tallenneta. Viestikenttä on kokeiltava, mutta Lähetä
  kertoo selvästi, ettei agenttia kutsuta.

## Rakentaminen ja näyttö

```sh
python3 issues/agent-html-artifacts/prototypes/viewer/build.py
PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" node issues/agent-html-artifacts/prototypes/viewer/check.mjs
python3 scripts/validate-project-view.py
git diff --stat main -- web/ internal/ contracts/
```

`build.py` upottaa fontit ja kopioi prototype-skillin valitsimen sellaisenaan
(vain nimet vaihtuvat, ehdollinen animaation uusintapainike jää pois).
`check.mjs` käyttää Playwrightia työpuun tai lähdecheckoutin asennuksesta.
Chromium-kuvat ovat `evidence/`-hakemistossa: jokaisesta suunnasta työpöytä
1440×1000 ja puhelin 390×844, vaalea ja tumma. Lisäksi tarjousten ja
palvelimen poikkeustilat sekä erillinen välilehti. `check.log` kertoo kokeen
lopputuloksen. Tämä ei korvaa oikealla puhelimella tai ruudunlukijalla tehtyä
arviointia. Ei tuotantokoodia, daemonia, sopimuksia tai palvelinmuutoksia.

## Kohdennettu itsearviointi

- Ero on tilankäyttö ja keskustelun jatkuvuus, ei kolme väriversiota.
  Jokainen suunta toimii itsenäisenä ratkaisuna myös puhelimessa.
- Oikea syntetisoitu keskustelu, kaksi avattavaa raporttia, raportin
  toimivat kontrollit ja erillinen prototyyppisivu: ei tyhjiä paikkoja tai
  tuotantotoiminnoksi naamioitua kuollutta painiketta.
- Variantti vaihtuu ilman animaatiota; ainoa liike on skillin oma valitsin.
  Reduced motion poistaa senkin. Ei sisääntuloanimaatiota, joka tarvitsisi
  uusintapainikkeen.
- Otsikkoon tuleva fokus, palautus aloituskortille, oikean iframe-rajan
  läpi kulkeva Tab ja näppäimistöllä säädettävä jakaja tarkistetaan selaimessa.
- Malli ei ohjaa selainta agentin aloitteesta, tarjoa jakamista tai esitä
  paikallista koetta turvallisuusarkkitehtuurin todisteeksi.
- Kuvien katselu paljasti ensimmäisessä ajossa liian aikaisen iframe-kuvauksen:
  puhelinkuva oli tyhjä, vaikka toiminnallinen koe oli läpäissyt. Kuvaus odottaa
  nyt uuden raportin otsikkoa; lopulliset kuvat tarkastettiin. Pitkä valitsinnimi
  lyhennettiin muotoon **Editori**, jotta skillin vakioitu pilleri ei rivitä nimeä.
  Puhelimen editorimallin pieni raporttialue on edelleen tarkoituksellinen,
  nykyisen editorin mukainen vertailuhaitta, ei puuttuva sisältö.

Jari valitsee jatkosuunnan. Tämä kierros ei valitse voittajaa eikä muuta issuen tilaa.
