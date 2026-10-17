# Result: workspace deletion and the Trash in the browser

## Yhteenveto Jarille

Työtilan voi nyt poistaa selaimesta. Roskakori-ikoni avaa dialogin, joka tarkistaa ensin ja näyttää yhden kolmesta tapauksesta: estetty (esim. pääte on hakemistossa, prosessi nimetään), roskakoriin (mitä on vain täällä) tai puhdas, kokonaan pushattu klooni, joka poistetaan pysyvästi ilman "siirrä silti roskakoriin" -vaihtoehtoa. Pysyvä poisto hakee etärepon ensin; jos haku epäonnistuu tai haku muuttaa jotain, työtila jää roskakoriin. Siirron jälkeen alhaalla on ilmoitus, jossa on **Palauta** ja linkki **Asetukset › Tallennustila**. Siellä käyttöpalkissa näkyy roskakorin osuus ja sen alla roskakori: palautus, pysyvä poisto nimen kirjoittamalla ja **Tyhjennä roskakori** vahvistuksen kanssa. Tyhjennys poistaa vain sen listan, jonka näit; jos roskakori muuttui välissä, mitään ei poisteta. Kaikki on varmennettu synteettisessä labissa, ei testipalvelimella. Kokeiltavat kohdat ovat KOKEILTAVAA.md:ssä.

## What was built

- **Daemon** (`internal/daemon/workspace_delete*_linux.go`, `workspace_trash_linux.go`):
  - Outright deletion fetches before its recheck: after the move, every configured remote is fetched by name on the moved inode (`fetch --multiple --prune --no-tags --no-recurse-submodules --no-auto-maintenance`, hooks off, 30 s). A failed fetch or no configured remote keeps the entry (`kept_reason: fetch_failed`); a fetch that moved any ref outside `refs/remotes/` keeps it (`changed_after_check`).
  - `trash_list` returns per-entry `size_bytes`/`size_complete` under one shared 1.5 s / 400 000-entry bound, and a `listing_token` (SHA-256 over entry names, workspace names, deletion times, dev and inode).
  - `trash_empty {listing_token}` re-lists, refuses a changed Trash whole with `trash_changed`, and otherwise purges exactly that set with the same process/mount checks and walk as `trash_delete`, reporting kept entries (`blocked`/`partial`/`missing`). `removeTrashEntry` now refuses an entry whose inode is not the one resolved.
- **Contract** `contracts/v1/workspace-deletion.schema.json`: the `trash_empty` request, `emptyResult`, `listing_token`, entry sizes, `kept_reason: fetch_failed`; new example `workspace-trash-emptied.json` and two negative checks; generated packages regenerated.
- **Browser**: `components/WorkspaceTrash.tsx` (delete dialog, blocker list with copyable commands and "Avaa keskustelu", usage bar with the Trash share, Trash rows, purge and empty dialogs), `app/WorkspaceDeletion.tsx` (check → confirm → delete), `app/TrashNotice.tsx` (post-move notice with Palauta and the Tallennustila link, sticky when something was kept), `app/PersonalStorage.tsx` (Tallennustila with the Trash), `app/trashText.ts` (Finnish text for every refusal code and blocker kind). The workspace page's trash button is enabled. `/settings#tallennustila` opens the section.
- **Lab** (test-only `test/browser-host`): `/fixture/pushed-clone` (clean clone of a bare remote in the disposable home, so the real fetch runs offline), `/fixture/busy-process` (a real `sleep` with its cwd in a workspace), and `/fixture/taskfleet?status=empty` (an answering Taskfleet with no runs).
- **Docs**: ADR 0019 amended with Jari's 2026-10-17 decisions; `docs/architecture/workspaces.md`, `http-api.md`, `design-system/components.md`, KOKEILTAVAA.md.

## Evidence

- `go test ./internal/daemon -run 'Trash|WorkspaceDelet|WorkspaceFence'` passes, including `TestWorkspaceDeleteFetchesBeforeOutrightDeletion` (rewritten remote, deleted remote branch, local-branch refspec, unreachable remote, fresh remote deleted after a real fetch) and `TestTrashListSizesAndEmptiesOnlyTheListedSet` (sizes, stale token refused, same-named replacement refused, blocked entry kept). Mutation checks: fetch without `--prune`, no fetch, token without inode, and no before/after ref comparison each fail a test.
- All 89 200-replies produced by those tests validate against the schema (Python `jsonschema`, nine states including `emptied` and `fetch_failed`).
- Full `go test ./internal/daemon`: only the six known pre-existing Pi credential/device/model/startup failures. `go vet` of the daemon and browser host; `scripts/test-focused.sh --area contracts` clean.
- Web: `test-web-fast.sh` passes; new `trashText.test.ts` (every refusal code and every contract blocker kind/check has its own text, read from the schema), `WorkspaceTrash.test.tsx` (no Trash alternative for the clean case, blocked offers only recheck, refused confirm turns into recheck, taken name disables restore, typed name gates purge), `workspaceTrash.test.ts` (empty by token).
- Lab (host-backed synthetic evidence): `lab-workspace-trash.spec.ts` now drives the UI: move with undo from the notice, the notice's link to Tallennustila, restore from the list, a real `/proc` blocker, recheck, outright deletion of a pushed clone after a real fetch, typed-name purge, empty Trash, axe on the blocked dialog and the Trash section, and the gateway's CSRF refusal. `lab-workspace-page.spec.ts` expects the enabled button. Default suite: account-settings, settings-name-and-storage, settings-model-picker, shell-accessibility, workspace-slice-security, workspace-archive pass except the known "native key add" failure.
- Paired lab screenshots and HTML (desktop/phone × light/dark): `lab-*-blocked`, `lab-*-to-trash`, `lab-*-permanent`, `lab-*-moved-notice`, `lab-*-storage-trash`, captured by `capture.mjs`.

Not verified: the test server (not changed, and nothing there to read for this new feature), real GitHub remotes over HTTPS or SSH, distinct-UID isolation (authority unchanged: the daemon touches only its own home).

## Review

Independent `/llm-review` at critical rigor (destructive operations, daemon state, contract): finder Claude Fable 5.1, verifier GPT-6 Astra, two calls. Four candidates, all confirmed locally and by the verifier, all fixed in b2e4608f:

1. A configured refspec writing a local branch let the fetch overwrite it, so a commit lost its last ref and looked pushed; outright deletion would have removed the only copy. Reproduced with git 2.53.0; now any ref change outside `refs/remotes/` keeps the entry, with a regression test.
2. After a `trash_changed` refusal, the empty dialog stayed open over a reloaded list and a second click would empty unseen entries. It now closes on any refusal.
3. Entry names are reused after a restore, and the purge dialog cached Git facts by name. Facts now belong to one listing, and the dialog always inspects afresh.
4. Fetch's automatic maintenance could leave a detached gc inside the entry during the walk. Disabled.

A parallel stress run of the lab journey (8 repeats, 4 workers) then found a false block: a `sleep` of another lab host caught mid-exit was reported as "process could not be inspected", since an exiting process denies its descriptors until it is a zombie. Any of the person's processes ending during a check could do the same in production. The scan now looks once more after 100 ms when it finds an unreadable process, and blocks only if it is still unreadable (new case in `TestWorkspaceDeleteBlockers`; 32 of 32 parallel repeats then passed). The journey's axe checks exclude react-aria's live-announcer region, which briefly keeps a `role=img` node pointing at the heading of a dialog that has just closed.

The model-performance entry could not be logged: SSH from alder to itself refused the key (open issue `assess-models-alder-self-ssh`).

## Decisions for later review

- The fetch runs on the moved inode, after the move, rather than in the read-only check. The dialog shows what the last fetch recorded and says a fetch follows; a slow or failing remote never delays the dialog, and a failure leaves the workspace safely in the Trash.
- A repository whose remote needs an SSH agent always gets `fetch_failed` (the daemon's command environment has no `SSH_AUTH_SOCK`, as for clone and publish), so it stays in the Trash and is purged from there.
- `trash_delete` still identifies an entry by entry name plus the typed name. After a restore and re-trash, the same name names the re-trashed directory; the dialog now reads it afresh, but the request carries no identity beyond the name. Binding it to the entry's deletion time would close the remaining window; not done, since it needs another contract field and the window requires a restore and re-trash while the dialog is open.
- Emptying the Trash uses no typed confirmation, only a dialog with the count and size; the listing token makes it act on exactly what the person was shown.
- Rows show Git labels from `trash_inspect`, read one entry at a time for the first 50 entries; beyond that a row shows only name, time and size.
- The usage bar has two shares (Trash and everything else). The prototype split workspaces from Pi history and caches; the host does not measure that split.
- The no-remote-refs line reads "Ei haettua etärepoa" rather than "Ei etärepoa", because the host cannot tell a missing remote from one never fetched.
- The lab's fake Taskfleet still fails `run list` by default, which blocks every Git workspace as "unknown"; the journey sets it to answer with no runs.

Jari accepted these decisions on 2026-10-17.
