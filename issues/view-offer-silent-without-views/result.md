# Result

On a site without `views.origin_template`, `open-habitat agent view offer`
now fails with `views_unavailable` (daemon 409, CLI exit 1) and publishes
nothing. The CLI message tells the agent that nothing was published, that the
page cannot be shown here and to hand it over with `agent file offer`.
`agent environment show --json` carries `site.views` (`true`/`false`) next to
`site.origin`. The agent skill, the Pi host context and `docs/operations.md`
say so.

## How availability reaches the daemon

The daemon cannot see the gateway's `view_origin`. Host apply and upgrade
already publish the root-owned, world-readable `/opt/open-habitat/site-origin.json`
in `finishGeneration`; it now reads `{"origin": …, "views": <site declares
views>}` (`siteFactsFile`). No authority moves: the gateway is not asked, and
the file stays display data. The only effect inside the daemon is that it
refuses something it used to do. Every installation gets the new field at its
next apply or upgrade; no Fleetrepo change is needed for the file. Enabling views
on Northwind is still the operator task from `research-ville-feedback`.

Tests: `TestViewOfferRefusedWithoutViewOrigin` (no views and unreadable site
file refuse new offers, replays and dry runs, leave no export or card; with
views the offer works), `TestSiteParse` (both published shapes, `views`
required), `TestSiteFactsFileNamesViews` (host output for both
configurations), `TestViewOfferViewsUnavailableIsRelayable` (CLI code and
message).

## Decisions for later review

- **The facts go in the existing `site-origin.json`** rather than a new file or
  the per-user daemon configuration. Same publisher, same trust check, same
  reader; a second file would be a second place for site facts. The name now
  understates the contents; renaming it touches the host continuation list and
  docs for no behaviour, so it was left.
- **`views` is required in the file.** A file from an older apply (no field)
  makes the whole site `unavailable` until the next apply or upgrade, rather
  than guessing "no views" or "views". Pre-release, so no compatibility path.
- **An unreadable site file refuses the offer too**, with the same code. The
  daemon cannot know whether a card would appear, and a silent card is the
  failure being fixed. The alternative, letting the offer proceed when unknown,
  keeps the original bug on a broken installation.
- **Replays and dry runs are refused as well.** A dry run should predict the
  real outcome, and replaying a key on a site that has since lost views would
  again report a card nobody can see.
- **409** rather than 503: it is a stable state of the site, not a transient
  failure, and the CLI exits 1 (refusal), not as a system error.
- List and remove keep working without views, so the agent can still clean up
  older exports.

## Review

`/llm-review` with gpt-6-astra as finder (one call): no findings. The surface
does not touch identity, authorization or secrets, so no verifier was called.
`/assess-findings`: nothing to classify.
