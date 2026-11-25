---
created: 2026-11-25
updated: 2026-11-25
type: bug
reporter: agent
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-11-25
---

# workspace update --help does not show that --hidden takes a value

## Observed (reported 25.11.2026 by an agent on a pilot installation)

`open-habitat agent workspace update --help` lists the flag as `--hidden  --hidden`, which
reads like a boolean switch. Running
`open-habitat agent workspace update --workspace <id> --hidden --observation-token <tok> --json`
fails with `invalid_arguments: unknown flag "<tok>" for workspace update`, because `--hidden`
takes the next argument as its value. `--hidden true` works.

## Done when

- The help shows the value form (`--hidden <true|false>`) and the examples include a hide and
  an unhide example.
- A bare `--hidden` means true, or fails with an error naming `--hidden` as missing its value
  (choose one and keep it consistent with how other boolean-valued flags behave).
- The same check is applied to every agent/operator flag that takes a value but whose help
  renders it like a switch (e.g. `conversation update --archived`), fixed the same way, with a
  test that keeps help and parser in agreement.
