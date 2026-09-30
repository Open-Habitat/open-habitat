# native-agent-host

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
between them is an architecture change; `internal/AGENTS.md`,
`docs/architecture.md` and the ADRs explain why.

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

Cutting a release and installing it on the test server is ordinary work and
does not wait for a go/no-go from the user. Fleetrepo's
`infra/native-agent-host-test/RELEASE-UPGRADE.md` is the procedure, with
receipts and host facts kept there. It exists so that we always know exactly
which bytes are running and can go back to the previous release.

Architecture is decided together with the user: which component has which
authority, the security model and major dependencies. These come to the user as
a recommendation with the reasoning, and the decision is recorded in an issue
or ADR so it survives the conversation. Otherwise the user wants the work to
proceed without him or her. Ready work in the DAG gets done.

A question is worth the user's attention when the outcomes differ in a way the
user would care about and you cannot tell which he or she would choose.

## Issues and documentation

Work is tracked as issues in `issues/<slug>/`, managed with `issuectl` through
the `/issue` skill. The DAG is the schedule; `TODO.md` is only the story around
it. Plans, experiments and results live with their issue. Project documentation
is in `docs/`, starting at `docs/index.md`, and `docs/AGENTS.md` says how it is
written. Subdirectory `README.md` files are reserved for the public front door,
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
