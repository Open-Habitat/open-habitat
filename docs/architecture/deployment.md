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

User homes hold workspaces, Pi histories and configuration, and native `gh`
credentials. Root-owned broker state holds admission policy, account bindings
and the journal of provisioning operations. These survive service restarts and
release replacement. Gateway-private state at `/var/lib/open-habitat-gateway/sessions.json` holds browser sessions and survives release replacement and reboot. The same private StateDirectory also holds `administration.json`, the gateway-owned server name, numeric GitHub subject roles and default quota for new accounts. Native Linux quota state is the only record of each person's usage and limit. Keep it across release replacements; do not seed a browser administrator. A missing file at startup starts with no name or administrators; an existing corrupt or incorrectly owned file prevents gateway startup until an operator repairs it. If an established file disappears while the gateway is running, administrator permissions fail closed and writes stop until operator repair or restart; it cannot silently re-create the old roles. The root-only `revoke.sock` control channel also carries bounded administration requests from a kernel-verified root peer. Use the operator CLI, not a direct edit to the state file:

```sh
open-habitat admin settings show --json
open-habitat admin users list --json
open-habitat admin settings update --name 'Example host' --json
open-habitat admin settings update --default-limit-bytes 10737418240 --json
open-habitat admin storage list --json
open-habitat admin storage update <numeric-GitHub-subject> --limit-bytes 21474836480 --json
open-habitat admin role update <numeric-GitHub-subject> --administrator true --json
open-habitat admin role update <numeric-GitHub-subject> --administrator false --json
```

The installation must configure a nonzero default (the command above is an example,
not a product fixed size) before the first sign-in; login fails closed otherwise.
The broker applies that limit in the journaled account-creation flow before
publishing a binding. A failed quota setup leaves the journal for operator
reconciliation and no browser route. The first grant needs the person's existing broker binding (they must have signed in first); `admin users list` gives bound subjects and Unix names without credentials or home paths. A grant does not create a binding or admit an account. Removal needs no live broker binding. Updates also accept `--dry-run`; a grant plan checks the current bound-user list but cannot reserve the binding against concurrent change. The CLI requires effective root and a running gateway with the private socket. It reports structured results and errors with `--json` and does not use browser administrator roles. The gateway account alone reads `administration.json`; sockets and pending login flows in `/run` or memory do not persist. The administrator page and CLI read each bound user's kernel quota and the home's filesystem capacity/free space from the broker. Overcommit (sum of hard limits greater than filesystem capacity) is visible but permitted; lowering a limit below usage is permitted and prevents further growth. Each signed-in person sees only their own usage and limit. The gateway is sandboxed away from `/home` and never estimates quota usage from user files.

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

Restarting the gateway preserves browser sessions when its private state remains available. The installation must apply the gateway StateDirectory unit change before the upgrade starts the new binary; the directory must not be removed when replacing a release. Restarting daemons also
interrupts active Pi work, so replacing release files alone does not describe
the effect of an upgrade on users.

ADR 0003 defines an immutable release model with atomic selection and a
known-good predecessor for rollback. The project's disposable test installation
uses the later [test-server policy](../../AGENTS.md): failed upgrades may be
fixed forward or replaced with a fresh installation, without retaining older
releases. Fleetrepo owns that installation's upgrade procedure and deployment
receipts.

## Operator responsibilities and diagnostics

The operator supplies admission policy, service configuration, secrets, TLS,
DNS and ingress, as well as the Linux accounts and runtime-directory setup
needed before provisioning can run. The filesystem holding `/home` must have
active and enforced Linux user quotas; the ext4 journaled quota feature on
the test VM starts accounting but also needs quota enforcement activated on
each boot before deployment. The broker rejects accounting-only filesystems. Before switching an installation with
existing bound users, the operator sets and verifies a native hard limit for
each committed UID; the new broker refuses startup otherwise. Authorization
also refuses existing routes if accounting is lost. Per-user `~/src` images
are not part of this deployment. The product supplies neutral templates in
[`systemd/`](../../systemd/), [`sysusers.d/`](../../sysusers.d/) and
[`tmpfiles.d/`](../../tmpfiles.d/). Their directives and the implementation in
`internal/provision` define the detailed installation requirements. Enable both
`open-habitat-broker.socket` and `open-habitat-broker.service` at boot, after
Fleetrepo has prepared the broker state, socket directory and quota enforcement.
Socket activation alone does not run the broker until a new connection arrives;
the broker service restores committed users' daemon sockets during startup via
the JIT policy gate. The broker keeps serving during restoration and starts
sockets one at a time because the gate inspects sibling listeners. Login
`ensure` uses the same broker activation lock. A definite failed start is
logged and later bindings are attempted; if the result of a submitted systemd
job is uncertain, the broker refuses further starts until an operator inspects
the unit state and restarts the broker. Already-active sockets remain routable while a
slow start is pending. Fix the host policy and restart the broker to retry a
failed binding. The Fleetrepo release switch must stop independently starting
per-user sockets before enabling automatic restoration, or it can race the
broker even though starts inside the broker are serialized. Do not enable daemon sockets directly to work around a
failed gate.

The operator CLI exposes configuration inspection, diagnostics, revocation and
release provenance; `open-habitat --help` lists its commands. The current
`maintenance enter|leave` command only creates or removes a marker file.
The host services do not consult that marker, so the command alone does not
pause traffic or drain work.

`/healthz` confirms that a gateway or daemon is serving HTTP. Gateway `/readyz`
and `admin readiness show` still return fixed foundation responses; neither
checks the running installation's readiness. A successful connection and
snapshot establish that a user's daemon responds, but do not demonstrate a
successful Pi model request. Host-owned diagnostics use one JSON object per stderr line from the gateway,
root broker and each per-user daemon. systemd collects stderr in the service's
journal. For the neutral unit names in `systemd/`, an operator can inspect them
with `journalctl -u open-habitat-gateway.service`,
`journalctl -u open-habitat-broker.service`, or
`journalctl -u 'open-habitat-daemon@<instance>.service'` (substitute the
installation's daemon instance). Use `-f` to follow and `--since` to limit the
time window. The installation may name units differently; Fleetrepo defines
actual journal access, retention and disk limits. A mapped user must not be
assumed to have permission to read other users' service records.

Each host record has `time` (UTC timestamp), `level` (slog severity),
`schema_version` (currently 1), `component` (`gateway`, `broker`, or `daemon`),
`event` (fixed operation name) and `outcome` (classified result). `reason` is
an internal fixed classification on failures. Optional `attempt_id` is a
server-generated gateway login attempt ID; it is not a cross-service trace.
`broker_operation` and `broker_reason` classify the gateway's observation of
a broker exchange; broker guard `reason` names its failed check. Broker exchange
records name a user only after the broker has verified a route; binding publication
is recorded separately from daemon readiness and browser session issuance. A
revocation record's `subject` is the broker-verified target; its `actor` is
`root_peer`, not a guessed human operator. Gateway routing uses a fixed
`operation` name rather than a browser URL. Daemon credential handoff and native
gh installation have separate results; a Pi device start has its own
`attempt_id`, which is not the gateway's OAuth attempt ID. Example
records (timestamps and opaque IDs illustrative; no user content):

```jsonl
{"time":"2026-10-05T12:00:00Z","level":"INFO","event":"oauth_callback","schema_version":1,"component":"gateway","outcome":"rejected","reason":"broker_denied","broker_operation":"ensure","broker_reason":"denied","attempt_id":"XyZ123"}
{"time":"2026-10-05T12:00:01Z","level":"WARN","event":"broker_guard","schema_version":1,"component":"broker","outcome":"rejected","reason":"availability_error"}
{"time":"2026-10-05T12:00:02Z","level":"INFO","event":"binding_published","schema_version":1,"component":"broker","outcome":"published","operation":"ensure","user":"example-user"}
{"time":"2026-10-05T12:00:03Z","level":"WARN","event":"daemon_route","schema_version":1,"component":"gateway","outcome":"failed","operation":"snapshot","reason":"daemon_exchange_failed","user":"example-user"}
{"time":"2026-10-05T12:00:04Z","level":"INFO","event":"credential_handoff","schema_version":1,"component":"daemon","outcome":"accepted","user":"example-user"}
```

These records contain classifications, not raw errors, URLs, headers, tokens,
home paths, conversation content, command stderr or native tool output. A
failed diagnostic write is ignored; absence of a line does not prove an
operation did not occur. Writes to stderr are synchronous, so an indefinitely
blocked journal stream can still delay the caller. Broker bindings and pending
files are privileged application state, not diagnostic logs; Pi history is the
user's native work history, not a replacement for the journal. These
diagnostics are best-effort observations, not a complete audit trail. Neither
the broker protocol nor the daemon handoff frame carries the gateway's OAuth
attempt ID; joining independent records by timestamp alone is not reliable.

Decisions behind this page: ADR 0003, ADR 0004, ADR 0012.
