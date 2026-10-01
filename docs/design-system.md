# Design system

V1:n tuotantodesign, yhteinen visuaalinen perusta ja komponenttien rajat ovat
[design-system-hakemistossa](../design-system/AGENTS.md). Tokeniarvot ja propsit
määritellään vain omissa lähteissään.

## Ajettava tuotantokatalogi

Tuotantokomponentit ovat [`web/src/components/`](../web/src/components/)-hakemistossa.
Sekä sovellus että Storybook tuovat nämä samat TypeScript-moduulit. Storyt sisältävät
vain valmiita näyttömalleja ja tapahtumakäsittelijöitä; niissä ei ole rinnakkaisia
kontrolleja, verkkokutsuja tai natiivin tilan päättelyä.

Katalogin voi avata kehityspalvelimena tai rakentaa staattiseksi:

```sh
npm ci --prefix web
npm run storybook --prefix web -- --no-open
npm run build-storybook --prefix web
```

Katalogin pääryhmät ovat yleiset kontrollit, valikot ja dialogit, workspace-/agentti-
navigaatio, keskustelu ja sen sisältötyypit sekä tuntemattomat, vanhentuneet,
vain luku- ja osittaiset tilat. Vaalean ja tumman teeman voi vaihtaa Storybookin
työkaluriviltä. Erilliset storyt näyttävät pitkän suomalaisen sisällön 200 % koossa
ja vähennetyn liikkeen tilamerkin. Playwrightin deterministinen preview käyttää
samoja tuotantomoduuleja happy- ja unhappy-state-kuvissa.

### Uudet tilatarinat

- **Production/Journey states**: työtilan aloitus ja paluulinkit, pitkä otsikko, kapea navigaatio, tyhjä ja puuttuva lähde, lukuvirhe, vanhentunut näkymä, istunnon tarkistuksen peitetty sisältö sekä vanhentuminen ilman vanhan sisällön näyttämistä.
- **Production/GitHub first-use chooser** ja **Production/Pi first-use presentation**: valinta kapealla ruudulla ja käyttöönoton vaaratoiminto molemmilla leveyksillä; osittaisen haun valinnan muutos.
- **Production/Conversation recovery**: tyhjä, latautuva, epäonnistunut ja vanhentunut historia, keskeytetty vastaus, Pi:n työn eteneminen sekä säilyneet hylätyt ja epävarmat luonnokset (myös kapeana).
- **Production/Agent interaction preparation**: kuitattu, hylätty ja epävarma lähetys sekä hylätty/epävarma luonnos kapeana; **Production/Markdown / HostileAndNarrow** näyttää epäluotetun sisällön.

Storyt näyttävät komponenttien näyttötilat synteettisillä tiedoilla; ne eivät simuloi sessiosidontaa, reititystä tai Pi:n kuittauksia.

## Tuotantodesign v1

- [Yhdistetty tuotantodesign](../design-system/production-v1.md) ratkaisee
  workspace- ja keskustelutoimitusten erot, teemat, reitit, luonnokset,
  lukukohdan, fokuksen, keyboardin, streamingin ja saavutettavuuden.
- [Komponenttikatalogin sopimus](../design-system/component-catalog-v1.md)
  määrittää hyväksyttyjen journeyjen tarvitsemat primitiivit ja tuoteosat,
  julkiset tuotetermiset propsit/tapahtumat sekä pakolliset tilaesimerkit.
- Historialliset keskustelu- ja workspace-vedokset ovat
  [`design-system/drafts/v1/`](../design-system/drafts/v1/)-hakemistossa.
  Ne eivät ole tuotantokoodia tai näyttö backend-kyvystä.

Vaalea ja tumma teema kuuluvat molemmat v1:een. Järjestelmäteema on oletus ja
laitteen paikallinen valinta on esitystila, ei host-snapshotin fakta. UI on
suomenkielinen; tekniset tunnisteet säilyvät muuttumattomina. `styles.css` on
tokenien ainoa sisääntulo. Jokainen tila saa värin lisäksi tekstin tai muun
ei-värillisen merkin.

## Kerrokset ja omistajuus

1. `design-system/tokens/`: värit, typografia, välit, muodot ja vähennettävä liike.
2. `web/src/components/Primitives.tsx` ja `Overlays.tsx`: semanttiset painikkeet,
   kentät, valikot, dialogit, välilehdet ja fokus.
3. `Navigation.tsx`, `Conversation.tsx`, `Status.tsx` ja `Operations.tsx`:
   hyväksytyissä näkymissä toistuvat tuoteosat.
4. `web/src/app/`: route-, verkko- ja domain-tila sekä journey-koostaminen.

Visuaalinen komponentti saa valmiin näyttömallin ja lähettää käyttäjän intentin.
Se ei avaa verkkoa, rakenna command ID:tä, sovita snapshotia ja SSE:tä, päättele
Pi-capabilityä, tallenna draftia tai tee retry-, resume- tai rollback-päätöstä.
Myöhemmät slicet laajentavat tätä samaa kirjastoa todetun tarpeen mukaan.

## Tarkistukset

Komponentti- ja selaintestit tarkistavat muun muassa näkyvät estosyyt,
näppäimistön, dialogin fokuspalautuksen, valikon liikkumisen, IME-lähetyksen,
ei-värilliset tilat, 200 % zoomin, reduced motionin sekä Axen molemmissa teemoissa.
Kuvat täydentävät näitä väitteitä, mutta eivät korvaa assertioita.
`storybook:test` on tässä vaiheessa katalogin build-check: Storybookin addon näyttää
Axen tulokset interaktiivisessa katalogissa, mutta deterministiset Axe-assertiot
ajetaan `test:a11y`-komennolla tuotantomoduulien preview-fixturejä vasten.

```sh
npm run test:component --prefix web
npm run storybook:test --prefix web
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm run test:visual --prefix web
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm run test:a11y --prefix web
```
