# Result: prototype round 1

Prototype: `prototypes/worker-panel/index.html` (one offline file, three
directions behind the picker). [NOTES.md](prototypes/worker-panel/NOTES.md)
is Jari's guide in Finnish, and `prototypes/worker-panel/evidence/` holds the
screenshots (device scale factor 2).

The starting point is today's production panel without the
"odotetaan / ei odotusta: agentti ei herää…" legend, with the Pisteet pill
unchanged. Production places the pill above the composer, not in the top bar
as the issue text says, so the prototype keeps it there.

## Axis and directions

The axis is **where a row's details and the meaning of the wait live**.
Content is the same in all three: seven workers in conversation
*Iltakierros* (repository `kasvimaa`). Two are waited on, and one of those is
in another repository (`kirjasto`). One Claude worker is not waited on, and
one Pi worker waits on its parent. Of the ended ones, one landed, one is
preserved without a merge and one failed.

1. **Rivi**: two-line rows. Line 1 has the name and the time. Line 2 has the
   state in words ("agentti odottaa", "agentti ei odota", "laskeutui",
   "ei mergetty · työ tallessa", "epäonnistui"), the harness and profile, and
   the other repository's name. Stop-wait sits on the row.
2. **Ryhmät**: the legend becomes group headings, each with one line of
   meaning: *Agentti odottaa*, *Ei odotusta*, *Odottaa pääagenttia* and
   *Työ tallessa, ei mergetty*, followed by the folded ended runs. Rows are
   one line: name, other repository, Pi/Claude, time, stop-wait. A row whose
   wait is stopped moves to *Ei odotusta*.
3. **Avattava**: compact rows (mark, name, other repository, time) with a
   disclosure. The details hold the state as a full sentence, harness and
   profile, repository, branch, start and end, the report summary,
   Lopeta odotus and Avaa workerin näkymä.

In every direction, the row's name opens the worker's own view: a simplified
Kehys with the back link to the parent, state, harness, repository, the
Keskustelu/Pääte tabs and the "Workerille ei kirjoiteta suoraan" notice. A
Claude worker opens on Pääte, as decided in proto-worker-view round 2.

## Host facts

| Fact | Exists? | Needed by |
| --- | --- | --- |
| State, preserved, summary, branch, `created_at` | Yes, in the spinoffs contract | all |
| Waited on (wait joined to the run, `wakes_agent`) | Yes | all |
| Harness (Pi/Claude) | Taskfleet `run list` `harness`; the daemon parses it but the contract does not carry it | all |
| Profile | Taskfleet `run show` `manifest.selection.profile`; not in the contract | 1, 3 |
| Repository | Taskfleet `source_repo`; the daemon parses it but the contract does not carry it | all (shown only when it differs from the conversation's) |
| Failed vs preserved | Taskfleet has `status: failed`. The daemon folds `done`, `failed` and `cancelled` into `unmerged`, so the contract cannot tell a failed worker from one whose merge stopped | all |
| End time | Approximately in Taskfleet (`manifest.updated_at` of an ended run); not in the contract | all |
| Worker's own view | Being implemented (`worker-view-conversation`) | all |

None of the missing facts needs a new authority. All of them are Taskfleet
facts that the daemon already reads as the user. The implementation adds
`harness`, `repository`, `ended_at` and a `failed` state (or outcome) to
`contracts/v1/spinoffs.schema.json`, plus `profile` if 1 or 3 is chosen.

## Recommendation

**Ryhmät (2).** Jari's objection was that the explanation sat in the wrong
place. Ryhmät keeps the explanation and puts it where it applies: once, as
the heading of the rows it describes. The rows stay one line as in
production. The grouping also does
something the others do not. A preserved run that needs the person rises
above the fold as its own group instead of hiding under "3 päättynyttä"
behind a red dot. Stopping a wait moves the row to *Ei odotusta*, which is
the change of meaning made visible rather than a side effect.

The cost is height. With this data the panel body is 469 px on a phone,
against 253 px for Rivi and 207 px for Avattava. The headings and their
lines of meaning take the space, along with the preserved row that the
others fold away. That still fits under the panel's 70 vh cap at 390 × 844,
but with more workers Ryhmät scrolls first. If that matters more than the
lifted preserved group, Rivi is the choice.

Rivi is the safest. It is closest to production and needs no learning, but
it repeats "agentti odottaa / ei odota" on every row and makes each row
about one and a half times as tall. Avattava is the only one with room for
the report and branch. It hides the meaning of ◉/○ behind a click, which is the
legend problem again in a different form. Its details block could be added
to Ryhmät later if the report turns out to be wanted in the panel rather
than in the worker view.

**Questions for Jari:**

- Ryhmät, or do the per-row words of Rivi read better?
- Should a preserved run lift out of the ended runs as its own group (2), or
  stay folded with the red dot (1, 3)?
- Is the profile worth showing, or is Pi/Claude enough?

## Verification

```sh
node issues/proto-worker-panel/prototypes/worker-panel/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-worker-panel/prototypes/worker-panel/check.mjs
```

`check.mjs` passed 12 cases: 3 directions at 1440 and 390 px, each in light
and dark, at device scale factor 2. For each case it checked:

- the closed pill's marks and attention dot;
- that the panel has no legend;
- that the wait's meaning is readable from the row, the heading or the
  details;
- that the other repository is named;
- Avattava's details;
- the ended rows;
- stop-wait, including the row moving between groups in Ryhmät;
- that a row opens the worker view (Claude on Pääte, no composer) and that
  back returns focus to the pill;
- that Escape closes the panel and returns focus;
- the ended-only scene;
- no horizontal overflow, the shared picker check, no console errors and no
  network requests.

Self-review of the screenshots fixed the worker view's terminal text and a
repeated "Claude · claude" profile. No production code changed.
