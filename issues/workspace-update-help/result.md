# Result

Value-taking options now render a value placeholder in text help and declare
`takes_value` in JSON help. Explicit boolean values (`--hidden`, `--git`,
`--archived`, `--administrator`) show `<true|false>` with descriptions of both
values. Workspace update includes parser-checked hide and unhide examples.

Boolean values remain mandatory. Workspace `--hidden`/`--git` and conversation
`--archived` reject a following option as a missing value, before consuming that
option and blaming its argument. Other string-valued options retain their
existing handling of strings beginning with `--`.

The help-table regression reads argv-consumption sites in the hand-written
parsers, including the separate MCP relay parser, requires arities to agree
where help shares a flag name, and checks every command's text and structured
help. This is source-based grammar coverage, not execution of operator services
or native writes. Separate runtime tests cover boolean help, missing values and
the workspace examples. The bundled agent skill already documents explicit
archive values and contains no incorrect hidden-flag example; it is unchanged.

## Verification

- `umask 077; ./scripts/test-focused.sh --area go --go-package ./internal/cli` — passed.
- Mutation check: temporarily parsing `--hidden` as a switch made the help-table
  regression fail (`takes_value=true, parser=false`); restored before the final
  passing run.
- `git diff --check` — passed.
- `issuectl doctor --json` — no findings.
- Focused self-review checked switch/value forms, JSON's additive field, example
  parsing, and preservation of non-boolean string input semantics.

No live installation was changed. Browser, packaging and full-gate checks were
not run; this change affects CLI help and argument parsing only.
