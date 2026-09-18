---
created: 2026-09-18
updated: 2026-09-18
type: task
reporter: jari
status: open
priority: normal
epic: native-agent-host-architecture
lane: unlaned
---

# Study aggountant architecture documentation workflow

## Goal

Study how the local `aggountant` project structures, publishes, and continuously maintains its architecture Project View, then design an equivalent documentation approach for native-agent-host's architecture choices.

## Source

Inspect `/home/maintainer/Sources/aggountant` at an explicitly recorded Git revision. Read its repository and `docs/` instructions completely before drawing conclusions. Examine the actual `docs/site/` structure, Glasspad manifests/configuration, architecture/spec/ADR pages, audience-specific companion pages, current-state and stint archives, implementation DAG, issue/TODO links, and relevant Git history or workflow instructions.

## Questions

- What are the information architecture and intended reader journeys?
- Which files are normative, derived, current-state, archival, or navigation-only?
- How do ADR acceptance, implementation work, stint handoff, wrap-up, and publication keep the site current?
- What is automated, contract-enforced, manually curated, or merely conventional?
- Which parts transfer well to native-agent-host and which are accounting-project-specific or accumulated complexity?
- How should native-agent-host present architecture alternatives, evidence, decisions, audience views, implementation status, and current state without duplicating facts across pages?

## Deliverable

Write an engineer-facing English analysis and concrete recommendation to `issues/native-agent-host-architecture/research/aggountant-project-view-analysis.md`. Include:

1. source-grounded description of the existing system and maintenance lifecycle;
2. strengths, failure modes, and maintenance costs;
3. a proposed native-agent-host `docs/site/` information architecture;
4. source-of-truth and derivation rules;
5. an explicit event-to-document maintenance matrix;
6. a minimal adoption sequence that can be decided after the current architecture research wave;
7. open decisions and migration/implementation tasks.

Do not create the native-agent-host documentation site yet or copy aggountant mechanically.

## Acceptance criteria

- Every factual claim about aggountant cites a concrete file, command, commit, or observed repository behavior.
- The inspected revision and working-tree state are recorded.
- The recommendation clearly separates reusable pattern from project-specific detail.
- Proposed ownership and update triggers make documentation drift detectable.
- The output is suitable as an input to the upcoming architecture synthesis/review.
