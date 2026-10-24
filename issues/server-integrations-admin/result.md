# Result: administration Integraatiot, Google setup and broker-written app credentials

The root broker now writes the Google, Microsoft and Dropbox sections of
`/opt/open-habitat/integrations.json` on the gateway's request (Jari's option
B). `set_integration_app` and `clear_integration_app` take the host operation
lock (`/var/lib/open-habitat/host`, the one `host apply`, prepare and upgrade
hold while apply writes `tools`), then the broker's own directory lock, check
root's `integrations.browser_setup`, and splice exactly one member into the
file, keeping every other byte. The broker never creates the file, never
touches `tools`, and records who asked against a SHA-256 of the exact section
bytes in its private `integration_apps.json`, so a later hand edit shows as
root's. A secret travels browser → gateway → broker once per write and is
never returned, logged or kept. One definition of each provider's fields and
format (`internal/integrationapps`) is shared by the daemon, broker, gateway
and CLI, and the daemon's catalog now names which tools are missing.

Host: site.json `integrations` is now `{"browser_setup": bool}` (default
true; the old, always-refused array of app files is gone). Host apply publishes
the switch into the broker's state and verifies it; `host plan` reports the
switch and each section's source, actor and time under `integrations`. The
broker unit gains `/opt/open-habitat` in `ReadWritePaths`.

Gateway and CLI: `GET /api/v1/server/integrations`, `POST .../set` and
`.../clear` (contract `server-integrations.schema.json`) check the session,
CSRF and the administrator role as current; root's `admin integrations
list|set|clear` (secret from a file or stdin) uses the same control-socket
path with actor `root`. Refusals are fixed codes (`browser_setup_disabled`,
`host_busy`, `integrations_file_invalid`, `integration_refused`), a missing
reply is `outcome_uncertain`. CONFORMANCE.md has the batch's rows.

UI: Asetukset › Palvelimen ylläpito › *Integraatiot* (`/settings/server-integrations`)
is round 2's direction 2 with round 1's removals; the status of each row is
the administrator's own daemon catalog, read again after every confirmed
change. Google's *Aseta tunnukset…* is round 3's direction 2 (Vaiheittain,
Internal only). *Vaihda tunnukset…* (Google only) asks for a new secret for
the same client. Microsoft and Dropbox take their two values without a guide
until their own issues; their menu has only *Poista tunnukset…*.

## Evidence

- `go test ./internal/integrationapps ./internal/provision ./internal/host
  ./internal/gateway ./internal/cli ./internal/daemon/integrations
  ./test/browser-host`: splice byte preservation and validation
  (`TestReplace*`, `TestValid*`); broker `TestIntegration*`: one section
  changed with tools and the operator's bytes kept, 0644 root file, provenance
  following the bytes, switch off refusing both writes, a held host lock
  refusing within a second with nothing written, untrusted/linked/unparseable
  files refused untouched, stale staging cleared, the secret absent from
  replies, records, logs and events, and a reply carrying a secret failing to
  parse; host plan report; gateway `TestIntegrationApps*`: administrator,
  CSRF and current-role checks, invalid input never relayed, actor from the
  session, each refusal code on HTTP and control, uncertain reply, gateway log
  without the secret; CLI `TestAdminIntegrationsCommands`.
- `./scripts/test-integration-apps-uids.sh`: in a networkless container as
  root with the production paths, the broker's writer sets and clears Google;
  a second real kernel UID runs the daemon package's own catalog against the
  file and sees `app_credentials_required` → `available` →
  `app_credentials_required`, and cannot open the file for writing.
- Web: `ServerIntegrations.test.tsx`, `ServerIntegrationsSettings.test.tsx`,
  stories `Settings/Palvelimen integraatiot` (every row state, each Google
  step, the new-secret step, Microsoft's and Dropbox's fields, phone), browser
  spec `web/tests/server-integrations.spec.ts` (set → Käytössä with the
  administrator's own catalog following, remove → Ei käytössä, a lost reply
  uncertain until read again, axe on the tab and the guide, 390 px).

Not covered: a real Google console, a real systemd-sandboxed broker writing
`/opt/open-habitat` (the unit change is covered only by its template), and a
live person connecting through a browser-set app.

## Decisions for later review

1. **The switch and the provenance live in the broker's state, not in
   integrations.json.** The daemon logs every unknown top-level member of the
   file, and mapped users can read it; a private `integration_apps.json` beside
   the admission files keeps actor ids out of their reach. Alternative: members
   in the file itself.
2. **Absent state means browser setup on.** An installation whose apply has not
   yet published the switch behaves as the site default (true). If root set
   false, it takes effect at the next apply, like `runtime_admission`.
3. **The list returns full client ids; the UI shows the start.** Client ids are
   public (every sign-in URL has them) and the file is world-readable to mapped
   users. Google shows the project number (`704213598812-…`), Microsoft the
   first GUID group, Dropbox the first four characters.
4. **The broker refuses during any host maintenance** (`host_busy`) instead of
   waiting: apply holds the lock for minutes, the exchange deadline is two
   seconds. The administrator tries again; nothing was written.
5. **The broker never creates integrations.json and removes its own stale
   staging files under the lock** (`.integrations.json.broker`,
   `integration_apps.json.next`): a leftover of an interrupted write never took
   effect, so blocking on it, as the ledger's staging does, would only lock the
   browser out.
6. **The unit change**: `ReadWritePaths` gains `/opt/open-habitat` rather than
   moving the file elsewhere: the daemon path, Fleetrepo's guest checks and the
   operator guide all name `/opt/open-habitat/integrations.json`. The broker
   is root and already writes `/etc`, so this widens no real authority. The
   test-release watcher may need a Fleetrepo change for the new unit bytes.
7. **site.json `integrations` changed shape** from the never-supported array of
   app files to `{"browser_setup": bool}`; no compatibility path, as the
   project allows pre-release.
8. **No new ADR.** The decision is Jari's in `proto-server-integrations-setup`
   and lands complete here; its rule went straight into `internal/AGENTS.md`
   rather than an ADR that this same change would remove.
9. **Microsoft fallback asks for a tenant** (`organizations`, `common`,
   `consumers` or a GUID) and the broker requires it explicitly instead of
   defaulting to `common`; round 4's single-tenant guide follows in
   `server-integrations-microsoft`.
10. **The setup dialog stays open until the broker answers**, so a refusal
    (`host_busy`) keeps what was typed; a lost reply closes it and marks the
    row uncertain, since retyping a secret is the administrator's choice.
11. **Tunnukset menu shows actors by GitHub login** when the access list knows
    them, otherwise by id; `root` reads as "asetettu palvelimella".
