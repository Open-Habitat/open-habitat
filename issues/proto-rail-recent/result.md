# Result: recent inactive conversations in the rail

Prototype: `prototypes/raide.html`, one hand-written offline page built from
`prototypes/page.src.html` by `python3 prototypes/build.py`, which inlines
the design-system tokens and fonts. The picker offers Pilot.17 · Nykyinen ·
1 · Vuorokausi · 2 · Viisi viimeisintä · 3 · Omat käynnit. Each view has
light and dark themes, desktop and phone, and workspace icons on or off.
Jari's guide in Finnish is `prototypes/NOTES.md`. Screenshots (device scale
factor 2, AVIF) are in `prototypes/kuvat/`. The page and graph code follow
`proto-next-waiting-states`.

The graph shows one conversation's states. The picker chooses the target
conversation, and events act on it or on the whole host: agent starts,
finishes or asks; Pi's 10-minute idle stop; archive; daemon restart; time
passes (+10 min, +1 h, +1 day, +3 days, and idle Pis stop on their own);
reload; open from the rail or from a workspace page. *Jarin tilanne 31.10.*
replays the pilot.17 situation in every view.

## Current behaviour

Read from `web/src/app/railNow.ts`, `web/src/components/Navigation.tsx`
(`RunningGroups`, `quiet`, `ballOf`), `web/src/app/conversationStore.ts`
(attention), `internal/daemon/snapshot_linux.go`, `rest_linux.go` and
`history_linux.go`.

**Pilot.17 (what Jari saw).** This was before `rail-running-after-done`.
Käynnissä listed every conversation whose Pi was alive, finished ones
included. A finished row unchanged for an hour folded into its workspace,
and a workspace whose rows were all quiet sank under *Hiljaiset · yli
tunnin* as one fold. Pi stops after ten idle minutes, so a finished
conversation normally left the rail within ten minutes. Only something that
stayed in the list for over an hour could reach the fold. After the
pilot.17 upgrade, the deutschpad conversation, whose turn the restart had cut, was
kept and shown as a done row (green ball). An hour later it was
`› d deutschpad 1` under Hiljaiset, and it was the only thing in the rail.
Why it alone stayed is `rail-interrupted-turn-hidden`'s question. The
prototype reproduces the observation and does not model that cause.

**Main 31.10. (`da181016`).** Sinun vuorosi holds an unread reply or a
question while Pi runs. Käynnissä holds work going on (working, waiting on
background work, the conversation's own worker) and failures (turn error,
failed worker, `rest.cause: crash`). With icons on, Hiljaiset rows stand
flat under the rule (`rail-icons-no-grouping`). Gaps:

1. **A finished conversation leaves the rail at once.** This happens even
   while the person is looking at it. An hour later it is reachable only
   through its workspace's page.
2. **An unread reply exists only in tab memory.** `attention: new` comes
   from a `turn.settled` event while the tab does not show the
   conversation. A reload or another device does not have it, so the reply
   leaves the rail unread.
3. **A turn cut by a restart disappears completely.** Only
   `rest.cause: crash` is kept in sight, and after an upgrade the cause is
   `restart`. In Jari's situation, main would show an empty rail.
4. **Hiljaiset · yli tunnin is nearly empty.** On main a done ball stays in
   Käynnissä only for a worker waiting at its own prompt
   (`spinoffs_idle`), so the rule no longer covers what it was made for.

## Axis and directions

Common to all three directions:

- Sinun vuorosi stays as on main.
- Käynnissä adds a cut turn as ◆ *Keskeytyi* until the person continues.
  This is `rail-interrupted-turn-hidden`'s acceptance, assumed here.
- A third section below Käynnissä lists finished conversations. Hiljaiset
  and its folds go away.
- Pi's own life (idle stop, restart) never moves a row. The section is
  about the work, not the process.
- Archived conversations and finished Taskfleet worker conversations are
  never listed.
- The open conversation always shows, even when the rule would leave it
  out (italic).
- With icons on, rows are flat with their icons. Without icons, rows are
  grouped by workspace, as Käynnissä is now, and groups are ordered by
  their newest row.

The axis: **what makes a conversation recent.**

| | Direction | Rule | What it decides | Cost |
|---|---|---|---|---|
| 1 | **Vuorokausi** | changed within 24 h (`changed_at`), newest first, no cap | the section tells what happened today | empty after a weekend (Jari's complaint with a longer delay); long on a busy day |
| 2 | **Viisi viimeisintä** | the five most recently changed, any age, newest first | the section always holds the last five, so a restart, idle stop or break never empties it | five newer finishes in an hour push out the one you were just in; a terminal-run conversation takes a place too |
| 3 | **Omat käynnit** | the five you opened or wrote to last in this browser, by visit | the section follows the person, not the agents | a conversation never opened in this browser (terminal, worker, other device) is missing; phone and desktop differ; needs a new store |

## Host facts each direction needs

| Fact | Where | Exists? | Used by |
|---|---|---|---|
| Every native Pi conversation in a visible workspace or worktree place, including terminal-run ones | snapshot `agents[]` (`snapshot_linux.go`) | **yes** | all |
| Last change | snapshot `changed_at` = session file mtime (`history_linux.go`) | **yes**. Any write moves it, including Habitat's automatic recap written into native history a few minutes after the turn | 1, 2 |
| Archive | snapshot `archive` | **yes** | all |
| Pi stopped and why | snapshot `rest {cause, at, awake}`, only for browser-resumable conversations | **yes**. The directions need it only for the row's tooltip, because rest moves nothing | (text) |
| Worker conversation, merged | `worktree_id` + workspace `worktrees[].git_summary` (`worktreeMerged`) | **yes** | all (exclusion) |
| Turn cut by restart | rest report `interrupted_turn` (`GET /conversations/<id>/rest`). Not in the snapshot or status (`interrupted: false`) | **partly**. `rail-interrupted-turn-hidden` brings it to the rail | all (Käynnissä) |
| Unread reply | tab memory (`conversationStore.attention`) | **tab only**, lost on reload or another device | Sinun vuorosi, today and in all directions |
| The person's visits | none | **no**. It would be a new store: per-browser `localStorage`, or a host store beside native history (against the "no parallel store" rule) | 3 |

Directions 1 and 2 need nothing new from the host. Direction 3 needs a
store that does not exist.

## Recommendation

**2 · Viisi viimeisintä.** It answers Jari's complaint directly: after a
restart, an upgrade, an idle stop or a weekend, the conversations he was
working on are still one click away. It uses only facts the snapshot
already carries (`changed_at`, `archive`, worker merge), so it adds no
store and no second truth about his work. Its height is fixed, so it does
not push Työtilat down on a busy day the way the time window does. The cost (five
finishes in an hour push one out) is mild, because workers are excluded.
The pushed-out conversation is also no worse off than it is on main today.
Direction 1 recreates the empty rail after any break of more than a day.
Direction 3 follows the person, which is appealing, but it loses terminal
and other-device work and needs a new store, which the project avoids
unless there is a concrete need.

Implementing it on main means:

- `railNow` returns a third list, `recent`: the candidates not in yours or
  running, not archived and not worker conversations, sorted by `changed_at`
  and cut to five, plus the selected conversation.
- `NowSections` renders it under Käynnissä.
- `RunningGroups` loses the quiet folds and the Hiljaiset rule.

## Questions for Jari

- Five, or more (for example eight)? The prototype uses five.
- A terminal-run conversation is listed like a browser one, since it is
  his work. Is that wanted?
- Finished worker conversations are never listed (their parent reports
  them). Should an unmerged, finished worker appear?
- The narrow rail beside the editor (the dot strip) shows Sinun vuorosi and
  Käynnissä. Should recent rows appear there too? The prototype leaves them
  out.
- The section name: *Viimeisimmät*?

## Main as of this merge

The page's *Nykyinen* is main at `da181016`, which includes
`rail-running-after-done` and `rail-icons-no-grouping` (icons on: Hiljaiset
rows flat under the rule). `rail-interrupted-turn-hidden` had not landed
when this round finished, so main still drops a cut turn (gap 3). The
directions assume its acceptance.
