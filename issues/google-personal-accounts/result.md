# Research result — 2026-11-16

Research phase only; the feature remains in progress for the two prototype rounds.
See [research.md](research.md) for Google's primary sources, unresolved questions and the implementation map. No product code or installation configuration changed.

## Decisions for later review

- Keep the current full/read-only scope sets for the two prototypes. Alternatives were send-only Gmail and per-file Drive: neither preserves the present agent experience, and sensitive scopes still have verification-related limits.
- Explain Google's warning conditionally in the person flow instead of adding a stored audience/verification status. The existing credential shape does not expose Google's live state; a new status would need a separate contract/authority decision.
- Include privacy, website and domain preparation in the External guide rather than rely on permissive Console form validation. Google's current branding guidance requires these for production; exact form enforcement was not observed. The sources disagree on whether terms-of-service links are mandatory, so the report recommends supplying one without claiming universal form enforcement.
- Preserve the existing client and connections during an audience change, then test refresh and new authorization. Do not promise token survival or revoke everyone's grants pre-emptively: Google does not explicitly guarantee this transition in the consulted documentation.
- Do not invent Finnish Google UI quotations. Use Finnish explanatory prose and documented English navigation examples until an authorised account test confirms the labels.

## Verification

Inspected source baseline `a0a69ef5d8a9216bf333970d6b3d2cf7479e00e4` and the final documentation-only diff. Review level: source-grounded self-review; no independent model review was required because no executable code, session state, contract or authorization boundary changed.

Passed under `umask 077`:

- `timeout 60s python3 scripts/validate-project-view.py` — 14 pages valid.
- `timeout 60s issuectl doctor --json` — no findings.
- `git diff --check` — clean.

No Go/browser tests or clean gate: documentation and issue metadata only. No deployment or private test-server note is applicable.

Not live-verified: existing-token behavior during Internal/External switching, actual English/Finnish consent screens, Workspace Trusted warning suppression, and Console field enforcement for an exempt unverified Desktop app. These are explicitly marked gaps in the requested research, not claimed test results. The research did not access a signed-in Google account or mutate a Cloud project. Future migration and UI acceptance must check them with authorised test accounts; no real installation evidence belongs in the public repository.
