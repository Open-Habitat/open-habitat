# settings-three-pages @a11y split — result

The single @a11y case in `web/tests/settings-three-pages.spec.ts` signed in,
added a key, connected Gitea and then ran axe twelve times (three pages × two
themes × two viewports). It is now six cases, one per page and viewport, each
running both themes. Every case gets only the state its page shows: Tekoäly
adds the key (desktop keeps the add-key dialog screenshot), Koodipalvelut
connects Gitea, and Tiedot agenteille needs neither. The axe and
horizontal-fit checks and the full-page evidence screenshots are the same
twelve as before, with the same names.

## Timings on Birch (8 cores)

| Shape | Conditions | Per case |
| --- | --- | --- |
| Old single case | `--workers 1`, load ~9 | 31.2 s, timed out |
| Six cases | `--repeat-each 5 --workers 4`, load ~18–22 | median 5.5–8.7 s, max 15.7 s |
| Six cases | same plus four busy-loop CPU burners, load ~28 | median 10–16.7 s, max 22.5 s (Tekoäly) |

All 30 runs passed in both loaded runs. The whole browser suite
(`npm run test:browser`) passed on Birch: 398 passed, 3 skipped.

## Decisions for later review

- Split per page × viewport (six cases), not per viewport × theme (four).
  A first four-case split still took 24–28 s under the CPU burn, because
  sign-in plus the key and Gitea dialogs (about 7 s unloaded) was repeated in
  every case. Splitting per page also lets each case skip setup its page does
  not show. A twelve-case split would add six more host start-ups and sign-ins
  for a few seconds' gain per case.
- Tekoäly is audited without Gitea connected and Koodipalvelut without a
  key; neither page shows the other's state.
- No KOKEILTAVAA line: the change is in the test suite only and has no
  effect on the test server.
