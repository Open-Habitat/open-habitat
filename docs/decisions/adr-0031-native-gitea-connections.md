# ADR 0031: Tea-owned Gitea connections with a bounded native adapter

**Status:** Accepted for the core architecture. **Date:** 2026-10-24.
**Decider:** Jari. Jari approved tea as the native connection/PAT owner and a
bounded Habitat adapter for browser/API and native HTTPS Git use, with one
credential store. The detailed design and network/CA policy below remain
proposals, not separately approved decisions. Implementation and server changes
are not authorized by this architecture approval.

## Context

The accepted UX is a simple Gitea address/PAT form with errors at its header,
HTTPS inferred only when absent, and no programming ligatures. Connected Gitea
and GitHub repositories share the current NewWorkspacePage/ClonePage list and
search. The prototype's wider layout, details panel, sidebar, import workflow
and precise source-filter control were not approved. A URL-only importer would
not deliver this agreement.

ADR 0026 requires native tools to own connections in each person's home, not a
Habitat server/account/token registry. GitHub browser login, UID mapping and
`gh` remain unchanged. Gitea login is not Habitat login or Git commit authorship.

Inspection of **tea v0.16.0**, commit
`9c12138d6273ba8feb6e7578833cc330c0cd6461`, found an actual Git credential helper,
not merely an API token store. However, its default host-only selection ignores
account and base path; even explicit `get --login` does not validate the request
against that login. Its config writes are locked but truncate in place. Its API
client does not provide the request policy needed here. These are concrete
reasons for adaptation, not a reason to build a new credential service.
The inspected baseline is tea v0.16.0; the credential-owner alternatives
and their limits are compared below.

## Accepted core decision

Use **tea's native PAT login configuration as the only connection and secret
store**, with a narrow adapter in the existing Habitat binary for safe native
file lifecycle, fixed Gitea API reads and Git's credential protocol. Ship the
qualified tea CLI for shell/Pi API work. Do not use `tea clone`: its v0.16.0
CLI Git backend puts a Basic Authorization header in `git -c` argv. Retain native
Git through the credential helper and the daemon's existing clone jobs. Do not call tea's automatic helper
setup or use a second credential-store/keyring copy.

The adapter is not a daemon, broker or registry. It reads the same native tea
logins on every invocation and has no durable account list. It exposes no
arbitrary authenticated HTTP proxy. Its additional maintenance surface is tea
YAML compatibility, its lock protocol and Git credential matching. This is a
real dependency/format commitment, approved in principle by Jari after the
plain-language explanation of native ownership and safe Git adaptation.

## Detailed design proposal

The following mechanics guide implementation planning; Jari's core approval
is not blanket acceptance of every detail or an instruction to start work.

### One native owner, including two accounts on one server

- Use `$HOME/.config/tea/config.yml`, with tea's existing
  `$HOME/.tea/tea.yml` fallback only when tea would select it. Refuse ambiguous,
  unsafe or malformed files rather than migrate/merge them silently. Production
  processes use the mapped HOME and XDG_CONFIG_HOME, not the operator's.
- PAT entries use tea's existing `name`, `url`, `token`, `user`, `default`,
  `created`, `version_check`, SSH and other native fields; no private YAML
  extension or Habitat sidecar. A new owned login name encodes canonical-base
  digest and server user ID (`habitat-<digest>-<id>`). Reobserve `/user` before
  publishing; subsequent checks require that ID and username. Names are
  case-insensitively unique in tea. Never set or change an existing default;
  tea itself falls back to the first entry if none is default.
- Derive browser connection IDs from native login name + canonical base + user;
  repository selection includes connection and upstream repository ID, not just
  `owner/repo`. Never compare Gitea's user ID to the GitHub broker subject.
- Discover external tea entries too. PAT entries can be used after validation;
  external OAuth/SSH/insecure entries are displayed as unsupported for this
  browser connector, not deleted or reinterpreted. No takeover on name collision.
  An external entry's mutation/removal needs an explicit target/action; normal
  connect must preserve it. Duplicate base/user PAT entries are ambiguous: ask
  the person to resolve them natively, never choose the first/default.
- The helper matches HTTPS, exact host **including port**, canonical base-path
  boundary and requested username; longest matching base wins only if unique.
  No token on missing/ambiguous account, malformed path or mismatch. Set
  `credential.useHttpPath=true` on the relevant URL scope. Standard per-clone
  `credential.<exact-remote>.username` selects the account without a secret or
  parallel connection mapping. The remote remains the ordinary credential-free
  HTTPS URL. A shell clone outside an existing clone uses Git's ordinary
  `-c credential.username=<user>` when the server has several accounts.
- URL-scoped Git helper registration uses an absolute installed Habitat binary
  path, resets the helper chain for that Gitea scope and never changes the
  github.com helper. The helper implements bounded stdin `get`, no-op `store`
  and `erase`; only Git receives username/password on stdout. It does not call
  a daemon socket, obtain authority from the gateway, or persist passwords.
  A missing entry after disconnect makes it return no credential, not fall back
  to a different tea account. Removing owned helper settings is conditional on
  their still being exactly ours; foreign configuration is not overwritten.

API reads use the PAT loaded transiently from tea and a bounded Go HTTP client,
not arbitrary `tea api` calls: only version, current user, accessible repos and
one exact repo lookup. Enumerate `/user/repos` by page/limit to termination under
time/result/byte bounds; don't infer completion from a short page alone. Validate
same-base pagination links, never follow them as arbitrary URLs. Return source
completeness and fixed failures separately. Search the resulting common list;
exact lookup is source-qualified, not broadcast under an ambiguous `owner/repo`.
Public global search is not implicitly the person's accessible-repo inventory.

### Headless lifecycle and recoverable failure

The browser PAT is consumed once by the mapped daemon. It is never an argv
value, URL, log, skill, browser persistent value or response. tea's add command
has environment-token support but no token-stdin flag; its interactive form,
SSH discovery, redirect behavior and raw errors are not our browser write path.
The daemon validates the proposed PAT in memory, then edits **only tea's native
entry**, with the existing YAML library preserving unknown fields, preferences,
other entries and ordering. No password-based token creation (`all` is tea's
fallback scope) and no OAuth callback/refresh machinery in this slice.

Check trusted directory ancestry, own UID, regular file, no symlinks/hardlinks,
private mode and size before reads/writes. Create directories 0700 and secrets
0600. Cooperate with tea's `config-path + .lock` Linux flock, reread under lock,
compare the observed entry and atomically replace/fsync the native file and
parent; don't retain a second secret backup. Helpers/readers take the same
lock. tea's own non-atomic writers can still leave corruption after a crash;
report unavailable, never turn it into an empty catalog or repair it blindly.
Arbitrary same-UID editors cannot be globally serialized; this is not a promise
of isolation from one's own shell/agents.

Replacement validates the same account before swapping; refusal leaves old bytes
intact. PATs do not refresh automatically. Expired/revoked grants remain visible
as needing replacement. Lost write replies are uncertain: reread native state,
never automatically replay. Store/helper setup is not a single transaction;
publish observed API/Git readiness separately and allow explicit repair of
nonsecret helper setup without overwriting credentials.

Disconnect removes the explicitly selected local tea entry, not upstream PATs,
repos or clones. Explain how to revoke the PAT at Gitea. A process that already
received a token may still finish; refuse disconnect while the daemon has a
clone using it and offer explicit cancel/wait first. Shell/Pi jobs are not owned
by that daemon, so local removal cannot revoke their in-flight authority.
Existing clones remain ordinary Git places; replacement with the same native
account makes their next credential request use the new token.

### Transport, network and authority

The walking slice uses HTTPS PAT authentication for **both API and Git**.
Gitea v1.24.7 source checks repository scopes in smart HTTP as well as API;
`read:user` + `read:repository` is the initial least-privilege candidate, not a
promise of installed-server behavior. It supports catalog/clone/fetch, not push.
A separately authorized write PAT (`write:repository`, plus needed user read)
is the follow-on for native push; demonstrate both permitted push and read-only
push denial on private test repos. Token scope does not grant access beyond
account/repository permissions, and read-only repository scope is not necessarily
one-repository confinement. Do not advertise repo-specific PAT selection without
version-specific proof.

Read-only SSH deploy keys genuinely narrow Git access to a repo but cannot
supply this PAT catalog. Independent API PAT + SSH key would be two revocable
grants, not one credential. tea can clone using SSH keys and newer signed SSH
API auth exists, but there is no qualified single-key path for the selected
Gitea baseline and production headless environment. Keep existing SSH clones
working natively; browser setup/management of SSH is deferred. API and SSH
host/port may differ. No copying personal keys or assuming SSH_AUTH_SOCK.

`nativeCommandInput` and clone progress give Git `/usr/bin:/bin`, mapped HOME
and XDG, prompt denial and **no SSH_AUTH_SOCK**. Pi/shell have a wider PATH but
the same home. The absolute helper reads the same tea file in all three paths;
no token environment inheritance or agent is needed. Qualify it under these
actual environments, including installed release-path changes. Commit
name/email remain the person's native Git identity, never provider login.

Proposed minimum network policy (also for Jari to approve):

- Infer `https://` only if no scheme; accept explicit port and self-hosted base
  path. Reject HTTP, userinfo, query, fragment, controls, ambiguous encodings,
  dot segments and non-HTTP protocols. Never silently correct host spelling.
- Support intended LAN/VPN/private addresses and explicitly configured loopback
  Gitea instances, including IPv6. Cohosting Gitea is a legitimate use case;
  banning localhost would not establish a security boundary when the same UID
  already has a shell with that network access. TLS verification and exact
  credential-origin matching still apply: loopback is not an insecure exception.
  Reject unspecified, multicast and link-local/metadata destinations at dial time,
  including resolved addresses. This prevents invalid/provider-inappropriate
  destinations, not general same-UID egress. Operator routing/VPN/firewalls are
  prerequisites; the connector remains fixed Gitea operations, not a URL proxy.
- No API redirects; require final canonical address. HTTPS clone URL must match
  the selected origin/base and expected repo path; reject cross-host URLs rather
  than forwarding a PAT. Disable Git HTTP redirects for managed transfers and
  the registered scope. Reject local/file/ext transports, recursive submodules
  and silent alternate authenticated endpoints. LFS/submodule auth is not MVP.
- Use verified TLS and the operator-approved OS CA store shared by Go/tea/Git;
  private CA installation is an operator prerequisite, not dialog authority.
  No insecure flag, sslVerify=false, trust-on-error or automatic CA installation.
  Examine effective Git URL rewrites/transport overrides before browser clone
  and fetch; refuse a managed transfer redirected by them. Personal Git config
  is not a sandbox, but cannot silently redirect a browser-supplied PAT.

Gateway authenticates, checks CSRF/bounds and transparently proxies to the
person's daemon; only that daemon calls Gitea and touches native credentials.
Transparent transport **does not mean bytes never enter gateway memory**. No
body logging/parsing/persistence for these credentials, and no Gitea client,
operator-shared personal tokens or new root-broker authority there.

## Alternatives and consequences

1. **tea without adaptation:** excellent native inventory and now a real HTTPS
   helper, but host-first account selection, unchecked explicit-login requests,
   unsafe file-write assumptions and insufficient HTTP policy do not satisfy
   same-host/multi-base and browser secret handling. Reject unmodified setup.
2. **Git Credential Manager v2.6.1 as owner:** mature Git protocol and selectable
   headless stores, generic Basic/PAT support; no native Gitea login/catalog
   inventory in that provider. API discovery would need a separate connection
   list or infer from clone remotes (cannot connect before cloning). Linux has
   no default store; Secret Service needs an unlock session, GPG adds key
   lifecycle, plaintext is not better than tea PAT YAML. Reject for this scope.
   Plain Git credential-store + a custom API connector has the same inventory
   gap and stores secrets separately from any CLI connection. SSH-only loses
   the accepted catalog. A new Habitat registry is a genuine alternative
   architecture, not a permissible implementation shortcut.

This recommendation accepts a small native-format adapter rather than a large
credential broker or a second grant. It costs explicit format/helper regression
coverage on tea upgrades. File PATs are readable by that person's agents: keyring
encryption cannot protect against an unlocked same-UID native agent. The approved
agent-access warning remains important. API readiness is never Git readiness.

## Approval and acceptance still needed

The **tea owner + bounded adapter + shared HTTPS PAT** architecture is approved.
The stated network/CA boundary remains proposed, and implementation still needs
separate authorization. No installed Gitea support or runtime qualification
claim is made here. Implementation should start with a thin end-to-end
connect/catalog/clone slice before generalization, with synthetic, two-real-UID,
release and live-provider proofs. No product code,
provider traffic, credentials or server state were changed for this proposal.
