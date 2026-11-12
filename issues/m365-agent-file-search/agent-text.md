# Agent text for Jari's proofreading (m365-agent-file-search)

Status: **waiting for Jari's proofreading.** The text is on `main` (which
feeds only the disposable test server); no pilot release carries it before
Jari has read and accepted it.

The agent text is English only: the generated personal-data skill
(`~/.agents/skills/personal-data/SKILL.md`) has no Finnish version, and the
host context (`internal/daemon/host-context.md`) is unchanged, since it only
points to the skill. Source: `microsoftSearchSkill` and `Skill` in
`internal/daemon/integrations/microsoft_linux.go`.

## Changed: first sentence of each Microsoft account's section

Shown only when the account's grant includes files or sites (every level
does) and its Pi registration is the current one.

Before:

> Use the Pi MCP server `<server>` for Outlook mail (drafts first), calendars and contacts.

After:

> Use the Pi MCP server `<server>` for Outlook mail (drafts first), calendars, contacts and finding Microsoft 365 files.

## New: one paragraph after the existing files paragraph

`<account>` is the account's address, for example `aino@contoso.test`.

> Find Microsoft 365 files by search, not by browsing or grepping. `search-query` with the entity type `driveItem` searches the names and contents of everything this account can open: OneDrive, every SharePoint site and team, followed or not, and files shared with the person. KQL narrows it, for example `filetype:pdf`, `path:"https://…"` or `LastModifiedTime>=2026-01-01`. `search-sharepoint-sites`, `list-sharepoint-site-drives`, `search-onedrive-files` and `list-folder-files` narrow to one site, library or folder. Fetch only the files you need with `download-bytes-to-file` (path `/drives/{driveId}/items/{itemId}/content`) to `~/cloud/microsoft-fetched/<account>/` followed by the host and decoded path of the item's `webUrl`, for example `~/cloud/microsoft-fetched/<account>/contoso.sharepoint.com/sites/Sales/Shared Documents/offer.docx`; if the `webUrl` is not a plain path to the file, use the drive ID and the file name instead. Create the parent directory first. The tool never overwrites: a file already there is an earlier fetch, so check its age before relying on it, and fetch the current version beside it under a new name rather than deleting a copy that may hold edits. Grep and read within the fetched files. A ready sync directory below is a full local copy, so a targeted search inside one is fine, but never grep or find recursively over `~/cloud/` as a whole. A fetched file is a local copy: you may edit it, but nothing reaches Microsoft, and no tool here uploads, moves, shares or deletes anything in the cloud. When the person wants an edited file back in Microsoft 365, tell them where the copy is so they can upload it.

## In context

How the account's section reads with a full-level grant and no synced
libraries:

```markdown
### person@example.test — Microsoft

Use the Pi MCP server `habitat-microsoft-706572736f6e406578616d706c652e74657374` for Outlook mail (drafts first), calendars, contacts and finding Microsoft 365 files. It is pinned to this account; never switch its identity or export tokens. The server's own tool descriptions provide syntax. Selected OneDrive files sync both ways under `~/cloud/onedrive/person@example.test/`; selected SharePoint libraries under `~/cloud/sharepoint/<organisation>/<site>/<library>/`. Only directories shown in Settings → Integrations are ready. Edits, moves and deletions reach the cloud: write only what the person requested. If rclone's native bisync safeguards stop sync, preserve both sides; never bypass them with --force or blind --resync. Reconnecting does not approve deletions. Initial conflicting local versions are backed up under `~/.local/share/rclone/microsoft-backups/person@example.test/`. One Microsoft sign-in authorizes both cloud files and Outlook. Other work tenants may require their administrator's consent to the operator's app.

Find Microsoft 365 files by search, not by browsing or grepping. `search-query` with the entity type `driveItem` searches the names and contents of everything this account can open: OneDrive, every SharePoint site and team, followed or not, and files shared with the person. KQL narrows it, for example `filetype:pdf`, `path:"https://…"` or `LastModifiedTime>=2026-01-01`. `search-sharepoint-sites`, `list-sharepoint-site-drives`, `search-onedrive-files` and `list-folder-files` narrow to one site, library or folder. Fetch only the files you need with `download-bytes-to-file` (path `/drives/{driveId}/items/{itemId}/content`) to `~/cloud/microsoft-fetched/person@example.test/` followed by the host and decoded path of the item's `webUrl`, for example `~/cloud/microsoft-fetched/person@example.test/contoso.sharepoint.com/sites/Sales/Shared Documents/offer.docx`; if the `webUrl` is not a plain path to the file, use the drive ID and the file name instead. Create the parent directory first. The tool never overwrites: a file already there is an earlier fetch, so check its age before relying on it, and fetch the current version beside it under a new name rather than deleting a copy that may hold edits. Grep and read within the fetched files. A ready sync directory below is a full local copy, so a targeted search inside one is fine, but never grep or find recursively over `~/cloud/` as a whole. A fetched file is a local copy: you may edit it, but nothing reaches Microsoft, and no tool here uploads, moves, shares or deletes anything in the cloud. When the person wants an edited file back in Microsoft 365, tell them where the copy is so they can upload it.

Ready sync directories:
No OneDrive or followed SharePoint roots are configured for this account; Outlook tools remain available.
```

## Points worth Jari's eye

- The fetched-file location rule (`~/cloud/microsoft-fetched/<account>/` +
  the host and path of the item's `webUrl`) is decided in `result.md`.
- "never grep or find recursively over `~/cloud/` as a whole" applies also
  to accounts that sync libraries; a targeted search inside one ready sync
  directory stays allowed.
- Write-back is not offered: the agent tells the person where the edited
  copy is. Write tools come in a later issue.
