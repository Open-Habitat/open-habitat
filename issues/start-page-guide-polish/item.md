---
created: 2026-10-23
updated: 2026-10-25
type: improvement
reporter: jari
status: done
priority: normal
preparation: ready
lane: start-guide
lane_seq: 4
collision: [web/src/components/start-page]
closed: 2026-10-23
---

# Start page: short skill hint, faster open, Aloita buttons and staying on the guide

## Description

Jari 2026-10-23 07:03 on the test server, after `implement-start-page-guides` and `start-page-invalid-file-and-hint`:

1. Hint "Päivitä aloitussivu kirjoittamalla viestikenttään /skill:open-habitat-start-page. Voit myös jatkaa kirjoittamalla agentille omin sanoin." — drop the `skill:` part: show `/open-habitat-start-page`. Verify the composer actually accepts the short form for skills (Pi natively uses `/skill:<name>`); if it does not, make the composer's command handling accept `/<skill-name>` for installed skills (resolving to the native invocation) so the hint is true.
2. "Luetaan aloitussivua…" stays visible too long when a new conversation opens. Measure where the time goes (daemon read/parse, snapshot, command list) and make the page appear fast; if a wait remains, show the layout without a loading sentence.
3. Guide page: the two Aloita buttons are on opposite sides (top right next to the title, bottom left). Put them on the **same side: left**, aligned with the text column (top one directly under the title).
4. Remove the text "Pyyntö lisätään luonnokseen. Voit muokata sitä ennen lähettämistä." next to the bottom Aloita.
5. Pressing Aloita moves the view back to the start page's landing view (goal list). It should not: stay on the guide page; only insert the request into the composer (caret at the end, two trailing newlines, as already implemented) and focus the composer.

## Acceptance Criteria

- [x] All five points hold on desktop and 390 px, light and dark; browser tests cover 3–5 and the hint text; the timing of 2 is measured before/after in result.md.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
