# Design system

V1:n tuotantodesign, yhteinen visuaalinen perusta ja komponenttien rajat ovat
[design-system-hakemistossa](../design-system/AGENTS.md). Tämä sivu opastaa
kokonaisuuteen; tokeniarvot ja propsit määritellään vain omissa lähteissään.
Tuotetta tai ajettavaa komponenttikirjastoa ei ole vielä toteutettu.

## Tuotantodesign v1

- [Yhdistetty tuotantodesign](../design-system/production-v1.md) ratkaisee
  workspace- ja keskustelutoimitusten erot, teemat, reitit, luonnokset,
  lukukohdan, fokuksen, keyboardin, streamingin ja saavutettavuuden.
- [Komponenttikatalogin sopimus](../design-system/component-catalog-v1.md)
  määrittää vain hyväksyttyjen journeyjen tarvitsemat primitiivit ja tuoteosat,
  julkiset tuotetermiset propsit/tapahtumat sekä pakolliset tilaesimerkit.
- [Staattinen korjauskierros](../design-system/ui_kits/production-v1/index.html)
  näyttää integroidun desktop-näkymän, stale/read-only-tilan, Pi:n jonon,
  epävarman lähetyksen, osittaisen poiston ja molemmat teemat. Se ei simuloi
  backendia eikä ole runtime-toteutus.

Vaalea ja tumma teema kuuluvat molemmat v1:een. Järjestelmäteema on oletus ja
laitteen paikallinen valinta on esitystila, ei host-snapshotin fakta. UI on
suomenkielinen; tekniset tunnisteet säilyvät muuttumattomina. `styles.css` on
tokenien ainoa sisääntulo. Normaaleille teksteille tarkistettujen nykyisten
väriparien heikoin kontrasti on 4,65:1, ja jokainen tila saa värin lisäksi
tekstin tai muun ei-värillisen merkin.

## Kerrokset ja omistajuus

1. `tokens/`: värit, typografia, välit, muodot ja vähennettävä liike.
2. Yleiset primitiivit: semanttiset painikkeet, kentät, valikot, dialogit,
   välilehdet, ilmoitukset ja fokus.
3. Tuotekomponentit: workspace-/agenttinavigaatio, timeline, viestit,
   työkaluryhmät, koodi/diffi, tuettu kysymys, composer/jono, connection ja
   vaiheistettu operaatio.
4. Journey-koostaminen: [UI-käyttökulut](ui.md) ja sovelluksen route-/domain-tila.

Visuaalinen komponentti saa valmiin näyttömallin ja lähettää käyttäjän intentin.
Se ei avaa verkkoa, rakenna command ID:tä, sovita snapshotia ja SSE:tä, päättele
Pi-capabilityä, tallenna draftia tai tee retry/resume/rollback-päätöstä.
`build-design-system` toteuttaa hyväksytyn katalogin myöhemmin samalla koodilla,
jota tuote ja katalogi käyttävät.

## Referenssien asema

Nykyiset `components/`-hakemiston JSX-, `.d.ts`-, prompt- ja card-tiedostot sekä
vastaanotetut HTML-vedokset säilyvät v0.1-visuaalireferensseinä. Ne eivät ole
production API tai näyttö backend-kyvystä. Tuotantospec korjaa niistä muun muassa
pelkkään tilapisteeseen jääneen tiedon, yksittäisen queue-itemin cancelin,
hard-coded title-cadencen, automaattisen fokussiirron, GitHub-linkityksen mockin
ja yhdistetyn stop+archive-toiminnon.

Alkuperäiset lähteet:

- [keskusteluvedokset](../issues/receive-designer-v1/design/vedokset/);
- [workspace- ja agenttinavigointi](../issues/receive-designer-v1/design/workspaces/);
- [vastaanotto](../issues/receive-designer-v1/review.md) ja
  [kahdeksan hyväksyttyä UI-päätöstä](../issues/review-ui-v1/review.md).

React/TypeScript, React Aria ja Storybook ovat edelleen
[Proposed ADR 0002:n](adr-0002-frontend-stack.md) ehdotuksia. Tuotantodesign ei
hyväksy stackia. Ajettavan katalogin URL ja käyttöohje lisätään vasta, kun
`build-design-system` on rakentanut ja todentanut saman tuotantokoodin.
