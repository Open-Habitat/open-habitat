---
created: 2026-11-27
updated: 2026-11-27
type: bug
reporter: agent
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-11-27
---

# agent browser click/type: positional selector fails with an unhelpful error

## Observed (reported 27.11.2026 by an agent on a pilot installation)

`open-habitat agent browser eval` takes its JavaScript positionally, but `click` and `type`
need `--selector`. Given a selector positionally (`click 'input[aria-label^="X"]' --tab <id>
--json`), `click` fails with `invalid_arguments: invalid browser argument <selector>; see agent
browser click --help`, which does not say what is wrong. `eval` has the reverse problem: given
flags before the code, it says `eval requires a URL (eval requires JavaScript)`; "requires a
URL" is wrong for eval.

## Done when

- `click` and `type` accept the selector positionally as well as with `--selector` (one of
  them, not both), or the error names `--selector` explicitly; choose the former unless it
  creates an ambiguity, and record why.
- `eval`'s missing-code error says only that it needs JavaScript, and flags before the code
  work.
- Every agent browser subcommand's missing/extra positional argument error names what it
  expected; a test covers each.
