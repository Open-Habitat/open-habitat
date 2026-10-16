# Sidebar default refresh and workspace route verification

## Reproduction and cause

Base `2150ab96`, manual synthetic lab at `OH_PORT_BASE=29600` (29601),
`web/lab/session.mjs`, invented Alice and homes. The issue contains no attached
screenshots in this checkout, so the visual reference is the requested accepted
round, not an unseen live image.

Opening Settings reliably disables every sidebar + with `Ladataan oletusagentin
tietoja.`. `App` cleared its separate direct-start observation on entering
`/settings` and returned without reading it. Saving through `PiModelSelector`
updated the identity-scoped picker catalog, but never refreshed App's admission
observation. This is a real state-ownership disconnect: successful settings writes
were not propagated to the code deciding whether + works. A full navigation
usually repaired it; client-side creation from Settings could not.

Fix: Settings is no longer an excluded discovery context. A confirmed default
save invalidates and rereads direct-start admission; failed saves do not claim a
new default. Route rechecks keep the previous same-identity observation mounted,
preventing a briefly enabled button from being disabled mid-click on navigation.
Identity resets still clear it, failures still deny creation, and aborted reads
cannot overwrite newer observations. No new cache, preference store, automatic
model substitution, automatic creation retry or identity authority was added.
The picker implementation is untouched to avoid the parallel worker's changes.

## The reported old menus

The baseline already renders `WorkspaceActions` in both `WorkspaceRailView` and
`WorkspacePage`. `Navigation.tsx` receives that node; it has no ellipsis/menu
implementation. Workspace landing is selected by the workspace path without a
`conversation` query; conversation and pending routes deliberately render the
conversation instead. There is no second workspace landing component to replace.
Baseline [workspace](before-workspace.avif) / [HTML](before-workspace.html)
already shows Ikonirivi and a sidebar +, not an ellipsis.

A newly served bundle containing `workspace-icon-row` does not establish which
bundle a previously opened SPA tab is executing. React Router navigation does
not fetch a new shell, and this application has no automatic bundle replacement.
The gateway serves HTML with `Cache-Control: no-store`, which applies on a real
page load, not internal navigation. An older tab is therefore a plausible
explanation of the reported combination, **not verified live attribution**.
No live profile was accessed and no automatic page reload was introduced (it
would interrupt drafts and reading). KOKEILTAVAA asks for one explicit reload
for the existing menu change, followed by settings changes without further
reloads for this state correction.

## Paired visual comparison

All captures are synthetic. Images have adjacent static HTML; PNG originals are
encoded with `avifenc --speed 8 --jobs 1 --qcolor 80`. Settings before/after:
[before](before-settings.avif) / [HTML](before-settings.html),
[after save](after-settings.avif) / [HTML](after-settings.html).

After saving a healthy default, returning via Back shows the accepted workspace
state. The paired reference is direction 2 of
`design-system/prototypes/rounds/2026-10-16-tyotilasivu-2`:

| State | Lab | Accepted round |
| --- | --- | --- |
| Desktop light | [Lab](lab-page-1440-light.avif) | [Round](round-page-1440-light.avif) |
| Desktop dark | [Lab](lab-page-1440-dark.avif) | [Round](round-page-1440-dark.avif) |
| Phone light | [Lab](lab-page-390-light.avif) | [Round](round-page-390-light.avif) |
| Phone dark | [Lab](lab-page-390-dark.avif) | [Round](round-page-390-dark.avif) |

No CSS or action layout is changed here. Copy, GitHub, pencil, hide, disabled
trash, divider and + are visible in the accepted order; phone icons wrap to
their own row. The sidebar retains only +. Deliberate existing differences:

- The lab has two native-history/read-only unknown-state cards, not five
  invented active prototype sessions. Titles, recap ages, counts, Markdown-as-text
  and wrapping follow those native fixtures; manufacturing active native facts
  would misrepresent the host. Full-width long cards differ accordingly.
- The production rail keeps its existing hostname/account/filter/discovery
  controls and synthetic workspace names. This state fix does not redesign it.
- Production uses its shared 32 px desktop icon targets (40 px narrow) rather
  than the prototype's 28 px +. Its Git pill preserves the observed textual
  branch/count label rather than decorative branch/caret glyphs. These are
  the already documented implementation differences, not new deviations.
- The disabled deletion action retains its accessible recovery-design reason,
  not a fabricated working delete. Native Git freshness and read failures stay
  honest. Production's native path differs from the prototype's example path.
- Settings has no workspace-round counterpart; its pair isolates the actual
  bug: disabled sidebar creation before, enabled creation after a confirmed save.

## Validation

On base `2150ab96` plus this fix:

- Baseline mutation run: the three new `lab-sidebar-default.spec.ts` cases all
  fail at the disabled sidebar + after saving, with the original App restored.
  Tests seed a refused native default, save a healthy default through the real
  settings UI/host endpoint, then start exactly once from Settings' sidebar,
  home or workspace without reloading. They require an enabled composer, not
  just the optimistic placeholder, and verify the native saved default.
- Focused fixed run: new default regression **3/3**, existing workspace page
  (including accessibility) **8/8**, placeholder regression **6/6**.
- Fast web checks: format/lint/TypeScript, **144 unit and 133 component** passed.
- During development, the workspace sidebar click exposed the route recheck
  clearing eligibility mid-click (7/8); retaining the same-identity observation
  during that read fixed it. The final existing suite passed 8/8. An initial
  test used Playwright `check()` on a server-confirmed radio; changed to click
  then assert checked after the POST, matching its asynchronous semantics.
- `issuectl doctor --json`, Project View validation and `git diff --check` pass.
- Browser commands: `scripts/test-focused.sh --area browser --spec <spec>`,
  `TMPDIR=/var/tmp/oh-sidebar-build OH_PORT_BASE=29600 OH_BROWSER_WORKERS=2
  CHOKIDAR_USEPOLLING=true PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright`.

Focused self-review checked same-identity/abort guarding, confirmed-save-only
invalidation, failed-read denial, route transitions, single creation POSTs,
refused-default recovery and unchanged CSRF/uncertainty/native source guards.
No old menu renderer was found or silently added back. A later extension of the
workspace case verifies conversation-header return and a direct page reload
also retain the six visible actions.

Final account-settings/extended-route run and committed-tree gate results follow.
These checks prove synthetic browser/host interaction, not a live provider turn,
separate-UID isolation, or that Jari's existing tab has loaded this version.
