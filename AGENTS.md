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

The product is one Go module and binary plus the browser package in `web/`.
Three authorities are kept apart on purpose. `internal/gateway` authenticates a
browser and decides which Unix user it is talking to; it never reads a home or
runs an agent. `internal/daemon` runs as that one UID and does that user's
work, trusting nothing the browser or the gateway asserts about identity.
`internal/provision` is the root-only broker that creates an account on first
approved login and does nothing else. If any of these could do another's job, a
bug in one would become a bug with the others' access, which is why moving an
authority between them is an architecture change rather than a refactor.
`internal/AGENTS.md` walks the boundaries and their traps; `docs/architecture.md`
and the ADRs under `docs/` carry the reasoning.

`contracts/v1/` is the browser/host contract as both sides have to see it.
`internal/contracts/` and `web/src/contracts/` are generated from it, and the
gate fails on drift. `web/src/components/` holds the production components that
both the app and Storybook import, so a story shows the real component rather
than a copy. `systemd/`, `sysusers.d/` and `tmpfiles.d/` are neutral package
templates; the concrete installation is Fleetrepo's.

`./scripts/ci-local.sh --clean --json` is what "green" means, and a change is
ready to land when it passes. `scripts/AGENTS.md` says what it runs and, as
importantly, what a pass does not prove.

## How work proceeds

The project is in pre-release and moves fast. Implementation is carried as far
as the task allows and problems found along the way are fixed. There are no
users to stay compatible with, so formats, interfaces and data change freely
without compatibility code.

Cutting a release and installing it on the test server is ordinary work and
does not wait for a go/no-go from Jari. The reason for care is not the
installation, which is replaceable, but what sits behind it: real people's
accounts and native history on that host, and a route from the internet.
Fleetrepo's `infra/native-agent-host-test/RELEASE-UPGRADE.md` is the procedure,
with receipts and host facts kept there. It exists so that we always know
exactly which bytes are running and can go back to the previous release. When
its preflight fails or the way back is unclear, stop and report; improvising on
a host with real accounts on it risks exactly what the procedure protects.
There is no production deployment yet, and standing one up is Jari's decision,
not an extension of the test-server routine.

Architecture is decided together with Jari: which component has which
authority, the security model, the browser/host contract and major
dependencies. These come to him as a recommendation with the reasoning, and
the decision is recorded in an issue or ADR so it survives the conversation.
Otherwise he wants the work to proceed without him. Ready work in the DAG gets
done; a question is worth his attention when the outcomes differ in a way he
would care about and you cannot tell which he would choose.

Evidence is reported as it is. Claims about isolation here rest on layers with
different reach: a unit test, a disposable QEMU guest, a browser test against a
synthetic host and a live host each prove something different. A synthetic
guest is not a live host and a mock is not an integration. Say what was
verified, at which revision, and what was not, so the next person knows what
they are looking at.

## What is at stake

Four things here are precious enough to state as limits, each with its reason.

- **Real people.** Only people who have agreed sign in, and a real person's
  identity is used only with that person's own participation. Their credentials
  never travel over a channel whose other end has not been authenticated.
- **The internet.** The test server is reachable from outside. Anything
  reachable has real access control in front of it; an obscure or noindexed URL
  is not access control, and the access-control layer in front of the test host
  is not something to route around for convenience.
- **Public history.** The repository will be public and its Git history is
  permanent. Host-specific facts such as addresses, IDs, users, secrets and
  deployment receipts live in Fleetrepo under `infra/native-agent-host-test/`; a
  real value pasted here once stays for good.
- **Synthetic tests.** Tests and fixtures never touch a real home, Pi history,
  SSH agent, browser profile or credentials, for the same reason and so that
  they run on any machine. Test fixture mode (`VITE_ENABLE_TEST_FIXTURES`) never
  reaches a production build, because a fixture flag on a build meant for the
  host would ship test seams to the internet; the gate greps `web/dist/` and
  the packaged release for it.

Worktrees, guests, release archives and temporary files are disposable and
need nobody's permission.

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
