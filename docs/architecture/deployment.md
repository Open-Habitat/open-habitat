# Deployment

An installation runs the host binary under separate Linux accounts: a gateway
for browser traffic, a root broker for account provisioning and a daemon for
each user. systemd manages their sockets and processes. The browser assets and
pinned Node and Pi runtime are installed alongside the host; users' work and
credentials stay outside these replaceable releases.

```mermaid
flowchart TB
  Browser["Browser"] -->|HTTPS| Gateway["Gateway service<br/>unprivileged account"]
  Operator["Root operator"] --> Revoke["Private control socket"] --> Gateway
  Gateway --> BrokerSocket["Broker socket"] --> Broker["Broker service<br/>root"]
  Gateway --> UserSocket["Per-user socket"] --> Daemon["Daemon service<br/>user's Unix account"]
  Daemon --> Pi["Pi child processes<br/>same account"]
  Daemon --> Home["User's home"]
  Pi --> Home
  Systemd["systemd"] -.-> Gateway
  Systemd -. "socket activation" .-> Broker
  Systemd -. "socket activation and process cleanup" .-> Daemon
```

## Processes and lifecycle

The gateway terminates TLS using its configured certificate and serves the
browser application. It runs without access to user homes. systemd supplies
its root-only revocation socket, through which the operator can end web
sessions with `open-habitat revoke subject <GitHub ID>`. The same socket
accepts root-only administration requests; the gateway remains the sole writer
of the name, browser roles and default storage limit. The broker alone changes
a bound user's Linux quota. It accepts a provider subject, resolves the
committed UID and never accepts a client-selected UID or home path.

The broker and per-user daemons are socket-activated: systemd holds the
listening sockets and starts a service when a connection arrives. The
installation supplies the service and socket templates. During provisioning,
the broker verifies them, prepares the user's socket directory and access
permissions, and starts that socket instance. It does not generate unit files.
The installation also restores the runtime directories and permissions after
reboot, since `/run` is temporary.

Closing a browser or restarting the gateway leaves daemon-owned Pi processes
running. Stopping or restarting a daemon ends its Pi processes: systemd first
signals the daemon and then kills any processes left in the service's control
group. Native history survives, but an active turn is interrupted.
[Conversations](conversations.md) explains how an ended conversation continues.

## Persistent data and configuration

User homes hold workspaces, Pi histories and native credentials. The root
broker keeps account bindings, admission policy and unfinished provisioning
work in protected state. The gateway keeps browser sessions, server name,
administrator roles and the default storage limit in its own private state.
These records and the user's work survive release replacement; `/run` and
in-memory login attempts do not. Native Linux quotas, not gateway accounting,
record each person's storage usage and limit.

The operator administers server settings and roles through the root-only CLI
and gateway control socket, not by editing gateway state. A role grant needs
an existing bound GitHub identity; it does not create or admit a user. Before
first sign-in the operator must set a nonzero default storage limit. The
broker applies it before publishing a new binding; a failure leaves no browser
route and requires reconciliation. The gateway asks the broker for each bound
user's quota when displaying administrator storage, and exposes only a person's
own usage to that person. Overcommitted limits are reported, not refused.
An unavailable bound user's quota currently makes the whole administrator
listing unavailable; the CLI's fixed request deadline also limits large lists.
[The follow-up](../../issues/admin-storage-list-timeout/item.md) tracks this
limitation.

An unreadable or incorrectly owned administration state prevents startup.
If established state disappears at runtime, administrator writes stop rather
than silently recreating old roles. Browser sessions are separate: losing
their private state invalidates them and requires sign-in again.

The gateway loads its installation configuration at startup; each daemon loads
the identity binding written by the broker. The broker reads its configuration
and state from its fixed root-owned directory. Identity and secret-bearing
configuration is protected by ownership and path checks, so an ordinary user
cannot redefine which account a service represents. The gateway and daemon
also check their configured identity against the Unix account running them.
[Identity and trust](identity-and-trust.md) describes these bindings and the
checks between processes.

Pi has a separate installation-wide selector naming its Node executable,
entry point and manifest. Each daemon reads it at startup and validates the
selected runtime. An invalid selector prevents the daemon from starting;
there is no fallback to a Pi executable from the user's search path.

## Release changes

The release contains the host binary, built browser assets and neutral service
templates. The operator installs and selects the release, supplies its
configuration and restarts affected services. A Pi update selects a new pinned
runtime and takes effect when daemons restart. User files and credentials
remain outside both releases.

Restarting the gateway preserves browser sessions when its private state is
available. Restarting daemons interrupts active Pi work, though native history
survives. A release switch must account for both effects, not just replace
files.

ADR 0003 defines an immutable release model with atomic selection and a
known-good predecessor for rollback. The project's disposable test installation
uses the later [test-server policy](../../AGENTS.md): failed upgrades may be
fixed forward or replaced with a fresh installation, without retaining older
releases. Fleetrepo owns that installation's upgrade procedure and deployment
receipts.

## Operator responsibilities and diagnostics

The operator supplies admission policy, service configuration, secrets,
TLS, ingress, runtime directories and quota enforcement for the filesystem
containing user homes. Quota accounting alone is insufficient; the broker
refuses to start without enforcement and valid limits for already bound users.
The product supplies neutral [`systemd/`](../../systemd/),
[`sysusers.d/`](../../sysusers.d/) and [`tmpfiles.d/`](../../tmpfiles.d/)
templates. Fleetrepo owns the concrete test installation.

At boot the broker restores committed users' daemon sockets, so existing
users can reconnect without signing in again. The broker serializes socket
starts with new logins and stops further starts if a submitted systemd job
has an uncertain outcome. Already-active sockets can still serve requests.
The release operator must avoid competing socket starts while restoration is
running; the broker's lock does not protect against another process starting
the same units.

The operator CLI exposes configuration inspection, diagnostics, revocation and
release provenance; `open-habitat --help` lists its commands. The current
`maintenance enter|leave` command only creates or removes a marker file.
The host services do not consult that marker, so the command alone does not
pause traffic or drain work.

`/healthz` confirms that a service responds. Gateway `/readyz` and
`admin readiness show` are still fixed foundation responses, not checks of
the installation or Pi model access.
Gateway, broker and daemon write classified JSONL diagnostics to stderr;
systemd collects them in each service's journal. Access to those journals,
retention and disk limits are installation policy. Records identify the
component, event, outcome and a fixed failure reason, not raw errors,
credentials, user content or command output. The gateway's OAuth attempt ID
is not passed through the broker and daemon, so their records cannot be
joined into a complete cross-service trace. Logging can fail; these are
operational observations, not an audit trail.

Decisions behind this page: ADR 0003, ADR 0004, ADR 0012.
