# Result

`internal/nativegitea/` is the tea v0.16.0 native owner, and `open-habitat
gitea git-credential get|store|erase` is the Git helper entry point. tea's PAT
YAML is the only connection and secret store. The package rereads it on every
call and keeps no account list, cache or token copy. The daemon is not wired
yet: contracts, daemon routes and clone jobs belong to the slice issues.

## What exists

- **Store** (`store_linux.go`): tea's path selection (XDG file if present, else
  `~/.tea/tea.yml` if present, else XDG). The walk from HOME opens every level
  through a descriptor without following symlinks. Each directory must belong
  to the person and not be group- or world-writable. The file must be regular,
  own-UID, single-link, no group/other bits and at most 1 MiB. Locking uses
  tea's own protocol (`configPath+".lock"`, flock, 5 s / 50 ms poll): shared
  for reads, exclusive for edits, with a reread under the lock. Writes go to an
  exclusive temp file, then fsync, an inode/size/mtime/ctime check that the
  file is still the one read, rename (`RENAME_NOREPLACE` when creating) and a
  directory fsync. A failure before the rename leaves the old bytes. A failure
  after it is `write_uncertain`: reread, never replay.
- **Format** (`logins.go`): the file is edited as yaml.v3 nodes, so unknown
  fields, preferences, comments, order and defaults survive. A new entry has
  tea's fields in tea's order and is never default. Malformed or unsafe files
  are unavailable, never an empty list. That covers anything tea would reject,
  duplicate keys, several documents, aliases/anchors and an empty
  (crash-truncated) file. Duplicate names or duplicate base+user accounts are
  ambiguous and never selected. OAuth, SSH-only, insecure and invalid entries
  are listed as unsupported, and the projection carries a URL only when it is
  canonical.
- **Lifecycle** (`lifecycle_linux.go`): `Connect` / `Replace` / `Remove` /
  `Hold`. Connect validates `/user` and adds `habitat-<base digest>-<id>`. It
  refuses an existing account (external or owned), a reused PAT and a name
  takeover. Replace requires the same user, and for owned entries the same
  Gitea ID. Refusal leaves the bytes unchanged. Remove is local only and is
  refused while the daemon holds the login for a job. A repeated request
  returns `unchanged`/`absent` instead of writing again.
- **Network** (`client.go`, `base.go`): canonical HTTPS base parsing. Dialing
  resolves first, then checks every address before connecting: unspecified,
  multicast, link-local, 0/8, broadcast and the metadata addresses outside
  link-local are refused, and loopback only when the person typed
  localhost/loopback. Verified TLS against system roots, no proxy, no
  redirects, bounded `/user` read.
- **Git helper** (`credential.go`, `gitconfig.go`, `internal/cli/gitea_linux.go`):
  `get` answers only one usable login. It requires HTTPS, exact host:port and
  an owner/repository path below that login's base. No other instance on the
  host may claim a longer base, and the username must match (when absent, the
  base must have exactly one entry). `store`/`erase` are no-ops. Registration
  writes `credential.<base>.helper` as `""` then `<abs> gitea git-credential`,
  plus `useHttpPath=true` and `http.<base>.followRedirects=false`, through Git
  itself. It never touches github.com or other scopes and refuses foreign
  values. State also reads included files, and a later applicable helper or
  reset makes it report *shadowed*. Register repairs that by moving our keys
  after the later entries. Unregister removes values only while they are
  exactly ours. CONFORMANCE.md records the protocol exception.

## Validation

Revision: `01dd4e37` (tree of the commit carrying this result adds only this
file and issue metadata).

- `go test ./internal/nativegitea/ ./internal/cli/` under `umask 077` with
  `TMPDIR=/var/tmp/oh-…`: passed. They also pass under `umask 002` (fixtures pin
  their synthetic home to 0700). `go vet` passed, `gofmt` is clean.
- The fixtures cover two accounts on one host, base paths, ports and IPv6. They
  cover wrong UID (injected expected owner), broad mode, symlinked file, lock or
  directory, hardlink, FIFO and group-writable directory. They cover malformed,
  duplicate-key, alias, multi-document, empty and oversized YAML and the legacy
  path. Preservation is checked through Connect, Replace (byte-identical except
  the token) and Remove. Tea's flock is held as tea does: busy, then wait and
  keep tea's in-place write. Injected ENOSPC, EDQUOT and EXDEV leave the bytes
  and no temp file. A lost directory fsync is observed as `unchanged`, and a
  lock-ignoring editor yields `changed`.
- Real `git credential fill/approve/reject` (Git 2.53) ran in a disposable HOME
  with the test binary as the installed helper. The HOME had a global `store`
  helper before ours and a second one written after ours (shadowing, repaired),
  plus gh's GitHub helper. The tests cover the right token per account, base
  path, port and IPv6. They also cover no credential without a username on a
  two-account host, for another instance or port, or over HTTP. An explicit
  `--login` never crosses host, port or base. No `.git-credentials` or other
  copy was made, and no token appeared in any file but tea's.
- Dial filter: an httptest TLS server on 127.0.0.1 and [::1] with an injected
  resolver. Refused classes (IPv4, IPv6 and mapped) never reach the server, an
  explicit `[::1]` succeeds, and the system roots reject the test CA.
- Independent review: gpt-6-astra as finder, claude-fable-5-1 as verifier,
  routine rigor on a high-risk surface. It confirmed four defects, all fixed in
  `01dd4e37` with regressions:
  - included Git config was invisible to the helper-chain check;
  - a root instance's PAT was lent to a removed base-path instance's
    repositories;
  - a raw tea URL that could carry userinfo reached the projection;
  - a later empty helper reset was reported as registered.
  `/assess-findings` gave FIX for all four, 0 drops.

Not run or not proven: no tea binary is installed here, so interop with a real
`tea login add/list` was not run. The fixtures follow the v0.16.0 source
(`modules/config`, `modules/filelock`). Nothing ran as real distinct UIDs or
against a real Gitea, scopes or revocation. Release-path stability of the
registered helper is §6. Repository-local helper entries for managed transfers
are §3.

## Decisions for later review

- **Where the helper finds tea's file**: `$HOME` and `$XDG_CONFIG_HOME` (when
  absolute and inside HOME) from Git's environment, as tea and Git do. The
  alternative, the passwd home, would disagree with the Git config that found
  the helper.
- **Symlinked tea ancestry is refused**, for example a dotfiles-managed
  `~/.config` symlink. The file is then unavailable rather than followed.
- **No username**: matches only when that base has exactly one entry of any
  kind. ADR 0031 asks for `credential.username` only with several accounts.
- **Repository shape**: exactly `owner/repo[.git]` below the base, which leaves
  LFS and other subpaths unmatched (not MVP). This is what keeps a root instance
  from claiming a sibling base-path instance.
- **External accounts**: Connect refuses an account tea already has through an
  external entry, rather than adding a duplicate that would make both
  ambiguous. The person uses that entry; it is replaceable by explicit target,
  with the username as identity.
- **Owned entry fields**: `habitat-<first 12 hex of sha256(base)>-<id>`,
  `version_check: true`, `ssh_host` = host[:port], never default.
- **Addresses**: IDN, percent-encoding and numeric final labels are refused.
  Hosts are lowercased. CGNAT/100.64/10 is allowed (VPN), except the Alibaba
  metadata address; `fd00:ec2::254` is refused.
- **Refused YAML forms**: an empty file, aliases and anchors, and several
  documents are unavailable.
- **Unregister keeps no record of prior values**: it removes `useHttpPath=true`
  and `followRedirects=false` even if the person had identical values before,
  because a sidecar would be a second store.
- **Shadowing repair moves our keys** to the end of `~/.gitconfig`. A foreign
  key in our section pins it, and the registration is refused.
- **Helper exits**: 0 for a credential or no match (ambiguity adds one fixed
  stderr line), 1 for malformed arguments or request, 2 for unavailable tea
  state.

No user-visible change: nothing is wired into the daemon or UI, so no
KOKEILTAVAA.md entry.
