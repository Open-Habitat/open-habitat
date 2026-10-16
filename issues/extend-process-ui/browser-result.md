# Browser and contracts implementation

Worker run: `01m51vhpd0cve74tvq1tmyky7v`. Parent owns delivery of
`extend-process-ui`; this worker does not close it.

## Delivered

The conversation column has the accepted *Kentän yllä* process tray, above the
composer. It distinguishes loading, unavailable inventory and an authoritative
empty inventory; groups notifying/running/finished records; shows duration,
redacted preview, combined output with stderr labels, omission/retention facts,
pause/resume, graceful stop, timeout/force-stop and clear-finished. Taskfleet
waits display run IDs and explain that stopping a wait does not stop its runs.
No Taskfleet status or result is invented from those IDs.

Inventory lives only in a route/identity-keyed React provider. There is no new
Redux/native process store or browser persistence. Reads are single-flight.
Inventory polls every two seconds while the conversation is open, including
read-only conversations. Output is read only while one row is expanded and
following; pause retains one bounded tail, resume refetches, and a changed
owner/token unmounts the previous output. Closing the conversation discards it.
`process.changed` invalidates inventory and the snapshot; `process.output`
invalidates the expanded following output. Two-second output refetches also
cover missed invalidation hints. Neither event is treated as log data or as a
promise of complete replay.

`run_active` takes precedence over legacy command state for work presentation,
composer steering and Stop. Host `waiting_on` provides `waiting_process` and
`waiting_spinoff` across sidebar, home, return view, topbar and recap. A pending
question wins. Unavailable/disconnected facts do not claim a background wait.

History renders typed `process_event` blocks as the quiet *Merkintänä* row.
Completion does not render its `command_preview`, raw XML or the entry's raw
content. `delivery: null` adds no wake/steer claim. `process.notification` on
SSE requests native-history recovery instead of inserting a synthetic duplicate.
The parent can omit that event and rely on its ordinary history refresh.

Process start calls remain ordinary tool rows. A fenced current record changes
the row from successful-start receipt to actual process state. Supported result
JSON joins use `id` with `process_token` or `started_at`/`startedAt`/native `startTime`, either at
the root, `process`, `details`, or `details.process`. Unstructured text results
have no lifetime fence and deliberately remain tool receipts, with a pointer to
the current inventory. If the native projector retains only human start text,
it will not gain an unsafe name/ID-only live join.

## Final wire contract

Canonical definitions are `contracts/v1/process.schema.json`,
`process-control.schema.json`, `process-event.schema.json`; both generated
packages were regenerated. Replies require all agreed fields:

- inventory: `schema_version:1`, nullable `owner_generation`,
  `availability:available|unavailable`, nullable enumerated reason, and at most
  200 records. Available requires non-null owner and null reason; unavailable
  requires a reason and no records. Record fields: `id`, `name`,
  `command_preview`, `process_token`, native `status`, epoch-ms `started_at`,
  nullable `ended_at`, `exit_code`, `signal`, `end_reason`, nullable
  `wakes_agent`, and `run_ids`.
- output: `schema_version:1`, `owner_generation`, `process_id`,
  `process_token`, at most 2000 `{stream,text}` lines, nullable
  `omitted_before` and nullable `retention_restarted`. The browser additionally
  enforces the agreed aggregate 128 KiB UTF-8 text cap. Read query always sends
  both fences and `tail_lines=200`.
- action: `schema_version:1`, `result:killed|terminate_timeout|not_found|error|cleared`.
  The browser validates stop versus clear results separately.
- stop input: `{owner_generation,process_token,force}`; clear input:
  `{owner_generation}`. HTTP 409 refetches without replaying the write.
- notification definition: `{kind,process_id,process_name,command_preview,
  exit_code,signal,end_reason,delivery,run_ids}`. History puts this object only
  in block `process_event` with `type:process_event`. SSE
  `process.notification.payload` uses the definition directly.
- `process.changed`/`process.output.payload` require `owner_generation` and
  accept optional `process_id`, with no log contents.
- snapshot agents accept optional `run_active:boolean` and optional
  `waiting_on:[{process_id,name,kind:process|taskfleet_wait,run_ids}]`. The private
  controller status parser accepts optional `run_active:boolean`; there is no
  separate published controller schema in this repository.

Names/tokens/identity strings are bounded to 200, preview to 1000, and timestamps
to the representable epoch-ms range. Objects reject unknown properties.
Examples are registered in the offline validator.

One deliberate presentation limitation follows from the agreed wire: completion
has no owner/token/start fence. Its action opens **current inventory**, not a
supposed historical log matched by recyclable ID. Start results without a fence
are treated the same way. This prevents an old history row from showing a new
process's output. A lifetime-fenced completion link would require additional
native metadata, not an ID-only shortcut.

## Evidence and scope

- Fast web checks: formatting, lint, typecheck, 23 pure suites / 133 tests and
  20 component suites / 130 tests passed. Cases cover stale writes, owner/token
  rollover while paused, output limits in UTF-8, no collapsed output fetches,
  resume replacement, precedence, fenced start joins and history-only recovery.
- Contract validator, generated drift check, project-view validator and
  `git diff --check` passed.
- Host-backed synthetic browser run: 84/85 passed across process tray,
  browser conversation, native history and home workspace specs. The sole
  failure is the archive undo offer's existing eight-second expiry case.
  A focused retry reproduced it. A disposable archive of unchanged baseline
  `6efa8e02` reproduced the identical failure with its original test and
  ArchiveNotice; baseline used the same unchanged synthetic fixture binary.
  Logs: `/var/tmp/process-browser-final.log`,
  `/var/tmp/process-browser-focused.log`, `/var/tmp/process-archive-baseline.log`.
  This worker does not change the unrelated archive timer (parallel work owns
  that surface).
- Process-specific browser tests pass, including tray Axe and narrow composer
  reachability. Process endpoints are explicit synthetic wire fixtures over a
  real synthetic authenticated host/controller shell, **not** native bridge or
  distinct-UID proof. Parent must test its real endpoints after integration.
- `browser-tray-synthetic.png` and adjacent static HTML capture the production
  components in the synthetic lab with invented process replies. They are
  review evidence, not a visual-comparison assertion. Capture initially used
  the normal host's workspace name; corrected to the lab's `aurinkokello`.
- No full gate or model review was run; the parent owns both integration steps.
  No production Go file was changed; only generated contract metadata changes.

## Integration

Rebased onto the parent's native relay and rollout commits. The only conflict
was the HTTP API page: retained the parent's socket/native authority section and
route table, then added the browser-specific recovery/fencing subsection.
Unfenced successful `process start` receipts say *Käynnistetty*, not *Valmis*;
only a fenced inventory join can claim the process itself finished.

Post-rebase checks passed on the integrated native-relay base: fast web checks,
contracts/fixture validator, generated drift check, project-view validator and
four focused synthetic browser cases (both process tests, initial controller
send/settlement, native history continuation). Logs:
`/var/tmp/process-web-integrated-final.log` and
`/var/tmp/process-browser-integrated-final.log`. The broad suite's independently
reproduced baseline archive-timer failure remains disclosed above, not counted
as a pass or fixed by this worker.
