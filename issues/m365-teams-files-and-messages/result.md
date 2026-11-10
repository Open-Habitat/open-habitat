# Result: direction 1 (Teams channel files)

Direction 1 is implemented. Direction 2 (chats and channel messages) is not
started; it has been split into its own intake issue, and this issue is closed
as fixed.

## What changed

- Discovery (`internal/daemon/integrations/microsoft_files_linux.go`) goes on
  after OneDrive and followed sites. It reads `/me/joinedTeams` and, for each
  team, its site (`/groups/{id}/sites/root`) and that site's document
  libraries. It also reads each private or shared channel's own library
  (`/teams/{id}/channels`, then `filesFolder`). A standard channel's files
  are a folder in its team's library, so nothing is fetched for them
  separately. Sites and drives are deduplicated, so a team site that is also
  followed is offered once, under its followed name, and a library reached
  through two channels is offered once.
- Folder chooser entries carry the names people recognise: *Teams · Team ·
  Documents*, *Teams · Team · Channel* and *SharePoint · Site · Library*. The
  label is stored base64url-encoded in the rclone section
  (`habitat_label`), so provider text never becomes config syntax. Roots
  written before this change still show their directory names.
- Scopes: every level's set (`microsoftLevelScopes`) adds
  `Team.ReadBasic.All` and `Channel.ReadBasic.All`. Graph documents these as
  the least-privileged delegated permissions for `joinedTeams` and channel
  listing, and Microsoft's permissions reference lists neither as requiring
  administrator consent. `filesFolder` and the group site only need the Files
  and Sites grants the levels already have. Sign-in asks for `.default`, so
  the permissions take effect only once they are added to each level's app
  registration and consented. Until then the account card lists them as not
  granted and the folder step says why Teams files are missing.
- The browser gets the reason from a new contract field, `teams_left_out`
  (`not_granted`, `refused`, `channels_not_granted`, `too_many`), shown beside
  the existing left-out-sites notice. A channel or team site that answers
  403/404 is named in `unavailable_sites` (a channel's `filesFolder` also
  counts a 400, which Graph documents for some channel names).
- The guided Entra setup (`web/src/components/MicrosoftLevels.tsx`) lists
  the two permissions for every level. `docs/operations.md` tells the
  operator what to add.

## Checks run

- `go test ./internal/daemon/integrations/` and `go test ./internal/daemon/`
  (with the Pi SDK fixture and the `requirements-ci.txt` Python) are green.
  The new synthetic Graph fixture (`microsoft_teams_linux_test.go`) covers
  joined teams, standard/private/shared channels, overlap with a followed
  site, a 403 and a 404 channel, a 403 team site, missing team or channel
  scope, broader scopes, a refused team list, paged lists, config bounds,
  identifier validation before any request, provider names that try to
  inject config syntax, and a recovery that must not select teams.
- `scripts/test-focused.sh --area web` (206 files, 1551 tests), and the
  `Integrations` and `MicrosoftLevels` component tests.
- Browser: `lab-integration-inventory.spec.ts` and
  `lab-microsoft-login.spec.ts` with 2 workers, 8/8 passing (a11y included).
- Contracts: `check-generated.sh` and `validate-contracts.py` are clean.
- Review: an independent `/llm-review` (finder GPT-6 Astra, verifier Claude
  Fable 5.1) and `/assess-findings`. Three findings were confirmed and fixed
  in the same branch: labels could push a previously fitting account over
  the config bound, a team site with a paged library list failed the whole
  sign-in, and the legacy recovery could auto-select team libraries.

Not verified: no real tenant. Synthetic tests cannot show that a real
tenant's `joinedTeams`/`filesFolder` answers match the documented shapes, or
that rclone syncs a channel library. That needs the live check in
`KOKEILTAVAA.md` after the app registrations get the permissions.

## Decisions for later review

- **Team discovery requires the Sites grant.** Team libraries are read like
  followed sites (site, then `/sites/{id}/drives`), so a grant without
  `Sites.*` gets no Teams roots, just as it gets no SharePoint roots today.
  The alternative, `/groups/{id}/drive` with Files only, would offer one
  library per team, but SharePoint would then appear under a grant that the
  SharePoint row reports as not granted.
- **Team sites offer all their libraries, not just the default one.** This
  is the same as followed sites and keeps both paths on one implementation.
  The alternative was the group drive alone.
- **Only channels hosted by a joined team are discovered.** If a person
  belongs to a shared channel without being in a team that hosts it, that
  channel is not found. `joinedTeams` does not return such host teams, and
  `/me/teamwork/associatedTeams` would add cross-tenant hosts whose files
  this tenant's token may not reach. This is recorded in
  `docs/operations.md`. It would be a follow-up if Contoso needs it.
- **The config bound is handled per team, not per library.** Every rclone
  section repeats the token, and the file is capped at 64 KiB (about 15–20
  libraries with real tokens). Teams are added whole, in Graph's order, while
  they fit, and the rest are reported with `too_many`. They never fail
  sign-in. The cap itself (read everywhere with a 64 KiB limit) was not
  raised. Raising it, or sharing one token across sections, would let heavy
  Teams users get everything.
- **Labels give way first.** If the account's own OneDrive and followed sites
  only fit without labels, they connect without them, under directory names.
- **Teams permissions are on every level, including read.** They read team
  and channel names only, and the files go through each level's own
  files/sites permissions, so the read level stays read-only.
- **The legacy recovery never discovers teams.** Recovery repairs followed
  sites for old inventories and may auto-select what it finds, so the
  person's teams wait for their next sign-in and explicit choice.
- **A 403 on the team list means `refused`, not a failed sign-in.** Other
  team-list failures (429, 5xx) fail discovery as followed-site failures do,
  rather than silently showing a partial inventory.

## For Jari (outside this repository)

The Contoso tenant's app registrations (each configured level) need the
delegated permissions `Team.ReadBasic.All` and `Channel.ReadBasic.All`
added, and admin consent granted again, before Teams files appear. Changing
a tenant's registration is not an agent's step.
