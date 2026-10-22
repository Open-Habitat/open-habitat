# ADR 0029: One release-contained operator installs and maintains a declared site

**Status:** Accepted 2026-10-22 (Jari). Decision history in `issues/decide-installation-baseline`. The commands named here are work to implement, not commands in today's release.

## Problem

Two customer pilots need the same installable product, and later it may run on many independent servers. Today a release contains the binary, the web assets and neutral systemd templates. Everything else that makes a host multi-user safe comes from the maintainer's own test deployment: broker initialization, quota setup, boot ordering, per-user socket ACLs and the native runtimes. An operator who only has the release cannot install the product, and an agent that guesses the missing pieces from source produces an unsafe host. The assessment in `issues/prepare-independent-installation` found exactly this gap.

## Decision

**The supported host** is Ubuntu 24.04 LTS on amd64 with systemd, and a separately mounted `/home` filesystem with enforced user quotas. Jari chose the separate quota-enforced volume and the pinned runtime; the first implementation narrows the filesystem to ext4 with journaled quotas because that is the one configuration the operator can check and the test server has proven. Shared home mounts, other filesystems and migrations of existing accounts are not in the first supported path.

**The customer owns the machine**: OS installation and security updates, SSH, firewall, DNS, HTTPS ingress and certificates, OAuth registrations, secret delivery, the `/home` volume and maintenance windows. The product owns its own bytes, configuration, account pool, quota and boot policy, and activation. The product never formats a disk, creates a cloud volume or moves homes.

**Every runtime dependency is pinned in the release.** A release is one signed manifest naming the core archive and optional profile archives by digest: Node and Pi at the versions the daemon requires, git, gh, tmux, and the account, ACL and quota utilities, plus selectable profiles for the editor, provider integrations and a coding/workflow profile that makes Alder's agent tool set available on a customer machine. The exact package closure is resolved and recorded at release build time, never by a network solver at install time. The cost Jari accepted: a security fix to a pinned tool needs a new qualified release, and a customer security update that replaces a pinned package blocks convergence until a qualified lock covers it. The operator reports that drift; it never downgrades the customer's update.

**One product-owned operator in the release binary does installation and maintenance.** It is `open-habitat host` with subcommands for check, plan, prepare, apply and upgrade, reading one versioned declarative site file. The same release carries the policy, its parser and its tests, and root needs nothing beyond the verified binary to run it. Ansible, a `.deb` package and cloud-init were considered and remain useful as transports around this operator: a customer's Ansible controller or cloud-init can invoke it, and a package may wrap it later. None of them is the implementation, because the transactional rules (quota enforcement, ledger safety, adoption of the right bytes by every component) need one implementation that is tested against the real broker, and a configuration-management tool's check mode cannot prove them. Hundreds of hosts need no product fleet service: each host keeps its site file and its own operation receipt, and the customer's controller handles inventory and scheduling.

**The site file is desired state for the sets the product manages**: admission, administrators, selected profiles, default quota and the gateway identity. Secrets are referenced as protected files, never written into the site file, plans or receipts. Everything that belongs to a person, such as workspaces, bindings, native credentials and per-user quota overrides, is observed, never declared or reset. Identity-bearing choices, the UID pool, gateway IDs and the home volume, are fixed at initialization; changing them is a migration, not convergence.

**Reading and mutating are separate operations.** Check and plan are read-only and run without side effects; every mutation has a dry run. Prepare, apply and upgrade are explicit maintenance operations that take the approved plan and, where they interrupt people, explicit approval for that. A boot of the host verifies the home mount and quota enforcement before any broker or user socket starts, so a missing volume can never fall through to root-filesystem homes.

**No authority moves.** The gateway still only authenticates and maps identity and gets no installer API. The daemon acts only as its own UID. The broker alone creates identities and publishes bindings; the operator may initialize an empty broker but never edits committed bindings. The operator runs as root only during deliberate maintenance; it is not a privileged service and does not listen on the network.

**A failed upgrade is fixed forward.** Staging can fail before activation and leave the predecessor serving. Once services stop and the generation switch begins, a failure leaves the host in closed maintenance with inspectable evidence, and the supported recovery is to diagnose and rerun the same qualified target. The product does not switch binaries back or restore data automatically, because a restored broker ledger would reassign identities. Jari accepted this trade of availability for identity safety for the pilots.

**Agents operate the host through this contract, not in place of it.** Every command has machine-readable output and typed failures, so a maintenance agent can read a plan, apply it and classify the result. Release verification, input validation, profile resolution, quota and permission enforcement, resumability decisions and result classification are deterministic code. An LLM may explain a blocked plan or propose a site change; its output is never executed as part of apply and never counts as approval.

## Delivery

The four delivery issues carry the design detail (schema fields and ranges, command contracts and exit codes, the release layout, the operation journal and recovery rules):

| Issue | Scope |
|---|---|
| `deliver-install-initialization` | Site file, check/plan/apply, crash-safe broker initialization, idempotent convergence |
| `deliver-install-host-preparation` | ext4 `/home` and quota baseline, explicit prepare, fail-closed boot gates |
| `deliver-install-runtime-profile` | Signed manifest, pinned closure, profiles, operator guide |
| `deliver-independent-upgrade` | Named-release upgrade, quiescence, adoption checks, fix-forward recovery |

The installer CLI follows the AI-first CLI canon and is tracked in `CONFORMANCE.md` (Jari, 2026-10-22). Before a pilot is offered as a supported host, the independent-installation experiment installs it from shipped materials alone on a fresh VM and upgrades it to a second named release.
