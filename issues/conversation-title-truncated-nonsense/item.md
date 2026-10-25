---
created: 2026-10-23
updated: 2026-10-25
type: bug
reporter: jari
status: fixed
priority: normal
preparation: ready
lane: agent-host
lane_seq: 3
collision: [internal/daemon/pi]
closed: 2026-10-23
---

# Titles cut mid-phrase and title model unavailable

## Description

Jari 2026-10-23 08:27 on e7872708, after `conversation-title-too-long`:
- Regenerating gave "Repositorion sisällön ja" — a hard cut at five words / 32 characters produces nonsense. Never truncate a title mechanically; ask the model for a short, complete title (2–5 words) and if the answer is too long, ask once more with the constraint; only then fall back to a sensible complete phrase.
- Another attempt failed with "Otsikkoa ei voitu luoda. Otsikointimalli ei vastannut." (`conversation_title outcome=failed operation=history reason=model_unavailable` at 4.7 s). Find why the title model was unavailable (timeout too short for a cold Pi, wrong model selection, provider error) and fix it.

## Acceptance Criteria

- [x] Titles are complete, meaningful phrases within the bound, tested with real Pi on Finnish and English conversations including a long first message; no "model_unavailable" on a cold start.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
