# Result: permission question as a typed field

## What was built

- **Contract.** `contracts/v1/event.schema.json` `$defs/question` has the
  kind `permission` and an optional `permission` object: `action`,
  `consequence`, optional `account {provider, address}` and `call {area,
  tool, arguments}`. Every part is bounded plain text. `arguments` is the
  call's JSON as text, shown verbatim, so the schema has no open object.
  `permission` is present exactly when the kind is `permission`. There is an
  example event, a CT-004 scenario line, and negative checks in
  `scripts/validate-contracts.py`.
- **Pi side.** The daemon's companion (`process-extension.mjs`) registers
  `globalThis[Symbol.for('open-habitat.permission')] = { ask, block }` at
  load. A `tool_call` hook in any extension loaded into the browser's Pi
  calls `block(ctx, {action, consequence, account, call})`. It returns
  nothing when the person allowed the call, and otherwise
  `{block: true, reason}`. The question travels as one Pi `confirm` whose
  title is `oh-permission:` plus the JSON. The same prefix-in-UI-frame
  channel already carries the recap and rewind outcomes. The turn's abort
  signal goes with the question, so Stop answers it as not allowed.
  `ctx.hasUI` false, a malformed question, a refusal, a cancellation or an
  error all block the call with a reason the agent reads.
- **Daemon.** `pi_permission_linux.go` turns exactly that frame into the
  typed question. It disallows unknown fields, checks bounds in code points
  and allows no control characters (tabs and line breaks only in
  `arguments`). A malformed permission question is cancelled at once and
  never shown, so the hook blocks. A generic `confirm` stays `confirm`,
  whatever it says. The answer is a boolean, written back as Pi's
  `confirmed`, and uses the existing one-at-a-time queue and the spent-ID
  fence against replay.
- **Browser (2 Kenttä).** While a permission question is open it replaces
  the composer. On a phone it is a bottom sheet with full-width buttons.
  It shows the icon Kilpi ja kysymys (`shieldAsk`), *Agentti pyytää lupaa*,
  the account, the action, the consequence, *Tekninen kutsu* (a disclosure)
  and Stop, Älä salli and Salli. The stream line *Agentti odottaa lupaasi ·
  action* becomes *Sallit · action* or *Et sallinut · action*. The header
  says *Odottaa lupaasi* with the action and the `waiting` mark. The
  composer stays mounted under it (hidden), so a draft or an upload carries
  on. Explain cards V39–V43 cover the new controls.
- **End to end.** `testdata/permission-hook.mjs` is the test hook.
  `TestPermissionThroughPinnedPi` runs the pinned real Pi with that hook,
  the companion and a synthetic model. The allowed call runs; the refused
  one does not run, and the model is told why. The browser host's fake Pi
  asks the same way on "pyydä lupaa" (`kahdesti` asks for two calls in a
  row), so `web/tests/permission-question.spec.ts` drives the real
  controller.

The Microsoft hook itself (which calls ask) is not here. It lands with
`agent-account-instructions-clarity` and uses the API above.

## Experimental flag or not: shipped unconditionally

The permission surface can only be reached through the new typed API. The
browser draws it only from a `permission` object, and the daemon creates
that object only from the companion's prefixed confirm. No existing
question or text becomes one. Without a hook that asks, nothing changes for
anyone, so the feature ships without an experimental flag.

## Decisions for later review

- **Transport: a prefixed confirm, not a new Pi channel.** Alternatives were
  a socket message from the companion to the daemon, or Pi's `custom` UI,
  which RPC mode does not carry. The confirm keeps Pi's own blocking, abort
  and cancel semantics. The prefix is decoded by the daemon from an
  extension frame, as the recap and rewind outcomes already are. The browser
  never parses text.
- **Spoofing is accepted, not fenced.** Any extension the person loaded can
  emit a confirm with the prefix and get the permission view. A per-process
  secret would not stop same-UID code, which can read Pi's environment and
  memory. The view grants nothing either: the answer goes only to the
  confirm that asked, and the hook decides on that alone.
- **Long names are cut, not refused.** The companion trims a part longer
  than the schema allows and adds `…`, and turns control characters into
  spaces. Refusing would block a call the person would allow just because a
  folder name is long. The daemon still refuses anything the companion did
  not normalise.
- **Decision lines last as long as the turn.** They are in-memory, plus the
  session-storage answer mark, so a reload does not resend. Once the turn
  ends, Pi's history keeps the call: done, or blocked with the reason the
  agent read. The alternative is a custom entry in the session file,
  projected into history. That would put a Habitat record between Pi's tool
  call and its result, which is a history-projection change of its own;
  wait for a need.
- **No time limit on the question.** It waits like any Pi dialog until
  answered, stopped, or until the turn settles. A timeout would block a
  call the person was about to allow while they were away.
- **The account line uses the mail icon** for every provider, as the round
  did. Production has no provider marks yet.
- **Stop in the dock is an icon button** beside the answers, reusing the
  composer's Stop label. The composer's own Stop is hidden with the
  composer.

## Checks run

- `./scripts/test-focused.sh --area contracts`: valid (104 schemas, 168
  fixtures), negative checks included.
- `go test` of the permission tests and the existing question test
  (`-run 'Permission|TestQuestionOneNativeWriteAndStale' ./internal/daemon`,
  with the focused entry's Python and TMPDIR), including the pinned real-Pi
  test.
- `node --test internal/daemon/pi-device-test/permission.test.mjs`.
- `./scripts/test-focused.sh --area web`: 236 files, 1928 tests, biome
  clean.
- `OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec
  permission-question.spec.ts`: 2 passed. The existing question and process
  specs (`browser-conversation`, `next-waiting-row`, `process-tray`, grep
  `question|process|answers once`): passed.
- After the review fixes: the permission and question Go tests, the
  permission spec plus the existing question specs (5 passed), and the web
  fast checks (1930 tests) passed again. The full `./internal/daemon`
  package (focused `go` area) passed before the fixes and again after them.

## Review

The contract and an authorization boundary change, so the review ran at
critical rigor: an independent `/llm-review`, with gpt-6-astra as finder and
claude-fable-5-2 as verifier (two calls), then `/assess-findings`. It found
four should-fix defects, all confirmed and fixed in the same branch:

- a failed answer showed as a decision with no warning, and a refused one
  could not be retried;
- the decoder accepted a missing `arguments` and data after the object;
- the composer, held hidden, still ran its keyboard shortcuts and file
  drops;
- a double-click could allow the next queued question unread, so a new
  question now waits 400 ms before it can be answered.

A write that fails after the daemon has spent the request is now answered
as uncertain, not refused. That applies to every Pi question, since a
refusal tells the browser nothing was written.

The verifier found no path by which a guarded call runs without the
person's allow for that exact request. It checked a malformed question, a
wrong or replayed request id, Stop, a Pi without UI, a cancel racing an
answer, and non-boolean values. Not covered by a test: the hidden-composer
shortcut guard in a browser (the fixture has no speech).
