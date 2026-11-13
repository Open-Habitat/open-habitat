# Result: website front page, round 1

Round: `design-system/prototypes/rounds/2026-11-13-website-front-page/`
(build and check commands in its `NOTES.md`). One static page, three
directions behind the picker, each with its one-line difference and the
recommendation in a band at the top. The text is today's front page in
both languages, read from `Landing.astro` at build time, so only look and
composition change. Themes and mark are the issue's CSS unchanged.

Axis: how much the new mark carries the page.

1. **Hiljainen**: today's composition in the app's calm. Päivä by default,
   Yö and Korkea kontrasti by system preference, text left and server
   diagram right, cards. The mark appears in the header (it plays the intro
   once) and as the state in the diagram's homes.
2. **Yö ensin**: Yö's green on near-black whatever the system says, a
   very large headline, the server as a console listing with working and
   your-turn marks, and sections as numbered rows with no cards.
3. **Merkki kantaa**: a 132 px mark draws itself on load and the resident
   steps in through the door. Beside it, five states (thinking, working,
   your turn, several at once with orbiting sub-agents, done), each
   explaining a claim the page already makes. The rest follows 1 and the
   theme follows the system.

**Recommendation: 3.** It is the only direction where the mark does work
instead of decorating: a visitor sees at once that the agent goes on
without them and calls them when it is their turn. Below the hero it is as
calm as 1.

Checked at 1440 and 390 px. All three directions were checked in Päivä and
Yö, and at 1440 also in Korkea kontrasti. Every text measures at least 4.5:1
against its own background (7:1 in Korkea kontrasti). With reduced motion
nothing animates and the waiting resident still stands at the door. The
console is clean (166 checks).

Questions for Jari:

- The direction 3 state captions are the only new wording (en and fi). Is
  that wording acceptable on the live site?
- Should the live site also offer Korkea kontrasti in its theme menu, or
  only select it through `prefers-contrast: more`?
