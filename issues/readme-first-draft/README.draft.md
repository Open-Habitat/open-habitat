# Open Habitat

<!-- confirm: draft kept in issues/; at the repository root, turn `LICENSE`, `SECURITY.md` and `docs/operations.md` back into relative links and point the badge at LICENSE. -->

<!-- shipshape-readme:badges-start -->
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/license/mit)
<!-- shipshape-readme:badges-end -->

**Your team's AI agents on one Linux server, each person as their own Unix
user, reachable from any browser.**

[open-habitat.ai](https://open-habitat.ai)

Sign in from a laptop or phone, talk to your [Pi](https://github.com/earendil-works/pi)
agent, close the tab, and it keeps working. The conversation is Pi's own
session in your home directory, so the files, Git repositories and history
are the same ones you would find over SSH. Open Habitat adds a browser, not a
second place where your work lives.

<!-- confirm: 20–30 s GIF or screenshot: two people sign in to the same server, each sees only their own workspaces; one closes the tab, the agent keeps working, and the same session is opened again. -->

> **Status: pre-release.** Open Habitat runs multi-person pilot installations
> on named `v0.1.0-pilot` releases. Formats and interfaces still change
> between releases without migration code. Read [What it is not](#what-it-is-not)
> before you put people on it.

## What you get

- **One server, many people.** Each person who signs in with GitHub gets their
  own Linux account, home directory, credentials and agent daemon. The
  administrator decides who is admitted; nobody picks a Unix user in the
  browser.
- **Native tools keep the truth.** Pi stores its own history, `git` and `gh`
  keep their own logins, workspaces are ordinary directories under `~/src`.
  There is no workspace registry, no copied history and no vendor database.
- **Work that outlives the browser.** Agents run under the person's daemon on
  the server. Steer a running agent, queue the next message, answer its
  questions, or stop it, from a desktop or a phone.
- **The rest of the workbench.** A browser terminal, Git worktrees per agent,
  an optional VS Code editor (code-server) per person, and the person's own
  connections to GitHub, Gitea, GitLab, Google, Microsoft 365 and Dropbox.
- **Your own model account.** Each person connects their own provider login
  through Pi, for example a ChatGPT subscription.
  <!-- confirm: which provider sign-ins to list publicly (ChatGPT, Claude, API keys). -->
- **Nothing phones home.** Open Habitat sends no telemetry and has no relay or
  cloud account between your browser and your server.

The interface is in English and Finnish.

## How it compares

| | Open Habitat | [Orca](https://github.com/stablyai/orca) | [HumanLayer](https://github.com/humanlayer/humanlayer) | Pi web UIs ([PI WEB](https://github.com/jmfederico/pi-web), [Pi Web](https://github.com/agegr/pi-web)) | [JupyterHub](https://jupyter.org/hub) |
|---|---|---|---|---|---|
| Built for | several people on one shared server | one developer running many agents | teams, as a hosted service | one person | groups running notebooks |
| Separation between people | Unix accounts | none: every paired device is the same user | cloud organisation and task permissions | none (no sign-in) | Unix accounts or containers |
| Where history lives | the agent's native files | native files plus its own journal and scrollback | synced to the vendor's Postgres | native files plus the UI's own stores | notebooks on disk |
| Agents | Pi | 35+ CLI agents | Claude Code, Codex, OpenCode, Pi | Pi | (not an agent host) |
| Shape | browser, desktop and phone | desktop app, phone app, browser client | desktop, browser, phone over a cloud | browser | browser |

Orca is the better choice if you want many agents on your own machine and a
polished desktop app today. JupyterHub is the mature model for the same
"one server, a Unix user per person" idea; Open Habitat applies it to agents
instead of notebooks.

## What it is not

- **Not a sandbox between you and your agent.** An agent runs as its owner,
  with the owner's files and credentials. Unix accounts separate *people* from
  each other; they do not limit what your own agent can do to your own home.
- **Not a cluster.** One Linux server, Ubuntu 24.04 on amd64 or arm64.
- **Not multi-harness yet.** Pi is the agent the browser drives.
- **Not a hosted service.** You run the server; there is no Open Habitat
  account or cloud.
- **Root is root.** The server's administrator can read every home on it, as
  on any Linux machine.

## Security model

Three components hold separate authority. The **gateway** authenticates the
browser and maps the person to a Unix user. A **daemon** runs as each person
and trusts no identity claim from the browser or the gateway. A small **root broker** only creates the account on a person's first
approved sign-in. Code that a person controls (the editor, agent-rendered
pages, shared links) is served on its own hostname, separate from the app.

Report vulnerabilities privately; see `SECURITY.md`.
<!-- confirm: SECURITY.md does not exist yet (/shipshape-security-policy); enable GitHub Private Vulnerability Reporting before launch. -->

## Installation

<!-- shipshape-readme:install-start -->
Open Habitat ships as immutable [GitHub Releases](https://github.com/Open-Habitat/open-habitat/releases)
for **Linux amd64 and arm64** (Ubuntu 24.04 LTS, systemd). Each release has a
product package (`open-habitat-VERSION-linux-<arch>.tar.gz`) and a runtime
release (`release-linux-<arch>.json` plus its archives). No source checkout,
Go or npm is needed on the server.

You need a server you administer, a DNS name with HTTPS, and a GitHub OAuth
app for sign-in. The full guide, including storage choices and the GitHub app
settings, is `docs/operations.md`. In short:

1. Download the product package and runtime release for your architecture and
   check them against the SHA-256 digests GitHub shows for each asset.
2. Write `/etc/open-habitat/site.json` from the shipped `site/example.json`.
3. Prepare the host, then apply, approving each returned plan:

   ```sh
   ./bin/open-habitat host prepare --site /etc/open-habitat/site.json --dry-run --json
   ./bin/open-habitat host apply --site /etc/open-habitat/site.json --dry-run --json
   ```

4. Sign in with an admitted GitHub account and connect your model provider.

<!-- confirm: the installation path for someone outside the project is not finished. Today it assumes the maintainer's help; a ten-minute guide for a plain VPS (customer-install lane) should replace this section before launch. -->
<!-- shipshape-readme:install-end -->

## Contributing

<!-- confirm: CONTRIBUTING.md and how public GitHub issues relate to the internal tracker (/shipshape-contributing). -->

## License

<!-- shipshape-readme:license-start -->
Open Habitat is licensed under the MIT License (`LICENSE`).
<!-- confirm: LICENSE file not yet written; its copyright holder (Jari Mustonen or a company) is still open. -->
<!-- shipshape-readme:license-end -->
