---
created: 2026-11-14
updated: 2026-11-14
type: improvement
status: done
priority: normal
preparation: ready
lane: m365-connect
lane_seq: 1
closed: 2026-11-14
---

# Microsoft connect without folder choice: files are reached on demand

## Decision (Jari 14.11.2026)

Microsoft 365 (OneDrive / SharePoint / Teams files) onboarding no longer
offers any choice of libraries or folders to synchronize. Agents reach files
by search and on-demand fetch (`m365-agent-file-search`, done 13.11.), so
connecting the account at a level that includes files is enough. Keeping
chosen folders as local copies ("pinning") becomes its own feature, designed
separately (`m365-pin-folders`), not part of the connect dialog.

## Scope

- The Microsoft connect and renewal dialogs have no folder step and no
  first-sync size count; a new account starts no file sync.
- Existing accounts that already sync libraries keep working as they are
  (no deletion of local copies, no silent stop); decide how a renewal treats
  them and record it under "Decisions for later review".
- Wording that implies files need a sync ("Jatka ilman tiedostoja" etc.) is
  removed or corrected; Settings and the integration card say that agents
  search and fetch files on demand.
- Any change to agent-facing text (personal-data skill, host context) goes
  as exact text into this issue's `agent-text.md` for Jari to proofread
  before pilots.
- Google and other providers unchanged.

## Acceptance Criteria

- [x] Connecting Microsoft with files shows no folder choice and starts no sync; agent search/fetch works
- [x] An existing syncing account keeps syncing after upgrade and after renewal
- [x] Browser tests updated for the connect flow
