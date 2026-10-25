---
created: 2026-10-20
updated: 2026-10-25
type: bug
reporter: jari
status: fixed
priority: normal
lane: header
lane_seq: 1
collision: [conversation-header]
closed: 2026-10-20
closed_by: conductor
---

# Regenerate title fails; its error shows in the wrong place and the spinner orbits off-centre

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20 (pilot.247): the conversation title's regenerate button fails immediately with a red 'Otsikkoa ei voitu generoida' notice that pops into the header instead of a sensible place. Daemon log: POST /api/v1/conversations/{id}/regenerate_title → 404 in 0 ms (08:11:00Z and 08:11:03Z) — the route or conversation id resolution is wrong. Also the arrow animation rotates around a point outside the button (orbits) instead of its own centre. Fix all three; errors belong in the product's normal notice place.

## Comments

### 2026-10-20T09:38:46Z · @agent

Root cause from source: POST regenerate_title is registered, but it looks up only ConversationController.sessions and returns 404 when the conversation has no in-memory RPC handle. Restored browser histories after a daemon restart are deliberately readable/controllable-on-send without such a handle (stoppedStatus), yet BrowserConversation always called this live-only operation. The existing history_title operation already names stopped native histories under its ownership/writer checks. UI defects are separate: AgentHeader rendered failureNotice inside the header, and the refresh SVG group mixed its placement transform with rotation about hard-coded outer-SVG coordinates. A focused remote browser regression is reproducing the restart case; no test-server access was made.

### 2026-10-20T10:07:03Z · @agent

Validation progress: TMPDIR=/var/tmp ./scripts/test-focused.sh --area web passes (format, lint, TypeScript; 49 unit files/264 tests and 31 component files/191 tests). The first run exposed pre-existing formatting in web/lab/claude-default-model.mjs; formatting-only prerequisite committed separately. The baseline browser job c8fd245a3f01d77bb3fd2daa7157de53d5328dc5b30c25f2b6b340830731a0b4 remained queued for 30 minutes and the observer expired, not the job; reconnected to the same identity. Fixed job 27e91599f35d132e07fb980222d669168d0283ce50a0347ea0c29f5068dd7330 is also queued. Neither is browser evidence yet. Synthetic before/after lab capture is unavailable under the Alder focused-runner policy; a taskfleet awaiting-input event asks the conductor for a waiver or authorized path. No local-browser bypass or live-server access.

### 2026-10-20T10:29:01Z · @agent

Reproduction confirmed: the pre-fix immutable browser capture (snapshot 9c7f3b80236dcc53753bcc6aab9bd91e4e7d4871ec49cf55fc2b7d542e4590ca; job c8fd245a3f01d77bb3fd2daa7157de53d5328dc5b30c25f2b6b340830731a0b4) reached the real controller, created/sent a synthetic conversation, restarted the daemon and reopened the same URL. Clicking regenerate returned HTTP 404 where the regression expected 200. This matches the reported instant live failure. Terminal result test-exit is the expected failing baseline, not a runner failure. Full synthetic trace and logs are retained under /var/tmp/oh-browser-723haj9z.

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.

## Result

Implemented in the worker branch, not landed pending the required lab-capture decision.

- The final immutable focused browser input `b9ff77d92b89e658e6813c0ddc8e2d50bda60e3662508660415760f176ab0ed7` passed both cases in `title-regeneration.spec.ts` (2 passed, 18.4 s; Linux ARM64, synthetic host, production controller/fake Pi). Job `27e91599f35d132e07fb980222d669168d0283ce50a0347ea0c29f5068dd7330` reached terminal `success`; fetched evidence: `/var/tmp/oh-browser-u4af9tin`. The job's stale status is an observation freshness flag, not a changed-source claim; runnable source has not changed since capture.
- Restarted history can regenerate successfully while its status stays stopped. A live request still uses the live operation, preserves its title on model failure and can be retried explicitly. Browser geometry freezes the real refresh-arrow animation at four angles and proves its centre stays fixed. The failure notice is outside the header, in the conversation notice area, and that area passes Axe.
- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area web`: passed format, lint, TypeScript, 264 unit tests and 191 component tests. `python3 scripts/validate-project-view.py`, `issuectl doctor --json` and `git diff --check` passed. No host/contracts/auth/fixture/build-input implementation was changed, so no Go suite, full gate or independent model review was warranted.
- Focused self-review checked operation selection, no automatic retry/fallback after a failed write, retained identity/navigation generation fences, and unchanged daemon ownership proofs. This changes no Unix-user security boundary or authority; it only selects between two existing guarded operations.

### Incomplete evidence and failed-command inventory

Before/after synthetic lab screenshot + HTML pairs remain unavailable: local lab/browser execution is prohibited on Alder and the maintained remote pilot refuses lab scope. No bypass was attempted. The conductor has an awaiting-input discussion requesting a waiver or an authorized lab path. Consequently the issue remains open and the worker must not merge yet.

Both initial browser observers expired after 1800 seconds in the shared queue. Reconnecting to the same job identities completed the expected failing baseline and passing fixed run; neither job was resubmitted. The baseline's HTTP 404 assertion failure is the reproduced bug. Initial fast-web attempts failed on baseline lab-script formatting plus new-code formatting, then the new spec's non-null assertion lint; those were fixed and the full focused web command passed. Two malformed awaiting-input event payloads were rejected before writing; the documented required fields were supplied and the event succeeded. Exploratory reads of nonexistent guessed filenames were replaced by searches for their actual locations; no deliverable depended on those reads. No other command/review remains failed except the required lab evidence above.

No live-server access or push was made. No Fleetrepo installation change is indicated by the fix. After deployment, the useful live check is a pre-existing browser conversation from before the daemon restart: regenerate should use `history_title` and return 200 (or a fixed model failure), with errors by the composer and no orbiting arrow. This synthetic evidence does not establish real provider availability or distinct-UID isolation.

## Resolution

### 2026-10-20T10:33:33Z · @conductor

Landed by conductor salvage (d3409c48); before/after lab captures waived under Alder's focused-remote-pilot policy.
