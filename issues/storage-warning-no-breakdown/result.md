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

## Implementation — B1 as an experimental feature (14.11.2026)

Settings › Kokeelliset ominaisuudet › **Tallennustilan erittely**
(`storage-breakdown`, off by default). With it off, Storage is unchanged.
With it on, the usage card in Settings › Tallennustila is replaced by B1:
the warning from 85 % with *Pyydä agenttia siivoamaan…*, the bar with the
selection striped at its end, the after-tick and the 85 % line, *Nyt →
Valinnan jälkeen*, the verdict, the plain-language groups (caches and
finished work selected by default, own builds not, work in progress not
selectable), paths behind *Näytä tarkemmin*, and the Trash as its own row
pointing to production's Empty Trash below. The button opens a dialog with
the request built from the selection and a workspace choice; *Avaa
keskustelu* opens a new conversation in that workspace with the request in
its field, unsent.

Host: `GET/POST /api/v1/account/storage/breakdown`
(`contracts/v1/account-storage-breakdown.schema.json`), relayed by the
gateway like the account keys; the person's daemon
(`internal/daemon/storage_breakdown_linux.go`) measures its own home as
that person. It walks only a fixed list of places from a pinned home
descriptor (`openat2` beneath home, no symbolic links, no other
filesystems), counts allocated blocks with each hard-linked file once, and
keeps the latest result in memory. A read never waits: it returns the
previous result with `measuring: true` and starts a measurement when there
is none or it is over 15 minutes old; POST asks for one now (single-flight,
at most one start per 30 s). The walk runs on its own thread at nice 19 and
idle I/O priority, bounded to 3 minutes and 4 million entries; a bounded
walk reports `complete: false` and the view says the figures are lower
bounds. Build directories are a Cargo `target/` carrying Cargo's
CACHEDIR.TAG and a `node_modules/` beside a `package.json`, in a worktree
or `~/src` checkout or one level below it. A worktree's state comes from
the worktree listing's Taskfleet facts: a live run (or unreadable run
state, or a process blocker) is *live*, an ended run or a merged worktree
no run names is *finished*, anything else is *own*.

### Decisions for later review

- **No daemon-side 85 % trigger.** The NOTES proposed measuring when the
  quota crosses 85 %, but the quota is the broker's, read by the gateway;
  the daemon does not see it. The warning leads to Storage, whose read
  starts a measurement when the last is stale, so the outcome is the same
  without giving the daemon a quota read. Alternative: a gateway→daemon
  nudge, a new cross-component path for little gain.
- **Workspaces are `~/src`'s top-level folders**, read from the
  directory rather than from discovery, so `<name>__worktrees` folders
  appear as their own row (without their build directories). History is
  `~/.pi/agent/sessions` and `~/.pi/agent/file-history`. Neither group is
  shown as its own bar part in B1; they are inside "Projektit ja muut
  tiedostot", as in the prototype.
- **An unregistered linked worktree is never "own".** When scanning a
  `~/src` checkout one level down, a directory holding a `.git` file is
  skipped: its build directories belong to a worktree whose run state is
  known only through the registry.
- **Clean commands live in the browser** (`cleanCommand` by kind), not in
  the contract: they are request text for the agent, not host facts.
  Cargo registries and `node_modules` and other caches say "remove the
  directory".
- **The dialog keeps round 1's workspace choice**, defaulting to the
  workspace holding the largest build directories (the
  `<name>__worktrees` folder counts for `<name>`), and the request text is
  editable before opening. Opening uses the ordinary new-conversation path
  with the creation draft prefilled; nothing is sent.
- **The live group's checkbox carries its note as the disabled reason.**
  The prototype passed an empty reason, which production's `Checkbox`
  treats as enabled.
- **On a shared disk without user limits**, "your files" is the sum of
  what was measured (a lower bound), since there is no per-person figure.

Tests: `internal/daemon/storage_breakdown_linux_test.go` (synthetic home:
known caches, a `go env -w` GOMODCACHE, a CACHEDIR.TAG cache, an untagged
cache left out, a symlink out of the home not followed, a hard link counted
once, live/finished/hand-made worktrees from a fake Taskfleet, unreadable
run state never shown finished; the handler never waits, measures once,
re-measures when stale, rejects other bodies, and its replies validate
against the contract), gateway relay tests, contract fixtures and negative
checks, `web/src/app/StorageBreakdown.test.tsx`, and
`web/tests/storage-breakdown.spec.ts` (real daemon endpoint through the
gateway, then the B1 flow to the prepared conversation).

Live check: on the test server, Asetukset › Kokeelliset ominaisuudet ›
Tallennustilan erittely → Päällä; then Asetukset › Tallennustila shows
"Tilaa mitataan ensimmäistä kertaa" and within a minute the groups with
sizes. Untick a group and watch the striped part and the after number
move; open "Näytä tarkemmin"; press "Pyydä agenttia siivoamaan valitut…",
pick a workspace and "Avaa keskustelu": the request waits unsent in the
new conversation's field.
