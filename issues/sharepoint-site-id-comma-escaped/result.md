# Result

The site-library request now preserves literal commas after validating the entire
site ID as DNS hostname + two GUIDs. Malformed IDs stop discovery at `site_id`
before an HTTP request or config publication. No UI or authority changes.

## Evidence and limits

Microsoft documentation retrieved 2026-11-06:

- https://learn.microsoft.com/en-us/graph/api/resources/site?view=graph-rest-1.0
  identifies the site ID components as hostname, site collection GUID and site GUID.
- https://learn.microsoft.com/en-us/graph/api/site-get?view=graph-rest-1.0
  uses `/sites/contoso.sharepoint.com,2C712604-1370-44E7-A1F5-426573FDA80A,2D2244C3-251A-49EA-93A8-39E1C3A060FE`
  in the HTTP and JavaScript examples, with literal commas.
- https://learn.microsoft.com/en-us/graph/api/drive-list?view=graph-rest-1.0
  specifies `GET /sites/{siteId}/drives`.

These establish the documented request shape, **not** that Graph rejects encoded
commas. No live Graph credentials were used and no A/B provider request was made.
The Contoso 404 cause remains a hypothesis until Aino retries after deployment;
the fix removes the encoding difference without claiming provider confirmation.

The synthetic Graph now uses Microsoft's real-shaped example and checks
`EscapedPath`, not decoded `URL.Path`. Restoring the old `PathEscape` expression
made `TestMicrosoftCompositeSiteWirePath` fail because the library was skipped;
restoring the fix passed. This is a regression oracle for the intended wire
shape, not an independent reproduction of Microsoft's handling of `%2C`.
Malformed IDs, encoded separators, extra components, path/query/fragment and
control characters, bad GUIDs and overlong DNS labels/names are rejected before
HTTP. Upper/lowercase GUIDs and a sovereign-cloud hostname are accepted.

Repository search of Graph URL construction found no other site/drive/item ID
interpolation in production Go or runtime adapters. Drive IDs go to rclone's
native config (already allowlisted); rclone owns its own HTTP construction.
The other Microsoft `PathEscape` is an Entra tenant in an admin-consent URL,
not a composite Graph ID, and is unchanged.

`relay_linux.go` already emits each `skippedSites` entry as journal warning
`integration_discovery`, `outcome=skipped`, `reason=site_unavailable` with
`step=site_drives`, HTTP status and allowlisted Graph code/message. Names from
`unavailableSites` go to the existing attempt notice, not the log. Extended the
partial-success test to assert the step and absence of site ID/name as well as
credentials. No logging change was needed.

## Checks and review

On Birch, Go under umask 077 with fresh `/var/tmp/oh-sp-*` scratch:

- `npm ci --prefix web` and Pi fixture `npm ci --ignore-scripts`: passed;
  existing npm vulnerability/peer-dependency warnings were printed.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations`:
  passed, including final run after restoring the mutation-test change.
- `./scripts/test-focused.sh --area web`: passed, 170 files / 1267 tests.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: first
  failed on missing Python `referencing`; created a private uv venv, installed
  `requirements-ci.txt`, reran the entire package: passed.
- `./scripts/test-focused.sh --area contracts`: passed (89 schemas, 136 fixtures).
- No browser spec or UI changed; no browser suite or full gate run.
- Focused self-review per this task's URL/validation-only exception: checked the
  literal-comma wire path, validation-before-interpolation, hostname bounds,
  GUID casing, config non-publication, partial success and safe diagnostics.
  No independent model review was needed; production changes stay within URL
  construction and validation.

Tested production files are those in this issue's fixing commit. Live Contoso
acceptance and deployment are not performed by this worker.

## Decisions for later review

- Use the documented literal-comma form now instead of waiting for a credentialed
  A/B investigation: it eliminates an unnecessary difference safely. Do not
  label `%2C` as a proven cause until the real connection is retried.
- Accept DNS-shaped hostnames rather than hardcode `sharepoint.com`: national
  clouds use other suffixes; the hostname remains data inside the fixed Graph
  path, never the outbound destination. Reject malformed provider IDs instead
  of silently treating them as inaccessible sites, to expose discovery defects.
