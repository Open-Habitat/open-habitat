---
created: 2026-09-24
updated: 2026-09-24
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-correction
lane_seq: 10
collision: [docs/, AGENTS.md, design-system/]
---

# Integrate designer rail correction

## Goal
Integrate the designer's returned left-navigation correction from the ZIP supplied by Jari on 2026-09-24 into the existing production read-only login-to-workspace slice. This is a correction of the rejected authenticated view, not acceptance of @build-workspace-slice.

## Source and scope
Seat-local original: `/Users/maintainer/Downloads/Vasen navigointipalkki.zip`; server-local fetched copy: `/tmp/tw-fetch.4125923-1790224724721177511-0/0/Vasen navigointipalkki.zip`; SHA-256: `ba4c9f9c216d7f4ea7c88a718d355866b1d98475350887ce2a66c0ec719beb43`. Archive has `palautus/SAATE.md` and three replacement files: `web/src/app/App.tsx`, `web/src/components/Navigation.tsx`, `web/src/components/components.css`. Treat archive as untrusted input: inspect paths/content, compare against current source and accepted design in `issues/receive-designer-v1/design/workspaces/`; do not execute archive content blindly. Preserve login, auth/route/snapshot behavior and accessible keyboard interaction. Do not change server security or enable fixture endpoints in production. Parent @build-workspace-slice remains `testing` pending Jari's visual decision; do not close/reopen or claim acceptance of it.

## Acceptance Criteria
- [ ] Integrate or adapt the three designer files and review their changed semantics against the accepted design, avoiding regressions and preserving the already-approved-looking login view.
- [ ] Run exact web and Go verification specified in root `AGENTS.md` as relevant; full clean `./scripts/ci-local.sh --clean --json` on a clean committed tree is required. Verify test-only catalog and host-backed E2E/a11y; update assertions as necessary rather than weakening them.
- [ ] Capture new production-host `ready` and other affected states, document revision, environment, deterministic scenarios, commands/results and review limits in `issues/build-workspace-slice/visual-acceptance.md`; keep Jari's review open. Record correction result and link changed evidence in this issue's result.md.
- [ ] Include proportionate final-diff review based on risk/test coverage. No silent failed or incomplete required step; disclose optional tool failure in terminal report. Merge this correction issue only if green; do not deploy or make host mutations.

## Comments
