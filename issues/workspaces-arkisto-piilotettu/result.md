# Result

**Toggle.** `ArchivedWorkspaces` (web/src/components/Navigation.tsx) computed
`open = show || forceOpen || <a hidden workspace is selected>`. Hiding the
current workspace made it a selected hidden one, so the section was forced
open, the header's `setShow(!open)` could not close it, and it closed only
when navigation changed the selection. The section now follows its header
alone; it opens by itself only when you go to a workspace that was already
hidden, and hiding the current workspace leaves it closed, because the hide
notice says where the workspace went. Navigation never flips it.
`workspace-archive.spec.ts` covers hide → closed → click/Enter/Space toggle →
navigate away and back with the state kept; on main it fails at the first
header click.

**Wording.** Workspace hiding reads Piilota / Piilotettu / Piilotetut
(Hide / Hidden) in the page action and its hint, the sidebar group, the
workspace page's status and hide notice, refusal/revert errors and Explain
mode (S14, T05); the UI skill references were regenerated with
`scripts/generate-ui-reference.py`. Conversation archiving keeps its words.
Text keys were renamed where they named the workspace action; the component
name, test ids and the daemon's `hidden` field were left alone.
`docs/product.md` still says "archived workspaces" in Jari's product text;
left for him.

**Checks.** `test-focused.sh --area web` green; browser specs
workspace-archive, mutation-layer, rail-now, workspace-count-rail and lab
workspace-page green, the first two also with `--repeat-each 3`.

## Live check

After release: hide a workspace from its page. The button, notice and sidebar
group say Piilota / Piilotettu / Piilotetut; the group stays closed, its header
opens and closes it on every click and with Enter/Space, and going to an agent
or another workspace does not open or close it.
