# Corrected implementation-readiness review package

**Recommendation:** accept the bounded v1 plan with Proposed ADR 0002 corrected to stable TypeScript 7 + Biome, Proposed ADR 0003 corrected to Go and provider-based authentication, and the production design plus contract policies below. This is a decision package, not acceptance. `review-implementation-plan` stays open until Jari records the decision against the landed correction revision.

## Corrected inputs

The original frozen evidence revisions remain in [`implementation-briefs.md`](implementation-briefs.md). The correction revision is recorded in [`../apply-review-corrections/result.md`](../apply-review-corrections/result.md) after landing and is the revision Jari must review. Historical Rust and TypeScript 6 experiment results remain truthful evidence; they are not current recommendations.

Review:

- [Proposed ADR 0002](../../docs/adr-0002-frontend-stack.md): React 19.3, stable TypeScript 7.0.2, Vite/React Router/Redux/React Aria, Biome 2.5.14 and `tsc --noEmit`;
- [Proposed ADR 0003](../../docs/adr-0003-host-stack.md): one Go 1.27.1 codebase/binary, systemd UDS routing and direct Pi child ownership;
- [Host interfaces](../../docs/interfaces.md), [schemas/examples/scenarios](../../contracts/v1/AGENTS.md): executable additive CG-01–CG-04 and CT-001–CT-034;
- [Production design](../../design-system/production-v1.md) and [component catalog](../../design-system/component-catalog-v1.md);
- [Corrected implementation briefs](implementation-briefs.md), downstream issues and acceptance workflow.

## Jari's eight decisions to record

### 1. Frontend and TypeScript

Keep React, React Router, Redux, React Aria, sanitized Markdown, lazy Shiki, parsed Pi-edit diffs, bounded virtualization, Storybook, Vitest, Playwright and Axe. Select stable TypeScript 7.0.2 only behind the complete clean graph. Use Biome 2.5.14 for formatting/linting and `tsc --noEmit` for types. Hooks and JSX accessibility rules are explicit errors. Never force peers, disable checks, use a nightly package, silently fall back to TypeScript 6, or retry `typescript-eslint` 8.70.1, whose declared TypeScript range is `<6.1.0`.

### 2. Go host and restart semantics

Replace Rust with one Go 1.27.1 module and one CGO-free binary providing gateway and daemon roles. Preserve fixed non-root gateway, systemd-created per-user sockets, `SO_PEERCRED`, per-UID daemons, direct daemon-owned Pi children, native history, immutable releases and the AI-first operator CLI. Browser/gateway loss does not stop Pi. Daemon/host loss stops active computation; native history is resumable only after writer-exit/history-settlement proof.

### 3. Production design and visual acceptance

Accept the production design with shared production ownership for every interactive or repeated behavior. Local composition may not invent controls, state semantics, focus rules or styling. Retire superseded root/canonical mocks when production replaces them; originals may remain issue-local historical evidence. Every user-visible executable issue remains in `testing` until deterministic happy/relevant unhappy tests and a Markdown screenshot report identify exact revision, environment, scenarios and commands and Jari explicitly accepts it. The worker never self-accepts; lane serialization blocks dependents.

### 4. Contract and retention policy

Accept SSE ring 10,000/15 minutes; slow client 1,000 queued events, 1 MiB or 30 seconds; command and operation terminal retention newest 10,000/24 hours/current daemon epoch; history pages 200; content chunks 65,536 UTF-8 bytes; active live tail 1,000. Accept additive CG-01 operation query, CG-02 exact queue-clear removed values, CG-03 exact fresh `owner/repository` challenge and CG-04 request-specific native cancellation. Missing/evicted outcomes remain unknown.

### 5. Title adapter

Use `openai-codex/gpt-5.6-luna`, low thinking, 16 KiB input, 120 Unicode-character output and 0.02 USD reported cost limit. Input is the source-ordered unique union of at most the first four and last four user messages. Generate after the first accepted user message, allow at most one automatic regeneration after the third settles, and expose an accessible title-adjacent manual control only when supported. Pending excludes concurrent title commands; failure preserves prior/fallback title and never blocks conversation.

### 6. Authentication, session and native credentials

Alder's primary path is one GitHub OAuth Authorization Code grant with single-use state and PKCE S256. Route by stable numeric GitHub user ID. Request the `repo`, `read:org`, and `gist` scopes required by the supported `gh auth login --with-token` path. The gateway handles the token transiently, never logs/persists/browser-exposes it, and forwards it once over the authenticated mapped-user UDS. The daemon uses stdin with `gh auth login --hostname github.com --with-token --git-protocol https`, runs `gh auth setup-git`, verifies identity/helper/storage and reports partial states. Optional Google establishes web identity only and makes no request before explicit selection. Web logout preserves native Git continuity; explicit disconnect removes local `gh` auth and explains that `gh auth logout` does not revoke the GitHub token.

### 7. Security and GitHub proof

Keep deterministic two-UID and cross-user denial tests. Replace the broad two-user GitHub write campaign with deterministic fixtures plus one private disposable-repository feature smoke: exact create/origin, ordinary HTTPS push, clone/pull, verified deletion and essential screenshots. Product ownership is safe target/path, mapped Unix identity, staged truth and secret handling; GitHub/`gh` own ordinary permission semantics.

### 8. Self-hosting, Fleetrepo and release trigger

Native Agent Host owns generic install, configuration, test-host, update, rollback, live-version and operator docs. Fleetrepo owns only Jari's concrete Alder declaration. `prepare-mvp-operations` coordinates a separate reviewed Fleetrepo issue/worktree and records its commit/convergence; no hidden edit. Do not file the public-cleanup issue now. At 0.1 release readiness, the conductor files an issue to remove Alder-specific references from Git HEAD while preserving generic docs and issue-local history. Alder remains pre-authorized after accepted decisions and executable gates; material deviations return to Jari.

## Remaining implementation proofs

The correction proves only language/package compatibility, machine-contract consistency and planning/DAG coherence. Product implementation must still prove real GitHub OAuth/PKCE and target `gh` storage behavior, systemd two-UID sockets, gateway home denial, SSE/ledger memory, Pi title call and shutdown settlement, accessibility with assistive technology, path/process races, Taskfleet partial lifecycle, package update/rollback and Alder pilot. Unknown remains fail-closed.

## Exact action

Record accept/change/reject for the eight sections above, with the correction revision from `issues/apply-review-corrections/result.md`. Do not close this human gate merely because the package exists.
