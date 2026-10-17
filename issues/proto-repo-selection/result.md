# Result

Round: `design-system/prototypes/rounds/2026-10-17-repon-valinta/`

```
node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-17-repon-valinta
```

The command writes `design-system/prototypes/dist/2026-10-17-repon-valinta.html`. `check.mjs` passed for every direction in light, dark and phone, with clicks in each direction (open picker, choose the monorepo, clone, time filter). The console was clean. A separate journey script ran all three outcomes in every direction, and also ran a successful clone at phone width in the dark theme. Its console was clean too.

## Today's production flow (lab and code)

- **Dialog.** It has the tabs Kloonaa GitHubista / Uusi hakemisto, an `omistaja/repo` field, and at most six suggestions. The suggestions come from **page 1 only** of `GET /api/v1/onboarding/github/repos?page=1&limit=50`. The daemon reads `/user/repos?affiliation=owner,collaborator,organization_member&sort=full_name`, so it gets the first 50 repos alphabetically. In an organisation with 64 repos, most are never offered, and filtering only searches those 50. The catalog carries only `full_name`, `private`, `description`, `html_url` and `pushed_at`. It has no size and no default branch.
- **Clone.** `POST …/clone/stream` runs a full `git clone` straight into `~/src/<repo>`. It streams the stages reserving, connecting, receiving %/bytes, checkout and verifying. Closing the dialog aborts the stream, which also cancels the clone. A failure does not remove the directory. The next attempt is then refused with `checkout_exists`. A daemon restart leaves exactly what Jari saw: a `.git` without commits that shows up as a workspace.

## Axis: where the clone lives while it runs and after it

The content is the same in all three directions:

- **Repo list.** It shows the latest pushes, own repos, `northwind` (64 repos), `tailspin` and search. Each section shows 5 repos plus "Näytä kaikki N". The time filter (Kaikki / 30 pv / 3 kk / Vuosi) is a choice the user makes, and it says how many repos it hides.
- **Repo rows.** Each row shows the lock for a private repo, the last push, the size, "suuri" from 500 MiB up, and "työtilana" when the repo is already a workspace.
- **Details before cloning.** Visibility, default branch, last push, GitHub's size estimate, target `~/src/<name>`, and free quota.
- **Large repos.** A warning, plus a choice between the full history and a blobless clone ("Kevyt klooni", `--filter=blob:none`).
- **Progress.** The stage, the percentage and the MiB received.
- **Cancel.** It has an inline confirmation, and nothing is left on disk.
- **Three outcomes:**
  - `maintainer/reitti` succeeds.
  - `northwind/asset-archive` fails with early EOF on the first try. The directory is removed, and a retry succeeds.
  - `northwind/northwind-monorepo` (full history) is cut by a server restart at 910 MiB. "Yhteys katkesi, yhdistetään…" leads to "Kloonaus keskeytyi". The actions are "Aloita alusta" (removes the leftover and starts again, with a choice of full or light) and "Poista keskeneräinen (910 MiB)".

| Direction | What it decides |
|---|---|
| **Dialogissa** | A wide picker dialog with the list and details side by side. On a phone they are shown one at a time. The dialog turns into the progress view and stays modal until the end, as today. Success closes it and opens the workspace. On failure the dialog offers Yritä uudelleen or Valitse toinen repo. After a restart the leftover directory is a workspace in the sidebar with a warning mark. Its page shows the same "keskeytyi" card. This is the smallest host change. |
| **Kloonaussivulla** | Uusi työtila is a page. The Kloonaukset section at its top holds running, failed, cut and finished clones, each finished one with Avaa työtila. You can leave the page. A sidebar block above the workspaces shows `repo 14 %` / `keskeytyi` and links back. Leftovers live on this page and not in the workspace list. |
| **Heti työtilana** | The same picker dialog closes as soon as Kloonaa is pressed. The workspace appears in the sidebar immediately with a percentage. The workspace's own page is the progress, failure and recovery view, and it becomes the normal workspace page when the clone is done. A cut or failed clone is the workspace itself in that state. |

## Host facts the views assume

- **The whole catalog.** The daemon reads all `/user/repos` pages, bounded to something like 10 × 100, or it searches on the server. It also passes `size`, `default_branch` and `owner.type`, and sorts by `pushed_at`. Today's page-1-only suggestion list cannot show organisation repos.
- **Free quota.** "Vapaata 6,1 GiB / 8,0 GiB" needs a quota read for the user, which already exists for storage errors.
- **Light clone.** It is a `--filter=blob:none` option on the clone request. Blobless needs a GitHub connection later for old blobs, using the user's own `gh` credentials, as today.
- **Failure cleanup.** On failure or cancel, the daemon removes the directory that it created itself during this request. Today it leaves it, and a retry is then refused with `checkout_exists`.
- **Restart recovery.** This works without a new store. An interrupted clone is recognised natively: `.git` and `origin` exist, there is no `HEAD` commit, and no `git clone` process is running in that directory. `observe` (`checkout?full_name=`) needs a new state such as `interrupted` with its byte size. "Aloita alusta" and "Poista keskeneräinen" are explicit user actions on that directory.
- **Kloonaussivulla / Heti työtilana only.** The clone must outlive the HTTP stream. The daemon owns the `git` process, and the browser subscribes to and resubscribes to its progress. The daemon keeps the job in memory only: a restart loses the progress, and recovery comes from the filesystem as above.
- **Heti työtilana.** The workspace list must show a directory that is still being cloned, and keep a failed row (whose directory has already been removed) until it is dismissed. Both come from the in-memory job.
- **Kloonaussivulla.** The workspace list must instead hide an interrupted clone directory by the rule above.

## Questions for Jari

1. Which direction? I recommend **Kloonaussivulla**. A large repo clone takes minutes, so it should not hold a modal dialog. The page also keeps leftovers out of the workspace list. **Heti työtilana** is a close second: it is quicker, but the workspace list then contains things that are not workspaces yet.
2. Should the light clone (blobless) be the default for repos over 1 GiB, or always the user's own choice? In the prototype, full history is the default.
3. After a restart, is an explicit "Aloita alusta" right, or should the server restart the clone by itself? I recommend explicit: an automatic restart could repeat a 4 GiB transfer without anyone asking for it.
4. "Viimeksi päivitetyt" shows the four latest pushes that are not workspaces yet. Is that useful, or should it include existing workspaces too?

## Jari's decision (2026-10-17)

1. **Kloonaussivulla.**
2. The light clone is the user's choice; full history stays the default.
3. A cut clone restarts only from an explicit "Aloita alusta".
4. "Viimeksi päivitetyt" shows only repos that are not workspaces yet, as in
   the prototype.

Jari's observations from the prototype, for the implementation:

- **Any public repo must be reachable.** Searching `raine/workmux` (a public
  repo outside the user's own catalog) shows nothing. Typing an exact
  `owner/repo` must look it up on GitHub and offer it, or say plainly that it
  does not exist or is not accessible.
- **The details pane scrolls with the list.** The right-hand details only
  scroll once the left list has been scrolled to its end, and the Kevyt
  klooni content makes the pane taller than the window. The two panes need
  independent scrolling within the viewport.
- **Clipped focus ring.** The search field at the top of the Uusi työtila
  view loses part of its focus ring under the row above it. The same class of
  defect is recorded in `ui-control-audit` (the button system must keep the
  ring visible in ordinary layout flow).

## Library proposals

None. The round overrides the rail painting, the `nws` click and the page head locally.
