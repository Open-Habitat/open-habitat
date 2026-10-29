---
created: 2026-10-29
updated: 2026-10-29
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: pilot.15 clean gate run
source_ref: taskfleet:01m64akne6b0b1xysrxstj3enk/gate:ajv-date-time
originating_run: 01m64akne6b0b1xysrxstj3enk
originating_run_kind: spinoff
closed: 2026-10-29
---

# Account keys and own machines validators log unknown date-time format on every page load

## Description

The pilot.15 clean gate on Birch (55d844d8 and 9bbb1e80, 29.10. evening)
failed `loading-landing.spec.ts:17` ("fresh load ... keeps the console
clean"): every page load logged eight Ajv warnings, `unknown format
"date-time" ignored in schema at path "#/$defs/modified_at"` and `.../seen`.

`web/src/app/accountKeys.ts` and `web/src/app/ownMachines.ts` compile
`account-keys.schema.json` and `own-machines.schema.json` with a bare
`new Ajv({ strict: false })`, while every other validator of a schema with
`format: date-time` wraps it in `addFormats(...)`. Once the own-machine chip
pulled `ownMachines.ts` into the conversation view, the module-level compile
ran at app load. Besides the console noise, the date-time format was never
checked on these replies.

Fix: `addFormats` in both modules (the daemon sends Go `time.Time`, RFC 3339).

## Resolution

### 2026-10-29T18:19:19Z · @issuectl

addFormats in both validators; loading-landing, account-keys and own-machines specs pass alone.
