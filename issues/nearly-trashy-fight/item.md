---
created: 2026-11-23
updated: 2026-11-23
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: taskfleet:01m84cyhwqrh2ckjv9a9tc102g/operator-fact-check
originating_run: 01m84cyhwqrh2ckjv9a9tc102g
originating_run_kind: spinoff
preparation: ready
closed: 2026-11-23
---

# Fact-check the operator agent skill against current implementation

Jari requested on 2026-11-23 a factual verification of
`internal/cli/operator/SKILL.md` after its prose rewrite. Check commands,
safety claims and references against current source and installed help;
correct facts only and record evidence and limitations in `result.md`.

## Acceptance Criteria

- [x] Check the operator skill against main, installed tools and references.
- [x] Correct factual drift without restructuring the skill or editing neighboring instructions.
- [x] Record corrections, evidence, installed-release gaps and limitations in result.md.
- [x] Run focused Go checks under umask 077 and identify any phrase-pinning tests.

## Tests Run

Focused Go suites for internal/cli, internal/host and cmd/runtime-release pass.
Source-built host/admin help leaves pass; installed help lacks the two newer
person-removal commands. No test pins the corrected wording.

## Implementation Notes

See [result.md](result.md). No host operation or installed-tool update was run.
