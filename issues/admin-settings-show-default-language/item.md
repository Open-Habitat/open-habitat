---
created: 2026-11-02
updated: 2026-11-14
type: bug
status: open
priority: normal
provenance: other
provenance_detail: Observed live during authorized pilot release installation
source_ref: taskfleet:01m6ddwv432z2bh7s74eyf476h/observed:settings-default-language
originating_run: 01m6ddwv432z2bh7s74eyf476h
originating_run_kind: spinoff
lane: admin-cli
lane_seq: 1
preparation: ready
---

# Admin settings CLI rejects a browser-selected default language

## Description

Observed during the Alder pilot.18 installation baseline on Birch, while serving pilot.17: root `open-habitat admin settings show --json` exits 2 with `invalid_control_response: gateway returned invalid administration data`. Retried once with the same result. Host check is 20/20 ready; users/access/storage admin reads succeed. The read-only CLI failure obstructs the supported operator's settings preservation checks.

Source-grounded cause: internal/gateway/administration.go's control operation `show` serializes serverSettings after clearing onboarding/denied/receipts. With the browser-selected `default_language: "fi"` present, that field remains in the reply. internal/cli/admin_linux.go's controlSettings has no DefaultLanguage member and parseAdminReply uses DisallowUnknownFields. Both pilot.17 and current origin/main have this mismatch. The selected language is legitimate existing administrator state, not drift to erase.

Workaround for this installation: read only a minimal settings projection from /var/lib/open-habitat-gateway/administration.json (version/name/admins/default quota/default language/pending and designated admins), record its hash plus supported users/storage/access reads before and after. No gateway state, sign-in, quotas or language are edited; no journal/fence/selector bypass. Published pilot.18 installation continues independently, and its post-upgrade behavior will be recorded in the Fleetrepo result. No product source patch or release cut authorized in the install task.

Permanent correction: make the private CLI/gateway settings projection agree, including default_language, and add a round-trip test after a browser administrator selects a default language.

Private sanitized evidence: alder:/var/tmp/agent-keep/birch-v0.1.0-pilot.18/01m6ddwv432z2bh7s74eyf476h/{settings-before.err,settings-file-before.json,check-before.json}. Cross-target report: fleetrepo infra/open-habitat-upgrades/v0.1.0-pilot.18-01m6ddwv432z2bh7s74eyf476h.md. No secret values are included.
