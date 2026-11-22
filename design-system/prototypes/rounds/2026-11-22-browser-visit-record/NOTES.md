# Selainkäynti keskustelussa

Issue `server-browser-agent-visit-log`. This round replaces a discarded
round of the same issue. Only the prototype changed: production state, the
contract and authority are untouched.

Axis: **where the record of the agent's browser use lives in the
conversation.** The content is the same in every direction: the time span,
the sites, pages (title and path, no query), downloads, presses and entries,
and whether the agent's tab is still open.

- **1 Rivi:** a Habitat line after the turn, in production's
  `ConversationLine` style. "Näytä" opens the list in place.
- **2 Kortti** (recommended): a *Selain* card under the reply, next to
  *Muutokset*, using the same card shape (`ah-turn-changes`). While the turn
  runs it shows as *Selain nyt* under the working strip, with *Katso*.
- **3 Työ:** inside the agent's work. The browser commands form one *Selain*
  group, and the turn's work row gets "· selain: 13 sivua". While work is
  hidden, only that mark is visible.

Shared by all three: the live window list. These are production's
`BrowserChip` and `BrowserStrip` with a synthetic status. The agent's tab
keeps production's "agentti tässä" and adds "Agentin välilehti · 8 sivua
tässä". Below the strip, "Näytä keskustelussa" scrolls to the record. When
the agent closes its tab, only the person's own window is left in the list,
and the record stays in the conversation.

The page is built from production components (`AgentTurn`, `PiToolUse`,
`BashToolCard`, `TurnChanges`, `ToolGroup`, `AppShell`, the browser
components) with the shared picker. The round adds only the record's own
pieces and two small slots: the work-row mark and the tab count, both inserted
into production DOM.

## Try

Review bar: theme, language, **Kesken / Valmis**, **Seuraava askel**
(steps the visit to its end, one command at a time). The page opens on the
finished state; `?state=live` opens in progress. All of it is synthetic:
`stays.example`, the bookings `R-10xx` and an invented person.

## Build and check

From the repository root, with `web/node_modules` installed from the lock:

```sh
node design-system/prototypes/rounds/2026-11-22-browser-visit-record/build.mjs <out-dir>
PLAYWRIGHT_BROWSERS_PATH=… node design-system/prototypes/rounds/2026-11-22-browser-visit-record/check.mjs <out-dir>/offline.html <shots-dir> [--quick]
```

On shared hosts, wrap both in the scratch lease and a timeout. `build.mjs`
writes `offline.html` (fonts embedded) and `index.html` (no fonts, for
sandboxed hosts). The esbuild `composes` warnings come from production CSS
modules. `check.mjs` covers every direction × fi/en × Päivä/Yö/Kontrasti ×
1440/390 px: the picker contract, the default view, the opened record (13
pages on two sites, 13 files, 2 presses/entries), the visit in progress (two
windows, the agent's tab named and counted, the person's window unmarked),
the strip-to-record link, stepping to the end, no overflow, a clean console
and no network.
