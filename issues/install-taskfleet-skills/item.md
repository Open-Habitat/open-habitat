---
created: 2026-10-16
updated: 2026-10-16
type: task
reporter: jari
status: done
priority: high
lane: pi-runtime
lane_seq: 6
collision: [internal/daemon]
preparation: ready
closed: 2026-10-16
---

# Taskfleet skills and host note on the test server

Jari approved on 2026-10-16 (after `taskfleet-skills-for-open-habitat`): install **Taskfleet's own bundled skills as they are**, pinned to the guest's Taskfleet release (0.15), for the test server's Pi, together with **one short host note** that tells agents how this environment differs: no desktop seat or tmux view for the person; the browser shows spinoffs under the parent conversation (Langassa); start spinoffs headless and wait for them with `taskfleet run wait` as a process, so the parent shows "Odotan spinoffia" and wakes when the wait ends; no Telegram, `tw` or Fleetrepo. There are no Open Habitat forks of the skills. Environment neutrality is fixed upstream in Taskfleet (`~/Sources/taskfleet/issues/environment-neutral-skills`), and the guest gets it with the next Taskfleet release.

Distribution: operator-declared, alongside the Taskfleet runtime in Fleetrepo's guest runtime. Both the browser's parent Pi and the spawned workers must discover the skills and the note.

## Acceptance Criteria
- [x] Operator-declared unchanged 0.15.0 skills and native host note installed; fresh mapped-user parent/worker discovery and real provider spawn/process-wait/wake/landed proof recorded in result.md. Deployed product API associates the child with the correct parent.
- [ ] On the test server, a fresh browser Pi conversation lists the Taskfleet skills, and the note is in its context. Manual repeat is in KOKEILTAVAA.md; native discovery is verified.
- [ ] Jari repeats the tiny spinoff and wait from the browser, checking Langassa and the waiting state (KOKEILTAVAA.md). Provider/API proof is complete, with the same-child salvage qualification in result.md; browser rendering has not been observed.

## Comments

### 2026-10-16T14:15:37Z · @conductor

The native Pi default of the mapped user became openai-codex/gpt-5.3-codex-spark (refused) at about 12:57 UTC, during this issue's live proof (Fleetrepo run 01m52c7jgmgby32b4f65vsqt8d). The same minute left a stale .git/index.lock in Fleetrepo's live checkout. That disabled every + for Jari (see plus-live-cause/result.md). A proof must never change saved defaults. Before closing, identify how it happened and confirm the proof path cannot write settings.

### 2026-10-16T14:58:49Z · @conductor

Correction: Jari found that the settings model picker selects a model by itself when switching provider tabs (settings-model-picker-autoselect). That, not this proof, is the likely cause of the gpt-5.3-codex-spark default. Keep only the general rule that a proof must not change saved defaults.

### 2026-10-16T15:11:21Z · @jari

Jari 17:59 local (sidebar screenshot copied here as proof-clutter.png): the proof left a workspace 'taskfleet-skills-proo…' with three 'This is an authorized, tiny runtime acc…' conversations in his account. Remove the proof workspace and its native sessions after the proof (they are disposable test artefacts created by this issue), and in future run proofs so that they do not appear in his workspace list.

## Resolution

### 2026-10-16T15:19:22Z · @issuectl

Implementation and mapped-user provider/API proof complete; see result.md. All 14 unchanged pinned skills and native host note installed through Fleetrepo. Fresh browser UI acceptance remains explicitly unchecked in KOKEILTAVAA.md; successful same-child recovery is not claimed as uninterrupted self-merge.
