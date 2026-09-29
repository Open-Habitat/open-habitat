---
created: 2026-09-29
updated: 2026-09-29
type: improvement
status: open
priority: high
related: ['@github-repos-first-onboarding']
lane: github-picker-ui
collision: [web/src/app/github.ts, test/browser-host/main.go]
---

# Show a useful GitHub repository page during first use

## Description

Live pilot.10 first-use UI currently fetches only two GitHub repositories per page (`web/src/app/github.ts` hard-codes limit=2), forcing repeated “Näytä lisää repoja” clicks to reach most of the mapped user’s repositories. Jari requests the simplest possible UI. Widen to a normal bounded page size (recommend 50, the existing daemon/gateway contract maximum), retaining the current explicit selection→one Jatka checkout, verified outcomes and Pi order. Adapt the production-bundle synthetic gh/browser fixture to prove a full page and page continuation; no runtime test fixture seams, no credential output, no new store. Confirm accessible scroll/read position and Finnish empty/error/partial states. Clean committed-tree CI and package verification; deployment requires a *new* guarded successor of active pilot.10, not replay of the one-shot pilot.9 successor operator. Live visual acceptance remains with @github-repos-first-onboarding.
