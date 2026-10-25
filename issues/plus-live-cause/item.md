---
created: 2026-10-16
updated: 2026-10-25
type: bug
reporter: jari
status: fixed
priority: high
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
lane_seq: 6
closed: 2026-10-16
---

# + still broken live on home and workspace pages; sidebar + lands on workspace page

Jari on pilot after adb5d106 (2026-10-16 14:25 local): "+" still does not work on the workspace page or on the home page. The sidebar's + next to the workspace name works, but it opens the conversation slowly and then for some reason lands on the workspace page, not in the new conversation. Previous fixes (reconnect-button-dead 94d56f4e and 92006ca3; new-conversation-placeholder ee043baa and bdd7db3f) passed in the lab but did not fix it live. So the live state differs from the lab fixtures. Find the real cause from live evidence: the gateway and daemon logs for Jari's mapped user on the disposable test server (logs and API responses only, never conversation content), the snapshot fields that disable +, and the creation request and response sequence. Reproduce that exact state in the lab, then fix it.

## Acceptance Criteria
- [ ] The live cause is named in result.md, with the log or API evidence.
- [ ] + on the home page rows, the workspace page and the sidebar all open the placeholder immediately and land in the new conversation. Browser test reproducing the live state.

## Comments

### 2026-10-16T14:06:45Z · @jari

Jari ~14:05 UTC 2026-10-16, after 12471b59/70c24a3d were live: + is still disabled on the home page, in the sidebar and on the workspace page. Third live failure after lab-passing fixes.

### 2026-10-16T16:05:00Z · @jari

Live on pilot.180, Jari ~19:05: + now opens the conversation window at once. What remains ("Luodaan keskustelua" text, disabled field, "Spinoffien tilaa ei saada") is `composer-and-new-conversation`.

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
