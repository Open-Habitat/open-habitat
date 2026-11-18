# Result

Sinun vuorosi and Käynnissä now carry the same workspace filter as Hiljaiset:
the workspaces' stacked marks at the heading's end open the same tile grid
(Kaikki and one tile per workspace with its count). Hiljaiset's menu was
extracted into `web/src/components/SectionFilter.tsx` (`sectionView`,
`SectionFilterMenu`, `SectionCount`, `NarrowedEmpty`), and all three headings
use it; Hiljaiset adds its order control above the tiles as before.

The account preferences contract gained `yours_workspace` and
`running_workspace` (a workspace id or null, written one at a time like
`quiet_workspace`); the daemon stores them in the same preferences file and
leaves them out when they mean every workspace.

## Decisions for later review

- **Each section keeps its own filter.** Alternative: one choice for all
  three. Sinun vuorosi lists what waits for the person; if narrowing
  Hiljaiset also narrowed it, waiting work could disappear from sight without
  the person having touched that heading. Jari asked for the same filter on
  each heading, which reads as one per heading.
- **Persistence is the same as Hiljaiset's**, in the account preferences, so
  the choice follows the person to every device. That meant two new contract
  fields. A per-device (localStorage) choice would have avoided the contract
  change, but it would have behaved differently from the Hiljaiset filter
  right beside it.
- **When the filter shows.** Hiljaiset shows its menu whenever it has rows,
  because the menu also holds the order. Sinun vuorosi and Käynnissä show it
  when their rows come from more than one workspace, *or while they are
  narrowed*, so a narrowing never hides rows without its control in sight.
- **No order control** on Sinun vuorosi or Käynnissä. Their order has its own
  meaning (newest raise first; Käynnissä grouped by workspace without icons).
- **Counts** follow Hiljaiset: `shown/total` while narrowed (screen readers
  hear "2/4, 4 yhteensä"), else the total. Sinun vuorosi keeps its attention
  badge style.
- **The open conversation stays in sight** when the narrowing would hide it,
  last in its section and marked "avoinna, rajauksen ulkopuolelta", as in
  Hiljaiset.
- **⌥↑/⌥↓ walk only the rows shown**, and ⌥⇧↑/↓ cycles only the shown
  Sinun vuorosi rows: hidden rows are not keyboard destinations, just as they
  are not click targets. The narrow rail has no headings and so no filter: it
  shows and walks every waiting and running row, unnarrowed.
- **An empty narrowing** (the chosen workspace has nothing in the section
  right now) says "Ei mitään työtilasta X." with a "Näytä kaikki (N)" button
  instead of the section's ordinary empty text. Hiljaiset got the same line,
  where before it showed an empty list.
- **Before the account preferences load**, the sections show every
  workspace and then narrow, just as Hiljaiset already does. The menus wait
  (disabled tiles) until then.
- The English "kept" text is now shared by all three sections and reads
  "open, outside the filter" (earlier Hiljaiset said "outside the narrowing").
- Explain mode: new cards S36 (the filter button) and S37 (Näytä kaikki);
  S28/S29 (tile, Valmis) now cover all three menus.

## Verification

- `./scripts/test-web-fast.sh`: green (232 files, 1869 tests), including the
  new `SectionFilter.test.tsx` and the extended `railKeyboard.test.ts`.
- `./scripts/test-focused.sh --area contracts`: green.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: green.
- Browser, `OH_BROWSER_WORKERS=2`, three runs in a row, 15/15 each:
  the new `rail-section-filter.spec.ts` (filtering in each section,
  persistence across reload, keyboard order and Shift cycle over the
  narrowed rows, the kept open row, the empty narrowing, desktop and phone
  drawer, light and dark with axe, Finnish and English), plus
  `rail-icons-quiet.spec.ts`, `next-waiting-row.spec.ts` (@rail-keyboard) and
  `rail-now.spec.ts`.
- Lab `lab-explain-coverage.spec.ts`: green (12 passed).
- Storybook: `Production/Sidebar v2` has FilteredLight and FilteredDark.
