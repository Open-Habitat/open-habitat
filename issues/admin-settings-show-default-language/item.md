---
created: 2026-11-02
updated: 2026-11-14
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: Observed live during authorized pilot release installation
source_ref: taskfleet:01m6ddwv432z2bh7s74eyf476h/observed:settings-default-language
originating_run: 01m6ddwv432z2bh7s74eyf476h
originating_run_kind: spinoff
lane: admin-cli
lane_seq: 1
preparation: ready
closed: 2026-11-14
---

# Admin settings CLI rejects a browser-selected default language

## Description

After a browser administrator selects a default language, root `open-habitat admin settings show --json` exits 2 with `invalid_control_response: gateway returned invalid administration data`. The selected language is legitimate administrator state and must not be erased to recover the read.

The gateway's control `show` serializes settings including `default_language`, but the CLI's `controlSettings` omitted that field while `parseAdminReply` uses `DisallowUnknownFields`. This prevents supported operator settings-preservation checks.

## Acceptance Criteria

- [x] CLI settings show accepts and returns a saved default language without changing state.
- [x] Regression coverage checks the gateway-to-CLI reply and browser-selected language persistence.

## Resolution

Added the optional language field to the CLI response type and regression coverage of saved settings through the gateway control handler and CLI decoder. Browser HTTP selection is checked against control replies and persisted state. See result.md for validation and the live-check limitation.
