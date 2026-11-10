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
