<h1 align="center">
  <img src="design-system/favicon.svg" alt="" width="48" valign="middle" /> Open Habitat
</h1>

<p align="center">
<!-- shipshape-readme:badges-start -->
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://github.com/Open-Habitat/open-habitat/releases"><img src="https://img.shields.io/github/v/release/Open-Habitat/open-habitat?include_prereleases&amp;label=release" alt="Latest release" /></a>
  <img src="https://img.shields.io/badge/server-Ubuntu%2024.04-E95420" alt="Server: Ubuntu 24.04" />
<!-- shipshape-readme:badges-end -->
</p>

<p align="center">
  <strong>Coding-grade AI agents for your whole team. No terminal required.</strong><br/>
  Open Habitat gives everyone on your team a real coding agent with its own Linux account, in a browser tab.<br/>
  One person sets up one server. Everyone else signs in and gets to work, with nothing to install.
</p>

<h3 align="center"><a href="#install"><ins>Install on your server</ins></a></h3>

## Why

The agents that programmers use are the most capable AI tools there are,
because they run on a real operating system. They have a shell, a
filesystem, Git and every command-line tool there is, and they add the ones
they are missing. That is what lets them finish work instead of describing
it: read a folder of spreadsheets, build the report, fix the website.

Almost nobody outside engineering gets to use one, because it starts with a
terminal. Open Habitat removes that step. The agent keeps its full Linux
account, and the person gets a browser interface that is simple and pleasant
to use.

**It is a starting point, and you are in control.** This is your Linux
server, not somebody's platform. The agents can write code, so whatever your
team needs next, they can build it right there: a script, a scheduled job,
an internal tool, a service of your own that every agent on the server can
use. Go wild with it. Your team still just opens a browser.

## Features

<table>
<tr>
<td width="50%" valign="top">

### A real agent, not a chatbot

Each person's agent works in their own Linux account on your server, with a
shell, files, Git and the command line. It does the work and shows you the
result.

</td>
<td width="50%" valign="top">

### Nothing to install

Open the address, sign in, and talk to your agent. It works the same on a
laptop and on a phone. No terminal, no SSH key, no setup on your own
computer.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### Close the tab, the work goes on

Agents run on the server, not in your browser. Come back later from any
device: the sidebar shows what is still running and what is waiting for your
answer.

</td>
<td width="50%" valign="top">

### Steer it while it works

Add an instruction in the middle of the work, queue the next message, answer
the agent's questions or stop it. You do not have to wait for it to finish
to change its direction.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### Workers, out of the box

The worker infrastructure is built in. Hand over a big task and the agent
splits it between workers, each in its own Git worktree, and brings their
results back. You follow every worker from the same sidebar.

</td>
<td width="50%" valign="top">

### Your mail, calendar and files

Connect Google, Microsoft 365, Dropbox or an ordinary mail account, and the
agent works with your own mail, calendars, contacts and documents.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### Results you can open

Agents hand back reports, charts and small web pages as views you open
beside the conversation, and files you download with one click.

</td>
<td width="50%" valign="top">

### Build your own on top

It is an ordinary Linux server that you run. Add your own tools and
services for the agents, or have the agents build them. Nothing about the
server is closed to you.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### Everyone has their own

Every person is a separate Linux user with their own files, credentials and
agents. The operating system keeps people apart, not rules inside a web app.

</td>
<td width="50%" valign="top">

### Bring your own AI subscription

Each person connects their own ChatGPT or Claude subscription or an API key,
or the server provides a key for everyone. Nobody shares a personal login.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### Nothing hidden from the technical

A browser terminal on the same tmux sessions, a VS Code editor running as
you, and plain SSH. A conversation is the agent's own session file in your
home directory, so the browser and the terminal show the same work.

</td>
<td width="50%"></td>
</tr>
</table>

**Also in the box:**

- **Dictation**: talk instead of typing.
- **Recaps**: a short summary of where a conversation stands, made when you
  ask or after the work has been quiet for a while.
- **GitHub, Gitea and GitLab**: clone repositories into workspaces and let
  the agent work with them as you.
- **Your own machines**: connect your own computers for the agent over
  Tailscale.
- **English and Finnish**, in light, dark and high-contrast themes.
- **Self-hosted**: there is no Open Habitat account, cloud or relay. The
  browser talks to your server.

The agent is [Pi](https://github.com/earendil-works/pi).
[Goal and user journeys](docs/product.md) describes everything the product
is meant to do.

---

## Install
<!-- shipshape-readme:install-start -->
Releases are on the
[GitHub Releases page](https://github.com/Open-Habitat/open-habitat/releases):
a product package and a runtime release for Linux x86_64 and Linux arm64.
<!-- shipshape-readme:install-end -->

Your team needs one person who administers a Linux server. That person
brings:

- a server: Ubuntu 24.04 LTS, amd64 or arm64;
- a DNS name and a TLS certificate for it;
- a GitHub OAuth app, because people sign in with GitHub;
- for each person an AI subscription or key of their own, or one key for the
  server.

Then, on the server:

1. Download a release and check it against the SHA-256 digests GitHub states.
2. Write one site file that says who may sign in and who administers.
3. Check, plan and apply:

   ```sh
   ./bin/open-habitat host check --site /etc/open-habitat/site.json
   ./bin/open-habitat host plan --site /etc/open-habitat/site.json --json
   ./bin/open-habitat host apply --site /etc/open-habitat/site.json --dry-run --json
   ```

4. Send your team the address.

This is a server installation, not a one-line script: the
**[operator guide](docs/operations.md)** has every step, including first-time
preparation, the storage choice you cannot change later, upgrades and
recovery.

---

## Good to know

> [!WARNING]
> Open Habitat is an early pre-release (0.1.x). It runs on real multi-person
> servers, but formats and interfaces still change between releases. Install
> a named release, and read its release notes before you upgrade.

- **One server, one agent.** Ubuntu 24.04 only, and browser conversations
  drive Pi. Other agents run in the terminal.
- **An agent acts as its owner.** Linux accounts separate people from each
  other. They do not sandbox an agent from the person it works for: it has
  that person's files and credentials.
- **Root is root.** Whoever administers the server can read every home on
  it, as on any Linux machine.

<details>
<summary><strong>How the separation works</strong></summary>

Three components hold separate authority, so that a bug in one does not have
the reach of the others. Anything that lets one person reach another's home,
credentials or agents is a product defect.

| Component | Runs as | What it may do |
| --- | --- | --- |
| gateway | its own service account | Authenticates the browser with GitHub and maps the person to their Linux user. |
| daemon | the person | Runs that person's agents and tools. It trusts no identity claim from the browser or the gateway: who it serves is decided by which user it runs as. |
| broker | root | Creates the account on a person's first admitted sign-in, and little else. |

</details>

---

## Community &amp; Support

- **Questions and ideas:** [Discussions](https://github.com/Open-Habitat/open-habitat/discussions).
- **Bugs:** [Issues](https://github.com/Open-Habitat/open-habitat/issues).
  Describe the steps that reproduce the problem; do not post logs,
  screenshots or names from a real installation.
- **Vulnerabilities:** GitHub's
  [private vulnerability reporting](https://github.com/Open-Habitat/open-habitat/security/advisories/new),
  never a public issue. [SECURITY.md](SECURITY.md) says what counts.
- **What changed:** [CHANGELOG.md](CHANGELOG.md).

## Developing

Bug fixes and documentation fixes are welcome as pull requests. A change to
architecture (which component holds which authority, the security model, the
browser/host contract in `contracts/v1/`, or a major dependency) starts as an
issue or a Discussion before code is written.
[CONTRIBUTING.md](CONTRIBUTING.md) has the details, [AGENTS.md](AGENTS.md)
holds the project's rules for people and agents alike, and
[TESTING.md](TESTING.md) says which checks prove what.

## License
<!-- shipshape-readme:license-start -->
Open Habitat is free and open source under the [MIT License](LICENSE).
<!-- shipshape-readme:license-end -->
