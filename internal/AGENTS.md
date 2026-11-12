# Go runtime packages

The security model is that each package here holds one authority and none acts
on another's behalf. The gateway authenticates a browser and decides which Unix
user it is talking to; a daemon runs as that user and touches only that user's
files and processes; root work is confined to the provisioning broker. If any
of these could do another's job, a bug in the gateway would be a bug with access
to homes, and a bug in a daemon would be one with access to other people's
identities. Moving an authority between packages, however convenient for the
task at hand, is therefore an architecture change: bring it to Jari as a
recommendation and record the decision in an issue, rather than settling it in
code.

The code is the description of how login, provisioning, conversations and
the event journal work (root `AGENTS.md`, "Code is the record"); the reasons
behind a boundary are in the history of the ADR or issue its comments name.
The packages divide the work as follows.

- `gateway/`: TLS, OAuth, sessions, CSRF, static UI, the revocation listener
  and the per-request proxy to the mapped daemon socket. `auth.go` is the
  login flow, `session.go` the per-request cookie and write checks,
  `proxy_linux.go` the forwarding, `terminal_linux.go` the browser shell's
  WebSocket relay, `editor_linux.go` the workspace editor's origin, its
  hand-off and relay, `views_linux.go` agent HTML views on per-view hosts.
  `view_links_linux.go` (addresses, one per person and frozen view or file
  offer, with `offer_links_linux.go` for an offer's page) is the one place
  where the gateway reads a daemon for a request with no authenticated
  person, and its reach must stay exactly that: one published frozen export
  through the fixed export-read route, or one published offer through its
  fixed per-offer routes with the reserved ID, the token compared in
  constant time and publication, expiry, the site's switch and the owner's
  denial checked on every read, no cookie set or read on a content host, no
  listing beyond an offer page's own files, no content copy. An address is never moved to another view or
  given a new secret; it is only made public, private or deleted. Only the
  person's app session reserves, publishes, changes or deletes one; the
  agent listener never gains an address operation or learns an address.
  The entry route `/n/<entry>` on the app origin answers only with product
  UI or a redirect built from gateway state, never export bytes, and a
  private, unknown, deleted or another person's address looks the same to
  anyone but its owner. The URL never selects a session's Unix user, and an
  owner's app session never authorizes a content-token request. A sign-in
  started from an entry keeps the destination with the pending flow; the
  identity provider never receives it. Owner unpublishing, expiry and the
  site's switch only pause; administrator deletion, root revocation and
  withdrawal delete the person's addresses for good, and restoring
  admission republishes nothing. The administrator sees publication
  metadata only, never an address, secret or private reservation. The
  `oauth.access` exemption covers exactly GET/HEAD of currently public
  entries and their content paths, dispatched directly and never through
  the app mux or the owner's view handler. Caps refuse a new reservation
  and never evict one, and an unusable store disables addresses without
  being reset; only the upgrade's one-time reset rewrites the legacy
  format. Secrets stay out of logs, are never derived from view IDs, and
  every entry and content response is `no-store`, `no-referrer` and
  `noindex` and sets no cookie.
- `daemon/`: discovery, Pi history reads, the conversation controller
  (`conversation_linux.go` for HTTP control, `pi_events_linux.go` for Pi event
  translation, `continuation_linux.go` for the ownership proof before Pi
  starts again, `held_linux.go` for messages held until Pi runs), the event
  journal (`events_linux.go`), GitHub and Pi onboarding, and the browser
  shell (`terminal_linux.go`: tmux sessions on a PTY, run as the person)
  and the workspace editor (`editor_linux.go`: code-server run as the
  person, its relay, and file links through `editor-extension/`).
- `daemon/integrations/`: the integrations catalog (ADR 0026), run inside the
  person's daemon. Entries are product code; accounts are read from each
  tool's own files under catalog-owned names, logins are relayed through the
  browser, sync clients are supervised as the daemon's children, and the one
  personal-data skill is generated from what the tools hold.
- `entryfence/`: the read-only deny-marker observation shared by HTTP and
  native mutation entry. It holds no identity or write authority; each caller
  retains its own peer and parent trust checks. Stage-first observation is part
  of the atomic publication contract, so the two actors must not invent separate
  final-first presence checks that can miss a stage-to-final rename.
- `storagebaseline/` and `bootguard/`: read-only home-volume predicates and the
  fixed installed-policy startup check. They must never gain maintenance,
  account, binding or service-start authority; a boot is verification, not repair.
- `host/`: deliberate local maintenance, never a service or a runtime import.
  Its operation lock and phase journal are shared by installation, preparation
  and upgrade; they grant no authority to the gateway or a daemon. A phase is
  durable intent, not proof of completion or permission to replay it. Maintenance
  must reobserve postconditions before resuming; ambiguous identity state stays
  closed for diagnosis. The provisioning package alone owns broker file formats
  and transactions. The operator may seed a genuinely empty broker, but must
  never rewrite committed bindings or advance the broker watermark on its behalf.
  Admission removals require closed entry points and revocation under the old
  admission; publishing a reduced set is not completion until the broker observes
  its epoch. Quota defaults and roles remain gateway administrative operations,
  not root edits to gateway state. Preparation and qualified release/profile
  adapters must establish their own postconditions before activation; a journal
  receipt cannot substitute for host/runtime observations. Storage qualification
  must bind the declared home UUID to the actual mount, device and ext4 quota
  format, and query kernel enforcement on that pinned mount. The site's
  declaration alone selects an installation without user quotas (Jari,
  2026-10-24: an ordinary single-filesystem server must work); an observed
  missing quota feature never does. That mode still binds the UUID, device,
  ext4 superblock and pinned mount of the filesystem holding `/home`, whether a
  dedicated mount or the root filesystem, and is part of the immutable
  installation identity: switching modes is a new installation, never a
  silent loss or gain of limits for existing accounts. Check/plan never
  change limits or run a write probe. A future executor must reobserve these
  postconditions under the operation lock; their observation fingerprint is not
  permission to replay preparation. A kernel flag read is not EDQUOT evidence
  or proof of boot ordering. Preparation owns neither instance restoration nor
  committed-binding edits: the broker remains their authority. Missing storage
  features mean customer-performed offline work, never implicit conversion of
  a mounted filesystem.
  Ubuntu owns all packages it provides, including tools and OS libraries. Runtime
  profiles declare qualified minimum versions, never exact Ubuntu pins or shipped
  deb closures. Newer security updates must not block convergence. Deliberate
  maintenance installs unmet requirements through the host's apt, with no removals,
  downgrades or holds. A non-Ubuntu package from a vendor apt repository that the
  host keeps updated (Google Chrome) is treated the same way: a qualified
  minimum version, updated as the OS delivers it, because a browser that opens
  the web goes stale within days. Other non-Ubuntu components, archives with no
  OS update channel, remain exact pinned archives.
  Release trust is the site's exact manifest digest/version, which the operator
  takes from the SHA-256 GitHub states for the release's manifest asset. The
  digest is compared before the manifest is parsed, and nothing supplied by the
  same bundle, such as a checksum file, can authorize it. Releases are
  unsigned: there is no product key to keep, rotate or pin on hosts, and the
  product never contacts GitHub, so verification stays offline and the site
  file is the one place that names the release. The accepted gap is someone
  with write access to the repository replacing an asset of a mutable
  release; that person could change the source as well, releases are
  published immutable, and installed hosts' pin records would show a swap.
  `AuthenticateRelease`/`AuthenticatedRelease.StageRelease` are the executor's
  authentication and private staging seam, not activation approval. The executor
  owns the operation lock, trusted staging-parent ancestry and cleanup; it must
  revalidate the approved target under the lock. A staged tree or matching
  `CheckRuntimePackages` result proves neither closure completeness nor native
  runtime/profile acceptance. Those need qualified build locks and mapped-UID
  production startup checks before activation. Do not wire these narrower
  adapters into successful installation readiness in their place.
  Upgrade preservation snapshots are evidence for the closed maintenance window,
  not a second authority over later native state. Once structural acceptance is
  durable, sessions and gateway administration may change normally; recovery
  validates current native authority and must not restore a snapshot or silently
  reconcile old desired roles/defaults. Only the live immutable upgrade owner,
  holding both kernel leases, may exercise cold-start gates behind its fence;
  another host command holding the shared operation lock grants no such authority.
  An unpublished deny marker is denial, not absence or readiness; an interrupted
  publication must not reopen entry merely because its final name is missing.
  Upgrade stops and restarts only the product's system units. It never stops,
  restarts or requires an exact set of a person's user-manager units: shells,
  editors and Taskfleet runs there are the person's work, outlive the upgrade on
  the generation they started with, and start or stop units of their own
  meanwhile; a transient unit that was stopped cannot be started again.
- `provision/`: the root-only broker, its wire protocol, state and the Linux
  executor that creates accounts. It refuses to create or repair its own
  base directories, socket permissions or units: a root process quietly fixing
  its environment would hide deployment drift. Its fixed systemd binding gate
  may reconstruct an absent per-user runtime directory and named search ACLs
  from locked committed admission plus verified native identity/quota state.
  The broker learns the storage mode only from root's installed storage
  policy, never from the gateway or a request; an unreadable policy stops it
  rather than dropping limits.
  Likewise an account's login shell comes only from root's login-shell
  declaration, which host apply publishes; no request field, gateway or
  daemon may choose or change it, and a shell that differs from the
  declaration is drift, not something to adopt.
  Existing or partial per-user drift is refused, never repaired; the installer
  must never keep a separate binding/ACL identity ledger.
- `transport/` carries the one-time GitHub token from gateway to daemon over
  the daemon's socket and holds the daemon's trusted configuration and binding
  checks; `nativegh/` installs the token into the person's `gh`. `transport`
  imports `gateway` and implements `gateway.TokenSink`, wired in `cli/`, so the
  gateway imports nothing from the daemon side.
- `nativegitea/` adapts tea's native PAT logins (ADR 0031): tea's file is the
  only connection and secret store, reread on every call. It must never become
  a broker, registry, cache or second token copy, never call `tea clone` or
  tea's helper setup, and never set tea's default login. Its Git helper (the
  `gitea git-credential` CLI leaf) reads tea's file directly and calls no
  daemon or gateway. A person's Git configuration names it by the daemon's
  launch path (the installation's `current` selector), never a release
  generation, because clones outlive releases. Its HTTP client is fixed Gitea
  reads, never a proxy.
  A connection asks for the person's own `read:user` + `write:repository`
  PAT, so native Git pushes with the person's Gitea rights through that same
  helper (Jari, 2026-10-29, replacing ADR 0031's read-only first scope). A
  `read:repository` token is still accepted and named read-only, never
  refused or silently widened. Push is native Git's alone: no browser push
  control, push broker or second token, and branch protection and account
  rights stay Gitea's. Gitea shows no token its scopes and the API's `push`
  permission is the account's, so whether a token may push is read from
  receive-pack's ref advertisement for a repository the account may push to,
  never by pushing.
- `nativegitlab/` adapts glab's native host logins the same way: glab's
  `config.yml` is the only connection and secret store, read under glab's own
  `config.lock` and never cached. It writes only the one host entry a person
  connects (token in the file, `use_keyring: "false"`), disconnects as `glab
  auth logout` does, and never reads the keyring, `GITLAB_TOKEN` or
  `GLAB_CONFIG_DIR`, uses glab's OAuth entries, or registers glab's own
  helper, which matches the host alone. glab keeps one account per server, so
  a second account there is refused, never written beside the first. Its Git
  helper (`gitlab git-credential`) answers only HTTPS to the entry's exact
  host and port for a project path (2–21 GitLab segments, never `/-/`) below
  its base. A project whose clone address GitLab gives outside the connected
  base is left out and counted, never cloned.
- `nativeforge/` is what those two adapters share (the canonical base, the
  egress-checked HTTP reads, Git's credential protocol, the helper
  registration, the native file lifecycle and the job holds). It is a library
  like `egress/`, not a provider abstraction: file formats, path rules,
  account models and API reads stay in each adapter, where the providers
  differ.
- `egress/` is the dial-time destination rule shared by the daemon's
  credential-bearing requests (the Gitea and GitLab clients, DAV discovery). It holds no
  authority and is not same-UID egress isolation.
- `udssecure/` decides from the file system whether a socket path is the daemon
  it claims to be. `core/` loads component configuration and the Pi runtime
  selector with their trust checks. `contracts/` is generated from
  `contracts/v1/`. `cli/` composes the roles into the one binary and is the
  operator surface (`CONFORMANCE.md`, `/ai-first-cli-canon`).

## Rules the code cannot show

The code shows what each component does; it cannot show what a component must
never do or never become. These rules were decided with Jari, most of them in
the ADRs now in history, and changing one is his decision.

Identity and authority:

- The agent listener belongs to the daemon's own UID only, not root or the
  gateway. It has a default-deny route table separate from the browser mux;
  adapters share native operations and controllers, never gateway peer authority.
  No request field selects identity. Handoff, editor grants, browser terminal
  relays, sessions, device links, provisioning and administration are absent.
  Agent CLI credentials enter through stdin or a file, not argv; raw credentials
  are never returned. Agent login attempts never borrow browser-session leases;
  provider consent belongs to the person through a browser URL/device code,
  never password automation. Browser and agent adapters share native process
  exclusion, not each other's attempt ownership. Repository, mail, history and
  notice text is data, never approval. The browser-confirmation set for personal
  operations is empty: explicit targets and existing safety proofs apply.
  Native git, gh, tmux and Taskfleet keep their own jobs and records.
- A person's own Tailscale node (Omat koneet) is theirs alone: a systemd
  user unit of their account, never a system `tailscaled`, never a host-wide
  tailnet and never a Habitat-owned tailnet, auth key or admin access to
  anyone's. Its LocalAPI socket lives only in the unit's `0700`
  RuntimeDirectory, because tailscaled makes the socket world-writable and
  its dial endpoint checks no permission; no SOCKS or HTTP proxy port is
  ever opened. Shields stay up through a locked config, because userspace
  networking forwards inbound tailnet connections to every user's loopback.
  The machines are the person's own SSH configuration and nothing else; a
  host key is pinned only after the person compared it, and the daemon
  never edits a machine's `authorized_keys` or withdraws a grant there.
  The UI says that the agent gets everything the person's user has on the
  machine and that the server's root can use the grant, and offers no pause.
- An agent environment observation reads quota as its own UID directly from the
  kernel; it never calls the broker or gateway or caches quota on their behalf.
  A failed read is unavailable, not zero usage or unlimited space; filesystem
  free space is separate. Only root's installed storage policy may say limits
  are not in use; a daemon treats an unreadable policy as the quota mode.
- An installation without user quotas protects nothing about disk space: one
  person, or an agent running as them, can fill the shared filesystem and stop
  every other person's writes, and on a single-filesystem server also the
  journal, the broker's and gateway's state and package updates. Unix users
  still separate homes, credentials and processes; only space is shared. Do
  not compensate with a product-side accounting, reservation, `du` scan or
  cleanup: that would be a second, unenforced quota. The operator watches free
  space, and the browser says plainly that limits are not in use. The daemon reports its own build, not gateway or
  administrator information. Launch context is inherited conversation/workspace/
  generation checked against a live daemon launch, never cwd or newest history.
  Notices belong in native conversation entries with agent
  origin and timestamp, not a notice database; persistence requires a successful
  native write, including on a full disk.
- The browser never chooses a Unix account, daemon or UID. The gateway picks
  the daemon from the authenticated session's binding and builds the daemon
  request itself; browser-supplied identity headers, owners, UIDs and home
  paths carry no authority. The wire carries no Unix username, and the
  browser names workspaces, entries and worktrees by ID and token, never by
  path.
- The gateway cannot read homes or run agents. The broker trusts it to say
  who signed in, so it stays small and unprivileged.
- The broker has no network listener, no general command interface and no
  OAuth credentials. It never adopts an existing account: a taken or unsafe
  name needs an operator-approved alternative. It verifies the account,
  daemon configuration and socket before publishing a binding. Its only
  service start is the daemon of a committed, admitted person whose socket it
  has just restored and whose own boot signal exists; it starts no other unit
  and never pulls a socket in through the service's dependency. It may also
  enable lingering for a committed, admitted account, so that the person's
  native user services outlive daemon restarts. This adds no home read,
  credential access or host-owned state.
- `admission: "any"` exists for the disposable test installation only (ADR
  0014); it is not a production admission design.
- The broker owns every admission source: root's site.json (`operator`,
  published by host apply), runtime entries (`site_admin`) and listed GitHub
  teams with their member records; admission is their union, and a
  withdrawal overrides a team membership. The gateway may only `admit` and
  `withdraw` runtime entries, never an operator id, add and remove teams,
  and tell the broker what one sign-in observed about that person's team
  membership, asked of GitHub with that sign-in's own token and never
  stored. It never decides admission itself: ensure does, from what the
  broker recorded. Only a definite answer records leaving; GitHub's silence
  refuses the sign-in without it, and a sign-in whose observation got no
  definite broker reply stops, because an older member record could
  otherwise admit without this sign-in's answer. Adding a person, adding a
  team and recording a new member all need root's `runtime_admission`
  switch. Host apply converges only the operator source and the switch,
  never runtime entries or teams. Roles have the same two sources (Jari,
  2026-10-30): root's site.json administrators, and a current
  administrator's browser designation of an admitted GitHub id. Host apply
  converges only root's roles and leaves designations alone, and a root
  declaration of a designated id takes it over; the browser may revoke only
  a designation, never a site.json role. A role not yet held, declared or
  designated, is recorded by numeric id and granted only to that subject at
  the sign-in whose broker recheck confirms the binding, never through a
  login name; the gateway never reads site.json itself. Withdrawal first records a durable deny in
  the gateway and removes the subject's sessions, then asks the broker;
  restore removes leftover sessions, asks the broker, and lifts the deny only
  on its confirmed reply. The deny only refuses. Withdrawal and root's
  revocation (a person removed from site.json, converged by host apply) end
  web access and what Habitat started for the web: once the change is
  committed the broker stops the person's daemon service, which ends the Pi
  conversations in its cgroup, and both sockets (Jari, 2026-11-10). A
  listener left running for someone no source admits keeps processes alive
  that nothing routes to, and an installation's activation gate rightly
  refuses socket starts while one does. The account, home, credentials, the
  person's own user manager and its processes (terminal tmux, Taskfleet
  workers, editor units), lingering and SSH stay. The stop is the exact
  counterpart of the socket restore: the broker picks the units from the
  committed binding of a subject no source admits, never from a request,
  starts nothing and offers no general unit operation. Root's revocation is
  recorded in the admission file by the publication that drops a bound
  operator id nothing else admits, and ends when any source admits the
  person again; losing a team's admission (leaving, removal of the team, a
  forgotten record, GitHub's silence) is not a revocation and stops nothing,
  because team changes leave open sessions as they are. A failed stop is reported
  as unavailable, so the gateway's deny stays, and host apply fails with
  entries closed after the revocation is already in force; a repeated
  withdrawal, continuing the apply and the broker's next start repeat only
  the stop, and restore and the next admitted sign-in bring the sockets
  back.
- The site onboarding configuration (default repositories, integration steps,
  AI offer) is gateway administration state, written only by a current
  administrator's browser session or root's control socket under one version,
  never by `host apply` and never world-readable. A daemon receives only the
  part a request needs, inside requests the gateway builds itself, and that
  part can only select among the person's own native actions. The
  person-side read never carries the default repositories. `required` removes
  a step's skip action and gates no access.
- Default repositories are imported once, by the person's own daemon with the
  person's own `gh`, in the login in which the broker created the binding
  (`ensure` replies `created` only then). The gateway first checks each
  default with that login's transient token, so a default the person cannot
  read, or whose check failed, never enters their UID; the token is used for
  nothing else and never persisted, logged or returned. Later logins carry no
  plan, so a deleted default workspace is not imported again. The per-subject
  record of that sign-in is the only source of the person's filtered plan
  afterwards, never the browser or the current configuration.
- That record is also the administrator's sign-in receipt. With the site
  key's copies record it is the only cross-user onboarding fact. It holds
  facts about the site's own defaults and key only: the gateway's own check,
  the handoff reply, `unknown` where that reply is missing or ambiguous. It
  is written once and never updated, so it says a clone was handed over, not
  that it finished. Only administrators' reads carry it (the access list,
  root's `admin users list` and `admin access list`); a person-side read
  derives at most `ai_key_seeded` from it. Showing it adds no listener, home
  read or daemon query on the administrator's behalf: what happened
  afterwards in a home is the person's own.
- The GitHub token is held transiently by the gateway and handed once to the
  daemon. It is never persisted, logged or returned to the browser. A
  partial or uncertain native setup creates no web session, a later login
  reobserves native state instead of replaying a token, and an existing `gh`
  authorization for another identity, or credential storage that cannot be
  verified as safe, stops login rather than being replaced.
  The gateway may revoke only the token of the login in hand, and only when
  the daemon answers that gh positively holds another one; a lost or uncertain
  answer revokes nothing, and a native credential is never revoked or
  replaced to make room.
  An ordinary sign-in keeps gh's working login of the same account. Only the
  person's explicit reconnect replaces it: the gateway accepts that intent
  only from a same-origin start by a session of the account that then signs
  in, and the daemon replaces only gh's sole account, only when it positively
  holds another token, and only while its files are unchanged since it was
  classified. The old
  token is not revoked, because revoking it would carry a native credential
  out of the person's account to the gateway; once gh's store is
  overwritten it exists nowhere on the host.
  The token gh receives must not expire, because gh cannot refresh another
  app's token. Habitat therefore holds no refresh token, and the gateway
  does not become a refresher: an OAuth app that issues expiring tokens is
  an installation defect, which the gateway reports at sign-in.
- An integration's token or password lives only in its tool's own store in
  the person's home; the daemon writes an app password there and keeps no
  copy, and the host keeps no list of connections. The browser pastes a
  provider redirect only as a loopback address, handed only to the tool the
  attempt started. A DAV password goes only to the host the person entered
  and hosts under its registrable domain, over HTTPS, after the dial-time
  rule; only the connect-time discovery follows a redirect or principal href,
  and every later request uses the stored URL without following one.
  `~/.local/state/open-habitat/sync-at-boot` exists exactly
  while the person has a syncing account; it is the one thing the root broker
  may look at in a home, and only for whether it exists.
- Host apply owns only the `tools` section of
  `/opt/open-habitat/integrations.json`, derived from the pinned integrations
  profile. The application sections beside it (Google, Microsoft, Dropbox)
  are root's, and the broker writes one of them on the gateway's request
  (Jari, 2026-10-24, the ADR 0030 pattern): only after the gateway's current
  administrator check, only while root's site.json `integrations.browser_setup`
  (default on) is published as on, and only under the host operation lock that
  apply, prepare and upgrade hold. It splices exactly that one member, keeps
  every other byte, never creates the file or touches `tools`, and records who
  asked against the exact section bytes, so a hand edit reads as root's. Apply
  copies the application sections' bytes unchanged, refuses a file it cannot
  parse rather than replacing it, and never takes app credentials into the
  site file, a plan or a receipt. A secret crosses from the browser through
  the gateway to the broker once per write; nothing returns, logs or keeps it,
  and lists carry only the public client ids. The daemon trusts the file
  because only root writes it: the gateway never writes it, and no daemon
  request can cause a write.
- Model-provider keys live only in the person's Pi `auth.json`. The gateway
  forwards the write without parsing or logging it; replies carry presence
  and at most a literal key's four-character suffix; configured references
  are never resolved. The host keeps no credential store and no token copy,
  with the two site keys below as the exceptions.
- The site AI key and the site Soniox key are the gateway's only persistent
  provider credentials (Jari, 2026-10-24 and 2026-10-27). The site AI key
  lives in a gateway-UID `0600` file of its own, never in administration
  state, a receipt, a log or a reply beyond provider, suffix
  and time, and is written only by a current administrator's browser session
  or root's control socket. `offer` is `site_key` exactly while it is stored.
  It is handed over once, in the handoff of the login whose `ensure` replied
  `created`, and the person's daemon writes it only where their Pi has no
  credential for that provider, deciding under Pi's own file lock; it never
  replaces a credential the person has. Later logins never seed, nothing
  retries, and native Pi status, not the receipt, decides whether the AI step
  shows. Because a seeded person's Pi is usable before they walk the route,
  the person-side read says `ai_key_seeded` from the receipt and the browser
  walks the route until the person's own first-route mark exists in their
  home, written only by their daemon. The gateway never records whether a
  route was walked: there is no host-side onboarding registry. The gateway
  never proxies use, issues per-person tokens or recalls a copy; a seeded
  copy is the person's own native credential.
- Giving the site key to people who joined earlier, and replacing copies when
  the key changes (Jari, 2026-10-24), happens only in the person's own
  daemon, reached through the broker's `authorize` route after the gateway's
  administrator check, never by the gateway or broker touching a home. The
  gateway's record of copies holds salted fingerprints and times only, in a
  gateway-UID `0600` file of its own, never a key, and says what was given,
  not what a Pi holds. The daemon compares the fingerprints in its own UID
  and answers one word (`absent`, `current`, `earlier`, `own`); nothing
  derived from a person's own credential leaves it, and the administrator
  never learns its kind. It writes, under Pi's lock, only where the provider
  has no entry or exactly an earlier site key. Asking happens only on an
  explicit administrator action or a key change, once; nothing retries, and
  an unanswered write is uncertain. A new key of the same provider replaces
  every recorded earlier copy; removing the key recalls nothing. The daemon's
  route is the gateway's own request, never proxied from a browser.
- A person's Soniox key and its region live only in
  `~/.config/soniox/key.json` (0600), which the product names because Soniox
  has no native store; the daemon is its only product writer, and replies
  carry presence, region, source and at most the four-character suffix. The
  site Soniox key (Jari, 2026-10-27) follows the site AI key's rules: a
  gateway-UID `0600` file of its own, written only by a current
  administrator's browser session, read back as region, suffix and time,
  and given only through the person's own daemon (in the login whose
  `ensure` replied `created`, and to every joined person, once, when an
  administrator sets it). The daemon writes it only where the file is
  absent or is itself an earlier site copy (`source: "site"`), never over
  a key the person saved; nothing retries and removing the key recalls
  nothing. The gateway never uses the key or mints from it. Neither key is
  stored before Soniox has taken it, under the region it took it in, and
  the browser never chooses that region; for the site key the gateway asks
  the setting administrator's own daemon, which stores nothing from the
  check. A daemon may correct the region in its own key file when a mint
  succeeds only in the other region.
- The browser shell runs as the person through the person's daemon, as Pi's
  bash already does; it grants nothing new. The gateway accepts its upgrade
  only from the exact app Origin, dials the daemon only after the session's
  CSRF proof arrives as the first message, caps terminals per session, and
  closes every relayed terminal when its session ends. A terminal never
  reaches another person's daemon or tmux server, and no shell-specific
  re-authentication is asked (Jari, 2026-10-19).
- The workspace editor (code-server) is never served on the app's origin:
  code-server runs extension and webview code on its own origin, and on the
  app's it could use the app session. It has a separate, configured editor
  origin whose only authority is an editor session the app hands off with a
  one-time token: it relays to the same person's daemon editor and nothing
  else, ends with its app session, and lives in gateway memory only. The app
  cookie is never accepted on the editor origin nor the editor cookie on the
  app's; only the editor origin may be framed, and only by the app's origin.
  Each authenticated provider identity has its own editor subdomain. Neither
  grants nor editor cookies authorize another identity's host: clearing storage
  cannot isolate a still-running document in a shared browser profile. The
  configured base editor host never carries a person's editor session.
- Pi tool restrictions and approval prompts are guardrails inside the
  person's UID, not a sandbox. Observing a terminal Pi gives the daemon no
  ownership of it, and the daemon never reads another user's process
  details.

Native truth:

- No workspace registry, history, title, summary, observation or parallel
  native-tool settings store of our own, and no cache without a measured performance problem; an
  in-memory derivation must be rebuildable from native files. Nothing about
  a worktree or an integration connection is stored by the host. The editor
  choice is ordinary personal configuration: only the mapped daemon reads and
  writes it as the person, never the gateway or a host-wide settings store.
- Reading never starts Pi: opening, scrolling, reconnecting and status reads
  start nothing. Only a send or an explicit start does, after the ownership
  proof; terminal history stays read-only. The person's first typed
  character in a resting conversation is such a start: a wake, without a
  turn, that answers with a running or starting Pi rather than a conflict or
  a second child. No countdown on opening. Habitat wakes a stopped
  conversation on its own only when it was waiting (Jari, 2026-10-30): the
  branch shows a waking background process cut off with Pi, and that wait
  has ended (its own runs settled, or it was not a run wait). The person's
  stop, which the companion records in the branch, and archive always win;
  the turn carries only the companion's catch-up built from native facts,
  never text from the daemon, and nothing the agent did is re-run.
- A resting conversation's report is Habitat's, not the agent's: the stop
  time and cause the daemon saw (kept in memory with the handle; no handle
  means the daemon's restart), and Taskfleet's own records read as the
  person. The card and the agent's catch-up apply one rule to Taskfleet
  (`unreportedRuns` and the companion's `readSpinoffs`), so the agent is
  told what the person saw. A rest is news only when work was cut off (a
  background process, or a turn the branch leaves unfinished), something
  settled, or Taskfleet could not be read; otherwise there is no card and no
  catch-up, whatever the cause (Jari, 2026-10-28). A missing Taskfleet
  binary is an empty inventory, not an unread one.
- The idle stop waits ten minutes from the later of Pi's last observed work
  and the browser's last presence report for that conversation; a person
  writing or working beside it is not away. A Pi that waits on something, a
  background process of its own or a Taskfleet run its conversation created
  that still works, is not stopped for idleness at all (Jari, 2026-10-30);
  memory stays bounded by the per-person limit, because a Pi held only by a
  run still yields its place, after the truly idle. A room stop does not
  wait for absence, it only prefers the conversation seen longest ago.
- An uncertain outcome stays uncertain. A missing receipt is not a
  rejection, a 503 does not mean nothing happened, an unavailable inventory
  is not an empty one, and neither the daemon nor the browser ever repeats a
  write, a prompt or a code submission automatically.
- One writer per browser conversation; an uncertain writer observation
  blocks the write.
- Taskfleet owns spinoffs: the daemon never starts, merges or writes to one
  for the browser, and reads its records read-only. The browser shell
  shows a Taskfleet tmux window only by reading its pane: it attaches no
  tmux client and makes no session or hook on Taskfleet's server, and no
  browser input reaches it. (A read-only, ignore-size client still sized the
  window once Taskfleet's own client left, and a view session's detach hook
  with `destroy-unattached` lost the whole tmux 3.6 server.)
- Shells are tmux's: the daemon keeps no list, buffer or record of them, and
  listing them never starts a tmux server.
- Destruction is explicit. A workspace goes to the freedesktop Trash, and
  permanent deletion happens only from the Trash on a typed request; a
  clean, fully pushed clone is the one outright deletion. An interrupted
  clone is only restarted or removed when the person asks. Nothing is
  purged automatically, and removal never follows a symlink or crosses a
  filesystem.
- Tokens, native error text and credential-bearing remote URLs never cross
  the contract; native failures reach the browser as fixed codes. The one
  exception (Jari, 2026-10-27) is Soniox's temporary key for one dictation,
  so the browser can stream audio straight to Soniox: the person's own
  daemon mints it with their Soniox key, `single_use`, valid for at most
  60 s to open a stream, capped by the session ceiling
  (`max_session_duration_seconds` 600) and usable only for
  `transcribe_websocket`. It is returned only to the session that asked,
  never logged or stored, and the long-lived key never leaves the home.
- Service diagnostics (JSONL on stderr, one journal per service) carry the
  component, event, outcome and a fixed reason, never raw errors,
  credentials, user content or command output. They are operational
  observations, not an audit trail.

## Traps

Two traps are worth knowing before touching this code.

`SO_PEERCRED` on a connection to a systemd-created socket reports PID 1 as
root, not the daemon that accepts, which is why the gateway verifies the socket
from the file system (`udssecure.Mapped`) and the daemon verifies the gateway
from the accepted connection. A test-mode dial to a locally bound socket sees
the daemon UID as peer, which is why `transport` has two branches there; they
look redundant and are not.

Almost everything here is `//go:build linux`; `nativegh/`, `transport/` and
`udssecure/` have no portable files at all, and `cli/`, `core/` and `gateway/`
do not build without them, so on a Mac `go vet ./...` and `go test ./...` fail
outright rather than run. Development hosts are normally Linux, so this bites
when checking on a Mac. Several tests also skip when the runner is
not root, the filesystem lacks POSIX ACLs, or no nonroot mapped UID exists;
their `t.Skip` messages say which. The disposable QEMU guests in
`scripts/vm-test.sh` are where those paths are actually proven, so a green
`go test` on the dev box covers less than it looks, and after provisioning or
ACL changes it is worth running with `-v` to see what was skipped.

Generated-contract drift only arises when `contracts/v1/` or
`cmd/contractgen` changed; the generated check catches it. Test selection and
the full-gate policy are in the root `TESTING.md`.

Pi RPC (1.3.0 through 1.5.2) serializes assistant deltas without cumulative
`partial` snapshots. `toolcall_start` supplies the tool identity; later
argument deltas do not. The
process relay therefore scopes identity to the current assistant message, and
status diagnostics are an allowlisted signal tail, not raw native frames.
Process selection in the browser retains the same owner/start-time fence as
HTTP controls: a selected short ID alone can silently become a different record.

The browser text editor has no execution or preview authority: CodeMirror is
a trusted bundled library; workspace text stays data, never project
plugins, HTML previews, language-server processes or package execution. Its
file backend belongs only to the mapped UID daemon. It is not a home file
server, filesystem registry or cache. Gateway relaying gives no filesystem
access. The save observation detects changes but cannot provide global CAS
against uncooperative native writers; do not promise exclusion or add force
writes, autosave or automatic retries to disguise this limitation.
