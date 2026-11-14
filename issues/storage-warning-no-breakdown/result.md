# Result: prototype round 1 — Storage breakdown and clean-up

Round `design-system/prototypes/rounds/2026-11-14-storage-breakdown/`. Its
`NOTES.md` covers the build, the check, what the host would need, and the
recommendation on where the Go build cache should live.

**Axis:** how the breakdown leads to clean-up. All three directions show the
same things: the warning at the top of Storage from 85 %; the known caches
(Go build, Go modules, npm, Cargo registry, Playwright, uv, pip); worktree
build directories, split into running worker, finished and main checkout;
the Trash, workspaces and agent history; and *Ask an agent to clean up…*,
which opens a new conversation (a labelled stand-in) with the request in the
field, unsent.

- **A Pylväs (bar):** production's usage bar is split into coloured groups.
  Each group opens to its items. The button sits at the bottom of the card.
- **B Vapautettavissa (freeable):** a checklist of what can be removed comes
  first, with its total. Running workers' directories are listed but
  disabled. The request carries exactly the selection. The other usage sits
  in a compact bar below.
- **C Kansioittain (by folder):** one folder table sorted by size, each row
  tagged with its kind. The button sits above the table.

**Recommendation: B.** The warning's question is "what can I free". B
answers it with a number on its first line, and the request carries what
the person saw and chose.

## Decisions for later review

- **Clean-up is done by the agent, not by a daemon delete action.** The
  alternative was a "Clean" button per cache. That would give the daemon a
  new destructive operation over arbitrary home paths. The agent route reuses
  the existing authority, and the person sees what was run.
- **Where the conversation opens:** the person chooses a workspace in the
  dialog (default: the one holding the largest build directories). A
  conversation needs a workspace, and there is no home-directory workspace.
  Alternative: a dedicated home workspace, which would be a new concept.
- **Main-checkout build directories are not freeable by default.** The
  person may be building there. B lets them tick one; A and C leave it out
  of the request.
- **The request includes each tool's own clean command** (`go clean -cache`,
  `npm cache clean --force`, …) rather than "remove". Go's module cache is
  read-only, so `rm` fails on it, and tool commands respect locks.
- **Measuring:** the result is held in daemon memory and re-measured when
  Storage opens with a result over 15 min old, when usage crosses 85 %, or
  on request. Nothing runs on a schedule. The view always shows when the
  breakdown was measured.
- **Go build cache placement:** one per-user `GOCACHE` in its default home
  location, shared by all runs and counted in the quota. Not per run and not
  in `/var/tmp` scratch. The reasoning is in `NOTES.md`. This differs from
  the issue's remark that build scratch belongs in a disposable location: a
  cache is valuable because it is reused, and outside the home it would
  escape the quota.
- In dark theme the cache and running-worker colours are both green. The
  tag text keeps them apart, but the implementation should pick a clearer
  pair of tokens.

## Questions for Jari

- Which direction (recommendation B)?
- Is the agent-only clean-up right, or do you want a direct "empty this
  cache" button for the safest entries (Go build cache, npm)?

## Round 2 — variations of B (14.11.2026)

Round `design-system/prototypes/rounds/2026-11-14-storage-breakdown-2/`
(its `NOTES.md` has the build and check). Jari chose B and asked for
plain-language groups with folders and paths behind "Näytä tarkemmin", and
a bar that shows what the selection frees against the limit and the 85 %
warning line. **Axis:** how the bar and the checklist combine.

- **B1 Esikatselu (preview):** one large bar above an ordinary checklist;
  the selected part is striped at the end of the bar, a tick marks where
  usage lands, and "Nyt → Valinnan jälkeen" sits above it.
- **B2 Palkkivalinta (bar picks):** the bar's parts are the toggles; a key
  without checkboxes below. Small parts are enlarged to stay tappable, so
  the bar is no longer to scale; on a phone the parts show only a rounded
  size.
- **B3 Ennen ja jälkeen (before/after):** a compact summary with two thin
  bars, Now and After clean-up, that stays at the top while the list
  scrolls.

All three show a verdict line ("below the warning line after the
selection" / "still over"); on a shared disk the person's own 40 GiB
barely moves the bar, which is the honest picture.

**Recommendation: B1.** One bar shows in one picture what is used, what the
selection frees and where the limit and warning line are, and the plain
checklist works on a phone. B2's enlarged parts break the scale and bar
tapping is unfamiliar; B3's comparison takes twice the room for the same
information.

### Decisions for later review (round 2)

- **Plain group names:** "Ohjelmointityökalujen välimuistit", "Valmiiden
  töiden jäljet", "Omien projektien käännöstiedostot", "Agentin käynnissä
  olevat työt". Worker, worktree and target appear only inside Show
  details and in the request. Alternative: round 1's technical names.
- **Selection is per group on the default view, per folder inside
  details.** A partly selected group shows "valittu x / y"; ticking it
  selects all. Production's `Checkbox` has no indeterminate state; adding
  one is left to implementation.
- **Trash is not part of the selection.** It stays a row linking to
  production's Empty Trash below, because emptying is an existing direct
  action and the agent request explicitly leaves the Trash alone.
  Alternative: include it in the preview as a selectable part.
- **The warning's button sends the current selection** (default: caches
  and finished work), not every freeable item.
- **Colours:** work in progress uses `--ah-source-1`, because accent and
  ok are both green in dark theme (round 1's note); the chosen part is
  striped so it reads without colour.

### Questions for Jari

- B1, B2 or B3 (recommendation B1)?
- Should the Trash be selectable in the preview, or stay a separate
  production action?

Live check: none. This is a prototype round, nothing is on the test server. Open round 2's `offline.html` from the worker results, pick B1 in "Yli 85 %": untick a group and watch the striped part and the after number move against the 85 % line, then open "Näytä tarkemmin".
