---
created: 2026-10-29
updated: 2026-10-29
type: feature
reporter: jari
status: done
priority: normal
preparation: pending
provenance: chat
source_ref: chat:2026-10-29/proto-workspace-landing
lane: proto-workspace-landing
lane_seq: 1
closed: 2026-10-29
---

# Prototype: a landing section on the workspace (repository) page like the conversation start page

## Description

Jari 29.10.: repon (työtilan) etusivulle toivotaan samanlainen oma landing-osio kuin agentin etusivulla on (keskustelun aloitussivu, StartHere ja .agents/start-page.md:n tavoitteet, ks. start-page-skill, proto-start-page-presentation). Prototyyppikierros (design-system/prototypes -menetelmä: 2–3 suuntaa yhdellä akselilla, tuotantokonteksti nykyinen työtilasivu ja keskustelun aloitussivu vertailuksi, työpöytä ja puhelin, vaalea ja tumma, synteettinen data, yksi offline-tiedosto): mitä työtilasivun landing-osio näyttää (repon kuvaus, aloitustavoitteet, viimeisimmät keskustelut ja workerit, Git-tila), mistä sisältö tulee (sama .agents/start-page.md vai oma), ja miten se suhtautuu keskustelun aloitussivuun. Kirjaa result.md:hen host-faktat. Jari valitsee; toteutus on myöhempi issue.

## Decisions

### 2026-10-29T13:36:58Z · @jari

Jari 29.10.: Esittely is best. But a goal must not land somewhere that still needs an Aloita press, unless the request has something to fill in: Aloita is already pressed when the goal is chosen (the request is in the new conversation's composer). Implementation: workspace-landing-esittely.
