---
created: 2026-09-18
updated: 2026-09-18
type: task
reporter: jari
status: done
priority: high
epic: native-agent-host-architecture
lane: benchmark-fixture
lane_seq: 10
closed: 2026-09-18
closed_by: pi
---

# Prepare agent host benchmark fixture

## Goal

Prepare the reusable, candidate-neutral benchmark fixture specified by `issues/native-agent-host-architecture/synthesis-and-architecture-review.md` §7, without selecting or benchmarking a protocol.

## Scope

Create an executable scaffold under `benchmarks/agent-host/` for later minimal-custom, AHP, ACP, AG-UI and LangChain adapters. Keep the fixture loopback-only, deterministic, synthetic and dependency-light. Reuse the repository's existing Python precedent unless strong repository evidence requires another choice; document the decision as reversible fixture plumbing, not an architecture ADR.

The scaffold must provide:

- machine-readable fixture and scenario descriptors for B1–B8 with the frozen actors, tenants, policy, repository, safety limits, expected observables and stop conditions;
- deterministic synthetic repository and scripted-provider/extension fixtures;
- a fake orchestrator that alone owns disposable runtime/workspace lifecycle and supports success, failure, timeout-before-side-effect and timeout-after-side-effect injection with stable IDs;
- synthetic Alice/Bob and school-a/school-b authorization/policy inputs, without implementing production auth;
- an inspectable durable evidence store/schema and sanitized evidence-bundle writer for attempts, events, policy decisions, artifacts and native bindings;
- an adapter contract and candidate result format that preserve native events plus normalized observations and category-aware NA/delegated/not-exercised states;
- deterministic self-tests and an AI-first non-interactive JSON CLI/preflight surface. Read and follow the installed `/ai-first-cli-canon` skill before designing that CLI.

Do not implement a real agent-host product, contact providers, install global software, open public listeners, execute candidate protocols, or claim any B1–B8 benchmark result. A preflight/self-test validates fixture integrity only.

## Done criteria

Document setup, architecture, safety, extension points and exact commands in `benchmarks/agent-host/README.md`. Provide a version manifest and bounded sample evidence. Run all fixture tests, `python3 docs/validate-project-view.py`, and any new deterministic validation command. Close this issue as done and merge through the owning Taskfleet run. Do not edit the parent epic or Project View; a dedicated integration pass will update shared files after sibling work lands.
