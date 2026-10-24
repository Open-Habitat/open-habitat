---
created: 2026-10-24
updated: 2026-10-24
type: improvement
status: untriaged
priority: normal
provenance: other
source_ref: taskfleet:01m5pv1jdwd7k4dzsxz79f57c3/observed:site-key-route-gate
originating_run: 01m5pv1jdwd7k4dzsxz79f57c3
originating_run_kind: spinoff
---

# A person seeded with the site AI key skips the whole first-login route

## Description

# A person seeded with the site AI key skips the whole first-login route

## Observed

With the site AI key stored (Käyttöönotto › AI-tili › Sivuston avain), a new
person's first sign-in seeds the key into their own Pi `auth.json`, so native Pi
status is `usable` from the first page load. The browser shows the first-login
route only while Pi status is `missing` (`web/src/app/App.tsx`, the first-load
gate: `status === "missing"` → phase `pi`; otherwise the snapshot and
Työtilat). The seeded person therefore lands directly in Työtilat: they never see
Git identity confirmation, the Repot chooser (in `preselected` mode they choose
nothing), or the integration steps the administrator added. Reproduced in the
synthetic browser host by `web/tests/site-ai-key.spec.ts` (the seeded case lands
on `workspaces-title`); `auto` and `skip` defaults are still imported, because
the handoff carries that plan.

## Why it matters

The prototype (`proto-admin-server-onboarding` r3–r4) and ADR 0030 intend the
site key to remove only the AI step: the route becomes GitHub → Repot →
integrations. Today the key also removes the steps the administrator configured,
which the Käyttöönotto preview does not show.

## Direction

The browser needs a signal that this person's first onboarding is still in
progress, independent of Pi status. That is a small design decision: for example
the person-side onboarding read could say the sign-in that created the account
seeded the key (from the per-subject receipt, `ai_key: seeded`), with a durable
"route finished" mark kept as the person's own state. It must not become a
host-side onboarding registry.
