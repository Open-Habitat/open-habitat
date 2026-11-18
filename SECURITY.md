# Security Policy

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.** A public report describes the hole to
everyone before the people running a server can close it.

Report privately using **GitHub's [Private Vulnerability Reporting](https://github.com/Open-Habitat/open-habitat/security/advisories/new)**:
open the repository's **Security** tab → **Report a vulnerability**.

Include, as far as you can: the affected release or commit, the component
(gateway, daemon, broker, the operator commands, a runtime archive),
reproduction steps or a proof of concept, and the impact you observed.
Reproduce on a server of your own with made-up accounts. Do not send logs,
screenshots, hostnames or account names from an installation other people
use.

## What we care about most

Open Habitat puts several people on one Linux server and runs each person's
agents as that person's own Unix user. The security boundary is the Unix
user. The primary concern is anything that crosses it:

- one person reaching another person's home directory, credentials,
  conversations, agents or processes;
- a browser session being mapped to a Unix user it was not admitted as, or
  someone signing in who the administrator did not admit;
- the gateway, a person's daemon or the root broker being made to use
  another component's authority, including any path from a person's account
  to root;
- content that a person or an agent controls (the editor, published views,
  shared links) acting with the application's own origin or session;
- a release or runtime archive that installs something other than what its
  manifest pins.

The surfaces involved are the gateway's HTTPS listener and GitHub sign-in,
each person's daemon and its sockets, the root broker that creates accounts,
the `open-habitat host` commands an operator runs as root, the processes the
daemon starts for agents and tools, and the release packages published on
GitHub Releases.

## What is not a vulnerability here

These follow from the design, and a report about them will be closed with a
pointer to this section:

- **An agent acting with its owner's authority.** An agent runs as the
  person it works for and has that person's files and credentials. Unix
  accounts separate people from each other; they do not sandbox an agent
  from its owner. This includes prompt injection that makes an agent act
  within its own owner's account. Injection that crosses to another person
  is in scope.
- **The administrator's own power.** Root can read every home on the server,
  as on any Linux machine.
- **A shared disk without quotas.** An installation without per-user limits
  lets one person fill the disk for everybody; the operator chose that mode.
- **Misconfiguration outside the product:** the ingress, firewall, TLS
  termination, DNS, or the GitHub OAuth app and organisation settings.
- **Unsigned releases as such.** Releases are verified against the SHA-256
  digests GitHub states for their assets. A way to defeat that pin is in
  scope.

<!-- shipshape-security:supported-versions-start -->
## Supported Versions

Only the latest release is supported. The project is in pre-release, and
fixes ship in the next release; there are no backports.
<!-- shipshape-security:supported-versions-end -->

## What to Expect

The project has one maintainer, so there is no guaranteed response time.

- We will acknowledge your report as soon as we can.
- We will confirm the issue, tell you how serious we think it is, and keep
  you informed of progress.
- A fix ships in a new release. Please give us a reasonable window to
  release it before any public disclosure; we practice coordinated
  disclosure and will credit you unless you prefer to remain anonymous.

## Safe Harbor

We consider good-faith security research conducted under this policy to be
authorized. We will not pursue or support legal action against researchers
who act in good faith, avoid privacy violations and service disruption, and
give us a reasonable time to respond before disclosure.

This safe harbor covers only assets this project controls: its source code,
this repository, and the artifacts it publishes. It does not authorize
testing of other people's Open Habitat installations, of GitHub, or of other
third-party services, whose own policies continue to apply.
