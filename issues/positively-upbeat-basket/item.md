---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: duplicate
priority: normal
provenance: other
provenance_detail: Observed in the clean gate run for onboarding-default-repositories and reproduced on main
source_ref: taskfleet:01m5p7md6jc61z9ze0cfam1pve/observed:lab-specs-main
originating_run: 01m5p7md6jc61z9ze0cfam1pve
originating_run_kind: spinoff
closed: 2026-10-24
---

# Lab browser specs fail on main after the onboarding tab and route map

## Description

The lab browser suite (`./scripts/ci-local.sh --clean` lab phase, or `python3 scripts/browser-focused.py --lab --spec <spec>`) fails on `main` (02783d53, 2026-10-24) in specs that recent onboarding work did not update:

- `tests/lab-english-url-paths.spec.ts:13` — the settings link list now contains `/settings/onboarding` (the Käyttöönotto tab added by `onboarding-config-store`); the expected slug list lacks it.
- `tests/lab-outage-account.spec.ts:9` (`pi-onboarding account menu admin` and `non-admin`) — `expect(page.getByRole("navigation")).toHaveCount(0)` finds one: the onboarding route's `<nav aria-label="Käyttöönoton vaiheet">` (Kartta frame, `onboarding-route-map`).
- `tests/lab-conversation.spec.ts:1050` (`slow turn explains work and stop requires an explicit confirmation`) — fails on main as well; cause not investigated.
- `tests/lab-browser-editor.spec.ts:9` (`editor evidence …`) — flaky: `getByTestId('editor-file-entry').filter({ hasText: 'main.go' })` matches both `cmd/main.go` and `main.go` when the tree is expanded (strict-mode violation); passes on a rerun.

Impact: the clean gate cannot pass, so no gated release and no main health receipt. The ordinary browser suite (343) passes.

Direction: update the two expectations to the current UI (navigation check scoped to the app's own navigation, slug list including onboarding), make the editor locator exact (`data-path="main.go"`), and diagnose the slow-turn case.

## Comments

### 2026-10-24T07:53:08Z · @agent

Same failures fixed under hugely-wakeful-crowd (ec107e62); the editor locator flake is singularly-habitual-kitten.
