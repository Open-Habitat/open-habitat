# Result

Nosta and Ei nyt now live only in the rail, still behind the experimental
feature *Nosta ja Ei nyt*.

1. The composer has no turn button any more: the middle slot's *Nosta*,
   *Ei nyt* and the orange *Sinun vuorossasi ✕* are gone with their
   component, text catalog and styles.
2. Every rail conversation row that can move offers its direction among the
   row's hover buttons, beside rename and archive (always shown on a touch
   screen, like archive): up (*Nosta Sinun vuoroosi*) on a Hiljaiset row, and
   down on every Sinun vuorosi row: *Laske Hiljaisiin* for a raised row and
   *Ei nyt: siirrä Hiljaisiin* for one waiting on a reply (the row that had
   no button in Jari's test) or a new, empty conversation.
3. The row's status mark says only the agent's state. A raised row no longer
   has an arrow for a ball; it shows what its agent does (a resting Pi's
   ball). A read reply keeps its orange ring.

The daemon mark, its contract and the snapshot are unchanged.

Evidence: `Navigation.test.tsx` (up, lower and Ei nyt pressed from rows,
the Ei nyt name, a raised row's ball is the agent's), `railNow.test.ts`
(unchanged actions per row), and `web/tests/raise-to-your-turn.spec.ts`
rewritten for the rail: two browser contexts of one person against the real
gateway and daemon; with the feature off no buttons, on: Ei nyt from the
Sinun vuorosi row, no turn text in the composer row, raise from Hiljaiset
with no arrow, lowering and raising from the other device, reload, a reply
clears the raise and its row offers Ei nyt.

## Decisions for later review

1. **One direction per row, not both.** A row shows the button that moves
   it: up in Hiljaiset, down in Sinun vuorosi. Alternative: up and down on
   every row, one of them disabled. A disabled twin on every row is clutter
   and says nothing the section does not.
2. **No button on a question or in Käynnissä.** A pending question stays in
   Sinun vuorosi until it is answered, and Ei nyt would not answer it, so
   its row has no down button. A conversation at work has neither: a raise
   during work would be ended by the reply the work produces. Alternative:
   offer Ei nyt on a question too (it would need a new rule for questions).
3. **A raised row's mark is the agent's state.** With the arrow gone the
   raised row is not orange either; its place at the top of Sinun vuorosi
   and its words (*Nostit Sinun vuoroosi*) say it was raised. Alternative:
   the plain orange turn ball. Jari asked for the agent's state only.
