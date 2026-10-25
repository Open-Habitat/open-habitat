---
created: 2026-10-20
updated: 2026-10-25
type: bug
reporter: jari
status: fixed
priority: normal
lane: composer
lane_seq: 4
collision: [web/src/components/composer]
closed: 2026-10-20
---

# Typing -- in the composer renders as a different dash

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20: writing a ! command with a long option (e.g. '!uv --version') the two hyphens visually turn into another dash in the composer field (font ligature or contextual alternates). Commands and code must show exactly what is typed: disable ligatures/contextual alternates in the composer and in command/code blocks (font-variant-ligatures: none; font-feature-settings), and verify nothing replaces characters on input.


## Acceptance Criteria

- [x] Composer and command/code surfaces disable ligatures and contextual alternates, including after font shorthands.
- [x] Typing `!uv --version -> != ===` preserves the exact input characters.
- [x] Focused web checks and affected browser specs pass.

## Result

Extended the shared literal-code font rule to the composer. `font-variant-ligatures: none` disables ligatures; `font-feature-settings: "calt" 0` separately disables contextual alternates. Both resist later font shorthands. The input handler already forwards `e.target.value` unchanged; no input transformation was needed.

Final remote Linux ARM64 synthetic evidence, on base `1e5f53a9b1ffba8db002a0e76ea2a43bda8671af` plus the final CSS/test diff in this commit (dirty capture; not a clean-gate receipt):

- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area web`: PASS, job `ff70e9cbd12f2e713450e07fa751e9d889a2abb10c81d39144f61964b2c5f080`, evidence `/var/tmp/oh-browser-3hjweyrt`.
- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area browser --spec composer-geometry.spec.ts`: PASS, job `7de31e196f49b1a9feadfd91474b2b628880c6916ba15849967bf7c5c3641eb3`, evidence `/var/tmp/oh-browser-8pogzdwm`. Desktop/phone, light/dark: literal typed input and computed shaping on the composer and shell-label code, plus existing geometry/focus checks.
- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area browser --spec syntax-wrap.spec.ts`: PASS, job `fd13118e6033191c3f699b0c785297fc0d184c835d93e3a3422096a90825da92`, evidence `/var/tmp/oh-browser-2bl_nfqu`. Fenced code/pre shaping and existing overflow regression.
- `git diff --check`: PASS.

Focused self-review is proportionate: CSS shaping and browser assertions only; no authority, Unix-user isolation, installation, contracts, fixtures or dependencies changed. Existing journeys were extended rather than adding another host startup. The shaping assertions encode the reported literal-text requirement, not incidental styling. No interaction or accessibility semantics changed.

Failure inventory: initial web run failed CSS formatting; the next failed lint because a multiline declaration's suppression was attached to the wrong line. Simplified to the necessary `calt` feature (ligatures are already disabled by the variant property); final web and both browser checks all pass. The first chained browser command never ran after web failed; final specs were each invoked separately. Exploratory reads of absent component instructions/spec filenames were harmless discovery misses; the relevant existing files were read instead. No required check remains failing or incomplete.

Before/after captures deferred: Alder's focused remote policy disallows lab/capture runs. No live server, personal data, or provider was used; visual review on the deployed server remains with the conductor. Full gate was intentionally not run for this narrow browser change. Nothing needs changing in Fleetrepo; no push or deployment was performed.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
