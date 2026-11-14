# Result — 2026-11-10

## Cause

- **Not all data:** none came. The first pass was refused after counting,
  `quota_insufficient` at 08:44:40Z, 16 minutes after the choice. The
  person's quota is the installation's 20 GiB default
  (`storage.default_limit_bytes`) with ~0.2 GiB used, so the chosen roots
  counted over ~19.8 GiB. Microsoft's folder step shows no sizes, so the
  person could not see this when choosing, and the daemon admitted the
  choice without a quota check (unknown sizes). The refusal is correct; its
  timing and silence about the amount are product weaknesses.
- **Skipped site:** site-specific, not a request-form defect. The same
  discovery opened two other followed sites through the identical Graph call.
  The skipped one is a Teams channel site; a 404 points to a site outside the
  signed-in tenant (partner-hosted shared channel) or a deleted one. Not
  confirmed against Graph, which would need the person's token.

## Fix (diagnostics; behaviour unchanged)

- `relay_linux.go`: a counted pass that does not fit fails with
  `quotaShortfall` (still `errors.Is(errQuota)`, same contract code), and the
  `integration_login` failure event carries `needed_bytes` and `free_bytes`.
- `microsoft_files_linux.go` / `microsoft_diagnostics_linux.go`: a skipped
  followed site's `integration_discovery` event carries `site_host`
  (`same_as_reachable_site`, `other_than_reachable_sites`,
  `no_reachable_site`), comparing the host of the site's composite id with
  the sites that opened. No host, id or name is logged.

## Verification

- `TestRefusedStartAndQuotaShortfallAreLogged`: synthetic 5 GB count against
  4 GB free → event with both totals. Fails on the unfixed relay.
- `TestMicrosoftUnavailableFollowedSiteIsPartialSuccess`: new 404 case for a
  partner-host (`fabrikam`) site next to a reachable `contoso` site →
  `other_than_reachable_sites`; same-host 403/404 → `same_as_reachable_site`;
  the log still contains no host, id, name or token.
- `go test ./internal/daemon/integrations`: passed.

## For the administrator

See *What Jari tells the customer's administrator* in `item.md`. After the next release
a repeated attempt logs `site_host`, which settles whether the channel site is
the partner's, and `needed_bytes`, which tells how much space the choice
needs.

## Decisions for later review

- **Diagnostics only, no behaviour change.** Alternatives: offer a Graph
  `quota.used` estimate in the folder step, or measure sizes while the person
  chooses (as Google does). `quota.used` includes version history and recycle
  bin, so it overstates the copy and could refuse choices that fit; measuring
  during the choice would not have helped here (the count took 16 minutes, the
  choice 19 s). Both change the folder step's design and stay open.
- **`site_host` compares against reachable followed sites, not the tenant's
  root host.** Habitat does not otherwise learn the root host, and asking
  Graph for it adds a request to every discovery. With no reachable site the
  value is `no_reachable_site` rather than a guess.

# Prototype round 1 — 2026-11-14 (folder step with sizes)

Round: `design-system/prototypes/rounds/2026-11-14-microsoft-folder-sizes/`
(build and check commands, and *What the host would need*, are in its
`NOTES.md`). One view: production's Microsoft `ConnectDialog` in Settings ›
Tiedot agenteille, folder step and quota refusal, Finnish and English.
Synthetic pilot-shaped data: 19.8 GB free of 20 GB, OneDrive + two libraries
counted 21.4 GB.

Same in all directions: right after sign-in the host asks Graph for each
library's size (one batched request, under a second), shows it as an
estimate, still counts exactly after the choice, and the refusal shows needed
vs free.

Axis: how the size reaches the person before the choice.

- **A Rows:** production's folder step unchanged, with the host filling in
  `bytes`/`estimated`. Only a host change. Its weakness shows in the
  "upper bound" situation: Microsoft's `quota.used` reads as "noin",
  and production does not block on an estimate.
- **B Folders open:** each library opens into its top-level folders with
  sizes (one `root/children` request per library). A choice that does not
  fit opens the largest library. After a refusal, *Choose again* returns to
  the choice with the counted sizes, in the same attempt.
- **C Space meter:** free space as a meter on top that the choice fills,
  with the upper bound hatched and "no longer fits" marks on rows. The
  refusal shows the counted size running past the limit.

**Recommendation: B, with C's hatched upper bound.** In the pilot the
libraries did not fit together and none could be taken in part. A only says
which library to leave out whole.

Situations (selector): sizes loading; known and fits; over before the count;
upper bound only; refused after the count; two unopened sites (partner
channel, removed site).

Live check: nothing on the test server yet (prototype only). Open
`offline.html` from the worker results, pick B, situation "Valinta ei mahdu",
untick OneDrive › Kuvat and see the meter fit.

## Decisions for later review (round 1)

- **An estimate close to the count blocks Start (B, C); an upper bound never
  does.** Alternatives: never block on an estimate (production today, A), or
  block on any estimate. Why: a root-size sum over free space means a long
  count that will almost surely be refused, which is exactly the pilot's 16
  minutes; Microsoft's `quota.used` overstates (version history, recycle
  bin, whole site), so blocking on it would refuse choices that fit.
- **Upper bound worded "enintään"/"at most", not "noin".** It is an upper
  bound, and calling it "about" makes a fitting choice look over.
- **Counts from the same attempt are reused after a refusal (proposed limit
  30 min), with a fresh quota observation.** Alternative: always count again
  (the UI text "not counted again" then changes). Risk: a library that grew
  meanwhile could fill the home quota during the pass.
- **Unopened sites get a reason** (`other_host` / `not_found` / `denied`, from
  the existing `site_host` classification and HTTP status) and are shown as
  disabled rows (B, C) or a notice in place of production's "ask your admin
  for access" (A). For a partner's shared channel, asking for access is the
  wrong advice.
- **Not verified:** whether a SharePoint library root's `size` includes
  version history. If it does, it is an upper bound too and is reported as
  `at_most`.
