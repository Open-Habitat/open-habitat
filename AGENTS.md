# open-habitat

We are building a multi-user web host for native AI agents. A person signs in
through the browser. The gateway maps them to their own Linux user, and a daemon
running as that user lists their workspaces and runs their agents (Pi, `gh`,
`git`) exactly as they would run over SSH and tmux. The browser is a new way to
reach the same native sessions, not a separate agent platform.

Two ideas shape everything here:

- **Unix users are the security boundary.** Separation between people comes from
  ordinary Linux accounts, file permissions and per-user sockets. Anything that
  could let one user reach another's home, credentials or agents is a product
  defect, not an operational detail.
- **Reuse mature native components.** Native tools keep their own histories,
  configuration and processes. We do not build a workspace registry, a parallel
  history store, our own credential broker or speculative caches. Each such
  thing would be a second place where the truth about a person's work can drift
  from the native one, so a new store, service or abstraction needs a concrete
  need behind it.

## Where authority lives

The product is one Go binary plus the browser package in `web/`. Three
authorities stay apart: `internal/gateway` authenticates the browser and picks
the Unix user, `internal/daemon` runs as that user and trusts no identity claim
from the browser or the gateway, and `internal/provision` is the root-only
broker that only creates an account on first approved login. Moving authority
between them is an architecture change; `internal/AGENTS.md` explains why.

`contracts/v1/` is the browser/host contract; `internal/contracts/` and
`web/src/contracts/` are generated from it, and the gate fails on drift.
`web/src/components/` holds the production components that Storybook also
imports. `systemd/`, `sysusers.d/` and `tmpfiles.d/` are neutral templates; the
concrete installation is Fleetrepo's.

[TESTING.md](TESTING.md) says which tests to run and what each result proves.

## How work proceeds

The project is in pre-release and moves fast. Implementation is carried as far
as the task allows and problems found along the way are fixed. There are no
users to stay compatible with, so formats, interfaces and data change freely
without compatibility code.

The agent can decide when to cut and deploy a release to the test server and
carry the whole release through autonomously, including the first live use of
a new upgrade operator. The server exists solely for testing: its users, data
and previous product versions are disposable. An upgrade that fails can be
fixed forward or replaced by a fresh installation; there is no need to retain
older releases for rollback. For the same reason a test-server release does
not wait for the clean gate: it may ship an ungated tree as long as the
release receipt says so (Jari, 2026-10-13). The gate remains the health check
of `main` and the precondition of a production release, not of a test update.

The test server is kept working without asking. When its route breaks
because Alder's changing public address (ISP) falls outside the test
VM's SSH firewall and key restrictions, the agent repairs it at once with
Fleetrepo's egress operator: it adds the newly observed exact address and keeps
the earlier ones. The same applies to other maintenance blockers of this
disposable server, such as a stopped release watcher (Jari, 2026-10-16). Fleetrepo's
`infra/open-habitat-test/RELEASE-UPGRADE.md` explains the deployment and
its trust boundaries; the private inventory and issue results record which
bytes actually ran.

Architecture is decided together with the user: which component has which
authority, the security model and major dependencies. These come to the user as
a recommendation with the reasoning, and the decision is recorded in an issue
or ADR so it survives the conversation until the code carries it. Otherwise the user wants the work to
proceed without him or her. Ready work in the DAG gets done.

A question is worth the user's attention when the outcomes differ in a way the
user would care about and you cannot tell which he or she would choose.

## Code is the record

The code is the single source of truth for what the system does, and the
repository keeps no second description of it. A description that repeats
the code drifts the moment the code changes and nobody has to correct it,
and the contradictions it leaves are what made an earlier generation of
these documents untrustworthy. So the tree holds only what exists nowhere
else and has an owner who notices when it goes stale:

- the code, with comments that say why where the code cannot;
- instructions (`AGENTS.md` files, `TESTING.md`, `AGENTS-WORKFLOW.md`), which
  include the rules the code cannot show, such as what must never be built or
  which component must never hold an authority;
- work that is not yet code: open issues, a decision or design still waiting
  for its implementation, and the session narrative in `TODO.md` and
  `KOKEILTAVAA.md`, which are rewritten rather than appended to;
- what comes from outside the repository: Jari's product goal in
  `docs/product.md`, the visual direction he agrees with the designer in
  `design-system/`, and the operator guide in `docs/operations.md`.

Everything else is working material. Issues, ADRs, plans, research, prototype
rounds, evidence and one-off scripts are committed while the work is under
way, so that workers and Jari can read them, and removed once the code carries
the result. The intent then lives in git history, reached from the code: a
commit's `Refs-Issue`/`Fixes-Issue` trailer names its issue, and a comment
or document may name a removed file by its repository path (`ADR 0019` means
`docs/decisions/adr-0019-*.md`). `scripts/from-history.sh <path>` prints such
a file as it was last committed; `git log --all -- <path>` lists its history.
A Markdown link always points at a file that exists; a reference into history
is a plain path or name.

Work is tracked as issues in `issues/<slug>/`, managed with `issuectl` through
the `/issue` skill. The DAG is the schedule; `TODO.md` is only the story around
it. Plans, experiments and results live with their issue while it is open.
A closed issue's directory stays while an open issue, `TODO.md` or
`KOKEILTAVAA.md` still names it, for example a prototype result that is the
specification of open work or a choice awaiting Jari's later review, and is
removed after that. Instructions and other kept documents state what they
need themselves rather than pointing into an issue. `scripts/prune-closed.py`
lists the removable issues and removes them with `--apply`; the session
hand-off runs it, and a later reader finds the issue through its slug in
history. An ADR is removed when the issue that implements
it lands, after the rules the code cannot show have moved into the nearest
`AGENTS.md`. A comment on an issue earns its place only by telling a later
reader something the issue text, metadata and git do not already say;
acknowledgements, restated status and soon-stale delivery details are noise.

The repository-local `design-package` skill packages the current UI for Jari's
design tool. `docs/AGENTS.md` says what `docs/` holds and how it is written.
Subdirectory `README.md` files are reserved for the public front door,
so content for agents goes in that directory's `AGENTS.md`; each `CLAUDE.md` is
a symlink to it, so edit the `AGENTS.md`. CLI work follows the AI-first CLI
canon (`/ai-first-cli-canon`), tracked in `CONFORMANCE.md`.

## Work sessions

The session conducting a work round finds the current situation in
[TODO.md](TODO.md) and how rounds run in this repository in
[AGENTS-WORKFLOW.md](AGENTS-WORKFLOW.md).

## These instructions

These files describe intent and the reasons behind it, not procedures. Details
of a single incident belong in its issue. When a lesson changes how we work,
the relevant section is rewritten so the whole stays short and coherent.
