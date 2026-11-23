# Rail state change: prototype round 2 (motion)

## Saatesanat

Tässä on kolme tapaa näyttää liikkeellä, että keskustelun tila muuttui.
"Uusi"-merkkiä ei enää ole. Liike kestää alle kaksi sekuntia, ja sen
jälkeen sivupalkki näyttää samalta kuin nyt. Avaamisen jälkeen ensimmäinen
muutos soi itsestään, joten jokaisen suunnan ero näkyy heti. ▶ Yksi muutos
ja ▶ Viisi kerralla toistavat ne erikseen. Näkymä-valinnasta saat
puhelimen. Suosittelen A:ta: rivi liukuu näkyvästi Sinun vuorosi
-osioon. Liike kertoo, mihin keskustelu meni, ja osio kertoo, mitä se
sinulta haluaa. Sivu toimii Habitat-näkymänä: siinä ei ole iframea,
navigointia eikä verkkoa.

## Round

`design-system/prototypes/rounds/2026-11-23-rail-state-change-2/`.
NOTES.md describes it in full, in Finnish. Built page:
`design-system/prototypes/dist/rail-state-change-2/offline.html`, built by
the round's `build.mjs`. Open `offline.html` as the view, because it has
the fonts embedded. Round 1 (`2026-11-22-rail-state-change`) stays in the
tree until a direction is chosen.

Axis: **which motion tells that a conversation changed state.** No
direction leaves a persistent mark, so after the motion the rail is
production's.

| | Desktop, row in view | Out of view | Five at once | Phone (drawer closed) |
|---|---|---|---|---|
| **A Siirtyy** | row slides old → new place (neighbours glide), glows 1.8 s, counts roll | row slides over the edge; production's edge chip slides in or rolls, ring | all slide as one motion, no glow | the name flies into the menu button, then its count rolls |
| B Pyyhkäisy | row jumps as now; one band of light in the state's colour | band crosses the edge chip | one band over Sinun vuorosi | band crosses the top bar |
| C Laskuri | nothing moves; section count and row time roll, count ringed 2 s | edge chip's count rolls | counts roll once | menu button's count rolls |

A start (Hiljaiset → Käynnissä) asks nothing, so it gets only what shows
the row's place (A's slide, C's roll), never a glow, band or flight. With
reduced motion (the device setting or the panel switch) nothing moves:
the glow and the band become a still tint or outline for 4 s, and numbers
change at once and are ringed for 4 s. A ring is a shape, so the change
does not rest on colour alone. Every direction makes the same polite
screen-reader announcement, so the announcement is not what tells them
apart.

The page is a Habitat view: no iframe, no navigation, no network. The
phone is a 390 px box instead of a frame. `build.mjs` rewrites
production's width and height media queries into container queries on
that box, and `window.matchMedia` answers for the box's width, so
production's own phone layout (toolbar, badge, drawer) renders inside it.
A real narrow window gets the phone layout directly, with the panel above.

## Recommendation

**A Siirtyy.**

- Jari asked to see the row move into Sinun vuorosi, and the motion
  carries the information: where the conversation went. Arriving in Sinun
  vuorosi says "your turn", and staying in Käynnissä with a red glow says
  "failed".
- The neighbours glide with it, so the rail does not jump. Production's
  jump is the confusing part of today's rail.
- Off-screen, production's edge chip already names the section, and
  sliding it in or rolling its count is the smallest cue that adds
  nothing new.
- Five at once stay calm: one shared slide, no glow.
- B tells *that* something happened but not where from, and five bands
  would flicker, so it falls back to one. C is the calmest, but a rolled
  digit is easy to miss, and on the phone it cannot show a failure at
  all.

## What the host would need

Nothing new. Every direction reacts to the change of a row's section or
state, which the browser already has from the snapshot (the same
`readyKey` trigger as the attention sound, `railNow.ts`), so rows present
at load or after a reconnect do not move. A's slide needs the row's
previous box, which is presentation state measured just before React
commits (FLIP). It needs no store.

## Evidence

- `check.mjs`: 158 checks green. They cover the default view of every
  direction, the whole script in Päivä and Yö, reduced motion, the phone
  box, a real 390 × 844 window, the two replay buttons, English and the
  picker. The page is served with the view's sandbox CSP and an opaque
  origin, and the run fails on any iframe, any request beyond the
  document, any navigation or any console error.
- Screenshots (not committed), several taken mid-motion:
  `/var/tmp/agent-keep/rail-state-change-visual/round-2/`.

## Decisions for later review

- **No persistent mark in any direction.** The alternative was to keep
  round 1's "uusi" as a fallback. Jari found it unnecessary, and
  production's section, mark and count already persist.
- **The motion lasts under 2 s; reduced-motion stills last 4 s.** The
  alternatives were longer glows (round 1 had 3.5 s). Calm and brief was
  the brief, and the still needs longer to be seen without motion.
- **A start gets no glow, band or flight.** The alternative was to treat
  every change alike. A start asks nothing and happens often.
- **A failure stays in Käynnissä** (production's placement), so A has no
  slide for it, only the glow in the error colour.
- **Burst = three or more in one event**, the same rule as round 1.
- **The phone is a box with rewritten container queries, not a frame.**
  The alternative was a static mock of the phone. The view sandbox blocks
  frames, and the box shows production's real phone layout.
- **Same screen-reader announcement in all directions.** The alternative
  was to vary it per direction. It is accessibility, not the axis.

## Questions for Jari

1. Is A right? Should the glow on arrival stay, or is the slide alone
   enough?
2. Out of view, is the edge chip sliding in or rolling enough, or should
   the row's name show briefly at the edge, as on the phone?
3. On the phone, is the flying name welcome, or too much for every
   finished turn?
