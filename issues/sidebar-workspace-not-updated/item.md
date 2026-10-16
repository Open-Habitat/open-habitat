---
created: 2026-10-16
updated: 2026-10-16
type: bug
reporter: jari
status: open
priority: high
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
---

# Sidebar and workspace page: + stale after default change; old … menu and no Ikonirivi

Jari on the live test server, 2026-10-16 ~17:55 local, after changing the default model back in Asetukset:
1. + is **still disabled in the sidebar and on the workspace page**. It works on the home page. So the sidebar and the workspace page do not pick up the changed default or model state (stale `createReason` or catalog; see `plus-live-cause/result.md`). Fix 1abaa843 is live.
2. "Workspacen etusivu ja vasen sivupalkki eivät ole päivittyneet": the sidebar still has the `…` menu, and the workspace page does not show the accepted Ikonirivi, although `implement-workspace-ikonirivi` (70c24a3d) is live in the served bundle (the bundle contains `workspace-icon-row`). Find out which views or routes still render the old components. The sidebar component `web/src/components/Navigation.tsx` still contains a `…` menu, for example. Then finish the change everywhere.

## Acceptance Criteria
- [ ] After a default change in settings, every + (home, sidebar, workspace page) reflects it without a reload; browser test.
- [ ] No `…` menu in the sidebar workspace row, and the workspace page shows the Ikonirivi on every route that renders it. Paired lab screenshots against `rounds/2026-10-16-tyotilasivu-2` direction 2.
