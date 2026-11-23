# The account menu on the phone (prototype round)

## Saatesanat

Sisältö on kaikissa kolmessa suunnassa sama kuin valitsemasi A Ryhmät:
Asetukset ja Palvelimen ylläpito, Selitä ja Palaute, pikavalinnat Teema,
Agentin työ ja Äänet, ja viimeisenä Kirjaudu ulos. Ryhmien välissä on
pelkät erottimet. Suunnat eroavat siinä, mitä laatikon henkilörivi avaa
puhelimessa.

A nostaa alareunasta koko levyisen arkin, jonka rivit ovat sormen
korkuisia. B on tämän päivän ponnahdusvalikko laatikon sisällä uudessa
järjestyksessä. C avaa koko näytön Tili-sivun, jolla on takaisin-nuoli.
Katselmointisivulla näet kaksi puhelinta vierekkäin, isomman 390 × 844
ja pienen 360 × 640, ja kummassakin valikko on auki. Kokeile niissä
pikavalintoja, *Palaute Habitatista…* ja *Kirjaudu ulos…* ja valikon
sulkemista: A:ssa pyyhkäise arkki kahvasta alas tai napauta sen
yläpuolelle, B:ssä napauta valikon ulkopuolelle, C:ssä paina nuolta tai
pyyhkäise vasemmasta reunasta. Puhelimen alla oleva *◁ Takaisin-ele*
toimii kuin puhelimen takaisin-ele, ja se sulkee kaikissa suunnissa yhden
kerroksen kerrallaan. *Näytä*-valinta avaa suoraan palautteen tai
uloskirjautumisen.

Tämä on kierroksen uusi rakennus, joka toimii Habitat-näkymässä:
puhelimet ovat sivulla suoraan eivätkä kehyksissä, joten näkymän
sandbox ei enää estä niitä. Suunnat ja kysymykset ovat samat kuin
ensimmäisellä kerralla. Yksi ero on: kun kosketat toista puhelinta,
toisen puhelimen valikko sulkeutuu. Sivulla voi olla auki vain yhden
puhelimen valikko kerrallaan, jotta napautus osuu siihen puhelimeen,
jota kosketit.

Suosittelen A:ta. Arkki mahtuu pieneenkin puhelimeen vierimättä, ja sen
yläpuolelle jää vielä noin neljännes laatikosta. Rivit ovat peukalon
alla, ja kun arkin sulkee, palaa samaan laatikkoon, josta lähti.
Palautteen paneeli on samanlainen arkki, joten puhelimessa kaikki
tilivalikon pinnat näyttävät samalta. B toimii yllättävän hyvin, koska
koko valikko mahtuu 360 × 640 -puhelimeenkin. Se on kuitenkin laatikon
levyinen ja kelluu keskellä ruutua, ja pikavalintojen segmentit ovat
pieniä sormelle. C:ssä on eniten tilaa, mutta pikavalinnan vaihtaminen
vie sivulle ja takaisin, ja se on raskas tapa vaihtaa esimerkiksi
äänet hiljaisiksi palaverin alkaessa.

## Built page (round 2, opens as a view)

Round 1 put each phone in an `<iframe>`, and a Habitat view's sandbox CSP
(`frame-src 'none'`) blocked them, so every phone said "This content is
blocked". Round 2 (`design-system/prototypes/rounds/2026-11-23-account-menu-phone-inline`)
is the same round with the same directions, content and questions, but the
phones are inline: each one is a `div` size container, scaled with a CSS
transform on the review page. There are no frames, no navigation and no
network. Round 1's directory is removed; it is in git history.

Build with
`node design-system/prototypes/rounds/2026-11-23-account-menu-phone-inline/build.mjs`.
That writes `design-system/prototypes/dist/account-menu-phone-inline/offline.html`
(fonts embedded; the view CSP allows `data:` fonts) and `index.html`
(without fonts). A copy that outlives the worktree:
`/var/tmp/agent-keep/account-menu-phone/round2/offline.html`, with the
check's screenshots in `/var/tmp/agent-keep/account-menu-phone/round2/check/`.
The round's `NOTES.md` lists the URL parameters and how the inline phone
works.

To fit production's phone layout into a `div`, `build.mjs` rewrites the
production CSS at build time without touching its sources: width and
height media queries become container queries, viewport units become
container units, and hover/pointer queries get a touch phone's answer.
`window.matchMedia` answers width queries as a phone. React Aria overlays
portal into their own phone, and each phone has its own in-memory
history for Back.

`check.mjs` passed 675 checks with a clean console. Every page in it is
served with the view CSP, which the check reads from
`internal/gateway/views_linux.go` (`viewHeaders`). The check fails on any
CSP violation, any request after the document, any navigation or any
frame. As a control, round 1's page fails it at once (`no frames`).
Besides round 1's checks (structure, sizes, gestures, Back, feedback and
sign-out in every direction, on both phones, in Päivä and Yö), the review
page now checks that each phone is in its phone layout with the menu
inside its own box (B's popover at the review scale included), that a
tap in either phone works there, that Back under a phone closes its
layer, and that the quick-row names are not covered at the review scale.

The measurements are round 1's, because the phone pages lay out the same
way. At 360 × 640, A's sheet is 464 px tall (485 px with the night note)
and starts 176 px from the top. B's popover is 450 px tall (489 px with
the night note).

## Axis and directions

The axis is what the drawer's person row opens on a phone. The content
is round 1's direction A without visible group headings, as Jari chose.

- **A Sheet.** A full-width sheet from the bottom edge, over the drawer.
  It has a grip, the person, and then the menu. The rows are touch height
  (44 px) and the quick-row segments are 36 × 40 px. A swipe down on the
  grip or the person closes it, past 70 px; a shorter drag springs back.
  Back, a tap on the scrim above the sheet or Esc also close it. The
  drawer stays open under the sheet, so closing returns to it.
- **B Popover.** Production's `MenuTrigger` and `Popover` (`top start`)
  in the drawer, in A's order. It is as wide as the person row it grows
  from. A tap outside, Back or Esc closes it. The quick rows keep
  production's compact segments.
- **C Account page.** The person row, which has a right chevron instead
  of the menu chevron, opens a full-screen *Tili* page with a back arrow
  in its top bar. The feedback panel opens as a sub-page and the sign-out
  confirmation opens above the page, so Back returns to the account page.
  The back arrow, a swipe from the left edge, Back or Esc leave the page
  and return to the drawer.

What all three share:

- Each open layer is one history entry, so the phone's Back closes
  exactly one layer. In-page closes call `history.back()`, so the history
  and the open layers always agree.
- Selitä, Asetukset and Palvelimen ylläpito close every layer and the
  drawer. In the prototype they then show a stand-in toast.
- In A and B, Palaute Habitatista… replaces the menu with the feedback
  sheet and closes the drawer under it. The sheet can be swiped down or
  closed with ✕, Peru or Back. A tap outside or Esc with unsent text
  nudges instead of closing.
- Kirjaudu ulos… opens production's `AccountLogoutDialog` unchanged.

## Accessibility and touch

- The sheet, the page and the feedback panel are React Aria modal dialogs
  with contained focus, labelled by their heading or by Tilivalikko. B
  stays production's popover menu.
- Every gesture has a visible equivalent: the swipe down has the scrim
  and ✕, and the edge swipe has the back arrow. Every layer also closes
  with Esc and Back.
- The rows are at least 44 px high in every direction. The feedback field
  uses a 16 px font so that iOS does not zoom when it gets focus.
- The open animations (sheet up, page from the right) are switched off
  under `prefers-reduced-motion`.

## What the view assumes from the host

The view needs nothing beyond round 1: whether the person is an
administrator and the product version for the feedback issue. The
history entries are browser-only state. Nothing new crosses the
browser/host contract.

## Decisions for later review

- **Round 2: touching one phone closes the other phone's layers.**
  React Aria keeps one overlay stack per page and treats a press outside
  the topmost overlay as a dismissal that it swallows. With both phones
  open side by side, a tap in one phone would have closed the other
  phone's menu instead of doing what was tapped. The alternatives were
  one live phone and one still picture, or patching React Aria's stack.
  I chose to let the phone you touch be the live one, because both
  phones still open with their menus visible and each one behaves exactly
  like a phone once you use it. The review bar, the picker and the
  captions are outside this: using them closes nothing until a setting
  restarts the phones.
- **Round 2: the page's own scaffolding refuses `inert` and
  `aria-hidden`.** An open React Aria modal hides everything outside it
  up to the body, which here would have frozen the other phone and the
  review bar. Inside a phone, hiding works as in production. This is
  prototype harness only, not a model for the product.
- **Round 2: round 1's directory is removed.** Round 2 has the same
  directions and content, and only round 2 opens as a view. Two copies
  would drift; round 1 stays in git history.

- **Back closes one layer in every direction, B included.** Today's
  popover ignores Back, so on Android Back leaves the page while the
  menu is open. I gave B the same history handling, because otherwise
  B would lose on a defect rather than on its form. Implementation needs
  this whichever direction wins.
- **In A, the drawer stays open under the sheet.** The alternative was
  to close the drawer when the sheet opens, which would leave the
  conversation behind the sheet. I kept the drawer, because dismissing
  the menu should return to where the person was, and that is the
  drawer.
- **In A and B, cancelling sign-out returns to the drawer, not the
  menu.** The confirmation replaces the menu instead of stacking on it,
  the same as the feedback panel. Stacking would mean two modal layers
  on a small screen.
- **The feedback draft survives Back.** Back cannot be refused the way a
  tap outside can, so instead of nudging, the draft is kept and is there
  when the panel is opened again. Implementation can keep it the same way
  the composer keeps its draft.
- **B is as wide as the person row.** Production's 17rem-wide popover
  clipped "Teema" beside the four theme icons at 360 px. The person row's
  width is the drawer's, so B is still a popover in the drawer.
- **C's sign-out confirmation is raised above the page.** Production's
  `.ah-overlay` (z-index 50) is below a full-screen layer. If C is chosen,
  the overlay order needs a token or a shared layer, not a one-off value.

## Questions for Jari

1. A, B or C? I recommend A.
2. If A: should the feedback panel open as a sheet in the same place as
   the menu (as now), or slide up over it so that Back returns to the
   menu instead of the drawer?
3. Is it right that dismissing the menu returns to the open drawer? The
   alternative is that it closes the drawer too, so you land back in the
   conversation with one gesture.
