# Result: integrations ADR drafted as Proposed

[ADR 0026](../../docs/decisions/adr-0026-integrations-catalog.md) records the
integrations catalog with status **Proposed**, registered in
`docs/decisions/index.md` and `docs/glasspad.yaml`. No product code changed,
so there is nothing new to try on the test server and `KOKEILTAVAA.md` is
unchanged.

It states the catalog design (product-shipped entries, status read live from
the tools, no stored record of what is connected), skill and MCP placement
(`~/.agents/skills/` and `~/.pi/agent/mcp.json` only), the two login relays
(device code, pasted redirect) and the excluded routes (per-person TCP ports,
redirect through the gateway), continuous sync as daemon children into real
directories, the operator's role, the agent-exposure warning, and a list of
what only the prototype can settle.

Evidence: `python3 scripts/validate-project-view.py` (38 pages valid) and
`git diff --check`. Review was one self-review against the two research
reports, `docs/architecture/deployment.md`, the daemon unit template and the
broker's boot restoration, as the brief allows.

## Decisions for later review

- **Boot start through the broker.** The ADR has the broker, which already
  restores committed users' daemon sockets at boot, also start each user's
  daemon service. This widens the root broker's allowed systemd action from a
  socket start to the same user's service start. Jari's 18 October note said
  starting each daemon at boot needs no new host surface; this is the
  smallest concrete form of that, but it is a root-side change and should be
  confirmed when he accepts the ADR.
- **Real directories, not FUSE mounts**, for synced files: the daemon unit's
  `NoNewPrivileges` would block setuid `fusermount`, and real files count
  against quota and stay readable offline.
- **Catalog entries are product code**, not an operator-editable file; the
  operator enables entries by supplying the application identifiers and
  installing the tools.
- **Microsoft files tool**: abraunegg/onedrive preferred for its device-code
  login matching ms-365-mcp-server, rclone as fallback; the prototype decides.
- **Daemon-completed OAuth exchange** is allowed as a fallback when a tool
  cannot accept a pasted redirect (rclone is the likely case), provided the
  result goes straight into the tool's own configuration and the daemon keeps
  no copy.
- The installation-wide integrations configuration may be world-readable,
  since it holds only application identity.

# Result: ADR 0026 accepted (2026-10-18)

ADR 0026 now carries Jari's decisions of 2026-10-18 from
`issues/agent-integrations/item.md` and `issues/proto-integrations/result.md`
and is marked **Accepted by Jari on 2026-10-18**. Changes: the scope table
(Google and Microsoft files, mail, calendar and contacts; generic IMAP/SMTP
with CalDAV/CardDAV by app password; Dropbox; the later-only list), `gog`
over `gws`, accounts as the connected unit with several per provider, one
daemon-maintained personal-data skill instead of one skill per entry, MCP
entries per server through `pi mcp add/remove`, the `~/cloud/<service>/<account>/`
layout, and boot start limited to users with a syncing integration. The
prototype's feasibility findings joined the context, and the "only the
prototype can settle" list became "Still open" with the real-account gaps.
`docs/decisions/index.md`, `docs/glasspad.yaml` and the boot paragraph of
`docs/architecture/deployment.md` (as an accepted, not yet implemented change)
were updated. No product code changed, so `KOKEILTAVAA.md` is unchanged.

Evidence: `python3 scripts/validate-project-view.py` and `git diff --check`.
Review was one self-review of the ADR against the two decision sources, as
the brief allows.

## Decisions for later review

- **Skill name** `~/.agents/skills/personal-data/`; any fixed catalog-owned
  name works.
- **Boot marker.** Jari approved "read from the person's integration
  directory". The ADR keeps that wording and requires the root broker only
  to check the directory's existence without following links or reading it,
  so a person can at most start their own daemon. Which path is the marker
  (it must reflect a configured sync client, not a kept `~/cloud/` folder
  after removal) is left to implementation.
- **Dropbox login** uses the ADR's existing fallback (daemon-completed
  exchange written into rclone's configuration) rather than rclone's fixed
  loopback listener, which the per-person TCP-port exclusion rules out.
  Google Drive avoids the listener through the `gog` token handoff.
- **App passwords** for generic mail pass browser → gateway → daemon like any
  other request; the gateway relays them without storing them. The daemon
  writes them into the tool's own configuration.
- **CalDAV/CardDAV tool** is left to implementation; `himalaya` is named for
  IMAP/SMTP because Jari's `workspace` skill already uses it.
- **Service directory names** under `~/cloud/` (e.g. `sharepoint`) are fixed
  in implementation; the ADR fixes only the shape and lowercase.
- **One MCP entry per Microsoft account**, since each ms-365-mcp-server
  instance has its own token cache.
