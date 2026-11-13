---
title: Security model
description: What separates people on an Open Habitat server, and what does not.
---

Open Habitat's security boundary is the ordinary Unix user. Each person who
signs in gets their own Linux account, home directory, credentials and agent
daemon. Anything that would let one person reach another's home, credentials
or agents is treated as a product defect.

## Three components with separate authority

| Component | What it may do |
| --- | --- |
| **gateway** | Authenticates the browser with GitHub and maps the person to their Unix user. Nobody picks a Unix account in the browser. |
| **daemon** | Runs as that person and runs their agents and tools. It trusts no identity claim from the browser or the gateway: who it serves is decided by which Unix user it runs as. |
| **root broker** | Small, and only creates the account on a person's first approved sign-in. |

Kept apart, a bug in one of them does not have the reach of the others.

Content that a person controls, such as the editor, pages an agent publishes
and shared links, is served on its own hostname, apart from the application.
HTML or code inside a conversation does not run in the application's page.

## What it does not protect against

- **Your own agent.** An agent runs as its owner, with the owner's files and
  credentials. Unix accounts separate people from each other; they do not
  limit what your own agent can do in your own home.
- **The server's administrator.** Root is root: whoever administers the
  server can read every home on it, as on any Linux machine.
- **A shared disk.** Without per-user limits every home shares one
  filesystem, and one person or agent can fill it for everybody. The operator
  chooses the storage mode at installation.

## No account between you and your server

There is no Open Habitat account, relay or cloud service. The browser talks to
your server, and each person's model provider sign-in is their own, stored by
Pi in their Unix account.

## Reporting a vulnerability

Use GitHub's
[private vulnerability reporting](https://github.com/Open-Habitat/open-habitat/security/advisories/new),
not a public issue, so that people running a server can close the hole before
it is described to everyone.
