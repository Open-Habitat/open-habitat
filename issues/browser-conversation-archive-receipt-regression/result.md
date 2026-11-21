# Result

The 14 cases had two independent causes; neither was the route shape the
issue guessed at.

## Send receipt cases (4): composer detached from its stack

`1ce76981` (permission question in the composer's place) wrapped the composer
in a `display: contents` holder so it could be hidden while staying mounted.
That broke every `.ah-composer-stack > .ah-composer` child rule: in the product
`composerStack.css` stopped zeroing the composer's padding and the strips'
insets (a real layout regression), and the spec's phone-composer locator found
nothing. Main fixed this in `5be5c3a0` by pointing the stack rules and the
specs' locators through the holder. This branch had removed the holder
instead; that commit was dropped when the work was adopted onto main, so the
landed fix stands and this issue adds only the archive fix below.

## Archive cases (10): unreadable synthetic Taskfleet

With `named-workers` graduated (`d4f2b2b6`), every archive reads the
conversation's helpers first and asks when the read is incomplete. The
synthetic browser host installs a fake Taskfleet that is unreadable until a
case writes runs, so each archive stopped at the question. Asking on an
unreadable helper state is the graduated design, and real installations ship
a working Taskfleet in the core runtime. Fix (spec): `beforeEach` selects the
host's existing empty-and-answering Taskfleet fixture; `afterEach` restores the
host default, since a worker's host outlives the spec.

## Evidence

- The 14 cases, `OH_BROWSER_WORKERS=2`: 14 failed before; 14 passed in three
  separate runs after.
- Whole `browser-conversation.spec.ts`, `OH_BROWSER_WORKERS=2`, four runs:
  88/88, then 85/88, 85/88 and 84/88. The failures were the intermittent
  cases already listed in `browser-conversation-repeat-flakes` (owned by a
  parallel run), plus one occurrence of "a turn stopped in a restored
  conversation" flashing a live notice under load, which this fix newly lets
  past its archive step; 8/8 in isolation. Filed as
  `achingly-determined-flowers`.
- Adopted onto main (after the repeat-flake landing), whole
  `browser-conversation.spec.ts`, `OH_BROWSER_WORKERS=2`: see "Final runs".

## Decisions for later review

- Kept main's holder-aware selectors (`5be5c3a0`) over this run's removal of
  the holder. Alternative: remove the `display: contents` holder and let the
  composer carry `hidden` (fewer selectors coupled to a wrapper, one element
  less). Rejected for the release: main's fix was already landed and green,
  and swapping it would touch five specs and the stack CSS again for no
  behavioural gain. The composer review the brief asked for therefore had no
  product change left to review.
- Archive cases use an answering Taskfleet rather than the host default
  changing. Alternative: make the synthetic host's default Taskfleet answer
  (closer to real installations) — rejected for now because other specs may
  rely on the unreadable default and the whole browser suite could not be run
  here.
- The generated UI reference (`internal/daemon/ui-skill/references`) was
  not regenerated: the adopted change touches no file under `web/src`.

## Final runs

On main `0dd8394e` plus this branch's spec change, whole
`browser-conversation.spec.ts`, `OH_BROWSER_WORKERS=2`, two consecutive runs:
88/88 (3.0 min) and 88/88 (3.2 min). Logs:
`/var/tmp/agent-keep/browser-conversation-archive-receipt-regression/run{1,2}.log`.
Review: the final diff is a ten-line spec fixture change plus issue text;
checked locally against the synthetic host's `/fixture/taskfleet` handler
(`empty` answers with no runs, `none` restores the default). No model review
was run, because no product code is left in the diff.
