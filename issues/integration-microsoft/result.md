# Microsoft integration delivered

OneDrive and followed SharePoint libraries use **rclone 1.71.2**; Outlook mail,
calendar and contacts use **@softeria/ms-365-mcp-server 0.170.1**, registered
through the installation's **Pi 1.3.0** native MCP CLI. abraunegg/onedrive is
**not used** and need not be installed (feasibility version: 2.5.11).

Two sequential device codes obtain independent native grants. The browser
explains both codes and updates the code within the same attempt. Graph verifies
identity; native rclone configuration/listings, account-pinned MSAL encrypted
caches and Pi's mcp.json remain the only account stores. The generated
personal-data skill names the account-pinned MCP server and selected directories.

Re-login offers existing/new library selections without reinitializing healthy
pairs. Provider renames preserve local roots. Deselection stops a pair without
deleting files. Every selected pair gets a pass before a failing pair triggers
backoff. Outlook status runs independently of bounded file probes. A genuine
no-drive 404 with no followed libraries can complete as an Outlook-only account.
Cancellation, expiry and folder failures restore retained sync; daemon shutdown
cannot resurrect a late child. Pending/previous native caches retain their
account association, remain discoverable, and are reached by explicit removal.

## Final acceptance evidence

Commands used `umask 077` and `TMPDIR=/var/tmp`, through the shared Linux ARM64
runner. All four reached terminal **success**, worker exit 0, on source HEAD
`4b0e0c2f4e3abf5e952ab89e8dc57013bf1710f0`, committed tree
`12428dbe04ce69ea127582899ddbff79a074b2dd`:

| Check | Job | Retained evidence |
|---|---|---|
| `python3 scripts/browser-focused.py --task oh-go --task-arg=./internal/daemon --task-arg=./internal/daemon/integrations --task-arg=./test/browser-host` | `eddf77fa935c87d82131b5fb7e60f25a9fb89264eb8260738a2eaf062f4660a3` | `/var/tmp/oh-browser-p2hd3l16` |
| `./scripts/test-focused.sh --area contracts` | `bcbe24499f8a1632cdd5a11afc9a346f74c42875e798935179c5ae31e3c56f40` | `/var/tmp/oh-browser-spv3duxs` |
| `./scripts/test-focused.sh --area web` | `69480168f39ada2f61b06f1a525447554e2269ca0de4e0c18432babe8ab8c119` | `/var/tmp/oh-browser-4cf5aqbl` |
| `./scripts/test-focused.sh --area browser --spec integrations.spec.ts` | `3445305e9f045333f6b5a6e77884b2b8e591ee98fb20dde1fd529d6f55b2fda0` | `/var/tmp/oh-browser-a5d5uxdg` |

Go vet and race tests passed for all three packages (daemon 51.001 s,
integrations 11.037 s, browser host 3.259 s). The runner prepared the pinned Pi
fixture package. Contracts passed 56 schemas, 56 fixtures, 37 scenarios and 17
negative checks. Web static checks and 196 tests across 32 files passed. All five
integration browser journeys passed, including same-attempt replacement of the
device code, tenant refusals, and desktop/phone axe checks.

The Go capture was clean. Later captures were honestly marked dirty because
this result was being documented; the only tracked change from the tested HEAD
was `issues/integration-microsoft/result.md`. No runtime, fixture, dependency or
build input changed after the final Go capture. The adjacent review was untracked
working evidence and not a selected runner input. These are focused synthetic
checks, not a clean-gate receipt, live-provider proof, or distinct-UID installation
proof. The full clean gate was not run under worker policy. Later independent
main changes are not represented as having been tested by these worker jobs.

## Independent review and assessment

Critical `/llm-review`: finder `claude-fable-5-1`, verifier `gpt-6-astra`, two
calls. Risk: credentials, native-store cancellation and bidirectional file writes.
No authority moved between gateway, daemon and broker. `/assess-findings` produced
local `history/assessment-integration-microsoft.{json,md}`; durable rationale is
in adjacent `review.md`. Six FIX and two FIX_WITH_CARE findings were implemented.
No issues were filed. No model-performance write was attempted: this worker may
not edit/push Fleetrepo.

The finder exposed new-library selection, status starvation, no-drive 404,
provider rename, pair starvation and outage classification defects. Its premise
about unopened licensed drives was refuted against Microsoft's drive-get docs
(delegated GET provisions those); the narrower no-entitlement 404 was retained.
The verifier refuted all six repaired mechanisms at 7f16c602 and identified two
repair residuals: cancelled renewals left sync stopped, and uncertain rollback
could hide an authorized native backup. Commit 4b0e0c2f repairs both, with final
passing regressions for cancel/expiry/folder failure/shutdown, failed registration
plus failed cleanup and blocked restoration, discovery/removal of every native
store, previous-key preservation and fencing an in-flight unknown-identity login.
The small Finnish UI explanation and browser assertion were self-reviewed.

## Exact operator handoff

1. Through Fleetrepo, install root-owned, non-user-writable rclone **1.71.2** and
   Softeria **0.170.1** with a pinned Node runtime/executable wrapper (not runtime
   npx downloads). Expose the existing pinned **Pi 1.3.0** wrapper for native MCP
   configuration. Every wrapper must work with the person's HOME and the daemon's
   minimal PATH. Do not install abraunegg/onedrive for this implementation.
2. Merge these keys into `/opt/open-habitat/integrations.json`, preserving all
   existing provider/tool settings: `tools.rclone`, `tools.ms-365-mcp-server`,
   `tools.pi` (absolute pinned executable paths), `microsoft.client_id` (the public
   Entra app client ID already held in Fleetrepo SOPS), and
   `microsoft.tenant_id: "common"`. The operator's home tenant UUID is **not** the
   audience for this multi-tenant/personal app. The worker did not read SOPS.
3. Deploy a Microsoft-capable binary before publishing the new section to older
   strict readers, then restart affected user daemons deliberately. The separate
   unknown-key degradation issue is unchanged. Apply existing config ownership
   and readability checks. `docs/operations.md` has the full JSON example.
4. Keep public-client/device-code enabled with the registered redirect
   `https://login.microsoftonline.com/common/oauth2/nativeclient` and the delegated
   permissions in the task. Home-tenant consent in tailspin.test is not approval
   in other work tenants. The browser's consent-required state carries a plain
   organisations/v2.0/adminconsent link with the app ID, scopes and nativeclient
   redirect; send it to the connecting tenant's administrator. Conditional Access
   blocking device code needs that tenant's policy decision, not a bypass.
5. After deployment, verify with the consenting person: both codes, folder/quota
   choice, OneDrive and followed SharePoint upload/download, Outlook drafts,
   calendar/contacts reads, second account, renewal cancellation, daemon restart
   and removal. Check personal refresh after an hour and a non-home work tenant's
   consent flow. Guest/alias username equivalence is also unverified live.

OneDrive: `~/cloud/onedrive/<account>/`. SharePoint:
`~/cloud/sharepoint/<organisation>--<account>/<site>/<library>/`, with provider-ID
hashes disambiguating names and accounts separated to prevent competing pairs.
Only followed sites are discovered, not every tenant site or individual
subfolders. Initial cloud-preferred union conflicts are backed up under
`~/.local/share/rclone/microsoft-backups/<account>/<remote>/`. Removal leaves data
unless Trash is selected and does not revoke Entra's provider-side grant.

## Limits and failure inventory

No push, deployment, test-server access, Fleetrepo edit or real credential use
occurred. Live verification is intentionally deferred to the conductor under the
worker's authorization, not claimed as passed. The combined live acceptance
checkbox remains unchecked; issue closure is the explicitly requested
implementation landing, not a claim that the live criterion was completed.
Screenshots were deferred under Alder's remote-only specialist/capture policy.

No required final check failed or remains incomplete. Earlier passing runs were
superseded by the four fresh jobs above. Two obsolete intermediate jobs were
intentionally cancelled after the final replacement was scheduled:
`eabe1938ab5ddf7166d8aa14bcc4bbb2b28c3c1140e4d403b4fd6b5591f3e4ea`
(intermediate Go sequence) and
`bfcd62fe3cc25e840082e24ca1251656a36436f6bd120647c80bd6010803e930`
(intermediate web). Both retained logs confirm terminal cancelled; no acceptance
was inferred from them.

Convenience probes for guessed source filenames/skill paths and two upstream
source layouts failed; corrected scoped Linux-suffix paths and the pinned npm
archive supplied the evidence. A formatter path typo recovered through its
explicit fallback. A convenience summary parser hit a truncated displayed JSON
log line; retained structured `*-logs.json` supplied the full summaries instead,
without rerunning tests or inferring success from a partial log. These optional
failures affected discovery/report formatting only, not the deliverable or final
checks. Issue-skill refresh succeeded in this disposable worktree.

Final evidence-only checks: `git diff --check`,
`python3 scripts/validate-project-view.py` and `issuectl doctor --json` passed;
doctor retains pre-existing non-AVIF/large-image advisories, unrelated to this
change.
