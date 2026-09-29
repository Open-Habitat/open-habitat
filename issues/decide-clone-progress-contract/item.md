---
created: 2026-09-29
updated: 2026-09-29
type: task
status: open
priority: high
lane: clone-protocol-decision
collision: [docs/]
---

# Record bounded clone progress streaming contract

## Context
Jari approved the recommended bounded clone-progress streaming protocol on 2026-09-29 after the implementation worktree for @show-large-clone-progress stopped at the browser/host contract boundary. Existing JSON-only clone request cannot report truthful native Git stages while writing. The old worker 01m3p2wdbq5nk9z00s9crx2dbb is terminal failed with only an unmerged in-progress issue-metadata commit; do not merge it as implementation.

## Decision to record
Record the approved browser/host contract in an ADR under docs/adr-0005-clone-progress-stream.md and docs/decisions.md. Boundaries: authenticated, CSRF-protected per-user operation; only allowlisted structured native Git stages leave mapped UID, no raw stderr, URL, credential or path; bounded runtime and disk budget; disconnect cancels the native write; no new persistent progress store or automatic retry; after refresh, read-only native Git/origin/clean-state observation is authoritative and uncertain states remain explicit. Examine suitable versioned framing, terminal semantics, missing final response and nested credential redaction with architecture/security/maintainability lenses. Explain why JSON-only remains insufficient and why a persistent job/registry is unnecessary. Do not implement product code or try a real user's account.

## Acceptance
- [ ] Accepted ADR faithfully records Jari's approved scope, alternatives, failure/rollback semantics and limits; update docs/decisions.md and navigation if required.
- [ ] Validate documentation and clean committed-tree gate ./scripts/ci-local.sh --clean --json.
- [ ] Leave @show-large-clone-progress open for implementation after ADR; do not close it as a decision-only result.
