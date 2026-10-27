# Result

The companion's `waitRuns` (`internal/daemon/process-extension.mjs`) now
implements the daemon's `taskfleetWait` grammar: one literal leading
`cd <path> &&`, `--check-in`, `--terminal`, several run ids and every
`--output` form the daemon accepts. Both are tested against one table,
`internal/daemon/testdata/taskfleet-wait-grammar.json` (Go
`TestTaskfleetWaitSharedGrammar`, Node `waitRuns recognises exactly the
daemon's Taskfleet wait shapes`). Against the old companion the table shows
seven disagreements, the issue's four shapes among them.

The review (gpt-6-astra) found two further disagreements/false accepts, now in
the table and fixed in both: Unicode whitespace splitting and brace/glob
characters in the executable path.

## Decisions for later review

- Durations are matched by an explicit pattern in both languages (bare
  seconds, or Go-style unit runs with a non-zero digit) instead of Go's
  `time.ParseDuration`, so both sides can be literally the same rule. This
  drops Go's former acceptance of `+5m`.
- Words are split on space and tab only, in both. A wait typed with other
  Unicode spaces is not recognised.
- `--flag=value` forms (`--check-in=45m`, `--output=json`) stay unrecognised
  in both, as before; no observed conductor used them.
