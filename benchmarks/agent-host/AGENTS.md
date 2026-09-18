# Agent-host benchmark fixture

This directory is reversible benchmark plumbing, not a production host and not benchmark evidence for any candidate.

- Keep fixtures deterministic, synthetic, loopback-only, and dependency-light.
- Runtime writes must pass `fixture_core.validate_output_root`; never weaken its marker, temporary-directory, symlink, or containment checks.
- The fake orchestrator is the only fixture component allowed to create or remove runtime workspaces.
- Preserve native events alongside normalized observations. Never convert delegated, not-applicable, or not-exercised states into scores.
- Do not add candidate protocol implementations or real provider/network access here.
- Update schemas, examples, tests, README, and `version-manifest.json` together when contracts change.
