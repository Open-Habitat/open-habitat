# Why browser actions feel slow, and what to change

Research for [ui-responsiveness-review](item.md), 2026-10-16. Product tree
`e9bec7d5`; the live server ran pilot.180 (`91993325`) with the same web and
host code. This report merges two independent passes over the same question:

- this worker's synthetic-lab click timings, action map, options and route probes
- a parallel session's live daemon measurements (commit `5f8a86c9`, marked
  *[live, 5f8a86c9]* below), made with `curl` on the mapped user's daemon
  socket and an `strace -e execve` of the daemon, without reading
  conversation content

No product code was changed.

## Summary

- **Two costs add up on every click, and both come from the same design.**
  After a write, the browser rereads the whole application state, and only
  that reread changes the screen.
  - **The request shape:** four sequential round trips (write →
    `/auth/session` → `/api/v1/snapshot` → `/auth/session` again). That is
    ~0.2 s each on the live route, so ~0.8 s before any server work. In the
    lab the time grows exactly with latency: 110 / 466 / 881 ms at 0 / 100 /
    200 ms.
  - **The snapshot itself:** it rebuilds everything from scratch, about 30
    child processes including `gh api user` over the network, and takes
    **1.1–1.3 s live, 2.4 s when two overlap** *[live, 5f8a86c9]*. Events
    also turn Pi file writes into full snapshots, several a second during a
    turn, so a click's snapshot often queues behind another one.

  Hiding a workspace live therefore costs about 2–3 s.
- **The code already shows what the fix does.** Archiving a conversation from
  a home card hides the card at once with a local "pending" mask and lets the
  host confirm afterwards. It takes **24–36 ms at any latency**. Workspace
  hide, restore and rename, settings saves and the other workspace actions do
  not use this pattern. Each feature writes its own busy flag and its own
  refresh, so every new feature starts out slow.
- **Recommendation:** route every mutation through one shared mutation layer.
  For actions that are reversible and almost always succeed (hide/restore,
  archive/restore, rename, default model), show the intended result at once
  as *pending*, and roll it back with a clear message if the host refuses.
  Make each mutation response carry the changed resource, so confirmation
  needs no snapshot refetch. Have the daemon announce workspace changes on
  the existing event stream. Keep sends, creation, stop, credentials and
  anything destructive server-confirmed, but give them immediate pending
  feedback, as the accepted "Kupla odottaa" design does for sends.
- **Quick wins that don't need a decision:**
  - make the snapshot cheap. Stop calling GitHub on every snapshot, keep git
    facts until their inputs change, and run the parts concurrently. The
    target is <100 ms *[live, 5f8a86c9]*.
  - take the two `/auth/session` reads off the refresh critical path
    (−2 round trips, about −0.4 s live).
  - stop running the Node/Pi model catalog helper (≥0.4 s per call) on every
    workspace-page navigation.
- **Decision for Jari (ADR):** for reversible, high-success actions, may the
  browser *present* a pending result before the host confirms? It would be a
  disposable overlay keyed by a client command ID, never a second store of
  truth.

## How each action reaches the screen

The common machinery: `refresh()` (`web/src/app/App.tsx:258`) only bumps a key.
The effect at `App.tsx:415-560` then runs in sequence:

1. `GET /auth/session` (`App.tsx:447`)
2. `GET /api/v1/onboarding/pi/status`, first load only
3. `GET /api/v1/snapshot` (`App.tsx:501`)
4. `GET /auth/session` again (`stillBound`, `App.tsx:471`, `:522`), and only
   then `dispatch(authenticated(next))`, which is the first moment the UI changes
5. `GET /api/v1/conversations` (`App.tsx:529`), after the render

On the daemon, a snapshot (`internal/daemon/snapshot_linux.go:77-370`) does a
full native observation:

- workspace discovery (`:99`)
- `taskfleet run list` as a subprocess (`:128`)
- git remote classification with up to 2 s budget (`:134`)
- `git status --untracked-files=all` for every git workspace with up to 1.5 s
  budget (`:207`, `workspace_git_linux.go:18`)
- a header read of every Pi session file (`:219`, `history_linux.go:107`)
- a `/proc` census (`:225`)
- an RPC inventory of each idle controlled Pi with up to 600 ms budget (`:255`,
  `processes_linux.go:358`)

Through `nativeStatus` it also runs `gh auth status` and then `gh api user`
(`internal/nativegh/native.go:194-201`), which is a GitHub network round trip.
Live, one snapshot spawned about 30 processes and took **1.14–1.30 s warm,
2.41 s while another was in flight**. The GitHub call was ~1.0 s of that, and
the git work ~0.5 s for five workspaces *[live, 5f8a86c9]*. An older build
measured 3.2–3.7 s under load
([architecture-built-on-caution review](../architecture-built-on-caution/review-2026-10.md),
row G11).

| Action | Click → request | Daemon work on the request path | How the UI learns the result | What blocks |
|---|---|---|---|---|
| Workspace hide / undo ("Piilota sivupalkista", "Kumoa") | `WorkspacePage.tsx:114` `mutate` → `POST /api/v1/workspaces` `visibility` | Global `cloneWriter.TryLock`, full `Discover` to resolve the ID and observation token, rewrite the visibility file (`workspace_manage_linux.go:222,279,336`) | `refresh()` → the 4-step chain; the rail changes only at step 4 | Icon row is disabled while the POST is in flight; the notice and rail wait for the POST and the snapshot. No event is published, so other tabs never learn |
| Workspace rename | Dialog → same `mutate("settings")` | As above, plus a settings file write; the first rename gives the workspace a new ID | `refresh()` and a navigation to the new ID | The dialog closes after the POST; the rail waits for the chain |
| Workspace create, `git_init` (`WorkspaceManagement.tsx:60`) | `POST /api/v1/workspaces` | `Discover`, mkdir, optional `git init` | `refresh()` | `busy` disables the form |
| Conversation archive / restore (card, conversation head) | `App.tsx:792` `changeArchive` → `setArchive` | `cloneWriter`, a full `nativeSessions` scan (`archive_linux.go:47`), then `appendInvalidation` (`:191`) | **Local mask `pendingArchive` first** (`App.tsx:811`); then `refresh()`, *and* the journal invalidation triggers a second `refresh()` | The card disappears at once; the notice waits for the POST; the conversation view shows "Odotetaan arkiston tilan vahvistusta" until the snapshot |
| + new conversation | `startFromHome` (`App.tsx:933`) navigates to `?conversation=new` at once → `POST /api/v1/conversations` | With an explicit model: the Node/Pi catalog helper (≤12 s, `conversation_linux.go:397`), then Pi spawn and its first `get_state` (≤15 s, `:493`); live this measured **2.0 s** for an empty create ([plus-live-cause](../plus-live-cause/live-evidence.md)) | The response's session, then `refresh()` | The composer is disabled until the POST returns. Before the click, + is disabled while `loadPiModels` runs (`App.tsx:887`, `:928`), and that runs the Node catalog on every workspace route entry |
| Send / queue | `ConversationActions.tsx:201` → `send` | Pi RPC with a 15 s budget | **Pending bubble at once** (`:228`), then a status read and a session read | `busy` disables the composer during the POST |
| Stop / clear queue | `abortTurn` / `clearQueue` | Pi RPC, 30 s / 4 s | Status read | `busy` |
| Default model (Settings, picker) | `PiModelSelector.tsx:108` → `POST /api/v1/pi/models` | Spawns Node and loads Pi's `ModelRuntime` on every GET and POST (`pi_models_linux.go:45-90`); measured **385–685 ms** on Alder's i3-12100F with an empty home, so slower on the 2-vCPU guest | The response carries the new catalog (`update(next)`), so no refetch | The picker is `busy` for the helper's lifetime |
| Server name, admin flags, quota (`ServerAdministration.tsx:70`) | `changeAdministration` | Gateway-owned state | `await reload()`, a second sequential round trip | `saving` disables the form for 2 round trips |
| API key (`PiCredentials.tsx:77`) | `POST /api/v1/pi/credentials` | Node helper | The response carries the new state | `busy` |

## Measured causes

Lab: `scripts/lab.sh` on Alder with `OH_PORT_BASE=5730`, headless Chromium,
three runs per cell, medians. Latency is Chromium's per-request network
emulation, which models the live route without reproducing it. Raw data is in
[lab-actions.jsonl](lab-actions.jsonl) and
[lab-create-send.jsonl](lab-create-send.jsonl), produced by
[measure-actions.mjs](measure-actions.mjs) and summarised with
[summarize.mjs](summarize.mjs). Every time runs from the real `pointerdown`
to the first animation frame in which the milestone holds.

The `create_and_send` rows in `lab-actions.jsonl` that ran at 100 and 200 ms
failed. By then earlier runs had left four controlled Pi processes running,
which is the daemon's per-user capacity, so those runs measured the refusal
path and not latency (pattern 7 below). `lab-create-send.jsonl` reruns that
scenario with a fresh lab for each latency. In 3 of 9 card-archive runs the
short-lived "Arkistoitu" notice disappeared before the probe saw it.

Live: [live-rtt.sh](live-rtt.sh) from Alder, unauthenticated `/healthz` on a
warm connection, 3×20 requests at 16:15 UTC:

- through Cloudflare: **187–242 ms** per request (median of medians 213 ms)
- through Alder's own SSH forward to the guest: **53–68 ms**

So about 150 ms per request is the Cloudflare tunnel leg to Alder over ISP.
Jari's laptop adds its own leg to Cloudflare. The live column below is an
estimate built from three parts: the round trips on the critical path × ~0.2 s,
the live snapshot of 1.1–2.4 s *[live, 5f8a86c9]*, and the write itself, "tens
to low hundreds of ms" for archive *[live, 5f8a86c9]*. No real click on the live
server was timed.

| Action | Lab 0 ms | Lab 100 ms | Lab 200 ms | Live estimate | Where the time goes |
|---|---|---|---|---|---|
| Workspace hide → gone from rail | 110 | 466 | 881 | ~2–3 s (0.8 s round trips + 1.1–2.4 s snapshot + POST) | 4 sequential round trips (POST 3→209, session 234→441, snapshot 444→648, session 649→852 ms at 200 ms) |
| Undo hide → back in rail | 91 | 431 | 882 | ~2–3 s | same chain |
| Rename → dialog closes / rail renamed | 29 / 91 | 136 / 481 | 238 / 883 | ~0.3 s / ~2–3 s | POST, then the chain |
| Card archive → card gone | 36 | 24 | 24 | **instant** | Local `pendingArchive` mask before the POST |
| Card archive → "Arkistoitu" notice | 73 | 134 | 224 | ~0.2–0.3 s | Waits for the POST |
| Card restore → card back | 100 | 476 | 888 | ~2–3 s | Not masked: POST, then the chain |
| + → placeholder route | 12 | 13 | 15 | instant | Navigates first |
| + → composer usable | 90 | 249 | 463 | ≥2.4 s (2.0 s measured create + round trips) | POST that spawns Pi, then sequential session and status reads |
| Send → own text visible | 13 | 12 | 14 | instant | Pending bubble |
| Send → composer cleared | 47 | 131 | 237 | ~0.25 s | Waits for the POST |
| Default model save | — | — | — | ≥0.6 s (helper ≥0.4 s + round trip) | Node/Pi catalog on the request path |

The lab's own server work is small: a snapshot takes ~40 ms on loopback with five
invented workspaces, with no real `gh` or git. That is why the lab time grows
almost exactly as "4 × latency". It isolates the request shape. The live
snapshot cost is a second and larger term on top of it, and the lab cannot
show that cost.

**Live access and its limits.** This worker read the gateway and daemon
journal over pinned SSH for 15:00–16:30 UTC. It contains no request paths or
durations: only `oauth_callback`, `service_ready` and one
`conversation_title` record, plus 13 service stop/start pairs from releases in
that 90 minutes. Each restart forces every open tab to rebuild from a new
snapshot. This worker ran nothing as Jari's user. The snapshot durations
above come from the parallel session's socket requests *[live, 5f8a86c9]*,
which used that report's reproduction commands. The workspace POST's live
duration remains unmeasured.
Separately, the release watcher has been failing at `pin_fleetrepo` since
`a88a5531`, so the guest still runs pilot.180. I only observed this and did
not repair it.

**About the trigger report.** In pilot.179/180, hiding a workspace is the icon
row's "Piilota sivupalkista" on the workspace page. It has no confirm dialog.
The overlay that appears is the undo notice ("Piilotettu sivupalkista ·
Kumoa"). Both the button and "Kumoa" take the same POST-plus-four-round-trip
path above, which matches the report that both responded slowly.

## Patterns that make each new feature slow by default

1. **Refetching everything is the confirmation.** 31 call sites in `web/src/app`
   call `refresh()` after a write. A refresh is the full snapshot plus two
   session reads plus the conversation list. Each one costs four round trips
   and a full native observation on the daemon, whatever the size of the
   change.
2. **Session reads are serialized around the snapshot.** The `/auth/session`
   reads before and after the snapshot exist to notice a cookie change from
   another tab. The browser contract already handles that case through
   `web_identity_id` in the snapshot and 401s on the real request (`web/AGENTS.md`;
   the review's row B6 recommended removing pre-checks of this kind). They
   add two round trips to every refresh.
3. **Every feature invents its own pending state.** These all solve the same
   problem in separate code: `pendingArchive`, `pendingClose`, `createPending`
   and `creationViews` in `App.tsx`, `hideNotice` and `busy` in
   `WorkspacePage.tsx`, `sendObservation` in `ConversationActions.tsx`,
   `saving` in `ServerAdministration.tsx`, and 11 files with
   `setBusy(true)`. Only two of them (card archive, send) show the result
   before the host replies. A new feature copies the nearest neighbour, which
   is usually the pessimistic one.
4. **Mutation responses carry little state, and the browser ignores what
   they do carry.** `POST /api/v1/workspaces` returns only
   `{workspace_id, state}` (`workspace_manage_linux.go:357`). The archive
   reply does contain the new archive fact, and `setArchive` validates it
   (`conversations.ts:665`) but then discards it and waits for a snapshot
   *[live, 5f8a86c9]*. The Pi models POST is
   the exception: it returns the new catalog and needs no refetch.
5. **Events are only hints to re-snapshot, and workspace changes are not
   even that.** `contracts/v1/event.schema.json` declares `workspace.changed`
   and `agent.changed`, but the daemon never emits `workspace.changed`. In
   the browser, `snapshot.invalidated`, `agent.changed` and the other
   change kinds all call `onSnapshotNeeded` (`conversationJournal.ts:94,118`).
   The history watcher turns every coalesced burst of Pi session writes into
   `snapshot.invalidated`, so a running turn costs several full snapshots a
   second, and these contend on the 2-vCPU guest *[live, 5f8a86c9]*.
   Workspace mutations publish nothing. Another tab
   or device sees a hidden workspace only on its next unrelated refresh.
   Conversation archive goes the other way: it does publish, and that triggers a
   *second* full refresh in the tab that made the change.
6. **Heavy native work sits on request paths.** Every mutation runs a full
   `Discover` just to resolve one ID and token. Every snapshot calls GitHub,
   runs five git processes per repository and asks idle Pi processes for
   their inventory. It keeps nothing between requests. Every model GET and POST and every create with a chosen model
   starts Node and loads Pi. The + button is gated on that catalog read on
   every workspace page entry (`App.tsx:878-913`).
7. **Every failure counts as "uncertain".** `createTracked`
   (`conversations.ts:270`) leaves its uncertainty marker for every
   non-401 error, including a definite `429 capacity_exceeded` refusal. In
   the lab, once four controlled Pi processes were running, + showed "Luonnin
   tulos epävarma. Tarkista tiedot ennen uutta yritystä" and stayed blocked,
   although the daemon had refused cleanly in 1–3 ms. Treating every failure
   as possibly committed is what makes optimistic presentation look
   dangerous, and it also blocks recovery from honest refusals.

## Options

### A. Current pattern: wait for confirmation, then refetch

The UI shows only what the last snapshot said. Its strength is that it is
never wrong for longer than one refresh, and it needs no reconciliation code.
Its cost is at least four round trips per click, about a second live. Each
feature also needs its own busy handling, and several have grown their own
masks anyway.

### B. One mutation layer with pending, confirmed and failed states, and optimistic presentation where safe

A shared helper, for example `runMutation({key, commandId, apply, request, confirmWhen})`,
records a pending entry in the Redux slice. Selectors render "snapshot +
pending overlay". The entry is removed when the response, an event or a later
snapshot confirms it. If the request fails, the entry is removed and an
explicit message names what did not happen. The overlay is keyed by a client
command ID, like the command IDs sends already use, so a late or duplicate
reply cannot apply twice.

This is React's model for `useOptimistic`: "Optimistic state only renders
while an Action is in progress, otherwise `value` is rendered", and on error
"React renders with whatever `value` currently is"
([react.dev](https://react.dev/reference/react/useOptimistic)). TanStack
Query shows the same two variants: render the pending `variables`, or write
the cache in `onMutate` with a rollback snapshot. Both refetch on settle and
keep the mutation pending "until the refetch is finished"
([TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)).
Replicache formalises the command-ID part. Each mutation gets an ID, and the
client "rewinds to the last-known server state ... then replays any
unconfirmed mutations"
([Replicache](https://doc.replicache.dev/concepts/how-it-works)). That is the
right mental model, but too much machinery to adopt here.

- **Gain:** most clicks get under 100 ms of feedback, which Nielsen's limit for
  "reacting instantaneously" requires
  ([NN/g](https://www.nngroup.com/articles/response-times-3-important-limits/)).
  New features get the behaviour by using the helper.
- **Cost:** it is the only option that can briefly show something false.

### C. The server pushes the changed state; the client never refetches to confirm

Each mutation response returns the authoritative changed resource (the
workspace record, the agent's archive fact), which the store applies
directly. The daemon also appends `workspace.changed` and similar events to
the journal it already has, so other tabs converge without a snapshot. The
snapshot stays for startup and recovery only.

- **Gain:** honest, because nothing is shown before the host says so. The
  confirmation drops from four round trips to one (~0.2 s live). All tabs
  converge.
- **Cost:** contract additions in `contracts/v1`, and the daemon must build
  the same resource shape in two places (snapshot and mutation reply). Alone,
  one round trip at ~0.2 s plus ISP jitter is still noticeable.

### D. Move slow work off the request path and make the snapshot cheap (no contract change)

- Remove the two session reads from refresh, or run them in parallel.
- Resolve the mutation target with a single `openat` and stat, not a full
  `Discover`.
- Make the snapshot cheap. Keep the GitHub identity until `gh`'s credential
  files change. Recompute git facts only when `.git` mtimes change, or in the
  background, and publish them as `workspace.changed`. Run the independent
  parts concurrently. The expected result is well under 100 ms on the test
  server *[live, 5f8a86c9]*. This retains facts between requests. The
  project rules out "speculative caches", but here the need is measured, and
  each fact is invalidated by its native input, so it is not a second source
  of truth.
- Stop rerunning the Pi catalog on every workspace navigation.

- **Gain:** every path gets faster, including startup and recovery. It also
  respects "no speculative caches".
- **Cost:** it does not change the round-trip count of a mutation below two,
  so it lowers the floor but does not make clicks immediate. A cheap snapshot
  is needed anyway, because page load and recovery always use it.

### Where credible views disagree

The practitioner literature agrees that optimistic UI fits only where the
failure rate is low and the action is simple. Mishunov puts the bounds at
errors "should never go above 1 to 3%" and "server response times of less
than 2 seconds", for "simple binary-like elements"
([Smashing Magazine](https://www.smashingmagazine.com/2016/11/true-lies-of-optimistic-user-interfaces/)).
It also agrees that a silent rollback is worse than waiting: users "will think
their action worked, then be confused when the state reverts"
([DEV](https://dev.to/anas_sheikh_2/your-useoptimistic-ui-might-be-lying-to-users-when-the-server-action-actually-fails-582j)).
Destructive or consequential actions are the standard exclusion.

On the other side, this project's principle is that the browser is a viewer
of native state. Showing a hidden workspace as gone before the daemon has
written the file is, strictly, the browser making a claim. The code already
settled this once for conversation archive: `pendingArchive` is
"a local presentation mask only: the host remains authoritative and failures
remove it" (`App.tsx:144`). Jari's "Kupla odottaa" decision
([proto-queued-send](../proto-queued-send/item.md)) chose a visibly *pending*
presentation for sends, which is not the same as a fake success. The two passes in this report also disagree. The parallel session recommends
optimism only for "the control's own visual state (the button changes
immediately, the notice appears) while the list change waits for the reply".
Its reason is that this daemon refuses writes for real reasons
(`control_uncertain`, `writer_conflict`), and rolling back an archive after a
navigation is confusing *[live, 5f8a86c9]*.

This worker's view: with a cheap snapshot and fact-carrying replies, the wait
for the reply is one round trip (~0.2–0.3 s live). That is acceptable for
most actions, so the disagreement narrows to the trigger case of the list
changing under the person's hand. The view I recommend sits between the two
camps. Present the intended result as pending
where the action is reversible and almost always succeeds. Never present
anything the person could act on as if it were done (credentials, sends,
deletion). Always say plainly when something was rolled back.

## Recommendation and migration path

Adopt **D's quick wins first, C as the confirmation channel, and B as the
shared layer every action uses.** How far B goes into optimistic presentation
is the ADR question below. Each step is small enough to land on its own and
can be measured with `measure-actions.mjs` (lab) and with the socket timing
commands in `5f8a86c9` (live).

0. **Cheap snapshot** (D, daemon only, contract unchanged). Keep the GitHub
   identity until `gh`'s credential files change. Recompute git facts per
   workspace when their inputs change. Run the parts concurrently. Target:
   `GET /api/v1/snapshot` under 100 ms on the test server. This removes
   1–2 s from every click and from every page load, and it is the largest
   single live term *[live, 5f8a86c9]*.
1. **Refresh without the serialized session reads** (D; no ADR needed).
   Fetch the snapshot directly. Keep identity separation through
   `web_identity_id` and 401s, and do the CSRF read in parallel or only on
   identity change. Expected effect: hide at 200 ms latency goes from 881 to
   ~450 ms. Also take `loadPiModels` off workspace-route entry; reread it on
   settings saves and identity change only.
2. **Shared mutation helper in the store** (B). Start with the actions in the
   trigger report:
   - workspace hide and undo
   - workspace rename
   - card restore
   - conversation archive from the conversation head (replacing
     "Odotetaan arkiston tilan vahvistusta")

   Then fold the existing `pendingArchive` / `pendingClose` into it. A sketch:
   ```ts
   // store: pending: Record<commandId, {target, patch, startedAt}>
   runMutation({
     target: {kind: "workspace", id},
     patch: {visibility: "hidden"},          // what selectors overlay now
     send: (commandId) => mutateWorkspace({...}, csrf), // returns the new resource
     confirmed: (snapshot, resource) => resource?.visibility === "hidden",
     failureText: "Työtilaa ei piilotettu. Se palautettiin näkyviin.",
   });
   ```
   Classify every action once, in the helper's table:
   - **optimistic-pending:** hide/restore, archive/restore, rename, default
     model, server name
   - **pending-feedback-only, result waits for the host:** create, send/queue
     (already a pending bubble), stop, clear queue, API key, git init, GitHub
     clone and publish
   - **always confirmed, explicit:** anything deleting or disconnecting
3. **Mutation replies carry the resource; the daemon publishes workspace
   events** (C). Add the changed workspace or agent fact to the
   `/api/v1/workspaces` and archive replies in `contracts/v1`. Append
   `workspace.changed` to the journal. Drop the follow-up `refresh()` from
   the migrated actions, and drop the duplicate refresh caused by archive's
   own invalidation. Let `agent.changed` and `workspace.changed` carry
   their fact, and stop calling `onSnapshotNeeded` for events that carry
   one; a watcher `snapshot.invalidated` then refreshes only the affected
   agent's metadata. The snapshot remains the startup and recovery read, as
   ADR 0008/0009 already frame it for conversation content.
4. **Separate refused from uncertain.** A typed 4xx refusal (409 conflict,
   429 capacity) is a definite "did not happen". It rolls back at once with
   its reason and must not leave an uncertainty marker. Only a transport loss
   or a 5xx is uncertain. Without this step, optimistic presentation would
   either lie or freeze.
5. **Then the remaining native paths** (D): target resolution without a full
   `Discover`, and fewer starts of the Pi catalog helper. The issue that adds
   request durations to the logs (below) should come first, so that this
   work is chosen from live evidence, not guessed.

**Keeping tests honest.**

- Latency belongs in the browser suite. A host-backed spec with Chromium's
  `Network.emulateNetworkConditions` at 200 ms should assert milestone
  budgets per action class: optimistic actions reflect in under 100 ms, and
  confirmed actions show pending feedback in under 100 ms and settle within
  2 round trips. At zero latency this whole class of regression is invisible,
  which is how it accumulated.
- Each optimistic action needs a refusal case (the fixture daemon answers
  409) asserting rollback plus a visible message. It also needs an
  uncertain case (connection dropped) asserting no false "done".
- A unit-level check that mutations go through the helper, i.e. that no
  component calls `refresh()` as its confirmation. This keeps the next
  feature from reverting to pattern A.
- Report live acceptance with the click-to-settled times from a real browser
  on the test server, not lab numbers.

## Decision for Jari to record in an ADR

> **Browser mutations.** Every browser mutation goes through one client
> mutation layer that tracks pending, confirmed and failed states by client
> command ID. For reversible, high-success actions (listed in the layer's
> table), the browser presents the intended result immediately as pending, as
> a disposable overlay over host state. Host confirmation removes the overlay.
> A refusal or uncertain outcome reverts it with an explicit message. Sends,
> creation, credentials and destructive actions show immediate pending
> feedback but present their result only after the host confirms. Mutation
> replies carry the changed resource, and the daemon publishes workspace
> changes on the event journal; a full snapshot refetch is not the
> confirmation path. This complements ADR 0008/0009, which made *reads* fast.

What Jari decides is which side of the truthfulness line the first list
falls on. The narrow alternative, from the parallel pass, is optimism only for
the control's own state: the button changes and the notice appears, while the
list waits for the reply. After steps 0–3 that wait is one round trip, about
0.2–0.3 s live. This worker recommends the wider list for hide/restore and
archive/restore. They are the trigger case, a refusal there is rare and
harmless to roll back, and 0.2–0.3 s is still visible over ISP.

The overlay adds no store of truth: it lives only in memory, is
keyed per command, and is dropped on confirmation, failure or identity
change. The host still decides every write.

## Suggested follow-up issues

- *Filed (intake, unlaned) as @practically-sassy-morning:* create treats a definite refusal such as
  `429 capacity_exceeded` as an uncertain outcome and blocks +.
- *Filed (intake, unlaned) as @enormously-light-fall:* live gateway and daemon logs record no request
  path or duration, so slow-action reports cannot be diagnosed from evidence.
- *Proposed, no ADR needed:*
  - cheap snapshot: GitHub identity and git facts kept until their inputs
    change, parts run concurrently (step 0)
  - refresh without serialized session reads, and no catalog reads on route
    entry (step 1)
- *Proposed, after the ADR:*
  - shared mutation layer and migration of the workspace actions (step 2)
  - mutation replies with resources plus `workspace.changed` events, a
    contract change (step 3)
  - latency-budget browser spec (tests)
  - native fast paths for mutation target resolution and the Pi catalog
    helper (step 5)
- [archive-workspace-restore](../archive-workspace-restore/item.md)
  point (1) should wait for steps 0–2 rather than receive a local fix.
