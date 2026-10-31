# Result: one workspace uses the normal rail

The single-workspace mode is gone from the code: `SingleWorkspaceBar`,
`SingleWorkspaceBarView`, their CSS, the `/` home that was the workspace
page, the mode-change notices ("näkymä keskittyy siihen"), the
single-workspace variant of the workspace page and its start hint, the
server line in the account menu and every catalog message they used. A
person with one workspace gets the same frame as everyone: the rail with
Etusivu, Sinun vuorosi and Käynnissä, the home page at `/workspaces` with
the workspace's cards, and the ordinary workspace page with its actions.
Deleting the last workspace is still refused by the daemon, and the
deletion dialog shows that blocker.

What changes with one visible workspace in a confirmed listing is only the
rail's workspace section. The *Työtilat* heading, its count, the filter, the
refresh and the one-row list give way to a quiet block at the foot of the
rail, just above the account:

- the workspace's name, with the folder icon and the monospace face the
  rail's workspace rows use, as a link to its page;
- *Lisää työtiloja* / *Add workspaces*, a link to `/workspaces/new`;
- a running clone and the folded *Arkistoidut* workspaces, when there are
  any, in the same block.

The narrow rail has no workspaces button then; its own toggle widens it.
With two or more workspaces nothing changes. Hidden workspaces do not count,
and an unconfirmed listing keeps the list, which says what is missing.

Screenshots (lab, device scale factor 2) are in `evidence/`:
`one-{desktop,phone}-{light,dark}-{fi,en}.png` for one workspace, and
`two-desktop-{light,dark}-fi.png` for comparison. `web/lab/capture-single-workspace-rail.mjs`
makes them.

Verified by `web/tests/workspace-count-rail.spec.ts` (one workspace; two
workspaces; Trash and restore across the count; a hidden workspace restored
from the rail), and by the changed `status-bell`, `lab-shell-header` and
`lab-page-scroll-header` specs, which now check the one-workspace frame
with the rail instead of the top bar. Host-backed synthetic evidence.

## Decisions for later review

1. **The workspace is named, not only *Lisää työtiloja*.** Jari was unsure
   between the two; both are there. The name is the shortest way back to
   the workspace page (finished conversations, Git, rename, worktree agent)
   from a conversation, and it tells a new person which workspace they are
   in. *Alternatives:* only *Lisää työtiloja* (quietest, but the page is
   then reachable only through the home cards and the conversation header);
   the name in the rail's head in place of the server (that was the old
   top bar's idea and hides the server). Dropping the name is a one-line
   change if it feels redundant.
2. **At the foot of the rail, above the account.** Where Jari pictured it:
   out of the way of Sinun vuorosi and Käynnissä, which are the rail's work.
   *Alternative:* directly under Käynnissä, where the list would be; it
   then floats in the middle of an otherwise empty rail.
3. ***Lisää työtiloja* is a link to the new-workspace page**, not the
   folder-plus icon button the list's heading has, because the block has no
   heading to carry an icon and the words say what it is. It is shown when
   adding is possible now (connected, writable, confirmed listing), like
   the icon button.
4. **The home page stays `/workspaces` with the workspace's cards**, as for
   everyone; `/` redirects there. The old mode made the workspace page the
   home page. *Alternative:* keep the workspace page as home for one
   workspace; that is a second frame again, which is what the issue removes.
5. **No notice when the count crosses one.** The frame no longer changes,
   only the rail's section, so the earlier mode-change notice had nothing
   to explain.
