---
created: 2026-11-12
updated: 2026-11-12
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: taskfleet spinoff m365 config/refusal fixes, card state check
source_ref: taskfleet:01m77a7a7dmnkw3mp4084b0d0c/finding:unknown-during-first-pass
originating_run: 01m77a7a7dmnkw3mp4084b0d0c
originating_run_kind: spinoff
lane: unlaned
preparation: ready
closed: 2026-11-12
commits:
- hash: 50ac955ae
  summary: Say Outlook and Google services wait for the first sync instead of unknown
- hash: 3df3f56c4
  summary: Claim a check after the first sync only while a first pass runs
---

# Outlook services show 'Tilaa ei saatu selville' during the account's own first file sync

## Description

## Observation

While an account's own first file sync (or its count before the copy) runs,
`Catalog.check` (`internal/daemon/integrations/catalog_linux.go`, the
`(initial && !failed) || nativeBusy` branch) reports every service of that
account as `unknown` and asks no tool. The sync block then turns only the
file services into `syncing`. Mail, calendar and contacts of a Microsoft
account (and Google's Gmail/Calendar/Contacts) therefore show
"Tilaa ei saatu selville" for the whole first pass. Aino's count on Contoso
(11.11.2026, issue contoso-m365-aino-test) took 16 minutes; a real first copy
takes hours. The same branch covers a second account of the same provider
while another account's first pass holds the provider's native lock.

## Why it matters

The message says the state could not be found out, which reads as a fault
while nothing is wrong (same class of misleading text Jari asked to fix in
microsoft-refused-first-pass-shows-unknown, 12.11.2026).

## Constraint

The branch exists so status probes do not queue behind the native lock or
refresh rclone's token beside the pass. For Microsoft, Outlook's status comes
from the MCP adapter's own MSAL cache, not rclone, but `CheckGrant` takes
`m.native`, and Commit renames that cache under the same lock, so probing it
during the pass needs a design (or the browser could say "checked after the
first sync" for those services instead of "unknown").

## Acceptance Criteria

- [x] Mail, calendar and contacts do not show "Tilaa ei saatu selville" during the same account's first sync (`pending_first_sync`).
- [x] No tool process is started beside the native pass.
- [x] Google services and a second account of the same provider checked.

## Resolution

### 2026-11-12T08:22:11Z · @issuectl

pending_first_sync replaces unknown for services the first pass does not copy; see result.md.
