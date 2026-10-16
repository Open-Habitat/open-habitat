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

# + still broken live on home and workspace pages; sidebar + lands on workspace page

Jari on pilot after adb5d106 (2026-10-16 14:25 local): "+" still does not work on the workspace page or on the home page. The sidebar's + next to the workspace name works, but it opens the conversation slowly and then for some reason lands on the workspace page, not in the new conversation. Previous fixes (reconnect-button-dead 94d56f4e and 92006ca3; new-conversation-placeholder ee043baa and bdd7db3f) passed in the lab but did not fix it live. So the live state differs from the lab fixtures. Find the real cause from live evidence: the gateway and daemon logs for Jari's mapped user on the disposable test server (logs and API responses only, never conversation content), the snapshot fields that disable +, and the creation request and response sequence. Reproduce that exact state in the lab, then fix it.

## Acceptance Criteria
- [ ] The live cause is named in result.md, with the log or API evidence.
- [ ] + on the home page rows, the workspace page and the sidebar all open the placeholder immediately and land in the new conversation. Browser test reproducing the live state.
