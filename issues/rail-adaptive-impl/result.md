# Adaptive rail – result

Behind Settings › Kokeelliset ominaisuudet › *Mukautuva sivupalkki*
(`adaptive-rail`). Off, the rail is today's. On (and not on a phone, not
in the narrow rail):

- The places (Etusivu, Tuotokset, Oma selain while the server browser is
  on, Agentin käytössä) and search sit at the top as an icon row, one row
  of tiles or a row each, as the rule decides. Their test ids are the fixed
  rail's, so every link, card and explain card still finds them. The icons
  are production's, in one map (`PLACE_ICONS` in
  `web/src/components/AdaptiveRail.tsx`) for the icon round.
- Round 3's rule is `web/src/components/railAllocation.ts`, a pure port of
  the round's `allocate()` with the accepted parameters (C+B: conversations
  first while the minimums do not fit, Työtilat's floor 3 rows; bounds
  7 / 14 and 6 / 10, 2 : 1, head 1.25). `AdaptiveRail.tsx` measures the
  real rail into its constants and sets the two regions' heights.
- Työtilat has edge chips "↑ n työtilaa" / "↓ n työtilaa" that page the
  list (explain card S41); the filter and refresh sit on its heading row,
  the filter only past 12 workspaces or while it holds text.
- Every conversation row names its workspace (one `workspaceNames` prop on
  NowSections and QuietSection). Hiljaiset stays a separate newest-first
  list and never folds itself; folding it by hand still works.
- The rail is 356 px when the window leaves the conversation the room the
  fixed rail leaves it at about 1170 px, narrowing back to 296 px before
  the conversation gives anything up. The phone drawer is unchanged.

At 1280 px wide, ordinary content (4 / 2 / 12, 18 workspaces), rows wholly
in sight in the lab: 720 px 7 + 4 (today 4 + 3), 1080 px 12 + 10.

## Evidence

- `web/src/components/railAllocation.test.ts`: round 3's measurement table
  for A, B, C and C+B with the constants the round's page measured, where
  the step changes, and the rule's invariants.
- `web/tests/lab-adaptive-rail.spec.ts`: 720 / 900 / 1080 against the fixed
  rail, little content (rows step), crowded (axe, fold, places navigate),
  a narrower window, off, phone; `--repeat-each 3` green with two workers.
- Screenshots (not committed): `/var/tmp/agent-keep/rail-adaptive-impl/`.

## Decisions for later review

- **Folded Hiljaiset does not free room for Työtilat in a crowded rail.**
  Round 3 said folding frees its room. Production's folded Hiljaiset shows
  its workspace pills, which in the crowded world (30 quiet, many
  workspaces) take about as much height as the rows did, and the rule keeps
  the conversations' minimum. Alternatives: count the pills outside the
  rule, or hide the pills in the adaptive rail. Left as the rule gives it.
- **The rail narrows instead of the conversation below ~1170 px windows.**
  Round 3 said the conversation narrows by 60 px there. The brief also asks
  the wider rail not to squeeze the conversation, so the width is a clamp
  between 296 and 356 px; under ~1110 px everything is as today.
- **Every row names its workspace, Hiljaiset's rows keeping their icon.**
  The prototype replaced Hiljaiset's icon with the name; round 3 asked for
  one treatment for all.
- **The status bell, where a page has no top bar, moves to the title row**
  (the Etusivu row it shared is gone).
- **Tiles are always one row of four**, also when the rail is narrower than
  356 px; the rule measures the tiles as drawn, so a wrapped label only
  costs height.
- **The places are a labelled group, not a toolbar**: a toolbar role
  promises arrow-key movement the row does not have.
- **result.md's "Missä askel vaihtuu" for little content is 28 px later
  than the round's own page computes** (895 / 951 and 871 / 951 px, which
  also give the table's tiles at 900 px); the tests use the page's values.
