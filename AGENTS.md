# native-agent-host

Multi-user web platform for hosting native AI agent sessions and application-specific agent interfaces.

## CLI Design Principles

This project follows the AI-first CLI conventions — strict input validation, `--json` output, JSONL logs, no interactive prompts, informative errors, and composable commands. Use the `/ai-first-cli-canon` skill installed by `project-canon skill install` whenever designing or changing CLI surface. The installed, versioned skill is authoritative; do not maintain a repo-local canon copy.

## Gitignored directories

- `history/` — agent scratchpad and ephemeral planning docs (not tracked)
- `/target` — Rust build artifacts

## Documentation Pattern

Every directory follows this structure:

- `CLAUDE.md` — symlink to `AGENTS.md`
- `AGENTS.md` — all AI-relevant info (consolidated)
- `AGENTS-<TOPIC>.md` — complex topics split out (optional)

Exception: `docs/site/` is the complete publishable Glasspad space. It contains no
agent instruction files or symlinks; `docs/AGENTS.md` governs it from one level up.

## Issues & Planning

Issue tracking is managed by [`issuectl`](https://github.com/example-org/issuectl). Use the `/issue` skill (installed by `issuectl init`) to create, search, update, and close issues.

- `issues/<slug>/item.md` — every issue and epic (flat layout — no numeric prefix, no `open/closed/` split)
- Status lives in the `status:` frontmatter field, not in the path

All planning documents belong under their parent issue directory — not as standalone files. **Open an issue before building a feature**; keep this file describing the repo, not pre-designing the tool.

## Conformance

`CONFORMANCE.md` tracks this repo against the AI-first CLI canon — flip each row to `pass` as the surface lands. Verify mechanically with `project-canon doctor`.

## Work-session handoff

`TODO.md` is the root handoff narrative for `/stint-start`: current context,
external design work, local changes and verification/deployment guidance.
Detailed plans stay under their parent issue. Issuectl lane/dependency metadata
is the only execution schedule; do not derive a second queue from TODO.md.
External designer delivery has no executable lane. Later UI features are deferred
and unscheduled until selected. See the current handoff before starting a stint.
