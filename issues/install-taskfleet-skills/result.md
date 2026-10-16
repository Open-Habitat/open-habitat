# Taskfleet skills on the test guest

## Distribution and product boundary

The operator installs Taskfleet's **14 unchanged bundled skills**, not the four
adapter skills proposed in the earlier research. Jari's approved issue supersedes
that proposal. Taskfleet 0.15.0 embeds the rendered catalog in its release binary:
`taskfleet skill list` lists it and `taskfleet skill print <name>` emits the exact
bytes. The producer commit is
`8464733b0d69cf1342eed64995163fd36c33523d`.

Fleetrepo declares and authenticates an immutable root-owned catalog at
`/opt/open-habitat/guest-taskfleet-skills-0.15.0`. The mapped user's additive
`~/.pi/agent/settings.json` skills path activates it for both browser-started Pi
and native workers. The same settings activate only the already-deployed
processes core, so native worker/parent Pi can use watched waits too. Foreign
settings, saved model defaults, credentials and existing instructions are
preserved. A short marked English host note lives in the native
`~/.pi/agent/AGENTS.md`, not in a forked skill or product prompt.

No product code or release is required: `internal/daemon/pi_rpc_linux.go`
launches native Pi RPC with the mapped user's own `HOME` and does not disable
native skill discovery. Pi 1.3's native agent-directory context and resource
loader apply to both launch paths. No new identity claim, shared credentials,
registry or launch authority was introduced.

## Installation evidence

Fleetrepo install run: **`01m52c7jgmgby32b4f65vsqt8d`**. Its declaration was
published as `118365ea433c898309ab920ec6ba1784bb3ad891` before guest mutation;
subsequent review/evidence commits were published through `331e5684`.
The full durable operator receipt, per-skill digests, tests and discovery
fixtures are in Fleetrepo
`infra/open-habitat-test/GUEST-TASKFLEET-SKILLS-RESULT.md` and its linked
`evidence/taskfleet-skills/` files.

- Guest tuple: Taskfleet **0.15.0**, workmux **0.1.276**, Pi **1.3.0**, Node
  **22.21.1**, processes core **0.10.9**.
- All **295** offline infrastructure/operator tests passed, including 16 new
  activation tests covering pin/collision/ownership/preservation/partial-state
  and concurrent-setting-edit refusal.
- Fresh selected-Pi SDK resource loaders as mapped UID **21032**, with the real
  home and minimal environment, discovered all 14 skills and the host note in
  both the source repository and a fresh worktree, with no skill/extension
  diagnostics and exactly one processes core even with browser-style explicit
  loading. This is actual resource discovery, not just a file listing.
- Activation made no product service restart. An independent release watcher
  did deploy pilot.163 during the interval; uninterrupted daemon lifetime is
  therefore not claimed.

## Provider proof

The first real parent attempt stopped before tools because the saved
`openai-codex/gpt-5.3-codex-spark` model was rejected by the account. There was
no child run or successful wait from that attempt. Defaults were not changed.

The continuation, Fleetrepo run **`01m52d0q8n30q1xy3k5ybyxfmj`**, completed
**done/landed** and published through
`395d5a098c062001bfe41ab8dfd50c055f86be20`. Its **300 tests passed**.
It selected catalog-available `openai-codex/gpt-6-astra` explicitly for the test
parent and a temporary child profile, without changing saved defaults. The
profile was removed afterwards; concurrent unrelated settings changes were
preserved, not restored over.

- Native parent: **`01a144d4-0343-7560-a801-3697070df887`**.
- Sole headless child: **`01m52d9mwdm0vke725zxw7pmqa`**; child Pi session:
  `98980068-7643-4d65-b083-a3d36644905b`.
- Real mapped-UID parent and worker discovered all 14 skills, the host note and
  one processes core. Child committed discovery evidence and exact proof text
  in `6195fe5`, now landed in the disposable source repository.
- Parent started `taskfleet run wait <full-id> --output json` through the
  process tool with turn notifications, ended its turn, and woke after 51s.
  It correctly reported the initial child failure rather than claiming success.
- The child's self-merge was blocked by Taskfleet's own generated untracked
  brief. The **same parent session recovered the same child**, verified those
  bytes against the native prompt, preserved the brief outside the worktree,
  and used native salvage. A second process wait woke the parent; it verified
  the successful report, `landed=true` and both landed files. This is a
  successful recovery, **not an uninterrupted child self-merge**.
- The deployed daemon's actual gateway-UID socket read returned this child
  under the exact parent/source, first working and then merged with available
  native transcript. Another fixture parent's endpoint had no children.
  This establishes product API association, not an observed browser render.

Fleetrepo's result links the complete native wait/wake timeline, parent logs,
child reports, discovery JSON and deployed API responses. The original install
run was subsequently settled through native salvage once its previously blocked
proof was complete and its published commits were landed; no worker was fenced
or foreign uncommitted source files modified.

## Manual browser acceptance

Implementation and mapped-user/provider/API validation are complete. Jari's
fresh-browser discovery, Langassa rendering and wait-status check remain in
`KOKEILTAVAA.md`; they are **not claimed as observed**. No second-user browser
isolation test was added by this installation task. Existing prompts may retain
their old catalog: use a fresh conversation. The guest activation itself needed
no product release or restart.
