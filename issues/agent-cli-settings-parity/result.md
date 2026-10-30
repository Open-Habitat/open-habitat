# Result

An agent can now connect, re-token, check, repair and disconnect a Gitea or
GitLab account without the token appearing anywhere:

    some-command-that-prints-the-token | open-habitat agent code-host create \
      --provider gitea --base-url https://git.example.test --secret-file - --json
    open-habitat agent code-host update --connection gitea_… --secret-file - --json
    open-habitat agent code-host check|repair|delete --connection gitea_… --json

The connection ID comes from `agent integration list` (`gitea.connections[].id`,
`gitlab.connections[].id`) and names its provider. The same pattern now covers
the dictation key (`agent speech-key show|update|delete`) and the recap
settings (`agent recap-settings show|update`).

## How it reuses the browser's path

No new store, validation or authority. The agent listener (own UID only,
kernel peer check, entry fence) gains routes that are served by the
browser's own daemon handlers:

- `/agent/v1/integrations/gitea|gitlab` → `Catalog.giteaRequest` /
  `gitlabRequest`, the handlers behind `/settings/code-hosts`. Same request
  shapes, same server checks (token, account, scope, push), same tea/glab file
  writes, same Git helper registration, and the same `giteaWrite`/`gitlabWrite`
  try-lock, so a browser and an agent write cannot interleave.
- `/agent/v1/speech/key` → `Speech.keyHandlerAt`, the same `Speech` instance as
  the browser route (its file lock and Soniox rate limit are shared). The
  dictation session mint (temporary Soniox key) is not routed to the agent.
- `/agent/v1/settings/recap` → `recapSettingsHandlerAt`, writing Pi's
  settings.json through the pinned SDK exactly as the browser does.

The CLI reads the token or key only from `--secret-file FILE|-` (a regular
own-UID 0600 file, not a symlink, or redirected stdin, never a terminal),
bounded, with at most one line ending removed, and refuses anything else
without echoing it. Replies are the daemon's redacted replies: connection id,
server, account, `api`, `push`; key presence, region, source and last four
characters. Daemon logs record action and outcome only.

The agent runs as the person, who could already write tea's file. So this
gives the agent no new authority. What it does give is one checked path
instead of hand-editing that file.

## Every browser setting and its agent command

| Settings section (row) | Agent path | Notes |
|---|---|---|
| Tili › Profiili ja uloskirjautuminen | none, by design | Gateway session; the agent listener has no session operations. |
| Tili › Git-identiteetti | native `git config --global user.name/user.email` | Skill already says so; the daemon handler only wraps git. |
| Tili › Jaetut linkit | none, by design | Rule: the agent never gains a link operation. |
| Laitteet › Kirjaudu puhelimella, Kirjautuneet laitteet | none, by design | Device links and sessions are gateway authority. |
| Avaimet › Tilin julkiset avaimet | native `ssh-keygen` / `age-keygen` | Skill covers making and showing public halves. |
| Tekoäly › Oletusmalli | `agent model list/update` | Existing. |
| Tekoäly › Agentin työ | none, browser-local | Show-thinking/tools default is the browser's localStorage, not the person's account. |
| Tekoäly › ChatGPT-tilaus | `agent pi-login create/show/delete` | Existing; the person gives consent in the browser. |
| Tekoäly › Claude-tilaus | `agent claude-login …` | Existing. |
| Tekoäly › API-avaimet | `agent credential list/update/delete` | Existing. |
| Tilannekatsaus (all rows) | **`agent recap-settings show/update`** | New. |
| Sanelu › Saneluavain | **`agent speech-key show/update/delete`** | New. |
| Koodipalvelut › GitHub | none, by design | Sign-in and reconnect are the gateway's OAuth; give `<origin>/auth/github/start`. Native `gh` works for everything else. |
| Koodipalvelut › Gitea | **`agent code-host … --provider gitea`** | New. |
| Koodipalvelut › GitLab | **`agent code-host … --provider gitlab`** | New. |
| Koodipalvelut › Tuodut työtilat | `agent workspace list` + native `git remote -v` | Read-only view in the browser. |
| Tiedot › Google, Microsoft, Dropbox | `agent integration-login …` | Existing (OAuth URL/device code for the person). |
| Tiedot › Apple, IMAP, CalDAV, CardDAV | `agent integration-account …` | Existing. |
| Omat koneet › Tailscale, Koneet | none yet | Larger gap, see proposals. |
| Ulkoasu › Teema | none, browser-local | Per-browser setting. |
| Editori | none yet | Simple, see proposals. |
| Tila › Käyttö | `agent environment show` (`quota`) | Existing. |
| Tila › Roskakori | `agent trash list/show/restore/delete` | Existing. |
| Kokeelliset | none yet | Simple, see proposals. |
| Palvelin, Palvelinintegraatiot, AI-avain, Saneluavain (site), Käyttöönotto, Käyttäjät, Levy | none, by design | Administration; the agent listener has none. Operators use `open-habitat admin …` as root. |

## Proposals (not done here)

- **Editor and experimental features** (`/api/v1/account/preferences`): a
  `agent preferences show/update` would be simple, but the reply carries
  `web_identity_id`, the browser's opaque per-identity key, which the agent
  has no use for. A clean version needs an agent-side projection without it.
  The value is low: these change what the person's browser shows, not what
  the agent can do.
- **Omat koneet**: connecting Tailscale needs the person's interactive tailnet
  sign-in, and saving a machine pins a host key only after *the person*
  compared it. An agent `own-machine list` (read-only) is easy and would let
  the agent find machines it can `ssh` to. Writes need a product decision on
  how the person confirms the host key outside the browser.
- **GitHub reconnect** stays a browser action by design (gateway OAuth).

## Decisions for later review

- **Noun `code-host`, not `gitea-token`**: GitLab's handler has the identical
  shape, and the browser groups both under Koodipalvelut. One noun with
  `--provider gitea|gitlab` on create covers both. Alternative: separate
  `gitea`/`gitlab` nouns. Those would collide with the existing top-level
  `gitea git-credential` helper.
- **Provider from the connection ID** on update/check/repair/delete
  (`gitea_…`/`gitlab_…`), with no `--provider` flag, so the two can never
  disagree. Alternative: require both and check that they match.
- **`check` and `repair` are verbs of their own**, matching the daemon actions.
  `check` writes nothing but asks the server, so it is not `show`.
- **No `code-host list`**: `integration list` already returns both connection
  lists with ids, server, user, kind and git state. A second view of the same
  read would be one more thing to keep in sync.
- **Token bound 1024 bytes**: printable ASCII, no whitespace, which is
  `nativeforge.ValidToken`. The CLI refuses a bad token before contacting the
  daemon, and the daemon checks it again.
- **Speech key and recap settings added in this issue**: both are
  path-parametrised versions of the browser handlers with no new state. The
  dictation session mint is deliberately excluded: it exists only to let the
  browser stream audio.
- **An agent-side absent adapter** answers `409 provider_unavailable` rather
  than the browser route's `400 invalid_request`, so the CLI says what is wrong.

## Checks

- `go test` for `./internal/cli`, `./internal/daemon/integrations` and
  `./internal/daemon` (focused script): pass.
- New tests: `TestCodeHostProtectedToken` and `TestSettingCommands` (parser,
  leak and dry-run checks); `TestAgentGiteaConnectionIsTheBrowsers` (the agent
  path connects, checks, re-tokens, repairs and disconnects against the fake
  Gitea, and the browser path sees the same tea entry);
  `TestAgentSpeechKeyIsTheBrowsers`.
- `project-canon review --profile cli --run` (0.9.4) on the built binary in a
  networkless container with a fictional user. It reported only the
  inherited advisory rows already described in CONFORMANCE.md.
- Contracts are untouched (the agent routes are not part of the browser
  contract). No web change.
