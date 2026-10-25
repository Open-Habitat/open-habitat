---
created: 2026-10-25
updated: 2026-10-25
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: observed in taskfleet run clean gate
source_ref: taskfleet:01m5r5ajhk37actg18n36pnazy/observed:conversation-recheck-flake
originating_run: 01m5r5ajhk37actg18n36pnazy
originating_run_kind: spinoff
---

# browser-conversation 'changed snapshot identity discards late previous status' still flakes under load

## Description

## Observation

On 2026-10-25 the clean gate (`OH_PORT_BASE=15300 ./scripts/ci-local.sh --clean --json`)
on tree 6ad204ed failed only in the browser phase, with one failure out of 377:
`web/tests/browser-conversation.spec.ts:2036` "changed snapshot identity
discards late previous status". `expect(getByTestId('conversation-recheck')).toBeVisible()`
at line 2085 timed out after 5 s (element not found), right after the
`workspace-details` click. The host load average was about 8.9 at the time,
and the browser suite ran on Cedar's warm slots. Go, contracts and packaging
passed. That tree had no web changes compared with main.

Run alone on the same tree with `npx playwright test tests/browser-conversation.spec.ts:2036 --repeat-each 4`,
it passed 4 out of 4.

## Context

`almost-aggressive-wind` (closed as fixed on 2026-10-23) dealt with the same
status/identity cases in this spec flaking under load, including this test at
its earlier line 1912. The fix has not held for this case: the recheck control
does not appear within the 5 s expectation when the host is loaded.

## Effect

A clean gate on an unrelated change fails and writes no receipt, so a release
or round gate has to be rerun.
