---
created: 2026-10-02
updated: 2026-10-02
type: bug
reporter: jari
status: untriaged
priority: normal
provenance: chat
source_ref: chat:2026-10-02:ui-observations:12
related: ['@unknown-pi-event-thinking-level', '@consistent-control-feedback']
---

# Make conversation block handling coherent and discoverable

## Observed problem

Jari reported on 2 October 2026 that a Pi conversation's loaded history contains
a large block beginning "[Sisältöä ei tueta: thinking]", followed by JSON with
`encrypted_content`. This is separate from the `thinking_level_change` event
reported in @unknown-pi-event-thinking-level. The supplied screenshot contains
private session data; use redacted or synthetic examples in the public repository.

The encrypted payload is a symptom of how native content becomes presentation.
At this review, `nativeText` in `internal/daemon/history_linux.go` turns unsupported
blocks into marked JSON text. `web/src/app/HistoryView.tsx` parses that marker and
can show raw JSON when no readable summary is found. Investigate this path and
the other block types, including the live conversation path, to fix the shared
interpretation rather than hide one offending field in one view.

## Agreed presentation

User-facing text, readable thinking content and questions remain available to the
person. Encrypted payloads and technical metadata do not become conversation
messages. Omitting an unreadable encrypted thinking payload needs no warning card.
Genuinely unknown content has a quiet presentation with details available when
useful, without overwhelming the conversation with raw JSON. Keep meaningful
user-facing content available even when a specialized presentation is missing.
The same content follows the same interpretation in live and historical views.
These are presentation rules; the native session remains the source of truth.

## A discoverable block library

Jari wants the different conversation blocks to be understandable and easy to find
as a library: what each block means, where its handler is, and what it looks like.
Review the block types the supported agent actually produces and establish a
coherent mapping from native input to handling and visual presentation, including
mixed-content messages and the unknown-content fallback. Blocks intentionally
omitted from the reading view should have an explained treatment as well.

Build on the existing production components and Storybook catalog described in
[the design system](../../docs/design-system.md) and
[the component catalog](../../design-system/component-catalog-v1.md). A designer
should be able to browse representative examples of the blocks that can appear,
understand their meaning and change their appearance through the same components
the application uses. Make the relationship between a block, its handler and its
catalog example easy to locate. Recommend the code organization from the actual
sources; a new registry or framework is not an agreed implementation choice.

## Outcome

Explain the causes found and implement a shared treatment that removes encrypted
JSON from the reading flow, preserves useful content and gives the other block
types coherent presentations. Demonstrate representative blocks and combinations
through both loaded history and live updates, with designer-facing catalog
examples. Coordinate @unknown-pi-event-thinking-level rather than independently
redesigning its fallback, and align shared UI mechanisms with
@consistent-control-feedback. Significant architecture choices follow the
project's normal decision policy.

## Decisions

### 2026-10-02T10:11:24Z · @codex

Jari hyväksyi 2.10.2026 yhteisen tulkintaperiaatteen: käyttäjälle tarkoitettu teksti, luettava thinking-sisältö ja kysymykset säilyvät; salatut payloadit ja tekninen metadata eivät muutu keskusteluviesteiksi. Salatun thinking-lohkon pois jättämisestä ei tarvita varoituskorttia. Aidosti tuntematon sisältö esitetään hillitysti avattavin tarkemmin tiedoin. Historia ja reaaliaikainen keskustelu noudattavat samaa periaatetta.

Jari laajensi työn muihinkin lohkoihin: lohkot muodostavat ymmärrettävän, helposti löydettävän kirjaston, jossa kullakin on käsittely ja visuaalinen esitys designerin tarkasteltavaksi. Nykyisiä tuotantokomponentteja ja Storybookia käytetään lähtökohtana; tiettyä rekisteri- tai framework-ratkaisua ei päätetty. Rajapintadokumentin aiempi yleinen vaatimus tuntemattoman sisällön näyttämisestä täsmennetään tähän rajaan. Tämä kirjaus määrittää tulevan toteutuksen, ei väitä sen valmistuneen.
