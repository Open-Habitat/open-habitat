# Agent Host UI

Tämä hakemisto on käyttöliittymän yhteinen design system: tokenit, visuaaliset
ohjeet ja uudelleenkäytettävät komponentit. Tuotteen arkkitehtuuria, yhden näkymän
toimintalogiikkaa tai yksittäisen suunnittelukierroksen vedoksia ei määritellä täällä.

## Lue ennen UI-työtä

- Tuotteen rakenne ja rajat: [`../docs/architecture.md`](../docs/architecture.md)
- Tuotantodesignin kanoninen määrittely: [`production-v1.md`](production-v1.md)
- Tuotantokomponenttien rajattu katalogisopimus:
  [`component-catalog-v1.md`](component-catalog-v1.md)
- Katseluesimerkit: [`ui_kits/production-v1/index.html`](ui_kits/production-v1/index.html)
- Ensimmäisen keskusteludesignin vedokset ja simulaatio:
  [`../issues/receive-designer-v1/design/`](../issues/receive-designer-v1/design/).
- Vastaanotto ja hyväksytyt UI-päätökset:
  [`../issues/receive-designer-v1/review.md`](../issues/receive-designer-v1/review.md) ja
  [`../issues/review-ui-v1/review.md`](../issues/review-ui-v1/review.md).

## Pysyvät päätökset

- Työpöytäsovellus tehdään ensin. Mobiilinäkymiä ei suunnitella eikä toteuteta
  ennen toimivaa ensimmäistä työpöytäversiota.
- Käyttöliittymätekstit ovat suomeksi. Polut, komennot, exit-koodit, resume-ID:t
  ja muut tekniset tunnisteet esitetään sellaisinaan.
- Vaalea ja tumma teema ovat molemmat v1:n tuotantolaajuutta; järjestelmäasetus
  on oletus. Teema ei ole hostin synkronoitu fakta.
- Komponenttikirjastoa kasvatetaan todetun käyttötarpeen perusteella, ei varalta.
- Visuaalinen komponentti ei omista Pi-, HTTP/SSE-, command ledger-, draft- tai
  natiivilähteiden reconciliation-logiikkaa.

## Visuaalinen lähde

Linkitä käyttöliittymään vain [`styles.css`](styles.css). Se tuo design-tokenit
`tokens/`-hakemistosta. Värit, typografia, välit, pyöristykset ja liike määritellään
niissä tiedostoissa; älä toista arvoja agenttiohjeissa tai näkymäkohtaisessa
lähdekoodissa.

`guidelines/` näyttää tokenien tarkoitetun käytön, tilojen esityksen ja
saavutettavuuden perustason. Jos ohjeteksti ja token ovat ristiriidassa, korjaa
ristiriita design systemissä sen sijaan, että lisäät näkymäkohtaisen poikkeuksen.

## Sisältö

Nämä säännöt koskevat yhteisesti kaikkia näkymiä:

- Kerro tuntematon, vanhentunut ja epävarma tila rehellisesti; älä päättele sitä
  valmiiksi tai pysähtyneeksi.
- Estetyn toiminnon yhteydessä näkyy syy. Olennainen tieto ei saa olla vain
  tooltipissä, hoverissa tai värissä.
- Teknistä tunnistetta ei käännetä eikä muuteta toiseksi tunnisteeksi.
- Käytä rauhallista, suoraa kieltä ilman huutomerkkejä, emojia tai kehumista.

Näkymäkohtainen nimeäminen, otsikointi, polkujen lyhentäminen, agentin tunnisteet,
jonotus ja ohjaustoiminnot kuuluvat kyseisen näkymän hyväksyttyyn suunnitelmaan,
eivät design systemin yleisiksi sisältösäännöiksi.

## Komponentit

[`component-catalog-v1.md`](component-catalog-v1.md) on tuotannon komponenttien,
propsien, tapahtumien, tilojen ja esimerkkien sopimus. Se sisältää vain hyväksyttyjen
journeyjen tarvitsemat yleiset primitiivit ja tuoteosat.

Nykyiset hakemistot ovat vastaanotetun v0.1-kierroksen referenssejä:

- `components/core/`: Button, Tag, StatusDot.
- `components/agent/`: ToolRow, ToolGroup, CodeBlock, DiffView, ApprovalCard.
- `components/chat/`: TopBar, Message, Composer, Banner.

Niiden `.jsx`, `.d.ts`, `.prompt.md` ja kortti-HTML säilyvät lähdeprovenienssin
vuoksi. Ne eivät ole tuotanto-API: esimerkiksi yksittäisen queue-itemin cancel,
hard-coded otsikkorytmi tai hoveriin jäävä tieto on korjattu tuotantosopimuksessa.
Proposed ADR 0002:n stack ja oikeat komponentit hyväksytään ja rakennetaan vasta
myöhemmissä porteissa. Tuote ja katalogi käyttävät silloin samaa toteutusta.

## Hakemistot

| Polku | Sisältö |
|---|---|
| `styles.css` | Ainoa linkitettävä tyylien sisääntulo |
| `tokens/` | Värit, typografia, välit ja liike |
| `guidelines/` | Tokenien ja yhteisten tilojen visuaaliset käyttökortit |
| `components/` | Uudelleenkäytettävät komponenttireferenssit |
| `ui_kits/` | Staattiset katseluesimerkit; `production-v1` havainnollistaa kanonista specia, muut eivät lisää tuotevaatimuksia |
| `production-v1.md` | Yhdistetty visuaalinen, reitti-, fokus-, streaming- ja journey-määrittely |
| `component-catalog-v1.md` | Tuotantokomponenttien julkinen sopimus ja state/story-matriisi |
