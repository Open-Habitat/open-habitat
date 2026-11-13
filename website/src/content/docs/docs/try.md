---
title: Try it
description: What an Open Habitat installation needs and how it goes today.
---

**Status: pre-release.** Open Habitat runs on multi-person installations, but
there is no public release yet. Formats and interfaces still change between
releases without migration code, and installing it still assumes some help
from the maintainers. A short path for a plain VPS is planned before the
public launch.

## What you need

- A Linux server you administer: Ubuntu 24.04 LTS with systemd, on amd64 or
  arm64, with `/home` on an ext4 filesystem.
- A DNS name for the server, HTTPS certificates and the ingress or firewall in
  front of it.
- A GitHub OAuth app for sign-in.
- For each person, their own model provider account (for example a ChatGPT or
  Claude subscription, or an API key), unless the server provides an AI key.

## How an installation goes

1. **Get a release.** A release is a GitHub Release with a product package
   and a runtime release for each architecture. You check the downloads
   against the SHA-256 digests GitHub states for them before anything runs
   as root. No source checkout, Go or npm is needed on the server.
2. **Choose the storage mode.** Either per-user limits on a separate ext4
   `/home` with quotas, or no limits, where everyone shares one disk. The
   choice is part of the installation and cannot be changed later.
3. **Write one site file.** `/etc/open-habitat/site.json` declares the home
   filesystem, the account ranges, who may sign in and who administers, the
   storage mode and the runtime to install. Secrets stay in separate
   protected files.
4. **Check, plan and apply.** The `open-habitat host` commands check the
   server, return a plan, and apply exactly the plan you approved:

   ```sh
   ./bin/open-habitat host check --site /etc/open-habitat/site.json
   ./bin/open-habitat host plan  --site /etc/open-habitat/site.json --json
   ./bin/open-habitat host apply --site /etc/open-habitat/site.json \
     --approved-plan <apply-plan-id> --output=jsonl
   ```

   A first installation also runs `host prepare`, a separate maintenance
   step that the operator guide describes.

5. **Sign in.** The first admitted person signs in with GitHub. The broker
   creates their Unix account, and getting started walks them through
   repositories and their AI account.

The [operator guide](/docs/operations/) has every step, including preparation,
upgrades, integrations and recovery.
