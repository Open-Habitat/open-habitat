# open-habitat

Open Habitat is a multi-user web host for native AI agents. A person signs in
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
broker that only creates an account on first approved login. Kept apart, a bug
in one of them is not a bug with the reach of the others. Moving authority
between them is therefore an architecture change, however small the diff;
`internal/AGENTS.md` explains the boundaries.

`contracts/v1/` is the browser/host contract. `internal/contracts/` and
`web/src/contracts/` are generated from it, and `scripts/check-generated.sh`
fails on drift, so a change to the wire starts in the schema.
`systemd/`, `sysusers.d/` and `tmpfiles.d/` are neutral templates; an
installation supplies its own values, as `docs/operations.md` describes.

[TESTING.md](TESTING.md) says which tests to run and what each result proves.
Each directory's `AGENTS.md` carries the rules of its own area.

## How work proceeds

The project is in pre-release and moves fast. Implementation is carried as far
as the task allows and problems found along the way are fixed. Formats,
interfaces and data still change freely without compatibility code.

What the maintainer wants a say in is architecture: which component has which
authority, the security model and major dependencies. Such a change comes as a
recommendation with the reasoning, in a GitHub issue or Discussion, before
code is built on it, and the decision is recorded in an issue or ADR so it
survives the conversation until the code carries it. Otherwise work proceeds
without asking. A question is worth the maintainer's attention when the
outcomes differ in a way they would care about and you cannot tell which they
would choose.

## Reports and evidence

Reports arrive through GitHub Issues and Discussions, and changes through pull
requests. `issues/` is not a second front door: it is the tracker of accepted
work, managed with `issuectl` through the `/issue` skill, and its DAG
(`issuectl dag`) is the schedule. A report accepted as work is filed with
`issuectl intake file`, giving the report's canonical GitHub URL as
`--source-ref`, which is what keeps the same report from being filed twice.
Intake leaves it without a lane; scheduling is a separate triage decision.

Problems in this product are usually met on a real installation, so the
evidence nearest to hand belongs to real people: a customer's or pilot's
name, a household or personal hostname, an IP address, an account, a home
path, a personal record, a conversation, a screenshot. None of it, nor any
other detail of a particular installation, goes into what is written for the
project, whether an issue with its slug and file names, a GitHub comment, a
commit message, a prototype or an attachment: a comment is public the moment
it is posted, and git keeps what was committed after it is deleted. The
public text describes the generic product failure and reproduces it with
synthetic tenants, accounts, messages, paths and screenshots. A blurred or
redacted capture is still a capture of a real installation; the original
stays with whoever owns it. For the same reason a reporter is asked for steps
that reproduce the problem, not for dumps of their installation, and a report
or pull request is read for such material before any of it enters the tree.
Jari Mustonen's name in copyright lines, decision attributions and his own
commit metadata is deliberate, and is no precedent for real addresses in
fixtures or examples.

A security problem goes to GitHub's private vulnerability reporting, not to a
public issue, which would describe the hole to everyone before the people
running a host can close it.

## Code is the record

The code is the single source of truth for what the system does, and the
repository keeps no second description of it. A description that repeats
the code drifts the moment the code changes and nobody has to correct it,
and the contradictions it leaves are what made an earlier generation of
these documents untrustworthy. So the tree holds only what exists nowhere
else and has an owner who notices when it goes stale:

- the code, with comments that say why where the code cannot;
- instructions (`AGENTS.md` files, `TESTING.md`, `CONFORMANCE.md`), which
  include the rules the code cannot show, such as what must never be built or
  which component must never hold an authority;
- work that is not yet code: open issues, and a decision or design still
  waiting for its implementation;
- what comes from outside the repository: Jari's product goal in
  `docs/product.md`, the visual direction he agrees with the designer in
  `design-system/`, and the operator guide in `docs/operations.md`.

Everything else is working material. Issues, ADRs, plans, research, prototype
rounds, evidence and one-off scripts are committed while the work is under
way, so that contributors and the maintainer can read them, and removed once
the code carries the result; rules the code cannot show move into the nearest
`AGENTS.md` first. A missing issue directory or ADR is therefore usually
finished work, not lost work. A closed issue's directory stays only while an
open issue still names it, and `scripts/prune-closed.py` lists the removable
ones and removes them with `--apply`.

The intent then lives in git history, reached from the code: a commit's
`Refs-Issue`/`Fixes-Issue` trailer names its issue, and a comment or document
may name a removed file by its repository path (`ADR 0019` means
`docs/decisions/adr-0019-*.md`). `scripts/from-history.sh <path>` prints such
a file as it was last committed; `git log --all -- <path>` lists its history.
The public history was rewritten from an earlier private one: material about
particular installations, screenshots and evidence was removed from every
commit, so a name that pointed at such a file finds nothing, and the comment
that carries it has to be read on its own. A Markdown
link always points at a file that exists; a reference into history is a plain
path or name.

Instructions never point at an issue, open or closed, because the issue will
be removed and the instruction will not: an instruction states the rule
itself, and `scripts/validate-project-view.py` rejects an `issues/<slug>` path
in one. A comment on an issue earns its place only by telling a later reader
something the issue text, metadata and git do not already say;
acknowledgements, restated status and soon-stale delivery details are noise.

Subdirectory `README.md` files are reserved for the public front door, so
content for agents goes in that directory's `AGENTS.md`; each `CLAUDE.md` is a
symlink to it, so edit the `AGENTS.md`. CLI work follows the AI-first CLI
canon (`/ai-first-cli-canon`), tracked in `CONFORMANCE.md`. The vendored canon
excludes upstream maintenance provenance, which is authoring context rather
than public canon content.
After `project-canon skill install --target <repo>`, remove that maintenance
comment from both harness copies if the installed release still emits it;
`scripts/validate-project-view.py` rejects its return. Keep the installation
metadata and canon sections intact.

## These instructions

These files describe intent and the reasons behind it, not procedures. Details
of a single incident belong in its issue. When a lesson changes how we work,
the relevant section is rewritten so the whole stays short and coherent.
