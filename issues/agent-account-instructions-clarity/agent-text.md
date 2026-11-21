# What the agent is told about connected accounts

Ehdotus, ei tuotteessa. Alla on vain se teksti, jonka agentti lukisi, siinä
järjestyksessä kuin se sen kohtaa. Nykyiset tekstit ovat koodissa (polku
kunkin otsikon alla). Esimerkkitili on keksitty.

## 1. Always in view: host context

`internal/daemon/host-context.md`, "Integrations", first paragraph.

> The person connects mail, calendars, contacts and cloud storage in
> Settings → Integrations. When they ask about a message, a meeting, a
> contact or a document in OneDrive, SharePoint, Google Drive or Dropbox,
> start from the `personal-data` skill at
> `~/.agents/skills/personal-data/SKILL.md` when it is present: it describes
> the accounts they connected, how each is reached and what is at stake in
> changing it. Some accounts' files are folders under `~/cloud/`, outside the
> workspace sources, where a local change can reach the cloud and the
> person's other devices. Others exist only in the cloud and are found by
> searching it, so an empty `~/cloud/` does not mean there are no files.

## 2. Always in view: the skill's description and Pi's server line

`renderSkill` in `internal/daemon/integrations/skill_linux.go`; the server
line is new (`pi mcp add … --description`).

> The person's own mail, calendars, contacts and cloud files across their
> connected accounts: aino.virtanen@contoso.test (mail, calendar, contacts,
> files). Read it before working with a message, a meeting, a contact or a
> document in their cloud storage: it says how each account is reached, where
> ordinary work starts and what is at stake in changing things there. Not for
> repository or source files.

> Outlook mail, calendar and contacts and the Microsoft 365 files (OneDrive,
> SharePoint) of aino.virtanen@contoso.test. The personal-data skill says
> where ordinary work starts.

## 3. The skill's opening

Same file. "What is at stake" and the sections about synced folders stay as
shipped.

> The person connected these accounts so that you can work with their mail,
> calendars, contacts and files. Each account has a section below that says
> what the account is, how it is reached and where ordinary work starts.
> Syntax lives in each tool's own `--help` or description, which is newer
> than any example here.

## 4. The Microsoft account

`microsoftOutlookSkill` and `microsoftSearchSkill` in
`internal/daemon/integrations/microsoft_linux.go`. This is the account of the
observed failure.

> ### aino.virtanen@contoso.test — Microsoft
>
> This account is an Outlook mailbox (mail, calendar, contacts) and the
> person's Microsoft 365 files (OneDrive, SharePoint, Teams) behind one
> sign-in. Both are reached through the Pi MCP server
> `habitat-microsoft-aino-virtanen-contoso-test`, signed in as this account
> only. Pi shows you a tool only when you search for it, and the server has
> many with similar names, so search by the names given here; each tool's
> description has the syntax. A folder of documents and a mail folder are
> different things on this server: a tool with `mail-folder` or
> `contact-folder` in its name arranges the mailbox itself. (a)
>
> The files are not on this machine, because a full copy would not fit the
> person's storage, so nothing under `~/cloud/` tells you what exists.
> `search-query` with the entity type `driveItem` searches the names and
> contents of everything the account can open: OneDrive, every SharePoint
> site and team, and files shared with the person. KQL such as
> `filetype:pdf` or `path:"https://…"` narrows it. When the person names the
> place, `search-sharepoint-sites`, `list-sharepoint-site-drives` and
> `list-folder-files` walk from the site to its libraries to a folder, and
> `search-onedrive-files` looks in their own OneDrive.
>
> `download-bytes-to-file` fetches a file (path
> `/drives/{driveId}/items/{itemId}/content`). Fetched files live under
> `~/cloud/microsoft-fetched/aino.virtanen@contoso.test/` followed by the
> host and decoded path of the item's `webUrl`, as in
> `…/contoso.sharepoint.com/sites/Sales/Shared Documents/offer.docx`, so that
> the local path says where the file lives in the cloud; the drive ID and the
> file name serve when the `webUrl` is not a plain path. The tool needs the
> parent directory to exist and does not overwrite. A file already there is
> an earlier fetch that may be stale or hold edits made here, so a fresh
> fetch goes beside it under another name. The copy is yours to read and
> edit, but nothing on this server uploads, moves, shares or deletes in
> Microsoft 365: when the person wants an edited file back there, tell them
> where the copy is.
>
> Mail starts from `list-mail-messages` and `read-mail-text`. A reply or a
> new message is left in Drafts with `create-reply-draft`,
> `create-reply-all-draft`, `create-forward-draft` or `create-draft-email`,
> and `send-draft-message` sends a draft the person asked you to send.
> `send-mail` and the tools named `reply-…` and `forward-…` send at once,
> with nothing for the person to read first. (b) The calendar starts from
> `get-calendar-view`, which unlike the plain event list shows every
> occurrence of a recurring meeting.
>
> A sign-in problem stops mail and files alike; the person renews it once in
> Settings → Integrations.

If the tool list in `tool-surface.md` is accepted, sentences (a) and (b) go:
the tools they explain are no longer offered. The variants the code already
renders (an account with synced directories, one without a files grant, a
narrower level) keep their present sentences.

## Mitä muuttui ja miksi

Nykyinen teksti suojaa kolmea asiaa, ja ne kaikki säilyvät: postia ei lähde
ihmisen lukematta, haettu tiedosto ei korvaa aiempaa kopiota, eikä agentti
päättele `~/cloud/`-hakemistosta, mitä pilvessä on.

Uutta on se, mitä agentti ei voinut tietää ja mikä todennäköisesti selittää
pilotin virheen: sama palvelin on sekä postilaatikko että tiedostovarasto,
työkalut löytyvät vain hakemalla, ja "kansio" tarkoittaa kahta eri asiaa.
Postille ja kalenterille on nyt alkupiste; aiemmin ei ollut.

Pudotettu:

- Kaikki ennen/jälkeen-vertailut, perustelukappaleet ja kaavio. Ne olivat
  tekstiä Jarille tekstistä, eivät agentin ohjetta.
- Google-tilin muutos. `gog --help` kertoo jo, mistä kukin työ alkaa, eikä
  havaittu virhe koskenut Googlea. Teksti jää ennalleen.
- Työkalujen omista kuvauksista kopioitu syntaksi ja virke toisen
  organisaation ylläpitäjän hyväksynnästä (se koskee yhdistämistä, jonka
  ihminen tekee selaimessa).
- "Mikä on pelissä" -osan muutokset. Osa on jo kirjoitettu syiksi, eikä
  pilotin agentti erehtynyt sen takia.

Nimetyt työkalut ovat kiinnitetyn palvelimen (0.170.1) täydellä tasolla
tarjoamia; `tool-surface-check.py` listaa ne. Se, että Pi näyttää työkalun
vasta haun jälkeen, on luettu Pin 1.5.2 dokumentista `docs/mcp.md`, ei nähty
istunnossa.
