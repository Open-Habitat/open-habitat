---
created: 2026-09-23
updated: 2026-09-23
type: task
status: open
priority: high
epic: native-agent-host-architecture
lane: planning
lane_seq: 80
collision: [docs/, AGENTS.md, design-system/]
---

# Apply implementation review corrections

## Goal

Apply Jari's 2026-09-22 implementation-readiness decisions to the proposed ADRs, contracts, production design, implementation briefs, downstream issues and repository workflow before `review-implementation-plan` closes. This is a specification/planning correction, not product implementation.

## Accepted decisions to encode

- Keep React, React Router and the selected UI stack, but target the scaffold-time stable TypeScript 7 only if Vite, React types, lint, Storybook and all tests install and pass without forced peer graphs or disabled checks. A failure returns to review instead of silently pinning TypeScript 6.
- Every user-visible UI feature requires deterministic happy and relevant unhappy-path tests plus a Markdown acceptance report linking essential Playwright screenshots, exact revision, environment, scenarios and command results. Jari is the human acceptance gate. Define safe issue/DAG gates rather than letting implementation workers self-accept UI behavior.
- Replace Proposed ADR 0003's Rust gateway/daemon with one Go codebase and one Go binary providing both roles. Preserve OIDC/OAuth, Unix identities, systemd sockets, `SO_PEERCRED`, direct Pi child ownership, native history, release and Fleetrepo boundaries. Select Go on technical/developer-feedback grounds, not current Alder tool availability, and replace Rust-specific commands/evidence with a proportionate Go walking slice and pinned stable version.
- Keep the accepted restart semantics: browser/gateway loss does not stop Pi; daemon or host loss stops active computation while native session history remains resumable after writer-exit/history-settlement proof.
- Retain the accepted production design, but once production implementation replaces source mocks, remove obsolete canonical/root references and keep originals at most under their receiving issue. Use shared primitives/product components for all interactive and repeated UI behavior; allow local composition without ad hoc controls, state semantics, focus rules or styling.
- Accept the specified retention/history limits and CG-01..CG-04.
- Title input is the unique union of at most the first four and last four user messages. Add an accessible title-adjacent manual regenerate control with capability, pending, concurrency and nonblocking-failure behavior. Keep the accepted automatic first/third-message policy and other cost/output bounds unless correction evidence requires review.
- Replace Google-only pilot authentication with provider-based login. Alder's primary path is one `Sign in with GitHub` authorization that both establishes the web identity/session and configures the mapped Unix user's native `gh` HTTPS credential helper, so ordinary `git pull`/`git push` work without SSH keys. The gateway may handle the OAuth token only transiently during callback, must never log/persist/send it to the browser, and forwards it once over the authenticated local hop to the mapped daemon; the daemon installs it through supported `gh auth login --with-token --git-protocol https` and `gh auth setup-git` behavior. Web logout preserves native agent Git continuity; explicit disconnect explains and removes native `gh` auth. Google remains an optional configured provider and makes no request before explicit selection.
- Remove the separate large two-user GitHub write campaign. Keep ordinary deterministic fixtures, cross-user isolation tests, one practical private disposable-repo smoke during feature acceptance, and Jari's screenshot review. GitHub/gh owns normal permission behavior; the product owns safe paths, correct Unix identity, staged truth and secret handling.
- Native Agent Host owns generic installation, configuration, test-environment, update, rollback and operator guidance that any user can use to build a Alder-like host. Fleetrepo owns only Jari's concrete Alder state. During MVP, coordinate the separate Fleetrepo issue/worktree from this repo, but never mutate Fleetrepo as an undocumented side effect.
- Do not create the 0.1 public-cleanup issue yet. Add an explicit release-readiness trigger: when 0.1 is ready to publish, the conductor files an issue in this repo to remove Alder-specific references from Git HEAD while retaining generic self-hosting instructions and issue-local historical evidence.

## Acceptance Criteria

- [ ] Rewrite ADR 0003, architecture, decisions, implementation and review material to select Go consistently; add focused primary evidence and a disposable Go socket/process walking slice; remove Rust as the proposed product runtime without falsifying historical issue evidence.
- [ ] Update ADR 0002 and foundation/downstream briefs for stable TypeScript 7 compatibility gating and Jari's screenshot-based UI acceptance workflow.
- [ ] Define and schedule human acceptance gates for each user-visible UI slice without duplicating issuectl's DAG or leaving non-executable statuses in lanes.
- [ ] Update production-design/component guidance and downstream ownership for component-only interactive/repeated behavior and retirement of superseded root/canonical mock references after replacement.
- [ ] Update contracts, examples, scenarios and design for first-four/last-four title input and the accessible manual regenerate control.
- [ ] Update identity, auth, secret, session and native credential contracts for the one-step GitHub OAuth→web session→native `gh` HTTPS helper flow, optional Google provider, transient gateway token boundary and explicit disconnect semantics.
- [ ] Replace the large GitHub proof campaign with the accepted focused test/smoke/visual evidence boundary while preserving cross-user security tests.
- [ ] Add generic self-hosting documentation ownership, MVP cross-repo Fleetrepo coordination and the future 0.1 Alder-reference-cleanup trigger without filing that future issue early.
- [ ] Update `review-implementation-plan`'s decision record/package with Jari's eight actual decisions and exact corrected revisions; keep the human gate open until this correction lands and validates.
- [ ] Run all repository, contract, plan and reservation-aware DAG validators; leave no missing blockers/cycles, non-executable lane members or lane-assigned human review.

## Delivery

Record exact changed artifacts, commands, evidence and remaining implementation proofs in `result.md`. No runtime scaffold, machine installation, Fleetrepo edit or deployment. Close this correction only when the review gate can safely record acceptance against the corrected landed revision.

## Decisions

### 2026-09-23T06:23:41Z · @jari

TypeScript 7 compatibility amendment, 2026-09-23: replace the incompatible ESLint/typescript-eslint proposal with a Biome-based formatting and linting stack if and only if stable TypeScript 7 plus Vite, React, Storybook, Vitest, Playwright, Axe, Biome and `tsc --noEmit` install and pass cleanly without forced peers, disabled checks or nightly TypeScript. Verify adequate React Hooks and JSX accessibility rule coverage; any unresolved gap blocks rather than silently downgrades.
