# Result: Microsoft connect without folder choice

**Agent text waits for Jari's proofreading** before a pilot release:
[agent-text.md](agent-text.md). The text of an account that already syncs is
unchanged byte for byte. The text changes for a new account, which syncs
nothing, for the "first sync unfinished" line, and in one host-context
sentence.

## What changed

- **Sign-in and renewal** no longer run Graph discovery. Connecting asks
  Graph only for the identity (`/me`), shows no folder step and no size
  count, and starts no sync. A new account gets no rclone roots, no
  `~/cloud/onedrive` and no `~/cloud/sharepoint`.
- **Existing synced accounts.** A renewal writes the account's rclone config
  from the roots that already had a first pass (ready, stopped by an abort,
  interrupted, or selected by the startup repair). Their names, local
  directories and labels stay the same, and the new token and grant go
  in. Their bisync listings are untouched, so a healthy pair is not resynced
  and its sync carries on (`TestMicrosoftReloginKeepsSyncingRootsAndDoesNotResyncHealthyPairs`,
  `TestMicrosoftRenewalKeepsRetainedSync/renewal`). An upgrade without a
  renewal changes nothing on disk.
- **Level change.** A level change turns a synced root two-way→mirror or
  back. Commit still runs the final two-way pass first where needed. The
  attempt then runs the root's first pass in the new direction as its own
  pass, with progress and the removal fence, so the sync does not stop
  silently (`TestMicrosoftRenewalKeepsRetainedSync/level-change`). If that
  pass fails, the attempt fails and the account and its files stay
  (`…/level-change-fails`).
- **Status.** Roots an earlier folder step offered but nobody chose no longer
  read as "Ei synkronoida". Once the tenant's answer says what the grant
  allows, the "OneDrive ja SharePoint" row shows the Outlook server's sign-in
  state, because agents reach files through it. A SharePoint row appears only
  for synced libraries, or when the grant explains why there is none.
- **Browser.** No step counter for Microsoft. The level choice and the
  account card say "Agentit etsivät tiedostoja Microsoftin haulla ja noutavat
  tarvitsemansa kotihakemistoosi. Mitään ei synkronoida…". A level change
  mentions folders only when the account has a synced one, and then says that
  they continue. The cloud-folder hint names Dropbox only. The
  unavailable-sites and Teams-left-out notices are removed, and
  `files_discovery` reads "Hyväksytty. Viimeistellään yhteyttä…".
- **Removed dead code:** Microsoft's `Folders`, `MeasureFolders`,
  `ChooseFolders` and `FolderChoiceAfterLogin`; Teams and channel discovery
  (`teams`, `channels`, the bounds and naming); login-time discovery logging;
  and the relay's teams/sites view fields. Microsoft is no longer a
  `FolderEntry`. `resumableEntry` now needs only `SyncEntry`, and
  `copiesFiles` covers both, so file-copying sign-ins are still serialized.
  Followed-site discovery stays, because the one-time startup repair of
  pre-fix inventories still uses it. Its failure diagnostics now go into
  that repair's `integration_library_recovery` event, since sign-in no
  longer logs them.
- **Contract** unchanged. `unavailable_sites`, `teams_left_out` and
  `teams_not_offered` stay optional in the schema and are simply no longer
  sent; `files_discovery` is still the phase name.
- `docs/operations.md` describes connect and renewal as they now work.
- The browser host's Microsoft stand-in offers no folder step and has no
  directory until it syncs, as in production.

## Decisions for later review

1. **Renewal keeps only roots that had a first pass; it never adds new ones.**
   Alternatives: rediscover and keep every root (the old behaviour without the
   step), or rediscover and keep only matching roots. Rediscovery would cost
   the whole Graph walk at every sign-in for nothing anyone can choose. It
   would also drop a synced root whose site became unfollowed, a silent stop.
   Roots never chosen are left out of the config at the renewal. No local
   file is touched.
2. **A renewal does not retry an unfinished first pass.** The old folder step
   was how a failed first pass was retried. The alternative was to retry every
   started-but-unready root automatically. Rejected: such a pass may have
   failed for quota, and it would rerun a large copy with no admission
   count. A daemon-stop interruption is still resumed at start as before. A
   failed one shows "Ensimmäinen synkronointi jäi kesken" until pinning
   (`m365-pin-folders`) offers a way to choose again.
3. **A direction change reruns only roots that synced, without a fresh size
   count.** Their data is already local (mirror↔two-way of the same library),
   so instead of the folder step's count the pass only needs the home's room
   to be known and not full. The root is marked with the startup repair's
   selection (`habitat_recovery_selected`). If the pass is stopped or fails,
   the root therefore stays the account's and the next daemon start runs the
   pass again. A turned root whose own first pass never finished is left out,
   because its pass could be a whole download; its files stay. Alternative:
   stop the root and wait for pinning, which is the silent stop the issue
   rules out.
4. **The files row of an unsynced account shows the Outlook server's state**,
   and only once the tenant's answer has named the grant. Without discovery
   Habitat cannot tell a mail-only licence (no OneDrive) apart. Such an
   account now shows the row too, and search then finds nothing.
   Alternative: keep asking Graph for `/me/drive` at sign-in only to hide the
   row. Rejected, because it is the discovery this change removes.
5. **`Team.ReadBasic.All` and `Channel.ReadBasic.All` stay in every level's
   consent**, although nothing reads them now. Dropping them changes the Entra
   applications operators have set up and the "not granted" lists; that
   belongs with the Teams-messages and pinning decisions. The comment and
   `docs/operations.md` say they are unused.
6. **Contract fields kept, not deprecated in the schema**, so that older
   open tabs and examples validate. They can go when the schema is next
   revised.

## Review

Independent `/llm-review`: GPT-6 Astra as finder and Claude Fable 5.2 as
verifier, then `/assess-findings`. It confirmed three defects, all fixed
before merge:

- A level-change pass that was stopped or failed left a root that had
  synced unkept, and the next renewal dropped it.
- The level-change pass had no quota admission.
- A read-level account showed a SharePoint row in state unknown.

Nothing was dropped.

## Verification

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations`:
  pass. New and rewritten tests:
  `TestMicrosoftConnectOffersNoFolderStepAndSyncsNothing` (no Graph file
  request, no roots, no `~/cloud`, files row, skill text),
  `TestMicrosoftReloginKeepsSyncingRootsAndDoesNotResyncHealthyPairs`,
  `TestMicrosoftRenewalKeepsRetainedSync` (renewal, level change, failing
  level-change pass), `TestMicrosoftFilesNeverChosenAreReachedOnDemand`,
  `TestMicrosoftCatalogRelaysOneCodeAndCompletesWithoutFolderStep`. Tests of
  earlier releases' synced accounts seed their roots through
  `earlierRoots` and `testChoose` (the old step, test-only).
- `./internal/daemon`: pass; `./test/browser-host` builds and vets (no tests of its own).
- `./scripts/test-focused.sh --area web`: 1660 tests pass.
- Browser: `integrations.spec.ts` (12),
  `agent-resources.spec.ts`, `onboarding-route-map.spec.ts`,
  `site-onboarding.spec.ts` (12), lab `lab-microsoft-login.spec.ts` and
  `lab-integration-inventory.spec.ts` (8), all pass with
  `OH_BROWSER_WORKERS=2 OH_PORT_BASE=14300`. The initial-sync and background
  coverage that the Microsoft spec used to carry moved to the Google level
  test.
- Not verified: a real tenant. A real search and fetch were already
  KOKEILTAVAA in `m365-agent-file-search`.

## Live check

On the test server, connect a Microsoft 365 work account at Täysi. Expect
one code, then "Yhdistetty" with no folder list and no counting. The card
shows "OneDrive ja SharePoint" as reached by Microsoft's search, with no
`~/cloud/onedrive` path. Then ask an agent to find and open a file from
SharePoint. If an account that already syncs a library is available, sign
in again and check that the library still syncs and keeps its path.
