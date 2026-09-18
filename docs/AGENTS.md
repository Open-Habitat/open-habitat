# docs/ — Native Agent Host Project View

`docs/site/` is the maintained Glasspad architecture view. Markdown in that directory is the publishable source; there is no generated content tree. This file owns the site's structure, authority rules, maintenance triggers, and validation procedure.

## Layout and publication boundary

```text
docs/
  AGENTS.md                     maintenance contract; not published
  CLAUDE.md -> AGENTS.md
  validate-project-view.py      deterministic project-specific validator
  site/                         complete publishable Glasspad space
    .glasspad.yaml              exactly `space_key: native-agent-host`
    glasspad.yaml               structure-only grouped navigation
    index.md
    architecture.md
    decisions.md
    evidence.md
    implementation.md
    status.md
```

`docs/site/` is the explicit exception to the repository's per-directory `AGENTS.md` / `CLAUDE.md` rule. It must contain neither instruction files nor symlinks. Glasspad scans only top-level Markdown/HTML and `assets/`; publishable pages therefore remain flat and use lowercase `[a-z0-9-]` slugs. Accepted ADRs, when real decisions exist, use top-level `adr-NNNN-<slug>.md` names. Do not pre-create ADRs.

Repository `.glasspad.yaml` pins only stable space identity. Target, server, and credentials must continue to come from the user's environment; never add them here or modify user/global Glasspad configuration.

## Source-of-truth rules

- Evidence reports own observations, methods, revisions, findings, and limitations.
- Accepted ADRs own choices, rationale, consequences, and rejected alternatives.
- `architecture.md` owns the integrated current architecture model. Before architecture v1 it must label provisional material honestly.
- `decisions.md` is a register and gate index, not a second rationale store.
- `evidence.md` is a revision-pinned index, not a findings summary.
- `implementation.md` owns architecture milestones and proof interpretation, never scheduling.
- `status.md` is the **only** reader-facing current-state narrative.
- `index.md` owns navigation and reading paths only.
- issuectl owns executable task state, dependencies, lanes, ordering, and spawnability.
- Git and closed issues are the default archive. Do not create per-stint pages.

Every publishable page must declare near its top:

- `Authority:` — what the page owns;
- `Updates when:` — the event that makes an edit necessary;
- `Not the source for:` — facts owned elsewhere.

Derived/index pages link to owners and avoid long paraphrases. Research does not become accepted architecture merely because `evidence.md` links it.

## Event-to-document contract

| Event | Required updates | Explicit non-updates |
|---|---|---|
| Research report or dossier lands | Add/update one `evidence.md` row with exact revision, scope, limitations, and canonical link. If accepted architecture is challenged, expose the owning gate in `decisions.md`. | Do not turn a research recommendation directly into normative architecture. |
| Architecture synthesis completes | Update `architecture.md`, affected gates, milestone interpretation, and `status.md` as needed. | Do not copy report bodies or create audience companions. |
| ADR accepted | Add its page and manifest entry; add one register row; integrate the affected architecture section; update implementation only if proof shape changed. | Do not rewrite evidence reports or create companion pages. |
| ADR superseded | Add the replacement; mark the old ADR superseded; update register and architecture. | Never rewrite or delete the old rationale. |
| Implementation slice completes | Update issue/evidence first; update `implementation.md` only for milestone proof; update `status.md` only for a reader-visible change. | Do not copy the issue queue or edit ADRs without a changed decision. |
| Stint handoff or wrap-up | Make issue state durable; refresh `status.md` only if reader-visible state changed, including its landed project-state baseline revision; run both validations below. | No archive page, home rewrite, or full-site churn by default. |
| New page proposed | Identify its unique authority, reader, and trigger before adding a top-level page and one manifest entry. | Do not split for symmetry or create generators/placeholders. |
| Publish | Validate first, then publish the complete `docs/site/` from the intended landed branch while `docs/site` is the working directory so its stable space key is loaded. | Publication never mutates source or proves freshness by itself. |

## Validation

Run from the repository root:

```sh
python3 docs/validate-project-view.py
glasspad build --dry-run --json docs/site /tmp/native-agent-host-project-view
```

For a full no-publish render, use an empty temporary output directory:

```sh
out="$(mktemp -d)"
rm -rf "$out"
glasspad build --json docs/site "$out"
rm -rf "$out"
```

The repository validator checks stable config, flat page names, symlinks, manifest/page parity, duplicate navigation entries, local links, authority declarations, the six required pages, ADR naming/registration, and the status date/source revision. Glasspad remains authoritative for its own scan and rendering constraints.

`status.md`'s source revision means the latest **landed project-state baseline used to write its narrative**, not the commit containing the page itself. Refresh it whenever the narrative is refreshed from newer landed state. This avoids a self-referential commit hash while keeping the summarized evidence auditable.

Do not run `glasspad publish` from an autonomous worktree. Publication is an explicit post-landing action from the complete source branch. Glasspad finds repo-local config by walking upward from the current working directory, so the post-landing command is:

```sh
(cd docs/site && glasspad publish .)
```
