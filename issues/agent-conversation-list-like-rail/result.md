# Result

## Cause

The agent GET adapter called `ConversationController.list`, which enumerated
only `c.sessions`. Its native-history scan replaced titles on those rows but
never added rows. Reaping/evicting a stopped handle or restarting the daemon
therefore removed a conversation from the agent list without changing its
native history or rail membership.

## Change

The agent adapter now enumerates native history in the rail's workspace/place
catalog, then overlays handles, including newly created conversations Pi has
not written yet. The rail and agent share Taskfleet/worktree-container filtering.
Titles retain native-name, first-message, unnamed-conversation precedence.
Every row has `lifecycle`; handle-only controller fields remain optional.
Help, shipped agent skill, a closed response schema, examples and negative
checks describe the result. The host context does not describe this command,
so it needs no duplicate instruction. No browser behavior or authority changes.

## Decisions for later review

- Use the conductor's native-history default rather than retaining a handle-only
  command. Include archived history and controller-only new rows so the agent can
  find both old work and a creation whose reply was lost.
- Add `lifecycle: live|resting|archived` rather than repurposing controller
  `state`. Live means a running Pi was observed (including terminal Pi), resting
  means none was observed, and archive takes precedence. Listing grants no right
  to resume terminal history. `state` and `startup_choice` exist only for handles.
- Use the containing place's ID for `workspace_id` in worktrees, as conversation
  creation/continuation expects; ordinary rows use their current workspace ID.
  Sort by agent ID for repeatable output, not by the rail's presentation order.
- Return an explicit 503 for unavailable history/archive data or failed/partial
  workspace discovery rather than a successful shortened list. This trades
  availability during a damaged workspace scan for truthful membership, matching
  agent workspace listing. Native worktree/Taskfleet observations retain the
  rail's existing best-effort behavior.

## Verification

Tested the working change based on `76080d473698cb948623c69336e9c5b32350bc07`:

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed
  after all code changes (258.575s). Regression covers native titles, live/resting/
  archived rows, a worktree, a pending history-less handle, handle eviction,
  restart, exclusion outside the rail catalog, rail membership count, and 503 on
  failed/partial discovery or inaccessible history. Replies validate against the
  new schema. Existing control tests still prove a read starts no Pi.
- `./scripts/test-focused.sh --area go --go-package ./internal/cli`: passed.
  JSON and JSONL tests preserve title and lifecycle.
- `./scripts/test-focused.sh --area contracts`: passed; generated Go/TS clean,
  101 schemas, 162 fixtures, 44 scenarios and negative checks.
- `./scripts/test-focused.sh --area web`: passed; lint/typecheck and 226 files /
  1791 tests. Existing lint infos and jsdom capability warnings are non-fatal.
- Independent `/llm-review` finder `claude-fable-5-2`, verifier `gpt-6-astra`,
  followed by `/assess-findings`: one confirmed finding (discovery false-empty),
  fixed and regression-tested; no remaining findings. Assessment: occasional,
  readability improves, no architecture change, high confidence, FIX.

An initial daemon run hit the tool's 200-second timeout; it is not counted as
passing. Re-running with a sufficient foreground budget passed. A combined
invocation with two `--go-package` arguments selected only the last package;
separate invocations above verify both. Early search commands had harmless
no-match/nonexistent-glob exits; source inspection continued with scoped paths.
`npm ci` reported existing dependency audit warnings; no dependencies changed.
No browser spec or screenshot: the agent-only behavior has no visible UI change.
No live installation, provider, or distinct-UID qualification claimed.

**Live check:** Run `open-habitat agent conversation list --json`, stop a
conversation and run it again after its handle expires. Its ID/title should stay
with `lifecycle: resting`; archived conversations should remain with
`lifecycle: archived`. Compare IDs with the rail and archive view.
