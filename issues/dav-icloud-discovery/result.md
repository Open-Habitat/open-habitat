# Result

Connect now discovers the account's DAV home set from the address a person
knows (`https://contacts.icloud.com`, `https://caldav.icloud.com`, a
Nextcloud site root) and stores that final URL in curl's config. Status,
password renewal and the agent's requests use the stored URL and follow no
redirect. Code: `internal/daemon/integrations/dav_discovery_linux.go`.

The walk: PROPFIND (Depth 0, asking `current-user-principal` and the
provider's home set) on the entered URL; follow a 3xx `Location`, the
principal href and the home-set href; if the entered URL is not a DAV
resource, try `/.well-known/caldav|carddav` once (RFC 6764). At most 8
requests. Each target must be HTTPS, carry no userinfo, query or fragment,
and sit under the entered host's registrable domain (public suffix list);
every resolved address must pass the dial-time rule shared with Gitea's
client (now `internal/egress`), and curl is pinned to those addresses with
`--resolve`. Credentials go to curl only through stdin, as before.

## Evidence

- Fake iCloud (`TestDAVDiscoversICloudPartition`): CardDAV front door
  answers with a relative principal and a 404 home-set propstat; the
  principal names an absolute `https://p42-contacts…:port/<dsid>/carddavhome/`.
  CalDAV front door first 301-redirects to its partition host. Both store the
  partition home set; the agent's skill command reaches that host; a later
  redirect makes status not OK and renewal fail without changing the URL.
  A Nextcloud-style `.well-known` case stores `/remote.php/dav/addressbooks/users/person/`.
- Refusals (`TestDAVDiscoveryRefusesOtherSites`): home set on another
  registrable domain, redirect to another site, to `http:`, with userinfo or
  with a query, and names resolving to link-local, metadata, unspecified or
  unnamed loopback addresses. None saves an account; the other site sees no
  credentials.
- Browser spec `integrations.spec.ts`: a `.well-known` address that redirects
  to another site shows the new refusal text.
- iCloud behaviour this mirrors: principal `/298227506/principal/` on
  `caldav.icloud.com` (DAVx5 logs, https://github.com/bitfireAT/davx5-ose/discussions/143);
  home set on a partition host such as `p34-caldav.icloud.com`
  (https://cli.nylas.com/guides/icloud-caldav-settings); RFC 5397, RFC 4791
  §6.2.1, RFC 6352 §7.1.1, RFC 6764.
- Review: `/llm-review` (gpt-6-astra finder, critical rigor) found curl URL
  globbing (`[1-3]` in a same-site href multiplied credentialed requests);
  fixed with `--globoff` everywhere and `TestDAVBracketPathIsOneRequest`.
  A second candidate (pin the agent's curl too) was dropped: the agent is the
  same Unix user, and pinning stored addresses would break on provider IP
  rotation.

## Decisions for later review

- New dependency `golang.org/x/net` (publicsuffix only), pinned at v0.46.0 so
  `golang.org/x/sys` stays at v0.37.0. "Same registrable domain" is not
  safely computable without the public suffix list (`foo.github.io` vs
  `evil.github.io`).
- The stored URL is the home set (where collections are listed), not the
  principal. The skill tells the agent to list collections there first.
- A principal or home set on another site refuses the whole connection
  rather than silently keeping the entered URL.
- `*.localhost` names count as loopback the person named (RFC 6761), like
  `localhost` itself.
- Password renewal re-verifies the stored URL and does not rediscover; if a
  provider moves an account to another partition, the person reconnects.
- Daemon status probes are now also pinned to checked addresses.
