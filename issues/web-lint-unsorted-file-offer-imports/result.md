# Result

`npx biome check .` in `web/` reported 12 `assist/source/organizeImports`
errors: the six named files plus six lab scripts (`web/lab/*.mjs`). All 12
were fixed with `biome check --write`. Only imports moved; in two lab scripts
biome also added a blank line between the header comment and the imports.

The gate now runs `biome check` (formatter, linter and import sorting in one
pass) through a new `npm run check` script. It replaces `format:check` and
`lint` in `scripts/ci-local.sh` and `scripts/test-web-fast.sh`, the script
behind `test-focused.sh --area web`, so import order cannot drift again.

## Decisions for later review

- **Gate runs `biome check` instead of `format:check` + `lint`.** The
  alternatives were adding a third step or doing nothing. `biome check` is a
  strict superset of the two, so one step is enough. The `format:check` and
  `lint` scripts stay available for running by hand.
