---
created: 2026-11-11
updated: 2026-11-11
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-11-11/icon-slow
lane: unlaned
preparation: ready
closed: 2026-11-11
closed_by: claude
---

# Workspace icon appears slowly after choosing it

## Description

Jari 11.11.2026 klo ~09.43 Birchlla (Habitat, tili maintainer): lisäsi työtilalle
`kunnollavauhtiin-monorepo` kuvakkeen (🚀, commit `bc41db4` "Työtilan kuvake: 🚀
(open-habitat)", `.open-habitat.yaml`, 09:43:40). Kuvake "tuli tosi hitaasti"
näkyviin.

Daemonin journaalista (`journalctl --user`, Birch):
- 09:43:09 `POST /api/v1/workspaces` 4 ms
- 09:43:15 `workspace_icon_suggestions` done, model `openai-codex/gpt-6-luna`,
  6017 ms; sama pyyntö `POST /api/v1/workspaces/{id}/{id}` 6020 ms
- 09:43:38–09:43:53 neljä `POST /api/v1/workspaces` (7–39 ms)
- Snapshotit 250–660 ms, joista `git`-vaihe 150–550 ms.

Selvitettävä: mikä osuus hitaudesta oli kuvake-ehdotusten mallikutsu (6 s, ennen
kuin mitään näytetään?), mikä commitin/`.open-habitat.yaml`:n kirjoitus ja mikä se,
että kiskon kuvake päivittyy vasta seuraavasta snapshotista/discoverysta.
Odotettu: valittu kuvake näkyy kiskossa heti valinnan jälkeen.

## Resolution

### 2026-11-11T08:18:00Z · @claude

Vahvistettu kuvakevalinta menee heti isäntämalliin journaalikohdan kanssa; ks. result.md.
