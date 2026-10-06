# ADR 0004: Provision a Unix account on first authorized GitHub web login

**Status:** Accepted

**Decision date:** 2026-09-24

## Context

A person invited to the host should be able to sign in with GitHub and start
working without an administrator first creating their Linux account. The same
GitHub authorization should establish their browser identity and configure
native `gh` under their Unix user. Their account may run many agents.

Creating accounts requires root authority. Giving that authority to the gateway
would expose account management to the component that parses browser traffic
and OAuth responses. A separate local broker keeps those responsibilities apart.

## Decision

### The broker owns account creation and bindings

Use a small root-owned provisioning broker, reached only through a restricted
local Unix socket. It authenticates the fixed gateway UID using kernel peer
credentials and accepts a narrow data protocol. It has no network listener,
arbitrary command interface or OAuth credentials.

The gateway verifies the GitHub login and obtains the stable numeric ID from
GitHub's authenticated user response. The broker normally checks that ID against a
root-owned operator-managed allowlist and binds it to exactly one local UID.
For the disposable test installation only, an explicit root-owned broker
`admission: "any"` mode accepts any authenticated GitHub numeric ID without
an allowlist entry. It was first enabled behind signed Cloudflare Access
assertion verification and an email gate. [ADR 0014](adr-0014-open-test-admission.md)
later removed that gate for the test installation, leaving GitHub sign-in as its
admission step. Neither policy is a production admission design. The broker
still trusts only its fixed gateway UID as caller; it cannot independently
attest the remote person's email. No runtime check couples broker admission
to a gateway or edge policy: installation ordering and live verification are
the operator's responsibility.
The browser cannot choose a Unix account. A GitHub login name is only an initial
Unix-name candidate: the broker lowercases it, or uses `gh` plus the stable
numeric ID when it is not a valid Unix name. Name collisions still refuse
rather than adopting an existing account; an operator alternate can resolve
one. Renaming the GitHub account leaves its existing binding unchanged.

The broker relies on the gateway to authenticate the remote person. A
compromised gateway can claim an allowed GitHub ID: checking the local peer
UID does not independently prove who signed in. The gateway must therefore
remain small and restricted, even though it runs without root privileges.

For a new allowed ID, the broker creates a private Unix account and home and
prepares its daemon configuration, service and socket. It must verify these
before publishing a routable binding. An occupied or unsafe name requires an
operator-approved alternative; an existing account is never silently adopted.
Concurrent logins must converge on one binding without assigning the same
resources to different people. Root-owned state and the native account must
agree before an existing binding can be used.

### Authorization at login and explicit revocation

The broker checks current authorization when the gateway issues a session.
In `any` mode, changing the ID allowlist does not revoke a subject: revoke
sessions explicitly and remove that person's Access admission before relying
on a denial of further login. Existing Unix bindings remain reserved.
After login, the gateway routes from its local session until expiry, logout or
`RevokeSubject` ([ADR 0006](adr-0006-subject-revocation.md)). An allowlist
change by itself does not log out an existing session; revoke access explicitly
before editing admission policy. Already-running operations cannot be undone.
Native agents, files and credentials remain in place when web access ends.

### Native credentials precede the browser session

Once the broker has committed the binding, the gateway forwards the transient
OAuth token once over the verified route to that user's daemon. The daemon
independently checks its binding and GitHub identity, installs native `gh`
authentication as its own UID and verifies HTTPS Git authentication.
The token never enters broker state or logs. Concurrent callbacks must not race
native credential writes.

Only successful native setup and a final authorization check permit a browser
session. A failed or uncertain handoff requires a new login that reobserves
native state; the gateway does not retain a token for replay. Failure to create
or deliver the session does not roll back the Unix account or installed
credential. Web logout and native credential removal remain separate actions.
[ADR 0003](adr-0003-host-stack.md) and the
[interface contract](../architecture/identity-and-trust.md) define the
credential and routing protections.

### Interrupted creation denies access

Account creation can stop between Linux operations. Record the intended work
before mutations and publish the binding only after verification. An uncertain
partial account or binding must remain inaccessible; blindly retrying, deleting
its home or reusing its UID could give another person access to its data.

There is no separate operator recovery procedure for interrupted first-user
creation. Resuming is justified only if completed phases can be identified and
retried safely at reasonable cost. Otherwise the operation remains blocked.
The [interruption issue](../../issues/reconcile-interrupted-jit-provisioning/item.md)
owns that scope; this decision does not promise automatic recovery.

## Ownership and implementation

The product owns the broker protocol, account and binding verification, gateway
integration, daemon checks and neutral service templates. Fleetrepo owns the
concrete deployment: admission mode, authorized IDs and alternate names in
allowlist mode, Access policy, UID allocation range, service permissions,
secrets and installation.

This replaces ADR 0003's requirement for a pre-existing account and static
startup mapping. The administrator still controls admission and root owns the
binding, as required by ADR 0001. The gateway remains unprivileged and outside
user homes; native work stays in each user's daemon.

The [broker writer](../../issues/implement-jit-broker-writer/item.md) owns locking,
journaling and publication details. The
[guest isolation work](../../issues/prove-jit-guest-isolation/result.md) records
implementation evidence and its limits. This ADR defines the authority boundary;
those results and Fleetrepo's deployment receipts establish what has been tested.
