# Result — 2026-11-10

## Cause

- **Not three of three.** Habitat metadata on the Contoso server (section
  descriptions of the rclone configs only) shows Anna's discovery opened
  libraries from **two** distinct followed sites and skipped one; Aino's opened
  none and skipped two. The same `/sites/{composite-id}/drives` request works
  for some sites in the tenant, so the request form is not broken. The cause
  is per site.
- **Graph's followed-sites list is documented as unreliable.** The
  `/me/followedSites` reference carries a known-issue note ("might return
  incorrect results"), and Graph's known issues say followed sites "aren't in
  sync with SharePoint following". Community reports describe Graph site ids
  that do not address the site in later requests (`/sites/delta` returning
  bare web ids; search returning malformed ids). A composite id from the
  followed list can be stale: the site was moved or renamed, restored under
  new ids, or the follow record predates a change. The webUrl in the same
  record is SharePoint's address for the site and is the documented
  alternative lookup (`GET /sites/{hostname}:/{server-relative-path}`).
- Not confirmed against Graph: that needs the person's token. The deployed
  version (pilot.25) logged neither `site_host` nor the new `site_lookup`.

## Fix

`internal/daemon/integrations/microsoft_files_linux.go`:

- `siteDrives`: lists `/sites/{id}/drives` with the followed composite id. On
  **404 only** it resolves the site with
  `GET /sites/{hostname}:/{path}?$select=id` built from the webUrl
  (`microsoftSiteByURL`), validates the returned id and lists that id's
  libraries. 403 still means "no access" and leaves the site out without a
  fallback. Any other failure at either step still fails discovery. The
  left-out notice stays for sites that still fail.
- `microsoftSiteByURL` accepts only a plain https site address: DNS hostname,
  no userinfo or port, and no dot segment, colon, backslash or encoded slash
  in the path. Each segment is rebuilt escaped, so the bearer reaches only
  `graph.microsoft.com` and only a site lookup.
- Journal: a skipped site's `integration_discovery` event carries
  `site_lookup` = `composite_id` (no usable webUrl, or 403), `web_url` (the
  lookup or the resolved site's libraries failed; `step` says which:
  `site_by_url` or `site_drives`) or `web_url_same_id` (the webUrl resolves
  to the same id, so the site exists but its libraries 404). A site opened by
  the fallback logs `integration_discovery outcome=observed
  reason=site_lookup_fallback site_lookup=web_url`. No name, id or host is
  logged.

Tests (synthetic fixture, `microsoft_site_lookup_linux_test.go`): a composite
id that 404s but resolves via webUrl, offered under the resolved id; a mixed
list with that site, a genuinely missing site (lookup 404), a 403 (no fallback
request), a same-id site, an unusable webUrl and a refused lookup; 401/429/500
in the fallback fail discovery; an invalid resolved id fails; URL-builder
accept and refuse cases. `go test ./internal/daemon/integrations` and
`./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations`
passed.

Review: `/llm-review` (finder gpt-6-astra: no findings; verifier
claude-fable-5-1 on the URL boundary: one confirmed low-impact bypass of the
encoded-slash refusal, fixed with a regression case) and `/assess-findings`
(1 FIX, applied).

## Exact live check

After a release containing this change is on the Contoso server, Aino signs in
to Microsoft again (Asetukset › Integraatiot › Microsoft › Kirjaudu
uudelleen), then read only:

```
journalctl -u open-habitat-daemon@terocontoso --since '<sign-in time>' | grep integration_discovery
```

- `reason=site_lookup_fallback site_lookup=web_url` once per recovered site,
  and the folder step offers that site's libraries. This confirms the fix and
  the stale-id cause.
- `reason=site_unavailable step=site_drives site_lookup=web_url_same_id`
  means the site exists under the same id but its libraries 404 for this
  token. The fallback does not help there, and the next suspect is library
  permissions (the person reaches the site only through a sharing link or a
  page, not a library).
- `step=site_by_url http_status=404 site_lookup=web_url` means SharePoint
  does not know the address either: the site is deleted or in another tenant.
  The person unfollows it.

## Decisions for later review

- **The webUrl lookup is the only fallback; `sharepointIds` is not used.**
  Alternatives: rebuild the id from `siteCollection.hostname` +
  `sharepointIds.siteId/webId`, or call `GET /sites/{id}` first. Microsoft's
  own example shows `sharepointIds` carrying the same values as `id`, so it
  rarely differs. Using it would also need `$select=sharepointIds,siteCollection`
  on `/me/followedSites`, which no test can verify against Graph, and a
  rejected select would break discovery for everyone. `GET /sites/{id}` with
  the same id would 404 the same way.
- **The webUrl's host is not required to match the composite id's host.**
  After a tenant domain rename, a stale follow record would carry the old
  host in its id and the current one in its webUrl. The request always goes
  to graph.microsoft.com with the person's token, so Graph resolves only
  sites that token can reach.
- **A recovered site's local directory is named by the resolved id.** The
  followed id stays the name when it works directly, so existing directories
  do not move. If Graph later corrects the followed id, it equals the
  resolved one and the directory stays the same.
- **The left-out label is still the followed display name.** If the webUrl
  now addresses a different site than the follow record (a URL reused after
  deletion), that site's libraries appear under the old name. The person can
  open that site, so nothing is exposed, only mislabelled.
