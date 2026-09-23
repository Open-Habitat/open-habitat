# Implementation review correction result

## Outcome and revisions

The corrected specification/planning package is complete. The exact substantive artifact revision is `CORRECTION_ARTIFACT_REVISION`; the follow-up evidence/issue-closure commit is recorded in issue metadata. `review-implementation-plan` remains open and must record Jari's explicit decision against that artifact revision.

No product scaffold, machine package, Fleetrepo file, user, credential, service or deployment was created or changed.

## Accepted decisions applied

- Proposed ADR 0003 now selects one Go 1.27.1 module and CGO-free binary on technical maintainability/build-feedback grounds, while preserving the fixed non-root gateway, per-UID systemd sockets, `SO_PEERCRED`, direct Pi child ownership, native history and accepted restart semantics. `issues/choose-host-stack/result.md` remains truthful historical Rust evidence and is explicitly marked superseded for current requirements.
- Proposed ADR 0002 now selects stable TypeScript 7.0.2, Biome 2.5.14 and `tsc --noEmit`. The complete locked React/Vite/Storybook/Vitest/Playwright/Axe graph passed. Historical `typescript-eslint` 8.70.1 evidence is retained: its package declares TypeScript `>=4.8.4 <6.1.0`, so it was not retried or forced.
- Every user-visible `ui-v1` implementation issue is now its own serial executable + Jari checkpoint: worker leaves it `testing`, writes `visual-acceptance.md` with exact revision/environment/scenarios/commands and essential Playwright screenshots, and the conductor closes only after Jari's explicit dated acceptance. No human-review issue was laned and no new issue was filed.
- Production design/catalog/workflow require shared component ownership for repeated or interactive behavior and retire superseded canonical/root mocks when production replacement is accepted; originals may remain issue-local historical evidence.
- Title input is the source-ordered unique union of at most the first four and last four user messages. Automatic first/third-message policy and 16 KiB/120-character/0.02 USD bounds remain. The title-adjacent manual control has explicit capability, pending/concurrency and nonblocking failure behavior.
- Authentication is provider-based. Primary GitHub Authorization Code + single-use state + PKCE S256 routes by stable numeric GitHub user ID and performs one-time authenticated UDS forwarding of the transient callback token. The daemon uses supported `gh auth login --with-token --git-protocol https` and `gh auth setup-git`; token/browser/log/persistence boundaries, storage modes, partial states, web logout and explicit local disconnect are specified. Optional Google is web-identity-only and makes no request before selection.
- The broad two-user GitHub permission campaign is removed. Deterministic and cross-user fixtures remain, plus one private disposable-repository feature smoke and screenshot acceptance.
- Native Agent Host owns generic self-hosting/install/configuration/test-host/update/rollback/operator docs. Fleetrepo owns only concrete Alder state through a separate MVP-era issue/worktree. The 0.1 cleanup issue is deliberately not filed; the release-readiness trigger is recorded.
- Contracts add CG-01–CG-04 semantics without breaking v1: operation query/retention example and CT-030, exact queue-clear result plus snapshot/event queue revision and CT-031, exact GitHub challenge and CT-032, request-specific cancellation and CT-033. Auth/native-credential/title capability fields are additive; a positive disconnect fixture and CT-034 prove the user-scoped native disconnect command.

## Primary evidence and versions

Retrieved with HTTP 200 on 2026-09-23:

- Go stable/version and release archive metadata: <https://go.dev/VERSION?m=text>, <https://go.dev/dl/?mode=json>, <https://go.dev/doc/devel/release>. Stable pin: Go 1.27.1; official Linux amd64 SHA-256 `63d339f0da5ab53635a56f2490a7984dfe12dfcff22ad749f63edaf590168445`.
- GitHub OAuth authorization/PKCE/state: <https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps>.
- OAuth scopes: <https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps>.
- Stable numeric authenticated user identity: <https://docs.github.com/en/rest/users/users#get-the-authenticated-user>.
- GitHub CLI supported behavior: <https://cli.github.com/manual/gh_auth_login>, <https://cli.github.com/manual/gh_auth_setup-git>, <https://cli.github.com/manual/gh_auth_logout>.

The local no-secret GitHub CLI 2.46.0 probe used a disposable HOME. A deliberately invalid token supplied on stdin returned HTTP 401 and wrote no file; `gh auth setup-git --hostname github.com` without auth failed explicitly. This confirms failure behavior only, not successful storage on the future target. Current primary docs state secure credential-store use with plaintext config fallback and that logout does not revoke the token; implementation must inspect and report the actual target storage.

Locked TypeScript trial direct versions include TypeScript 7.0.2, React 19.3.0, Vite 8.3.0, React Router 8.4.0, Storybook/react-vite/a11y 10.6.0, Vitest 5.0.1, Playwright 1.63.0, Axe Playwright 4.13.0, Biome 2.5.14 and current React type packages. `package-lock.json` records the transitive graph.

## Disposable trials

Sources are under `experiment/go/` and `experiment/typescript/`; they are evidence, not a product scaffold. `experiment/trial.log` preserves attempts and the accepted final run.

The final Go run:

```sh
go test -count=10 ./...
CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' ...
file /tmp/.../native-agent-host-go-trial
ldd /tmp/.../native-agent-host-go-trial
```

It passed repeated mode-0660 socket and self-peer allow/expected-UID deny checks plus direct-child process-group shutdown. The stripped amd64 ELF was statically linked (`not a dynamic executable`). This does not prove systemd two-UID activation, production HTTP/SSE, OAuth or Pi settlement.

The final TypeScript run used disposable npm and Playwright caches and passed:

```sh
npm ci --no-audit --no-fund
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run build-storybook
npm run test:e2e
npm run test:a11y
```

No force, peer override, disabled check or nightly package was used. `skipLibCheck` is false. Storybook uses its supported `react-docgen` parser because its optional transitive `react-docgen-typescript` declaration surface is incompatible with TS7. The trial typechecks every source, story, test and config file with `skipLibCheck:false`; the plain CSF/config objects avoid importing the incompatible optional declaration API, while Storybook's own production build validates those objects and succeeds. Negative Biome fixtures failed as required for click-only noninteractive JSX, conditional hooks and missing effect dependencies. The Storybook build reported its normal large manager/a11y chunk warning; no warning was disabled or treated as product bundle evidence.

## Issue and DAG changes

- `apply-review-corrections` was marked `in-progress` in dedicated commit `5949daf48fc24cd899cc9df785dc12c481fd3291` before substantive work.
- Existing executable UI issues gained same-issue serial acceptance checkpoints; dedicated `review-implementation-plan`, `review-ui-v1` and `review-mvp` remain unlaned human reviews.
- `build-app-foundation` remains blocked by open `review-implementation-plan`. No implementation head is released.
- Downstream briefs/issues now name Go, TS7/Biome, GitHub OAuth/native `gh`, focused remote smoke, generic self-hosting ownership and the deferred 0.1 trigger.
- No issue was created, so the run's intake-only provenance boundary was not invoked.

## Validation

Final commands and expected outputs:

```sh
python3 issues/define-host-contracts/validate_contracts.py
# Host contracts valid: 10 schemas, 12 fixture files, 34 scenarios, 4 negative checks.

python3 issues/plan-v1-implementation/validate_plan.py
# Implementation plan valid: 12 briefs, 12 criterion mappings, 34 contract scenarios, 4 contract corrections plus native disconnect.

python3 scripts/validate-project-view.py
issuectl doctor --json
git diff --check
issuectl dag --json --reservations '[]'
```

Final pre-stamp results were `Project View valid: 14 pages, 14 navigation entries`, clean `issuectl doctor --json`, clean `git diff --check`, and `DAG valid: 3 lanes, 19 lane members; foundation blocked by review-implementation-plan`. They are rerun after stamping. The DAG has no missing blockers/cycles, no deferred/untriaged lane member, no lane-assigned human review, and no product head ahead of the human implementation review.

## Limits and remaining implementation proofs

Still unproved: successful production GitHub OAuth/PKCE and stable numeric mapping, the actual target's `gh` storage/helper, real two-UID systemd socket ownership and peer checks, gateway home denial, production SSE/backpressure and ledger memory, Pi title call, daemon crash/history settlement, assistive-technology behavior, path/mount/process races, Taskfleet partial lifecycle, private-repo smoke, package update/rollback and Alder pilot. Every unknown remains fail-closed.

## Tool/sub-workflow inventory

All required trials, validators and final review must complete before closure. Resolved trial/probe failures and their impact are listed in [`tool-failures.log`](tool-failures.log); none is silently counted as passing. The final independent `/llm-review` and `/assess-findings` outcome is appended below after review.
