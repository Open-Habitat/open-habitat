# Result

## Why archiving was slow (live cause)

On pilot.179/180 the workspace's "archive" is the icon row's eye button ("Piilota sivupalkista"). It has no confirm dialog. The popup Jari saw is the undo notice, and its **Kumoa** takes the same path as the button. Both waited for the same chain before the screen changed:

1. **The snapshot was slow on the server.** Live measurement on the test server (`fast-snapshot`, release `7601f1f1`, curl on the mapped daemon socket): **0.96–1.26 s warm, 2.4 s when two overlap**. About 1.3 s of that went to `gh` (`auth status`, `api user`, credential helper) on every snapshot.
2. **The browser waited for four round trips before it re-rendered**: write → `/auth/session` → snapshot → `/auth/session`. The live route costs ~0.2 s per round trip (`ui-responsiveness-review/live-rtt.sh`).

Together that is the 2–3 s per click Jari felt. There is no request record of his actual 18:40 click: request records (ADR 0022) only started with `009331ac`, 2026-10-16 20:41 UTC. Read-only evidence from those records since then (gateway + daemon journal, IDs redacted):

- No `POST /api/v1/workspaces` has been recorded since then, so the write itself is still unmeasured live.
- Since `fast-snapshot`, snapshots are recorded only when they take ≥250 ms. Exactly two were recorded, both the first snapshot after a daemon start: 1168 ms and 1039 ms, with `phases_ms.github` 1165 / 1030 ms. That is the one-time cost the fast-snapshot result predicted. The conductor's live measurement after that release was 5–18 ms warm.
- Unrelated but visible in the same records: `GET /api/v1/pi/models` takes **2.6–4.4 s** once a minute. That is the shared model catalog refresh, not archiving. It is proposed as a follow-up.

The two server-side causes were fixed before this issue (`fast-snapshot`, `refresh-without-session-reads`). This issue removes the remaining wait from the click: **the workspace leaves the list and the notice appears at once**, as a presentation overlay. The host's visibility write and the following snapshot confirm it. If the write is refused, the workspace comes back and an alert says so.

Lab (`measure-archive.mjs`, production bundle, Chromium latency emulation, three runs, ms after pointerdown, [lab-after.jsonl](lab-after.jsonl)):

| Action → milestone | 0 ms | 100 ms | 200 ms |
|---|---|---|---|
| Archive → gone from the list, notice shown (before `refresh-without-session-reads`) | 73 | 482 | 877 |
| same, after `refresh-without-session-reads` | 72 | 249 | 464 |
| same, this change | 21–30 | 15–17 | 16–25 |
| Undo → back in the list, this change | 14–24 | 15–20 | 13–20 |

The first two rows are from `refresh-without-session-reads/lab-after.jsonl` and the analysis. With the overlay the time no longer grows with latency.

## What changed

- `App.tsx` keeps a `pendingVisibility` overlay (workspace ID → hidden/visible). It is applied to the snapshot's workspaces before the rail, home and workspace page read them, and cleared when a snapshot agrees with it, unless the write for that workspace is still in flight. A failed write removes the entry and sets an alert scoped to that workspace. A person change clears it. Like the card archive's `pendingArchive`, this is a disposable presentation mask, not a second store: the host's `visibility` file stays the truth.
- The rail ends with a collapsed **Arkistoidut N** group (`ArchivedWorkspaces` in `Navigation.tsx`). Each archived workspace has a link to its page and **Palauta**. The group opens by itself when the current page is an archived workspace, like the finished-conversations toggle. It is shown even when every workspace is archived.
- The button is now **Arkistoi työtila** / **Palauta työtila**. Its tooltip says it moves the workspace into the Arkistoidut group and keeps files and conversations. The notice reads "Arkistoitu **name** · Tiedostot ja keskustelut säilyvät. Löydät sen sivupalkin lopusta, Arkistoidut-ryhmästä." On the workspace page the line reads "Arkistoitu · tiedostot ja keskustelut säilyvät · Palauta".

Screenshots (synthetic lab, `capture.mjs`): `lab-{desktop,phone}-{light,dark}-archived-notice` (workspace page right after archiving) and `-archived-group` (home with the group open), each `.png` + `.html`.

## Tests

- New `web/tests/workspace-archive.spec.ts` (host-backed, 2 cases). With the write held: the workspace leaves the list, is in the Arkistoidut group and the notice says files are kept, all before the host answers. Then the host keeps it archived across navigation, the group is collapsed elsewhere, and **Palauta** restores it, which survives a reload. In the second case, a refused write (409) puts it back and shows the alert. Without the overlay the first case fails, because nothing changes until the held write answers.
- Review fix (`/llm-review`): completed writes are numbered, and a snapshot read that *starts* after a write completed retires its overlay even when the host disagrees, for example when another tab restored the workspace in between. Case "the host's later answer wins over the overlay" fails without it.
- `lab-workspace-page.spec.ts` and `refresh-identity.spec.ts` were updated for the new labels and the archived group. The cross-identity case now asserts that the write itself succeeds, since the optimistic list change alone no longer proves it.

## Decisions for later review

- **No confirm dialog.** The issue asked that "the confirm text" say files are kept. Archiving is reversible and changes no files, so it stays one click with an undo notice. The text that says files are kept is in the notice, the button tooltip and the page line. A confirm would bring back the extra step that felt slow.
- **"Arkistoi", not "Piilota sivupalkista".** The workspace also leaves the home page, so "hide from sidebar" was inaccurate, and Jari calls it archiving. Conversations already use Arkistoi/Arkisto for their own (different) archive. The two share a word but not a mechanism.
- **Sidebar only.** The archived group is at the end of the rail, which is also the phone's navigation drawer. The home page does not repeat it.
- The archived group ignores the rail's filter. It lists all archived workspaces.
