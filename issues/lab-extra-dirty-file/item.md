---
created: 2026-10-21
updated: 2026-10-21
type: bug
reporter: jari
status: fixed
priority: normal
lane: gate-fix
lane_seq: 1
related: ['@implement-editor-files-codemirror']
collision: [test/lab]
preparation: ready
size: S
closed: 2026-10-21
---

# Lab gate red after editor phase 1: extra dirty file and missing fake-Pi turn

## Description

Full clean gate on local main 827f25df (after implement-editor-files-codemirror landed; the previous gate at ecdd4c91 was green) fails four lab specs: lab-git-status.spec.ts:8 at 1440 and 390 px and lab-worktree-agent.spec.ts:23 see 5 changed files where the fixture expects 4 (data-changes / data-dirty), and lab-conversation.spec.ts:317 'real controller creates and persists a fake-Pi turn' finds no native content within 5 s (expectNativeContent). Ordinary browser specs (315) and Go/contracts passed. Likely the editor change writes or creates something in the lab workspace (a file, temp, lock or settings file) or changes the lab fixture/startup; find the actual cause from the lab artifacts rather than updating the expected counts. Gate output: /var/tmp/oh-gate-827f25df.out on Alder.

## Acceptance Criteria

- [x] Establish the cause from lab evidence and preserve the four intentional dirty files.
- [x] Pass the affected lab specs, fast web checks and affected Go package tests.
- [x] Record focused self-review and verification in result.md; do not push or run the full gate.
