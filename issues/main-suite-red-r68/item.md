---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: conductor
status: open
priority: normal
lane: unlaned
preparation: ready
---

# Integrated main browser suite red after round 68

## Description

Whole browser suite on integrated main e47d6f46a (8.11.2026): 14 failed / 596 passed, lab 3 failed / 172 passed. Logs: `/var/tmp/oh-suite-r68-logs/{browser,lab}.log`. Failing cases:

```
[chromium] › tests/github-first-onboarding.spec.ts:88:1 › @github-first native synthetic checkout before Pi, complete catalog and existi
[chromium] › tests/rail-groups.spec.ts:15:1 › @rail-groups @a11y Käynnissä rows are one line with a state ball and the host's last-cha
[chromium] › tests/settings-search.spec.ts:39:1 › @settings-search every index row is on its section's page and every page row is in the
[chromium] › tests/settings-model-picker.spec.ts:33:1 › provider browsing never chooses or saves, even with an older first catalog row 
[chromium] › tests/settings-model-picker.spec.ts:103:1 › a model choice shows at once with its thinking levels, Pi confirms in the backg
[chromium] › tests/settings-three-pages.spec.ts:49:1 › the three pages replace the old ones and each holds its own accounts 
[chromium] › tests/workspace-slice-security.spec.ts:107:1 › @workspace-slice account presentation follows the signed-in person 
[chromium] › tests/account-settings.spec.ts:83:1 › @account-settings verified native state, route return and explicit disconnect 
[chromium] › tests/account-settings.spec.ts:199:1 › @account-settings partial, unknown and logout/user switch 
[chromium] › tests/account-settings.spec.ts:268:1 › @account-settings Pi default model is read from native models and saved 
[chromium] › tests/account-settings.spec.ts:581:1 › @account-settings refused defaults and observation-only fallback cannot write a choi
[chromium] › tests/account-settings.spec.ts:704:3 › credential settings › @account-settings native key add, suffix, provider switch an
[chromium] › tests/account-settings.spec.ts:776:3 › credential settings › @account-settings Anthropic and DeepSeek keys are separate n
[chromium] › tests/account-settings.spec.ts:845:1 › @account-settings administration is host-authorized, not only hidden 
tests/lab-skill-invocation.spec.ts:9:5 › @lab @a11y recorded skill reader 1366 light ──────────
tests/lab-skill-invocation.spec.ts:9:5 › @lab @a11y recorded skill reader 390 light ───────────
tests/lab-english-url-paths.spec.ts:13:1 › @a11y English settings links survive OAuth, reload and browser history 
```

Most are settings specs, which suggests `settings-breakpoint-jump` (navigation folds at 1400 px, rail hidden at 1100 px while Settings is open) broke specs that assume two panes at the default viewport; `rail-groups` expects a rail ball `done` and now gets `you` (`worker-badges-pallot` changed the rail ball when workers await the person); `lab-skill-invocation` is a known load flake (`load-race-sweep`). Decide per case whether the product or the spec is wrong against the issue that changed it, fix it, and keep the intent of each landed change.

## Acceptance Criteria

- [ ] Every listed spec passes, run by name; root cause per group in result.md.
