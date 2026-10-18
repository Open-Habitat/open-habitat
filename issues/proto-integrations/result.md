# Result: integrations prototype round

**Prototype:** https://glasspad.example.test/p/gdn2as4cyhiyq33z6tcvz4xfry/

Round directory `design-system/prototypes/rounds/2026-10-18-integraatiot/`; build with
`node build.mjs rounds/2026-10-18-integraatiot` in `design-system/prototypes/`. Picker keys
1–3. The ADR (`adr-integrations`) had not landed on main, so the round follows the two
research reports and the epic's decisions of 2026-10-18.

## Feasibility

Everything below ran on this host (Linux, as `jari`) in one disposable home made with
`mktemp -d /var/tmp/oh-integ-feas.XXXX`, with `env -i HOME=$H …` so that no real
configuration, keyring or token was visible. No real Google, Microsoft or Dropbox account
was used. The OAuth clients were dummies (`000000000000-ohfeasibilitydummy…`), so each flow
was driven up to the provider's token exchange, where it fails with "client not found".
The real-account steps are listed as gaps.

**Answer: yes for every tool, but the route differs per tool.** gog and onedrive have a
genuinely non-interactive two-step login. rclone and gws need the daemon to forward the
pasted redirect to a loopback TCP listener. ms-365-mcp-server and onedrive need nothing
returned at all, because they use a device code.

### gog v0.39.1 (Gmail, Calendar; Drive possible)

```
G="env -i HOME=$H PATH=/usr/bin:/bin GOG_HOME=$H/.gog GOG_KEYRING_BACKEND=file GOG_KEYRING_PASSWORD= gog"
$G auth credentials set $H/client.json                  # operator's client, per user
$G auth add a@example.com --services gmail,calendar,drive --remote --step 1 --json
#  → {"auth_url": "https://accounts.google.com/o/oauth2/auth?…&code_challenge=…&code_challenge_method=S256
#      &redirect_uri=http%3A%2F%2F127.0.0.1%3A46399%2Foauth2%2Fcallback&…&state=…"}  and exits
$G auth add a@example.com --services gmail,calendar,drive --remote --step 2 \
   --auth-url "http://127.0.0.1:46399/oauth2/callback?state=<state>&code=<code>" --json
#  wrong state → "manual auth state missing; start a new manual flow"
#  right state → reaches Google: oauth2: "invalid_client" "The OAuth client was not found."
```

- This is the cleanest of all the flows. Step 1 is a process that exits and leaves its
  state in `~/.gog/config/oauth-manual-state-<state>.json`. It uses PKCE, and nothing
  listens on the redirect port, so the redirect URL is only a carrier. The daemon runs
  step 1, the browser opens `auth_url`, the person pastes the dead `127.0.0.1` URL back,
  and the daemon runs step 2.
- **Keyring:** on a headless Linux user only the `file` backend works, and it asks for a
  password on a TTY. With `GOG_KEYRING_PASSWORD=` (empty) it works non-interactively.
  Every later `gog` call by an agent needs the same variable, so the password protects
  nothing beyond the home's Unix permissions. This is the same situation as Softeria's
  `.cache-key`. The catalog should set an empty password, or set the same variable in the
  skill.
- **One Google consent for Drive and mail:** `gog auth tokens export <email> --out f` writes
  the refresh token, and `rclone config create gdrive drive client_id=… client_secret=…
  config_is_local=false config_token='{"access_token":…,"refresh_token":…,"expiry":…}'
  --non-interactive` accepts a token without prompting (verified with a fake token; it
  wrote the remote and moved to the next question, `config_change_team_drive`). So the
  daemon can hand gog's token to rclone when both use the same operator client. Whether a
  real token with gog's scopes works in rclone was not tested.
- `--readonly`, `--gmail-no-send` and `--enable-commands` exist if Jari ever wants
  narrower defaults than read-write.

### gws 0.22.5 (`npx @googleworkspace/cli`)

```
env -i HOME=$H … GOOGLE_WORKSPACE_CLI_CLIENT_ID=… GOOGLE_WORKSPACE_CLI_CLIENT_SECRET=… \
   GOOGLE_WORKSPACE_CLI_KEYRING_BACKEND=file npx -y @googleworkspace/cli auth login -s gmail </dev/null
#  prints "Open this URL…: https://accounts.google.com/o/oauth2/auth?…&redirect_uri=http://localhost:45731&…"
#  and listens on 127.0.0.1:45731 (random port)
curl "http://localhost:45731/?code=4/0Afake&scope=gmail"
#  → "Success" page; gws → "OAuth flow failed: Server error: invalid_client"
```

- gws has no paste-back. Its URL has **no `state` and no PKCE**, and its listener took a
  forged code from any local process. A daemon could forward the pasted redirect to it,
  but another local user could inject a code during the window. It also wrote the client
  secret to `~/.config/gws/client_secret.json`. **Use gog, not gws.**

### rclone v1.60.1 (Drive, Dropbox)

```
R="env -i HOME=$H PATH=/usr/bin:/bin RCLONE_CONFIG=$H/.config/rclone/rclone.conf rclone"
$R authorize drive <client_id> <client_secret> --auth-no-open-browser </dev/null &
#  prints "Please go to the following link: http://127.0.0.1:53682/auth?state=<s>"
curl -s -o /dev/null -w '%{redirect_url}' "http://127.0.0.1:53682/auth?state=<s>"
#  → https://accounts.google.com/o/oauth2/auth?…redirect_uri=http%3A%2F%2F127.0.0.1%3A53682%2F…&state=<s>
curl "http://127.0.0.1:53682/?state=<s>&code=4/0Afake"   # → "Success!" page
#  rclone → Fatal error: failed to get token: oauth2: "invalid_client"
# Dropbox: same with `authorize dropbox`; redirect_uri http://localhost:53682/, scopes
#  files.metadata.write files.content.write files.content.read sharing.write account_info.read
```

- This works with the daemon in the middle. The daemon fetches the provider URL from
  rclone's `/auth` so the browser never needs `127.0.0.1`, the person pastes the dead
  redirect back, and the daemon forwards it to rclone's listener. rclone prints the token
  JSON, and `config create … config_token=…` writes the remote.
- **Fixed TCP port 53682 on loopback.** A wrong `state` from any local user **ends the
  login** ("Auth state doesn't match", fatal), so another user can cancel your login, but
  cannot complete it with their code. If the port is already taken, rclone fails closed
  ("bind: address already in use"), so a squatter cannot receive a forwarded code as long
  as the daemon forwards only to the rclone process it started. Two people logging in to
  rclone at the same moment collide, and the second gets an error. rclone's Drive flow has
  no PKCE. For Drive the gog token handoff above avoids the listener entirely, so it is
  the better route. Dropbox has no gog equivalent and keeps this route.
- `rclone config create … --non-interactive` with `config_is_local=false` returns a JSON
  state machine that asks for `config_token` from `rclone authorize` elsewhere, so it
  gives no way around the listener.
- This host has rclone 1.60.1-DEV (2022). The test server's version was not checked.

### abraunegg onedrive v2.5.11 (container `docker.io/driveone/onedrive:edge`, not installed here)

```
OD="podman run --rm -v $C:/conf:Z --entrypoint /usr/local/bin/onedrive docker.io/driveone/onedrive:edge --confdir /conf --syncdir /conf/sync"
$OD --sync --auth-files /conf/authUrl:/conf/responseUrl
#  writes authUrl: https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=…
#     &scope=Files.ReadWrite%20Files.ReadWrite.All%20Sites.ReadWrite.All%20offline_access
#     &response_type=code&prompt=login&redirect_uri=https://login.microsoftonline.com/common/oauth2/nativeclient
#  waits; after responseUrl is written → AADSTS70000 (fake code reached Microsoft)
printf 'use_device_auth = "true"\n' > $C/config; $OD --sync
#  → "Please authorise this application by visiting the following URL: https://login.microsoft.com/device
#     Enter the following code when prompted: XXXXXXXXX  This code expires at: …  [14m 59s remaining] Still pending…"
printf 'azure_tenant_id = "contoso.onmicrosoft.com"\n' > $C/config; $OD --display-admin-consent-url
#  → https://login.microsoftonline.com/contoso.onmicrosoft.com/v2.0/adminconsent?client_id=…&scope=…
#    "Nothing from this process needs to be pasted back"
```

- **Both a file-based paste-back (`--auth-files`) and device code work non-interactively.**
  Device code matches Softeria, so Microsoft has one login style in the UI. The
  admin-consent URL comes from the tool itself, so the page can show it as is.
  `--display-quota` and `--display-sync-status` exist for live status, but they need a real
  login and were not run.
- While waiting for the device code, the process ignored SIGTERM inside the container and
  podman fell back to SIGKILL after 2 s. Whether this is onedrive or PID 1 in the container
  was not separated. The daemon's cancel should escalate to SIGKILL.
- The auth-files URL has no `state` or PKCE. That does not matter for device code.

### Softeria ms-365-mcp-server 0.170.1 (Outlook mail and calendar)

```
M="env -i HOME=$H PATH=… npm_config_cache=$H/.npm"
$M npx -y @softeria/ms-365-mcp-server@0.170.1 --login --org-mode </dev/null
#  → "To sign in, use a web browser to open the page https://login.microsoft.com/device and enter the code XXXXXXXX"
$M MS365_MCP_CLIENT_ID=00000000-0000-0000-0000-00000000feas … --login --org-mode
#  → post_request_failed: invalid_grant   (so the env client ID replaced the default)
pi mcp add microsoft365 --env MS365_MCP_CLIENT_ID=… --env MS365_MCP_TENANT_ID=organizations \
   -- <wrapper> --org-mode --preset mail,calendar --allowed-scopes "Mail.ReadWrite Mail.Send Calendars.ReadWrite MailboxSettings.Read User.Read"
pi mcp list --json      # → state "connected", 82 tools; the wrapper saw both MS365_MCP_* variables
… --verify-login --org-mode   # → {"success":false,"message":"Login failed: No valid token found"}
pi mcp remove microsoft365    # → mcp.json back to {"mcpServers": {}}
```

- This closes the Microsoft report's open question: **`env` in Pi's `mcp.json` reaches the
  server**, verified with an env-dump wrapper launched by `pi mcp list`.
- Killing the `--login` process cancels it. `--verify-login` gives JSON for the live status
  line.
- **`pi mcp add/remove/list` is the native way for the daemon to write, remove and check
  the MCP entry**, so the catalog does not need to edit `mcp.json` itself. `pi mcp list`
  reports "connected" before sign-in, so the signed-in status has to come from
  `--verify-login`.

### Gaps (need a real account or tenant)

- Completing any token exchange, and therefore real refresh-token lifetimes, including
  Google's 7-day expiry in Testing mode.
- Whether gog's refresh token, exported into rclone, serves Drive.
- Admin consent and device-code blocking in a real work tenant, and whether one Entra
  registration serves both onedrive (`application_id`) and Softeria.
- Live status from `rclone about`, `onedrive --display-quota` and
  `--display-sync-status`, and gog's `auth list --check`, against real accounts.
- Dropbox's own daemon was not tried, since the catalog uses rclone.

Cleanup: the disposable home, the podman image and the temporary `web/node_modules` link
were removed. Device codes requested from Microsoft simply expired.

## Axis and directions

**Axis: what one connection is.** The content is the same in all three directions:
Google (Drive sync, Gmail, Calendar, one operator application), Microsoft 365 (OneDrive
and SharePoint sync, Outlook mail and calendar, device code, admin consent, blocked device
code) and Dropbox. Each direction has the paste-back login with its wrong-address and
expiry errors, live status checked from the tool with an expired-login state and
re-login, first sync with progress, folder choice against the home quota (Dropbox's
`Kuvat` does not fit), the agent warning, and removal with "keep or delete the folder".
The settings shell is production's, with a new section **Integraatiot** after Yhteydet.

| # | Direction | Unit | Where the login happens | When it wins | Cost |
|---|---|---|---|---|---|
| 1 | **Tili** | Provider account: "Google · jari.koti@…" with its services inside; add, re-login and remove the whole account | Modal dialog with a stepper (Microsoft shows its two codes as steps 1 and 3) | Matches how people think ("connect my Google"); one Google consent for everything | Hides that Microsoft is two tools and two codes until you are in the flow; to remove only Gmail you remove the account and add it back |
| 2 | **Palvelu** | One service per row, grouped by provider; each is connected, checked and removed alone | Inline under the row | Most honest to the catalog (one entry, one tool); fine-grained removal | Six rows and more decisions; a Google user signs in twice (Drive and gog) |
| 3 | **Mitä agentti saa** | What lands where: folders in the home beside a quota bar, and mail/calendar as tools with the verbs the agent can do | Right-hand side sheet | Puts quota and agent capability in front, which are the two things that actually bite | Splits one provider across two places; the provider account is secondary |

What each decides, for implementation:

- **Tili** commits the daemon to one consent per provider where tools allow it (the gog →
  rclone token handoff) and to a removal unit of "account".
- **Palvelu** keeps one catalog entry per tool. It needs no token sharing, and removal is
  per entry.
- **Mitä agentti saa** makes the folder (a `dir` under the home) and the quota the primary
  objects, and so leans on `PersonalStorage` (Tallennustila) data on the same page.

## Host facts the views assume

- Every status comes live from the tool as the user (`gog auth list --check`,
  `rclone about`, `onedrive --display-sync-status/--display-quota`,
  `ms-365-mcp-server --verify-login`). Nothing about connections is stored by the host.
  The "Tarkistettu klo" line is the time of that call.
- The daemon runs the login process, shows the URL or code, receives the pasted redirect
  (gog step 2, or a forward to rclone's listener) and cancels by killing the process. Paste
  validity is checked by prefix (`http://127.0.0.1` or `http://localhost:53682`) before the
  tool sees it. The tool itself checks `state`.
- Login lifetimes: gog manual flow 5 min (its default `--timeout`); device code 15 min (as
  printed by onedrive).
- Folder sizes before sync come from the provider (rclone `size`/`about`, Graph drive
  quota), and the free space from the home quota (ADR 0012). The view refuses a selection
  that does not fit, and does not over-commit.
- Removal deletes the tool's token and config entry, the skill and `mcp.json` entry, and
  stops sync. The synced folder stays unless the person ticks "Poista myös kansio". The
  provider-side grant is not revoked, and the dialog says so.
- The admin-consent link is the one onedrive prints (`--display-admin-consent-url`). It is
  shown as text to send, never as something the person can complete themselves.
- "Uudet keskustelut näkevät liitoksen heti" assumes Pi reads `~/.agents/skills` and
  `mcp.json` at session start, as the Microsoft report found. Running sessions need
  `/reload`, which the view does not mention.

Round-local choices proposed for the library if a direction is picked: provider marks use
`--ah-syntax-title/-string/-keyword` as stand-ins for a missing source palette (propose
`--ah-source-1..3`). There is no warning tone token, so the agent warning uses `--ah-err`
on `--ah-sunken`. As in the devices round, dialogs attach to `body` and so render at page
width in the phone frame.

## Questions for Jari

1. **Which unit — Tili, Palvelu or Mitä agentti saa?** I recommend **Tili**, with direction
   3's quota bar and folder rows in the file part of the account card. People think "my
   Google, my work Microsoft", and Jari decided on one operator application per provider.
   Tili turns that into one consent for Google. Removing a single service stays possible
   through "Lisää palveluita" in reverse, which can be added if needed.
2. **The paste-back step.** Google and Dropbox end on a page that does not load, and the
   person copies its address back. That is the only route that keeps the redirect away
   from the gateway. The alternative is a redirect URI on the gateway's public address
   (gog supports `--redirect-uri https://host/oauth2/callback`; with PKCE the code is
   useless without the verifier in the person's own gog state). That is smoother but moves
   the code through the gateway, so it is an architecture change and the ADR's call. I
   recommend keeping paste-back for the first version and deciding the gateway redirect
   only if real users stumble on it.
3. **gog over gws for Google mail and calendar.** gws has no `state` or PKCE and accepts
   codes from any local user. I recommend gog, and the ADR should say so.
4. **Drive through gog's token handed to rclone (one consent), or a separate rclone
   login?** I recommend the handoff, provided a real-account test confirms it. It also
   avoids rclone's fixed port 53682 for Drive.
5. **Integraatiot as its own section, or inside Yhteydet** (which already holds GitHub,
   Pi and Claude sign-ins)? I recommend its own section: Yhteydet is the agents' own
   credentials, while Integraatiot is the person's data, and the warning belongs only on
   the latter.

## Jari's decision (2026-10-18)

- **Tili** ("ehdottomasti paras"); the flows are well thought out.
- The step list is laid out wrong: "Kirjaudu: OneDrive ja SharePoint", "Valitse kansiot: OneDrive ja SharePoint" and "Kirjaudu: Outlook-posti ja -kalenteri" render as 1 and 2 on the first row and 3 on the second. Each step gets its own row.
- **More than one account per provider**: once a Google account is connected, its section offers "Lisää toinen Google-tili", and the same for every provider.
- Open, raised by Jari: (a) how agents learn about the integrations (AGENTS.md or similar?) and (b) how directories are named with several accounts.
