---
created: 2026-10-21
updated: 2026-10-21
type: bug
status: open
priority: high
---

# Browser suite red: about 22 failing cases on main

## Description

The ordinary Playwright suite (302 cases) fails 22–29 cases on main (e411415b, measured 2026-10-21 on Alder natively and on the warm Cedar path). Each failure waits for its 5–90 s timeout, so a red suite is also a slow suite: 185 s on Cedar with 12 workers, of which failures are a large share. Failure sets vary between runs, so some are load/timing flakes and some are real. Log of the 12-worker run: /var/tmp/oh-browser-red-20261021.log. considerably-jagged-office is one known case. Goal: green suite, fixing product or test as the evidence says, without weakening assertions.
