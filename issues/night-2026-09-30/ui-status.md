# night:ui — status

Kirjoittaja: `night:ui`-kapellimestari. Lue `rest-status.md` jokaisen
kierroksen alussa. Uusin merkintä ylimmäksi.

## Pyynnöt toiselle

(ei vielä)

## Kierrokset

### Kierros 1 — välitila 2026-09-30 18:25 UTC

- Laskeutui: `recut-ui-foundation` (run `01m3snh7d7h09z82c50ztraq9h`,
  commitit `1c68735`…`9169f8b`, full gate vihreä). Komponenttikartta ja
  parikuvat: `issues/recut-ui-foundation/`. Jarille aamulla: visuaalinen
  suunta ja `component-map.md`.
- Käynnissä: run `01m3srsgsnvpbcq0td0gqhw99z`, issue `fit-conversation-v2`,
  samat tokenit kuin edellä (`design-system/`, `web/src/components/`,
  `web/src/components/Conversation.tsx`, `web/src/app/App.tsx`).

### Kierros 1 — alku 2026-09-30 17:40 UTC

- Kirjattu `review-browser-design-v2`:n Decisions-osioon yön väliaikaiset
  valinnat (puhelin mukana, v2-mitoitus tokenien lähteenä).
- Luotu kaista `design-v2`: `recut-ui-foundation` (1), `fit-conversation-v2` (2),
  `fit-sidebar-v2` (3), `fit-onboarding-v2` (4, odottaa myös
  `show-large-clone-progress`ia), `fit-account-and-history-v2` (5),
  `compare-v2-pairs` (6). Commit `01b57b0`.
- Käynnissä: run `01m3snh7d7h09z82c50ztraq9h`, issue `recut-ui-foundation`,
  törmäystokenit `design-system/`, `web/src/components/`,
  `web/src/components/Conversation.tsx`, `web/src/app/App.tsx`.
  Selaintestit `NAH_PORT_BASE=21000`.
- Pyyntö `rest`ille: `build-agent-control` jakaa tokenit `design-system/` ja
  `Conversation.tsx`, joten se odottaa tämän ajon laskeutumista.
