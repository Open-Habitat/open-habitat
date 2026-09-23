# Implementation-readiness decision

**Decision date:** 2026-09-23  
**Reviewer:** Jari Mustonen  
**Accepted artifact revision:** `b87b1aae5d6fefcd914d4f06c0e510b5ca124f60`  
**Evidence/closure revision:** `2fa1ef36df832af441816b6dcd1ecb15f55f0f22`

## Decision

Jari explicitly accepted all eight sections of the corrected implementation-readiness package in the main conversation:

1. React with stable TypeScript 7.0.2, Biome 2.5.14 and `tsc --noEmit`, subject to the complete clean compatibility graph;
2. one Go 1.27.1 host binary with the specified gateway/daemon and restart semantics;
3. the production design, shared-component ownership, mock retirement and serial screenshot acceptance for every user-visible slice;
4. the stated retention/history limits and additive CG-01–CG-04 contract corrections;
5. the first-four/last-four title input and bounded automatic/manual regeneration behavior;
6. the GitHub OAuth → web session → mapped user's native `gh` HTTPS flow, with optional explicitly selected Google and the specified logout/disconnect boundaries;
7. deterministic cross-user fixtures plus one private disposable-repository feature smoke instead of a broad permission campaign; and
8. Native Agent Host ownership of generic self-hosting guidance, separate Fleetrepo ownership of concrete Alder state and the deferred 0.1 cleanup trigger.

Jari separately confirmed the TypeScript 7 amendment: replacing ESLint/typescript-eslint with Biome is accepted when the complete graph passes cleanly. Revision `b87b1aa` provides that evidence without forced peers, disabled checks or nightly packages.

Jari also authorized autonomous continuation through all implementation work not blocked by a later human decision. Alder remains authorized as the later test/pilot target after executable green gates; persistent Alder state must be implemented through a separate reviewed Fleetrepo issue/worktree.

## Accepted limits

The package is a specification and compatibility proof, not a production-runtime proof. Real OAuth/PKCE and target `gh` storage, two-UID systemd isolation, gateway home denial, SSE/ledger budgets, Pi title and shutdown behavior, accessibility, path/process races, Taskfleet partial lifecycle, private-repository smoke, packaging, update/rollback and the Alder pilot remain implementation gates. Unknown states remain fail-closed.

Each user-visible slice must stop in `testing` with its deterministic Playwright evidence and Markdown screenshot report. Only Jari may accept that slice and release its dependent product work.

## Validation at acceptance

```sh
python3 issues/define-host-contracts/validate_contracts.py
python3 issues/plan-v1-implementation/validate_plan.py
python3 scripts/validate-project-view.py
issuectl doctor --json
git diff --check
```

Observed results: 10 schemas, 12 fixtures, 34 contract scenarios and four negative checks valid; 12 implementation briefs and criterion mappings valid; 14 project-view pages/navigation entries valid; issue doctor and whitespace checks clean.

## Outcome

The corrected ADRs, production design, contracts, implementation briefs, operational boundary and Alder pilot scope are accepted for the bounded MVP. This closes the implementation-readiness gate and authorizes `build-app-foundation`; it does not authorize post-MVP expansion or bypass later visual/MVP human reviews.
