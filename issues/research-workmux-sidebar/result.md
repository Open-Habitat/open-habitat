# Result: workmux sidebar research and two prototype rounds

## Research

[report.md](report.md) covers how raine/workmux builds its sidebar (commit
`23c09d88`, installed binary 0.1.277 on Birch), compares it with Habitat's
rail and the Workers panel, and ranks ten ideas. The short version:

- workmux's sidebar is a render-only client in every tmux window. One
  daemon feeds those clients: it polls tmux every 2 s or on a signal, and
  publishes a snapshot that already decides order, grouping, staleness and
  folds. Status comes from agent hooks. For Pi this is an extension that
  reports `working` and `done`; Pi has no waiting state there. A per-pane
  JSON file under `~/.local/state/workmux/agents` keeps the status. "Done"
  clears when the pane gains focus, and that acknowledgement is held in
  the tmux server, so every view agrees. A working agent whose screen
  stops changing for 10 s is marked interrupted.
- Habitat already has the part that matters most: Sinun vuorosi and
  Käynnissä match workmux's "priority" order. Habitat lacks four things
  workmux has. It has no time on rows, because the host publishes no
  last-change time. A long Käynnissä has no structure. There is no quick
  route to the next waiting conversation. "New reply" is tab-local, so it
  is lost on reload and differs between phone and desktop.

## Prototypes

Both rounds use the same synthetic evening (`prototypes/shared/frame.js`):
a conductor in `kasvimaa` with eight workers, three conversations in
Sinun vuorosi, and 16 live in all. Every row shows the time since its last
change. Both rounds are hand-written single offline files. Run
`node prototypes/shared/build.mjs <round>` to inline the tokens, fonts and
the verbatim picker. No production components are used. Each `check.mjs`
checks all three directions at 1440 and 390 px, in light and dark, at device
scale factor 2, with the interactions clicked, no console errors and no
network. Screenshots are in each round's `evidence/`.

### Round 1: Käynnissä grouped

Entry: `issues/research-workmux-sidebar/prototypes/kaynnissa-ryhmat/index.html`.
Guide: [NOTES.md](prototypes/kaynnissa-ryhmat/NOTES.md).
The axis is where live rows are grouped.

1. **Ryhmät.** Inside Käynnissä there is a sticky header per workspace with
   its count, and the workspace leaves the row's second line. Rows quiet
   for over an hour fold per group. Workspaces where everything is quiet
   sink under a *Hiljaiset* rule as one row each.
2. **Kooste.** Conversations stay as rows. A workspace's workers become
   one row (*8 workeria · 6 työskentelee · 2 odottaa viestiä*) that opens
   in place.
3. **Työtiloissa.** There is no Käynnissä section. Live rows sit under
   their workspace in the alphabetical list, and quiet rows fold.

The same in all three: the current conversation never folds away, and
*↓ N lisää* counts the rows below the fold and scrolls to them.

### Round 2: the next conversation that needs you

Entry: `issues/research-workmux-sidebar/prototypes/seuraava/index.html`.
Guide: [NOTES.md](prototypes/seuraava/NOTES.md).
The axis is where the route to the next one lives.

1. **Yläpalkki.** A *Seuraava* button in the top bar, with the count of the
   others.
2. **Sirut.** A strip of chips under the top bar: Sinun vuorosi first,
   then Käynnissä. On desktop they are numbered for Alt+1…9. On the phone
   it scrolls sideways, so switching needs no drawer.
3. **Lopussa.** A card at the end of the conversation names the next one,
   with an excerpt, and opens it.

The same in all three: Alt+↓ walks Sinun vuorosi most recent first,
skipping the ones visited in this walk, like `workmux last-done`. Alt+↑
steps back.

## Recommendation

- **Round 1: Ryhmät.** It keeps every decided rule: a worker is its own
  row, Käynnissä stays, and the workspace list stays alphabetical. With ten
  workers, the rail again shows "what is going on now" in one look. It is
  also the shape workmux has refined, with stable groups, folds and a
  dormant rule. Kooste hides workers. Työtiloissa merges two lists and is
  a larger change to the rail's rules than the problem needs.
- **Round 2: Lopussa, with Alt+↓/Alt+↑ everywhere.** The route appears
  where the reading stops, adds no permanent chrome, and works the same on
  the phone. Sirut duplicates the rail on desktop. It would be the better
  phone answer only if the drawer proves too slow in practice.
- **Before either is implemented**, the host needs the time of each
  conversation's last change in the snapshot (idea 2). Both rounds show it
  on every row, Ryhmät's quiet fold depends on it, and so does Lopussa's
  most-recent-first order. That is the first implementation step whichever
  directions Jari picks.

## Host facts the prototypes assume

- `activity_since` (or similar) per agent: when its activity state last
  changed. A native source exists: the timestamp of the last entry in the
  Pi session file. The daemon's own observation would not survive a
  restart. Today `railNow.ts` says "the host knows no last-activity time",
  and `AgentNavModel.relativeTime` exists but is never filled.
- Everything else is in the snapshot today: `workspace_id`, activity,
  `pending_question`, `waiting_on` and `spinoffs_working`. Telling a worker's
  own row apart uses whatever distinction the rail draws today.
- Folds and the walk's visited list are view state in the tab and are not
  kept anywhere.

## Decisions for later review

- **"Quiet" means waiting for a message for over an hour.** Alternatives:
  workmux's `stale_after`, which is configurable with a 1 h default, or
  including *Odottaa taustatyötä*. I chose waiting-for-a-message only,
  because background work is running work, and one hour because it matches
  workmux and a stint's rhythm.
- **The walk order is most recent change first.** The alternative is the
  rail's own order. Most-recent-first is what `last-done` does, and it
  answers "what just happened". It needs the host fact above. Without that
  fact, the rail order is the fallback.
- **Alt+↓ and Alt+↑ as the shortcut.** Alternatives: workmux's Alt+j/k, or
  a Ctrl chord. I chose arrows because they explain themselves to a
  non-terminal user. The cost is that macOS Option+↓ in the composer stops
  moving the cursor to the end of the paragraph.
- **Folds are not persisted.** The alternative is browser-local storage.
  Not persisting keeps the rail truthful on every load, which suits "no
  parallel stores", and a fold costs one click.
- **Cross-device "seen" is not prototyped.** It is the most valuable idea
  that is not about layout (report idea 4). It needs a new per-user record
  of when each conversation was last viewed, kept by the daemon as the
  user. Pi has no read marker, so there is no native one. This is a "new
  store" decision for Jari, though it does not change any security or
  authority boundary. It is proposed as its own issue rather than decided
  here.
- **Workmux's status files are not read** (report idea 10). They are a
  private format, and the Taskfleet workers they would cover are already
  observed as spinoffs.

## Questions for Jari

The per-round questions are at the end of each NOTES.md. The main ones:

1. Which direction in each round? The recommendation is Ryhmät and Lopussa.
2. Is the host time fact worth adding now? Both rounds rely on it.
3. Should cross-device "seen" go ahead as its own decision issue?
