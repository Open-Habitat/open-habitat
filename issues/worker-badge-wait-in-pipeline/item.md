---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# Worker waited on through a cd-prefixed, piped command still shows as not waited on

## Description

- **Laajennetulla tunnuksella odotettu worker näkyy yhä odottamattomana** (8.11. pilot.640, `worker-badge-misses-expanded-wait` ei korjaantunut tässä muodossa): agentti ajoi bash-työkalussa `cd /var/tmp && taskfleet run wait $(tr '\n' ' ' < active.txt) --any --output json 2>&1 | grep … | head -4` (worker 01m6xy7dpqd1c1g0gnbsdffhg8, odotus n. 16:02:30–16:04:46Z). Jarin kuvakaappauksessa 16:03:55Z Workerit-paneelin rivillä lukee *agentti ei odota*, ja sirun ja paneelin pallossa ei ole kehää. Ero korjauksen testitapaukseen: komennon edessä `cd … &&` ja perässä putki; selvitä, löytääkö live-argv-tunnistus odotuksen tällaisesta komentorivistä (`internal/daemon/processes_linux.go`, `internal/daemon/process-extension.mjs`, 04bd29683).

## Acceptance Criteria

- [ ] Reproduced in a test; fixed; touched specs green.
