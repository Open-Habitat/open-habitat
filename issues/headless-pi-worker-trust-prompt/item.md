---
created: 2026-10-29
updated: 2026-10-29
type: bug
reporter: jari
status: open
priority: normal
lane: worker-presentation
lane_seq: 3
preparation: ready
---

# Headless Pi worker stuck at the folder trust prompt while Habitat shows it working

_Source: chat_

## Description

From KOKEILTAVAA.md (test server testing):

Headless Pi -worker jää Pi:n kansioluottamuskyselyyn, mutta Habitat näyttää sen työskentelevän (28.10., pilot.447, havaittu testikierroksella): `taskfleet run create --kind spinoff --headless` (harness pi, profiili builtin) käynnisti Pi:n worktreessa `~/src/open-habitat__worktrees/wt-…`, ja Pi pysähtyi heti kyselyyn *Trust / Trust parent folder / Trust (this session only) / Do not trust*. Headless-ajossa siihen ei vastaa kukaan. Pi-istunnossa on vain otsakerivi, ja Taskfleetin mukaan ajo on `pending`, mutta worker-näkymä näyttää *Työskentelee* ja Workerit-paneeli *agentti odottaa*. Korjattavaa on kaksi: worktree-kansion luottamus on ratkaistava ennen headless-käynnistystä (Taskfleetin Pi-käynnistys tai Habitatin Pi-asetukset), ja Habitatin pitää näyttää ihmiselle, ettei worker etene (`worker-view-conversation`).
