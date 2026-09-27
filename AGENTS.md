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
  history store, our own credential broker or speculative caches. Features are
  added when a real need appears.

## How work proceeds

The project is in pre-release and moves fast. Implementation is carried as far
as the task allows, problems found along the way are fixed, and releases are
cut and installed on the test server as part of normal work. Jari authorizes
agents to build and deploy green, reviewed changes to the **test server** without
a separate go/no-go question; this does not authorize production deployment,
credential exposure, bypassing Access, or testing with another person's identity.
Use Fleetrepo's `infra/native-agent-host-test/RELEASE-UPGRADE.md` for the exact
stage/switch/rollback and live verification procedure, with deployment receipts
and host-specific details kept in Fleetrepo. A failed preflight or uncertain
rollback is a stop, not permission to improvise. There are no users to stay
compatible with, so formats, interfaces and data change freely without
compatibility code.

Architecture is decided together with Jari: which component has which
authority, the security model, the browser/host contract and major
dependencies. These come to him as a recommendation rather than being settled
quietly in code.

Evidence is reported as it is. A synthetic guest is not a live host and a mock
is not an integration, and the next person needs to know which one they are
looking at.

## Architecture

The product is one Go module/binary plus one browser package in `web/`.

- `internal/gateway` owns same-origin HTTP, OAuth/session/CSRF and routing to the
  mapped daemon. It never reads user homes or runs agents.
- `internal/daemon` runs as one Unix UID and owns native discovery and agent
  child processes. It never chooses a web identity.
- `contracts/v1/` is the authoritative browser/host contract. `internal/contracts/`
  and `web/src/contracts/` are generated from it.
- `web/src/components/` holds the production components used by both the app
  and Storybook. The UI is desktop-first and builds its interaction from these
  shared components, so behavior stays consistent across views.
- `systemd/`, `sysusers.d/` and `tmpfiles.d/` are neutral package templates.

`./scripts/ci-local.sh --clean --json` is the complete check that a change is
ready to land.

## Issues and documentation

Work is tracked as issues in `issues/<slug>/`, managed with `issuectl` through
the `/issue` skill; the DAG is the schedule. Plans, experiments and results live
with their issue. Project documentation is in `docs/`, starting at
`docs/index.md`. Content that would go in a subdirectory `README.md` belongs in
that directory's `AGENTS.md` instead; each `CLAUDE.md` is a symlink to it.
CLI work follows the AI-first CLI canon (`/ai-first-cli-canon`), tracked in
`CONFORMANCE.md`.

## What must hold

- **Real people.** Only people who have agreed sign in, and their credentials
  never travel over a channel whose other end has not been authenticated.
- **The internet.** Anything reachable from outside has real access control in
  front of it; an obscure or noindexed URL is not access control.
- **The repository will be public.** Host-specific facts such as addresses, IDs,
  users, secrets and deployment receipts live in Fleetrepo
  (`~/Sources/fleetrepo/infra/native-agent-host-test/`).
- **Tests stay synthetic.** Tests and fixtures never touch a real home, Pi
  history, SSH agent, browser profile or credentials, and test fixture mode
  (`VITE_ENABLE_TEST_FIXTURES`) never reaches a production build.

## Work sessions

The session conducting a work round finds the current situation in
[TODO.md](TODO.md) and how rounds run in this repository in
[AGENTS-WORKFLOW.md](AGENTS-WORKFLOW.md).

## These instructions

These files describe intent and the reasons behind it, not a list of
procedures. Details of a single incident belong in its issue. When a lesson
changes how we work, the relevant section is rewritten so the whole stays short
and coherent.
