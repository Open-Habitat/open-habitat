# Result

Fixed synthetically; **live acceptance is pending Jari's next Microsoft sign-in**.

The observed business-tenant failure was a followed site's `/drives` response returning 404. Discovery previously treated that as failure of the whole account. Per-site 403/404 now skips only that site, keeps OneDrive and reachable libraries, emits the existing secret-safe HTTP/Graph diagnostic, and names the unavailable followed site in the dialog. Authentication failures, throttling and server errors still fail rather than silently hide missing data. Personal-account discovery is unchanged.

## Evidence

Implementation: `5b6c9f65` (rebased onto `545b0bb8`; generated fingerprints regenerated from both changes). Focused integrations Go tests, race tests, web checks, contracts and the three affected browser specs passed on the final runnable source; details and failure inventory are in `issues/file-sync-folder-choice-fast/result.md`.

`TestMicrosoftUnavailableFollowedSiteIsPartialSuccess` reproduces a missing/inaccessible followed site alongside a reachable site: 403/404 preserve both reachable roots and the notice; 401/429/500 remain fatal. It also checks the skip diagnostic for credential/address/site-ID leakage. Existing personal-account and discovery-failure regressions pass.

`review/choice-{1280,390}-{light,dark}.{png,html}` shows the production dialog, partial-discovery notice and usable choices in a synthetic lab. Compared against the accepted integrations prototype's dialog, account mark, steps, mono destination, warning and controls. Native site names render only as text; no real account content or provider credentials were used.

## Decisions for later review

The notice concerns followed sites, the person's existing native SharePoint selection; no tenant-wide crawl or new selection registry. Notices remain transient with the login attempt, not persisted in a host store. A missing site is not presented as an empty, successfully connected library.
