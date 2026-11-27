# Result

`click` and `type` accept one positional CSS selector or `--selector`, never
both. There is no ambiguity: each action has only one selector, and `type`
continues to read text exclusively from `--text-file` or stdin.

URL and JavaScript arguments now use the same parser as the flags, so `goto`,
`download` and `eval` accept their argument before, between or after flags.
Missing or extra JavaScript reports JavaScript, not a URL. All browser leaves
report their expected positional shape, including the no-positionals control
commands. Help and the bundled browser skill describe the same syntax.

## Verification

- Passed under `umask 077`:
  `./scripts/test-focused.sh --area go --go-package ./internal/cli`.
  Includes the help-table arity check and new positional/help/error tests.
- Parser tests compare positional and named selectors, preserve file text
  verbatim, and exercise argument placement around flags for all five actions.
- CLI error tests cover missing/empty/extra content, selector conflicts in both
  orders, and unexpected positionals for every other browser subcommand;
  errors remain `invalid_arguments`, stderr-only, exit 1.
- Focused self-review checked validation before file/socket access, unchanged
  URL/size limits, duplicate selector rejection, and unchanged CDP execution.
- `git diff --check` passed. Native Chromium integration was not run: this
  change is confined to CLI parsing, diagnostics and help, not pointer input.

No parent decision or timeout default was needed; positional selectors were
the brief's preferred choice. No follow-up issues were filed.
