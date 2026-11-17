# Result: background work in the rail's Open Habitat mark (round 1)

## Saatesanat

Kokeilin, voisiko rivin alun merkki kertoa myös sen, että keskustelun
taustalla pyörii prosessi. Kierroksella on nykytila ja kolme suuntaa
samoille kahdeksalle keskustelulle. Mukana ovat testipenkki, jota agentti
odottaa, jätetty esikatselupalvelin sekä lukemattomana että luettuna,
dev-palvelin käynnissä olevan vuoron aikana ja herättämätön `sleep 900`
Hiljaisissa. Suosittelen suuntaa **1 Lamppu**: pieni liikkumaton lamppu
merkin oikeassa alakulmassa. Se näyttää samalta joka tilassa, myös ilman
liikettä ja Kontrasti-teemassa, eikä se koske merkin muotoon, joka kertoo jo
tilan. Lampun kanssa pistettä rivin lopussa ei enää tarvita. Toinen löydös
on hostissa: herättämätön prosessi ei näy nyt siksi, että daemon jättää sen
kokonaan pois snapshotista. Mikään merkki ei siis auta ennen kuin host
kertoo myös näistä prosesseista.

Sivu: `node design-system/prototypes/rounds/2026-11-16-mark-background/build.mjs`
→ `design-system/prototypes/dist/mark-background/offline.html` (and
`index.html` without embedded fonts). Build, check and host needs are in the
round's `NOTES.md`.
The check (842 checks, clean console) writes its screenshots, including
4x crops of the marks per direction and theme (`marks-*.png`), outside the
tree; they are not committed.

## Axis and directions

Axis: how the mark says "a process of this conversation is running",
combined with the state the mark already shows (working, waiting for
background work, your turn, read, done/quiet).

- **Nyt (baseline).** The mark shows only the state. The 7 px dot at the
  row's end (`ah-nav-service`, title "Taustalla käynnissä: …") appears
  when a waking process started before the latest reply is still running.
  The read row (`vite --port 5174`) is told only by the dot. The running
  turn's dev server and the quiet row's `sleep 900` show nowhere.
- **1 Lamppu.** A small filled lamp (ink-2, not a state colour) just outside
  the ring's lower-right corner, on every row whose conversation has a
  process running. It never moves. The still frames put the door at the
  upper right (logo, your turn, read) or the lower left (working,
  background), so the lower right is free in every state and the lamp
  cannot be mistaken for the resident at a door. The end dot goes; its
  words stay in the row's description.
- **2 Vaeltava ovi.** The door travels slowly (production's `oh-drift`,
  6 s) in every state that does not already move, keeping the state's
  colour and resident. A done door is not shut but stands ajar. This
  extends the existing background state's language ("a drifting door means
  something runs in the background") instead of adding a new sign. Still
  (reduced motion), the door rests a quarter turn on, at the lower right,
  which is visible only on close look. The dot stays as the precise hint.
- **3 Takahuone.** A second room behind the habitat, offset to the lower
  right, drawn as its two visible edges. It is the largest sign and the
  easiest to see on a phone, but it changes the mark's silhouette and
  could be read as "several conversations" or a stack. The dot stays.

## Recommendation

**1 Lamppu, with the end dot removed.**

- It reads the same beside every state's colour and in every still frame.
  The door already belongs to the state (working turns it, your turn knocks
  at it, read stands in it, done shuts it), so a background sign on the
  door (2) competes with the state, and a new silhouette (3) competes with
  the mark itself.
- It survives reduced motion and forced colours unchanged (CanvasText with
  a Canvas halo). Direction 2 depends on motion: without it, it is a small
  door shift that does not show at 14–16 px.
- With the lamp, the end dot would be a second sign for the same fact in
  the same row. Its precise words ("Taustalla käynnissä: vite --port 5174")
  already are in the row's description, which the title and screen
  readers get.

Phone (no hover): the lamp's meaning is learned where the processes are
listed, in the conversation's background-work mark above the composer.
That mark should use the same lamp glyph and name the process, so tapping a
lamp-lit row teaches it once. This is a proposal for the implementation
issue, not drawn in this round, which shows only the rail.

## The issue's open questions

**Should the read mark also show background work, or is the hint enough?**
It should show in the mark, as the lamp. Jari said the dot is fine, but the
mark is the place the eye goes for the row's state, and the reported
failure ("the read mark looked exactly like a conversation with nothing
running") is about the mark. The dot can stay as the baseline until the
lamp is built.

**Should a non-waking background process show in the rail at all, and
where?** Yes, with the same lamp on the conversation's own row, wherever
the row is (Hiljaiset included), and without moving the row. The
conversation does not wait for the process, so it must not pull the row
into Käynnissä or Sinun vuorosi. That is where the earlier
`rail-open-moves-turn-to-running` decision belongs, and this round keeps
it. But the process runs on the server, and the person who decides
whether to stop it needs to see that it does. Waking and non-waking
processes get the same sign. The difference (whether the agent is woken
when it ends) is a detail of the process, said in the conversation's
process list, not a rail state. Käynnissä's empty text "Mikään ei ole
käynnissä" stays true about conversations. If a lamp is lit in Hiljaiset,
the wording could become "Mikään keskustelu ei ole käynnissä" in the
implementation.

This needs host data (round `NOTES.md`): the daemon's `inventoryWaiting`
drops processes with `wakes=false`, and the snapshot carries `waiting_on`
only while no turn runs and no question is pending. Both are inside the
daemon's existing per-user inventory query; no authority moves.

## Decisions for later review

- **Waking and non-waking processes share one sign.** Alternative: a
  hollow lamp for non-waking. Why: the person's question is "does
  something of this conversation still run here?", and a second variant at
  6 px would not be told apart.
- **The lamp is also lit when the conversation waits on the process (the
  background state).** Alternative: light it only for services the
  conversation does not wait on. Why: one rule ("lamp = a process runs") is
  easier to learn than "lamp = a process runs that the mark does not
  already tell you about". It is redundant with the drifting door only in
  that one state.
- **The lamp's colour is ink-2, not a state colour.** Why: it must read
  the same beside the turn, ok and accent colours, and it is not a call
  to act.
- **A running turn shows the lamp too** (the host would need `waiting_on`
  during a run). Alternative: hide it while working. Why: otherwise the
  lamp flickers off for every turn of a conversation that keeps a dev
  server.

## Questions for Jari

1. Lamppu with the end dot removed, or Lamppu and the dot both (the dot
   then only repeats what the lamp says)?
2. Is the lower-right lamp clear at 20 px, or should it be larger (8 px)
   at the cost of crowding the row's title?
3. Hiljaiset: a quiet row with a lit lamp stays in place. Is that enough,
   or should Hiljaiset's heading also count lit lamps (for example "2 ·
   1 käynnissä taustalla")?

# Implementation: 2 Vaeltava ovi (experimental)

Settings › Kokeelliset ominaisuudet › **Taustatyö merkissä**
(`rail-background-door`, off by default). With it on, the rail row's mark
gets a drifting door (`data-drift` on `HabitatMark`, production's `oh-drift`,
6 s) whenever a process of the conversation runs: a waited process, a service
left running behind an ended turn, or a process that does not wake the agent.
The state is kept (`agentMark` is unchanged; `markDrifts(state, running)`
adds the drift), so a read reply with `vite` behind it stays read and its
door drifts. A done door stands ajar. The end-of-row dot stays; Hiljaiset's
heading gets no count.

Host: the snapshot carries a new optional `non_waking_processes`
(`[{process_id, name}]`) beside `waiting_on`, from the same per-snapshot
inventory query (no new authority, no store). `waiting_on` keeps its meaning,
so archive gating, the background strip and the background state are
untouched. With the experiment on, the rail also names a non-waking process
in the row's description and dot ("Taustalla käynnissä: sleep 900"); the row
stays in Hiljaiset.

## Decisions for later review

- **Separate `non_waking_processes` rather than `wakes: false` in
  `waiting_on`.** Alternative: the round's first option, a flag on the
  waiting entry. Why: several consumers treat a non-empty `waiting_on` as
  "the agent waits" (archive refusal "wait for background work", the
  conversation's wait text, the background state); a separate list cannot
  change them by accident.
- **A process whose wake is unknown (`wakes_agent: null`) is in neither
  list.** Alternative: count it as non-waking. Why: it is today's rule for
  `waiting_on`; unknown should not claim anything.
- **No sign during a running turn or a pending question.** The host still
  reads processes only when no turn runs and no question waits. Working
  already moves its door, so the sign cannot flicker there; a pending
  question with a dev server behind it shows no drift. Alternative: read the
  inventory during turns too (one more socket call per snapshot per running
  conversation). Left for a follow-up if the question case matters.
- **States that keep their own ring:** working, background, awaited,
  stopping, loading, intro and **unknown**. The prototype's selector
  excluded only the first three (the others do not occur in its rows);
  unknown's dashed ring is the state itself, so drifting it would turn it
  into a solid ring and hide that the state is not known.
- **Reduced motion** follows the prototype: the door rests a quarter turn on
  (`stroke-dashoffset: -25`, the lower right), ajar for done. It is subtle at
  20 px, as the round noted; the dot stays as the precise hint.
- **The non-waking name in the row's description and dot is behind the
  experiment too**, so the shipped rail does not change until it is on.

Checks: `markState.test.tsx` (state × drift table, ring variant),
`railNow.test.ts` (flag on/off, read row, non-waking in Hiljaiset, stale),
Go `inventoryNonWaking`, lab `lab-rail-background-door.spec.ts` (drift per
state in light and dark, colours kept, read keeps drift, sleep ending shuts
the door, reduced motion, off by default; 3× green),
`settings-experimental.spec.ts` 3× green, `test-web-fast.sh`, contracts and
`./internal/daemon` focused checks.
