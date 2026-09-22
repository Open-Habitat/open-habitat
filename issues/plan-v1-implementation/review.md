# Implementation-readiness review package

**Recommendation:** accept the bounded v1 plan, Proposed ADR 0002 and Proposed ADR 0003 with the explicit operator-CLI naming correction, accept the production design, and accept the contract policies below. Then let `build-app-foundation` make the proposed commands and four additive contract corrections executable before any product slice.

This is a decision package, not acceptance. Record Jari's actual decision and the exact landed revision in `review-implementation-plan`.

## Review these exact inputs

- [Accepted UI v1](../review-ui-v1/review.md) — revision `9732ffbd3ff0af37911b84b86f321808e482c13b`
- [Proposed ADR 0002](../../docs/adr-0002-frontend-stack.md) — revision `ffdf0e6eeb46aa44055b52569775d20956db1a01`
- [Proposed ADR 0003](../../docs/adr-0003-host-stack.md) — revision `958f974f1c9f1ac47af48b69a738bed7bfb1128b`
- [Host contract meaning](../../docs/interfaces.md), [schemas/examples/scenarios](../../contracts/v1/AGENTS.md) — revision `311a354a3aaf222c3d9261468d379f8c0788599b`
- [Production design](../../design-system/production-v1.md), [catalog](../../design-system/component-catalog-v1.md), [static reference](../../design-system/ui_kits/production-v1/index.html) — revision `62c0ae6833301bcdd0901053ea08ef514a929153`
- [Pi native probe](../probe-pi-control/result.md) — revision `4187da0ec40079ec09d98539c03f840102cde616`
- [Workspace/GitHub/Taskfleet probe](../probe-workspace-lifecycle/result.md) — revision `c1e06b0af9a2835106b5f27277dd1de31766856a`
- [Bounded implementation briefs](implementation-briefs.md) and [criterion map](implementation-briefs.md#success-criterion-ownership-map) — this delivery's landed revision

## Decisions requested

### 1. ADR 0002

**Recommend accept.** React 19.3, strict TypeScript 6.0, Vite, React Router, one Redux event model, React Aria wrappers, sanitized Markdown, lazy Shiki, parsed Pi-edit diffs, bounded virtualization plus a paged accessible mode, Storybook/Vitest/Playwright/Axe. Keep the lockfile and tested Node 22.23.2 pin. Recheck the ESLint peer graph at scaffold time rather than forcing an unsupported combination.

Acceptance is conditional on the foundation and later browser proofs in the brief; the static JSX/HTML does not prove runtime behavior.

### 2. ADR 0003

**Recommend accept with one naming correction.** Keep one locked Rust workspace/artifact, fixed non-root gateway, OIDC Authorization Code + PKCE, server-side sessions, exact issuer/subject mapping, same-origin CSRF, systemd-created per-user sockets, `SO_PEERCRED`, direct daemon-owned Pi children, native history, immutable releases and Fleetrepo-owned Alder state.

Use the AI-first CLI surface in `implementation-briefs.md`: `config path/show`, `doctor --component`, `gateway exec`, `daemon exec`, `admin readiness show`, `maintenance enter/leave`, global `--json`, structured errors and JSONL diagnostics. This supersedes the ADR's provisional `check-config`/`admin readiness` spelling without changing architecture.

Accept the documented limitation: browser/gateway loss does not stop Pi, but daemon crash/restart and host reboot stop active Pi computation; history survives and deliberate resume requires writer-exit/history-settlement proof.

### 3. Production design

**Recommend accept** revision `62c0…` as v1's production design and component contract: both themes, routes/deep links, identity-scoped local state, focus/drafts/reading/attention, uncertain commands, truthful unknown/partial states, terminal transfer, native queue model and full accepted host-operation presentation. References remain provenance assets, not runtime evidence.

### 4. Contract policy

**Recommend accept:** SSE ring 10,000 events/15 minutes; slow-client disconnect at 1,000 queued events, 1 MiB or 30 seconds; command ledger 10,000 outcomes/24 hours/daemon epoch; history page 200 entries; content chunk 65,536 UTF-8 bytes; active live tail at most 1,000 events. Foundation tests enforce boundaries; pilot measurements may return a bound for review but may not silently remove an accepted feature.

Accept additive CG-01–CG-04 as specified in the briefs:

- terminal-operation query with 10,000/24-hour/epoch retention and explicit unknown after eviction/restart;
- queue-clear result returns exact removed texts, source groups and indexes/order;
- GitHub create requires exact fresh `owner/repository` confirmation challenge;
- `response:null` means native question cancellation only for a request whose adapter mapping is proved.

### 5. Title adapter

**Recommend:** foundation exposes capability unknown until `build-agent-control` proves a Pi one-off model call outside the agent loop. Use `openai-codex/gpt-5.6-luna` with low thinking, cap input at the first 8 user messages/16 KiB, output at 120 Unicode characters and reported cost at 0.02 USD per call. The local Pi 0.85.1 catalogue was checked with `pi --list-models luna` on 2026-09-22 and reported this exact provider/model with thinking support. Generate after the first accepted user message and allow at most one automatic regeneration when the third user message settles. A manual supported regeneration remains available. Record model ID and per-call usage/cost in redacted structured diagnostics, but never in browser authority state. A failure keeps fallback/prior title and never blocks conversation.

If Jari wants a different model or milestone, record it now; implementation must not choose silently.

### 6. Identity, credentials and security proof order

**Recommend** Google OpenID Connect (`issuer=https://accounts.google.com`) for the pilot at exact origin `https://alder.example-tailnet.ts.net`, with callback `https://alder.example-tailnet.ts.net/auth/callback`, 8-hour idle/24-hour absolute web sessions, root-owned immutable subject mapping, gateway fixed UID, systemd socket mode/ownership and peer checks, no gateway home access and no credential broker. Jari registers the confidential OIDC client, records the client ID/secret and both verified subject IDs into the Fleetrepo issue's encrypted input (never this repository), and confirms the redirect before that issue can converge. `build-workspace-slice` must first pass the disposable two-UID fake-issuer security fixture. Each actual account owner configures Pi/Git/`gh` credentials natively.

GitHub writes are authorized only against uniquely named private disposable repositories with synthetic marker commits. Both users must pass create/origin/plain-Git push/clone/pull and exact verified delete from the daemon environment. Unknown organization/SSO policy remains fail-closed.

### 7. Alder/Fleetrepo and deployment

Alder is already authorized as test/pilot target after this review and executable green gates; no second go/no-go is needed. The privileged route `ssh rowan ssh alder-root` is authorized. This does **not** authorize present deployment or guessed commands.

Native Agent Host owns release bytes/contracts. Fleetrepo exclusively owns persistent Alder users (including the currently absent `kaisa` account), fixed gateway account/groups, packages/releases, systemd units/sockets, mappings, encrypted OIDC input, Tailscale HTTPS route, release pin, convergence and rollback. `prepare-mvp-operations` coordinates a separate Fleetrepo issue/worktree and remains open until that reviewed commit and converged check are recorded, so the existing DAG blocks the pilot. This repository never edits Fleetrepo as a hidden side effect. Acceptance here authorizes the conductor to review, commit, push and apply the exact later Fleetrepo change without a second human ack; any material account, origin, mapping or exposure deviation returns to Jari.

Approve two synthetic VM identities, actual Jari/Kaisa pilot identities, manifest-owned test workspaces/sessions/remotes, maintenance preflight, package verification, apply/no-op, live version, aggregate health, service-context readiness, authenticated smoke, negative cross-user, update, rollback and teardown command shapes in the briefs. Commands remain proposed until foundation/operations makes and verifies them.

## Proof limits retained

Not yet proved: production SSE/backpressure and ledger memory, final React Aria wrappers, long-history screen-reader/anchor behavior, deployed CSP, OIDC callback/session implementation, real systemd socket/peer behavior with two UIDs, daemon-crash history settlement, Pi title call, two-user GitHub writes, Taskfleet partial create/teardown, process/path/mount race coverage, package update/rollback and Alder pilot. Each has one implementation owner and the final pilot verifier in the briefs.

Static assets, schema validation, probe results and stack experiments prove only their named boundaries. Unknown stays fail-closed; it does not authorize feature deferral.

## Exact decision to record

Record accept/change/reject for:

1. ADR 0002;
2. ADR 0003 plus the CLI naming correction and restart limitation;
3. production-design revision `62c0…`;
4. retention/history bounds and CG-01–CG-04;
5. title model/input/output/milestones;
6. OIDC provider/origin/session/mapping/socket/peer policy;
7. two-user disposable GitHub-write boundary; and
8. Google OIDC registration/subjects, Fleetrepo ownership, Alder identities/reset scope and autonomous deployment after gates.

Do not ask Jari to decide implementation trivia that is already safely bounded in the briefs. Any changed product behavior or weaker security boundary requires a correction issue blocking this human review.
