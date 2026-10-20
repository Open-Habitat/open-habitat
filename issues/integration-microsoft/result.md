# Microsoft implementation — validation in progress

Uses rclone 1.71.2 as the file-sync fallback, Softeria
`@softeria/ms-365-mcp-server` 0.170.1 for Outlook/calendar/contacts, and the
installation's pinned Pi 1.3.0 native MCP CLI. abraunegg/onedrive is not invoked
(feasibility version 2.5.11); no additional onedrive installation is needed.

Two sequential device codes obtain independent native grants. Graph establishes
identity and enumerates OneDrive plus document libraries of followed SharePoint
sites. Native rclone config and bisync listings, MSAL encrypted file caches,
and Pi's mcp.json are the only account stores. Generated personal-data guidance
names the account-pinned MCP server and actual selected local directories.

Operator instructions and exact integrations.json keys are in
`docs/operations.md` → Optional Microsoft integration. `microsoft.client_id`
identifies the existing public app; `microsoft.tenant_id` is **common**, not the
operator's home tenant UUID. Personal accounts switch native refresh authority
to consumers. Preserve every existing provider/tool key. Deploy the capable
binary before adding the new section to older strict readers; the separate
unknown-key degradation issue is untouched. Tools need absolute root-owned
pinned executable wrappers (`tools.rclone`, `tools.ms-365-mcp-server`, `tools.pi`).
The app's home-tenant admin consent is not other tenants' consent. The UI's
consent failure carries an explicit organisations/adminconsent link with the
app ID, scopes and registered nativeclient redirect.

No live test or server change is authorized to this worker. Live completion,
real tenant admin consent, personal/work refresh, cloud upload/download and
agent calls remain the conductor's post-deployment verification. The acceptance
criterion will not be checked as though that had happened. No lab screenshots
on Alder: captures deferred under its remote-only specialist/capture policy.

The credential and bidirectional-sync surface warrants critical independent
review and local evidence assessment rather than only self-review. Focused Go,
contracts and existing integrations browser checks are being run remotely; full
clean gate is deliberately not part of this worker's landing policy.
