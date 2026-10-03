---
created: 2026-10-03
updated: 2026-10-03
type: task
reporter: jari
status: open
priority: normal
related: ['@decide-logging-policy', '@create-architecture-project-view']
labels: [docs]
lane: architecture-docs
---

# Rewrite the architecture documentation as a present-tense system description

## Why

The architecture picture every agent needs is spread over `architecture.md`, `interfaces.md`, `conversation-data-flow.md`, `daemon-bindings.md`, `pi-runtime.md`, nine ADRs, `implementation.md` and `internal/AGENTS.md`. The pages are organised by decision history and acceptance state: they say what was agreed and when, distinguish implemented from planned on every page, defend rejected alternatives, and carry dates, revisions and review status. A reader who wants to know how the system works today has to reconstruct it from all of them. Jari reviewed the set on 2026-10-03 and chose a rewrite of the architecture pages over patching, because the skeleton is wrong, not the sentences.

## Target

A new `docs/architecture/` set in English that describes the system as it is, in the present tense, with Mermaid diagrams in the Markdown. Reasons stay as reasons ("the gateway cannot read homes because a bug in the component that parses browser traffic must not become access to files"), never as decision minutes. What is not built is not described, except for one short "not in the system" list on the overview page.

| Page | Content | Diagram |
|---|---|---|
| `index.md` | The two principles, the three authorities, what runs where, reading path, what the system does not have (other harnesses, several servers, terminal takeover, tenant object) | component diagram |
| `components.md` | Gateway, daemon, broker, browser, native tools (Pi, Git, `gh`, tmux, Taskfleet, systemd): what each owns, must never do, and trusts. The "information and its source" table | |
| `identity-and-trust.md` | GitHub OAuth and optional Google OIDC, broker binding, session cookie and CSRF, socket verification and the `SO_PEERCRED` trap, binding files, Pi runtime selector, `gh` credential handoff | first-login sequence; ordinary request sequence |
| `conversations.md` | `pi:<id>` identity, one writer and the flock, lifecycle and states, start/send/steer/follow-up/clear/abort/stop/continue, continuation proof, Pi extension dialogs, terminal histories read-only | state diagram |
| `events-and-recovery.md` | Snapshot plus SSE journal, cursors and replay, live tail versus native history, the browser store (Redux vs conversation store, journal, pager), disconnection, daemon restart, the clone-stream exception | disconnection and recovery sequence |
| `workspaces.md` | `~/src` discovery and the mount, annotations, Git and Taskfleet facts, GitHub repository listing and clone | |
| `http-api.md` | Implemented routes, error codes, versioning rules, pointer to `contracts/v1/` | |
| `deployment.md` | Processes and systemd units, sockets, files on disk (`/etc`, `/opt`, XDG state), immutable release versus user data | process and filesystem diagram |

Writing rules for the set:

- Present tense. No dates, revisions, acceptance states, "agreed", "planned", "not yet", "toistaiseksi", "transitional".
- Every claim checked against the current source before it is written; the old pages have drifted.
- Constants (timeouts, window sizes) only where they shape behaviour the reader must know; otherwise point to the code.
- Code pointers at package level, sparingly. File names drift.
- Each page opens with what happens, then the diagram, then sections. Paragraphs carry one idea.
- A one-line footer may list the ADRs behind the page. ADRs are not linked inline.

## What happens to the existing pages

- `architecture.md`, `interfaces.md`, `conversation-data-flow.md`, `daemon-bindings.md`, `pi-runtime.md`, `implementation.md`: content absorbed into the new set, pages deleted.
- The agreed but unimplemented general command and operation contract in `interfaces.md` moves to `issues/build-agent-control/` as planning material.
- ADRs move to `docs/decisions/adr-NNNN-*.md`; `decisions.md` becomes `docs/decisions/index.md`, an index only. ADR content stays as written; it is the history layer.
- `status.md`, `assumptions.md`: deleted. `TODO.md` and the issues carry status; open verifications become issues or notes in the issues that own them.
- `evidence.md`: moved to `issues/native-agent-host-architecture/research-index.md`.
- `logging.md`: moved to `issues/decide-logging-policy/proposal.md` and deleted from docs (see @decide-logging-policy).
- `reviews/architecture-review-2026-10.md`: moved to `issues/architecture-built-on-caution/`.
- `product.md`, `ui.md`, `design-system.md`, `brand/`: unchanged in this issue.
- `internal/AGENTS.md`: shortened to pointers into the architecture set plus the traps that only matter when editing code (build tags, skipped tests). Package descriptions live in `components.md`.
- `docs/AGENTS.md`: rewritten for the new layout and the writing rules above. `docs/index.md`: rewritten as the site front page.
- `scripts/validate-project-view.py`: required-page set, ADR location and status-metadata checks updated. `docs/glasspad.yaml`: regenerated for the new pages.
- Root `CLAUDE.md`/`AGENTS.md` and `TESTING.md` references to moved pages updated.

## Acceptance

- `python3 scripts/validate-project-view.py` and `git diff --check` pass; no dangling links in `docs/`, `internal/`, root instruction files or TESTING.md.
- Every page in `docs/architecture/` follows the writing rules; a grep for the banned vocabulary finds nothing.
- Each diagram renders on GitHub.
- A spot check of ten claims per page against the source finds no drift.

## Decisions

- 2026-10-03 Jari: rewrite rather than patch; English for the architecture set; Mermaid in Markdown. Glasspad's lack of Mermaid rendering is handled in Glasspad, not here.
