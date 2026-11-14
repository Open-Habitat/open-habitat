---
created: 2026-11-10
updated: 2026-11-14
type: bug
reporter: jari
status: open
priority: high
provenance: chat
source_ref: taskfleet:01m72a2pjq8ppye66vxcrg3wtd/contoso-m365-first-sync
originating_run: 01m72a2pjq8ppye66vxcrg3wtd
originating_run_kind: spinoff
lane: m365-first-sync
lane_seq: 1
preparation: pending
---

# Microsoft first sync refused over quota after a 16-minute count; a Teams channel site skipped with 404

## Description

## Description

Jari 10.11.2026, Contoso pilot (pilot.25, amd64): a person's Microsoft 365
first synchronization "did not bring all data". The dialog showed the first
synchronization counting the chosen files' size ("Laskee valittujen
tiedostojen kokoa ja tarkistaa tilan · 0:23") and said one followed
SharePoint site could not be opened and was left out. Daemon journal:
`integration_discovery provider=microsoft outcome=skipped
reason=site_unavailable step=site_drives http_status=404
graph_code=itemNotFound` at 08:28:40Z.

## Cause (evidence from the pilot's journals and Habitat metadata, read only)

**The first sync failed; nothing was copied.** Folders were chosen 19 s after
the folder list appeared (08:28:59Z). Microsoft's folder step lists every root
with an unknown size (no `FolderSizer`), so `chooseFolders` cannot check the
quota and admits the choice. `MeasureFolders` then ran `rclone size` over each
chosen root for 16 minutes and at 08:44:40Z the fresh admission refused it:
`integration_login provider=microsoft outcome=failed reason=quota_insufficient`.
The person's home quota is the installation's 20 GiB hard limit with ~0.2 GiB
used, so the chosen roots (OneDrive plus followed SharePoint libraries)
counted more than ~19.8 GiB. The behaviour matches the design (no copy without
a fresh count and quota observation); no file sync process was ever started
for the account. Outlook, calendar and contacts were not affected. The refusal
event did not say how much was needed, so the shortfall could not be told from
the journal.

**The skipped site is not a malformed Graph request.** The person's
Habitat-generated rclone configuration (section headers only were read) holds
OneDrive and two document libraries discovered from other followed sites in
the same discovery, through the same `/sites/{hostname,siteId,webId}/drives`
form, so the comma-escaping defect (`sharepoint-site-id-comma-escaped`) is
not back. The skipped site's display name has the `<team>-<channel>` form
Teams gives private and shared channel sites. A 404 `itemNotFound` (rather
than 403 `accessDenied`) usually means Graph does not find the site in the
signed-in tenant: a shared channel hosted by a partner organisation lives in
that organisation's tenant, and a deleted channel site leaves a stale follow.
This was not confirmed against Graph (that would need the person's token).
Either way Habitat cannot open the site with this sign-in. The discovery event
did not say whether the site's host was the tenant's own.

## What Jari tells the customer's administrator

1. The first synchronization did not run because the chosen OneDrive and
   SharePoint libraries are together larger than the 20 GB home space on the
   pilot server. Either the person chooses fewer libraries, or the pilot's
   per-person space is raised (an installation setting on our side, not
   theirs).
2. One followed SharePoint site, a Teams channel site, cannot be opened
   with the person's own organisation's sign-in. Please check in the SharePoint
   admin center whether that channel site belongs to your tenant. If it is a
   shared channel hosted by the partner organisation, its files are in the
   partner's tenant and Habitat cannot sync them through your organisation's
   sign-in; the person can unfollow it to remove the notice. If it is your
   site, check that it still exists and that the person is a member of the
   channel.

## Acceptance Criteria

- [x] A quota refusal of a counted first pass logs `needed_bytes` and
  `free_bytes` (totals only).
- [x] A skipped followed site's event says whether its host matches a followed
  site that opened (`site_host=same_as_reachable_site |
  other_than_reachable_sites | no_reachable_site`) without logging the host.
- [ ] Design (not decided here): give Microsoft's folder step size information
  (or a fast estimate) so a person can choose within the quota before a long
  count, and show the counted size against free space when a pass is refused.
