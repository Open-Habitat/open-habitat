# Result: idle Pi processes no longer fill the limit or block deletion

## What changed

`internal/daemon/pi_activity_linux.go` holds the one definition of a
conversation that is doing something. A daemon-owned Pi child that is alive
is busy when a turn runs or is being submitted, messages are held or queued
for it, Pi waits for an answer to a question, the daemon itself is using it
(title, recap, abort), a background process Pi started still runs (asked
from Pi's process bridge), or its state cannot be read. Everything else is
idle, and stopping it loses nothing that native history does not keep.

- **Limit.** Four live Pi children per person, as before, but a create,
  worktree-agent create, resume or held-message start that would exceed it
  first stops idle children, longest unused first. Only four busy
  conversations refuse, with "Neljä keskustelua työskentelee jo — odota, että
  jokin vuoro päättyy, tai pysäytä se." (also shown when a held message
  cannot start Pi for that reason).
- **Deletion** (workspace and worktree) blocks only on busy conversations.
  Each `pi_session` blocker now carries `activity` (contract change) and the
  dialog names the conversation by title in its link. Under the deletion
  fence the idle Pi children in the directory are stopped before the move;
  the preview check stops nothing.
- **Archive** stops the conversation's Pi when it is idle.
- **The working label** ("Pi työskentelee") is the browser's live-and-
  `run_active` rule; it is the `turn` case of this definition, and the
  deletion blocker now uses the same wording only for that case.

A stopped conversation resumes on its next send exactly as after a daemon
restart (lazy resume); the Go test checks that the native history keeps both
the earlier and the resumed message.

On the test VM at 08:00 UTC the four `pi` children of the issue had already
gone (only the daemon was left for `maintainer`); the cause was confirmed
from the code: create, resume and deletion counted every unreaped child.

## Decisions for later review

1. **Stop idle Pi when a place is needed, rather than not counting it.** The
   limit still bounds live Pi processes (memory on a shared host).
   Alternatives: count only busy conversations and let idle Pi accumulate
   without bound; stop every idle Pi after an idle timeout. Eviction keeps the
   bound and stops nothing the person would notice until it is needed.
2. **Longest unused first** (last prompt, settle or start). Alternative:
   archived ones first; archive already stops them, so there is nothing left
   to prefer.
3. **What counts as busy.** A pending question, held or queued messages and a
   running background process count, because stopping Pi would lose the turn
   or kill the process (`piRPC.close` shuts the process bridge down). An
   unreadable process inventory counts as busy (uncertain stays uncertain); a
   bridge socket that does not exist counts as no processes.
4. **Deletion stops idle Pi under its fence even if another check then
   blocks** (Git, Taskfleet, mounts). The conversations resume on send; the
   alternative of stopping only after every check passes would let Pi
   descendants show up as process blockers in the scan.
5. **Archive stops the Pi asynchronously** after the annotation is committed,
   and leaves a busy one (for example with a background process) running.
6. **An evicted conversation gets no automatic recap** until its next turn
   (the three-minute idle timer stops with the Pi). Usually the recap has
   already been written by the time a conversation is the longest unused.
7. **While an evicted Pi is being stopped (normally well under a second,
   at most about four seconds)** a send to that conversation is refused as
   "Tila muuttui toisaalla" rather than held. Not addressed.
8. **Contract:** `activity` (`turn`, `question`, `processes`, `unknown`) on
   the `pi_session` blocker of workspace deletion and worktree removal.

## Review

`/llm-review` (finder gpt-6-astra, verifier claude-fable-5-1) raised three
candidates, all confirmed by the verifier; `/assess-findings` triaged them:

- **FIX, applied:** after an uncertain stop, deletion released its fence and
  re-observed the children; a reap in between let the move proceed unfenced.
  The fence now decides once from the marked handles (a reaped child stays
  reaped) before releasing.
- **DROP (rule 1b, rare, fix adds complexity):** a whole turn starting a
  background process and settling inside the milliseconds-long bridge probe;
  and a native wake-up turn being prepared in the sub-second window between a
  waking process's end and `agent_start` reaching the daemon, if that
  conversation is evicted exactly then. Both would need an observation
  generation or a new process-extension field. Recorded here so a live
  occurrence (a background build or wake-up lost when a fifth conversation
  starts) can be recognised.

## Evidence

Synthetic only; nothing was run on the live server.

- `go test -race ./internal/daemon` (`scripts/test-focused.sh --area go`):
  pass. New: `TestIdleConversationsYieldTheirPlace` (four idle + fifth
  create; longest unused stopped; resume stops the next and keeps history),
  `TestBusyConversationsHoldPlacesAndBlockDeletion` (four running turns: 429,
  delete_check and delete blocked naming all four with `activity: turn`;
  after the turns, deletion with no archive succeeds and stops the idle Pi),
  `TestArchiveStopsIdlePiButNotBackgroundWork` (fake Pi serving the process
  bridge with a running process), `TestHeldActivity`. Mutation checks: with
  eviction disabled, the fifth create fails; with every child busy, archive
  never stops; with the bridge probe ignored, the background process test
  fails.
- `go build ./...`, `go vet`, `scripts/test-focused.sh --area contracts`
  (generated code clean, contracts valid).
- `scripts/test-focused.sh --area web`: pass.
- Playwright: `lab-idle-pi-slots.spec.ts` (new, two cases through the real
  gateway and controller; the idle case fails with eviction disabled),
  `lab-workspace-trash.spec.ts`, `lab-worktree-cleanup.spec.ts`,
  `mutation-layer.spec.ts`: pass.

Not verified: the real pinned Pi with the pi-processes extension (the
bridge is a synthetic stand-in), and the live test server.
