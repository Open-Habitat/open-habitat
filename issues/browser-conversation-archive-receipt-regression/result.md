# Result

The 14 cases had two independent causes; neither was the route shape the
issue guessed at.

## Send receipt cases (4): composer detached from its stack

`1ce76981` (permission question in the composer's place) wrapped the composer
in a `display: contents` holder so it could be hidden while staying mounted.
That broke every `.ah-composer-stack > .ah-composer` child rule: in the product
`composerStack.css` stopped zeroing the composer's padding and the strips'
insets (a real layout regression), and the spec's phone-composer locator found
nothing. Fix (product): the composer section carries `hidden` itself and the
wrapper is gone, so the stack's rules and every spec locator reach it again.

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
- `permission-question.spec.ts` (the hidden composer) green; web static, unit
  and component checks green.

## Decisions for later review

- Archive cases use an answering Taskfleet rather than the host default
  changing. Alternative: make the synthetic host's default Taskfleet answer
  (closer to real installations) — rejected for now because other specs may
  rely on the unreadable default and the whole browser suite could not be run
  here.
- The generated UI reference (`internal/daemon/ui-skill/references`) was
  already stale on main for many unrelated files; it was not regenerated here
  to keep this change separate from others' work.
