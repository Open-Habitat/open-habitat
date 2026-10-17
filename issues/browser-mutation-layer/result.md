# Result

Steps 2–4 of [ui-responsiveness-review](../ui-responsiveness-review/analysis.md),
recorded as [ADR 0023](../../docs/decisions/adr-0023-browser-mutation-layer.md)
(accepted by Jari 2026-10-16). `practically-sassy-morning` is folded in.

## What changed

**One layer for every write.** `web/src/app/mutations.ts` names every browser
write in `mutationClasses` with its class (optimistic, pending, confirmed) and
sends it through `mutationFetch`. `mutations.test.ts` fails when any other
source file calls `fetch` with a method, so a new write cannot skip the layer.
`writeOutcome` reads every reply the same way: 2xx done, 401 login, a typed 4xx
a definite refusal, and a lost reply, a 5xx, an unreadable 4xx or
`workspace_partial` uncertain.

**The overlay.** `MutationLayer` keeps unconfirmed commands in memory, one per
target key, each with its client command id. A second command on the same
target queues behind the first and collapses to the latest, so "Kumoa" right
after "Arkistoi" works before the host has answered. After 2 s without an
answer the command's phase becomes `slow` and the page says "Vahvistus
palvelimelta viipyy…" (steady text). A refusal drops the overlay and leaves
the reason. An uncertain command stays presented and the next snapshot read
is its receipt: it settles as confirmed or reverts with "… ei tallentunut".
The layer is dropped with the identity. `hostOverlay.ts` renders the snapshot
plus the overlay; nothing in it is kept.

**Confirmation without a snapshot.** Workspace settings and visibility
replies now carry the changed facts and the journal cursor
(`contracts/v1/workspace-change.schema.json`), and the daemon publishes the
same change as `workspace.changed`, so other tabs update without a snapshot.
Archive and close replies carry the cursor of the hint they publish. The
browser applies a reply or event through `hostChanged` (`store.ts`) and keeps
it until a snapshot whose cursor has passed it, re-applying it over an older
snapshot that was already in flight. No migrated action calls `refresh()` as
its confirmation; the browser test asserts that no snapshot is read between
the click and the settled state.

**Migrated.**

| Class | Action | Before | Now |
|---|---|---|---|
| Optimistic | Workspace archive/restore | own `pendingVisibility` mask, write numbering | layer, reply patch, queued undo |
| Optimistic | Workspace rename | busy dialog, POST + snapshot | dialog closes, name shows at once; page follows the durable ID |
| Optimistic | Conversation archive/restore (card, conversation head, notice, archive list) | `pendingArchive` mask for archive only; restore waited for the snapshot | layer both ways |
| Optimistic | Pi default model | own overlay (`model-choice-instant`) | kept its latest-wins queue and catalog receipt; now uses the layer's transport, outcome reading and slow delay |
| Pending | Close an empty conversation | `pendingClose` hid it | dimmed "Suljetaan…" in the rail and card until confirmed; a refusal returns to the conversation with the reason |
| Pending | New conversation (+) | every failure was "uncertain" | a typed refusal says why ("Keskustelua ei luotu: Liian monta käynnissä olevaa keskustelua — sulje tai pysäytä jokin."), clears the uncertainty marker, gives waiting messages back to the field, offers "Yritä uudelleen"; + stays usable |
| Pending/confirmed | every other write (send, queue, abort, workspace create, deletion, GitHub, keys, sign-ins, admin, storage, profile, logout) | direct `fetch` | named command through `mutationFetch` |

`pendingArchive`, `pendingClose`, `pendingVisibility`, `archiveBusy` and their
in-flight refs are gone from `App.tsx`. The unreachable `WorkspaceManagement`
component and its test were removed.

**Daemon.** Besides the replies and the event: the first rename moves a hidden
workspace's annotation to its new durable ID (it used to fall back to
visible); the name-derived ID still reaches a directory that has a durable ID,
so a command queued behind the first rename, or another tab with an older
snapshot, is not refused; a workspace change counts for the snapshot race
check; and a browser conversation without history follows its workspace's
durable ID in the snapshot instead of disappearing after the first rename.

## Evidence (synthetic)

Lab, production bundle, Chromium latency emulation, 3 runs, median ms after
pointerdown ([measure.mjs](measure.mjs), [lab-after.jsonl](lab-after.jsonl)):

| Action → milestone | 0 ms | 100 ms | 200 ms | 200 ms before (`refresh-without-session-reads`) |
|---|---|---|---|---|
| Workspace archive → gone from rail, notice | 23 | 20 | 21 | 464 |
| Undo → back in rail | 17 | 18 | 15 | 445 |
| Rename → dialog closed, rail renamed | 17 | 21 | 16 | 453 |
| Card archive → card gone, notice | 23 | 24 | 25 | 23 |
| Card restore → card back | 21 | 16 | 19 | 457 |

Browser tests: new `mutation-layer.spec.ts` (archive, queued undo and rename
before the host answers at 200 ms with no snapshot read; refused rename
reverts with its reason; slow note appears and clears; lost reply stays
presented and the receipt confirms it, or reverts a restore the host never
wrote; 429 on + is a refusal and + stays usable). Existing workspace-archive,
browser-conversation, refresh-identity and lab-workspace-page cases were
updated where they used a write as a refresh trigger or relied on old texts.
Unit: `mutations.test.ts` (guard, classification, phases, queue, dispose),
`store.test.tsx` (patch log over older/newer snapshots, restarted daemon,
identity). Go: `TestWorkspaceChangeReplyAndEvent`,
`TestWorkspaceDerivedIDAfterFirstRename`.

Runs on this tree: full default browser suite 231/232, the failure being the
known account-settings "native key add"; lab specs all pass except the known
lab-conversation "expired combined cursor" and "combined stream gap"; Go
`./internal/...` only the six known daemon Pi credential/device/model/startup
failures; contracts valid. The full gate was not run.

Captures (`lab-{desktop,phone}-{light,dark}-*.png` + `.html`):
`archive-slow` (archive shown, slow note, before the host answered),
`close-pending` (dimmed "Suljetaan…" card and rail row), `create-refused`.

Review: `/llm-review` with GPT-6 Astra as finder and Claude Fable 5.1 as
verifier. Four findings were confirmed and fixed: a workspace write was not
counted for the snapshot race check, patches from a restarted daemon survived,
a queued command after a first rename used the obsolete ID, and an unreadable
4xx was read as a refusal.

## Decisions for later review

- **The change resource is partial.** The reply and `workspace.changed` carry
  only the facts these writes change (ID, previous ID, token, name, display
  name, visibility), applied over the snapshot record. A full snapshot
  workspace would have needed git facts in the write path. `workspace.changed`
  was declared with the full record but never emitted, so its payload was
  changed.
- **Archive and close still publish a snapshot hint**, not a typed event, so
  other tabs still read a snapshot for those. The tab that made the change
  confirms from the reply. A typed agent change event would be a further
  contract step.
- **Creation still waits for a snapshot** to show the new record; only a native
  observation describes a new workspace or conversation in full. New workspace
  and `git init` keep their existing busy presentation inside their dialog.
- **The client command id is echoed, not enforced.** Workspace and archive
  writes are idempotent setters, so the id serves to match reply, event and
  overlay; sends and queue commands already had daemon-checked ids.
- **A busy writer (`workspace_busy`) is retried twice** (250 ms, 500 ms) by the
  layer before being shown as a refusal: it wrote nothing, and the shared
  writer lock makes it likely when archive and hide overlap.
- **An untyped 4xx is uncertain, except 429.**
- **Pending items are not clickable** (`pointer-events: none` on the dimmed row
  and card): nothing is built on a pending item.
- **Settings toggles and filters** needed no work: the only host-written
  setting toggle is the default model; filters are local.
- The layer's model-performance log entry was not written: SSH from alder to
  itself was refused (`assess-models-alder-self-ssh`).
