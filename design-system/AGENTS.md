# Agent Host UI

Tämä hakemisto on käyttöliittymän yhteinen design system: tokenit, visuaaliset
ohjeet ja uudelleenkäytettävät komponentit. Tuotteen arkkitehtuuria, yhden näkymän
toimintalogiikkaa tai yksittäisen suunnittelukierroksen vedoksia ei määritellä täällä.

## Lue ennen UI-työtä

- Tuotteen rakenne ja rajat: [`../docs/site/architecture.md`](../docs/site/architecture.md)
- Ensimmäisen keskusteludesignin vedokset ja simulaatio:
  [`../issues/receive-designer-v1/design/`](../issues/receive-designer-v1/design/).
- Katselmoinnin avoimet tuotekysymykset:
  [`../issues/receive-designer-v1/review.md`](../issues/receive-designer-v1/review.md).

## Pysyvät päätökset

- Työpöytäsovellus tehdään ensin. Mobiilinäkymiä ei suunnitella eikä toteuteta
  ennen toimivaa ensimmäistä työpöytäversiota.
- Käyttöliittymätekstit ovat suomeksi. Polut, komennot, exit-koodit, resume-ID:t
  ja muut tekniset tunnisteet esitetään sellaisinaan.
- Komponenttikirjastoa kasvatetaan todetun käyttötarpeen perusteella, ei varalta.

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

- `components/core/`: Button, Tag, StatusDot.
- `components/agent/`: ToolRow, ToolGroup, CodeBlock, DiffView, ApprovalCard.
- `components/chat/`: TopBar, Message, Composer, Banner.

Jokaisella komponentilla on `.jsx`, propsit ja säännöt kuvaava `.d.ts` sekä
käyttötarkoituksen kertova `.prompt.md`. Kortti-HTML näyttää komponentit yhteisillä
tokeneilla.

Komponentit ovat tällä hetkellä suunnittelureferenssejä, eivät päätös tuotannon
frontend-stackista. Kun niitä toteutetaan tuotantoon, käytä semanttisia kontrolleja,
näppäimistökäyttöä, näkyvää fokusta ja `prefers-reduced-motion`-asetusta.

## Hakemistot

| Polku | Sisältö |
|---|---|
| `styles.css` | Ainoa linkitettävä tyylien sisääntulo |
| `tokens/` | Värit, typografia, välit ja liike |
| `guidelines/` | Tokenien ja yhteisten tilojen visuaaliset käyttökortit |
| `components/` | Uudelleenkäytettävät komponenttireferenssit |
| `ui_kits/` | Komponenteista kootut staattiset käyttöesimerkit, eivät tuotevaatimukset |
