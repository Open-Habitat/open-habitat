---
created: 2026-10-29
updated: 2026-10-30
type: feature
reporter: jari
status: done
priority: normal
lane: experimental
lane_seq: 2
collision: [web/src/components/Navigation.tsx]
preparation: ready
closed: 2026-10-29
---

# Experimental: worker row work sentence

_Source: chat_

## Description

Implement `proto-worker-row-work-facts` direction **Lause** (Jari 29.10.): the worker row says in words on its second line whether the worker has produced something (changed files, lines, ahead/behind, PR and checks), including the gh-missing and Git-not-answering states. An experimental feature behind its Kokeelliset ominaisuudet switch. Host facts the result names as missing: the Taskfleet worker's diff against its source branch and the PR via the person's own gh.

## Acceptance Criteria

- [x] Sentence on worker rows in the panel and sidebar from native Git/gh reads.
- [x] Behind the experimental switch; browser spec; KOKEILTAVAA line.
