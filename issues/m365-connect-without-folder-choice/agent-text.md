# Agent text changed by connecting Microsoft without a folder choice

Status: **waiting for Jari's proofreading** before a pilot release carries it.

Since 14.11.2026 a Microsoft sign-in syncs nothing, so most accounts have no
synced OneDrive or SharePoint directory. The text an agent reads changes in
three places. Everything else in the personal-data skill is unchanged; in
particular the whole Microsoft section of an account that an earlier release
left syncing (the version Jari approved on 13.11.2026 in
`m365-agent-file-search/agent-text.md`) renders byte for byte as before.
The renderings below are from the code (`Skill` in
`internal/daemon/integrations/microsoft_linux.go`, `microsoftSearchSkill`)
for a synthetic account.

## 1. A Microsoft account that syncs nothing (every new account)

New. The section no longer has the paragraph about chosen folders and the
"Synced directories" list. The first sentence of the search paragraph and the
grep paragraph say that nothing is local.

Before (what such an account got until now): the synced-folders paragraph
("The OneDrive folders and SharePoint libraries the person chose sync both
ways: …"), the search text as for a synced account, and at the end "No
OneDrive folder or SharePoint library is synced for this account; Outlook and
file search work without one."

After:

````markdown
### person@example.test — Microsoft

Outlook mail, calendars, contacts and Microsoft 365 files are reached through the Pi MCP server `habitat-microsoft-person-example-test`, which is signed in as this account only; its tool descriptions carry the syntax. For mail, `create-draft-email`, `create-reply-draft`, `create-reply-all-draft` and `create-forward-draft` prepare a draft; `send-mail`, `send-draft-message` and the `reply-…` and `forward-…` tools send at once. Files and Outlook share one sign-in, so a sign-in problem stops both and the person renews it once in Settings → Integrations. Connecting an account from another organisation may first need that organisation's administrator to approve the app.

None of this account's files are copied to this machine, since a full copy of every library would not fit the person's storage. Microsoft's search is how files are found. `search-query` with the entity type `driveItem` searches the names and contents of everything this account can open: OneDrive, every SharePoint site and team, followed or not, and files shared with the person. KQL narrows it, for example `filetype:pdf`, `path:"https://…"` or `LastModifiedTime>=2026-01-01`. `search-sharepoint-sites`, `list-sharepoint-site-drives`, `search-onedrive-files` and `list-folder-files` look inside one site, library or folder.

To read a file, fetch it with `download-bytes-to-file` (path `/drives/{driveId}/items/{itemId}/content`) to `~/cloud/microsoft-fetched/person@example.test/` followed by the host and decoded path of the item's `webUrl`, for example `~/cloud/microsoft-fetched/person@example.test/contoso.sharepoint.com/sites/Sales/Shared Documents/offer.docx`; when the `webUrl` is not a plain path to the file, use the drive ID and the file name instead. The local path then says where the file lives in the cloud. The tool needs the parent directory to exist and does not overwrite: a file already there is an earlier fetch that may be stale and may hold edits made here. Look at its age, and put a fresh fetch beside it under another name instead of deleting it.

Grep and read within what you fetched. A recursive grep or find over `~/cloud/` as a whole is the thing to avoid: it sees only what happens to be local, so finding nothing there says nothing about the cloud.

A fetched file is a local copy that you may edit, but the edit stays here: this server has no tool that uploads, moves, shares or deletes anything in Microsoft 365. When the person wants an edited file back there, tell them where the copy is so they can upload it.
````

An account without file tools (no files or sites grant) gets only the first
paragraph, with "Outlook mail, calendars and contacts are reached …"; the
line "No OneDrive folder or SharePoint library is synced for this account;
Outlook works without one." is gone.

## 2. An earlier release's sync whose first pass has not finished

Only the last line of the section changes, since the folder choice it pointed
to no longer exists:

- Before: "The first sync has not finished, so nothing under those paths can
  be relied on yet. The person finishes the folder choice in Settings →
  Integrations."
- After: "The first sync has not finished, so nothing under those paths can
  be relied on yet."

## 3. Host context (`internal/daemon/host-context.md`, section "Files on the person's computer")

Every agent reads this. A new Microsoft account has no synced OneDrive folder
to suggest.

- Before: "Suggest a synced OneDrive or Dropbox folder when the person wants
  to share files from their computer (for example screenshots) or receive
  files there."
- After: "Suggest a synced Dropbox folder, or a OneDrive folder that already
  syncs here, when the person wants to share files from their computer (for
  example screenshots) or receive files there."

The rest of that paragraph is unchanged.
