# Result

## Cause

No CSS transition was involved. The case **ran out of its 30 s test time** on
a loaded host. When Playwright reports a test timeout it also prints the
assertion it was waiting in, and here that was a `toHaveCSS`. That is the
`toHaveCSS failed` line in the original report. The case made about 220
sequential assertions: 3 themes × 2 selections × 3 states × 2 elements × 6
properties, each a separate browser round trip. It took 4 s plain, 11 s at
CPU 4×, and close to 30 s at 6× with two workers. Both failures reproduced at 6×
were test timeouts: one in `link.focus()`, and one reading `""` from a
`toHaveCSS` whose session the timeout had just closed.

## Fix

`web/tests/rail-archive.spec.ts`: each state now reads the title link's and
the label's borders, shadow and outline in one `row.evaluate`. It polls with
`expect.poll` until they match, so a style still settling is waited for, not
raced. The assertions are the same and no timeout was raised. The case takes
about 9.5 s at 4× instead of 11 s, and its assertions went from about 220
round trips to one per state. The remaining time is real interaction: theme
menu, workspace and rename clicks.

## Evidence

`OH_BROWSER_WORKERS=2`, `--workers 2`:

| run | before | after |
| --- | --- | --- |
| `OH_CPU_THROTTLE=4 OH_REPLY_DELAY_MS=250 --repeat-each 20` (the issue's command) | 20/20 (does not reproduce) | 20/20 |
| `OH_CPU_THROTTLE=6 OH_REPLY_DELAY_MS=250 --repeat-each 30` | 28/30 (2 test timeouts) | 30/30 |

The after run of the issue's command covered the whole file. There, the
unrelated case "a rail conversation archives from its row … comes back from
the notice" failed once: a restore that did not hold. It fails the same way on
main (1/30), so it was filed through intake as `quite-dead-stocking`.

Logs are in `/var/tmp/agent-keep/test-stability-v4b6/i4-*.log`.
