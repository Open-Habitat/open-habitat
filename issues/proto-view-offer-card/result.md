# Result: what the view card says, and where its visibility shows

Prototype: `prototypes/nakymakortti.html`, one hand-written offline page
built from `prototypes/page.src.html` by `python3 prototypes/build.py`
(tokens and fonts inlined), in the same form as
`issues/proto-rail-recent-r2/prototypes/`. The picker offers Nykyinen ·
1 · Otsikko ja painikkeet · 2 · Näkyvyys tilarivinä · 3 · Näkyvyys
säätimenä. Every view has light and dark themes, desktop and phone, site link
sharing on or off, and a descriptive or file-name title. The cards sit in a
realistic conversation with two offers: an earlier view that already has a
link and a new one. *Avaa* opens a mock panel beside the conversation, and
*Jaa linkillä* opens a condensed share dialog that creates, extends and
removes a link. Jari's guide in Finnish is `prototypes/NOTES.md`.
Screenshots (device scale factor 2, AVIF) are in `prototypes/kuvat/`;
`prototypes/shoot.mjs` makes them and presses every card control in every
direction, theme, device and link setting with a clean console.

## Baseline: main now

Read from `web/src/components/ViewOffer.tsx`, `web/src/text/viewOffer.ts`,
`web/src/components/ViewPanel.tsx`, `web/src/components/ViewLink.tsx`,
`web/src/app/ViewHost.tsx` and `web/src/app/viewLinks.ts`.

- Label *Agentti tarjoaa näytettäväksi:*, then the title, which is
  `--title` or the source name.
- Meta line *Jäädytetty HTML · N tiedostoa · koko · Vain sinulle*, or
  *Jaettu linkillä 28.11.2026 asti* when `linkFor(view_id)` has a link.
- *Avaa*, *Avaa omalle välilehdelle* and, where the site offers links,
  *Jaa linkillä*.
- *Avaa omalle välilehdelle* sets `tab_requested`, and the card then shows
  *Avaus pyydetty…* until it is opened in the panel and closed again.
- `failed` shows *Näkymää ei voitu avata…*.
- The panel's note repeats *Jäädytetty HTML · Vain sinulle*.

## Common to every direction

All of Jari's points that have one answer are applied in every direction.
The label, the request line (`tab_requested` disappears as a visible state),
*Jäädytetty HTML*, the file count and the size are gone. The title is the
descriptive `--title`. *Avaa* and *Avaa omalle välilehdelle* stay as they are.
The failure line stays, because it is the one thing the person must learn
from the card. The mark and the title share one row, and the buttons follow
under the title. The dialog drops the file facts too.

## The axis

With *Vain sinulle* gone as meta text, the axis is **where and how the card
shows who can see the view**:

| | Direction | Private view | Shared view | Site without links | Decides | Cost |
|---|---|---|---|---|---|---|
| — | **Nykyinen** | *Vain sinulle* in the meta line | *Jaettu linkillä … asti* in the meta line | meta says *Vain sinulle* | visibility is one fact among file facts | cluttered, reads as text, not as a state you can change |
| 1 | **Otsikko ja painikkeet** | nothing | the share button becomes **Jaettu 28.11. asti** (accent tint), same dialog | two buttons | private is the default of everything in a conversation, so only the exception is marked, and it is marked on the control that changes it | a person who wonders "who can see this?" infers it from the absence of a mark |
| 2 | **Näkyvyys tilarivinä** | 🔒 *Vain sinä* under the title | 🔗 *Kuka tahansa linkillä · 28.11. asti* | no line | visibility is always stated, in words | a lock line on every card in every conversation repeats what is true of everything else in the conversation |
| 3 | **Näkyvyys säätimenä** | **Vain sinä ⌄** in the title row | **Linkillä 28.11. asti ⌄**; menu: *Kopioi linkki*, *Linkin asetukset…*, *Lopeta jakaminen* | no control | visibility is a setting of the view, like a shared document's | one more pattern (pill + menu) on a conversation card; on a phone it needs its own row; private still shows on every card |

## Host facts each needs

| Fact | Where | Exists? | Used by |
|---|---|---|---|
| Descriptive title | `--title` on `open-habitat agent view offer` → `view.title` | **yes**; agents are told to pass it by `agent-view-offer-title` | all |
| Site allows links | `linkList` present (`useViewLinks`, `max_days`) | **yes** | all |
| The view's current link and expiry | `linkFor(view_id)` → `expires_at` | **yes** | all |
| The link's address for copying from the card | `ViewLink.url` in the same list | **yes** | 3 |
| Remove a link without the dialog | `revokeViewLink(csrf, link_id)` | **yes** | 3 |
| Open failed | `failed` state | **yes** | all |

No direction needs a new host fact, store or contract field. The changes are
in `ViewOffer.tsx`, `viewOffer.ts` and `ViewHost.tsx` (stop setting
`tab_requested`, or drop that state), plus the panel note and the dialog's
file facts in `ViewPanel.tsx` and `ViewLink.tsx`. `formatViewSize` and the
`files`/`bytes` texts then have no reader. They stay in the contract, because
the host still enforces the limits.

## Recommendation

**Direction 1 · Otsikko ja painikkeet.** It answers Jari's points most
directly: the card becomes the title and the two buttons he liked. The only
state worth showing is the exception, a view that strangers can open, and
direction 1 shows it on the button that manages it. Nothing in a conversation
announces that it is private: messages, files and file offers don't, so a
lock on view cards alone (directions 2 and 3) would suggest that these are
somehow less private by default. Direction 3 is the right model if views
someday get more audiences than "only you" and "anyone with the link" (for
example sharing with another Habitat user), because a setting with several
values belongs in a control. With two values it adds a menu where a button
already does the job.

## Questions for Jari

1. Should the panel follow the same rule? In the prototype, the directions'
   panel note keeps only *Sisältö on erillään Habitatista eikä pääse
   verkkoon.*, and the panel's link icon is tinted when the view is shared.
   Main's note still says *Jäädytetty HTML · Vain sinulle*.
2. Direction 1 shortens the date to *28.11.* when the link expires within
   the current year. Is that enough, or should the year always show as on
   main (*28.11.2026*)?
3. In every direction a site without links shows no visibility at all. Is
   that right, or should *Vain sinä* show there too as plain information?

No production code was changed.
