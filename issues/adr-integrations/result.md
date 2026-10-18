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
