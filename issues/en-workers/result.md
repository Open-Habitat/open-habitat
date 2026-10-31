# Result: English for workers, processes and terminals

## What landed

Every listed module reads its text from its own catalog in `web/src/text/`:
`backgroundStrip`, `spinoffs` (the worker view), `spinoffState`
(`app/spinoffs.ts`), `processTray`, `processes`, `workerRequests`,
`workSentence`, `workerTerminal`, `terminalPanel`, `terminals`, `operations`,
`restartNotice`, `nextWaitingQueue` and `nextWaitingRow`. Times in these views
go through `formatDate` (they were fixed to `fi-FI`), and English plurals
through `plural()`. Product terms follow the existing catalogs: worker,
worktree, workspace, conversation, main agent, "work kept", "merged".

Evidence:

- `web/tests/worker-panel.spec.ts`, case "in English": an `en-GB` browser
  with the server default System sees the workers panel, the processes tab,
  a process window, an ended worker's view and the terminal dock without a
  Finnish letter in their text, accessible names or tooltips (fixture titles
  are ASCII). It found "Pääte bash" on the terminal surface, which is
  `app/BrowserShell.tsx` (en-shell-editor's), so the dock check leaves the
  surface out.
- `workerRequests.test.ts`: a request written in English is still
  recognised by a Finnish interface (and the reverse by construction).
- Screenshots at device scale factor 2 in `evidence/`: the five views above
  from the spec (`OH_EN_WORKERS_CAPTURE=<dir>`), and from Storybook in English
  the rest card, the next-waiting round and offer, the terminal dock's empty,
  paste and Taskfleet states, a worker view before its history and operation
  progress (`web/lab/en-workers-story-shots.mjs`). Story data (titles,
  summaries) stays Finnish as the stories give it.
- Finnish runs of ended-worker-ask, process-tray, rest-card,
  worker-row-sentence, next-waiting-row, spinoffs, worker-view,
  browser-shell and worker-panel pass; web focused checks pass.

## Finnish that is not this unit's

- `app/BrowserShell.tsx`: the terminal surface's label "Pääte bash (vain
  luku)" (en-shell-editor).
- `app/NextWaitingDock.tsx` and `app/nextWaiting.ts`: the step details
  ("uusi vastaus", "kysyy") and the round's closing note ("Kierros käyty")
  come in as props from there.
- Messages that arrive from the host as text: a process event's `summary`, a
  run's `summary`, the gateway refusal passed to the rest card as `refusal`,
  and the GitHub note `spinoffs.workNote.text` (built in
  `app/SpinoffConversation.tsx`).
- `web/lab/session.mjs` was only reformatted (biome failed on main).

## Decisions for later review

- **The worker request is sent in the interface language.** An English
  person's "Tell the agent" sends an English message to their agent, since it
  is their own message. Alternative: always Finnish, which an English
  speaker could not read in their own history. The run marker differs
  ("Taskfleet-ajo X" / "Taskfleet run X"), so a request is recognised by
  either marker; a language switch mid-request keeps the row's phase.
- **Taskfleet's state words keep the Git terms.** "Merged", "not merged",
  "landed", "work kept"; "mergetty" was already Finnish for the same.
- **"Käsittele" is "Handle"** and "Kerro agentille" is "Tell the agent".
  "Look at" opens the request text itself, which reads better to the agent
  than "Handle the worker".
- **The round's last button says "Back"** (Lähtöön) and its title "Back to
  where you started"; the compact counter's origin is "Start".
- **A rest card's times keep syncedTime's "at"**: "Pi stopped at 14:05",
  "The agent rested at 14:05–14:30"; "running since 14:05" drops it.
