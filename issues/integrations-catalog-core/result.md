# Result: integrations catalog core

Implemented in taskfleet run `01m59e6mdggp91pjmqavm9c6gj` on 2026-10-19. ADR 0026 and the accepted
prototype (direction Tili) are the specification.

## What exists now

- **Daemon catalog** `internal/daemon/integrations/`, run inside the person's daemon as that
  person. Entries are product code behind small interfaces (`Entry`, `PasswordEntry`,
  `LoginEntry`, `SyncEntry`, `FolderEntry`). Accounts are read from each tool's own files under
  catalog-owned names; status is read live from the tool on every list; the host keeps no
  record of connections.
- **First entry: generic IMAP via himalaya** with an app password. One configuration file per
  account at `~/.config/himalaya/open-habitat/<address>.toml` (0600, password in himalaya's own
  `password.raw`), so the person's own `config.toml` is never edited. The file is written beside
  its final name, checked with `himalaya account check`, and only then put in place; a refused
  password or an unreachable server leaves nothing. A new password replaces the old one only
  once it works. Removal deletes the file.
- **Login relays** for future entries: device code and pasted redirect, one attempt per daemon,
  leased to the gateway's hash of the browser session (as Pi and Claude logins are), a pasted
  address accepted only as a loopback address under the prefix the tool printed and handed once
  to the tool this attempt started, then folder choice checked against the home quota. Fixed
  failure codes for expiry, refused redirect, tenant consent (with the tool's admin-consent
  link), blocked device code, wrong account on renewal.
- **Sync supervision**: each syncing account's client is a child of the daemon, restarted with
  exponential backoff (1 s → 5 min), stopped on removal; quota-full and restarting states
  overlay the tool's status. Removal can move the synced folder to the freedesktop Trash
  (`trashCloudDirectory`, no symlink, no filesystem crossing); otherwise it stays.
- **Personal-data skill** `~/.agents/skills/personal-data/SKILL.md` (0600), generated from what
  the tools hold, rewritten on every change and at daemon start, removed with the last account,
  never written over a file without the catalog's marker line. Pi's own skill loader loads it.
- **Contract**: `integrations`, `integration-account`, `integration-change`, `integration-login`,
  `integration-login-control` schemas, examples, scenario CT-037 and five negative checks.
- **Gateway**: routes three paths and hashes the session for the login lease; parses nothing.
- **Web**: Asetukset › Integraatiot (Tili direction): account cards with live status and
  "Tarkistettu klo", "Lisää toinen …-tili" per connected provider, the agent warning on the page
  and before every sign-in, the sign-in dialog with each step on its own row, removal dialog.
  Provider marks use the round's proposed `--ah-source-1..3` tokens.
- **Operator configuration**: `/opt/open-habitat/integrations.json` (root-owned, read with the
  same trust checks as the Pi runtime selector, now shared as `core.ReadOperatorFile`), e.g.
  `{"tools": {"himalaya": "/opt/open-habitat/tools/himalaya"}}`. Missing file: every entry is
  shown as unavailable. Untrusted or malformed: logged and treated the same; the daemon starts.

## For `broker-boot-syncing-daemons`

The person's integration directory is **`~/.local/state/open-habitat/sync-at-boot`** (constant
`integrations.BootSignal`). It is an empty directory that exists exactly while the person has at
least one account with a supervised sync client. The daemon derives it from the tools' own
configuration at every start and after every connect, completion and removal, creating missing
levels 0700 and removing only the last, empty level. The broker should check, without following
links, that `.local`, `.local/state`, `.local/state/open-habitat` and `sync-at-boot` are
directories owned by the person, and read nothing inside. A stale one heals at the next daemon
start; the worst a person can cause is the start of their own daemon. No production entry
syncs yet, so in practice it appears once the Google, Microsoft or Dropbox entries land.

## Seams for the next entries

- Google (`gog` + rclone): a `LoginEntry` whose `StartLogin` runs `gog auth add … --remote
  --step 1`, returns its auth URL with prefix `http://127.0.0.1`, and in `Redirect` runs step 2;
  plus `SyncEntry`/`FolderEntry` for Drive into `cloud/google-drive/<address>`. Client id/secret
  go into `Config` (extend the struct; unknown fields are refused today).
- Microsoft: device code via `Env.StartLineTool` (bounded lines, SIGTERM then SIGKILL after 2 s
  as the prototype found necessary). `ConsentRequired{URL}` carries the admin-consent link.
- IMAP/DAV: SMTP and CalDAV/CardDAV extend the himalaya entry's file and `Services()`; the skill
  text already says no SMTP is configured.
- Dropbox: rclone with the daemon completing the exchange (ADR); `SyncEntry` as for Drive.

## Evidence

Tested tree: commit `00cc4637` plus the final docs commit; the code is unchanged since.

- `go test -race ./internal/daemon/integrations` (twice), `./internal/gateway`,
  `./internal/diagnostic`, `./internal/core`, `./internal/cli`; `go test ./internal/daemon` (full,
  52 s): pass. `go vet` on touched packages: clean.
- Real pinned **himalaya v2.2.1** (release tarball sha256 `5c5ba272…a0ea`, binary in scratch, not
  installed) against a synthetic TLS IMAP server with a synthetic CA:
  `OH_TEST_HIMALAYA=<binary> go test -run TestRealHimalayaOverTLS`: a wrong password and a closed
  port are classified and leave nothing; the written file is himalaya's default account.
- **Distinct UIDs**: `./scripts/test-pi-attempt-uids.sh` (rootless Podman, three kernel UIDs) now
  includes `TestIntegrationsDistinctUIDs`: pass. It proves one person's account lands only in
  their home, owner-only (tool file and skill 0600), the other daemon lists nothing, and the other
  UID can neither reach the socket nor read the files. Same-UID browser tests do not prove this.
- `./scripts/test-focused.sh --area contracts`: clean; `python3 scripts/validate-contracts.py`:
  52 schemas, 35 scenarios, 17 negative checks.
- `./scripts/test-focused.sh --area web`: pass (243 unit, 174 component tests).
- Playwright `integrations.spec.ts` (5 cases incl. `@a11y` at desktop and 390 px): pass, on the
  synthetic host with `OH_BROWSER_WORKERS=2` (inotify limit on alder). Affected specs
  `shell-accessibility`, `settings-name-and-storage`, `settings-model-picker`, `phone-sign-in`,
  `mutation-layer`: pass. `account-settings.spec.ts`: 11/12; the failing case "native key add,
  suffix, provider switch and confirmed removal" fails identically on unmodified `main`
  (f0f641e2), so it is pre-existing, filed as an intake issue.
- `npm run storybook:test`: builds; stories in `Integrations.stories.tsx`.
- Lab screenshots with static HTML in `lab/` (`web/lab/capture-integrations.mjs`): empty page,
  IMAP intro/refused, Microsoft intro/device code/folders/connected, Google paste open/wrong
  address/over quota, accounts, expired login, consent required, device code blocked, removal,
  phone, dark. Compared by eye with the prototype's Tili direction: same structure, cards, steps
  (now one per row), quota bar and warning.
- Independent review (`/llm-review`, gpt-6-astra finder, claude-fable-5-1 verifier): seven
  findings, all confirmed and fixed with regression tests (invalid YAML in the skill, an
  unreadable inventory treated as empty, removal racing a folder choice, a cancelled attempt's
  cleanup racing its successor, a stalled poll, an omitted empty folder list, an uncertain
  cancellation). `/assess-findings`: FIX 5, DROP 2 (rare, fixed anyway).

## Limits

- No real Google, Microsoft or Dropbox entry; their flows are proven only with the synthetic
  host's stand-ins and Go test entries. The device-code, paste and folder paths are framework
  code until those issues land.
- The test server needs Fleetrepo to install a pinned himalaya and write
  `/opt/open-habitat/integrations.json` before the IMAP entry is available there (KOKEILTAVAA says
  so). Not done from this repository.
- No live IMAP server was used; the real-tool test uses a synthetic one.
- Status checks run on every page read (up to 12 s per account, four in parallel); no cache.

## Decisions for later review

- **One himalaya file per account** under `~/.config/himalaya/open-habitat/` rather than
  sections in the person's `config.toml`. Alternatives: marker-delimited blocks in
  `config.toml`. Chosen because the person's file stays untouched and the file name is the
  catalog-owned name; the cost is that agents pass `-c <file>`, which the skill spells out.
- **IMAP only, no SMTP** in this issue; drafts go to the Drafts mailbox over IMAP. SMTP and
  sending rules are `integration-imap-dav`'s.
- **Only TLS and STARTTLS**; no cleartext IMAP. A person with a cleartext-only server cannot
  connect.
- **Boot signal location** `~/.local/state/open-habitat/sync-at-boot` (above). Alternatives:
  `~/cloud` itself (persists after removal, and people create it), a single dot-directory in the
  home root (fewer components for the broker, but clutters the home). Chosen as XDG state for a
  derived signal.
- **Removal's "delete the folder" goes to the Trash**, per the destruction rule, not permanent
  deletion. The Trash view in Tallennustila lists only workspaces, so a trashed synced folder is
  invisible there and still counts against the quota until the Trash is emptied by other means.
  The first syncing entry should decide whether the Trash view shows such entries.
- **Status is read on every list, uncached**, with "Tarkista" re-reading everything but showing
  only that account as checking. A cache would need a measured problem first.
- **Cancel at the folder step removes the just-made login** (the person abandoned the
  connection); a renewal of an existing account skips the folder step.
- **One login attempt per daemon** (per person), as for Claude login; a second browser session
  gets `attempt_active` while another session's attempt is live.
- **An unreadable tool inventory** makes the list answer 503 and leaves the skill and that
  provider's sync clients as they were.
- **Settings shell on a phone**: a section opened alone keeps the page's `h1` for assistive tech
  (visually hidden). This touches every section, not only Integraatiot.
- **Provider marks** use new tokens `--ah-source-1..3` aliased to the syntax hues, as the round
  proposed; a designer palette can replace them.
- **Personal-data skill in English** (agents read it), with the page in Finnish.
