---
created: 2026-10-20
updated: 2026-10-20
type: improvement
reporter: jari
status: done
priority: normal
lane: git-panel
lane_seq: 1
collision: [web/src/components/git-panel]
closed: 2026-10-20
---

# Git panel: one 'Päivitä tila' button instead of fetch and read-local

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20: the Git panel could have a single button that does both 'Hae etätiedot' and 'Lue paikallinen tila', e.g. 'Päivitä tila'. Keep the semantics (git fetch only, never changes branch or files).

## Acceptance Criteria

- [x] Both Git panels expose one “Päivitä tila” action that fetches remote refs and displays the response's freshly read local state, without changing branch or files.

## Result

Reused the existing fetch-and-read reply; removed the separate local-read button. Busy focus, refusal feedback and automatic local readings remain intact. The removed browser assertion proved that the old local-only button made no POST; that action no longer exists. The updated journey instead asserts its absence, one fetch POST, fresh remote comparisons, and unchanged branch/files.

Focused self-review: low-risk shared presentation change; no host, authority, identity or installation changes. Checked both consumers, story props, refresh after GitHub publication, busy focus handling and the fetch handler's existing fresh-state response. No independent model review needed.

Verification on base `962292be10a104f267abfb6e0a26e029dc9429c2` with this issue's source diff, remote Linux ARM64 synthetic host evidence (not UID-isolation or live-server proof):

- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area web` passed; job `eae83d2947a3408fdd6ebaae6d46609620713cf1c80cfcb49560c8ee1660c593`.
- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area browser --spec lab-git-status.spec.ts` passed desktop/mobile and a11y; final job `3b44d076edefed1e8f6b79994d115ad448481d01f247445dd065cd5bf5d35b5c`.
- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area browser --spec lab-workspace-page.spec.ts` passed; final job `1840b2fc4a2285946bbe90f2f32b6c990027fe2a42d415b99742a299217a5b20`.
- `git diff --check` and `issuectl doctor --json` passed.

Failure inventory: first web check refused two formatting differences; corrected exactly as reported and reran successfully. An initial skill read used the wrong path; read the declared pi-processes skill successfully afterwards. A source search named a nonexistent Go file; inspected the actual fetch handler instead. No required check remains failing. Before/after screenshot+HTML captures deferred: Alder disallows local manual lab execution; focused remote browser checks used instead. Full gate intentionally not run for this bounded browser-only change. No push, deployment or test-server changes.
